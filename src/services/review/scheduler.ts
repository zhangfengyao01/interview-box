import type { MasteryStatus, Question, ReviewResult } from '@/types/models'
import { addDays } from '@/utils/date'

/**
 * MVP 间隔策略（可替换为 SM-2 / FSRS，替换时只改这个文件）：
 * 不会 → learning，1 天
 * 模糊 → fuzzy，3 天
 * 掌握 → mastered，7 天；累计掌握 2 次 14 天，4 次 30 天
 *
 * 为什么不用真正的记忆算法：MVP 阶段样本太少（一个人的题库），
 * 复杂参数没有校准依据，规则越简单越可解释，用户也更容易信任。
 */
export interface ReviewOption {
  key: ReviewResult
  label: string
  status: MasteryStatus
  days: number
  color: string
}

export const REVIEW_RESULTS: ReviewOption[] = [
  { key: 'unknown', label: '不会', status: 'learning', days: 1, color: '#EF4444' },
  { key: 'fuzzy', label: '模糊', status: 'fuzzy', days: 3, color: '#F59E0B' },
  { key: 'mastered', label: '掌握', status: 'mastered', days: 7, color: '#22C55E' }
]

export interface SchedulePatch {
  masteryStatus: MasteryStatus
  nextReviewAt: number
  reviewCount: number
  days: number
}

export function scheduleAfterReview(question: Pick<Question, 'reviewCount'>, result: ReviewResult): SchedulePatch {
  const cfg = REVIEW_RESULTS.find((r) => r.key === result) || REVIEW_RESULTS[1]
  let days = cfg.days
  if (cfg.key === 'mastered') {
    const count = (question.reviewCount || 0) + 1
    if (count >= 4) days = 30
    else if (count >= 2) days = 14
    else days = 7
  }
  return {
    masteryStatus: cfg.status,
    nextReviewAt: addDays(days),
    reviewCount: (question.reviewCount || 0) + 1,
    days
  }
}

export const MASTERY_LABEL: Record<MasteryStatus, string> = {
  new: '未学习',
  learning: '学习中',
  fuzzy: '模糊',
  mastered: '已掌握'
}

export const MASTERY_COLOR: Record<MasteryStatus, string> = {
  new: '#8A8FA3',
  learning: '#5B50F5',
  fuzzy: '#F59E0B',
  mastered: '#22C55E'
}
