/** 标题归一化：统一空白、大小写、全角/半角，供去重与相似题推荐使用 */
export function normalizeTitle(input: string): string {
  return String(input || '')
    .replace(/[\uFF01-\uFF5E]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/[？?。.,，、；;：:！!…~·"'“”‘’（）()【】[\]<>《》]/g, '')
}

/**
 * 两个标题的字符相似度（0~1，Dice 系数）。
 * MVP 只用来「提示可能重复」，不做自动合并 —— 合并是用户的决定。
 */
export function similarity(a: string, b: string): number {
  const x = normalizeTitle(a)
  const y = normalizeTitle(b)
  if (!x || !y) return 0
  if (x === y) return 1
  const setB = new Set(y.split(''))
  const used = new Set<string>()
  let hit = 0
  for (const ch of x) {
    if (setB.has(ch) && !used.has(ch)) {
      hit += 1
      used.add(ch)
    }
  }
  return (2 * hit) / (new Set(x).size + new Set(y).size)
}

/** 是否包含中日韩字符（用于判断能否按整词做关键词提示） */
export function hasCJK(s: string): boolean {
  return /[\u4e00-\u9fa5]/.test(s)
}

/** 从一段文本里截一个短标题 */
export function toTitle(text: string, max = 28): string {
  const one = String(text || '')
    .replace(/\s+/g, ' ')
    .trim()
  return one.length <= max ? one : `${one.slice(0, max)}…`
}

export const countChars = (s: string | null | undefined): number => String(s || '').length
