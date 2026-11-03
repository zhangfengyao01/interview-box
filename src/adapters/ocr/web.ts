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
 *
 * ---
 * 参数是拿真实截图测出来的，不是拍脑袋。样本是一张 1220×2656 的手机截屏（13 道中英混排题目，
 * 题号是界面里的圆形图标），指标是「拆完题后，每道题面与原文的相似度均值」：
 *
 * | 配置 | 条数 | 均分 | ≥0.9 |
 * | --- | --- | --- | --- |
 * | **chi_sim / 原图 / psm 6** | 13 | **0.996** | 13 | ← 当前采用
 * | chi_sim+eng / 原图 / psm 6 | 13 | 0.924 | 8 |
 * | chi_sim+eng / 灰度+对比度 / psm 6 | 13 | 0.987 | 12 |
 * | chi_sim+eng / 放大 2 倍 / psm 6 | 12 | 0.852 | 8 |
 * | chi_sim+eng / 灰度+对比度 / psm 3（自动）| 12 | 0.903 | 10 |
 *
 * 三条反直觉的结论，写在这儿免得以后又被「优化」回去：
 *  - **加英文模型反而更差**：`RAG` / `A2A` / `MCP` 这些词用 chi_sim 单模型就能认对，
 *    混入 eng 后中文行的切分变碎（0.996 → 0.924）。这是个中文题库，就别贪多语言。
 *  - **放大没用**：截图本身够清晰，放大只是把 JPEG 噪点也放大。
 *  - **固定 psm 6（单块）比默认 psm 3（自动）稳**：自动分栏会把一栏到底的清单切碎。
 */

interface TessWorker {
  recognize: (image: string) => Promise<{ data: { text: string } }>
  setParameters: (params: Record<string, unknown>) => Promise<unknown>
  terminate: () => Promise<unknown>
}

/** 只带简体中文模型。要连英文一起认，把 eng.traineddata.gz 放进 static/ocr 并改成 'chi_sim+eng'（实测对中文更差） */
const LANG = 'chi_sim'

/** 长边上限：手机拍的照片动辄 4000px，直接喂给 wasm 既慢又可能吃满内存 */
const MAX_SIDE = 2400

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

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    // 同源 / blob / data URL 都不需要 CORS；跨域图片一旦被画进 canvas 会 taint，
    // 那时 getImageData 会抛错，外层 catch 会退回原图，功能不会断
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('图片解码失败'))
    img.src = src
  })
}

/**
 * 预处理：**只做一件事** —— 长边超过 MAX_SIDE 就等比缩回去。
 *
 * 为什么不顺手做灰度 + 直方图拉伸：试过，在这张截图上结果是变差的
 * （题面均分 0.996 → 0.970，题号图标被揉成「参 / 马 / 力」这类杂字）。
 * 那套做法的前提是「低对比」判断，而判断本身在浏览器里不稳定
 * （同一张图缩到 320px 量出来的灰度跨度是 161，缩到 800px 是 213），
 * 与其留一个会误触发、还让结果变差的分支，不如只保留缩放。
 *
 * 任何异常都返回原图：预处理是辅助，不该成为新的失败点。
 */
async function preprocess(src: string): Promise<string> {
  try {
    const img = await loadImage(src)
    const w0 = img.naturalWidth || img.width
    const h0 = img.naturalHeight || img.height
    if (!w0 || !h0) return src

    const scale = Math.min(1, MAX_SIDE / Math.max(w0, h0))
    if (scale === 1) return src

    const w = Math.max(1, Math.round(w0 * scale))
    const h = Math.max(1, Math.round(h0 * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return src
    ctx.drawImage(img, 0, 0, w, h)
    return canvas.toDataURL('image/png')
  } catch {
    return src
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
    // 单个文本块：截图/试卷都是一栏到底，AUTO 会把它切碎（实测少 1~2 题）
    await worker.setParameters({ tessedit_pageseg_mode: tess.PSM.SINGLE_BLOCK })
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
    const image = await preprocess(path)
    const { data } = await worker.recognize(image)
    const text = (data && data.text) || ''
    return {
      text,
      // tesseract 的块信息要额外开 blocks 参数，这里先只给整段文本，
      // 拆题靠 `services/question/segmenter` 按编号/问句切，不依赖坐标
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
