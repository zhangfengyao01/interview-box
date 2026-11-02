import type { DatabaseAdapter, OrderSpec, Row, SqlValue, TableName, WhereClause } from './types'
import { TABLES } from './types'
import type { DatabaseDump } from '@/types/db'
import { BACKUP_SCHEMA_VERSION } from '@/types/db'
import { BOOTSTRAP, DB_NAME, DB_PATH, MIGRATIONS } from './schema'

/**
 * APP 端主力实现：HTML5+ `plus.sqlite`（PRD §3.1）。
 *
 * 三个必须知道的实现约束：
 * 1. **没有参数绑定**（`executeSql` 只吃 SQL 字符串）→ 统一用 `sqlLit()` 做字面量转义
 *    （数字直出、字符串把 ' 翻倍、null → NULL、布尔 → 1/0）。所有值都由本层生成，
 *    页面拿不到拼 SQL 的口子。
 * 2. **事务要显式开**：`plus.sqlite.transaction({ operation: 'begin' | 'commit' | 'rollback' })`，
 *    批量入库/迁移都包在事务里，异常一律 rollback。
 * 3. **迁移不能无条件建表**：先读 `schema_migrations`，只跑缺的版本（PRD §8.3）。
 */

type PlusSqlite = {
  isOpenDatabase(params: { name: string }): boolean
  openDatabase(params: { name: string; path: string; success?: () => void; fail?: (e: unknown) => void }): void
  closeDatabase(params: { name: string; success?: () => void; fail?: (e: unknown) => void }): void
  executeSql(params: { name: string; sql: string | string[]; success?: () => void; fail?: (e: unknown) => void }): void
  selectSql(params: { name: string; sql: string; success?: (rows: Row[]) => void; fail?: (e: unknown) => void }): void
  transaction(params: { name: string; operation: 'begin' | 'commit' | 'rollback'; success?: () => void; fail?: (e: unknown) => void }): void
}

function getSqlite(): PlusSqlite | null {
  // #ifdef APP-PLUS
  const p = (globalThis as unknown as { plus?: { sqlite?: PlusSqlite } }).plus
  if (p && p.sqlite) return p.sqlite
  // #endif
  return null
}

export function isSqliteAvailable(): boolean {
  return getSqlite() !== null
}

/** 把 JS 值转成 SQL 字面量。不接受外部拼接，仅本层内部使用 */
function sqlLit(v: SqlValue | undefined): string {
  if (v === null || v === undefined) return 'NULL'
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : 'NULL'
  return `'${String(v).replace(/'/g, "''")}'`
}

function buildWhere(where?: WhereClause): string {
  if (!where) return ''
  const parts: string[] = []

  if (where.eq) for (const [k, v] of Object.entries(where.eq)) parts.push(`${k} = ${sqlLit(v)}`)
  if (where.neq) for (const [k, v] of Object.entries(where.neq)) parts.push(`${k} <> ${sqlLit(v)}`)
  if (where.like) {
    for (const [k, v] of Object.entries(where.like)) {
      const safe = v.replace(/'/g, "''").replace(/%/g, '')
      parts.push(`${k} LIKE '%${safe}%'`)
    }
  }
  if (where.in) {
    for (const [k, list] of Object.entries(where.in)) {
      if (!list.length) {
        parts.push('0 = 1')
        continue
      }
      parts.push(`${k} IN (${list.map(sqlLit).join(',')})`)
    }
  }
  if (where.isNull) for (const k of where.isNull) parts.push(`${k} IS NULL`)
  if (where.notNull) for (const k of where.notNull) parts.push(`${k} IS NOT NULL`)
  if (where.gte) for (const [k, v] of Object.entries(where.gte)) parts.push(`${k} >= ${sqlLit(v)}`)
  if (where.lte) for (const [k, v] of Object.entries(where.lte)) parts.push(`${k} <= ${sqlLit(v)}`)

  return parts.length ? ` WHERE ${parts.join(' AND ')}` : ''
}

function buildOrder(order?: OrderSpec[]): string {
  if (!order || !order.length) return ''
  return ` ORDER BY ${order.map((o) => `${o.field} ${o.desc ? 'DESC' : 'ASC'}`).join(', ')}`
}

export class SqliteAdapter implements DatabaseAdapter {
  readonly kind = 'sqlite' as const

  private db: PlusSqlite | null = null
  private opened = false
  private txDepth = 0

  async init(): Promise<void> {
    if (this.opened) return
    const sqlite = getSqlite()
    if (!sqlite) throw new Error('plus.sqlite 不可用')
    this.db = sqlite

    if (!sqlite.isOpenDatabase({ name: DB_NAME })) {
      await new Promise<void>((resolve, reject) => {
        sqlite.openDatabase({ name: DB_NAME, path: DB_PATH, success: () => resolve(), fail: reject })
      })
    }
    await this.exec('PRAGMA foreign_keys = ON;')
    this.opened = true
    await this.migrate()
  }

  private exec(sql: string | string[]): Promise<void> {
    const sqlite = this.db
    if (!sqlite) return Promise.reject(new Error('数据库未打开'))
    return new Promise<void>((resolve, reject) => {
      sqlite.executeSql({ name: DB_NAME, sql, success: () => resolve(), fail: reject })
    })
  }

  private select(sql: string): Promise<Row[]> {
    const sqlite = this.db
    if (!sqlite) return Promise.reject(new Error('数据库未打开'))
    return new Promise<Row[]>((resolve, reject) => {
      sqlite.selectSql({ name: DB_NAME, sql, success: (rows) => resolve(rows || []), fail: reject })
    })
  }

  private op(operation: 'begin' | 'commit' | 'rollback'): Promise<void> {
    const sqlite = this.db
    if (!sqlite) return Promise.reject(new Error('数据库未打开'))
    return new Promise<void>((resolve, reject) => {
      sqlite.transaction({ name: DB_NAME, operation, success: () => resolve(), fail: reject })
    })
  }

  /** 版本化迁移：只执行缺的版本，整体包事务 */
  private async migrate(): Promise<void> {
    await this.exec(BOOTSTRAP)
    const applied = await this.select('SELECT version FROM schema_migrations;')
    const done = new Set(applied.map((r) => Number(r.version)))
    const pending = MIGRATIONS.filter((m) => !done.has(m.version)).sort((a, b) => a.version - b.version)
    if (!pending.length) return

    await this.op('begin')
    try {
      for (const m of pending) {
        for (const sql of m.statements) await this.exec(sql)
        await this.exec(
          `INSERT INTO schema_migrations (version, name, applied_at) VALUES (${sqlLit(m.version)}, ${sqlLit(
            m.name
          )}, ${sqlLit(Date.now())});`
        )
      }
      await this.op('commit')
    } catch (err) {
      await this.op('rollback')
      throw err
    }
  }

  async all(table: TableName, where?: WhereClause, order?: OrderSpec[], limit?: number): Promise<Row[]> {
    await this.init()
    const sql = `SELECT * FROM ${table}${buildWhere(where)}${buildOrder(order)}${limit ? ` LIMIT ${limit}` : ''};`
    return this.select(sql)
  }

  async first(table: TableName, where?: WhereClause, order?: OrderSpec[]): Promise<Row | null> {
    const rows = await this.all(table, where, order, 1)
    return rows[0] || null
  }

  async count(table: TableName, where?: WhereClause): Promise<number> {
    await this.init()
    const rows = await this.select(`SELECT COUNT(*) AS c FROM ${table}${buildWhere(where)};`)
    return Number(rows[0]?.c || 0)
  }

  async insert(table: TableName, row: Row): Promise<void> {
    await this.init()
    const cols = Object.keys(row)
    const sql = `INSERT INTO ${table} (${cols.join(',')}) VALUES (${cols.map((c) => sqlLit(row[c])).join(',')});`
    await this.exec(sql)
  }

  async insertMany(table: TableName, rows: Row[]): Promise<void> {
    if (!rows.length) return
    await this.init()
    const cols = Object.keys(rows[0])
    const values = rows.map((r) => `(${cols.map((c) => sqlLit(r[c])).join(',')})`).join(',')
    await this.exec(`INSERT OR REPLACE INTO ${table} (${cols.join(',')}) VALUES ${values};`)
  }

  async update(table: TableName, patch: Row, where: WhereClause): Promise<void> {
    await this.init()
    const sets = Object.keys(patch)
      .map((c) => `${c} = ${sqlLit(patch[c])}`)
      .join(',')
    await this.exec(`UPDATE ${table} SET ${sets}${buildWhere(where)};`)
  }

  async remove(table: TableName, where: WhereClause): Promise<void> {
    await this.init()
    await this.exec(`DELETE FROM ${table}${buildWhere(where)};`)
  }

  async transaction<T>(fn: (db: DatabaseAdapter) => Promise<T>): Promise<T> {
    await this.init()
    if (this.txDepth > 0) return fn(this)
    await this.op('begin')
    this.txDepth += 1
    try {
      const result = await fn(this)
      this.txDepth -= 1
      await this.op('commit')
      return result
    } catch (err) {
      this.txDepth = Math.max(0, this.txDepth - 1)
      await this.op('rollback')
      throw err
    }
  }

  async reset(): Promise<void> {
    await this.init()
    await this.transaction(async (db) => {
      for (const t of [...TABLES].reverse()) await db.remove(t, {})
    })
  }

  async dump(): Promise<DatabaseDump> {
    await this.init()
    const tables = {} as DatabaseDump['tables']
    for (const t of TABLES) {
      tables[t] = (await this.select(`SELECT * FROM ${t};`)) as Record<string, unknown>[]
    }
    return {
      schemaVersion: await this.schemaVersion(),
      exportedAt: Date.now(),
      app: 'interview-box',
      tables
    }
  }

  async restore(dump: DatabaseDump): Promise<void> {
    await this.init()
    await this.transaction(async (db) => {
      for (const t of [...TABLES].reverse()) await db.remove(t, {})
      for (const t of TABLES) {
        const rows = dump.tables?.[t] as Row[] | undefined
        if (rows && rows.length) await db.insertMany(t, rows)
      }
    })
  }

  async schemaVersion(): Promise<number> {
    if (!this.opened) await this.init()
    const rows = await this.select('SELECT MAX(version) AS v FROM schema_migrations;')
    return Number(rows[0]?.v || BACKUP_SCHEMA_VERSION)
  }
}
