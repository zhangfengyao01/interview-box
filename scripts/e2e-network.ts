/**
 * 网络出口与 AI 服务调用链路的验证，跑的是 `src/adapters/network` 与
 * `src/services/ai` 的**真实代码**，只把最底层的 `uni.request` 换成探针。
 *
 * 为什么单独验这个：代理加了访问令牌之后，客户端必须把 Authorization 头带上，
 * 否则功能直接断在 401。这件事肉眼看代码很容易「以为对了」——
 * 真正的证据是抓到**实际发出去的 header**。
 *
 * 覆盖：
 *  1. 没填令牌 → 不带 Authorization（本地代理零摩擦）；
 *  2. 填了令牌 → 带 `Bearer <token>`；
 *  3. 走 aiService.generate 时，设置里的 aiToken 能一路传到 header；
 *  4. 地址为空 → NOT_CONFIGURED，且不发请求；
 *  5. 代理回 401 → 转成可读的 AI_FAILED，而不是笼统的「网络错误」。
 */

type Recorded = {
  url: string
  header: Record<string, string>
  data: unknown
  timeout?: number
}

const calls: Recorded[] = []
/** 探针的返回策略：'ok' 正常返回，或模拟代理返回某个状态码 + detail */
let mode: 'ok' | { status: number; body: unknown } = 'ok'

// uni 垫片：必须在任何业务模块被 import 之前生效
;(globalThis as Record<string, unknown>).uni = {
  getStorageSync: () => '',
  setStorageSync: () => undefined,
  removeStorageSync: () => undefined,
  getSystemInfoSync: () => ({ statusBarHeight: 20, platform: 'devtools' }),
  request: (opts: Recorded & { success?: (r: unknown) => void; fail?: (e: unknown) => void }) => {
    calls.push({ url: opts.url, header: opts.header, data: opts.data, timeout: opts.timeout })
    if (mode !== 'ok') {
      opts.success?.({ statusCode: mode.status, data: mode.body } as never)
      return
    }
    opts.success?.({
      statusCode: 200,
      data: { answerMarkdown: '# 五段式答案\n\n正文', followUps: ['追问一'] }
    } as never)
  }
}

const { networkAdapter } = await import('@/adapters/network')
const { aiService } = await import('@/services/ai')

let failed = 0
function check(name: string, ok: boolean, detail = ''): void {
  if (ok) {
    console.log(`  PASS  ${name}${detail ? ' — ' + detail : ''}`)
  } else {
    failed += 1
    console.log(`  FAIL  ${name}${detail ? '  ← ' + detail : ''}`)
  }
}

async function expectThrow(fn: () => Promise<unknown>): Promise<{ code?: string; message?: string }> {
  try {
    await fn()
    return {}
  } catch (err) {
    return (err ?? {}) as { code?: string; message?: string }
  }
}

const base = {
  question: '说说 webpack 的构建流程？',
  category: '前端开发',
  difficulty: 'medium' as const,
  style: 'interview' as const
}

// ---------------------------------------------------------------- 1. 不带令牌
console.log('\n[1] 没填令牌时不带 Authorization（本地代理零摩擦）')
calls.length = 0
await networkAdapter.postJson('http://127.0.0.1:8000', '/api/ai/answer', base, {})
check('发出了 1 次请求', calls.length === 1, `实际 ${calls.length}`)
check('URL 拼接正确', calls[0]?.url === 'http://127.0.0.1:8000/api/ai/answer', String(calls[0]?.url))
check('没有 Authorization 头', calls[0]?.header.Authorization === undefined, JSON.stringify(calls[0]?.header))
check('Content-Type 仍在', calls[0]?.header['Content-Type'] === 'application/json', JSON.stringify(calls[0]?.header))

// ---------------------------------------------------------------- 2. 带令牌
console.log('\n[2] 填了令牌时带 Bearer 前缀')
calls.length = 0
await networkAdapter.postJson('http://127.0.0.1:8000', '/api/ai/answer', base, { token: 'tok-123' })
check('Authorization 带上了', calls[0]?.header.Authorization === 'Bearer tok-123', JSON.stringify(calls[0]?.header))

// ---------------------------------------------------------------- 3. 斜杠容错
console.log('\n[3] 地址末尾带斜杠也能拼对')
calls.length = 0
await networkAdapter.postJson('http://127.0.0.1:8000/', '/api/ai/answer', base, { token: 't' })
check('没有出现双斜杠', calls[0]?.url === 'http://127.0.0.1:8000/api/ai/answer', String(calls[0]?.url))

// ---------------------------------------------------------------- 4. 设置里的令牌一路传到 header
console.log('\n[4] aiService.generate：设置里的 aiToken 传到 header')
calls.length = 0
const draft = await aiService.generate(base, {
  aiEnabled: true,
  aiEndpoint: 'https://proxy.example.com',
  aiToken: 'proxy-token-abc',
  questionId: 'q1'
})
check('请求发出', calls.length === 1, `实际 ${calls.length}`)
check('令牌到达 header', calls[0]?.header.Authorization === 'Bearer proxy-token-abc', JSON.stringify(calls[0]?.header))
check('超时是 45s', calls[0]?.timeout === 45000, String(calls[0]?.timeout))
check('草稿带上了五段式要求', Array.isArray((calls[0]?.data as { sections?: string[] }).sections), JSON.stringify(calls[0]?.data))
check('草稿不落库（provider=proxy）', draft.provider === 'proxy' && draft.accepted === false, JSON.stringify(draft.provider))

console.log('\n[5] 没填令牌时仍然可用（代理没设 PROXY_TOKEN 的场景）')
calls.length = 0
await aiService.generate(base, {
  aiEnabled: true,
  aiEndpoint: 'https://proxy.example.com',
  questionId: 'q1'
})
check('不带 Authorization', calls[0]?.header.Authorization === undefined, JSON.stringify(calls[0]?.header))

// ---------------------------------------------------------------- 6. 未配置
console.log('\n[6] 地址为空：直接 NOT_CONFIGURED，不发请求')
calls.length = 0
const notConfigured = await expectThrow(() =>
  aiService.generate(base, { aiEnabled: true, aiEndpoint: '', questionId: 'q1' })
)
check('错误码 AI_NOT_CONFIGURED', notConfigured.code === 'AI_NOT_CONFIGURED', String(notConfigured.code))
check('没有发出任何请求', calls.length === 0, `实际 ${calls.length}`)

// ---------------------------------------------------------------- 7. 401 的错误文案
console.log('\n[7] 代理回 401/429：状态码与服务端 detail 都要带出来')
// 网络类错误保留原码（HTTP），只有非网络异常才被 aiService 包成 AI_FAILED ——
// 这是刻意的：上层靠 code 区分「该提示重试」还是「该检查配置」。
mode = { status: 401, body: { detail: '缺少或错误的访问令牌（本代理设置了 PROXY_TOKEN）' } }
const denied = await expectThrow(() =>
  aiService.generate(base, {
    aiEnabled: true,
    aiEndpoint: 'https://proxy.example.com',
    aiToken: 'wrong',
    questionId: 'q1'
  })
)
check('错误码 HTTP（网络类保留原码）', denied.code === 'HTTP', String(denied.code))
check('提示含状态码 401', String(denied.message).includes('401'), String(denied.message))
check('提示含服务端 detail', String(denied.message).includes('PROXY_TOKEN'), String(denied.message))

mode = { status: 429, body: { detail: '请求太频繁，请 30 秒后再试（每 IP 每分钟 10 次）' } }
const limited = await expectThrow(() =>
  aiService.generate(base, {
    aiEnabled: true,
    aiEndpoint: 'https://proxy.example.com',
    aiToken: 't',
    questionId: 'q1'
  })
)
check('429 提示含「请求太频繁」', String(limited.message).includes('请求太频繁'), String(limited.message))

mode = { status: 500, body: null }
const broken = await expectThrow(() =>
  aiService.generate(base, {
    aiEnabled: true,
    aiEndpoint: 'https://proxy.example.com',
    questionId: 'q1'
  })
)
check('无响应体时不炸，只回状态码', String(broken.message) === '代理返回 500', String(broken.message))

console.log(`\n${failed === 0 ? '全部通过' : '有失败项'}：${failed} 失败`)
if (failed) {
  console.log('客户端这边的令牌链路没接通，代理开启 PROXY_TOKEN 后功能会断在 401。')
}
process.exit(failed === 0 ? 0 : 1)
