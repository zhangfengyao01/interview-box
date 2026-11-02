import { db } from '@/adapters/database'
import { mapCategory, mapTag, toRow } from '@/adapters/database/mappers'
import type { Category, Tag } from '@/types/models'
import { uuid } from '@/utils/id'

export const categoryRepo = {
  async list(): Promise<Category[]> {
    const rows = await db().all('categories', {}, [{ field: 'sort_order' }])
    return rows.map(mapCategory)
  },

  async get(id: string): Promise<Category | null> {
    const row = await db().first('categories', { eq: { id } })
    return row ? mapCategory(row) : null
  },

  /** 分类名映射，列表页一次取完，避免 N+1 */
  async nameMap(): Promise<Record<string, string>> {
    const list = await this.list()
    const map: Record<string, string> = {}
    list.forEach((c) => {
      map[c.id] = c.name
    })
    return map
  },

  async create(name: string): Promise<Category> {
    const t = Date.now()
    const maxSort = await db().all('categories', {}, [{ field: 'sort_order', desc: true }], 1)
    const category: Category = {
      id: uuid(),
      name: name.trim(),
      sortOrder: Number(maxSort[0]?.sort_order || 0) + 1,
      isBuiltin: false,
      createdAt: t,
      updatedAt: t
    }
    await db().insert('categories', toRow('categories', category))
    return category
  },

  async remove(id: string): Promise<void> {
    // 分类删除后题目不删，只把 category_id 置空（FK ON DELETE SET NULL 之外再兜一层）
    await db().update('questions', { category_id: null }, { eq: { category_id: id } })
    await db().remove('categories', { eq: { id } })
  }
}

export const tagRepo = {
  async list(): Promise<Tag[]> {
    const rows = await db().all('tags', {}, [{ field: 'name' }])
    return rows.map(mapTag)
  },

  async counts(): Promise<Record<string, number>> {
    const links = await db().all('question_tags')
    const map: Record<string, number> = {}
    links.forEach((l) => {
      const id = String(l.tag_id)
      map[id] = (map[id] || 0) + 1
    })
    return map
  },

  async ofQuestion(questionId: string): Promise<Tag[]> {
    const links = await db().all('question_tags', { eq: { question_id: questionId } })
    const ids = links.map((l) => String(l.tag_id))
    if (!ids.length) return []
    const rows = await db().all('tags', { in: { id: ids } })
    return rows.map(mapTag)
  },

  /** 按名字取，没有就建：录入时用户随手打的标签不该阻塞保存 */
  async ensure(name: string): Promise<Tag> {
    const clean = name.trim()
    const existing = await db().first('tags', { eq: { name: clean } })
    if (existing) return mapTag(existing)
    const tag: Tag = { id: uuid(), name: clean, color: '#8B7CFF', createdAt: Date.now() }
    await db().insert('tags', toRow('tags', tag))
    return tag
  },

  async setForQuestion(questionId: string, tagIds: string[]): Promise<void> {
    await db().transaction(async (tx) => {
      await tx.remove('question_tags', { eq: { question_id: questionId } })
      if (!tagIds.length) return
      await tx.insertMany(
        'question_tags',
        tagIds.map((tagId) => toRow('question_tags', { questionId, tagId }))
      )
    })
  }
}
