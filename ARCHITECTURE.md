# Twinny Architecture Documentation

## Overview

Twinny is a Visual Studio Code extension that provides AI-powered code completion and chat functionality. It supports multiple AI providers (Ollama, OpenAI, Anthropic, etc.) and includes advanced features like workspace embeddings, RAG (Retrieval-Augmented Generation), and P2P inference through the Symmetry network.

## System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      VS Code Extension Host                  │
│  ┌────────────────────────────────────────────────────────┐ │
│  │                Extension Core (index.ts)                │ │
│  │  - Activation/Deactivation                              │ │
│  │  - Command Registration                                 │ │
│  │  - Service Initialization                               │ │
│  └────────────┬───────────────────────────────────────────┘ │
│               │                                              │
│  ┌────────────▼────────────────────────────────────────────┐│
│  │                  Provider Layer                         ││
│  │  ┌──────────────┐ ┌──────────────┐ ┌─────────────────┐││
│  │  │ Completion   │ │   Sidebar    │ │  Panel (Full-   │││
│  │  │  Provider    │ │   Provider   │ │  Screen Chat)   │││
│  │  └──────┬───────┘ └──────┬───────┘ └────────┬────────┘││
│  └─────────┼────────────────┼──────────────────┼─────────┘│
│            │                │                  │           │
│  ┌─────────▼────────────────▼──────────────────▼─────────┐ │
│  │                   Core Services                        │ │
│  │  ┌────────┐ ┌────────┐ ┌──────────┐ ┌──────────────┐ │ │
│  │  │  Chat  │ │  LLM   │ │Embeddings│ │   Symmetry   │ │ │
│  │  │Service │ │        │ │ Database │ │   Service    │ │ │
│  │  └────────┘ └────────┘ └──────────┘ └──────────────┘ │ │
│  │                                                        │ │
│  │  ┌──────────────┐ ┌─────────────┐ ┌────────────────┐ │ │
│  │  │  Template    │ │   Session   │ │ File Handler & │ │ │
│  │  │  Provider    │ │   Manager   │ │  Interaction   │ │ │
│  │  └──────────────┘ └─────────────┘ └────────────────┘ │ │
│  └────────────────────────────────────────────────────────┘ │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           │ Webview Bridge (postMessage API)
                           │
┌──────────────────────────▼───────────────────────────────────┐
│                    Webview Layer (React)                      │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │  │
│  │  │   Chat   │ │ Settings │ │Providers │ │ Review   │  │  │
│  │  │   View   │ │   View   │ │   View   │ │   View   │  │  │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘  │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │  │
│  │  │Embeddings│ │Symmetry  │ │ History  │ │Templates │  │  │
│  │  │   View   │ │   View   │ │   View   │ │   View   │  │  │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘  │  │
│  └────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────┐  │
│  │              Shared Components & Hooks                  │  │
│  │  - Custom Hooks (useModels, useProviders, etc.)        │  │
│  │  - UI Components (CodeBlock, MessageItem, etc.)        │  │
│  └────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────┘
                           │
                           │ API Calls
                           │
┌──────────────────────────▼───────────────────────────────────┐
│                   External AI Providers                       │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌──────────┐  │
│  │ Ollama │ │ OpenAI │ │Anthropic│ │ Groq   │ │  Custom  │  │
│  └────────┘ └────────┘ └────────┘ └────────┘ └──────────┘  │
└───────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. Extension Entry Point (`src/index.ts`)

**Purpose**: Main extension lifecycle management

**Responsibilities**:
- Extension activation and deactivation
- Service initialization and dependency injection
- Command registration
- Event listener setup
- Status bar management

**Key Functions**:
- `activate()`: Initializes all providers and services
- `deactivate()`: Cleanup on extension shutdown

### 2. Provider Layer

#### 2.1 Completion Provider (`src/extension/providers/completion.ts`)

**Purpose**: Provides inline code completion suggestions

**Key Features**:
- Fill-in-the-Middle (FIM) completions
- Multi-line completion support
- Syntax-aware completion using tree-sitter
- Completion caching
- File context integration
- Debounced completion requests

**Architecture Pattern**: Implements VSCode's `InlineCompletionItemProvider` interface

**Data Flow**:
```
User Types → provideInlineCompletionItems() → Build FIM Prompt
    ↓
Get Context (file interaction, neighboring files)
    ↓
Stream Completion from LLM → Parse & Format → Return InlineCompletionItem
```

#### 2.2 Sidebar Provider (`src/extension/providers/sidebar.ts`)

**Purpose**: Manages the sidebar webview

**Responsibilities**:
- Webview lifecycle management
- HTML generation for webview
- Message passing coordination
- Ready state management

**Extends**: `BaseProvider`

#### 2.3 Panel Provider (`src/extension/providers/panel.ts`)

**Purpose**: Full-screen chat panel (alternative to sidebar)

**Features**:
- Larger workspace for chat interactions
- Same functionality as sidebar in expanded view

### 3. Core Services

#### 3.1 Chat Service (`src/extension/chat.ts`)

**Purpose**: Manages chat conversations and LLM interactions

**Key Responsibilities**:
- Conversation state management
- Message streaming
- RAG (Retrieval-Augmented Generation) integration
- Template-based completions
- File context handling
- System prompt generation

**Architecture Highlights**:
- Uses `TokenJS` library for LLM interactions
- Supports both streaming and non-streaming completions
- Integrates with embeddings database for RAG
- Implements reranking for relevant context

**Key Methods**:
- `completion()`: Main chat completion with context
- `templateCompletion()`: Template-based completions (explain, refactor, etc.)
- `getRagContext()`: Retrieves relevant code using embeddings
- `buildConversation()`: Constructs conversation with context

#### 3.2 LLM Service (`src/extension/llm.ts`)

**Purpose**: Low-level HTTP communication with AI providers

**Features**:
- Streaming response handling
- Multiple provider support
- Request/response transformation
- Error handling and retries

#### 3.3 Embeddings Database (`src/extension/embeddings.ts`)

**Purpose**: Vector database for code embeddings

**Technology**: LanceDB (vector database)

**Features**:
- Document chunking and embedding
- Semantic code search
- File path indexing
- Reranking support

**Schema**:
- Documents table: Code chunks with embeddings
- File paths table: File metadata with embeddings

**Key Operations**:
- `addDocuments()`: Index code chunks
- `getDocuments()`: Semantic search
- `fetchModelEmbedding()`: Generate embeddings via LLM

#### 3.4 Symmetry Service (`src/extension/symmetry-service.ts`)

**Purpose**: P2P network for distributed AI inference

**Architecture**: Decentralized network using hyperswarm

**Features**:
- Peer discovery and connection
- P2P inference job distribution
- Provider registration
- Symmetric encryption

#### 3.5 Template Provider (`src/extension/template-provider.ts`)

**Purpose**: Handlebars template management for prompts

**Features**:
- Template loading and caching
- Dynamic template rendering
- User-customizable templates stored in `~/.twinny/templates/`

**Default Templates**:
- Chat prompts (explain, refactor, add-types, etc.)
- FIM prompts
- System messages

### 4. Supporting Components

#### 4.1 Session Manager (`src/extension/session-manager.ts`)

**Purpose**: In-memory session state management

**Use Cases**:
- Active provider tracking
- Symmetry connection state
- Temporary flags and state

#### 4.2 File Interaction Cache (`src/extension/file-interaction.ts`)

**Purpose**: Tracks user file interactions for relevance scoring

**Metrics Tracked**:
- File visit frequency
- Keystroke count per file
- Active lines
- Session duration

**Usage**: Prioritizes files for context in completions

#### 4.3 Provider Manager (`src/extension/provider-manager.ts`)

**Purpose**: AI provider configuration management

**Features**:
- Provider CRUD operations
- Storage abstraction (globalState vs file)
- Provider validation

#### 4.4 Reranker (`src/extension/reranker.ts`)

**Purpose**: Semantic reranking of search results

**Technology**: ONNX Runtime with BGE reranker model

**Usage**: Improves RAG relevance by reranking embedding search results

### 5. Webview Layer (React)

**Location**: `src/webview/`

**Architecture**: Single-page React application

**Key Views**:
- **Chat** (`chat.tsx`): Main conversation interface
- **Settings** (`settings.tsx`): Extension configuration
- **Providers** (`providers.tsx`): AI provider management
- **Templates** (`default-providers.tsx`): Template editor
- **Embeddings** (`embedding-options.tsx`): Embedding configuration
- **Symmetry** (`symmetry.tsx`): P2P network interface
- **Review** (`review.tsx`): Code review interface
- **History** (`conversation-history.tsx`): Past conversations

**Communication Pattern**:
```
Webview (React) ←→ postMessage API ←→ Extension Host
```

**Custom Hooks**:
- `useModels()`: Available models from provider
- `useProviders()`: Provider configuration
- `useOllamaModels()`: Ollama-specific models
- `useConversationHistory()`: Chat history
- `useSymmetryConnection()`: P2P connection state

## Data Flow

### Completion Flow

```
1. User types in editor
   ↓
2. Debounce timer (300ms default)
   ↓
3. CompletionProvider.provideInlineCompletionItems()
   - Get prefix/suffix context
   - Parse document with tree-sitter
   - Determine if multiline completion needed
   ↓
4. Build FIM prompt
   - Add file context if enabled
   - Add neighboring file context
   - Format with FIM template
   ↓
5. Stream completion from LLM
   - Parse streaming chunks
   - Detect stop words
   - Detect completion boundaries (syntax-aware)
   ↓
6. Format completion
   - Remove stop words
   - Fix indentation
   - Cache if enabled
   ↓
7. Return InlineCompletionItem
```

### Chat Flow

```
1. User sends message in webview
   ↓
2. Webview posts message to extension
   ↓
3. Chat.completion() receives message
   - Build conversation history
   - Add system prompt
   - Get user selection context
   - Get RAG context (@workspace, @problems)
   - Load file contexts
   ↓
4. Query embeddings database (if @workspace)
   - Search for relevant files
   - Search for relevant code chunks
   - Rerank results
   ↓
5. Build final prompt with context
   ↓
6. Stream LLM response
   - Use TokenJS library
   - Parse streaming chunks
   ↓
7. Send chunks to webview via postMessage
   ↓
8. Webview renders markdown response
```

### Embedding Flow

```
1. User triggers embedding generation
   ↓
2. Scan workspace files
   - Respect .gitignore
   - Filter by configured globs
   ↓
3. For each file:
   - Read content
   - Chunk into documents
   - Generate embedding via LLM
   - Store in LanceDB
   ↓
4. Create two tables:
   - Documents: Code chunks
   - File paths: File metadata
```

## Design Patterns

### 1. Provider Pattern

All UI providers extend `BaseProvider`:
- Centralizes common functionality
- Manages webview lifecycle
- Handles message passing

### 2. Dependency Injection

Services receive dependencies via constructor:
```typescript
constructor(
  statusBar: StatusBarItem,
  context: ExtensionContext,
  db: EmbeddingDatabase
)
```

### 3. Event-Driven Architecture

- Extension ↔ Webview: postMessage events
- Symmetry: EventEmitter for P2P events
- VSCode API: Event subscriptions

### 4. Template Method Pattern

`Base` class provides common functionality:
- Configuration access
- Provider management
- Shared utilities

### 5. Strategy Pattern

Multiple FIM template formats:
- Automatic detection
- Codellama
- DeepSeek
- Custom templates

## Technology Stack

### Backend (Extension Host)

| Technology | Purpose |
|------------|---------|
| TypeScript | Primary language |
| Node.js | Runtime environment |
| VSCode Extension API | Extension framework |
| LanceDB | Vector database |
| web-tree-sitter | Code parsing |
| ONNX Runtime | ML model inference (reranking) |
| Hyperswarm | P2P networking |
| Handlebars | Template engine |
| TokenJS (fluency.js) | LLM API abstraction |
| Cheerio | HTML parsing |
| Fuse.js | Fuzzy search |

### Frontend (Webview)

| Technology | Purpose |
|------------|---------|
| React 18 | UI framework |
| TypeScript | Type safety |
| TipTap | Rich text editor |
| React Markdown | Markdown rendering |
| React Syntax Highlighter | Code highlighting |
| i18next | Internationalization |
| Lucide React | Icons |
| CSS Modules | Styling |

### Build System

| Technology | Purpose |
|------------|---------|
| esbuild | Fast bundling |
| TypeScript Compiler | Type checking |
| ESLint | Linting |

## Configuration Management

### User Settings

Stored in VSCode settings (`twinny.*`):
- Provider configurations
- Model settings
- Completion behavior
- Context settings
- Embedding options

### Extension State

**Global State** (persists across sessions):
- Provider configurations
- Embedding settings
- Symmetry network key

**Workspace State** (per workspace):
- Conversation history
- Context items
- Workspace-specific settings

**Session State** (in-memory):
- Active providers
- Connection status
- Temporary flags

## Security Considerations

1. **API Key Storage**: Stored in VSCode global state (encrypted by VSCode)
2. **Webview CSP**: Content Security Policy restricts script execution
3. **Input Sanitization**: User input sanitized before LLM calls
4. **File Access**: Respects workspace boundaries and .gitignore
5. **P2P Encryption**: Symmetry uses hypercore-crypto for encryption

## Performance Optimizations

1. **Debouncing**: 300ms debounce on completion requests
2. **Caching**: Optional completion caching
3. **Lazy Loading**: Models and providers loaded on-demand
4. **Streaming**: Streaming responses for better UX
5. **Worker Threads**: ONNX models run in separate threads
6. **Queue Management**: p-queue for rate limiting
7. **File Filtering**: Efficient .gitignore parsing
8. **Incremental Parsing**: tree-sitter for fast, incremental parsing

## Extension Points

### For Users

1. **Custom Templates**: Add Handlebars templates to `~/.twinny/templates/`
2. **Custom Providers**: Add any OpenAI-compatible API
3. **FIM Templates**: Configure custom FIM prompt formats
4. **Embedding Configuration**: Custom ignore patterns

### For Developers

1. **New Providers**: Extend provider support in `provider-manager.ts`
2. **New Templates**: Add to `src/extension/templates.ts`
3. **New Commands**: Register in `src/index.ts`
4. **New Webview Tabs**: Add React component and routing

## Testing Strategy

**Unit Tests**:
- `src/test/suite/completion-formatter.test.ts`

**Test Runner**:
- Mocha + @vscode/test-electron

**Build Verification**:
- TypeScript compilation
- ESLint checks
- Pre-publish validation

## Deployment

**Distribution**: VS Code Marketplace

**Build Process**:
```bash
npm run build        # Production build
npm run vscode:package  # Create .vsix
npm run vscode:publish  # Publish to marketplace
```

**Supported Platforms**:
- macOS (x64, arm64)
- Linux (x64, arm64)
- Windows (x64, arm64)

## Future Architecture Considerations

1. **Plugin System**: Allow third-party extensions
2. **Multi-Workspace Support**: Better handling of mono-repos
3. **Caching Layer**: Distributed cache for completions
4. **Telemetry**: Optional usage analytics
5. **A/B Testing**: Template and prompt experimentation
6. **Model Quantization**: Local model support

## References

- [VSCode Extension API](https://code.visualstudio.com/api)
- [LanceDB Documentation](https://lancedb.github.io/lancedb/)
- [web-tree-sitter](https://github.com/tree-sitter/tree-sitter)
- [Symmetry Protocol](https://www.symmetry.so/)
