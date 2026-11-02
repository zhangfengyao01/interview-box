import type { DatabaseAdapter } from './types'
import { SqliteAdapter, isSqliteAvailable } from './sqlite'
import { StorageAdapter } from './storage'

/**
 * 数据库适配器统一出口。
 *
 * 选择规则（PRD §3.1 + §1「AI/云服务不能成为门槛」的同一思路）：
 * 1. APP 且 plus.sqlite 可用 → SQLite（主力）；
 * 2. 其他情况（H5 / 微信小程序 / SQLite 打开失败）→ storage 快照（降级，功能不减）。
 *
 * 降级不是静默的：`bootDatabase()` 返回 `fellBack` 与 `reason`，设置页会显示当前引擎，
 * 避免用户以为自己用的是 SQLite。
 */

let active: DatabaseAdapter | null = null
let fellBack = false
let fallbackReason = ''

export interface BootResult {
  engine: 'sqlite' | 'storage'
  fellBack: boolean
  reason: string
}

export async function bootDatabase(): Promise<BootResult> {
  if (active) return { engine: active.kind, fellBack, reason: fallbackReason }

  if (isSqliteAvailable()) {
    const sqlite = new SqliteAdapter()
    try {
      await sqlite.init()
      active = sqlite
      return { engine: 'sqlite', fellBack: false, reason: '' }
    } catch (err) {
      fellBack = true
      fallbackReason = err instanceof Error ? err.message : String(err)
      // 不阻断用户：降级到快照实现，设置页会把原因显示出来
    }
  } else {
    fellBack = true
    fallbackReason = '当前平台没有 plus.sqlite（H5 / 小程序 / 普通运行基座）'
  }

  const storage = new StorageAdapter()
  await storage.init()
  active = storage
  return { engine: 'storage', fellBack, reason: fallbackReason }
}

/** 已初始化的适配器；未初始化时抛错，避免「静默返回空数据」这种最难查的 bug */
export function db(): DatabaseAdapter {
  if (!active) throw new Error('数据库未初始化：请先调用 bootDatabase()')
  return active
}

export function dbEngine(): 'sqlite' | 'storage' {
  return active ? active.kind : 'storage'
}

export function dbFallbackInfo(): { fellBack: boolean; reason: string } {
  return { fellBack, reason: fallbackReason }
}

export { isSqliteAvailable }
export type { DatabaseAdapter }
