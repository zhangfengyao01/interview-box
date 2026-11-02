/**
 * AI 答案助手契约 —— 采用 PRD §5 的接口，并补上「草稿 → 用户确认」的状态机。
 *
 * 硬约束（PRD 明文要求）：
 * 1. AI 生成的内容只能落成草稿（`AiAnswerDraft`），**不允许直接覆盖已有参考答案**；
 * 2. 用户点确认后，才写回 questions.reference_answer，并把 answer_origin 记为 ai / ai_edited；
 * 3. 没有网络或没配 Key 时，手动录入全链路可用，AI 只是可选增强。
 */

export type AnswerStyle = 'interview' | 'detailed' | 'project'

export interface AnswerRequest {
  question: string
  category: string
  difficulty: 'easy' | 'medium' | 'hard'
  style: AnswerStyle
}

/** 统一五段式答案（PRD §5） */
export interface AnswerResult {
  answerMarkdown: string
  followUps: string[]
}

/** 草稿：AI 返回后先进这里，UI 展示、用户可编辑、确认才落库 */
export interface AiAnswerDraft {
  questionId: string
  result: AnswerResult
  /** 生成时的请求参数，便于复现与排查 */
  request: AnswerRequest
  provider: string
  createdAt: number
  /** 是否已被采纳，采纳后转为正式答案 */
  accepted: boolean
}

export interface AiAdapter {
  readonly provider: string
  isConfigured(): boolean
  generateAnswer(request: AnswerRequest): Promise<AnswerResult>
}
