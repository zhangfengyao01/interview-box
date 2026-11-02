/**
 * 领域模型（业务层唯一可信结构，camelCase）
 *
 * 字段与 PRD §8 的建表语句**一一对应**，不多不少：
 * - SQL 层 snake_case，往返转换集中在 `adapters/database/mappers.ts`；
 * - 展示样式（分类的图标 / 配色）**不进数据库**，见 `data/category-style.ts`。
 *   理由：schema 是数据契约，换主题不该触发迁移；内置分类样式固定，自定义分类按 id 取色即可。
 */

/** 掌握状态：新题 / 学习中 / 模糊 / 已掌握（PRD §8.3） */
export type MasteryStatus = 'new' | 'learning' | 'fuzzy' | 'mastered'

/** 答案来源：人工 / AI 生成 / AI 生成后人工改过 */
export type AnswerOrigin = 'manual' | 'ai' | 'ai_edited'

/** 自评难度：1 简单、2 中等、3 困难（存 INTEGER，与 PRD 一致） */
export type Difficulty = 1 | 2 | 3

/** 复习自评结果（决定下次间隔） */
export type ReviewResult = 'unknown' | 'fuzzy' | 'mastered'

export interface Category {
  id: string
  name: string
  sortOrder: number
  isBuiltin: boolean
  createdAt: number
  updatedAt: number
}

export interface Question {
  id: string
  title: string
  /** 题目正文/补充说明（粘贴来的原始描述、代码片段等） */
  content: string
  /** 参考答案：AI 只有经用户确认才可写入，见 services/ai */
  referenceAnswer: string
  myAnswer: string
  notes: string
  categoryId: string | null
  difficulty: Difficulty
  masteryStatus: MasteryStatus
  isFavorite: boolean
  answerOrigin: AnswerOrigin
  sourceCompany: string
  sourceRole: string
  sourceRound: string
  /** 面试日期，'YYYY-MM-DD'，可为空 */
  sourceDate: string | null
  nextReviewAt: number | null
  reviewCount: number
  createdAt: number
  updatedAt: number
  /** 软删除时间，null 表示未删除 */
  deletedAt: number | null
}

export interface Tag {
  id: string
  name: string
  color: string
  createdAt: number
}

export interface QuestionTag {
  questionId: string
  tagId: string
}

/** 来源资源：一张图可被多道题引用；一段粘贴文本同理，原始文本要保留 */
export interface SourceAsset {
  id: string
  /** image = 拍照/相册；text = 粘贴文本 */
  sourceType: 'image' | 'text'
  /** 图片在沙箱内的持久路径（经 file adapter 落盘后才有值） */
  filePath: string | null
  /** OCR/粘贴得到的原始文本，**不做修改**（验收要求：原始文本可保留） */
  rawText: string
  /** 用户校对后的文本；为空表示未改过 */
  editedText: string
  ocrEngine: string
  createdAt: number
}

export interface QuestionSource {
  questionId: string
  sourceAssetId: string
}

export interface ReviewLog {
  id: string
  questionId: string
  result: ReviewResult
  reviewedAt: number
  nextReviewAt: number
}

/* ---------- 以下为「算出来的」视图模型，不落库 ---------- */

export interface QuestionStats {
  total: number
  todayNew: number
  due: number
  mastered: number
  masteryRate: number
  favorite: number
}

export interface CategoryStats {
  categoryId: string
  total: number
  learned: number
  mastered: number
  percent: number
}

/** 列表查询条件：页面传业务字段，repository 负责翻译成 SQL 条件 */
export interface QuestionQuery {
  keyword?: string
  categoryId?: string
  tagId?: string
  masteryStatus?: MasteryStatus
  favorite?: boolean
  onlyDue?: boolean
  includeDeleted?: boolean
  sort?: 'updated' | 'created' | 'review' | 'favorite'
  limit?: number
}
