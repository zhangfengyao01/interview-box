import type { Question, ReviewLog, ReviewResult } from '@/types/models'
import { questionRepo } from '@/repositories/question'
import { reviewRepo } from '@/repositories/review'
import { scheduleAfterReview } from './scheduler'

/**
 * 复习业务：把「自评 → 排期 → 记录」串成一个事务性动作。
 *
 * 顺序很重要：先写 review_logs 再更新题目。反过来一旦更新成功、日志失败，
 * 就会出现「题已排期但没有学习记录」的脏状态，连续天数也会算错。
 */
export const reviewService = {
  async applyReview(
    questionId: string,
    result: ReviewResult
  ): Promise<{ ok: boolean; question?: Question; log?: ReviewLog; reason?: string }> {
    const question = await questionRepo.get(questionId)
    if (!question) return { ok: false, reason: '题目不存在' }

    const patch = scheduleAfterReview(question, result)

    const log = await reviewRepo.log(questionId, result, patch.nextReviewAt)
    const updated = await questionRepo.update(questionId, {
      masteryStatus: patch.masteryStatus,
      nextReviewAt: patch.nextReviewAt,
      reviewCount: patch.reviewCount
    })

    return { ok: true, question: updated || undefined, log }
  },

  /** 复习计划页：到期的排前面，再排未来 30 天内的 */
  async plan(limit = 10): Promise<Question[]> {
    const due = await reviewRepo.due(limit)
    if (due.length >= limit) return due
    const upcoming = await reviewRepo.upcoming(limit - due.length)
    return due.concat(upcoming)
  },

  async todayCount(): Promise<number> {
    return reviewRepo.todayCount()
  },

  async streak(): Promise<number> {
    return reviewRepo.streak()
  },

  /**
   * 学习会话取题：顺序 = 最新优先，随机 = 洗牌。
   * 随机用 Fisher-Yates，不用 sort(() => Math.random() - 0.5)（分布不均且引擎实现有差异）。
   */
  async sessionQuestions(mode: 'sequence' | 'random', limit = 20): Promise<Question[]> {
    const list = await questionRepo.list({ sort: 'updated', limit: 200 })
    if (mode === 'sequence') return list.slice(0, limit)
    const arr = [...list]
    for (let i = arr.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1))
      const tmp = arr[i]
      arr[i] = arr[j]
      arr[j] = tmp
    }
    return arr.slice(0, limit)
  }
}
