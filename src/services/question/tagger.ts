/**
 * 轻量规则标签推断：只作为「建议」，最终以用户在确认页的修改为准
 */
const RULES = [
  { re: /工程化|构建|脚手架|webpack|vite|打包|ci\b/i, tag: '前端工程化' },
  { re: /性能|优化|首屏|渲染|白屏|缓存|lcp|fcp/i, tag: '性能优化' },
  { re: /vue|react|框架|组件|响应式|computed|watch/i, tag: '前端框架' },
  { re: /选型|技术栈|技术方案/i, tag: '技术选型' },
  { re: /算法|复杂度|链表|二叉树|排序|动态规划|哈希|递归/i, tag: '数据结构' },
  { re: /手写|实现一个|写一个|防抖|节流|promise/i, tag: '手写代码' },
  { re: /需求|prd|产品|指标|用户/i, tag: '需求分析' },
  { re: /项目|上线|复盘|线上问题|排查/i, tag: '项目复盘' },
  { re: /闭包|原型|作用域|事件循环|浏览器|http/i, tag: '技术能力' }
]

export function inferTags(title: string, limit = 2): string[] {
  const text = String(title || '')
  const out: string[] = []
  RULES.forEach((r) => {
    if (out.length >= limit) return
    if (r.re.test(text) && out.indexOf(r.tag) < 0) out.push(r.tag)
  })
  return out
}

/** 关键词推断分类 id（仅用于确认页的默认值） */
export function inferCategoryId(title: string): string {
  const t = String(title || '')
  if (/算法|复杂度|链表|二叉树|排序|动态规划|哈希|递归|数组|字符串/i.test(t)) return 'cat_algo'
  if (/需求|prd|产品|指标|用户|上线效果/i.test(t)) return 'cat_pm'
  if (/项目|复盘|线上问题|排查|重做/i.test(t) && !/前端|vue|react/i.test(t)) return 'cat_proj'
  return 'cat_fe'
}
