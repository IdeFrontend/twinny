import React, { memo } from "react"

import { ChatCompletionMessage, MentionType } from "../types"

import { Message } from "./Message"
import { TypingIndicator } from "./TypingIndicator"

export interface MessageItemProps {
  message: ChatCompletionMessage
  messages: ChatCompletionMessage[]
  completion?: ChatCompletionMessage | null
  isLoading: boolean
  index: number
  handleDeleteMessage: (index: number) => void
  handleEditMessage?: (
    message: string,
    index: number,
    mentions: MentionType[] | undefined
  ) => void
  handleRegenerateMessage: (
    index: number,
    mentions: MentionType[] | undefined
  ) => void
}

export const MessageItem = memo(
  ({
    message,
    messages,
    completion,
    isLoading,
    index,
    handleDeleteMessage,
    handleRegenerateMessage,
  }: MessageItemProps) => {
    const isUserMessage = message?.role === "user"
    const isAgentMessage = message?.role === "assistant"
    const isLastMessage = index === messages?.length - 1
    const messageKey = `${message?.role}-${index}`

    return (
      <>
        {isUserMessage && (
          <Message
            key={messageKey}
            message={message}
            index={index}
            isLoading={isLoading}
            messages={messages}
            onDelete={handleDeleteMessage}
            onRegenerate={handleRegenerateMessage}
          />
        )}
        {isAgentMessage && (
          <Message
            key={messageKey}
            message={message}
            index={index}
            isLoading={isLoading}
            messages={messages}
            onDelete={handleDeleteMessage}
            onRegenerate={handleRegenerateMessage}
            isAssistant
          />
        )}
        {completion && isLastMessage && (
          <Message
            key={`completion-${messageKey}`}
            isAssistant={true}
            message={completion}
            index={index}
            isLoading={isLoading}
            messages={messages}
            onDelete={handleDeleteMessage}
            onRegenerate={handleRegenerateMessage}
          />
        )}
        {isLoading && !completion && isLastMessage && (
          <div className={"message assistantMessage"}>
            <TypingIndicator />
          </div>
        )}
      </>
    )
  }
)

