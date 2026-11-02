/// <reference types="@dcloudio/types" />
/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>
  export default component
}

/**
 * UTS 插件 `local-ocr-lite` 的类型声明。
 *
 * 为什么手写一份而不是靠自动生成：`utssdk/interface.uts` 是 UTS 语法，`vue-tsc` 不认，
 * 不声明的话 `import ... from '@/uni_modules/local-ocr-lite'` 会直接报「找不到模块」。
 * 这份声明必须和 `utssdk/interface.uts` 保持同步改。
 */
declare module '@/uni_modules/local-ocr-lite' {
  export interface UtsOcrBlock {
    text: string
    left: number
    top: number
    width: number
    height: number
  }

  export interface UtsOcrResult {
    success: boolean
    text: string
    blocks: UtsOcrBlock[]
    /** 毫秒 */
    elapsedTime: number
    message?: string
  }

  export interface UtsOcrOptions {
    path: string
    languages?: string[]
  }

  export function isSupported(): boolean
  export function recognize(options: UtsOcrOptions): Promise<UtsOcrResult>
}
