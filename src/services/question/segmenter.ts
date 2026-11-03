/**
 * 智能拆题：把一段识别/粘贴文本拆成多道题
 * 规则优先（可解释、可回退），不做任何静默改写：
 * - 只切分边界，题面正文一律保留原始字符（含 (), {}, [], ., _, -, => 等）
 * - 「解析 / 答案 / 参考答案」段落归入 referenceAnswer，不和题面混在一起
 *
 * 两条切分策略，取拆得多的那条：
 *  1. **编号式**：`1. ` / `1、` / `(1)` / `Q1:` / `1】` —— 文本自带题号时最准；
 *  2. **问句式**（列表兜底）：整段是一行一条的清单，题号是界面里的图标、OCR 认不出来，
 *     此时「以问号结尾的短行」才是可靠边界。
 * 第 2 条是为「截图里那种题目列表」加的：只有编号式一条路时，13 条题目会被并成 1 条。
 */

const NUMBERING: RegExp[] = [
  /^\s*(?:第\s*)?(\d{1,3})\s*[.、．)）:：]\s*/,
  /^\s*[（(]\s*(\d{1,3})\s*[)）]\s*/,
  /^\s*Q\s*(\d{1,3})\s*[.、:：]?\s*/i,
  /^\s*题目\s*(\d{1,3})\s*[.、:：]?\s*/,
  /^\s*(\d{1,3})\s*[】\]]\s*/
]

const ANSWER_MARK = /^\s*(解析|参考答案|答案|思路|考点)\s*[:：]\s*/

/** `【第 3 张】` 是拍照流程自己拼进去的分批标记，不是题目内容 */
const BATCH_MARK = /^\s*【\s*第\s*\d+\s*张\s*】\s*$/

/** 状态栏时间 `01:49`、`9:05:12` 不能被当成题号 */
const CLOCK = /^\s*\d{1,2}\s*[:：]\s*\d{2}/

/**
 * 列表截图里题号是圆形图标，OCR 认成的东西五花八门，切完统一抹掉。
 * 下面四条分支是按两份**真实**识别输出（`scripts/fixtures/ocr-list-*.txt`）反推的：
 *   `《O 什么是 RAG?`        → 图标弧线 + 被认成 O 的数字
 *   `《9 什么是 Google ADK?` → 图标弧线 + 数字
 *   `《DRAG 的完整流程…`     → 图标弧线 + 粘连的大写字母（数字 6 被认成 D）
 *   `《约 什么提示压缩?`     → 图标弧线 + 一个被认坏的汉字
 *
 * 两个关键约束，都是踩过的坑：
 * 1. 汉字那支必须要求「紧跟空格」，否则 `《2 什么是…` 的「什」会被吃掉，题面变成「么是」。
 * 2. 大写字母那支加了 `(?![a-z])` —— 后面不能是小写字母。这样 `《Python 编程…`
 *    这种书名列不会被削成「ython」；而 `《DRAG` 后面的 `R` 是大写，照削不误。
 * 末尾的空分支是给「图标后面直接就是正文」留的，只吃掉弧线本身。
 */
const BADGE_PREFIX =
  /^[《«‹〈（(【\[\{|｜>＜]\s*(?:[0-9０-９Oo]{1,2}\s*|[A-Z0-9](?![a-z])\s*|[\u4e00-\u9fa5]\s+|)/

/** 题目列表右侧的难度标签，会粘在题面尾部；OCR 有时只剩一个「中/难/易」 */
const TRAILING_NOISE = /(?:\s|[.．…])+[”"'』」]?(简单|中等|困难|较难|容易|[中难易])\s*$/

/** 行首纯数字残渣（圆形图标被认成 0/1/2）与「小写字母打头」的短残渣（fH、a） */
const LEAD_ASCII = [/^\d{1,2}\s+/, /^[a-z][A-Za-z]?\s+/]

/**
 * 圆形题号图标被 OCR 认成的**单个字形 + 空格**。
 *
 * 为什么用白名单而不是「任意单个汉字」：`问 什么是闭包？` 这种写法是真会出现的，
 * 一刀切会把首字削掉。这里只列实测见过的字形（浏览器与 Node 两条链路各认成不同的东西：
 * Node 走 `《2` / `《约`，浏览器走 `人 在RAG…` / `人9 A2A…` / `DRAG…`），
 * 漏掉几个残字只是不好看，误吃正文才是错。
 */
const BADGE_GLYPH = /^(?:[参马力箔人约级目白回囚田由甲申电日曰口囗四DOQUJC][0-9Oo]{0,2})\s+/

/** 行尾 1~2 个 ASCII 残渣（ha、:、2）与尾随标点（问号不在内，它会保留） */
const TRAIL_ASCII = /\s+[A-Za-z0-9:;|]{1,2}$/
/** 尾部标点，允许后面还挂一个被误认的右引号（`…需要..，，”`） */
const TRAIL_PUNCT = /[\s.．…,，。:：;；、·]+[”"』」']?$/

export interface SegmentedQuestion {
  no: number
  title: string
  content: string
  referenceAnswer: string
}

interface Block {
  no: number
  lines: string[]
}

function matchNumber(line: string): { index: number; rest: string } | null {
  if (CLOCK.test(line)) return null
  for (const re of NUMBERING) {
    const m = line.match(re)
    if (m) return { index: Number(m[1]), rest: line.slice(m[0].length) }
  }
  return null
}

/**
 * 清掉行首尾的界面残渣。
 * 只动「首尾的图标 / 难度标签 / OCR 撑出来的空白」，中间一个字不碰 ——
 * 题面正文本身（含 (), {}, [], => 等）必须原样保留，这是这个模块的底线。
 */
function cleanLine(line: string): string {
  let s = line.replace(/[ \t]{2,}/g, ' ').trim()
  s = s.replace(BADGE_PREFIX, '')
  s = s.replace(BADGE_GLYPH, '')
  for (const re of LEAD_ASCII) s = s.replace(re, '')
  s = s.replace(TRAILING_NOISE, '')
  s = s.replace(TRAIL_ASCII, '')
  s = s.replace(TRAIL_PUNCT, '')
  return s.trim()
}

/**
 * 一行能不能当题面：短、且带问号。
 * 上限定 60 字是为了排除「正文里恰好有问号」的段落 —— 那样按行切会把一句话劈成两半。
 *
 * 另一种情况：界面把题面截断成「…」，问号本来就没了（截图里「在 RAG 应用中为了优化检索精度…」
 * 那条就是）。这类行靠「省略号 + 行尾难度标签残字」认出来：列表每一行都以「简单/中等/困难」收尾，
 * OCR 常常只剩一个「中」字，而页面标题那种噪声行不会这样收尾 —— 所以不会把页头当成题目。
 */
function isQuestionLine(line: string): boolean {
  const s = line.trim()
  if (s.length < 6 || s.length > 60) return false
  // 主判据：行内有问号。不锚定行尾 —— OCR 常在问号后面拖一个「简单/中等」的残字
  if (/[?？]/.test(s)) return true
  // 次判据：被界面截断成「…」的条目 + 行尾仍是难度标签（页头那种噪声行不会这样收尾）
  return /[.．…]/.test(s) && /(简单|中等|困难|较难|容易|[中难易])\s*$/.test(s)
}

function splitByQuestionLines(lines: string[]): { no: number; body: string }[] | null {
  const hits = lines.map(isQuestionLine)
  const hitsCount = hits.filter(Boolean).length
  const meaningful = lines.filter((l) => l.trim()).length
  // 少于 3 行问句不成清单；问句行还要占多数，否则是散文
  if (hitsCount < 3 || hitsCount * 2 < meaningful) return null

  const blocks: { no: number; lines: string[] }[] = []
  let current: { no: number; lines: string[] } | null = null
  lines.forEach((line, i) => {
    if (hits[i]) {
      if (current) blocks.push(current)
      current = { no: blocks.length + 1, lines: [cleanLine(line)] }
      return
    }
    // 清单头部（状态栏、标题、列头）落在第一道题之前，直接丢掉
    if (current) current.lines.push(line)
  })
  if (current) blocks.push(current)

  if (blocks.length < 3) return null
  return blocks
    .map((b) => ({ no: b.no, body: b.lines.join('\n').trim() }))
    .filter((b) => b.body.length > 0)
}

export function splitQuestions(text: string): SegmentedQuestion[] {
  const raw = String(text || '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .filter((l) => !BATCH_MARK.test(l))
    .join('\n')
    .trim()
  if (!raw) return []

  const lines = raw.split('\n')
  const blocks: { no: number; body: string }[] = []
  let current: Block | null = null

  const flush = () => {
    if (!current) return
    const body = current.lines.join('\n').trim()
    if (body) blocks.push({ ...current, body })
    current = null
  }

  lines.forEach((line) => {
    const hit = matchNumber(line)
    if (hit) {
      flush()
      current = { no: hit.index, lines: [hit.rest] }
      return
    }
    // 没有编号时，遇到「问：」也视为新题起点
    if (/^\s*问\s*[:：]/.test(line)) {
      flush()
      current = { no: blocks.length + 1, lines: [line.replace(/^\s*问\s*[:：]\s*/, '')] }
      return
    }
    if (!current) {
      current = { no: 1, lines: [line] }
    } else {
      current.lines.push(line)
    }
  })
  flush()

  // 问句式拆得更多就用它：编号式在这种「图标题号」的截图里几乎一条都识别不出
  const byQuestion = splitByQuestionLines(lines)
  if (byQuestion && byQuestion.length > blocks.length) {
    return byQuestion.map((b) => parseBlock(b.body, b.no))
  }

  // 完全没有编号，也没有多个块时，退化为按空行分块
  if (blocks.length <= 1) {
    const byBlank = raw
      .split(/\n\s*\n+/)
      .map((s) => s.trim())
      .filter(Boolean)
    if (byBlank.length > 1) {
      return byBlank.map((b, i) => parseBlock(b, i + 1))
    }
  }

  return blocks.map((b) => parseBlock(b.body, b.no))
}

function parseBlock(body: string, no: number): SegmentedQuestion {
  const lines = body.split('\n')
  const questionLines: string[] = []
  const answerLines: string[] = []
  let inAnswer = false
  lines.forEach((line) => {
    if (ANSWER_MARK.test(line)) {
      inAnswer = true
      answerLines.push(line.replace(ANSWER_MARK, ''))
      return
    }
    if (inAnswer) answerLines.push(line)
    else questionLines.push(line)
  })

  const title = (questionLines[0] || '').trim()
  const content = questionLines.join('\n').trim()
  return {
    no,
    title: title || content.slice(0, 30),
    content: content || title,
    referenceAnswer: answerLines.join('\n').trim()
  }
}

/** 拆题前的质量提示：只做提醒，不阻断 */
export interface SegmentationHint {
  level: 'good' | 'check' | 'poor'
  message: string
}

export function segmentationHint(text: string): SegmentationHint {
  const rows = splitQuestions(text)
  if (rows.length === 0) return { level: 'poor', message: '没有识别到有效文本' }
  if (rows.length === 1 && String(text).length > 400) {
    return { level: 'check', message: '文本较长但只拆出 1 题，请手动检查分段' }
  }
  const bad = rows.filter((r) => r.title.length < 4).length
  if (bad > 0) return { level: 'check', message: `有 ${bad} 条题面过短，建议校对` }
  return { level: 'good', message: `已拆出 ${rows.length} 道题目` }
}
