import { db } from '@/adapters/database'
import type { WhereClause } from '@/adapters/database/types'
import { columnOf, mapQuestion, mapTag, toRow } from '@/adapters/database/mappers'
import type { CategoryStats, Question, QuestionQuery, QuestionStats, Tag } from '@/types/models'
import { todayStart } from '@/utils/date'
import { similarity } from '@/utils/text'
import { uuid } from '@/utils/id'

/**
 * 题目读写。
 *
 * 三层职责严格分开：
 * - repository：只做「字段 ↔ 行」转换和查询拼装，不含业务判断；
 * - service：去重、拆题、复习排期、批量入库等业务规则；
 * - page：只消费结果，不写 SQL、不碰 snake_case。
 *
 * 所有方法都是 async —— 因为 plus.sqlite 只有异步 API。
 * 不要为了「页面好写」把它包成同步：那样在 APP 上必然拿不到数据。
 */

const NOT_DELETED: WhereClause = { isNull: ['deleted_at'] }

function baseWhere(query: QuestionQuery): WhereClause {
  const where: WhereClause = {}
  if (!query.includeDeleted) where.isNull = ['deleted_at']
  if (query.categoryId) where.eq = { ...(where.eq || {}), category_id: query.categoryId }
  if (query.masteryStatus) where.eq = { ...(where.eq || {}), mastery_status: query.masteryStatus }
  if (typeof query.favorite === 'boolean') {
    where.eq = { ...(where.eq || {}), is_favorite: query.favorite ? 1 : 0 }
  }
  if (query.onlyDue) {
    where.lte = { next_review_at: Date.now() }
    where.notNull = ['next_review_at']
  }
  if (query.keyword) where.like = { title: query.keyword }
  return where
}

const ORDER: Record<NonNullable<QuestionQuery['sort']>, { field: string; desc?: boolean }[]> = {
  updated: [{ field: 'updated_at', desc: true }],
  created: [{ field: 'created_at', desc: true }],
  review: [{ field: 'next_review_at' }],
  favorite: [
    { field: 'is_favorite', desc: true },
    { field: 'updated_at', desc: true }
  ]
}

export const questionRepo = {
  /** 列表：支持关键词 / 分类 / 标签 / 掌握状态 / 收藏 / 到期 */
  async list(query: QuestionQuery = {}): Promise<Question[]> {
    const where = baseWhere(query)

    if (query.tagId) {
      const links = await db().all('question_tags', { eq: { tag_id: query.tagId } })
      const ids = links.map((l) => String(l.question_id))
      if (!ids.length) return []
      where.in = { ...(where.in || {}), id: ids }
    }

    const rows = await db().all('questions', where, ORDER[query.sort || 'updated'], query.limit)
    return rows.map(mapQuestion)
  },

  async get(id: string): Promise<Question | null> {
    const row = await db().first('questions', { eq: { id } })
    return row ? mapQuestion(row) : null
  },

  async count(query: QuestionQuery = {}): Promise<number> {
    return db().count('questions', baseWhere(query))
  },

  async create(input: Partial<Question> & { title: string }): Promise<Question> {
    const t = Date.now()
    const question: Question = {
      id: uuid(),
      title: input.title,
      content: input.content || '',
      referenceAnswer: input.referenceAnswer || '',
      myAnswer: input.myAnswer || '',
      notes: input.notes || '',
      categoryId: input.categoryId ?? null,
      difficulty: input.difficulty ?? 2,
      masteryStatus: input.masteryStatus ?? 'new',
      isFavorite: input.isFavorite ?? false,
      answerOrigin: input.answerOrigin ?? 'manual',
      sourceCompany: input.sourceCompany || '',
      sourceRole: input.sourceRole || '',
      sourceRound: input.sourceRound || '',
      sourceDate: input.sourceDate ?? null,
      nextReviewAt: input.nextReviewAt ?? null,
      reviewCount: input.reviewCount ?? 0,
      createdAt: input.createdAt ?? t,
      updatedAt: t,
      deletedAt: null
    }
    await db().insert('questions', toRow('questions', question))
    return question
  },

  /**
   * 批量创建：**一个事务**。
   * 拆分出 8 道题要么全部入库，要么全都不入，不能存一半 —— 这是批量保存页的底线。
   */
  async bulkCreate(
    items: (Partial<Question> & { title: string })[],
    meta?: { assetId?: string; tags?: Map<number, string[]> }
  ): Promise<Question[]> {
    if (!items.length) return []
    const created: Question[] = []
    await db().transaction(async (tx) => {
      for (let i = 0; i < items.length; i += 1) {
        const input = items[i]
        const t = Date.now()
        const question: Question = {
          id: uuid(),
          title: input.title,
          content: input.content || '',
          referenceAnswer: input.referenceAnswer || '',
          myAnswer: input.myAnswer || '',
          notes: input.notes || '',
          categoryId: input.categoryId ?? null,
          difficulty: input.difficulty ?? 2,
          masteryStatus: input.masteryStatus ?? 'new',
          isFavorite: input.isFavorite ?? false,
          answerOrigin: input.answerOrigin ?? 'manual',
          sourceCompany: input.sourceCompany || '',
          sourceRole: input.sourceRole || '',
          sourceRound: input.sourceRound || '',
          sourceDate: input.sourceDate ?? null,
          nextReviewAt: input.nextReviewAt ?? null,
          reviewCount: input.reviewCount ?? 0,
          createdAt: t,
          updatedAt: t,
          deletedAt: null
        }
        await tx.insert('questions', toRow('questions', question))
        if (meta?.assetId) {
          await tx.insert(
            'question_sources',
            toRow('question_sources', { questionId: question.id, sourceAssetId: meta.assetId })
          )
        }
        const tagIds = meta?.tags?.get(i) || []
        for (const tagId of tagIds) {
          await tx.insert('question_tags', toRow('question_tags', { questionId: question.id, tagId }))
        }
        created.push(question)
      }
    })
    return created
  },

  async update(id: string, patch: Partial<Question>): Promise<Question | null> {
    const row = toRow('questions', { ...patch, updatedAt: Date.now() })
    delete row.id
    await db().update('questions', row, { eq: { id } })
    return this.get(id)
  },

  /** 软删除：复习记录与来源关系保留，便于回溯；导出时可选是否包含 */
  async softDelete(id: string): Promise<void> {
    await db().update('questions', { deleted_at: Date.now(), updated_at: Date.now() }, { eq: { id } })
  },

  /** 相似题推荐：纯字符相似度，MVP 不引入向量检索 */
  async findSimilar(title: string, excludeId?: string, limit = 3, threshold = 0.72): Promise<Question[]> {
    const rows = await db().all('questions', NOT_DELETED)
    return rows
      .map(mapQuestion)
      .filter((q) => q.id !== excludeId)
      .map((q) => ({ q, score: similarity(title, q.title) }))
      .filter((x) => x.score >= threshold)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((x) => x.q)
  },

  /** 标签（读 question_tags + tags 两张表） */
  async tagsOf(questionId: string): Promise<Tag[]> {
    const links = await db().all('question_tags', { eq: { question_id: questionId } })
    const ids = links.map((l) => String(l.tag_id))
    if (!ids.length) return []
    const rows = await db().all('tags', { in: { id: ids } })
    return rows.map(mapTag)
  },

  async recent(limit = 3): Promise<Question[]> {
    return this.list({ sort: 'updated', limit })
  },

  /** 首页统计：为了跨引擎一致，这里用 count() 组合而不是写聚合 SQL */
  async stats(): Promise<QuestionStats> {
    const now = Date.now()
    const total = await db().count('questions', NOT_DELETED)
    const todayNew = await db().count('questions', {
      isNull: ['deleted_at'],
      gte: { created_at: todayStart() }
    })
    const due = await db().count('questions', {
      isNull: ['deleted_at'],
      notNull: ['next_review_at'],
      lte: { next_review_at: now }
    })
    const mastered = await db().count('questions', {
      isNull: ['deleted_at'],
      eq: { mastery_status: 'mastered' }
    })
    const favorite = await db().count('questions', { isNull: ['deleted_at'], eq: { is_favorite: 1 } })
    return {
      total,
      todayNew,
      due,
      mastered,
      masteryRate: total ? Math.round((mastered / total) * 100) : 0,
      favorite
    }
  },

  /** 分类维度：总数 / 已学 / 已掌握 / 进度百分比 */
  async categoryStats(): Promise<CategoryStats[]> {
    const cats = await db().all('categories', {}, [{ field: 'sort_order' }])
    const out: CategoryStats[] = []
    for (const cat of cats) {
      const id = String(cat.id)
      const cTotal = await db().count('questions', { isNull: ['deleted_at'], eq: { category_id: id } })
      const mastered = await db().count('questions', {
        isNull: ['deleted_at'],
        eq: { category_id: id, mastery_status: 'mastered' }
      })
      const learned = await db().count('questions', {
        isNull: ['deleted_at'],
        eq: { category_id: id },
        neq: { mastery_status: 'new' }
      })
      out.push({
        categoryId: id,
        total: cTotal,
        learned,
        mastered,
        /** 该分类的学习进度（已学 / 本类总数），不是占全库比例 */
        percent: cTotal ? Math.round((learned / cTotal) * 100) : 0
      })
    }
    return out
  },

  columnOf: (field: string) => columnOf('questions', field)
}
