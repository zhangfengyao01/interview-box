/**
 * 前端题库聚合：React / TypeScript / 编程 / 工程化 / 性能优化 五个方向。
 *
 * 每个方向一个文件，目录下的条目就是「题面 + 难度 + 简洁版参考回答」，
 * 分类、标签、时间戳在这里统一补 —— bank 文件里只写内容，不写机制。
 */
import type { SeedQuestion } from '../seed'
import type { BankItem } from './types'
import { REACT_BANK } from './react'
import { TS_BANK } from './typescript'
import { CODING_BANK } from './coding'
import { BUILD_BANK } from './build'
import { PERF_BANK } from './perf'

/** bank 里所有题面，供回归脚本构造「老库」用 */
export const FRONTEND_BANK_TITLES: string[] = [
  ...REACT_BANK,
  ...TS_BANK,
  ...CODING_BANK,
  ...BUILD_BANK,
  ...PERF_BANK
].map((item) => item.title)

export function buildFrontendQuestions(t: number): SeedQuestion[] {
  const twoHours = 2 * 60 * 60 * 1000
  const mk = (bank: BankItem[], tags: string[], offset: number) =>
    bank.map<SeedQuestion>((item, i) => ({
      title: item.title,
      categoryId: 'cat_fe',
      referenceAnswer: item.answer,
      difficulty: item.difficulty,
      createdAt: t - (offset + i) * twoHours,
      tags: [...tags, ...(item.extraTags ?? [])]
    }))

  return [
    ...mk(REACT_BANK, ['前端框架', 'React'], 0),
    ...mk(TS_BANK, ['技术能力', 'TypeScript'], 100),
    ...mk(CODING_BANK, ['手写代码'], 200),
    ...mk(BUILD_BANK, ['前端工程化'], 300),
    ...mk(PERF_BANK, ['性能优化'], 400)
  ]
}
