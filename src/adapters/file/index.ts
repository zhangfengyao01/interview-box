/**
 * 文件能力适配器（PRD §3「本地文件：APP 沙箱文件系统」、验收「重启后图片仍可访问」）
 *
 * 为什么需要它：`uni.chooseImage` 给的是**临时路径**，应用重启就失效。
 * 图片必须先复制进 `_doc/interview-box/images/`，数据库里只存持久路径，
 * 否则「重启后图片仍能访问」这条验收永远过不了。
 *
 * H5 / 小程序没有沙箱文件系统：`isPersistentSupported()` 返回 false，
 * 上层据此决定「只存 base64 缩略图」还是「提示用户该平台不支持图片持久化」。
 */

type PlusIO = {
  resolveLocalFileSystemURL: (
    url: string,
    success: (entry: FileEntryLike) => void,
    fail: (e: unknown) => void
  ) => void
  requestFileSystem: (
    type: number,
    success: (fs: { root: DirEntryLike }) => void,
    fail: (e: unknown) => void
  ) => void
  PRIVATE_DOC: number
}

interface FileEntryLike {
  name: string
  fullPath: string
  isFile: boolean
  isDirectory: boolean
  copyTo: (parent: DirEntryLike, newName: string, success: () => void, fail: (e: unknown) => void) => void
  remove: (success: () => void, fail: (e: unknown) => void) => void
  file: (success: (f: { size: number }) => void, fail: (e: unknown) => void) => void
}

interface DirEntryLike {
  getDirectory: (path: string, opts: { create: boolean }, success: (d: DirEntryLike) => void, fail: (e: unknown) => void) => void
  getFile: (path: string, opts: { create: boolean }, success: (f: FileEntryLike) => void, fail: (e: unknown) => void) => void
}

function getIO(): PlusIO | null {
  // #ifdef APP-PLUS
  const p = (globalThis as unknown as { plus?: { io?: PlusIO } }).plus
  if (p && p.io) return p.io
  // #endif
  return null
}

const IMAGE_DIR = 'interview-box/images'

export const fileAdapter = {
  /** 是否具备沙箱文件系统（只有 APP 有） */
  isPersistentSupported(): boolean {
    return getIO() !== null
  },

  /**
   * 把临时路径复制进沙箱，返回持久路径。
   * 失败时抛错而不是静默返回原路径 —— 那样会把「图片会丢」藏起来。
   */
  async persist(tempPath: string, nameHint?: string): Promise<string> {
    const io = getIO()
    if (!io) throw new Error('当前平台不支持文件持久化')

    const ext = (tempPath.match(/\.[a-zA-Z0-9]+$/) || ['.jpg'])[0]
    const name = `${nameHint || Date.now()}-${Math.floor(Math.random() * 1e6)}${ext}`

    const docRoot = await new Promise<DirEntryLike>((resolve, reject) => {
      io.requestFileSystem(io.PRIVATE_DOC, (fs) => resolve(fs.root), reject)
    })
    const imageDir = await new Promise<DirEntryLike>((resolve, reject) => {
      docRoot.getDirectory(IMAGE_DIR, { create: true }, resolve, reject)
    })
    const source = await new Promise<FileEntryLike>((resolve, reject) => {
      io.resolveLocalFileSystemURL(tempPath, resolve, reject)
    })
    await new Promise<void>((resolve, reject) => {
      source.copyTo(imageDir, name, () => resolve(), reject)
    })
    return `_doc/${IMAGE_DIR}/${name}`
  },

  async remove(path: string): Promise<void> {
    const io = getIO()
    if (!io) return
    try {
      const entry = await new Promise<FileEntryLike>((resolve, reject) => {
        io.resolveLocalFileSystemURL(path, resolve, reject)
      })
      await new Promise<void>((resolve) => entry.remove(() => resolve(), () => resolve()))
    } catch {
      /* 文件已不存在，忽略 */
    }
  },

  /**
   * 写一个文本文件到沙箱（备份导出用）。
   * 返回持久路径；非 APP 平台抛错，由调用方降级成「复制到剪贴板」。
   */
  async writeText(fileName: string, text: string): Promise<string> {
    const io = getIO()
    if (!io) throw new Error('当前平台不支持写入文件')
    const docRoot = await new Promise<DirEntryLike>((resolve, reject) => {
      io.requestFileSystem(io.PRIVATE_DOC, (fs) => resolve(fs.root), reject)
    })
    const file = await new Promise<FileEntryLike>((resolve, reject) => {
      docRoot.getFile(fileName, { create: true }, resolve, reject)
    })
    await new Promise<void>((resolve, reject) => {
      const creator = (file as unknown as { createWriter: (cb: (w: { write: (s: string) => void }) => void, fail: (e: unknown) => void) => void })
      creator.createWriter(
        (writer) => {
          writer.write(text)
          resolve()
        },
        reject
      )
    })
    return `_doc/${fileName}`
  },

  /**
   * 读成 base64（云端 OCR 上传前用）。
   * 注意：这一步意味着「图片即将离开设备」，调用方必须先拿到用户同意。
   */
  async readBase64(path: string): Promise<string> {
    // #ifdef APP-PLUS
    const io = getIO()
    if (io) {
      return new Promise<string>((resolve, reject) => {
        const reader = (globalThis as unknown as { plus?: { io?: { FileReader?: new () => PlusFileReader } } })
          .plus?.io?.FileReader
        if (!reader) {
          reject(new Error('FileReader 不可用'))
          return
        }
        const r = new reader()
        r.onload = () => resolve(String(r.result || '').replace(/^data:[^,]+,/, ''))
        r.onerror = () => reject(new Error('读取图片失败'))
        r.readAsDataURL(path)
      })
    }
    // #endif
    unstub()
    throw new Error('当前平台不支持读取本地文件')
  }
}

interface PlusFileReader {
  result?: string | ArrayBuffer
  onload: (() => void) | null
  onerror: (() => void) | null
  readAsDataURL: (path: string) => void
}

/** 占位，避免 #ifdef 剥离后出现空函数体告警 */
function unstub(): void {
  /* noop */
}
