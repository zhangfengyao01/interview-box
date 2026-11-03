import type { AiAnswerDraft, AnswerRequest, AnswerResult, AnswerStyle } from '@/types/ai'
import type { Question } from '@/types/models'
import { networkAdapter, errorMessage } from '@/adapters/network'
import { questionRepo } from '@/repositories/question'

/**
 * AI 答案助手。
 *
 * 三条不可让步的规则（PRD §5）：
 * 1. AI 产出**只能是草稿**，不落库、不覆盖；
 * 2. 用户点「采用」才写 reference_answer，并记 answer_origin；
 * 3. 已有参考答案时，采用前必须显式确认「覆盖」—— 默认追加/另存都不做，交给用户决定。
 *
 * 没有网络 / 没配代理时不报错崩掉，只返回可读提示，手动录入链路不受影响。
 */

export const AI_STYLE_LABEL: Record<AnswerStyle, string> = {
  interview: '面试口述版',
  detailed: '系统详解版',
  project: '项目结合版'
}

/** 五段式结构，用于校验代理返回是否符合预期（不合规就提示用户，而不是糊弄保存） */
export const ANSWER_SECTIONS = [
  '面试时可以直接回答的内容',
  '核心原理',
  '必要的代码示例',
  '常见问题和容易踩的坑',
  '面试官可能追问的问题'
] as const

export function buildRequest(
  question: Question,
  categoryName: string,
  style: AnswerStyle = 'interview'
): AnswerRequest {
  return {
    question: question.title,
    category: categoryName,
    difficulty: question.difficulty === 1 ? 'easy' : question.difficulty === 3 ? 'hard' : 'medium',
    style
  }
}

interface AiProxyResponse {
  answerMarkdown?: string
  followUps?: string[]
}

function validate(data: AiProxyResponse): AnswerResult {
  const answerMarkdown = String(data.answerMarkdown || '').trim()
  if (!answerMarkdown) throw { code: 'AI_EMPTY', message: '模型没有返回内容，请重试' }
  return {
    answerMarkdown,
    followUps: Array.isArray(data.followUps) ? data.followUps.filter(Boolean).slice(0, 8) : []
  }
}

export const aiService = {
  isConfigured(settings: { aiEnabled: boolean; aiEndpoint: string }): boolean {
    return settings.aiEnabled && !!settings.aiEndpoint
  },

  /**
   * 生成草稿。返回值**不写库**，由页面展示、用户编辑后再 `acceptDraft`。
   */
  async generate(
    request: AnswerRequest,
    settings: { aiEnabled: boolean; aiEndpoint: string; aiToken?: string; questionId: string }
  ): Promise<AiAnswerDraft> {
    if (!this.isConfigured(settings)) {
      throw { code: 'AI_NOT_CONFIGURED', message: '未开启 AI 助手或未配置代理地址（设置 → 云端能力）' }
    }
    try {
      const data = await networkAdapter.postJson<AiProxyResponse>(
        settings.aiEndpoint,
        '/api/ai/answer',
        { ...request, sections: ANSWER_SECTIONS },
        { timeout: 45000, token: settings.aiToken || '' }
      )
      return {
        questionId: settings.questionId,
        result: validate(data),
        request,
        provider: 'proxy',
        createdAt: Date.now(),
        accepted: false
      }
    } catch (err) {
      if (err && typeof err === 'object' && 'code' in err) throw err
      throw { code: 'AI_FAILED', message: errorMessage(err) }
    }
  },

  /**
   * 采用草稿：唯一会写 reference_answer 的入口。
   *
   * @param editedText 用户在草稿上改过的文本；与草稿原文不同则记 ai_edited
   * @param overwrite  已有参考答案时必须显式传 true（页面负责二次确认）
   */
  async acceptDraft(
    draft: AiAnswerDraft,
    options: { editedText?: string; overwrite?: boolean }
  ): Promise<{ ok: boolean; reason?: string }> {
    const question = await questionRepo.get(draft.questionId)
    if (!question) return { ok: false, reason: '题目不存在或已被删除' }

    const text = (options.editedText ?? draft.result.answerMarkdown).trim()
    if (!text) return { ok: false, reason: '答案为空' }

    if (question.referenceAnswer.trim() && !options.overwrite) {
      return { ok: false, reason: '已有参考答案，需要用户确认才能覆盖' }
    }

    const edited = text !== draft.result.answerMarkdown.trim()
    await questionRepo.update(draft.questionId, {
      referenceAnswer: text,
      answerOrigin: edited ? 'ai_edited' : 'ai'
    })
    return { ok: true }
  }
}
