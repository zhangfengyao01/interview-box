/**
 * 示例数据写入逻辑的验证，跑的是 `src/data/seed.ts` 的**真实代码**。
 *
 * 要验三件事，缺一条就会在真机上翻车：
 *  1. 空库：`seedIfEmpty` 写入全量（5 分类 / 16 标签 / 148 题：前端 134 + AI 14）；
 *  2. 老库：只有最初 18 道题时，`seedSupplement` 只补缺的 130 道（AI 14 + 前端题库 116），
 *     **不动已有题**；
 *  3. 幂等：再跑一次补充逻辑不重复写（版本号挡住）。
 *
 * 另外验一个容易漏的点：用户自己删掉的示例题不能被「补种」复活。
 * 这里的软删在 `db.all` 里仍可见，去重集合能挡住 —— 这正是选择标题去重而不是只靠版本号的原因。
 */
const mem = new Map<string, string>()

// uni 垫片：必须在任何业务模块被 import 之前生效
;(globalThis as Record<string, unknown>).uni = {
  getStorageSync: (k: string) => mem.get(k) ?? '',
  setStorageSync: (k: string, v: string) => void mem.set(k, v),
  removeStorageSync: (k: string) => void mem.delete(k),
  getSystemInfoSync: () => ({ statusBarHeight: 20, platform: 'devtools' })
}

const { bootDatabase, db } = await import('@/adapters/database')
const { seedIfEmpty, seedSupplement, SEED_VERSION } = await import('@/data/seed')
const { FRONTEND_BANK_TITLES } = await import('@/data/banks')

const norm = (s: unknown): string => String(s).replace(/\s+/g, '').trim()
/** 老库（第一版 18 题）不含的题：AI 14 + 前端题库 116 */
const NOT_IN_V1 = new Set([
  ...FRONTEND_BANK_TITLES.map(norm),
  '什么是RAG？完整流程是怎么样的？',
  '为什么RAG里要做Rerank？具体怎么落地？',
  '什么是混合检索？为什么在基于大模型的应用里需要它？',
  '什么是查询扩展？为什么在RAG应用中需要查询扩展？',
  '什么是Self-Query（自查询）？为什么在RAG中需要自查询？',
  '什么是提示压缩？为什么在RAG中需要提示压缩？',
  'A2A协议有哪五大设计原则？',
  'A2A协议的工作原理是怎样的？',
  'A2A协议与MCP协议的关系是怎样的？',
  '什么是GoogleADK？',
  'FunctionCalling的原理是什么？',
  '微调和RAG该怎么选？',
  '怎么评测一套RAG系统？',
  '大模型流式输出在前端怎么实现？'
].map(norm))
const FRONTEND_BANK_SIZE = FRONTEND_BANK_TITLES.length

let failed = 0
function check(name: string, ok: boolean, detail = ''): void {
  if (ok) {
    console.log(`  PASS  ${name}${detail ? ' — ' + detail : ''}`)
  } else {
    failed += 1
    console.log(`  FAIL  ${name}${detail ? ' — ' + detail : ''}`)
  }
}

const boot = await bootDatabase()
console.log(`\n引擎：${boot.engine}${boot.fellBack ? '（降级：' + boot.reason + '）' : ''}\n`)

const EXPECT_FRONTEND = 116
const EXPECT_TOTAL = 18 + 14 + EXPECT_FRONTEND

// ---------------------------------------------------------------- 1. 空库
console.log('[1] 空库首次播种')
const wrote = await seedIfEmpty(db())
const q1 = await db().all('questions')
const cats1 = await db().all('categories')
const tags1 = await db().all('tags')
check(`前端题库共 ${EXPECT_FRONTEND} 题（bank 数量钉住）`, FRONTEND_BANK_SIZE === EXPECT_FRONTEND, `实际 ${FRONTEND_BANK_SIZE}`)
check('返回 true', wrote)
check(`题量 = ${EXPECT_TOTAL}（最初 18 + AI 14 + 前端题库 ${EXPECT_FRONTEND}）`, q1.length === EXPECT_TOTAL, `实际 ${q1.length}`)
check('分类 = 5（含 AI 大模型）', cats1.length === 5, `实际 ${cats1.length}`)
check('标签 = 16（含 React / TypeScript）', tags1.length === 16, `实际 ${tags1.length}`)
check(
  'AI 大模型分类存在',
  cats1.some((c) => c.id === 'cat_ai' && c.name === 'AI 大模型'),
  JSON.stringify(cats1.map((c) => c.name))
)
const ai1 = q1.filter((q) => q.category_id === 'cat_ai')
check('AI 题 = 14', ai1.length === 14, `实际 ${ai1.length}`)
check('题面没有空白/重复', new Set(q1.map((q) => String(q.title))).size === q1.length)
check(
  '每题都有参考回答',
  q1.every((q) => String(q.reference_answer || '').length >= 20),
  q1.filter((q) => String(q.reference_answer || '').length < 20).map((q) => q.title).join(' | ')
)
check(
  '每题的标签都存在',
  (await db().all('question_tags')).every((l) => tags1.some((t) => t.id === l.tag_id))
)
check('每题都有来源关系', (await db().all('question_sources')).length === q1.length)

// ---------------------------------------------------------------- 2. 幂等
console.log('\n[2] 再跑一次补充逻辑（应零新增）')
const again = await seedSupplement(db())
check('补充 0 条', again === 0, `实际 ${again}`)
check(`题量仍是 ${EXPECT_TOTAL}`, (await db().all('questions')).length === EXPECT_TOTAL)
check(`版本号已写入（= ${SEED_VERSION}）`, Number(mem.get('interview_box_seed_version')) === SEED_VERSION, String(mem.get('interview_box_seed_version')))

// ---------------------------------------------------------------- 3. 老库补种
console.log('\n[3] 模拟老库：只有最初 18 道题、没有版本号')
await db().reset()
mem.delete('interview_box_seed_version')

// 构造「第一版」库：先播全量，再删掉 AI 题与前端题库的题（按题面集合识别），模拟升级前的状态
await seedIfEmpty(db())
for (const row of await db().all('questions')) {
  const isAi = row.category_id === 'cat_ai'
  const isNewBank = NOT_IN_V1.has(norm(row.title))
  if (isAi || isNewBank) await db().remove('questions', { eq: { id: row.id } })
}
await db().remove('categories', { eq: { id: 'cat_ai' } })
mem.delete('interview_box_seed_version')
const legacyBefore = (await db().all('questions')).length
console.log(`  （构造出的老库：${legacyBefore} 题，分类 ${(await db().all('categories')).length} 个）`)
check('老库确实只有最初 18 题', legacyBefore === 18, `实际 ${legacyBefore}`)

// 埋一个用户改动，验「补种不动已有数据」
const firstId = String((await db().all('questions'))[0].id)
await db().update('questions', { notes: '用户自己写的笔记' } as never, { eq: { id: firstId } })

const expectAdded = 14 + EXPECT_FRONTEND
const added = await seedSupplement(db())
const after = await db().all('questions')
check(`补充 ${expectAdded} 条（AI 14 + 前端题库 ${EXPECT_FRONTEND}）`, added === expectAdded, `实际 ${added}`)
check(`题量 18 -> ${EXPECT_TOTAL}`, after.length === EXPECT_TOTAL, `实际 ${after.length}`)
check('AI 分类补回来了', (await db().all('categories')).some((c) => c.id === 'cat_ai'))
check(
  '用户笔记没被覆盖',
  (await db().all('questions')).find((q) => q.id === firstId)?.notes === '用户自己写的笔记'
)
check('AI 题回到 14 道', after.filter((q) => q.category_id === 'cat_ai').length === 14)
check(
  '前端题库都挂在 cat_fe 下（8 原有 + 116 新增）',
  after.filter((q) => q.category_id === 'cat_fe').length === 8 + EXPECT_FRONTEND
)

// ---------------------------------------------------------------- 4. 删掉的题不复活
console.log('\n[4] 用户删掉的示例题不能被补种复活')
const victim = after.find((q) => q.category_id === 'cat_ai')
await db().update('questions', { deleted_at: Date.now() } as never, { eq: { id: String(victim!.id) } })
mem.delete('interview_box_seed_version')
const revived = await seedSupplement(db())
check('没有再补回来', revived === 0, `实际 ${revived}`)
check(
  '该题仍是删除状态',
  (await db().all('questions')).find((q) => q.id === victim!.id)?.deleted_at != null
)

console.log(`\n${failed === 0 ? '全部通过' : '有失败项'}：${failed} 失败`)
process.exit(failed === 0 ? 0 : 1)
