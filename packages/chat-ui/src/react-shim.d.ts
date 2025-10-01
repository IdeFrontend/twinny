declare module "*.module.css" {
  const classes: { [key: string]: string }
  export default classes
}

declare module "react" {
  export type ReactNode = any
  export interface FC<P = {}> {
    (props: P & { children?: ReactNode }): any
  }
  export type Ref<T = any> = any
  export function useState<T = any>(initial?: any): [T, (v: T) => void]
  export function useRef<T = any>(initial?: any): { current: T }
  export function useEffect(cb: () => void | (() => void), deps?: any[]): void
  export function useMemo<T = any>(cb: () => T, deps?: any[]): T
  export function useCallback<T extends (...args: any[]) => any>(cb: T, deps?: any[]): T
  export function memo<T = any>(component: T): T
  const React: any
  export default React
}

declare module "react/jsx-runtime" {
  export const jsx: any
  export const jsxs: any
  export const Fragment: any
}

declare module "react-virtuoso" {
  import * as React from "react"
  export interface VirtuosoHandle {
    scrollTo: (options: { top: number | "Infinity"; behavior?: ScrollBehavior }) => void
  }
  export const Virtuoso: React.FC<{
    data: unknown[]
    itemContent: (index: number) => React.ReactNode
    followOutput?: boolean
    initialTopMostItemIndex?: number
    defaultItemHeight?: number
    atBottomThreshold?: number
    atBottomStateChange?: (bottom: boolean) => void
    alignToBottom?: boolean
    ref?: React.Ref<VirtuosoHandle>
  }>
}

declare module "react-markdown" {
  import * as React from "react"
  export type Components = Record<string, React.ComponentType<any>>
  const ReactMarkdown: React.FC<{ components?: Components; remarkPlugins?: any[] }>
  export default ReactMarkdown
}

declare module "remark-gfm" {
  const plugin: any
  export default plugin
}

declare module "cheerio" {
  export function load(html: string): any
}

declare module "dompurify" {
  const DOMPurify: any
  export default DOMPurify
}

declare namespace JSX {
  interface IntrinsicElements {
    [elemName: string]: any
  }
}

