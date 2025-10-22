# Architecture Overview

## Introduction

Twinny is a privacy-first AI coding assistant for Visual Studio Code that provides:
- **Inline code completion** (Fill-in-the-Middle)
- **AI chat** with code context awareness
- **Multi-provider support** (Ollama, OpenAI, Anthropic, Groq, etc.)
- **RAG capabilities** using vector embeddings
- **P2P inference** via Symmetry network

## Architecture Philosophy

### Core Principles

1. **Privacy First**: All data stays local or goes directly to user-chosen providers
2. **Provider Agnostic**: Support any OpenAI-compatible API
3. **Offline Capable**: Full functionality with local models (Ollama)
4. **Extensible**: Template system for customization
5. **Performance**: Efficient caching, debouncing, and streaming

### Architecture Style

**Type**: Monolithic VSCode Extension with Webview UI

**Pattern**: Layered Architecture
```
┌─────────────────────────┐
│    Presentation Layer   │  ← React Webview
├─────────────────────────┤
│   Application Layer     │  ← Providers & Commands
├─────────────────────────┤
│     Service Layer       │  ← Chat, LLM, Embeddings
├─────────────────────────┤
│  Infrastructure Layer   │  ← HTTP, DB, File I/O
└─────────────────────────┘
```

## System Context

```
┌──────────────┐
│   VS Code    │
│   ┌────────┐ │       ┌─────────────────┐
│   │ Twinny │◄───────►│  AI Providers   │
│   │        │ │       │ (OpenAI, etc.)  │
│   └───┬────┘ │       └─────────────────┘
│       │      │
│       │      │       ┌─────────────────┐
│       └──────┼──────►│   LanceDB       │
│              │       │  (Embeddings)   │
│              │       └─────────────────┘
└──────────────┘
                        ┌─────────────────┐
                        │ Symmetry P2P    │
                        │    Network      │
                        └─────────────────┘
```

## Key Architectural Decisions

### ADR-001: VSCode Extension with Webview

**Decision**: Use VSCode webview for complex UI instead of native API

**Rationale**:
- Rich UI requirements (chat, markdown, code highlighting)
- React ecosystem for complex state management
- Better UX for conversation interfaces

**Trade-offs**:
- ✅ Rich UI capabilities
- ✅ Familiar React development
- ❌ Higher memory footprint
- ❌ Communication overhead via postMessage

### ADR-002: LanceDB for Vector Storage

**Decision**: Use LanceDB embedded database for embeddings

**Rationale**:
- Embedded solution (no separate server)
- Fast vector similarity search
- Columnar format for efficiency
- Handles large workspaces

**Alternatives Considered**:
- Qdrant: Requires separate server
- Chroma: Python dependency
- Simple JSON: No vector search

### ADR-003: Handlebars for Templates

**Decision**: Use Handlebars for prompt templates

**Rationale**:
- Simple syntax for non-developers
- User-customizable without code changes
- Logic-less templates prevent complexity
- File-based templates easy to share

### ADR-004: Streaming by Default

**Decision**: Stream all LLM responses when supported

**Rationale**:
- Better perceived performance
- Allows early cancellation
- Progressive rendering
- Standard for chat interfaces

### ADR-005: Syntax-Aware Completion

**Decision**: Use tree-sitter for AST-based completion logic

**Rationale**:
- Better multi-line completion boundaries
- Syntax-aware stop detection
- Language-agnostic parsing
- Efficient incremental parsing

**Trade-offs**:
- ✅ Higher quality completions
- ✅ Language understanding
- ❌ Complexity
- ❌ Wasm binary size

## Component Boundaries

### Extension Host (Node.js)

**Responsibility**: Core business logic, LLM communication, file I/O

**Boundary**: Cannot directly manipulate UI, limited to VSCode API

**Communication**: postMessage to webview, VSCode API for editor

### Webview (Browser Context)

**Responsibility**: UI rendering, user interactions, local state

**Boundary**: No file system access, no network calls (except in bundle)

**Communication**: postMessage to extension host

### External Services

**Responsibility**: AI inference, embeddings generation

**Boundary**: Extension has no control over these services

**Communication**: HTTP/HTTPS, WebSocket for P2P

## Deployment Architecture

### Single-Artifact Deployment

```
twinny.vsix
├── Extension Host Bundle (out/index.js)
├── Webview Bundles
│   ├── sidebar.js
│   ├── sidebar.css
│   └── panel.js
├── Assets
│   ├── icons
│   ├── codicon font
│   └── ML models (reranker.onnx)
└── package.json (manifest)
```

### Runtime Architecture

```
VS Code Process
├── Extension Host (Node.js)
│   └── Twinny Extension
│       ├── Providers
│       ├── Services
│       └── LanceDB (separate process)
└── Webview Host (Chromium)
    └── React App
```

## Concurrency Model

### Extension Host

- **Main Thread**: VSCode API interactions, UI updates
- **Worker Threads**: ONNX model inference (reranker)
- **Child Processes**: LanceDB operations

### Async Patterns

```typescript
// Debouncing for completion
private _debouncer: NodeJS.Timeout

// Locking for critical sections
private _lock: AsyncLock

// Queue for rate limiting
private _queue: PQueue

// Abort for cancellation
private _abortController: AbortController
```

## Data Persistence

### Extension Storage

| Data Type | Storage | Persistence | Scope |
|-----------|---------|-------------|-------|
| Provider configs | Global State | Permanent | User |
| Chat history | Workspace State | Per workspace | Workspace |
| Embeddings | LanceDB files | Permanent | Workspace |
| Templates | File system | User files | User |
| Session state | Memory | Session only | Extension |

### Storage Locations

```
~/.twinny/
├── templates/          # User templates
│   ├── system.hbs
│   ├── explain.hbs
│   └── ...
└── embeddings/         # Vector database
    └── {workspace-name}/
        ├── documents.lance
        └── file-paths.lance

~/.vscode/
└── globalStorage/
    └── twinny/
        └── providers.json  # Optional file storage
```

## Error Handling Strategy

### Levels

1. **Silent Recovery**: Cache misses, optional features
2. **User Warning**: Configuration issues, network errors
3. **User Error**: Invalid input, missing API keys
4. **Fatal**: Extension activation failures

### Error Boundaries

```
LLM Request Error
├─→ Retry with backoff
├─→ Fallback to different provider
├─→ Display error in UI
└─→ Log for debugging
```

## Performance Characteristics

### Completion Latency

```
User Keystroke
├─→ 300ms debounce
├─→ ~50ms prompt building
├─→ 100-2000ms LLM inference (provider-dependent)
└─→ ~10ms formatting
Total: 460-2360ms
```

### Memory Profile

- **Base Extension**: ~50-100 MB
- **Webview**: ~100-150 MB
- **LanceDB**: Varies by workspace size
- **Peak (during embedding)**: ~500 MB - 2 GB

### Optimization Strategies

1. **Lazy Loading**: Providers loaded on first use
2. **Incremental Parsing**: tree-sitter reuses trees
3. **Streaming**: Reduces perceived latency
4. **Caching**: Optional completion cache
5. **Debouncing**: Reduces API calls

## Security Model

### Threat Model

**In Scope**:
- API key leakage
- Malicious provider responses
- XSS in webview
- File system access control

**Out of Scope**:
- MITM on user networks
- Compromised AI providers
- VSCode core vulnerabilities

### Security Controls

1. **API Key Protection**: VSCode secret storage
2. **CSP**: Strict Content Security Policy for webview
3. **Input Validation**: Sanitize all user inputs
4. **Output Encoding**: Escape LLM outputs before rendering
5. **File Access**: Respect workspace boundaries
6. **P2P Encryption**: hypercore-crypto for symmetry

## Scalability Considerations

### Workspace Size

- **Small** (<1000 files): Full embedding support
- **Medium** (1000-10,000 files): Selective embedding
- **Large** (>10,000 files): Use .gitignore and ignore globs

### Concurrent Operations

- **Completion**: 1 at a time (abort previous)
- **Chat**: 1 at a time (abort previous)
- **Embedding**: Queue with concurrency limit

### Resource Limits

```typescript
MAX_CONTEXT_LINE_COUNT = 200    // Per file context
DEFAULT_RELEVANT_FILE_COUNT = 5 // For RAG
DEFAULT_RELEVANT_CODE_COUNT = 20 // Code chunks
MAX_EMBEDDING_BATCH = 100       // Concurrent embeddings
```

## Monitoring & Observability

### Logging

```typescript
// Extension logs
logger.log("Info message")
logger.error("Error message")

// VS Code Output Channel
Output → Twinny
```

### Telemetry

**Current State**: No telemetry collected

**Potential Metrics** (for future):
- Completion acceptance rate
- Average response time
- Error rates by provider
- Feature usage

## Quality Attributes

### Maintainability

- **Modular Design**: Clear separation of concerns
- **TypeScript**: Strong typing reduces bugs
- **Consistent Patterns**: BaseProvider, Base classes
- **Documentation**: Inline comments and docs

### Testability

- **Unit Tests**: Completion formatting logic
- **Mocking**: Provider interfaces mockable
- **Integration**: VSCode test harness

### Reliability

- **Error Recovery**: Graceful degradation
- **Abort Mechanisms**: User can cancel operations
- **State Management**: Clean state transitions

### Usability

- **Progressive Disclosure**: Advanced features optional
- **Sensible Defaults**: Works out of box with Ollama
- **Customization**: Templates and settings

## Next: Detailed Component Documentation

Continue to:
- [Completion System](./02-completion-system.md)
- [Chat System](./03-chat-system.md)
- [Embeddings & RAG](./04-embeddings-rag.md)
- [Webview Architecture](./05-webview-architecture.md)
