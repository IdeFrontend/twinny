import React, { useCallback, useEffect, useMemo, useRef } from "react"
import Markdown, { Components } from "react-markdown"
import DOMPurify from "dompurify"
import remarkGfm from "remark-gfm"

import { ChatCompletionMessage, ImageAttachment, MentionType } from "../types"

import styles from "../styles/message.module.css"

export interface MessageProps {
  index?: number
  isAssistant?: boolean
  isLoading?: boolean
  message?: ChatCompletionMessage
  messages?: ChatCompletionMessage[]
  onDelete?: (index: number) => void
  onRegenerate?: (index: number, mentions: MentionType[] | undefined) => void
  onEdit?: (
    message: string,
    index: number,
    mentions: MentionType[] | undefined,
    images?: ImageAttachment[]
  ) => void
  onHeightChange?: () => void
  onDeleteImage?: (id: string) => void
  assistantLabel?: string
  userLabel?: string
}

function parseThinking(content: string | unknown) {
  if (typeof content !== "string") return { thinking: "", message: String(content ?? "") }
  const match = content.match(/<thinking>([\s\S]*?)<\/thinking>([\s\S]*)/)
  if (!match) return { thinking: "", message: content }
  return { thinking: match[1] || "", message: match[2] || "" }
}

const ThinkingSection = ({
  thinking,
  isCollapsed,
  onToggle,
  markdownComponents
}: {
  thinking: string
  isCollapsed: boolean
  onToggle: () => void
  markdownComponents: Components
}) => {
  return (
    <div className={styles.thinkingSection}>
      <div className={styles.thinkingHeader} onClick={onToggle}>
        <span>thinking</span>
        <span className={`codicon ${isCollapsed ? "codicon-chevron-right" : "codicon-chevron-down"}`} />
      </div>
      <div className={`${styles.thinkingContent} ${isCollapsed ? styles.collapsed : ""}`}>
        <Markdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
          {thinking}
        </Markdown>
      </div>
    </div>
  )
}

export const Message: React.FC<MessageProps> = ({
  index = 0,
  isAssistant,
  isLoading,
  message,
  onDelete,
  onRegenerate,
  messages,
  assistantLabel = "assistant",
  userLabel = "you",
}) => {
  const [isThinkingCollapsed, setIsThinkingCollapsed] = React.useState(false)
  const messageRef = useRef<HTMLDivElement>(null)
  const prevHeightRef = useRef<number>(0)

  const handleThinkingToggle = useCallback(() => {
    setIsThinkingCollapsed((prev) => !prev)
  }, [])

  useEffect(() => {
    const currentHeight = messageRef.current?.offsetHeight
    if (currentHeight && currentHeight !== prevHeightRef.current) {
      prevHeightRef.current = currentHeight
    }
  }, [message?.content])

  const handleDelete = useCallback(() => onDelete?.(index), [onDelete, index])

  const extractMentionsFromHtml = (content: string): MentionType[] => {
    const parser = new DOMParser()
    const doc = parser.parseFromString(content, "text/html")
    const mentions: MentionType[] = []
    doc.querySelectorAll(".mention").forEach((mention) => {
      const path = mention.getAttribute("data-id")
      const label = mention.getAttribute("data-label")
      if (path && label) mentions.push({ name: label, path })
    })
    return mentions
  }

  const handleRegenerate = useCallback(() => {
    if (!messages?.length) return
    const lastMessage = messages[index - 1]
    const mentions = extractMentionsFromHtml((lastMessage?.content as string) || "")
    onRegenerate?.(index, mentions)
  }, [onRegenerate, index, messages])

  const renderContent = useCallback((htmlContent: string) => {
    const sanitizedHtml = DOMPurify.sanitize(htmlContent, {
      ALLOWED_TAGS: ["span", "p", "br", "code", "pre", "img"],
      ALLOWED_ATTR: ["class", "data-id", "data-label", "data-type", "src", "id"],
      ALLOW_DATA_ATTR: true,
      ALLOW_UNKNOWN_PROTOCOLS: true
    })
    return (
      <div
        className={styles.messageContent}
        dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
      />
    )
  }, [])

  const renderImageGallery = useCallback(() => {
    const images = (message?.images || []) as ImageAttachment[]
    if (!images.length) return null
    const maxImages = 10
    const limitedImages = images.slice(0, maxImages)
    return (
      <div className={styles.imageGallery}>
        {limitedImages.map((img, i) => (
          <div key={i} className={styles.imageContainer}>
            <img src={(img as ImageAttachment).data} className={styles.chatImageSquare} alt="" loading="lazy" />
          </div>
        ))}
        {images.length > maxImages && (
          <div style={{ color: "#888", marginTop: 8 }}>{`+${images.length - maxImages} more image(s)`}</div>
        )}
      </div>
    )
  }, [message?.images])

  const renderCodeBlock = useCallback(
    ({ children, ...props }: { children: React.ReactNode } & React.HTMLProps<HTMLPreElement>) => {
      return <pre {...props}>{children}</pre>
    },
    []
  )

  const markdownComponents = useMemo(
    () =>
      ({
        pre: renderCodeBlock,
        p: ({ children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => {
          if (typeof children === "string" && (children.includes("class=\"mention\"") || children.includes("<img"))) {
            return renderContent(children)
          }
          return <p {...props}>{children}</p>
        }
      } as Components),
    [renderCodeBlock, renderContent, message?.images]
  )

  if (!message?.content) return null
  const { thinking, message: messageContent } = parseThinking(message.content)
  const conversationLength = messages?.length || 0

  return (
    <div
      ref={messageRef}
      className={`${styles.message} ${message.role === "assistant" ? styles.assistantMessage : styles.userMessage}`}
    >
      {thinking && (
        <ThinkingSection
          thinking={thinking}
          isCollapsed={isThinkingCollapsed}
          onToggle={handleThinkingToggle}
          markdownComponents={markdownComponents}
        />
      )}
      <div className={styles.messageRole}>
        <span>{message.role === "assistant" ? assistantLabel : userLabel}</span>
        <div className={styles.messageOptions}>
          {!isAssistant && (
            <>
              <button disabled={isLoading} title="delete" onClick={handleDelete}>🗑️</button>
            </>
          )}
          {isAssistant && (
            <button disabled={isLoading} title="regenerate" onClick={handleRegenerate}>🔁</button>
          )}
        </div>
      </div>
      {message.role === "assistant" ? (
        <>
          <Markdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
            {(String(messageContent)).trimStart()}
          </Markdown>
          {renderImageGallery()}
        </>
      ) : (
        <>
          {renderContent(String(messageContent).trimStart())}
          {renderImageGallery()}
        </>
      )}
    </div>
  )
}

export default Message

