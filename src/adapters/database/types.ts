import type { DatabaseDump } from '@/types/db'

/** SQL 值：只允许标量，布尔在落库前转 0/1 */
export type SqlValue = string | number | null
export type Row = Record<string, SqlValue>

export type TableName =
  | 'categories'
  | 'questions'
  | 'tags'
  | 'question_tags'
  | 'source_assets'
  | 'question_sources'
  | 'review_logs'

export const TABLES: TableName[] = [
  'categories',
  'questions',
  'tags',
  'question_tags',
  'source_assets',
  'question_sources',
  'review_logs'
]

/**
 * 条件子句：只提供业务真正需要的几种比较，
 * 目的是让 SQLite 与 storage 两种实现能用同一套语义 —— 不追求做成 ORM。
 */
export interface WhereClause {
  eq?: Record<string, SqlValue>
  neq?: Record<string, SqlValue>
  /** 模糊匹配，值里不用带 % ，适配器自己加 */
  like?: Record<string, string>
  in?: Record<string, SqlValue[]>
  isNull?: string[]
  notNull?: string[]
  gte?: Record<string, SqlValue>
  lte?: Record<string, SqlValue>
}

export interface OrderSpec {
  field: string
  desc?: boolean
}

/**
 * 数据访问契约。
 *
 * 两个实现：
 * - `sqlite`  ：APP 端 plus.sqlite，主力方案（PRD §3.1）；
 * - `storage` ：H5 / 微信小程序 / 无 plus 环境的降级实现，全量 JSON 快照。
 *
 * ⚠️ 字段名一律 snake_case（= 数据库列名），camelCase 转换在 repositories 层做。
 */
export interface DatabaseAdapter {
  readonly kind: 'sqlite' | 'storage'

  init(): Promise<void>

  all(table: TableName, where?: WhereClause, order?: OrderSpec[], limit?: number): Promise<Row[]>
  first(table: TableName, where?: WhereClause, order?: OrderSpec[]): Promise<Row | null>
  count(table: TableName, where?: WhereClause): Promise<number>

  insert(table: TableName, row: Row): Promise<void>
  insertMany(table: TableName, rows: Row[]): Promise<void>
  update(table: TableName, patch: Row, where: WhereClause): Promise<void>
  remove(table: TableName, where: WhereClause): Promise<void>

  /**
   * 事务：sqlite 用 BEGIN/COMMIT/ROLLBACK，storage 用「快照 + 回滚」。
   * 「一次批量保存 = 一个事务」是 PRD 的隐含要求（拆 8 题不能存一半）。
   */
  transaction<T>(fn: (db: DatabaseAdapter) => Promise<T>): Promise<T>

  reset(): Promise<void>
  dump(): Promise<DatabaseDump>
  restore(dump: DatabaseDump): Promise<void>
  schemaVersion(): Promise<number>
}
