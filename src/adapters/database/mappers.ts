import type { Row, SqlValue, TableName } from './types'
import type {
  Category,
  Difficulty,
  MasteryStatus,
  AnswerOrigin,
  Question,
  ReviewLog,
  ReviewResult,
  SourceAsset,
  Tag
} from '@/types/models'

/**
 * 模型 ↔ 数据行的唯一转换点。
 *
 * 为什么集中在这里：SQL 是 snake_case、业务是 camelCase，如果让每个 repository
 * 自己写映射，字段一改就会漏；集中一份表，加字段只改这里。
 */

type FieldMap = Record<string, string>

const CATEGORY: FieldMap = {
  id: 'id',
  name: 'name',
  sortOrder: 'sort_order',
  isBuiltin: 'is_builtin',
  createdAt: 'created_at',
  updatedAt: 'updated_at'
}

const QUESTION: FieldMap = {
  id: 'id',
  title: 'title',
  content: 'content',
  referenceAnswer: 'reference_answer',
  myAnswer: 'my_answer',
  notes: 'notes',
  categoryId: 'category_id',
  difficulty: 'difficulty',
  masteryStatus: 'mastery_status',
  isFavorite: 'is_favorite',
  answerOrigin: 'answer_origin',
  sourceCompany: 'source_company',
  sourceRole: 'source_role',
  sourceRound: 'source_round',
  sourceDate: 'source_date',
  nextReviewAt: 'next_review_at',
  reviewCount: 'review_count',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  deletedAt: 'deleted_at'
}

const TAG: FieldMap = { id: 'id', name: 'name', color: 'color', createdAt: 'created_at' }

const QUESTION_TAG: FieldMap = { questionId: 'question_id', tagId: 'tag_id' }

const ASSET: FieldMap = {
  id: 'id',
  sourceType: 'source_type',
  filePath: 'file_path',
  rawText: 'raw_text',
  editedText: 'edited_text',
  ocrEngine: 'ocr_engine',
  createdAt: 'created_at'
}

const QUESTION_SOURCE: FieldMap = { questionId: 'question_id', sourceAssetId: 'source_asset_id' }

const REVIEW_LOG: FieldMap = {
  id: 'id',
  questionId: 'question_id',
  result: 'result',
  reviewedAt: 'reviewed_at',
  nextReviewAt: 'next_review_at'
}

const MAPS: Record<TableName, FieldMap> = {
  categories: CATEGORY,
  questions: QUESTION,
  tags: TAG,
  question_tags: QUESTION_TAG,
  source_assets: ASSET,
  question_sources: QUESTION_SOURCE,
  review_logs: REVIEW_LOG
}

const BOOLEAN_FIELDS = new Set(['isBuiltin', 'isFavorite'])

/**
 * 模型字段值 → 可绑定的 SQL 值。
 *
 * 注意入参是**单个字段值**而不是整个模型：布尔转 0/1，undefined 归一成 NULL，
 * 其余值原样下沉。plus.sqlite 没有参数绑定，值最终会被 sqlLit() 转成字面量。
 */
function toSql(value: unknown): SqlValue {
  if (typeof value === 'boolean') return value ? 1 : 0
  if (value === undefined || value === null) return null
  if (typeof value === 'number' || typeof value === 'string') return value
  // 对象/数组字段（目前没有）兜底序列化，避免静默写入 "[object Object]"
  return JSON.stringify(value)
}

/** 模型对象 → 数据库行（用于 insert/update 的 patch） */
export function toRow<T extends object>(table: TableName, model: T): Row {
  const map = MAPS[table]
  const source = model as Record<string, unknown>
  const row: Row = {}
  for (const [key, column] of Object.entries(map)) {
    if (!(key in source)) continue
    row[column] = toSql(source[key])
  }
  return row
}

/** 数据库行 → 模型对象（布尔还原、缺列补默认值） */
export function fromRow<T>(table: TableName, row: Row): T {
  const map = MAPS[table]
  const out: Record<string, unknown> = {}
  for (const [key, column] of Object.entries(map)) {
    const value = row[column]
    out[key] = BOOLEAN_FIELDS.has(key) ? Number(value) === 1 : value === undefined ? null : value
  }
  return out as T
}

export const mapCategory = (row: Row): Category => fromRow<Category>('categories', row)
export const mapQuestion = (row: Row): Question => {
  const q = fromRow<Question>('questions', row)
  return {
    ...q,
    difficulty: (Number(q.difficulty) || 2) as Difficulty,
    masteryStatus: (q.masteryStatus || 'new') as MasteryStatus,
    answerOrigin: (q.answerOrigin || 'manual') as AnswerOrigin
  }
}
export const mapTag = (row: Row): Tag => fromRow<Tag>('tags', row)
export const mapAsset = (row: Row): SourceAsset => {
  const a = fromRow<SourceAsset>('source_assets', row)
  return { ...a, sourceType: (a.sourceType || 'image') as SourceAsset['sourceType'] }
}
export const mapReviewLog = (row: Row): ReviewLog => {
  const log = fromRow<ReviewLog>('review_logs', row)
  return { ...log, result: (log.result || 'fuzzy') as ReviewResult }
}

/** 查询条件用模型字段名书写，这里翻译成列名（避免页面记 snake_case） */
export function columnOf(table: TableName, field: string): string {
  return MAPS[table][field] || field
}
