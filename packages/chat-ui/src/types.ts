export interface ImageAttachment {
  data: string
  type: string
  id?: string
}

export type Role = "system" | "user" | "assistant" | "function"

export type ChatCompletionMessage = {
  role: Role
  content?: string | unknown
  name?: string
  id?: string
  images?: ImageAttachment[] | string[]
}

export interface MentionType {
  name: string
  path: string
}

export interface ContextItem {
  id: string
  name: string
  path: string
  category?: string
}

