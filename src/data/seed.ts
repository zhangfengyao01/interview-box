import { uuid } from '@/utils/id'
import { addDays, DAY_MS, todayStart } from '@/utils/date'
import type { DatabaseAdapter } from '@/adapters/database/types'
import { toRow } from '@/adapters/database/mappers'
import type { MasteryStatus } from '@/types/models'
import { BUILTIN_CATEGORIES } from './categories'

/**
 * 示例数据：4 个内置分类 + 10 个标签 + 18 道前端面试题。
 *
 * 只在「库里一道题都没有」时写入（首次启动），用户清空数据后不会再被塞回来 ——
 * 判断依据是 questions 表条数而不是某个 first_launch 标记，避免标记与实际数据不一致。
 */

export const SEED_TAGS: { id: string; name: string; color: string }[] = [
  { id: 'tag_前端工程化', name: '前端工程化', color: '#5B50F5' },
  { id: 'tag_技术能力', name: '技术能力', color: '#5B50F5' },
  { id: 'tag_前端框架', name: '前端框架', color: '#5B50F5' },
  { id: 'tag_技术选型', name: '技术选型', color: '#5B50F5' },
  { id: 'tag_性能优化', name: '性能优化', color: '#F59E0B' },
  { id: 'tag_面试高频', name: '面试高频', color: '#EF4444' },
  { id: 'tag_手写代码', name: '手写代码', color: '#3B82F6' },
  { id: 'tag_数据结构', name: '数据结构', color: '#10B981' },
  { id: 'tag_需求分析', name: '需求分析', color: '#10B981' },
  { id: 'tag_项目复盘', name: '项目复盘', color: '#3B82F6' }
]

interface SeedQuestion {
  title: string
  categoryId: string
  referenceAnswer?: string
  myAnswer?: string
  notes?: string
  masteryStatus?: MasteryStatus
  nextReviewAt?: number
  reviewCount?: number
  isFavorite?: boolean
  createdAt?: number
  tags: string[]
}

function buildQuestions(): SeedQuestion[] {
  const t = Date.now()
  const H = 3600 * 1000
  return [
    {
      title: '请介绍一下你对前端工程化的理解？',
      categoryId: 'cat_fe',
      referenceAnswer:
        '前端工程化主要包括模块化、自动化构建、代码规范、持续集成等，能够提升开发效率和代码质量。落地时通常从三块入手：统一的脚手架与构建链路（Vite/Webpack + 约定式目录）、质量门禁（ESLint/Prettier/类型检查/单测）、以及发布链路（CI 流水线、灰度与回滚）。',
      myAnswer: '我会从「开发提效」和「质量可控」两条线讲，结合上一家公司搭脚手架的经历。',
      notes: '面试时别只背概念，一定要带一个自己落地的例子，否则容易被追问细节。',
      masteryStatus: 'mastered',
      nextReviewAt: addDays(7),
      reviewCount: 3,
      isFavorite: true,
      createdAt: t - 6 * DAY_MS,
      tags: ['前端工程化', '技术能力', '面试高频']
    },
    {
      title: '你如何看待前端框架的选择？',
      categoryId: 'cat_fe',
      referenceAnswer:
        '不同项目有不同的技术选型，通常会考虑团队技术栈、项目需求、生态支持等因素。我会补充两点：一是看项目的生命周期和迭代节奏，二是看团队维护成本，避免为了新技术而引入不可控风险。',
      masteryStatus: 'learning',
      nextReviewAt: addDays(1),
      reviewCount: 1,
      createdAt: t - 5 * DAY_MS,
      tags: ['前端框架', '技术选型']
    },
    {
      title: '说说你对性能优化的理解？',
      categoryId: 'cat_fe',
      referenceAnswer:
        '性能优化包括减少资源加载、优化渲染、使用缓存等方式，提升用户体验。指标上关注 FCP/LCP/INP/CLS，手段上分加载期（代码分割、图片压缩与懒加载、CDN、HTTP 缓存）和运行期（长任务拆分、虚拟列表、避免重复渲染）。',
      masteryStatus: 'fuzzy',
      nextReviewAt: todayStart(),
      reviewCount: 2,
      createdAt: t - 4 * DAY_MS,
      tags: ['性能优化', '面试高频']
    },
    {
      title: 'Vue3 的响应式原理是什么？',
      categoryId: 'cat_fe',
      referenceAnswer:
        'Vue3 用 Proxy 拦截对象的读写，配合 effect 依赖收集：get 时把当前 effect 收进依赖集合，set 时触发对应 effect 重新执行。相比 Vue2 的 Object.defineProperty，Proxy 能监听新增/删除属性和数组索引，且惰性代理减少初始化开销。',
      masteryStatus: 'mastered',
      nextReviewAt: addDays(14),
      reviewCount: 4,
      createdAt: t - 9 * DAY_MS,
      tags: ['前端框架', '面试高频', '技术能力']
    },
    {
      title: 'computed 和 watch 的区别，各自适合什么场景？',
      categoryId: 'cat_fe',
      referenceAnswer:
        'computed 是带缓存的派生状态，依赖不变就不重新计算，适合「由其他状态算出来的值」；watch 是副作用，依赖变化时执行回调，适合请求、打点、手动同步等异步或命令式逻辑。',
      masteryStatus: 'learning',
      nextReviewAt: addDays(3),
      reviewCount: 1,
      createdAt: t - 3 * DAY_MS,
      tags: ['前端框架']
    },
    {
      title: '手写一个 Promise.all，需要注意什么？',
      categoryId: 'cat_fe',
      referenceAnswer:
        '要点：返回新 Promise；用计数器判断全部完成而不是靠数组长度；保持结果顺序与入参一致；任一 reject 立即 reject；空数组要立即 resolve。',
      masteryStatus: 'new',
      createdAt: t - 2 * DAY_MS,
      tags: ['手写代码', '面试高频']
    },
    {
      title: '什么是闭包？举一个实际用到的场景',
      categoryId: 'cat_fe',
      referenceAnswer:
        '闭包是函数与其词法环境的组合，内部函数可以访问外部作用域变量。实际场景：防抖节流保存定时器、模块化私有变量、柯里化函数、以及 React/Vue 中保存上一次的值。',
      masteryStatus: 'mastered',
      nextReviewAt: addDays(10),
      reviewCount: 2,
      createdAt: t - 12 * DAY_MS,
      tags: ['技术能力']
    },
    {
      title: '浏览器从输入 URL 到页面展示经历了什么？',
      categoryId: 'cat_fe',
      referenceAnswer:
        'DNS 解析 → 建立 TCP/TLS → 发送 HTTP 请求 → 服务端响应 → 浏览器解析 HTML 构建 DOM、解析 CSS 构建 CSSOM、合成渲染树 → 布局 → 绘制 → 合成上屏。中间还涉及缓存命中、预加载、重排重绘的优化空间。',
      masteryStatus: 'fuzzy',
      nextReviewAt: addDays(3),
      reviewCount: 1,
      createdAt: t - 20 * H,
      tags: ['面试高频', '技术能力']
    },
    {
      title: '如何判断链表是否有环？',
      categoryId: 'cat_algo',
      referenceAnswer:
        '快慢指针：慢指针走一步、快指针走两步，若相遇则有环。时间 O(n)、空间 O(1)。追问「找环入口」时，相遇后把一个指针放回头部，两者同速前进再次相遇处即入口。',
      masteryStatus: 'mastered',
      nextReviewAt: addDays(7),
      reviewCount: 3,
      createdAt: t - 8 * DAY_MS,
      tags: ['数据结构', '手写代码']
    },
    {
      title: '时间复杂度 O(log n) 常见于哪些场景？',
      categoryId: 'cat_algo',
      referenceAnswer:
        '二分查找、平衡树/堆的插入删除、快速幂、以及每次把问题规模折半的分治。判断依据是每一步能把候选规模砍掉一个常数比例。',
      masteryStatus: 'learning',
      nextReviewAt: addDays(1),
      reviewCount: 1,
      createdAt: t - 7 * DAY_MS,
      tags: ['数据结构']
    },
    {
      title: '实现一个 LRU 缓存',
      categoryId: 'cat_algo',
      referenceAnswer:
        '用哈希表 + 双向链表：哈希表 O(1) 定位节点，双向链表维护访问顺序，get/set 时把节点移到头部，超出容量时删除尾部。JS 里也可以直接用 Map 的插入顺序特性简化实现。',
      masteryStatus: 'new',
      createdAt: t - 2 * DAY_MS,
      tags: ['数据结构', '手写代码']
    },
    {
      title: '动态规划和贪心算法的区别？',
      categoryId: 'cat_algo',
      referenceAnswer:
        '动态规划保留所有子问题的最优解，通过状态转移推导全局最优；贪心只做局部最优选择且不回退，需要证明贪心选择性质。能用贪心的一般也能用 DP 解，反之不成立。',
      masteryStatus: 'new',
      createdAt: t - 40 * H,
      tags: ['数据结构']
    },
    {
      title: '如何判断一个需求该不该做？',
      categoryId: 'cat_pm',
      referenceAnswer:
        '先看需求来源与真实场景，用「用户价值 × 实现成本 × 战略匹配度」三个维度做初筛，再用数据或访谈验证假设。对于优先级冲突，回到北极星指标上比，而不是谁的声音大。',
      masteryStatus: 'learning',
      nextReviewAt: addDays(3),
      reviewCount: 1,
      createdAt: t - 5 * DAY_MS,
      tags: ['需求分析']
    },
    {
      title: 'PRD 里最重要的部分是什么？',
      categoryId: 'cat_pm',
      referenceAnswer:
        '是边界与异常。正常流程往往一句话就说完，真正决定开发返工量的是异常分支、权限、空态、并发和兼容性。我的写法是先写清楚「不做什么」，再逐条列异常流。',
      masteryStatus: 'new',
      createdAt: t - 3 * DAY_MS,
      tags: ['需求分析']
    },
    {
      title: '如何衡量一次功能上线的效果？',
      categoryId: 'cat_pm',
      referenceAnswer:
        '上线前定义可量化的成功指标（核心行为转化、留存、效率提升），埋点覆盖主路径与关键分支；上线后按周对比基线，同时观察负向指标（报错率、客服工单）。指标不达预期要能定位到是需求假设错还是实现问题。',
      masteryStatus: 'new',
      createdAt: t - 30 * H,
      tags: ['需求分析']
    },
    {
      title: '介绍一个你主导的复杂项目，难点在哪？',
      categoryId: 'cat_proj',
      referenceAnswer:
        '按 STAR 结构讲：背景与目标 → 我的职责 → 关键决策与取舍（为什么这么选）→ 量化结果。重点讲清楚「没有现成方案时你怎么判断」，而不是罗列做了哪些页面。',
      myAnswer:
        '我会讲工作流设计器：零到一自研，难点是画布状态与后端模型的同步，最后用乐观锁 + ETag 解决并发覆盖。',
      masteryStatus: 'mastered',
      nextReviewAt: addDays(14),
      reviewCount: 2,
      createdAt: t - 15 * DAY_MS,
      tags: ['项目复盘', '面试高频']
    },
    {
      title: '项目中遇到的最大线上问题是什么，怎么排查的？',
      categoryId: 'cat_proj',
      referenceAnswer:
        '按「现象 → 范围 → 假设 → 验证」讲。先止血（回滚/开关），再定位根因，最后补监控与回归用例。要说明你用了什么工具看日志、如何缩小范围。',
      masteryStatus: 'learning',
      nextReviewAt: addDays(1),
      reviewCount: 1,
      createdAt: t - 6 * DAY_MS,
      tags: ['项目复盘']
    },
    {
      title: '如果让你重做这个项目，你会改什么？',
      categoryId: 'cat_proj',
      referenceAnswer:
        '从架构和流程两处讲：架构上会把数据层先抽象好再写页面，避免后期返工；流程上会提前定好接口契约和联调节奏。承认不足但给出可执行的改进，而不是空谈。',
      masteryStatus: 'new',
      createdAt: t - 20 * H,
      tags: ['项目复盘']
    }
  ]
}

/** 首次启动写入示例数据；已有数据则跳过，返回是否真的写过 */
export async function seedIfEmpty(db: DatabaseAdapter): Promise<boolean> {
  const existing = await db.count('questions')
  if (existing > 0) return false

  const t = Date.now()

  await db.transaction(async (tx) => {
    await tx.insertMany(
      'categories',
      BUILTIN_CATEGORIES.map((c) =>
        toRow('categories', { ...c, createdAt: t, updatedAt: t })
      )
    )

    await tx.insertMany(
      'tags',
      SEED_TAGS.map((tag) => toRow('tags', { ...tag, createdAt: t }))
    )

    const asset = {
      id: 'asset_seed_1',
      sourceType: 'text' as const,
      filePath: null,
      rawText: '前端面试题整理（示例）',
      editedText: '前端面试题整理（示例）',
      ocrEngine: 'manual',
      createdAt: t - 2 * DAY_MS
    }
    await tx.insert('source_assets', toRow('source_assets', asset))

    const questions = buildQuestions()
    for (const item of questions) {
      const { tags, ...rest } = item
      const row = {
        id: uuid(),
        title: rest.title,
        content: '',
        referenceAnswer: rest.referenceAnswer || '',
        myAnswer: rest.myAnswer || '',
        notes: rest.notes || '',
        categoryId: rest.categoryId,
        difficulty: 2,
        masteryStatus: rest.masteryStatus || 'new',
        isFavorite: !!rest.isFavorite,
        answerOrigin: 'manual' as const,
        sourceCompany: '',
        sourceRole: '',
        sourceRound: '',
        sourceDate: null,
        nextReviewAt: rest.nextReviewAt ?? null,
        reviewCount: rest.reviewCount ?? 0,
        createdAt: rest.createdAt || t,
        updatedAt: rest.createdAt || t,
        deletedAt: null
      }
      await tx.insert('questions', toRow('questions', row))
      await tx.insert(
        'question_sources',
        toRow('question_sources', { questionId: row.id, sourceAssetId: asset.id })
      )
      for (const name of tags) {
        await tx.insert('question_tags', toRow('question_tags', { questionId: row.id, tagId: `tag_${name}` }))
      }
    }
  })

  return true
}
