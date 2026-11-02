import type { OCRAdapter, OCRBlock, OCRResult } from '@/types/ocr'

/**
 * APP 端本地 OCR 适配器：`local-ocr-lite`（UTS 插件，Android = ML Kit 中文离线模型）。
 *
 * ---
 * 这里踩过两个坑，都写在注释里省得下次再踩：
 *
 * 1. **UTS 插件不能用 `uni.requireNativePlugin()` 取。**
 *    那是 `nativeplugins/` 原生语言插件的运行时反射取法。UTS 插件在编译期就被翻成原生代码，
 *    官方给的区别表写得很直白：原生插件「`uni.requireNativePlugin()`」，UTS 插件「普通 import，支持摇树」。
 *    用 requireNativePlugin 去取 UTS 插件永远是 undefined —— 表现就是 `isSupported()` 恒 false，
 *    页面一直显示「识别暂不可用」，看起来像插件没装上，其实是取法错了。
 *
 * 2. **import 只能在 APP-PLUS 里出现。**
 *    `utssdk/` 下的东西是原生源码，H5 / 小程序的产物里不该带它（小程序也编不过）。
 *    所以整段 import 用条件编译包住，非 APP 端 `utsModule` 保持 null，等价于「本平台没有原生 OCR」。
 *
 * 另外：真机要能调到它，必须**自定义调试基座**或云打包（普通标准基座里没有这个插件的原生代码）。
 */

// #ifdef APP-PLUS
import * as UtsOcr from '@/uni_modules/local-ocr-lite'
// #endif

/** 插件运行时形态（与 `src/env.d.ts` 里的 declare module 同构） */
interface UtsOcrModule {
  isSupported(): boolean
  recognize(options: { path: string; languages?: string[] }): Promise<{
    success: boolean
    text: string
    blocks: { text: string; left: number; top: number; width: number; height: number }[]
    elapsedTime: number
    message?: string
  }>
}

/** 非 APP 端恒为 null；APP 端在编译期被赋成插件模块 */
let utsModule: UtsOcrModule | null = null
// #ifdef APP-PLUS
utsModule = UtsOcr as unknown as UtsOcrModule
// #endif

export class LocalOCRAdapter implements OCRAdapter {
  readonly engine = 'local-mlkit'

  isSupported(): boolean {
    if (utsModule === null) return false
    try {
      return utsModule.isSupported()
    } catch {
      // 插件在但原生初始化失败（比如模型缺失），如实当不可用，别让页面白等
      return false
    }
  }

  async recognize(path: string): Promise<OCRResult> {
    const mod = utsModule
    if (mod === null) {
      throw {
        code: 'OCR_UNSUPPORTED',
        message: '当前环境没有原生 OCR（需 APP 端 + 自定义基座）'
      }
    }

    const started = Date.now()
    const res = await mod.recognize({ path, languages: ['zh-Hans', 'en-US'] })

    if (!res || !res.success) {
      throw { code: 'OCR_FAILED', message: (res && res.message) || '本地识别失败' }
    }

    const blocks: OCRBlock[] = (res.blocks || []).map((b) => ({
      text: b.text,
      left: b.left,
      top: b.top,
      width: b.width,
      height: b.height
    }))

    return {
      text: res.text || '',
      blocks,
      engine: this.engine,
      elapsedMs: res.elapsedTime || Date.now() - started
    }
  }
}

export const localOCR = new LocalOCRAdapter()
