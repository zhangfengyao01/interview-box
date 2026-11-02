import type { DatabaseAdapter, OrderSpec, Row, SqlValue, TableName, WhereClause } from './types'
import { TABLES } from './types'
import type { DatabaseDump } from '@/types/db'
import { BACKUP_SCHEMA_VERSION } from '@/types/db'
import { LATEST_VERSION } from './schema'

/**
 * 降级实现：uni.storage 全量 JSON 快照。
 *
 * 什么时候用：
 * - H5 调试、微信小程序（没有 plus.sqlite）；
 * - APP 首次启动、SQLite 打开失败时的兜底（不阻断用户录题）。
 *
 * PRD §3.1 明确「不建议把全部题目放 uni.setStorage」，所以这个实现只在
 * **非 APP 端 / 兜底**路径启用；APP 正常路径走 `sqlite.ts`。
 * 语义与 sqlite 实现保持一致，repositories 不需要感知差异。
 */

const STORE_KEY = 'interview_box_db_v1'

type Store = {
  schemaVersion: number
  tables: Record<TableName, Row[]>
}

function emptyStore(): Store {
  const tables = {} as Record<TableName, Row[]>
  TABLES.forEach((t) => {
    tables[t] = []
  })
  return { schemaVersion: LATEST_VERSION, tables }
}

/** 深拷贝：事务回滚靠它，快照量级在千题内可接受 */
function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T
}

function getField(row: Row, path: string): SqlValue {
  return row[path]
}

function matchWhere(row: Row, where?: WhereClause): boolean {
  if (!where) return true
  const { eq, neq, like, in: inClause, isNull, notNull, gte, lte } = where

  if (eq) {
    for (const [k, v] of Object.entries(eq)) if (getField(row, k) !== v) return false
  }
  if (neq) {
    for (const [k, v] of Object.entries(neq)) if (getField(row, k) === v) return false
  }
  if (like) {
    for (const [k, v] of Object.entries(like)) {
      const cell = getField(row, k)
      if (typeof cell !== 'string' || !cell.toLowerCase().includes(v.toLowerCase())) return false
    }
  }
  if (inClause) {
    for (const [k, list] of Object.entries(inClause)) {
      if (!list.includes(getField(row, k))) return false
    }
  }
  if (isNull) {
    for (const k of isNull) if (getField(row, k) !== null && getField(row, k) !== undefined) return false
  }
  if (notNull) {
    for (const k of notNull) if (getField(row, k) === null || getField(row, k) === undefined) return false
  }
  if (gte) {
    for (const [k, v] of Object.entries(gte)) {
      if (v === null) continue // null 边界视为「无约束」
      const cell = getField(row, k)
      if (cell === null || cell === undefined || cell < v) return false
    }
  }
  if (lte) {
    for (const [k, v] of Object.entries(lte)) {
      if (v === null) continue
      const cell = getField(row, k)
      if (cell === null || cell === undefined || cell > v) return false
    }
  }
  return true
}

function sortRows(rows: Row[], order?: OrderSpec[]): Row[] {
  if (!order || !order.length) return rows
  return [...rows].sort((a, b) => {
    for (const spec of order) {
      const av = a[spec.field]
      const bv = b[spec.field]
      if (av === bv) continue
      if (av === null || av === undefined) return 1
      if (bv === null || bv === undefined) return -1
      const ret = av < bv ? -1 : 1
      return spec.desc ? -ret : ret
    }
    return 0
  })
}

export class StorageAdapter implements DatabaseAdapter {
  readonly kind = 'storage' as const

  private store: Store = emptyStore()
  private loaded = false
  private txDepth = 0
  private dirty = false

  async init(): Promise<void> {
    if (this.loaded) return
    try {
      const raw = uni.getStorageSync(STORE_KEY)
      const parsed = typeof raw === 'string' ? (JSON.parse(raw || '{}') as Partial<Store>) : (raw as Partial<Store>)
      if (parsed && parsed.tables) {
        const base = emptyStore()
        TABLES.forEach((t) => {
          base.tables[t] = Array.isArray(parsed.tables?.[t]) ? (parsed.tables?.[t] as Row[]) : []
        })
        base.schemaVersion = parsed.schemaVersion || LATEST_VERSION
        this.store = base
      }
    } catch {
      this.store = emptyStore()
    }
    this.loaded = true
  }

  private persist(): void {
    if (this.txDepth > 0) {
      this.dirty = true
      return
    }
    try {
      uni.setStorageSync(STORE_KEY, JSON.stringify(this.store))
    } catch {
      /* 存储写入失败不阻断主流程，会在下次写入时重试 */
    }
    this.dirty = false
  }

  async all(table: TableName, where?: WhereClause, order?: OrderSpec[], limit?: number): Promise<Row[]> {
    await this.init()
    let rows = this.store.tables[table].filter((r) => matchWhere(r, where))
    rows = sortRows(rows, order)
    if (limit && limit > 0) rows = rows.slice(0, limit)
    return clone(rows)
  }

  async first(table: TableName, where?: WhereClause, order?: OrderSpec[]): Promise<Row | null> {
    const rows = await this.all(table, where, order, 1)
    return rows[0] || null
  }

  async count(table: TableName, where?: WhereClause): Promise<number> {
    await this.init()
    return this.store.tables[table].filter((r) => matchWhere(r, where)).length
  }

  async insert(table: TableName, row: Row): Promise<void> {
    await this.init()
    this.store.tables[table].push({ ...row })
    this.persist()
  }

  async insertMany(table: TableName, rows: Row[]): Promise<void> {
    await this.init()
    rows.forEach((r) => this.store.tables[table].push({ ...r }))
    this.persist()
  }

  async update(table: TableName, patch: Row, where: WhereClause): Promise<void> {
    await this.init()
    this.store.tables[table].forEach((row, i) => {
      if (matchWhere(row, where)) this.store.tables[table][i] = { ...row, ...patch }
    })
    this.persist()
  }

  async remove(table: TableName, where: WhereClause): Promise<void> {
    await this.init()
    this.store.tables[table] = this.store.tables[table].filter((r) => !matchWhere(r, where))
    this.persist()
  }

  async transaction<T>(fn: (db: DatabaseAdapter) => Promise<T>): Promise<T> {
    await this.init()
    const backup = clone(this.store)
    this.txDepth += 1
    try {
      const result = await fn(this)
      this.txDepth -= 1
      if (this.txDepth === 0) this.persist()
      return result
    } catch (err) {
      this.txDepth = Math.max(0, this.txDepth - 1)
      this.store = backup
      this.dirty = false
      throw err
    }
  }

  async reset(): Promise<void> {
    this.store = emptyStore()
    this.persist()
  }

  async dump(): Promise<DatabaseDump> {
    await this.init()
    const tables = {} as DatabaseDump['tables']
    TABLES.forEach((t) => {
      tables[t] = clone(this.store.tables[t]) as Record<string, unknown>[]
    })
    return {
      schemaVersion: this.store.schemaVersion,
      exportedAt: Date.now(),
      app: 'interview-box',
      tables
    }
  }

  async restore(dump: DatabaseDump): Promise<void> {
    const next = emptyStore()
    TABLES.forEach((t) => {
      const rows = dump.tables?.[t]
      next.tables[t] = Array.isArray(rows) ? (rows as Row[]) : []
    })
    next.schemaVersion = dump.schemaVersion || BACKUP_SCHEMA_VERSION
    this.store = next
    this.loaded = true
    this.persist()
  }

  async schemaVersion(): Promise<number> {
    await this.init()
    return this.store.schemaVersion
  }
}
