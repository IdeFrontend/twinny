# Chat System Architecture

## Overview

The chat system enables conversational AI interactions with code context awareness, RAG (Retrieval-Augmented Generation), and template-based workflows.

## Component Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    Chat Service                          │
│  ┌───────────────────────────────────────────────────┐  │
│  │              completion()                          │  │
│  │  ┌─────────────────────────────────────────────┐  │  │
│  │  │ 1. Build Conversation                       │  │  │
│  │  │    - Add system prompt                      │  │  │
│  │  │    - Merge message history                  │  │  │
│  │  │    - Add user selection                     │  │  │
│  │  └─────────────────────────────────────────────┘  │  │
│  │  ┌─────────────────────────────────────────────┐  │  │
│  │  │ 2. Context Enrichment                       │  │  │
│  │  │    - RAG (@workspace, @problems)            │  │  │
│  │  │    - File contexts                          │  │  │
│  │  │    - Active selection                       │  │  │
│  │  └─────────────────────────────────────────────┘  │  │
│  │  ┌─────────────────────────────────────────────┐  │  │
│  │  │ 3. LLM Invocation                           │  │  │
│  │  │    - TokenJS abstraction                    │  │  │
│  │  │    - Stream or non-stream                   │  │  │
│  │  │    - Provider-specific logic                │  │  │
│  │  └─────────────────────────────────────────────┘  │  │
│  │  ┌─────────────────────────────────────────────┐  │  │
│  │  │ 4. Response Handling                        │  │  │
│  │  │    - Stream to webview                      │  │  │
│  │  │    - Update conversation                    │  │  │
│  │  │    - Error recovery                         │  │  │
│  │  └─────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
              │              │              │
              ▼              ▼              ▼
     ┌─────────────┐  ┌──────────┐  ┌──────────────┐
     │  Embeddings │  │ Reranker │  │   Template   │
     │   Database  │  │          │  │   Provider   │
     └─────────────┘  └──────────┘  └──────────────┘
```

## Sequence Diagram: Chat Flow

```
User → Webview → Chat Service → RAG → LLM → Webview → User
│        │           │           │     │       │        │
├─type───►           │           │     │       │        │
│        ├─message───►           │     │       │        │
│        │           ├─getRagContext───►       │        │
│        │           │           ├─embed       │        │
│        │           │           ├─search      │        │
│        │           │           ├─rerank      │        │
│        │           ◄─context───┤     │       │        │
│        │           ├─buildConversation       │        │
│        │           ├─llmStream────────►       │        │
│        │           ◄─chunk──────────────┤     │        │
│        ◄─postMessage─────────────────────┤    │        │
│        ├─render─────────────────────────────────►      │
◄──see──┴┘          │           │     │       │        │
```

## Core Components

### 1. Chat Class

**File**: `src/extension/chat.ts`

**Extends**: `Base` (common configuration & provider management)

#### State Management

```typescript
class Chat extends Base {
  // Conversation state
  private _conversation: ChatCompletionMessage[] = []
  
  // Streaming state
  private _completion: string = ''
  private _controller?: AbortController
  
  // Function calling state (experimental)
  private _functionName: string = ''
  private _functionArguments: string = ''
  private _isCollectingFunctionArgs: boolean = false
  
  // Services
  private _db?: EmbeddingDatabase
  private _reranker: Reranker
  private _templateProvider?: TemplateProvider
  private _symmetryService?: SymmetryService
  private _fileHandler: FileHandler
  
  // LLM client
  private _tokenJs: TokenJS | undefined
  
  // Webview communication
  private _webView?: Webview
  private _statusBar: StatusBarItem
  
  // Cancellation
  private _isCancelled: boolean = false
}
```

### 2. Message Flow

#### User Message to Response

```typescript
async completion(
  messages: ChatCompletionMessage[],
  fileContexts?: AnyContextItem[],
  conversationId?: string
) {
  this._completion = ''
  this._isCancelled = false
  
  // 1. Get provider and instantiate client
  const provider = this.getProvider()
  this.instantiateTokenJS(provider)
  
  // 2. Build conversation with context
  this._conversation = await this.buildConversation(
    messages,
    fileContexts,
    conversationId
  )
  
  // 3. Determine streaming vs non-streaming
  const stream = this.shouldUseStreaming(provider)
  
  // 4. Execute request
  return stream
    ? this.llmStream(this.getStreamOptions(provider, conversationId))
    : this.llmNoStream(this.getNoStreamOptions(provider))
}
```

### 3. Context Enrichment

#### RAG Context Retrieval

```typescript
async getRagContext(text?: string): Promise<string | null> {
  // Check for special mentions
  const workspaceMentioned = text?.includes('@workspace')
  const problemsMentioned = text?.includes('@problems')
  
  let combinedContext = ''
  
  // 1. Get problems context
  if (problemsMentioned) {
    const problemsContext = this.getProblemsContext()
    combinedContext += problemsContext + '\n\n'
  }
  
  // 2. Get workspace context via RAG
  if (workspaceMentioned) {
    updateLoadingMessage(this._webView, 'Exploring knowledge base')
    
    // 2a. Find relevant files
    const relevantFiles = await this.getRelevantFiles(text)
    
    // 2b. Find relevant code chunks
    const relevantCode = await this.getRelevantCode(text, relevantFiles)
    
    // 2c. Format context
    if (relevantFiles?.length) {
      const filesTemplate = await this._templateProvider?.readTemplate(
        'relevant-files',
        { code: relevantFiles.map(f => f[0]).join(', ') }
      )
      combinedContext += filesTemplate + '\n\n'
    }
    
    if (relevantCode) {
      const codeTemplate = await this._templateProvider?.readTemplate(
        'relevant-code',
        { code: relevantCode }
      )
      combinedContext += codeTemplate
    }
  }
  
  return combinedContext.trim() || null
}
```

#### File Relevance Retrieval

```typescript
private async getRelevantFiles(
  text: string
): Promise<[string, number][]> {
  if (!this._db || !text) return []
  
  const table = `${this._workspaceName}-file-paths`
  
  // 1. Generate embedding for query
  const embedding = await this._db.fetchModelEmbedding(text)
  
  // 2. Vector similarity search
  const filePaths = await this._db.getDocuments(
    embedding,
    relevantFileCount,
    table
  )
  
  // 3. Rerank results
  return this.rerankFiles(
    text,
    filePaths.map(f => f.content)
  )
}
```

#### Code Chunk Retrieval

```typescript
private async getRelevantCode(
  text: string,
  relevantFiles: [string, number][]
): Promise<string> {
  const table = `${this._workspaceName}-documents`
  
  // 1. Generate embedding
  const embedding = await this._db.fetchModelEmbedding(text)
  
  // 2. Search with file filter
  const query = relevantFiles?.length
    ? `file IN ("${relevantFiles.map(f => f[0]).join('","')}")`
    : ''
  
  const queryEmbeddedDocuments = await this._db.getDocuments(
    embedding,
    relevantCodeCount / 2,
    table,
    query
  )
  
  // 3. Search without filter (diversity)
  const embeddedDocuments = await this._db.getDocuments(
    embedding,
    relevantCodeCount / 2,
    table
  )
  
  // 4. Merge and rerank
  const documents = [...embeddedDocuments, ...queryEmbeddedDocuments]
  const scores = await this._reranker.rerank(
    text,
    documents.map(d => d.content)
  )
  
  // 5. Filter by threshold
  const documentChunks = documents
    .filter((_, index) => scores[index] > rerankThreshold)
    .map(d => d.content)
  
  // 6. Read full files if score is high
  const readFileChunks = []
  for (const [filePath, score] of relevantFiles) {
    if (score > rerankThreshold) {
      const content = await this.readFileContent(filePath)
      readFileChunks.push(content)
    }
  }
  
  return [...readFileChunks, ...documentChunks].join('\n\n').trim()
}
```

#### Reranking

```typescript
private async rerankFiles(
  text: string,
  filePaths: string[]
): Promise<[string, number][]> {
  // Extract file names for better reranking
  const fileNames = filePaths.map(fp => path.basename(fp))
  
  // Use BGE reranker model (ONNX)
  const scores = await this._reranker.rerank(text, fileNames)
  
  // Return paths with scores
  return filePaths.map((filePath, index) => 
    [filePath, scores[index]] as [string, number]
  )
}
```

### 4. Conversation Building

```typescript
private async buildConversation(
  messages: ChatCompletionMessage[],
  fileContexts: AnyContextItem[] | undefined,
  id?: string
): Promise<ChatCompletionMessage[]> {
  // 1. System message
  const systemMessage: ChatCompletionMessage = {
    role: SYSTEM,
    content: await this.getSystemPrompt(),
    id
  }
  
  // 2. Extract last message
  const lastMessage = messages[messages.length - 1]
  const messageContent = lastMessage.content?.toString() || ''
  
  // 3. Build additional context
  const additionalContext = await this.buildAdditionalContext(
    messageContent,
    fileContexts
  )
  
  // 4. Construct conversation
  const conversation = [
    systemMessage,
    ...messages.slice(0, -1),
    {
      role: USER,
      content: `${lastMessage.content}\n\n${additionalContext}`.trim(),
      images: lastMessage.images
    }
  ]
  
  // 5. Clean HTML entities and mentions
  return conversation.map(message => {
    const $ = cheerio.load(message.content as string)
    $('img').remove()
    
    const text = $.html('body')
      .replace(/@workspace|@problems/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .trim()
    
    // Handle images for vision models
    const images = message.images?.map(img => ({
      type: 'image_url' as const,
      image_url: { url: typeof img === 'string' ? img : img.data }
    })) || []
    
    const textPart = { type: 'text' as const, text }
    const contentParts = images.length > 0 
      ? [textPart, ...images] 
      : [textPart]
    
    return {
      role: message.role,
      content: contentParts
    }
  })
}
```

### 5. Streaming

```typescript
private async llmStream(requestBody: CompletionStreamingWithId) {
  this._controller = new AbortController()
  this._completion = ''
  
  try {
    // Create streaming request
    const result = await this._tokenJs.chat.completions.create(requestBody)
    
    // Process chunks
    for await (const part of result) {
      if (this._controller?.signal.aborted) break
      
      await this.onPart(part)
    }
    
    // Send final message
    await this._webView?.postMessage({
      type: EVENT_NAME.twinnyAddMessage,
      data: {
        content: this._completion.trim(),
        role: ASSISTANT
      }
    })
    
    this._webView?.postMessage({
      type: EVENT_NAME.twinnyStopGeneration
    })
  } catch (error) {
    // Handle error
    this._webView?.postMessage({
      type: EVENT_NAME.twinnyAddMessage,
      data: {
        content: error.message,
        role: ASSISTANT
      }
    })
  }
}

private async onPart(response: CompletionResponseChunk) {
  const delta = response.choices[0]?.delta
  
  if (delta?.content) {
    this._completion += delta.content
    
    // Stream partial completion to UI
    await this._webView?.postMessage({
      type: EVENT_NAME.twinnyOnCompletion,
      data: {
        content: this._completion.trimStart() || ' ',
        role: ASSISTANT
      }
    })
  }
}
```

### 6. Template-Based Completions

```typescript
async templateCompletion(
  promptTemplate: string,
  context?: string
) {
  // 1. Get template messages
  this._conversation = await this.getTemplateMessages(
    promptTemplate,
    context
  )
  
  // 2. Get provider
  const provider = this.getProvider()
  this.instantiateTokenJS(provider)
  
  // 3. Stream or non-stream
  const stream = this.shouldUseStreaming(provider)
  
  return stream
    ? this.llmStream(this.getStreamOptions(provider))
    : this.llmNoStream(this.getNoStreamOptions(provider))
}

async getTemplateMessages(
  template: string,
  context?: string
): Promise<ChatCompletionMessage[]> {
  const { language } = getLanguage()
  
  // 1. Build prompt from template
  const { prompt, selection } = await this.buildTemplatePrompt(
    template,
    language,
    context
  )
  
  // 2. Show in UI
  this._webView?.postMessage({
    type: EVENT_NAME.twinnyAddMessage,
    data: {
      role: USER,
      content: `${kebabToSentence(template)}\n\n\`\`\`\n${selection}\n\`\`\``
    }
  })
  
  // 3. Get RAG context for certain templates
  let ragContext = undefined
  if (['explain'].includes(template)) {
    ragContext = await this.getRagContext(selection)
  }
  
  // 4. Build conversation
  const userContent = ragContext
    ? `${prompt}\n\nAdditional Context:\n${ragContext}`
    : prompt
  
  this._conversation.push({
    role: USER,
    content: userContent.trim()
  })
  
  return this._conversation
}
```

## System Prompt

```typescript
async getSystemPrompt(): Promise<string> {
  return await this._templateProvider?.readTemplate('system', {
    cwd: workspace.workspaceFolders?.[0].uri.fsPath,
    defaultShell: os.userInfo().shell,
    osName: os.platform(),
    homedir: os.homedir()
  })
}
```

**Template** (`~/.twinny/templates/system.hbs`):
```handlebars
You are an AI coding assistant.

Current directory: {{cwd}}
Operating system: {{osName}}
Default shell: {{defaultShell}}

You must:
- Provide accurate, helpful code assistance
- Consider the user's current context
- Format code properly with markdown
- Explain your reasoning when helpful

You must NOT:
- Execute harmful code
- Make assumptions about undefined requirements
- Provide incomplete or incorrect solutions
```

## Webview Communication

### Message Types

```typescript
// Extension → Webview
enum EVENT_NAME {
  twinnyOnCompletion = 'twinnyOnCompletion',      // Streaming chunk
  twinnyAddMessage = 'twinnyAddMessage',          // Final message
  twinnyStopGeneration = 'twinnyStopGeneration',  // Stream ended
  twinnySetTab = 'twinnySetTab',                  // Switch tab
  twinnySendLanguage = 'twinnySendLanguage'       // Editor language
}

// Webview → Extension
enum CLIENT_MESSAGE_TYPE {
  sendMessage = 'sendMessage',                     // User message
  stopGeneration = 'stopGeneration',               // Cancel
  sendTemplate = 'sendTemplate',                   // Template action
  getGitCommitMessage = 'getGitCommitMessage'     // Special action
}
```

### Message Flow

```typescript
// Webview sends message
window.vscode.postMessage({
  type: 'sendMessage',
  data: messages,
  meta: { fileContexts }
})

// Extension receives
webView.onDidReceiveMessage(async (message) => {
  if (message.type === 'sendMessage') {
    await this._chat.completion(
      message.data,
      message.meta?.fileContexts
    )
  }
})

// Extension sends chunk
webView.postMessage({
  type: EVENT_NAME.twinnyOnCompletion,
  data: {
    content: chunk,
    role: 'assistant'
  }
})

// Webview receives and renders
useEffect(() => {
  const handler = (event) => {
    if (event.data.type === EVENT_NAME.twinnyOnCompletion) {
      setStreamingMessage(event.data.data.content)
    }
  }
  window.addEventListener('message', handler)
  return () => window.removeEventListener('message', handler)
}, [])
```

## Configuration

```json
{
  "twinny.numPredictChat": 512,
  "twinny.temperature": 0.7,
  "twinny.githubToken": "",
  "twinny.contextLength": 100
}
```

## Performance Characteristics

### Latency

```
User sends message
├─→ 0ms: Webview postMessage
├─→ 5ms: Extension receives
├─→ 50ms: Build conversation
├─→ 200-500ms: RAG context retrieval (if @workspace)
│   ├─→ 100ms: Generate query embedding
│   ├─→ 50ms: Vector search (files)
│   ├─→ 50ms: Vector search (code)
│   └─→ 100ms: Reranking
├─→ 10ms: Build final prompt
├─→ 500-5000ms: LLM inference (streaming)
│   └─→ ~50ms per token
└─→ 0ms: Stream to webview (progressive)

Total (without RAG): ~500-5000ms
Total (with RAG): ~700-5500ms
```

### Memory Usage

- **Base Chat**: ~50 MB
- **With Embeddings**: +100-500 MB (depends on workspace)
- **During Reranking**: +50 MB (ONNX model)

## Error Handling

```typescript
try {
  const result = await this._tokenJs.chat.completions.create(requestBody)
  // ... process result
} catch (error) {
  this._controller?.abort()
  
  // Show error in chat
  this._webView?.postMessage({
    type: EVENT_NAME.twinnyAddMessage,
    data: {
      content: error instanceof Error ? error.message : String(error),
      role: ASSISTANT
    }
  })
  
  // Stop generation indicator
  this._webView?.postMessage({
    type: EVENT_NAME.twinnyStopGeneration
  })
}
```

## Special Features

### @workspace Mention

Triggers RAG retrieval from embeddings database.

### @problems Mention

Includes workspace diagnostics (linter errors, warnings).

```typescript
getProblemsContext(): string {
  const problems = workspace.textDocuments
    .flatMap(document =>
      languages.getDiagnostics(document.uri).map(diagnostic => ({
        severity: DiagnosticSeverity[diagnostic.severity],
        message: diagnostic.message,
        code: document.getText(diagnostic.range),
        line: document.lineAt(diagnostic.range.start.line).text,
        lineNumber: diagnostic.range.start.line + 1,
        character: diagnostic.range.start.character + 1
      }))
    )
    .map(p => JSON.stringify(p))
    .join('\n')
  
  return problems
}
```

### Vision Support

Handles images for multimodal models:

```typescript
const images = message.images?.map(img => ({
  type: 'image_url' as const,
  image_url: { url: typeof img === 'string' ? img : img.data }
}))

const content = images.length > 0 
  ? [{ type: 'text', text }, ...images]
  : [{ type: 'text', text }]
```

## Future Enhancements

1. **Conversation Branching**: Fork conversations
2. **Multi-Turn Planning**: Agent-like workflows
3. **Tool Use**: Function calling for code actions
4. **Caching**: Conversation context caching
5. **Embeddings Refresh**: Auto-update on file changes
