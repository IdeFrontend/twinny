# Twinny Architecture Documentation

## Documentation Structure

This directory contains detailed architectural documentation for the Twinny VSCode extension.

### Documents

1. **[Overview](./01-overview.md)** - System architecture overview, core principles, and key architectural decisions
2. **[Completion System](./02-completion-system.md)** - Fill-in-the-Middle code completion architecture
3. **[Chat System](./03-chat-system.md)** - AI chat and conversation management
4. **[Main Architecture](../ARCHITECTURE.md)** - Comprehensive architecture reference (in project root)

### Quick Navigation

#### For New Contributors

Start here:
1. Read [Overview](./01-overview.md) for system context
2. Review [Main Architecture](../ARCHITECTURE.md) for component details
3. Deep dive into [Completion System](./02-completion-system.md) or [Chat System](./03-chat-system.md) based on your interest

#### For Maintainers

Reference materials:
- Architecture decisions: [Overview](./01-overview.md#key-architectural-decisions)
- Component interactions: [Main Architecture](../ARCHITECTURE.md#core-components)
- Data flows: [Completion System](./02-completion-system.md#sequence-diagram) and [Chat System](./03-chat-system.md#sequence-diagram-chat-flow)

## Architecture at a Glance

### System Overview

Twinny is a VSCode extension providing:
- **Inline Code Completion** (FIM - Fill-in-the-Middle)
- **AI Chat Interface** with code context awareness
- **RAG** (Retrieval-Augmented Generation) using embeddings
- **Multi-Provider Support** (Ollama, OpenAI, Anthropic, etc.)
- **P2P Inference** via Symmetry network

### High-Level Architecture

```
┌─────────────────────────────────────────────────┐
│           VS Code Extension Host                │
│  ┌───────────────────────────────────────────┐  │
│  │  Providers (Completion, Sidebar, Panel)   │  │
│  ├───────────────────────────────────────────┤  │
│  │  Services (Chat, LLM, Embeddings, etc.)   │  │
│  └───────────────────────────────────────────┘  │
└──────────────────┬──────────────────────────────┘
                   │ postMessage API
┌──────────────────▼──────────────────────────────┐
│           Webview (React App)                   │
│  Chat | Settings | Providers | Templates | ...  │
└──────────────────┬──────────────────────────────┘
                   │ HTTP/WebSocket
┌──────────────────▼──────────────────────────────┐
│        External AI Providers & Services         │
│  Ollama | OpenAI | Anthropic | Symmetry | ...   │
└─────────────────────────────────────────────────┘
```

### Key Technologies

| Layer | Technologies |
|-------|-------------|
| **Backend** | TypeScript, Node.js, VSCode API, LanceDB, web-tree-sitter |
| **Frontend** | React, TypeScript, TipTap, CSS Modules |
| **AI** | TokenJS, ONNX Runtime, Handlebars templates |
| **Build** | esbuild, TypeScript, ESLint |

### Core Components

1. **Extension Entry Point** (`src/index.ts`)
   - Lifecycle management
   - Service initialization
   - Command registration

2. **Providers**
   - `CompletionProvider`: Inline code suggestions
   - `SidebarProvider`: Sidebar webview
   - `PanelProvider`: Full-screen chat

3. **Services**
   - `Chat`: Conversation management & RAG
   - `LLM`: HTTP communication with AI
   - `EmbeddingDatabase`: Vector storage (LanceDB)
   - `SymmetryService`: P2P networking
   - `TemplateProvider`: Handlebars templates

4. **Webview** (`src/webview/`)
   - React-based UI
   - Multiple views (chat, settings, providers, etc.)
   - Custom hooks for state management

## Design Patterns

- **Provider Pattern**: Common base for UI providers
- **Dependency Injection**: Services receive dependencies via constructor
- **Event-Driven**: postMessage for extension ↔ webview, EventEmitter for P2P
- **Template Method**: Base class with common functionality
- **Strategy**: Multiple FIM template formats

## Data Flow Examples

### Completion Flow

```
User Types → Debounce → Parse Document → Build FIM Prompt → 
Stream LLM → Detect Stop → Format → Display
```

### Chat Flow

```
User Message → Get RAG Context → Build Conversation → 
Stream LLM → Render Markdown → Display
```

### Embedding Flow

```
Trigger Scan → Read Files → Chunk Documents → 
Generate Embeddings → Store in LanceDB
```

## Performance Targets

- **Completion Latency**: <500ms (local), <2s (remote)
- **Chat Latency**: <1s first token (with RAG)
- **Memory Usage**: <200MB base, <1GB with embeddings
- **Workspace Size**: Supports up to 10,000 files

## Security

- API keys stored in VSCode encrypted storage
- Webview CSP restricts script execution
- Input sanitization before LLM calls
- File access respects workspace boundaries
- P2P encryption via hypercore-crypto

## Testing

- **Unit Tests**: `src/test/suite/`
- **Test Runner**: Mocha + @vscode/test-electron
- **Integration**: Manual testing workflow

## Contributing

When adding features or modifying architecture:

1. Update relevant architecture docs
2. Follow established patterns
3. Add inline documentation
4. Update this README if adding new docs

## References

- [VSCode Extension API](https://code.visualstudio.com/api)
- [LanceDB](https://lancedb.github.io/lancedb/)
- [web-tree-sitter](https://github.com/tree-sitter/tree-sitter)
- [Twinny Repository](https://github.com/twinnydotdev/twinny)
