# Twinny - AI Code Completion and Chat Extension

## Product Description

Twinny is a free, open-source AI extension for Visual Studio Code that provides powerful AI-assisted coding features. It offers both real-time code completion and interactive chat capabilities, designed to enhance developer productivity while maintaining privacy and flexibility.

### Key Value Propositions

- **Privacy-First**: Supports local and self-hosted AI models, ensuring code never leaves your environment
- **Provider Agnostic**: Compatible with multiple AI providers including OpenAI, Anthropic, Ollama, and local models
- **Offline Capable**: Works with locally hosted models for complete offline development
- **Context-Aware**: Utilizes workspace embeddings and file interactions for intelligent suggestions
- **Decentralized Options**: Supports Symmetry P2P network for distributed AI inference

## Architecture

### High-Level Architecture

Twinny follows a modular architecture with clear separation between the VS Code extension host and the webview UI:

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   VS Code UI    │    │  Extension Host  │    │  AI Providers   │
│                 │    │                  │    │                 │
│  ┌───────────┐  │    │ ┌──────────────┐ │    │ ┌─────────────┐ │
│  │ Webview   │◄─┼────┼►│ Provider     │◄┼────┼►│ OpenAI/     │ │
│  │ Chat UI   │  │    │ │ Manager      │ │    │ │ Anthropic/  │ │
│  └───────────┘  │    │ └──────────────┘ │    │ │ Ollama/etc  │ │
│                 │    │                  │    │ └─────────────┘ │
│  ┌───────────┐  │    │ ┌──────────────┐ │    │                 │
│  │ Inline    │  │    │ │ Completion   │ │    │ ┌─────────────┐ │
│  │Completion │◄─┼────┼►│ Provider     │◄┼────┼►│ Local       │ │
│  │ Popup     │  │    │ └──────────────┘ │    │ │ Models      │ │
│  └───────────┘  │    │                  │    │ └─────────────┘ │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### Core Components

#### 1. Extension Host (`src/extension/`)
- **Provider Manager**: Manages AI provider configurations and routing
- **Completion Provider**: Handles Fill-in-Middle (FIM) code completions
- **Sidebar Provider**: Manages the chat interface and webview communication
- **Session Manager**: Tracks user interactions and conversation state
- **Embedding Database**: Stores and retrieves contextual embeddings using LanceDB
- **Template Provider**: Manages customizable prompt templates

#### 2. Webview UI (`src/webview/`)
- **React-based Interface**: Modern, responsive chat and settings UI
- **Multi-tab Interface**: Chat, Settings, Providers, Review, History, Embeddings, Symmetry
- **Real-time Communication**: WebView messaging for extension-UI interaction

#### 3. Common Layer (`src/common/`)
- **Type Definitions**: Shared TypeScript interfaces and types
- **Constants**: Configuration keys, API endpoints, templates
- **Utilities**: Language detection, logging, event handling

### Data Flow

1. **Code Completion Flow**:
   ```
   User Types → Completion Provider → Context Analysis → AI Provider → Response Formatting → VS Code UI
   ```

2. **Chat Flow**:
   ```
   User Message → Sidebar Provider → Template Processing → AI Provider → Streaming Response → Webview UI
   ```

3. **Context Enhancement Flow**:
   ```
   File Changes → Embedding Generation → Vector Storage → Context Retrieval → Enhanced Prompts
   ```

## Tech Stack

### Frontend (Webview)
- **React 18.2.0**: Core UI framework
- **TypeScript 4.7.4**: Type safety and development experience
- **Tiptap 2.5.9**: Rich text editor for chat interface with Markdown support
- **React Markdown 9.0.1**: Markdown rendering for AI responses
- **React Syntax Highlighter**: Code syntax highlighting
- **i18next 23.16.5**: Internationalization (13+ languages supported)
- **Lucide React**: Modern icon library
- **CSS Modules**: Scoped styling

### Backend (Extension Host)
- **Node.js**: Runtime environment
- **VS Code Extension API 1.84.0+**: Core VS Code integration
- **fluency.js**: Unified AI provider interface
- **Web Tree-sitter 0.22.1**: AST parsing for code analysis
- **@lancedb/lancedb 0.19.1**: Vector database for embeddings
- **onnxruntime-web 1.18.0**: ML inference for text reranking
- **hyperswarm 4.7.15**: P2P networking for Symmetry network

### AI Integration
- **Provider Support**:
  - OpenAI GPT models
  - Anthropic Claude
  - Local models via Ollama
  - OpenRouter
  - Deepseek, Cohere, Mistral AI, Perplexity, Groq
  - Custom OpenAI-compatible APIs

### Build & Development
- **esbuild 0.21.5**: Fast bundling and compilation
- **ESLint + TypeScript ESLint**: Code quality and consistency
- **Mocha + Jest**: Testing frameworks
- **VS Code Extension API**: Development and packaging tools

### Storage & Persistence
- **VS Code GlobalState**: Extension settings and provider configurations
- **File-based Storage**: Alternative provider storage option
- **LanceDB**: Vector embeddings storage
- **Local File System**: Template and cache storage

## Features

### 1. Fill-in-Middle Code Completion
- **Real-time Suggestions**: AI-powered code completions as you type
- **Context-Aware**: Uses surrounding code and project context
- **Multi-line Support**: Generates complete functions, classes, and code blocks
- **Language Agnostic**: Supports all major programming languages
- **Caching**: Intelligent caching for improved performance
- **Configurable Triggers**: Manual (Alt+\) and automatic completion modes

### 2. Interactive AI Chat
- **Sidebar Integration**: Persistent chat interface in VS Code sidebar
- **Full-screen Mode**: Expandable chat for complex discussions
- **Code-Aware Conversations**: Chat with context about your current code
- **Streaming Responses**: Real-time AI response streaming
- **Conversation History**: Persistent chat sessions with search capabilities
- **Template System**: Customizable prompt templates for common tasks

### 3. Context Management
- **Workspace Embeddings**: Automatic indexing of project files for semantic search
- **File Interaction Tracking**: Learns from your coding patterns
- **Selection Context**: Add specific code selections to chat context
- **File Context**: Include entire files in conversation context
- **Smart Context Retrieval**: Uses vector similarity for relevant context

### 4. Code Enhancement Tools
- **Code Explanation**: AI explanations of selected code
- **Refactoring Suggestions**: Intelligent code improvement recommendations
- **Type Addition**: Automatic TypeScript type inference and addition
- **Test Generation**: AI-generated unit tests for your code
- **Documentation Generation**: Automatic code documentation
- **Git Commit Messages**: AI-generated commit messages based on changes

### 5. Code Review & Analysis
- **GitHub PR Integration**: Review pull requests with AI assistance
- **Code Quality Analysis**: Identify potential issues and improvements
- **Security Analysis**: Basic security vulnerability detection
- **Performance Suggestions**: Optimization recommendations

### 6. Provider Management
- **Multi-Provider Support**: Seamless switching between AI providers
- **Custom Endpoints**: Support for self-hosted and custom APIs
- **Provider Testing**: Built-in connectivity testing
- **Import/Export**: Provider configuration backup and sharing
- **Per-Feature Providers**: Different providers for chat, completion, and embeddings

### 7. Symmetry Network Integration
- **P2P AI Inference**: Distributed AI model sharing
- **Resource Sharing**: Share computational resources with other developers
- **Decentralized Architecture**: No single point of failure
- **Network Discovery**: Automatic peer discovery and connection

### 8. Privacy & Security Features
- **Local-First**: Support for completely local AI models
- **No Data Leakage**: Optional offline operation
- **Configurable Endpoints**: Control where data is sent
- **API Key Management**: Secure credential storage
- **Workspace Isolation**: Project-specific configurations

### 9. Developer Experience
- **Multi-language Support**: 13+ languages including EN, ZH-CN, DE, ES, FR, JA, KO
- **Customizable Settings**: Extensive configuration options
- **Keyboard Shortcuts**: Efficient navigation and control
- **Status Bar Integration**: Real-time extension status
- **Error Handling**: Graceful error recovery and user feedback

### 10. Advanced Features
- **Template Customization**: Create and share prompt templates
- **Embedding Customization**: Configurable text chunking and vector generation
- **File Pattern Filtering**: Control which files are indexed
- **Performance Tuning**: Adjustable context length, temperature, and token limits
- **Diff Visualization**: Side-by-side code comparison views

## Installation & Deployment

### Installation Methods
1. **VS Code Marketplace**: One-click installation from the official marketplace
2. **VSIX Package**: Manual installation from GitHub releases
3. **Development**: Build from source for customization

### System Requirements
- **VS Code**: Version 1.84.0 or higher
- **Operating System**: Windows, macOS, Linux (x64, arm64)
- **Node.js**: Version 16+ (for development)
- **Memory**: 512MB+ recommended for optimal performance

### Configuration
- **Provider Setup**: Configure AI providers through the settings UI
- **Model Selection**: Choose appropriate models for different tasks
- **Context Tuning**: Adjust context length and embedding settings
- **Privacy Settings**: Configure data retention and sharing preferences

## Use Cases

### Individual Developers
- **Code Completion**: Faster coding with intelligent suggestions
- **Code Understanding**: Learn unfamiliar codebases through AI explanations
- **Documentation**: Automatically generate comments and documentation
- **Debugging**: Get AI assistance with error analysis and fixes

### Development Teams
- **Code Review**: Consistent review process with AI assistance
- **Knowledge Sharing**: Distribute coding knowledge through AI insights
- **Standards Enforcement**: Maintain code quality and consistency
- **Onboarding**: Help new team members understand existing code

### Organizations
- **Privacy Compliance**: Keep sensitive code on-premises with local models
- **Cost Optimization**: Use local resources instead of cloud APIs
- **Custom Integration**: Integrate with internal AI infrastructure
- **Audit Trail**: Track AI usage and maintain development records

## Future Roadmap

### Planned Features
- **Multi-file Editing**: Coordinate changes across multiple files
- **Advanced Refactoring**: Complex code transformations
- **Integration Testing**: AI-generated integration tests
- **Performance Profiling**: AI-assisted performance optimization
- **Security Scanning**: Enhanced security vulnerability detection

### Community & Ecosystem
- **Plugin System**: Third-party extensions and integrations
- **Template Marketplace**: Community-shared prompt templates
- **Model Fine-tuning**: Custom model training for specific domains
- **Enterprise Features**: Advanced authentication and management tools

This comprehensive overview showcases Twinny as a sophisticated, privacy-focused AI coding assistant that balances powerful features with user control and flexibility.