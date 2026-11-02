import type { Question, QuestionStats, SourceAsset, Tag } from '@/types/models'
import { questionRepo } from '@/repositories/question'
import { tagRepo } from '@/repositories/category'
import { sourceRepo } from '@/repositories/source'
import { db } from '@/adapters/database'
import { similarity } from '@/utils/text'

/**
 * 题目业务：录入 / 编辑 / 去重提示 / 批量入库。
 *
 * 与 repository 的分界：这里开始有「规则」——
 * 标签要按名字复用、批量保存要一个事务、入库前要给出重复提示。
 */

export interface QuestionInput {
  title: string
  content?: string
  referenceAnswer?: string
  myAnswer?: string
  notes?: string
  categoryId?: string | null
  difficulty?: 1 | 2 | 3
  masteryStatus?: Question['masteryStatus']
  /** 标签用名字传，内部负责 ensure + 关联 */
  tags?: string[]
}

export interface DuplicateHit {
  id: string
  title: string
  score: number
}

export const questionService = {
  async detail(id: string): Promise<{
    question: Question | null
    tags: Tag[]
    similar: Question[]
    sources: SourceAsset[]
  }> {
    const question = await questionRepo.get(id)
    if (!question) return { question: null, tags: [], similar: [], sources: [] }
    const [tags, similar, sources] = await Promise.all([
      tagRepo.ofQuestion(id),
      questionRepo.findSimilar(question.title, id, 3),
      sourceRepo.ofQuestion(id)
    ])
    return { question, tags, similar, sources }
  },

  /** 保存（新建或更新）。tags 传名字数组，空数组表示清空标签 */
  async save(input: QuestionInput, id?: string): Promise<Question> {
    const tagIds = await this.ensureTags(input.tags || [])

    let question: Question
    if (id) {
      question = (await questionRepo.update(id, {
        title: input.title,
        content: input.content ?? '',
        referenceAnswer: input.referenceAnswer ?? '',
        myAnswer: input.myAnswer ?? '',
        notes: input.notes ?? '',
        categoryId: input.categoryId ?? null,
        difficulty: input.difficulty ?? 2,
        masteryStatus: input.masteryStatus ?? 'new'
      })) as Question
    } else {
      question = await questionRepo.create({
        title: input.title,
        content: input.content,
        referenceAnswer: input.referenceAnswer,
        myAnswer: input.myAnswer,
        notes: input.notes,
        categoryId: input.categoryId ?? null,
        difficulty: input.difficulty ?? 2,
        masteryStatus: input.masteryStatus ?? 'new'
      })
    }

    await tagRepo.setForQuestion(question.id, tagIds)
    return question
  },

  /** 标签名 → id，缺的顺手建（用户随手打的标签不该拦住保存） */
  async ensureTags(names: string[]): Promise<string[]> {
    const ids: string[] = []
    for (const name of names) {
      const clean = name.trim()
      if (!clean) continue
      const tag = await tagRepo.ensure(clean)
      ids.push(tag.id)
    }
    return ids
  },

  /**
   * 批量入库（识别结果页 → 确认页的终点）。
   *
   * - 一整个事务：8 道题不会存一半；
   * - 同时写 question_sources：多题同图的关系在这里落地；
   * - 标签先 ensure 再入库，避免事务里反复写 tags 表。
   */
  async saveBatch(
    items: QuestionInput[],
    options: { assetId?: string } = {}
  ): Promise<{ created: number; questionIds: string[] }> {
    if (!items.length) return { created: 0, questionIds: [] }

    const tagIdMatrix = new Map<number, string[]>()
    for (let i = 0; i < items.length; i += 1) {
      tagIdMatrix.set(i, await this.ensureTags(items[i].tags || []))
    }

    const created = await questionRepo.bulkCreate(
      items.map((item) => ({
        title: item.title,
        content: item.content,
        referenceAnswer: item.referenceAnswer,
        myAnswer: item.myAnswer,
        notes: item.notes,
        categoryId: item.categoryId ?? null,
        difficulty: item.difficulty ?? 2,
        masteryStatus: item.masteryStatus ?? ('new' as const)
      })),
      { assetId: options.assetId, tags: tagIdMatrix }
    )

    return { created: created.length, questionIds: created.map((q) => q.id) }
  },

  async remove(id: string): Promise<void> {
    await questionRepo.softDelete(id)
  },

  async toggleFavorite(id: string): Promise<Question | null> {
    const q = await questionRepo.get(id)
    if (!q) return null
    return questionRepo.update(id, { isFavorite: !q.isFavorite })
  },

  async stats(): Promise<QuestionStats> {
    return questionRepo.stats()
  },

  /** 编辑页的重复提示：只提示，不阻断（用户可能就是要录一个相似的变体） */
  async duplicates(title: string, excludeId?: string): Promise<DuplicateHit[]> {
    const rows = await db().all('questions', { isNull: ['deleted_at'] })
    return rows
      .filter((r) => String(r.id) !== excludeId)
      .map((r) => ({ row: r, score: similarity(title, String(r.title || '')) }))
      .filter((x) => x.score >= 0.72)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((x) => ({
        score: x.score,
        title: String(x.row.title || ''),
        id: String(x.row.id)
      }))
  }
}
