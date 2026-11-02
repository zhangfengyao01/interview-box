/**
 * 网络适配器：客户端**只跟自己的轻量代理说话**，不直连云厂商。
 *
 * 原因（PRD §5）：云端 OCR（腾讯云）和大模型都要求 Secret/API Key，
 * 打包进 APP 就等于公开。代理只处理当次请求、不落题库、不做同步。
 * 所以这里只有一个 `postJson`，没有鉴权逻辑之外的任何业务。
 */

export interface NetworkError {
  code: 'NETWORK' | 'HTTP' | 'TIMEOUT' | 'NOT_CONFIGURED'
  status?: number
  message: string
}

export interface RequestOptions {
  timeout?: number
}

function endpoint(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`
}

export const networkAdapter = {
  /**
   * POST JSON → T。
   * `baseUrl` 为空时立刻返回 NOT_CONFIGURED，让上层给出「未配置」这种可读提示，
   * 而不是发一个注定失败的请求。
   */
  async postJson<T>(baseUrl: string, path: string, body: unknown, options: RequestOptions = {}): Promise<T> {
    if (!baseUrl) {
      const err: NetworkError = {
        code: 'NOT_CONFIGURED',
        message: '未配置服务端代理地址（设置 → 云端能力）'
      }
      throw err
    }

    return new Promise<T>((resolve, reject) => {
      uni.request({
        url: endpoint(baseUrl, path),
        method: 'POST',
        timeout: options.timeout ?? 20000,
        header: { 'Content-Type': 'application/json' },
        data: body as Record<string, unknown>,
        success: (res) => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(res.data as T)
            return
          }
          const err: NetworkError = {
            code: 'HTTP',
            status: res.statusCode,
            message: `代理返回 ${res.statusCode}`
          }
          reject(err)
        },
        fail: (e) => {
          const err: NetworkError = {
            code: 'NETWORK',
            message: (e && (e as { errMsg?: string }).errMsg) || '网络请求失败'
          }
          reject(err)
        }
      })
    })
  }
}

export function isNetworkError(e: unknown): e is NetworkError {
  return !!e && typeof e === 'object' && 'code' in e && 'message' in e
}

export function errorMessage(e: unknown): string {
  if (isNetworkError(e)) return e.message
  if (e instanceof Error) return e.message
  return String(e)
}
