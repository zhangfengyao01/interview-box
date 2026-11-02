import { db } from '@/adapters/database'
import { TABLES } from '@/adapters/database/types'
import { LATEST_VERSION } from '@/adapters/database/schema'
import type { BackupPayload, DatabaseDump, RestoreResult } from '@/types/db'
import { BACKUP_SCHEMA_VERSION } from '@/types/db'
import { formatDateTime } from '@/utils/date'

/**
 * 备份 / 恢复 / 导出。
 *
 * 备份文件是**纯 JSON**，不是 SQLite 文件：跨引擎可读（APP 导出 → H5 导入验证），
 * 也避免把用户设备上的数据库二进制格式当成契约。
 *
 * 两种恢复语义：
 * - replace：整库覆盖（换机、重置后恢复用）；
 * - merge：按主键合并，已存在的记录跳过，**绝不覆盖用户新写的内容**。
 */

function countsOf(dump: DatabaseDump): Record<string, number> {
  const counts: Record<string, number> = {}
  TABLES.forEach((t) => {
    counts[t] = dump.tables[t] ? dump.tables[t].length : 0
  })
  return counts
}

function checksumOf(counts: Record<string, number>): string {
  return Object.keys(counts)
    .sort()
    .map((k) => `${k}:${counts[k]}`)
    .join('|')
}

export const backupService = {
  async exportPayload(): Promise<BackupPayload> {
    const dump = await db().dump()
    const counts = countsOf(dump)
    return {
      ...dump,
      app: 'interview-box',
      counts,
      checksum: checksumOf(counts)
    }
  },

  async exportText(): Promise<string> {
    const payload = await this.exportPayload()
    return JSON.stringify(payload, null, 2)
  },

  /** 备份文件名：带时间，方便用户自己排序 */
  fileName(): string {
    return `interview-box-backup-${formatDateTime(Date.now()).replace(/[: ]/g, '-')}.json`
  },

  validate(text: string | BackupPayload): { ok: boolean; message: string; payload?: BackupPayload } {
    let payload: BackupPayload
    try {
      payload = typeof text === 'string' ? (JSON.parse(text) as BackupPayload) : text
    } catch {
      return { ok: false, message: 'JSON 解析失败，文件可能不完整' }
    }
    if (!payload || payload.app !== 'interview-box' || !payload.tables) {
      return { ok: false, message: '不是面试题匣的备份文件' }
    }
    if (!payload.schemaVersion || payload.schemaVersion > LATEST_VERSION) {
      return {
        ok: false,
        message: `备份版本 ${payload.schemaVersion} 高于当前支持的版本 ${LATEST_VERSION}`
      }
    }
    if (!Array.isArray(payload.tables.questions)) {
      return { ok: false, message: '备份内容缺少题目数据' }
    }
    if (payload.counts && payload.checksum && checksumOf(payload.counts) !== payload.checksum) {
      return { ok: false, message: '备份文件校验失败（条数不一致），建议重新导出' }
    }
    return { ok: true, message: '', payload }
  },

  async restore(text: string | BackupPayload, mode: 'replace' | 'merge' = 'replace'): Promise<RestoreResult> {
    const check = this.validate(text)
    if (!check.ok || !check.payload) {
      return { ok: false, mode, inserted: 0, skipped: 0, message: check.message }
    }
    const incoming = check.payload

    if (mode === 'replace') {
      await db().restore(incoming)
      return {
        ok: true,
        mode,
        inserted: incoming.tables.questions.length,
        skipped: 0,
        message: `已覆盖恢复：${incoming.tables.questions.length} 道题目`
      }
    }

    // merge：按主键合并，已存在则跳过
    let inserted = 0
    let skipped = 0
    await db().transaction(async (tx) => {
      for (const table of TABLES) {
        const rows = incoming.tables[table] || []
        if (!rows.length) continue
        const existing = await tx.all(table)
        const idKey = table === 'question_tags' || table === 'question_sources' ? null : 'id'
        const seen = new Set(
          existing.map((r) =>
            idKey ? String(r[idKey]) : `${String(r.question_id)}::${String(r.tag_id ?? r.source_asset_id)}`
          )
        )
        for (const row of rows) {
          const key = idKey
            ? String((row as Record<string, unknown>)[idKey])
            : `${String((row as Record<string, unknown>).question_id)}::${String(
                (row as Record<string, unknown>).tag_id ?? (row as Record<string, unknown>).source_asset_id
              )}`
          if (seen.has(key)) {
            skipped += 1
            continue
          }
          await tx.insert(table, row as never)
          seen.add(key)
          if (table === 'questions') inserted += 1
        }
      }
    })

    return {
      ok: true,
      mode,
      inserted,
      skipped,
      message: `合并完成：新增 ${inserted} 道题，跳过 ${skipped} 条重复`
    }
  },

  /** 清空全部数据（保留 schema，不重装应用） */
  async clearAll(): Promise<void> {
    await db().reset()
  },

  async stats(): Promise<{ questions: number; categories: number; tags: number; logs: number; version: number }> {
    const [questions, categories, tags, logs] = await Promise.all([
      db().count('questions'),
      db().count('categories'),
      db().count('tags'),
      db().count('review_logs')
    ])
    return { questions, categories, tags, logs, version: BACKUP_SCHEMA_VERSION }
  }
}
