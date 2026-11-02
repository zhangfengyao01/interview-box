#!/usr/bin/env node
/**
 * `src/static/ocr/` 里的东西只给 H5 用（worker + wasm core + 中文模型，约 5.5MB），
 * 但 uni 会把 `src/static` **原样拷进每个平台的产物**，包括微信小程序和 APP。
 * 小程序主包有 2MB 限制，白塞 5.5MB 直接超标 —— 所以构建完把非 H5 的产物清理掉。
 *
 * 用法：node scripts/trim-static.mjs   （在 uni build 之后跑，幂等）
 */
import { existsSync, rmSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

const root = resolve(process.cwd())
const buildDir = join(root, 'dist', 'build')
const H5_ONLY = 'ocr'
const keep = new Set(['h5'])

if (!existsSync(buildDir)) {
  console.log('还没构建产物，跳过')
  process.exit(0)
}

const { readdirSync } = await import('node:fs')
const platforms = readdirSync(buildDir).filter((n) => statSync(join(buildDir, n)).isDirectory())
let trimmed = 0

for (const p of platforms) {
  if (keep.has(p)) continue
  const dir = join(buildDir, p, 'static', H5_ONLY)
  if (!existsSync(dir)) continue
  const size = dirSize(dir)
  rmSync(dir, { recursive: true, force: true })
  trimmed++
  console.log(`清理 ${p}/static/${H5_ONLY}（${(size / 1024 / 1024).toFixed(1)}MB，该平台用不到）`)
}

if (!trimmed) console.log('没有需要清理的 H5 专用资源')

function dirSize(dir) {
  let total = 0
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    total += entry.isDirectory() ? dirSize(full) : statSync(full).size
  }
  return total
}
