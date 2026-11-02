import type { ReviewLog, ReviewResult } from './models'

/** 备份文件结构（导出/恢复的唯一格式，带版本号便于向后兼容） */
export const BACKUP_SCHEMA_VERSION = 1

export interface DatabaseDump {
  schemaVersion: number
  exportedAt: number
  app: 'interview-box'
  tables: {
    categories: Record<string, unknown>[]
    questions: Record<string, unknown>[]
    tags: Record<string, unknown>[]
    question_tags: Record<string, unknown>[]
    source_assets: Record<string, unknown>[]
    question_sources: Record<string, unknown>[]
    review_logs: Record<string, unknown>[]
  }
}

export interface BackupPayload extends DatabaseDump {
  /** 文件级校验：条数合计，恢复前先比对，避免半截文件 */
  checksum: string
  counts: Record<string, number>
}

export interface RestoreResult {
  ok: boolean
  mode: 'replace' | 'merge'
  inserted: number
  skipped: number
  message: string
}

export type { ReviewLog, ReviewResult }
