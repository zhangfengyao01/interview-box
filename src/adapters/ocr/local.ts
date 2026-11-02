import type { OCRAdapter, OCRResult } from '@/types/ocr'

/**
 * 本地 OCR 适配器：`local-ocr-lite`（UTS 插件，Android = ML Kit / iOS = Vision）。
 *
 * 事实约束（PRD §3.2 明确写过）：
 * - 只支持 Android / iOS，**不支持微信小程序**；
 * - 必须做自定义调试基座或云打包才能真机验证，普通运行基座调不到插件。
 *
 * 因此这里 `isSupported()` 一律运行时探测，探测不到就返回 false，
 * 由 `services/ocr` 决定是降级到云端还是引导用户改用粘贴/手动录入。
 */

interface LocalOcrPlugin {
  recognize: (
    options: { path: string; mode: string; languages: string[] },
    callback: (res: {
      success?: boolean
      text?: string
      blocks?: { text: string; left?: number; top?: number; width?: number; height?: number }[]
      elapsedTime?: number
      message?: string
    }) => void
  ) => void
}

const PLUGIN_NAME = 'local-ocr-lite'

function requirePlugin(): LocalOcrPlugin | null {
  // #ifdef APP-PLUS
  try {
    const req = (uni as unknown as { requireNativePlugin?: (n: string) => unknown }).requireNativePlugin
    if (typeof req !== 'function') return null
    const plugin = req(PLUGIN_NAME) as LocalOcrPlugin | undefined
    return plugin && typeof plugin.recognize === 'function' ? plugin : null
  } catch {
    return null
  }
  // #endif
  return null
}

export class LocalOCRAdapter implements OCRAdapter {
  readonly engine = 'local-mlkit'

  isSupported(): boolean {
    return requirePlugin() !== null
  }

  recognize(path: string): Promise<OCRResult> {
    const plugin = requirePlugin()
    if (!plugin) {
      return Promise.reject({
        code: 'OCR_UNSUPPORTED',
        message: '当前环境未启用本地 OCR（需安装 UTS 插件并做自定义基座）'
      })
    }
    const started = Date.now()
    return new Promise<OCRResult>((resolve, reject) => {
      plugin.recognize({ path, mode: 'accurate', languages: ['zh-Hans', 'en-US'] }, (res) => {
        if (res && res.success) {
          resolve({
            text: res.text || '',
            blocks: res.blocks || [],
            engine: this.engine,
            elapsedMs: res.elapsedTime || Date.now() - started
          })
          return
        }
        reject({ code: 'OCR_FAILED', message: (res && res.message) || '本地识别失败' })
      })
    })
  }
}

export const localOCR = new LocalOCRAdapter()
