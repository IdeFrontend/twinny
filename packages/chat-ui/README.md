# analyzr-chat-ui

Reusable React chat UI components (Chat, Message, MessageItem, TypingIndicator) extracted from the Analyzr/Twinny VS Code extension webview. Framework: React 18.

## Install

```bash
npm i analyzr-chat-ui
```

Peer dependencies: react, react-dom, @tiptap/react, @tiptap/starter-kit, @tiptap/extension-mention, @tiptap/extension-placeholder, react-markdown, remark-gfm.

## Usage

```tsx
import { Chat, type ChatCompletionMessage, type MentionType } from "analyzr-chat-ui"

export default function App() {
  const [messages, setMessages] = useState<ChatCompletionMessage[]>([])

  return (
    <Chat
      messages={messages}
      onSend={({ messages: next, mentions, conversationId }) => {
        // Call your backend/LLM. Update messages on response.
        setMessages(next)
      }}
      onStop={() => {/* stop streaming */}}
      onRegenerate={(index, mentions?: MentionType[]) => {/* re-send */}}
      onDelete={(index) => {/* delete user + assistant pair */}}
      onOpenFile={(path) => {/* open file in your app */}}
      onContextRemove={(id) => {/* remove context chip */}}
    />
  )
}
```

### Chat props
- messages?: ChatCompletionMessage[]
- onSend?: ({ messages, mentions, conversationId }) => void
- onStop?: () => void
- onRegenerate?: (index, mentions?) => void
- onDelete?: (index) => void
- onOpenFile?: (path) => void
- onContextRemove?: (id) => void
- contextItems?: { id, name, path, category? }[]
- isStreaming?: boolean
- completion?: ChatCompletionMessage | null
- fullScreen?: boolean
- conversationId?: string
