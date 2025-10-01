import React, { useCallback, useMemo, useRef, useState } from "react"
import { Virtuoso, VirtuosoHandle } from "react-virtuoso"
import * as cheerio from "cheerio"

import { ChatCompletionMessage, ContextItem, ImageAttachment, MentionType } from "../types"

import { MessageItem } from "./MessageItem"

import styles from "../styles/chat.module.css"

export interface ChatProps {
  messages?: ChatCompletionMessage[]
  onSend?: (payload: {
    messages: ChatCompletionMessage[]
    mentions?: MentionType[]
    conversationId?: string
  }) => void
  onStop?: () => void
  onRegenerate?: (index: number, mentions?: MentionType[]) => void
  onDelete?: (index: number) => void
  onOpenFile?: (path: string) => void
  onContextRemove?: (id: string) => void
  contextItems?: ContextItem[]
  isStreaming?: boolean
  completion?: ChatCompletionMessage | null
  fullScreen?: boolean
  conversationId?: string
}

export const Chat: React.FC<ChatProps> = ({
  messages: initialMessages = [],
  onSend,
  onStop,
  onRegenerate,
  onDelete,
  onOpenFile,
  onContextRemove,
  contextItems = [],
  isStreaming,
  completion,
  fullScreen,
  conversationId,
}) => {
  const [messages, setMessages] = useState<ChatCompletionMessage[]>(initialMessages)
  const virtuosoRef = useRef<VirtuosoHandle>(null)
  const [isBottom, setIsBottom] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const generatingRef = useRef(false)
  const imagesRef = useRef<ImageAttachment[]>([])
  const editorRef = useRef<HTMLDivElement>(null)

  const getMentionsFromHtml = useCallback((html: string) => {
    const mentions: MentionType[] = []
    const $ = cheerio.load(html)
    $(".mention").each((_, el) => {
      const label = $(el).attr("data-label")
      const id = $(el).attr("data-id")
      if (label && id) mentions.push({ name: label, path: id })
    })
    return mentions
  }, [])

  const handleOpenFile = useCallback((filePath: string) => {
    onOpenFile?.(filePath)
  }, [onOpenFile])

  const handleDeleteMessage = useCallback((index: number) => {
    onDelete?.(index)
    setMessages(prev => {
      if (!prev || prev.length === 0) return prev
      if (prev.length === 2) return prev

      const updated = [
        ...prev.slice(0, index),
        ...prev.slice(index + 2)
      ]
      return updated
    })
  }, [onDelete])

  const handleRegenerateMessage = useCallback((index: number, mentions?: MentionType[]) => {
    setIsLoading(true)
    onRegenerate?.(index, mentions)
  }, [onRegenerate])

  const handleSubmit = useCallback((html: string) => {
    const text = cheerio.load(html).root().text().trim()
    if (!text || generatingRef.current) return
    generatingRef.current = true
    setIsLoading(true)

    const mentions = getMentionsFromHtml(html)
    const updatedMessages: ChatCompletionMessage[] = [
      ...messages,
      { role: "user", content: html, images: imagesRef.current.length ? imagesRef.current : undefined }
    ]

    setMessages(updatedMessages)
    onSend?.({ messages: updatedMessages, mentions, conversationId })
    imagesRef.current = []
  }, [messages, conversationId, onSend, getMentionsFromHtml])

  const scrollToBottom = useCallback(() => {
    virtuosoRef.current?.scrollTo({ top: Infinity, behavior: "auto" })
  }, [])

  const itemContent = useCallback(
    (index: number) => (
      <MessageItem
        key={`message-list-${index}`}
        completion={completion}
        handleDeleteMessage={handleDeleteMessage}
        handleRegenerateMessage={handleRegenerateMessage}
        index={index}
        isLoading={isLoading}
        message={messages[index]}
        messages={messages}
      />
    ),
    [handleDeleteMessage, handleRegenerateMessage, isLoading, messages, completion]
  )

  const renderContextItem = useCallback((item: ContextItem) => {
    let codicon = ""
    const displayName = item.name
    return (
      <div
        key={item.id}
        title={item.path}
        className={styles.contextItem}
        onClick={() => handleOpenFile(item.path)}
      >
        <span className={`${codicon} ${styles.contextItemIcon}`}></span>
        <span className={styles.contextItemName}>{displayName}</span>
        <span
          onClick={(e) => {
            e.stopPropagation()
            onContextRemove?.(item.id)
          }}
          data-id={item.id}
          className={styles.contextItemClose}
        />
      </div>
    )
  }, [handleOpenFile, onContextRemove])

  const [inputHtml, setInputHtml] = useState("")

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLDivElement>) => {
    const items = Array.from(e.clipboardData?.items || [])
    const imageItem = items.find(item => item.type.startsWith("image/"))
    if (imageItem) {
      e.preventDefault()
      const file = imageItem.getAsFile()
      if (!file) return
      const reader = new FileReader()
      reader.onload = (ev) => {
        const base64 = ev.target?.result as string
        const imageData = base64.startsWith("data:") ? base64 : `data:${file.type};base64,${base64.split(",").pop()}`
        const id = crypto.randomUUID()
        const newImage = { id, data: imageData, type: file.type }
        imagesRef.current = [...imagesRef.current, newImage]
        setInputHtml(prev => prev + `<p><img id="${id}" src="${imageData}" /></p>`)
      }
      reader.readAsDataURL(file)
      return
    }
  }, [])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if ((e.key === "Enter" && (e.metaKey || e.ctrlKey)) || (e.key === "Enter" && e.shiftKey)) {
      e.preventDefault()
      handleSubmit(inputHtml)
    }
  }, [handleSubmit, inputHtml])

  const handleSendClick = useCallback(() => handleSubmit(inputHtml), [handleSubmit, inputHtml])

  return (
    <div className={styles.container}>
      {!!fullScreen && (
        <div className={styles.fullScreenActions}>
          <button title="new-conversation">💬</button>
        </div>
      )}
      {!!contextItems.length && (
        <div className={styles.contextItems}>{contextItems.map(renderContextItem)}</div>
      )}
      <Virtuoso
        followOutput
        ref={virtuosoRef}
        data={messages}
        initialTopMostItemIndex={messages?.length}
        defaultItemHeight={800}
        itemContent={itemContent}
        atBottomThreshold={20}
        atBottomStateChange={(bottom) => setIsBottom(bottom)}
        alignToBottom
      />
      <div className={styles.chatOptions}>
        <div>
          {!isBottom && (
            <div className={styles.scrollToBottom}>
              <button onClick={scrollToBottom} title="scroll-to-bottom">⬇️</button>
            </div>
          )}
          {isStreaming && (
            <button type="button" onClick={onStop} aria-label="stop-generation">⏹️</button>
          )}
        </div>
      </div>
      <div className={styles.chatBox}>
        <div
          ref={editorRef}
          className={styles.tiptap}
          contentEditable
          onInput={(e) => setInputHtml((e.target as HTMLDivElement).innerHTML)}
          onPaste={handlePaste}
          onKeyDown={handleKeyDown}
          suppressContentEditableWarning
        />
        <div className={styles.chatButtons}>
          <button role="button" onClick={handleSendClick} title="send">📨</button>
        </div>
      </div>
    </div>
  )
}

