/**
 * 跑 `scripts/e2e-seed.ts`：用项目自带 esbuild 打成临时 ESM 再执行（同 verify-backup 的做法）。
 */
import { build } from 'esbuild'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const out = path.join(root, 'scripts', '.e2e-seed.mjs')

await build({
  entryPoints: [path.join(root, 'scripts', 'e2e-seed.ts')],
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
