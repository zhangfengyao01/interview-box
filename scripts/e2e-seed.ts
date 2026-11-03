/**
 * 示例数据（含 AI 大模型题）写入逻辑的验证，跑的是 `src/data/seed.ts` 的**真实代码**。
 *
 * 要验三件事，缺一条就会在真机上翻车：
 *  1. 空库：`seedIfEmpty` 写入全量（5 分类 / 14 标签 / 32 题），AI 题在；
 *  2. 老库：只有 18 道旧题时，`seedSupplement` 只补 AI 那 14 道，**不动已有题**；
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

// ---------------------------------------------------------------- 1. 空库
console.log('[1] 空库首次播种')
const wrote = await seedIfEmpty(db())
const q1 = await db().all('questions')
const cats1 = await db().all('categories')
const tags1 = await db().all('tags')
check('返回 true', wrote)
check('题量 = 32（前端 18 + AI 14）', q1.length === 32, `实际 ${q1.length}`)
check('分类 = 5（含 AI 大模型）', cats1.length === 5, `实际 ${cats1.length}`)
check('标签 = 14', tags1.length === 14, `实际 ${tags1.length}`)
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
check('题量仍是 32', (await db().all('questions')).length === 32)
check(`版本号已写入（= ${SEED_VERSION}）`, Number(mem.get('interview_box_seed_version')) === SEED_VERSION, String(mem.get('interview_box_seed_version')))

// ---------------------------------------------------------------- 3. 老库补种
console.log('\n[3] 模拟老库：只有 18 道前端题、没有版本号')
await db().reset()
mem.delete('interview_box_seed_version')

const legacy = (await db().all('questions')).length
// 手工造一个「老版本」库：只写前端题（title 里带「前端」之外也没关系，用真实种子里 cat_fe/cat_algo/cat_pm/cat_proj 的集合）
// 这里直接用现成数据更省事：先播种完整库，再删掉 AI 题与 AI 分类，模拟升级前的状态
await seedIfEmpty(db())
const allRows = await db().all('questions')
for (const row of allRows) {
  if (row.category_id === 'cat_ai') await db().remove('questions', { eq: { id: row.id } })
}
await db().remove('categories', { eq: { id: 'cat_ai' } })
mem.delete('interview_box_seed_version')
const legacyBefore = (await db().all('questions')).length
console.log(`  （构造出的老库：${legacyBefore} 题，分类 ${(await db().all('categories')).length} 个）`)
check('老库确实没有 AI 题', legacyBefore === 18, `实际 ${legacyBefore}${legacy ? '' : ''}`)

// 埋一个用户改动，验「补种不动已有数据」
const firstId = String((await db().all('questions'))[0].id)
await db().update('questions', { notes: '用户自己写的笔记' } as never, { eq: { id: firstId } })

const added = await seedSupplement(db())
const after = await db().all('questions')
check('补充 14 条', added === 14, `实际 ${added}`)
check('题量 18 -> 32', after.length === 32, `实际 ${after.length}`)
check('AI 分类补回来了', (await db().all('categories')).some((c) => c.id === 'cat_ai'))
check(
  '用户笔记没被覆盖',
  (await db().all('questions')).find((q) => q.id === firstId)?.notes === '用户自己写的笔记'
)
check('新增题都挂在 AI 分类下', after.filter((q) => q.category_id === 'cat_ai').length === 14)

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
