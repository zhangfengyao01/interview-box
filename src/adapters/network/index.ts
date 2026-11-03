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
  /**
   * 自建代理的访问令牌（对应服务端的 PROXY_TOKEN）。
   * 为空就不带 Authorization 头 —— 代理没设令牌时照样能通，本地开发零摩擦。
   */
  token?: string
}

function endpoint(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`
}

/**
 * 取代理返回的 detail 字段（FastAPI 的错误响应体）。
 * 只认对象形态的 `{ detail: string }`，其他一律忽略 —— 错误路径上不能再抛新异常。
 */
function proxyDetail(data: unknown): string {
  if (!data || typeof data !== 'object') return ''
  const detail = (data as { detail?: unknown }).detail
  if (typeof detail === 'string' && detail.trim()) return `：${detail.trim()}`
  return ''
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

    // 令牌只在填了的时候带上，且用 Bearer 前缀（服务端同时也接受裸令牌）
    const header: Record<string, string> = { 'Content-Type': 'application/json' }
    if (options.token) header.Authorization = `Bearer ${options.token}`

    return new Promise<T>((resolve, reject) => {
      uni.request({
        url: endpoint(baseUrl, path),
        method: 'POST',
        timeout: options.timeout ?? 20000,
        header,
        data: body as Record<string, unknown>,
        success: (res) => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(res.data as T)
            return
          }
          // 4xx/5xx 时把服务端给的 detail 一起带回上层：
          // 否则 401/429 这种「有明确原因」的错误，用户只能看到一个干巴巴的状态码，
          // 代理特地写的「请求太频繁，请 30 秒后再试」就白写了。
          const err: NetworkError = {
            code: 'HTTP',
            status: res.statusCode,
            message: `代理返回 ${res.statusCode}${proxyDetail(res.data)}`
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
