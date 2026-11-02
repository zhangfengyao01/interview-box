/**
 * 备份三段式端到端验证（导出 → 清空 → 导入），跑的是**真实代码**：
 * `services/backup` + `adapters/database` 的 storage 实现，不是重写一遍逻辑。
 *
 * 为什么在 Node 里跑：
 * - storage 适配器只依赖 `uni.getStorageSync / setStorageSync`，垫一个内存版就能跑；
 * - 备份/恢复是纯数据逻辑，用真 UI 点反而会被文件选择器、剪贴板卡住。
 *
 * 覆盖不到的：`plus.sqlite`（需要真机/基座），所以这里显式打印引擎名。
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
const { seedIfEmpty } = await import('@/data/seed')
const { backupService } = await import('@/services/backup')

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

// ---------- 0. 播种 ----------
console.log('[0] 播种演示数据')
const seeded = await seedIfEmpty(db())
const s0 = await backupService.stats()
check('播种成功', seeded && s0.questions > 0, `题目 ${s0.questions} / 分类 ${s0.categories} / 标签 ${s0.tags} / 记录 ${s0.logs}`)

// 埋两个只有真正导出才会被带走的字段，用来验「笔记/答案/复习记录没丢」
const before = await db().dump()
const first = before.tables.questions[0]
const probeId = String(first.id)
await db().update('questions', { notes: 'E2E 探针笔记', myAnswer: 'E2E 探针答案' } as never, { eq: { id: probeId } })
// 播种数据里没有复习记录，手工补一条 —— 否则「复习记录一致」是 0 vs 0，等于没验
await db().insert('review_logs', {
  id: 'log_e2e_probe',
  question_id: probeId,
  result: 'good',
  reviewed_at: Date.now(),
  next_review_at: Date.now() + 86400000
})
const dumpBefore = await db().dump()

// ---------- 1. 导出 ----------
console.log('\n[1] 导出')
const text = await backupService.exportText()
let payload: Record<string, any> = {}
try {
  payload = JSON.parse(text)
} catch {
  payload = {}
}
check('导出的是合法 JSON', Object.keys(payload).length > 0)
check('带 app 标识', payload.app === 'interview-box', String(payload.app))
check('带 schemaVersion', typeof payload.schemaVersion === 'number', String(payload.schemaVersion))
check('带 counts 与 checksum', !!payload.counts && !!payload.checksum)
check('题目条数一致', payload.counts?.questions === dumpBefore.tables.questions.length, `${payload.counts?.questions}`)
check(
  'fileName 有内容且为 .json',
  /^interview-box-backup-.+\.json$/.test(backupService.fileName()),
  backupService.fileName()
)

const vOk = backupService.validate(text)
check('校验通过', vOk.ok, vOk.message)

// ---------- 2. 负例：坏文件必须被挡住 ----------
console.log('\n[2] 负例')
const badChecksum = { ...payload, counts: { ...payload.counts, questions: 999 } }
check('条数被改 → 拒绝', !backupService.validate(badChecksum).ok, backupService.validate(badChecksum).message)
check('版本过高 → 拒绝', !backupService.validate({ ...payload, schemaVersion: 99 }).ok, backupService.validate({ ...payload, schemaVersion: 99 }).message)
check('不是本应用 → 拒绝', !backupService.validate({ ...payload, app: 'other' }).ok, backupService.validate({ ...payload, app: 'other' }).message)
check('半截 JSON → 拒绝', !backupService.validate('{"app":"interview-box","tables":').ok)
const noQuestions = { ...payload, tables: { ...payload.tables, questions: undefined } }
check('缺题目数组 → 拒绝', !backupService.validate(noQuestions).ok, backupService.validate(noQuestions).message)

// ---------- 3. 清空 ----------
console.log('\n[3] 清空')
await backupService.clearAll()
const sClear = await backupService.stats()
check('清空后题目为 0', sClear.questions === 0, `${sClear.questions}`)
check('清空后分类为 0', sClear.categories === 0, `${sClear.categories}`)

// ---------- 4. 覆盖恢复 ----------
console.log('\n[4] 覆盖恢复（replace）')
const r1 = await backupService.restore(text, 'replace')
check('恢复成功', r1.ok, r1.message)
const s1 = await backupService.stats()
check('题目数与恢复前一致', s1.questions === dumpBefore.tables.questions.length, `${s1.questions} vs ${dumpBefore.tables.questions.length}`)
check('分类数与恢复前一致', s1.categories === dumpBefore.tables.categories.length, `${s1.categories}`)
check('标签数与恢复前一致', s1.tags === dumpBefore.tables.tags.length, `${s1.tags}`)
check('复习记录数与恢复前一致', s1.logs === dumpBefore.tables.review_logs.length, `${s1.logs}`)

const dumpAfter = await db().dump()
let tableDiff: string[] = []
for (const t of Object.keys(dumpBefore.tables) as (keyof typeof dumpBefore.tables)[]) {
  const a = JSON.stringify(dumpBefore.tables[t])
  const b = JSON.stringify(dumpAfter.tables[t])
  if (a !== b) tableDiff.push(t)
}
check('七张表逐表逐行一致', tableDiff.length === 0, tableDiff.length ? '不一致：' + tableDiff.join(',') : '全部一致')

const restoredLog = dumpAfter.tables.review_logs.find((r: any) => String(r.id) === 'log_e2e_probe') as any
check('复习记录被完整带回', restoredLog?.result === 'good' && String(restoredLog?.question_id) === probeId, JSON.stringify(restoredLog))

const restoredFirst = dumpAfter.tables.questions.find((q: any) => String(q.id) === probeId) as any
check('笔记被完整带回', restoredFirst?.notes === 'E2E 探针笔记', String(restoredFirst?.notes))
check('我的答案被完整带回', restoredFirst?.myAnswer === 'E2E 探针答案', String(restoredFirst?.myAnswer))

// ---------- 5. 合并恢复不覆盖用户内容 ----------
console.log('\n[5] 合并恢复（merge）不覆盖已有内容')
await db().update('questions', { notes: '合并后我改过' } as never, { eq: { id: probeId } })
const r2 = await backupService.restore(text, 'merge')
check('合并执行成功', r2.ok, r2.message)
check('全部已存在 → 新增 0 题', r2.inserted === 0, `inserted=${r2.inserted} skipped=${r2.skipped}`)
const afterMerge = (await db().dump()).tables.questions.find((q: any) => String(q.id) === probeId) as any
check('用户改过的笔记没被覆盖', afterMerge?.notes === '合并后我改过', String(afterMerge?.notes))
const s2 = await backupService.stats()
check('合并后题目数不变', s2.questions === s1.questions, `${s2.questions}`)

// ---------- 6. 合并能补回缺失的数据 ----------
console.log('\n[6] 合并恢复能补回缺的题')
await db().remove('questions', { eq: { id: probeId } })
const sBefore = await backupService.stats()
const r3 = await backupService.restore(text, 'merge')
const s3 = await backupService.stats()
check('少一题时合并会补回', s3.questions === sBefore.questions + 1, `${sBefore.questions} → ${s3.questions}`)
check('补回计数正确', r3.inserted === 1, `inserted=${r3.inserted}`)

console.log(`\n${failed === 0 ? '全部通过' : failed + ' 项失败'}\n`)
process.exit(failed === 0 ? 0 : 1)
