import type { Category } from '@/types/models'

/**
 * 内置分类：与设计稿「我的题库」四个分类一致。
 * 只描述数据（id / 名称 / 排序），展示样式在 `category-style.ts` —— 样式不进数据库。
 */
export const BUILTIN_CATEGORIES: Category[] = [
  { id: 'cat_fe', name: '前端开发', sortOrder: 1, isBuiltin: true, createdAt: 0, updatedAt: 0 },
  { id: 'cat_ai', name: 'AI 大模型', sortOrder: 2, isBuiltin: true, createdAt: 0, updatedAt: 0 },
  { id: 'cat_algo', name: '算法与数据结构', sortOrder: 3, isBuiltin: true, createdAt: 0, updatedAt: 0 },
  { id: 'cat_pm', name: '产品经理', sortOrder: 4, isBuiltin: true, createdAt: 0, updatedAt: 0 },
  { id: 'cat_proj', name: '项目经验', sortOrder: 5, isBuiltin: true, createdAt: 0, updatedAt: 0 }
]
