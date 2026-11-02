/**
 * 跑 `scripts/e2e-backup.ts`：用项目自带的 esbuild 打成一个临时 ESM 包再执行。
 *
 * 为什么要打一次包而不是直接 `node --experimental-strip-types`：
 * 业务代码里到处是 `@/xxx` 别名和 TS 语法，esbuild 顺手把别名和类型一起处理掉，
 * 不需要额外装 tsx / ts-node。
 */
import { build } from 'esbuild'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const out = path.join(root, 'scripts', '.e2e-backup.mjs')

await build({
  entryPoints: [path.join(root, 'scripts', 'e2e-backup.ts')],
  outfile: out,
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node18',
  logLevel: 'warning',
  alias: { '@': path.join(root, 'src') }
})

const res = spawnSync(process.execPath, [out], { stdio: 'inherit' })
try {
  fs.unlinkSync(out)
} catch {
  /* 临时文件删不掉不影响结论 */
}
process.exit(res.status ?? 1)
