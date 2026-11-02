export const DAY_MS = 24 * 60 * 60 * 1000

export function todayStart(ts: number = Date.now()): number {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

export function addDays(days: number, from: number = Date.now()): number {
  return from + days * DAY_MS
}

/** 今天 / 明天 / 3天后 / 未安排 */
export function reviewLabel(ts: number | null): string {
  if (!ts) return '未安排'
  const days = Math.round((ts - todayStart()) / DAY_MS)
  if (days <= 0) return '今天'
  if (days === 1) return '明天'
  return `${days}天后`
}

/** 刚刚 / 2小时前 / 昨天 / 3天前 / 2026-10-12 */
export function fromNow(ts: number | null): string {
  if (!ts) return ''
  const diff = Date.now() - ts
  if (diff < 60 * 1000) return '刚刚'
  if (diff < 60 * 60 * 1000) return `${Math.floor(diff / 60000)}分钟前`
  if (diff < DAY_MS) return `${Math.floor(diff / 3600000)}小时前`
  const days = Math.floor(diff / DAY_MS)
  if (days === 1) return '昨天'
  if (days < 7) return `${days}天前`
  return formatDate(ts)
}

const pad = (n: number): string => String(n).padStart(2, '0')

export function formatDate(ts: number | null): string {
  if (!ts) return ''
  const d = new Date(ts)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function formatDateTime(ts: number | null): string {
  if (!ts) return ''
  const d = new Date(ts)
  return `${formatDate(ts)} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function isToday(ts: number): boolean {
  return todayStart(ts) === todayStart()
}
