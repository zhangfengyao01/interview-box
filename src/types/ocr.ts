/**
 * OCR 能力契约 —— 直接采用 PRD §5 的接口定义。
 *
 * 页面只依赖 `OCRService`，不关心底层是 ML Kit、Apple Vision 还是腾讯云；
 * 底层实现放在 `adapters/ocr/`，各自独立，互不影响。
 */

/** 文本块：带坐标时可用于还原排版（代码块、多列试题尤其需要） */
export interface OCRBlock {
  text: string
  left?: number
  top?: number
  width?: number
  height?: number
}

/** 识别质量提示：由 `service` 依据块数/字符集/置信规则给出，不是模型置信度 */
export type OCRQuality = 'good' | 'check' | 'poor'

export interface OCRResult {
  text: string
  blocks: OCRBlock[]
  /** 引擎标识，如 mlkit / vision / tencent-ocr / manual */
  engine: string
  elapsedMs: number
  qualityHint?: OCRQuality
}

export interface OCRAdapter {
  /** 引擎名，写进 source_assets.ocr_engine */
  readonly engine: string
  /** 当前平台/环境是否可用（小程序里本地 OCR 不可用，要能如实返回 false） */
  isSupported(): boolean
  recognize(path: string): Promise<OCRResult>
}

/** 云端识别需要用户明确同意后才允许上传（验收要求：拒绝上传则不发送） */
export interface CloudOCRConsent {
  granted: boolean
  grantedAt: number
}

export interface OCRCapabilities {
  local: { supported: boolean; engine: string; reason?: string }
  cloud: { supported: boolean; engine: string; reason?: string }
}

/** OCR 进度步骤（components/OcrProgress.vue 消费，页面按真实阶段推进） */
export type OcrStepStatus = 'wait' | 'doing' | 'done' | 'fail'

export interface OcrStep {
  key: string
  label: string
  detail?: string
  status: OcrStepStatus
}
