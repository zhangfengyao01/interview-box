import { uuid } from '@/utils/id'
import { addDays, DAY_MS, todayStart } from '@/utils/date'
import type { DatabaseAdapter } from '@/adapters/database/types'
import { toRow } from '@/adapters/database/mappers'
import type { MasteryStatus } from '@/types/models'
import { BUILTIN_CATEGORIES } from './categories'
import * as banks from './banks'

/**
 * 示例数据：5 个内置分类 + 16 个标签 + 148 道题
 * （前端 8 + 算法 4 + 产品 3 + 项目 3 + AI 大模型 14 + 前端题库 116：
 *   React 23 / TypeScript 26 / 编程 24 / 工程化 22 / 性能优化 21）。
 *
 * 写入策略分两条：
 * - `seedIfEmpty`：只在「库里一道题都没有」时写入（首次启动），
 *   用户清空数据后不会再被塞回来 —— 判断依据是 questions 表条数而不是某个 first_launch 标记，
 *   避免标记与实际数据不一致；
 * - `seedSupplement`：给**已有数据**的库补写后来新增的示例题（见函数注释）。
 *   加新题时把 `SEED_VERSION` +1 即可，老用户下次启动就能收到。
 */

/** 示例库版本：新增/修改内置示例题时 +1 */
export const SEED_VERSION = 3
const SEED_VERSION_KEY = 'interview_box_seed_version'

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
  { id: 'tag_项目复盘', name: '项目复盘', color: '#3B82F6' },
  { id: 'tag_大模型', name: '大模型', color: '#8B5CF6' },
  { id: 'tag_RAG', name: 'RAG', color: '#3B82F6' },
  { id: 'tag_Agent', name: 'Agent', color: '#10B981' },
  { id: 'tag_提示工程', name: '提示工程', color: '#F59E0B' },
  { id: 'tag_React', name: 'React', color: '#149ECA' },
  { id: 'tag_TypeScript', name: 'TypeScript', color: '#3178C6' }
]

/**
 * 示例题的「来源素材」。素材只服务于「这批题从哪来的」追溯展示，
 * 不同批次各挂各的素材，补种时按需创建。
 */
export const SEED_ASSETS: { id: string; rawText: string }[] = [
  { id: 'asset_seed_1', rawText: '面试题整理（示例）' },
  { id: 'asset_seed_ai', rawText: 'AI 大模型面试题（示例）' },
  { id: 'asset_seed_fe', rawText: '前端面试题合集（示例）' }
]

export interface SeedQuestion {
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
  /** 难度 1/2/3，缺省按 2 */
  difficulty?: 1 | 2 | 3
  /** 这批题挂在哪个来源素材下，缺省 asset_seed_1 */
  assetId?: string
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
    },
    ...buildAiQuestions(t),
    ...buildFrontendQuestions(t)
  ]
}

/**
 * 前端五大方向题库（116 道）单独拆到了 src/data/banks/：
 * React / TypeScript / 编程 / 工程化 / 性能优化，每个方向一个文件。
 * 答案统一是「面试简洁版」—— 结论先行、两三个展开点、手写题给最小可背实现。
 */
function buildFrontendQuestions(t: number): SeedQuestion[] {
  return banks.buildFrontendQuestions(t)
}

/**
 * AI 大模型方向的题（14 道）。
 *
 * 选这些题的依据是「大模型应用岗实际会问什么」，不是罗列名词：
 * RAG 的检索链路（召回 → 精排 → 压缩）、Agent 间的协议（A2A / MCP / ADK）、
 * 以及前端视角的流式渲染。参考回答都写到「能接住追问」的粒度 ——
 * 只写定义的话，面试官问一句「那你怎么落地」就没了。
 *
 * 单独拆一个函数是因为这块以后还会加，和前端那 18 道混在一个字面量里会越来越难读。
 */
function buildAiQuestions(t: number): SeedQuestion[] {
  const H = 3600 * 1000
  return [
    {
      title: '什么是 RAG？完整流程是怎么样的？',
      categoryId: 'cat_ai',
      referenceAnswer:
        'RAG（Retrieval-Augmented Generation）是「先检索、再生成」：把私有或时效性知识切块存进向量库，提问时先检索相关片段，拼进 prompt 让模型基于片段作答。链路分两段 —— 离线索引：文档解析 → 分块（按语义或标题切，几百 token、带重叠）→ 向量化 → 入库；在线问答：query 改写/扩展 → 混合检索召回 top-k → rerank 精排 → 组装上下文 → LLM 生成 → 引用回填。工程上还要有评测与反馈闭环，否则调参全靠感觉。',
      masteryStatus: 'learning',
      nextReviewAt: addDays(1),
      reviewCount: 1,
      isFavorite: true,
      createdAt: t - 3 * DAY_MS,
      tags: ['RAG', '大模型', '面试高频']
    },
    {
      title: '为什么 RAG 里要做 Rerank？具体怎么落地？',
      categoryId: 'cat_ai',
      referenceAnswer:
        '召回用的向量模型是双塔结构（query 和文档分别编码后算相似度），快但精度有限；rerank 用 cross-encoder 把 query 和文档拼在一起打分，精度明显更高但慢，所以只对召回的 topN（几十条）做精排，再取 topK（3~5 条）喂给模型。落地常用 bge-reranker、Cohere Rerank，或用 LLM 直接打分。真正的调参点是「召回多少、留多少」，要同时看 recall@k 和最终答案正确率，只看其中一个会跑偏。',
      masteryStatus: 'new',
      createdAt: t - 2 * DAY_MS,
      tags: ['RAG', '大模型']
    },
    {
      title: '什么是混合检索？为什么在基于大模型的应用里需要它？',
      categoryId: 'cat_ai',
      referenceAnswer:
        '稠密向量检索和稀疏检索（BM25/关键词）并行跑，再把两路结果融合排序。原因是向量擅长语义相似，但对型号、编号、专有名词这类「字面必须对上」的查询不敏感，比如问「XR-2000 的保修期」，向量可能召回一堆「售后服务」的段落，而 BM25 能精确命中型号。融合常用 RRF（按名次取倒数相加）或分数归一化后加权。代价是要维护两套索引加一个融合层。',
      masteryStatus: 'new',
      createdAt: t - 2 * DAY_MS - 4 * H,
      tags: ['RAG', '大模型']
    },
    {
      title: '什么是查询扩展？为什么在 RAG 应用中需要查询扩展？',
      categoryId: 'cat_ai',
      referenceAnswer:
        '把一句用户问法改写成多个查询分别检索，再合并去重。常见三种：Multi-Query（让模型生成 3~5 个同义或不同角度的问法）、HyDE（先生成一段假设答案，用它的向量去检索）、以及把复合问题拆成子问题逐个检索。它解决的是「用户措辞和文档措辞对不上」造成的漏召回。代价是检索次数和延迟上升，通常要配合缓存和并发。',
      masteryStatus: 'new',
      createdAt: t - 2 * DAY_MS - 8 * H,
      tags: ['RAG', '提示工程']
    },
    {
      title: '什么是 Self-Query（自查询）？为什么在 RAG 中需要自查询？',
      categoryId: 'cat_ai',
      referenceAnswer:
        '用模型从自然语言里拆出「语义查询 + 结构化过滤条件」。比如「2024 年之后发布、支持中文的向量库」→ 语义部分是「支持中文的向量库」，过滤条件是 year > 2023 且 lang = zh，先按元数据过滤再做向量检索。前提是给文档定义好元数据 schema 并写进 prompt。好处是能利用数据库的标量索引做前置裁剪，比纯向量检索更准、也更快。',
      masteryStatus: 'new',
      createdAt: t - 2 * DAY_MS - 12 * H,
      tags: ['RAG', '大模型']
    },
    {
      title: '什么是提示压缩？为什么在 RAG 中需要提示压缩？',
      categoryId: 'cat_ai',
      referenceAnswer:
        '上下文越长，无关内容越多，模型越容易被干扰（Lost in the Middle），成本和延迟也线性上升。压缩分三档：① 抽取式，按与 query 的相关度只保留关键句；② token 级压缩，用 LLMLingua 这类小模型判断哪些 token 可以删；③ 结构化压缩，先把长文档总结成要点再用。要注意压缩本身会丢信息，必须靠评测集兜住，不能凭感觉说「变短了但没变差」。',
      masteryStatus: 'new',
      createdAt: t - 44 * H,
      tags: ['RAG', '提示工程']
    },
    {
      title: 'A2A 协议有哪五大设计原则？',
      categoryId: 'cat_ai',
      referenceAnswer:
        'A2A 是 Google 2025 年提出、后交由 Linux Foundation 托管的 agent 互操作协议。官方五条原则：① 拥抱 agent 能力——agent 之间是黑盒协作，不要求暴露内部状态、工具和记忆；② 基于现有标准构建——HTTP、JSON-RPC 2.0、SSE；③ 默认安全——企业级认证授权，与 OpenAPI 的鉴权方案对齐；④ 支持长时任务——任务可异步、可流式、状态可恢复；⑤ 模态无关——不只文本，也支持音视频等。回答时补一句它的定位：解决的是 agent 与 agent 之间怎么通信，不是 agent 怎么用工具。',
      masteryStatus: 'new',
      createdAt: t - 40 * H,
      tags: ['Agent', '大模型', '面试高频']
    },
    {
      title: 'A2A 协议的工作原理是怎样的？',
      categoryId: 'cat_ai',
      referenceAnswer:
        '核心是三个对象：Agent Card（`/.well-known/agent.json`，描述能力、端点、鉴权方式，用于能力发现）、Task（一次协作的载体，有 id 和状态机 submitted / working / input-required / completed / failed）、Message 与 Artifact（对话消息与最终产物）。流程：客户端先拉 Agent Card → 发 `message/send` 或 `message/stream` 创建任务 → 服务端推进状态并通过 SSE 推送中间产物 → 需要补充信息时进入 input-required，客户端回填后继续。',
      masteryStatus: 'new',
      createdAt: t - 38 * H,
      tags: ['Agent', '大模型']
    },
    {
      title: 'A2A 协议与 MCP 协议的关系是怎样的？',
      categoryId: 'cat_ai',
      referenceAnswer:
        '不是竞争关系，是两层不同的事。MCP（Model Context Protocol，Anthropic 提出）解决「agent ↔ 工具/数据源」：把数据库、文件系统、API 以 tools / resources / prompts 的形式暴露给模型。A2A 解决「agent ↔ agent」：不同厂商、不同框架的 agent 之间怎么委派任务、交换产物。一句话记忆：MCP 竖着接资源，A2A 横着连同行。实际系统里通常两个都用。',
      masteryStatus: 'learning',
      nextReviewAt: addDays(2),
      reviewCount: 1,
      createdAt: t - 36 * H,
      tags: ['Agent', '大模型', '面试高频']
    },
    {
      title: '什么是 Google ADK？',
      categoryId: 'cat_ai',
      referenceAnswer:
        'Agent Development Kit，2025 年开源的 agent 开发框架（以 Python 为主，后续补了 Java），与 Gemini / Vertex AI 深度集成。特点是 code-first：agent 就是代码里的对象，用 instructions + tools 定义行为；内置多 agent 编排（Sequential / Parallel / Loop）、会话与状态管理、回调钩子；部署可以丢到 Vertex AI Agent Engine 或 Cloud Run。定位类似 LangGraph、OpenAI Agents SDK，选型主要看现有云环境和模型供应商。',
      masteryStatus: 'new',
      createdAt: t - 34 * H,
      tags: ['Agent', '大模型']
    },
    {
      title: 'Function Calling 的原理是什么？',
      categoryId: 'cat_ai',
      referenceAnswer:
        '模型并不真的执行函数，而是按预先给的 JSON Schema 输出一个结构化调用意图（函数名 + 参数），宿主程序解析后真正执行，再把结果作为一条 tool 消息回填，模型继续生成。工程上要处理：参数校验与失败重试、并行调用、超时、以及模型编造工具名的兜底。安全上工具必须白名单 + 最小权限，高危操作要人工确认。',
      masteryStatus: 'new',
      createdAt: t - 30 * H,
      tags: ['大模型', 'Agent']
    },
    {
      title: '微调和 RAG 该怎么选？',
      categoryId: 'cat_ai',
      referenceAnswer:
        '要「事实准确、可更新、可溯源」的知识 → RAG，改一行文档就生效，还能给引用；要「稳定的风格、格式、领域语气、固定输出结构」→ 微调（SFT / LoRA）。两者不互斥，常见组合是微调让小模型学会按格式调用检索、再用 RAG 灌知识。成本上 RAG 贵在推理 token 和检索延迟，微调贵在数据标注和迭代周期 —— 面试里把这笔账算清楚，比背定义有说服力。',
      masteryStatus: 'new',
      createdAt: t - 28 * H,
      tags: ['大模型', '技术选型']
    },
    {
      title: '怎么评测一套 RAG 系统？',
      categoryId: 'cat_ai',
      referenceAnswer:
        '拆成检索和生成两段评。检索端看 recall@k、MRR、nDCG，回答「该召回的有没有进来」；生成端看 faithfulness（答案是否都能被上下文支持）、answer relevance、context precision/recall，RAGAS 这类框架可以用模型当裁判自动打分。再往上要有自己的 golden set（真实问题 + 标准答案 + 应召回的 chunk id），每次改分块、换模型、改提示词都跑一遍回归，否则调参就是碰运气。',
      masteryStatus: 'learning',
      nextReviewAt: addDays(3),
      reviewCount: 1,
      createdAt: t - 26 * H,
      tags: ['RAG', '大模型', '技术能力']
    },
    {
      title: '大模型流式输出在前端怎么实现？',
      categoryId: 'cat_ai',
      referenceAnswer:
        '服务端把模型输出转成 SSE（`text/event-stream`）或 WebSocket 逐块推；前端用 fetch + ReadableStream 读（`response.body.getReader()`）—— EventSource 只支持 GET 且不能自定义 header，带鉴权一般还是用 fetch 流式。渲染上有三个坑：按帧合并 chunk 再更新状态（每个 token 一次 setState 会卡）、自动滚动要先判断用户是否手动上滑、Markdown 要能增量解析（未闭合的代码块会导致整段渲染抖动）。中断用一个 AbortController，同时把半截内容存下来。',
      masteryStatus: 'new',
      createdAt: t - 22 * H,
      tags: ['大模型', '技术能力', '面试高频']
    }
  ]
}

/** 首次启动写入示例数据；已有数据则跳过，返回是否真的写过 */
export async function seedIfEmpty(db: DatabaseAdapter): Promise<boolean> {
  const existing = await db.count('questions')
  if (existing > 0) return false

  const t = Date.now()

  await db.transaction(async (tx) => {
    for (const c of BUILTIN_CATEGORIES) {
      await tx.insert('categories', toRow('categories', { ...c, createdAt: t, updatedAt: t }))
    }
    await tx.insertMany(
      'tags',
      SEED_TAGS.map((tag) => toRow('tags', { ...tag, createdAt: t }))
    )

    for (const asset of SEED_ASSETS) {
      await tx.insert(
        'source_assets',
        toRow('source_assets', {
          id: asset.id,
          sourceType: 'text' as const,
          filePath: null,
          rawText: asset.rawText,
          editedText: asset.rawText,
          ocrEngine: 'manual',
          createdAt: t
        })
      )
    }

    for (const item of buildQuestions()) {
      await insertSeedQuestion(tx, item, item.assetId ?? 'asset_seed_1', t)
    }
  })

  writeSeedVersion()
  return true
}

/**
 * 给「已经有数据」的库补写新增的示例题。
 *
 * 为什么需要它：`seedIfEmpty` 看到库里已经有题就直接返回了 ——
 * 老用户（或者自己已经录了题的库）永远收不到后来新增的示例题。
 * 直接在 `seedIfEmpty` 里改成"每次都补"也不行：用户删掉的示例题会被反复塞回来。
 *
 * 所以做成两把锁：
 *  1. 版本号（`interview_box_seed_version`）—— 版本没变就完全跳过，正常启动零开销；
 *  2. 标题去重 —— 即使版本号丢了，也只补库里真没有的题，不会重复，也不会复活用户删掉的
 *     （删掉的是软删，`db.all('questions')` 拿得到，仍在去重集合里）。
 *
 * 只增不改：不动用户已有的题、笔记、答案和复习记录。
 */
export async function seedSupplement(db: DatabaseAdapter): Promise<number> {
  if (readSeedVersion() >= SEED_VERSION) return 0

  const rows = await db.all('questions')
  if (rows.length === 0) {
    // 空库交给 seedIfEmpty 走全量，这里不动手
    writeSeedVersion()
    return 0
  }

  const have = new Set(rows.map((r) => normTitle(String(r.title || ''))))
  const t = Date.now()
  let added = 0

  /** 来源素材按需创建：老库可能只有 asset_seed_1，缺哪个补哪个 */
  const ensureAsset = async (tx: DatabaseAdapter, id: string): Promise<void> => {
    const hit = await tx.first('source_assets', { eq: { id } })
    if (hit) return
    const def = SEED_ASSETS.find((a) => a.id === id)
    await tx.insert(
      'source_assets',
      toRow('source_assets', {
        id,
        sourceType: 'text' as const,
        filePath: null,
        rawText: def?.rawText ?? '示例题（补充批次）',
        editedText: def?.rawText ?? '示例题（补充批次）',
        ocrEngine: 'manual',
        createdAt: t
      })
    )
  }

  await db.transaction(async (tx) => {
    for (const c of BUILTIN_CATEGORIES) {
      const hit = await tx.first('categories', { eq: { id: c.id } })
      if (!hit) {
        await tx.insert('categories', toRow('categories', { ...c, createdAt: t, updatedAt: t }))
      }
    }
    for (const tag of SEED_TAGS) {
      const hit = await tx.first('tags', { eq: { id: tag.id } })
      if (!hit) {
        await tx.insert('tags', toRow('tags', { ...tag, createdAt: t }))
      }
    }

    const missing = buildQuestions().filter((q) => !have.has(normTitle(q.title)))
    if (!missing.length) return

    for (const item of missing) {
      const assetId = item.assetId ?? 'asset_seed_1'
      await ensureAsset(tx, assetId)
      await insertSeedQuestion(tx, item, assetId, t)
      added += 1
    }
  })

  writeSeedVersion()
  return added
}

/** 一条示例题落库：题目 + 来源关系 + 标签关系 */
async function insertSeedQuestion(
  tx: DatabaseAdapter,
  item: SeedQuestion,
  assetId: string,
  t: number
): Promise<void> {
  const { tags, ...rest } = item
  const row = {
    id: uuid(),
    title: rest.title,
    content: '',
    referenceAnswer: rest.referenceAnswer || '',
    myAnswer: rest.myAnswer || '',
    notes: rest.notes || '',
    categoryId: rest.categoryId,
    difficulty: rest.difficulty ?? 2,
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
    toRow('question_sources', { questionId: row.id, sourceAssetId: assetId })
  )
  for (const name of tags) {
    await tx.insert('question_tags', toRow('question_tags', { questionId: row.id, tagId: `tag_${name}` }))
  }
}

/** 去掉空白再比，避免「什么是 RAG？」与「什么是RAG?」被当成两道题 */
function normTitle(s: string): string {
  return s.replace(/\s+/g, '').trim()
}

function readSeedVersion(): number {
  try {
    return Number(uni.getStorageSync(SEED_VERSION_KEY) || 0)
  } catch {
    return 0
  }
}

function writeSeedVersion(): void {
  try {
    uni.setStorageSync(SEED_VERSION_KEY, SEED_VERSION)
  } catch {
    // 存不下版本号只会导致下次多跑一遍去重，不影响正确性
  }
}
