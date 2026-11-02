import { db } from '@/adapters/database'
import { mapQuestion, mapReviewLog, toRow } from '@/adapters/database/mappers'
import type { Question, ReviewLog, ReviewResult } from '@/types/models'
import { DAY_MS, todayStart } from '@/utils/date'
import { uuid } from '@/utils/id'

/**
 * 复习数据的读写。
 *
 * 这里只管「落库」，间隔怎么算在 `services/review/scheduler.ts`。
 * 分开的原因：排期规则将来可能换成 SM-2/FSRS，换算法不该动表结构。
 */
export const reviewRepo = {
  /** 到期待复习（next_review_at <= now），按到期时间升序 */
  async due(limit = 50): Promise<Question[]> {
    const rows = await db().all(
      'questions',
      { isNull: ['deleted_at'], notNull: ['next_review_at'], lte: { next_review_at: Date.now() } },
      [{ field: 'next_review_at' }],
      limit
    )
    return rows.map(mapQuestion)
  },

  /** 未来要复习的（用于「复习计划」列表展示 3天后 / 7天后） */
  async upcoming(limit = 20): Promise<Question[]> {
    const rows = await db().all(
      'questions',
      { isNull: ['deleted_at'], notNull: ['next_review_at'], gte: { next_review_at: Date.now() } },
      [{ field: 'next_review_at' }],
      limit
    )
    return rows.map(mapQuestion)
  },

  async log(questionId: string, result: ReviewResult, nextReviewAt: number): Promise<ReviewLog> {
    const log: ReviewLog = {
      id: uuid(),
      questionId,
      result,
      reviewedAt: Date.now(),
      nextReviewAt
    }
    await db().insert('review_logs', toRow('review_logs', log))
    return log
  },

  async logsOf(questionId: string): Promise<ReviewLog[]> {
    const rows = await db().all(
      'review_logs',
      { eq: { question_id: questionId } },
      [{ field: 'reviewed_at', desc: true }]
    )
    return rows.map(mapReviewLog)
  },

  /** 今日已复习题目数（统计卡片用） */
  async todayCount(): Promise<number> {
    return db().count('review_logs', { gte: { reviewed_at: todayStart() } })
  },

  /**
   * 连续学习天数：从今天往前数，哪天没有复习记录就停。
   * 今天还没复习不算断签（返回从昨天开始的天数），这是打卡类产品的一般处理。
   */
  async streak(): Promise<number> {
    const rows = await db().all('review_logs', {}, [{ field: 'reviewed_at', desc: true }])
    if (!rows.length) return 0
    const days = new Set(rows.map((r) => todayStart(Number(r.reviewed_at))))
    let count = 0
    let cursor = todayStart()
    if (!days.has(cursor)) cursor -= DAY_MS
    while (days.has(cursor)) {
      count += 1
      cursor -= DAY_MS
    }
    return count
  }
}

/** 最近的学习记录（跨题目，用于「最近学习记录」弹窗） */
export async function recentReviewLogs(limit = 5): Promise<ReviewLog[]> {
  const rows = await db().all('review_logs', {}, [{ field: 'reviewed_at', desc: true }], limit)
  return rows.map(mapReviewLog)
}
