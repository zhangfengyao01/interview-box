import type { OCRAdapter, OCRResult } from '@/types/ocr'
import { fileAdapter } from '@/adapters/file'
import { networkAdapter } from '@/adapters/network'
import { errorMessage } from '@/adapters/network'

/**
 * 云端兜底 OCR：腾讯云通用文字识别（高精度版），通过自建代理调用。
 *
 * 两条硬约束：
 * 1. **必须用户明确同意后才上传**：`recognize()` 不做确认，确认在 `services/ocr` 的
 *    `recognize(imagePath, { allowCloud })` 里，页面还要弹一次原生 confirm；
 * 2. **Secret 不落客户端**：这里只把图片交给代理，请求体里没有任何密钥字段。
 */

export interface CloudOcrResponse {
  text?: string
  blocks?: { text: string; left?: number; top?: number; width?: number; height?: number }[]
  elapsedMs?: number
}

export class CloudOCRAdapter implements OCRAdapter {
  readonly engine = 'cloud-tencent'

  /** @param getEndpoint 代理地址 @param getToken 代理的 PROXY_TOKEN（可为空） */
  constructor(private readonly getEndpoint: () => string, private readonly getToken?: () => string) {}

  isSupported(): boolean {
    return !!this.getEndpoint()
  }

  async recognize(path: string): Promise<OCRResult> {
    const endpoint = this.getEndpoint()
    if (!endpoint) {
      throw { code: 'CLOUD_NOT_CONFIGURED', message: '未配置服务端代理地址' }
    }
    const started = Date.now()
    try {
      const image = await fileAdapter.readBase64(path)
      const data = await networkAdapter.postJson<CloudOcrResponse>(
        endpoint,
        '/api/ocr/general-accurate',
        { image },
        { token: this.getToken?.() || '' }
      )
      if (!data || !data.text) {
        throw { code: 'CLOUD_FAILED', message: '云端没有返回文字' }
      }
      return {
        text: data.text,
        blocks: data.blocks || [],
        engine: this.engine,
        elapsedMs: data.elapsedMs || Date.now() - started
      }
    } catch (err) {
      if (err && typeof err === 'object' && 'code' in err) throw err
      throw { code: 'CLOUD_FAILED', message: errorMessage(err) }
    }
  }
}

/**
 * 每次调用用当前设置里的地址造一个适配器，避免把配置缓存成过期状态。
 * token 也走 getter：设置页改了令牌，下一次调用立刻带上新值。
 */
export function cloudOCRFor(endpoint: string, token?: () => string): CloudOCRAdapter {
  return new CloudOCRAdapter(() => endpoint, token)
}
