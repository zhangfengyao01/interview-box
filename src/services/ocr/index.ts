import type { CloudOCRConsent, OCRAdapter, OCRCapabilities, OCRQuality, OCRResult } from '@/types/ocr'
import { localOCR } from '@/adapters/ocr/local'
import { cloudOCRFor, type CloudOCRAdapter } from '@/adapters/ocr/cloud'
// H5 专用：tesseract.js 只能在浏览器里跑，小程序端必须整段编掉，不能进包
// #ifdef H5
import { webOCR } from '@/adapters/ocr/web'
// #endif

/**
 * OCR 业务入口。页面只认这里，不直接碰插件、不直接发 HTTP。
 *
 * 编排规则（对应 PRD「本地优先，云端兜底」）：
 *  1. 本地引擎可用 → 先用本地（APP 是原生插件，H5 是 WASM 引擎）；
 *  2. 本地不可用/失败 → 如果用户**已明确同意**且配置了代理 → 云端；
 *  3. 都不行 → 抛出可读错误，页面引导改用「粘贴文本 / 手动录入」，链路不中断。
 */

const CONSENT_KEY = 'interview_box_ocr_consent'

export type OCRQualityLevel = 'good' | 'check' | 'poor'

export interface QualityHint {
  level: OCRQualityLevel
  message: string
}

/**
 * 当前环境下可用的本地引擎，按优先级排列：原生（APP）优先，其次是浏览器 WASM。
 * 小程序端两个都不在，返回空数组 —— 这是能力边界，不是故障。
 */
function localAdapters(): OCRAdapter[] {
  const list: OCRAdapter[] = []
  if (localOCR.isSupported()) list.push(localOCR)
  // #ifdef H5
  if (webOCR.isSupported()) list.push(webOCR)
  // #endif
  return list
}

/** 质量提示：由文本特征推断，**不是**模型置信度，UI 文案不要写成「置信度」 */
export function qualityOf(text: string): QualityHint {
  const s = String(text || '').trim()
  if (!s) return { level: 'poor', message: '没有识别到文字，建议换一张更清晰的图片' }
  if (s.length < 12) return { level: 'poor', message: '识别文本过少，可能不完整' }
  const weird = (s.match(/[^\u4e00-\u9fa5a-zA-Z0-9\s，。、；：！？（）()《》“”''\-_./<>={}[\]|+*%#@&$^~`]/g) || []).length
  const rate = weird / Math.max(s.length, 1)
  if (rate > 0.12) return { level: 'check', message: '存在较多异常字符，建议校对' }
  return { level: 'good', message: '识别结果看起来可用' }
}

function readConsent(): CloudOCRConsent {
  try {
    const raw = uni.getStorageSync(CONSENT_KEY)
    const obj = typeof raw === 'string' ? JSON.parse(raw || '{}') : raw
    return { granted: !!(obj && obj.granted), grantedAt: Number(obj?.grantedAt || 0) }
  } catch {
    return { granted: false, grantedAt: 0 }
  }
}

function writeConsent(granted: boolean): CloudOCRConsent {
  const consent = { granted, grantedAt: granted ? Date.now() : 0 }
  try {
    uni.setStorageSync(CONSENT_KEY, JSON.stringify(consent))
  } catch {
    /* 记不住就每次再问一次，不能因为写不进存储就默认同意 */
  }
  return consent
}

export const ocrService = {
  /** 粘贴文本也走同一个结果结构，engine 记为 manual，避免上层写两套分支 */
  fromText(text: string): OCRResult {
    return { text, blocks: [{ text }], engine: 'manual', elapsedMs: 0, qualityHint: 'good' }
  },

  capabilities(settings: { cloudOcrEnabled: boolean; cloudOcrEndpoint: string }): OCRCapabilities {
    const locals = localAdapters()
    const preferred = locals[0]
    const cloudSupported = settings.cloudOcrEnabled && !!settings.cloudOcrEndpoint
    return {
      local: {
        supported: locals.length > 0,
        engine: preferred ? preferred.engine : 'none',
        reason: preferred
          ? undefined
          : '小程序没有本地 OCR；浏览器端需要 WebAssembly SIMD（新版 Chrome / Edge / Safari）'
      },
      cloud: {
        supported: cloudSupported,
        engine: 'cloud-tencent',
        reason: cloudSupported ? undefined : '需在设置里开启并填入服务端代理地址'
      }
    }
  },

  consent(): CloudOCRConsent {
    return readConsent()
  },

  /**
   * 上传前的二次确认。返回 false = 用户拒绝，**绝不偷偷上传**（验收要求）。
   * 已同意过也不再骚扰（授权一次即可，设置页可撤销）。
   */
  async ensureConsent(): Promise<boolean> {
    if (readConsent().granted) return true
    const res = await new Promise<boolean>((resolve) => {
      uni.showModal({
        title: '使用云端识别？',
        content:
          '本地识别不可用时，会把这张图片上传到你配置的服务端代理做识别。图片不进入任何题库，也不会被保存。是否继续？',
        confirmText: '同意上传',
        cancelText: '不上传',
        success: (r) => resolve(!!r.confirm),
        fail: () => resolve(false)
      })
    })
    if (res) writeConsent(true)
    return res
  },

  revokeConsent(): void {
    writeConsent(false)
  },

  /**
   * 主入口：本地优先，云端兜底。
   * @param imagePath 本地图片路径（临时路径也可以，云端路径会在 adapter 里读 base64）
   */
  async recognize(
    imagePath: string,
    options: {
      settings: { cloudOcrEnabled: boolean; cloudOcrEndpoint: string; aiToken?: string }
      allowCloud?: boolean
    }
  ): Promise<OCRResult> {
    const errors: string[] = []

    // 本地引擎按优先级逐个试：APP 是原生插件，H5 是 WASM，两边都失败才往下走
    for (const adapter of localAdapters()) {
      try {
        const result = await adapter.recognize(imagePath)
        return this.withQuality(result)
      } catch (err) {
        errors.push(`本地识别失败（${adapter.engine}）：${(err as { message?: string })?.message || String(err)}`)
      }
    }
    if (!errors.length) errors.push('当前环境没有可用的本地 OCR 引擎')

    const cloudAllowed = options.allowCloud !== false
    const cloudReady = options.settings.cloudOcrEnabled && !!options.settings.cloudOcrEndpoint
    if (cloudAllowed && cloudReady) {
      const agreed = await this.ensureConsent()
      if (agreed) {
        // 云 OCR 和 AI 走的是同一个自建代理，共用同一个令牌
        const adapter: CloudOCRAdapter = cloudOCRFor(
          options.settings.cloudOcrEndpoint,
          () => options.settings.aiToken || ''
        )
        try {
          const result = await adapter.recognize(imagePath)
          return this.withQuality(result)
        } catch (err) {
          errors.push(`云端识别失败：${(err as { message?: string })?.message || String(err)}`)
        }
      } else {
        errors.push('你选择不上传图片')
      }
    } else if (options.settings.cloudOcrEnabled && !options.settings.cloudOcrEndpoint) {
      errors.push('云端识别已开启但未配置代理地址')
    }

    throw {
      code: 'OCR_UNAVAILABLE',
      message: `${errors.join('；')}。可以改用「粘贴文本」或手动录入。`,
      errors
    }
  },

  withQuality(result: OCRResult): OCRResult {
    const hint = qualityOf(result.text)
    const level: OCRQuality = hint.level
    return { ...result, qualityHint: level }
  }
}
