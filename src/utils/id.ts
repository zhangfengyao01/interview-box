/** 生成 UUID（优先运行时能力，回落手写实现） */
export function uuid(): string {
  const c = typeof crypto !== 'undefined' ? crypto : undefined
  if (c && typeof c.randomUUID === 'function') return c.randomUUID()
  const d = Date.now().toString(16)
  const rnd = (): string =>
    Math.floor(Math.random() * 0xffff)
      .toString(16)
      .padStart(4, '0')
  return `${d}-${rnd()}-${rnd()}-${rnd()}-${rnd()}${rnd()}${rnd()}`
}

export const now = (): number => Date.now()
