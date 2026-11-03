/** 题库条目的通用形状：seed 层负责补分类、标签、时间戳等运行时字段 */
export interface BankItem {
  title: string
  /** 1 基础 / 2 中等 / 3 进阶 */
  difficulty: 1 | 2 | 3
  /** 面试简洁版参考回答 */
  answer: string
  /** 题库级标签之外的补充（如个别题挂「面试高频」「数据结构」） */
  extraTags?: string[]
}
