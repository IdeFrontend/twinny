# Completion System Architecture

## Overview

The completion system provides Fill-in-the-Middle (FIM) code completions as you type. It's optimized for low latency, high relevance, and syntax-aware stopping.

## Component Diagram

```
┌───────────────────────────────────────────────────────────┐
│              CompletionProvider                           │
│  ┌─────────────────────────────────────────────────────┐ │
│  │  provideInlineCompletionItems()                     │ │
│  │  ┌───────────────────────────────────────────────┐ │ │
│  │  │ 1. Context Extraction                         │ │ │
│  │  │    - Get prefix/suffix                        │ │ │
│  │  │    - Parse with tree-sitter                   │ │ │
│  │  │    - Determine multiline need                 │ │ │
│  │  └───────────────────────────────────────────────┘ │ │
│  │  ┌───────────────────────────────────────────────┐ │ │
│  │  │ 2. Prompt Building                            │ │ │
│  │  │    - File interaction context                 │ │ │
│  │  │    - FIM template formatting                  │ │ │
│  │  │    - Repository-level context (optional)      │ │ │
│  │  └───────────────────────────────────────────────┘ │ │
│  │  ┌───────────────────────────────────────────────┐ │ │
│  │  │ 3. LLM Streaming                              │ │ │
│  │  │    - Send request via llm()                   │ │ │
│  │  │    - Stream chunks                            │ │ │
│  │  │    - Syntax-aware stopping                    │ │ │
│  │  └───────────────────────────────────────────────┘ │ │
│  │  ┌───────────────────────────────────────────────┐ │ │
│  │  │ 4. Formatting & Return                        │ │ │
│  │  │    - CompletionFormatter                      │ │ │
│  │  │    - Cache completion                         │ │ │
│  │  │    - Return InlineCompletionItem              │ │ │
│  │  └───────────────────────────────────────────────┘ │ │
│  └─────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────┘
           │              │               │
           ▼              ▼               ▼
    ┌──────────┐  ┌────────────┐  ┌──────────────┐
    │   Cache  │  │ Tree-sitter│  │FileInteraction│
    │          │  │   Parser   │  │    Cache      │
    └──────────┘  └────────────┘  └──────────────┘
```

## Sequence Diagram

```
User → Editor → CompletionProvider → Parser → LLM → Formatter → User
│       │           │                  │       │        │          │
├─type──┤           │                  │       │        │          │
│       ├─trigger───►                  │       │        │          │
│       │(debounce) │                  │       │        │          │
│       │           ├─parse────────────►       │        │          │
│       │           ◄─AST──────────────┤       │        │          │
│       │           ├─buildPrompt──────┤       │        │          │
│       │           ├─streamRequest────┼───────►        │          │
│       │           ◄─chunk──────────────────────┤      │          │
│       │           ├─shouldStop?───────►        │      │          │
│       │           ◄─continue/stop─────┤        │      │          │
│       │           ├─format───────────────────────────►│          │
│       │           ◄─formatted─────────────────────────┤          │
│       ◄─display────┤                  │       │        │          │
│       │           │                  │       │        │          │
◄──see─┬┘           │                  │       │        │          │
```

## Key Components

### 1. CompletionProvider Class

**File**: `src/extension/providers/completion.ts`

**Implements**: `InlineCompletionItemProvider` from VSCode API

#### State Management

```typescript
class CompletionProvider {
  // Cancellation
  private _abortController: AbortController | null
  
  // Request deduplication
  private _nonce: number
  
  // Debouncing
  private _debouncer: NodeJS.Timeout
  
  // Current context
  private _document: TextDocument | null
  private _position: Position | null
  private _prefixSuffix: PrefixSuffix
  
  // Streaming state
  private _completion: string
  private _chunkCount: number
  
  // Parsing
  private _parser: Parser | undefined
  private _nodeAtPosition: SyntaxNode | null
  
  // Completion tracking
  private _acceptedLastCompletion: boolean
  private _lastCompletionMultiline: boolean
  public lastCompletionText: string
  
  // Lock for concurrency
  private _lock: AsyncLock
}
```

#### Main Flow

```typescript
async provideInlineCompletionItems(
  document: TextDocument,
  position: Position,
  context: InlineCompletionContext
): Promise<InlineCompletionItem[]> {
  // 1. Early returns
  if (!enabled || isMiddleOfString() || cachedCompletion) {
    return handleEarlyReturn()
  }
  
  // 2. Setup
  this._prefixSuffix = getPrefixSuffix(contextLength, document, position)
  await this.tryParseDocument(document)
  
  // 3. Determine multiline
  this._isMultilineCompletion = getIsMultilineCompletion({
    node: this._nodeAtPosition,
    prefixSuffix: this._prefixSuffix
  })
  
  // 4. Debounced request
  return new Promise((resolve) => {
    this._debouncer = setTimeout(async () => {
      await this._lock.acquire('twinny.completion', async () => {
        const prompt = await this.getPrompt(this._prefixSuffix)
        const request = this.buildFimRequest(prompt, provider)
        
        await llm({
          body: request.body,
          options: request.options,
          onStart: (controller) => this._abortController = controller,
          onData: (data) => {
            const completion = this.onData(data)
            if (completion) this._abortController?.abort()
          },
          onEnd: () => resolve(this.provideInlineCompletion())
        })
      })
    }, debounceWait)
  })
}
```

### 2. Syntax-Aware Stopping

**Problem**: LLMs don't know when to stop in FIM completions

**Solution**: Use tree-sitter to detect syntactic completion boundaries

#### Stopping Logic

```typescript
private onData(data: StreamResponse): string {
  this._completion += getFimDataFromProvider(provider, data)
  this._chunkCount++
  
  // 1. Stop on stop words
  if (stopWords.some(sw => this._completion.includes(sw))) {
    return this._completion
  }
  
  // 2. Single-line mode: stop on line break
  if (!multilineEnabled && LINE_BREAK_REGEX.test(this._completion)) {
    return this._completion
  }
  
  // 3. Multiline not needed: stop early
  if (!this._isMultilineCompletion && 
      multilineEnabled && 
      LINE_BREAK_REGEX.test(this._completion)) {
    return this._completion
  }
  
  // 4. Syntax-aware stopping
  if (this._completion.includes('\n')) {
    const { rootNode } = this._parser.parse(currentLine + this._completion)
    
    // Check bracket balance
    const isBalanced = checkBracketBalance(this._completion)
    const hasCompleteSyntax = openBrackets.length === 0 && isBalanced
    
    // Check for function end
    if (isInsideFunction && this._completion.includes('}')) {
      if (hasCompleteSyntax) {
        return trimAtFunctionEnd(this._completion)
      }
    }
    
    // Check for structural boundary
    if (structuralBoundaryPattern && hasCompleteSyntax) {
      return trimAtBoundary(this._completion)
    }
    
    // Check completion conditions
    if (takeFirst || hasCompleteSyntax) {
      if (endsWithEmptyLine || hasEndPattern || indentationReturned) {
        return this._completion
      }
    }
  }
  
  // 5. Max lines limit
  if (getLineBreakCount(this._completion) >= maxLines) {
    return this._completion
  }
  
  return '' // Continue streaming
}
```

#### Multiline Detection

```typescript
function getIsMultilineCompletion({
  node,
  prefixSuffix
}: {
  node: SyntaxNode | null
  prefixSuffix: PrefixSuffix
}): boolean {
  if (!node) return false
  
  // Check if inside multiline-friendly context
  const isMultilineNode = 
    MULTILINE_OUTSIDE.includes(node.type) ||
    MULTILINE_INSIDE.includes(node.type)
  
  // Check if prefix ends with multiline delimiter
  const endsWithDelimiter = MULTI_LINE_DELIMITERS.some(
    delimiter => prefixSuffix.prefix.trimEnd().endsWith(delimiter)
  )
  
  return isMultilineNode && endsWithDelimiter
}
```

### 3. Context Building

#### Prefix/Suffix Extraction

```typescript
function getPrefixSuffix(
  contextLength: number,
  document: TextDocument,
  position: Position
): PrefixSuffix {
  const lineCount = document.lineCount
  const currentLine = position.line
  
  const startLine = Math.max(0, currentLine - contextLength)
  const endLine = Math.min(lineCount - 1, currentLine + contextLength)
  
  const prefix = document.getText(
    new Range(startLine, 0, position.line, position.character)
  )
  
  const suffix = document.getText(
    new Range(position.line, position.character, endLine, Number.MAX_VALUE)
  )
  
  return { prefix, suffix }
}
```

#### File Context

```typescript
private async getFileInteractionContext(): Promise<string> {
  // Get files user recently interacted with
  this._fileInteractionCache.addOpenFilesWithPriority()
  const interactions = this._fileInteractionCache.getAll()
  
  const fileChunks: string[] = []
  for (const interaction of interactions) {
    if (interaction.name === currentFileName) continue
    
    const document = await workspace.openTextDocument(interaction.name)
    
    // If large file, use active lines context
    if (document.lineCount > MAX_CONTEXT_LINE_COUNT) {
      const averageLine = calculateAverageLine(interaction.activeLines)
      const range = new Range(averageLine - 100, 0, averageLine + 100, 0)
      fileChunks.push(document.getText(range))
    } else {
      fileChunks.push(document.getText())
    }
  }
  
  return fileChunks.join('\n')
}
```

### 4. FIM Prompt Templates

**Fill-in-the-Middle** formats vary by model:

#### Codellama Format

```
<PRE> {prefix} <SUF> {suffix} <MID>
```

#### DeepSeek Format

```
<｜fim▁begin｜>{prefix}<｜fim▁hole｜>{suffix}<｜fim▁end｜>
```

#### Starcoder Format

```
<fim_prefix>{prefix}<fim_suffix>{suffix}<fim_middle>
```

#### Custom Template

```handlebars
{{#if systemMessage}}
{{{systemMessage}}}
{{/if}}

{{#if context}}
<context>
{{{context}}}
</context>
{{/if}}

<prefix>
{{{prefix}}}
</prefix>

<suffix>
{{{suffix}}}
</suffix>

Complete the code at <prefix> considering the <suffix>.
```

### 5. Completion Formatting

**File**: `src/extension/completion-formatter.ts`

```typescript
class CompletionFormatter {
  format(completion: string): string {
    // 1. Remove leading whitespace from first line
    const trimmedCompletion = completion.trimStart()
    
    // 2. Normalize line endings
    const normalized = normalizeLineEndings(trimmedCompletion)
    
    // 3. Fix indentation to match editor
    const currentIndentation = getCurrentLineIndentation(this._editor)
    const formatted = adjustIndentation(normalized, currentIndentation)
    
    // 4. Remove trailing whitespace
    return formatted.trimEnd()
  }
}
```

### 6. Caching

```typescript
class Cache {
  private _cache = new Map<string, string>()
  
  getCache(prefixSuffix: PrefixSuffix): string | undefined {
    const key = this.getCacheKey(prefixSuffix)
    return this._cache.get(key)
  }
  
  setCache(prefixSuffix: PrefixSuffix, completion: string): void {
    const key = this.getCacheKey(prefixSuffix)
    this._cache.set(key, completion)
    
    // LRU eviction
    if (this._cache.size > MAX_CACHE_SIZE) {
      const firstKey = this._cache.keys().next().value
      this._cache.delete(firstKey)
    }
  }
  
  private getCacheKey(prefixSuffix: PrefixSuffix): string {
    return `${prefixSuffix.prefix}|||${prefixSuffix.suffix}`
  }
}
```

## Configuration

### Settings

```json
{
  "twinny.enabled": true,
  "twinny.autoSuggestEnabled": true,
  "twinny.debounceWait": 300,
  "twinny.contextLength": 100,
  "twinny.multilineCompletionsEnabled": true,
  "twinny.maxLines": 40,
  "twinny.temperature": 0.2,
  "twinny.numPredictFim": 512,
  "twinny.completionCacheEnabled": false,
  "twinny.fileContextEnabled": false,
  "twinny.enableSubsequentCompletions": true
}
```

### Provider Configuration

```typescript
interface TwinnyProvider {
  provider: string           // "ollama", "openai", etc.
  modelName: string         // "codellama:7b"
  apiHostname: string       // "localhost"
  apiPort: number           // 11434
  apiPath: string           // "/api/generate"
  apiProtocol: string       // "http" | "https"
  apiKey?: string           // Optional API key
  fimTemplate: string       // "codellama" | "deepseek" | "custom"
  repositoryLevel?: boolean // Use repo-level context
}
```

## Performance Characteristics

### Latency Breakdown

```
User Keystroke
├─→ 0ms: Event fired
├─→ 300ms: Debounce wait (configurable)
├─→ 10ms: Context extraction
├─→ 5ms: Parsing with tree-sitter
├─→ 5ms: Prompt building
├─→ 100-2000ms: LLM inference (varies by model/provider)
├─→ 0ms: Streaming (progressive display)
└─→ 5ms: Formatting

Total P50: ~400ms (local)
Total P95: ~2300ms (remote)
```

### Optimization Techniques

1. **Debouncing**: Prevents request spam on rapid typing
2. **Abort Controller**: Cancels in-flight requests
3. **Incremental Parsing**: tree-sitter reuses previous parses
4. **Streaming**: Display tokens as they arrive
5. **Caching**: Skip LLM for identical context
6. **Lock**: Prevents concurrent completion requests

## Error Handling

```typescript
try {
  await llm({
    body: request.body,
    options: request.options,
    onError: () => {
      this._abortController?.abort()
      this._statusBar.text = '$(code)'
      // Silent failure - don't show error to user
    }
  })
} catch (error) {
  // Log error but don't interrupt user
  logger.log(`Completion error: ${error}`)
  return []
}
```

## Testing Strategy

### Unit Tests

```typescript
describe('CompletionFormatter', () => {
  it('should remove leading whitespace', () => {
    const formatter = new CompletionFormatter(editor)
    expect(formatter.format('  code')).toBe('code')
  })
  
  it('should preserve indentation', () => {
    const formatter = new CompletionFormatter(editor)
    expect(formatter.format('  line1\n  line2'))
      .toBe('line1\n  line2')
  })
})
```

### Integration Tests

Manual testing focuses on:
- Different languages
- Multiline vs single-line
- Context relevance
- Stopping accuracy

## Future Enhancements

1. **Ranking**: Multiple completions with scoring
2. **Speculative Decoding**: Faster inference
3. **Local Models**: Built-in quantized models
4. **A/B Testing**: Template experimentation
5. **User Feedback**: Thumbs up/down on completions
