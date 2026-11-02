export interface CategoryStyle {
  icon: string
  color: string
  bg: string
}

/**
 * 分类的展示样式表（图标 / 主色 / 底色）。
 *
 * 为什么不放进 categories 表：schema 是数据契约，换主题、换图标不该触发数据库迁移；
 * 而且分类一旦允许用户改名，样式跟着 id 走比跟着 name 走更稳。
 * 代价是「用户在设置页自定义分类颜色」做不了 —— MVP 阶段不值得为它加两列。
 */
export const CATEGORY_STYLE: Record<string, CategoryStyle> = {
  cat_fe: { icon: 'code', color: '#F0A03C', bg: '#FDF1DE' },
  cat_algo: { icon: 'nodes', color: '#34C77B', bg: '#E6F7ED' },
  cat_pm: { icon: 'briefcase', color: '#FF7A45', bg: '#FFEDE5' },
  cat_proj: { icon: 'layers', color: '#34C77B', bg: '#E6F7ED' }
}

/** 自定义分类的兜底配色：按 id 哈希取色，保证同一个分类颜色稳定 */
const FALLBACK: CategoryStyle[] = [
  { icon: 'book', color: '#5B50F5', bg: '#EFECFF' },
  { icon: 'nodes', color: '#F59E0B', bg: '#FFF4E0' },
  { icon: 'briefcase', color: '#10B981', bg: '#E7F9F1' },
  { icon: 'layers', color: '#3B82F6', bg: '#E8F1FF' },
  { icon: 'sparkle', color: '#EC4899', bg: '#FDECF4' },
  { icon: 'code', color: '#8B5CF6', bg: '#F3EEFF' }
]

export function categoryStyle(id: string | null | undefined): CategoryStyle {
  if (!id) return FALLBACK[0]
  if (CATEGORY_STYLE[id]) return CATEGORY_STYLE[id]
  let hash = 0
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) % 997
  return FALLBACK[hash % FALLBACK.length]
}
