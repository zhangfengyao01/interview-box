/**
 * 智能拆题：把一段识别/粘贴文本拆成多道题
 * 规则优先（可解释、可回退），不做任何静默改写：
 * - 只切分边界，题面正文一律保留原始字符（含 (), {}, [], ., _, -, => 等）
 * - 「解析 / 答案 / 参考答案」段落归入 referenceAnswer，不和题面混在一起
 */

const NUMBERING: RegExp[] = [
  /^\s*(?:第\s*)?(\d{1,3})\s*[.、．)）:：]\s*/,
  /^\s*[（(]\s*(\d{1,3})\s*[)）]\s*/,
  /^\s*Q\s*(\d{1,3})\s*[.、:：]?\s*/i,
  /^\s*题目\s*(\d{1,3})\s*[.、:：]?\s*/,
  /^\s*(\d{1,3})\s*[】\]]\s*/
]

const ANSWER_MARK = /^\s*(解析|参考答案|答案|思路|考点)\s*[:：]\s*/

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
  for (const re of NUMBERING) {
    const m = line.match(re)
    if (m) return { index: Number(m[1]), rest: line.slice(m[0].length) }
  }
  return null
}

export function splitQuestions(text: string): SegmentedQuestion[] {
  const raw = String(text || '').replace(/\r\n/g, '\n').trim()
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
