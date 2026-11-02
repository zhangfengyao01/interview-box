import type { OCRAdapter, OCRResult } from '@/types/ocr'

/**
 * H5 端本地 OCR：tesseract.js（WebAssembly）。
 *
 * 为什么 H5 也要有本地引擎：在线版如果只能「云端识别」，那既违背 PRD 的「本地优先」，
 * 又必须依赖一个还没实现的服务端代理 —— 结果就是「识别暂不可用」。
 *
 * 三个约束，都是刻意的：
 *  1. **不联网**：worker、core、语言模型全部随包放在 `src/static/ocr/`，运行期不发外部请求
 *     （默认的 tesseract.js 会去 jsDelivr 拉模型，那就不算本地了）；
 *  2. **不拖累首屏**：约 5.5MB 的资源只在第一次真正识别时动态加载，之后复用同一个 worker；
 *  3. **不硬撑**：只带了 SIMD 版 core，浏览器不支持 WebAssembly SIMD 时 `isSupported()` 如实返回 false，
 *     由上层降级到云端或引导改用「粘贴文本」。
 */

interface TessWorker {
  recognize: (image: string) => Promise<{ data: { text: string } }>
  terminate: () => Promise<unknown>
}

/** 只带了简体中文模型。要连英文一起认，把 eng.traineddata.gz 放进 static/ocr 并改成 'chi_sim+eng' */
const LANG = 'chi_sim'

let workerPromise: Promise<TessWorker> | null = null

function assetPath(file: string): string {
  const base = import.meta.env.BASE_URL || '/'
  const dir = `${base.replace(/\/?$/, '/')}static/ocr/`
  return file ? `${dir}${file}` : dir.replace(/\/$/, '')
}

/**
 * 能力探测：不加载任何资源，只验证运行时能不能跑我们带的这份 core。
 * 这段 24 字节的模块是 wasm-feature-detect 的 SIMD 探测用例（v128 返回类型）。
 */
function hasWasmSimd(): boolean {
  try {
    if (typeof WebAssembly !== 'object' || typeof WebAssembly.validate !== 'function') return false
    return WebAssembly.validate(
      new Uint8Array([
        0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11
      ])
    )
  } catch {
    return false
  }
}

async function getWorker(): Promise<TessWorker> {
  if (workerPromise) return workerPromise
  workerPromise = (async () => {
    const tess = await import('tesseract.js')
    const worker = await tess.createWorker(LANG, tess.OEM.LSTM_ONLY, {
      workerPath: assetPath('worker.min.js'),
      // 指向具体文件：tesseract.js 见到 .js 结尾就不再按 SIMD 特性挑目录里的其它版本
      corePath: assetPath('tesseract-core-simd-lstm.wasm.js'),
      langPath: assetPath(''),
      logger: () => {
        /* 进度由页面自己的 OcrProgress 表达，这里不重复上报 */
      }
    })
    return worker as unknown as TessWorker
  })().catch((err) => {
    // 失败就把缓存的 promise 清掉，下次点击还能重试，而不是永远拿到同一个 rejected promise
    workerPromise = null
    throw err
  })
  return workerPromise
}

export class WebOCRAdapter implements OCRAdapter {
  readonly engine = 'local-tesseract-wasm'

  isSupported(): boolean {
    return typeof window !== 'undefined' && hasWasmSimd()
  }

  async recognize(path: string): Promise<OCRResult> {
    const started = Date.now()
    const worker = await getWorker()
    const { data } = await worker.recognize(path)
    const text = (data && data.text) || ''
    return {
      text,
      // tesseract 的块信息要额外开 blocks 参数，这里先只给整段文本，
      // 拆题靠 `services/question/segmenter` 按编号切，不依赖坐标
      blocks: text ? [{ text }] : [],
      engine: this.engine,
      elapsedMs: Date.now() - started
    }
  }

  /** 释放 worker（换图重来、页面卸载、或想强制重新加载模型时用） */
  async dispose(): Promise<void> {
    if (!workerPromise) return
    const pending = workerPromise
    workerPromise = null
    try {
      const worker = await pending
      await worker.terminate()
    } catch {
      /* 已经挂了就不用再收拾 */
    }
  }
}

export const webOCR = new WebOCRAdapter()
