#!/usr/bin/env node
/**
 * 拆题规则的回归验证：`npm run verify:segment`
 *
 * 为什么要有它：拆题是纯规则，改一条正则就可能悄悄改掉别处的行为。
 * 尤其 `ocr-list-screenshot.txt` 这份夹具——它是**真实**的识别输出（手机截屏里一串
 * 题目列表、题号是界面图标，OCR 认不出来）。当初这份文本只拆出 2 条垃圾，
 * 用户看到的就是「识别处理不对」。这里把它和一批常规格式一起钉死。
 */
import { build } from 'esbuild'
import { readFileSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const outfile = join(root, '.verify-segment.bundle.mjs')

await build({
  entryPoints: [join(root, 'src/services/question/segmenter.ts')],
  bundle: true,
  format: 'esm',
  outfile,
  logLevel: 'error'
})
const { splitQuestions, segmentationHint } = await import('file://' + outfile.split('\\').join('/'))

let pass = 0
let fail = 0

function check(name, cond, extra = '') {
  if (cond) {
    pass += 1
    console.log(`  PASS  ${name}`)
  } else {
    fail += 1
    console.log(`  FAIL  ${name}${extra ? ' — ' + extra : ''}`)
  }
}

function section(title) {
  console.log(`\n[${title}]`)
}

// ---------------------------------------------------------------- 真实截图
// 两份都是**真实**识别输出，不是手写的：同一张手机截图，两条链路各跑一遍。
// Node（tesseract.js，chi_sim，psm6）把图标认成「《O / 《9 / 《约」，
// 浏览器（同一套 wasm，但走 canvas）认成「《O / 《DRAG / 人 / 人9」。
// 拆题规则必须两边都干净 —— 只修一边的话，换端就复发。
const FIXTURES = [
  { file: 'ocr-list-screenshot.txt', label: 'Node 链路' },
  { file: 'ocr-list-browser.txt', label: '浏览器链路' }
]

const EXPECTED = [
  '什么是 RAG? RAG 的主要流程是什么?',
  '什么是 RAG 中的 Rerank? 具体需要怎么',
  'A2A 协议有哪五大设计原则?',
  '什么混合检索? 在基于大模型的应用开发',
  '什么是 Google ADK?',
  'RAG 的完整流程是怎么样的?',
  'A2A 协议的工作原理是怎样的?',
  '在RAG 应用中为了优化检索精度，其中的',
  'A2A 协议的工作流程是怎样的?',
  '什么查询扩展? 为什么在 RAG 应用中需要',
  'A2A协议 与 MCP 协议的关系是怎样的?',
  '什么自查询? 为什么在 RAG 中需要自查询?',
  '什么提示压缩? 为什么在 RAG 中需要提示'
]

for (const { file, label } of FIXTURES) {
  section(`真实截屏识别文本 · ${label}`)
  const fixture = readFileSync(join(here, 'fixtures', file), 'utf8')
  const list = splitQuestions(fixture)
  check('拆出 13 条', list.length === 13, `实际 ${list.length}`)
  // 两条链路只在「空格有无」上不同（`在RAG` / `在 RAG`）。空格是 OCR 层面的抖动，
  // 不属于拆题该负责的事，比对时统一去掉空白字符，只比字。
  const norm = (s) => String(s).replace(/\s+/g, '')
  const diff = EXPECTED.map((want, i) => [want, norm(list[i]?.title)]).filter(
    ([want, got]) => norm(want) !== got
  )
  check('13 条题面逐条对得上', diff.length === 0, JSON.stringify(diff))
  check('没有把【第 1 张】当题目', !list.some((r) => r.title.includes('第 1 张')))
  check('没有把状态栏时间当题目', !list.some((r) => /^49\b/.test(r.title)))
  check('没有把页头当题目', !list.some((r) => r.title.includes('最全Al大模型面')))
  check(
    '英文词完整保留',
    list.some((r) => r.title.includes('Google ADK')) && list.some((r) => r.title.includes('A2A'))
  )
  check('难度标签没粘在题面上', !list.some((r) => /(简单|中等)$/.test(r.title)), JSON.stringify(list.map((r) => r.title)))
  check('每条都是题面而非整段', list.every((r) => r.content.length < 120))
  check(
    '题号图标残渣全部清掉',
    !list.some((r) => /^[《«‹〈（(【[{|｜>＜]/.test(r.title)),
    JSON.stringify(list.map((r) => r.title))
  )
  check('第 8 条开头的「在」没被当成残渣吃掉', list[7]?.title.startsWith('在'), JSON.stringify(list[7]?.title))
  check('质量提示为 good', segmentationHint(fixture).level === 'good')
}

// 题号图标被认成「图标 + 数字 / 图标 + 半个图标 / 图标 + 一个汉字」三种形态，
// 清理规则里这两类分支最容易写错：写松了吃正文，写紧了漏残渣。逐条钉死。
section('题号图标残渣的三种形态')
const badges = `《2 什么是 RAG?
《2 在 RAG 应用中为了优化检索精度… 中
《约 什么提示压缩? 为什么在 RAG 中需要提示压缩?
《OA2A 协议的工作流程是怎样的?
《0 A2A 协议的工作原理是怎样的?
《9 什么是 Google ADK?`
const b = splitQuestions(badges)
check('拆出 6 条', b.length === 6, `实际 ${b.length}`)
check('图标+数字', b[0]?.title === '什么是 RAG?', JSON.stringify(b[0]?.title))
check('图标+数字后面跟汉字不被吞', b[1]?.title === '在 RAG 应用中为了优化检索精度', JSON.stringify(b[1]?.title))
check('图标+单个汉字', b[2]?.title.startsWith('什么提示压缩?'), JSON.stringify(b[2]?.title))
check('图标+半个图标（O）', b[3]?.title === 'A2A 协议的工作流程是怎样的?', JSON.stringify(b[3]?.title))
check('图标+数字 0 不吞掉后面的 A2A', b[4]?.title === 'A2A 协议的工作原理是怎样的?', JSON.stringify(b[4]?.title))
check('图标+数字 9', b[5]?.title === '什么是 Google ADK?', JSON.stringify(b[5]?.title))

// 浏览器那条链路（tesseract.js 在 Chromium 里跑）认出来的残渣和 Node 不一样：
// 图标变成「人 / D / 人9」，行尾还会多挂一个右引号。这些是从真实 E2E 输出里抄下来的。
section('浏览器链路的残渣形态')
const browserish = `D RAG 的完整流程是怎么样的?
人 在 RAG 应用中为了优化检索精度… 中
人9 A2A 协议 与 MCP 协议的关系是怎样的?
什么查询扩展? 为什么在 RAG 应用中需要..，，”`
const c = splitQuestions(browserish)
check('拆出 4 条', c.length === 4, `实际 ${c.length}`)
check('图标被认成大写字母 D', c[0]?.title === 'RAG 的完整流程是怎么样的?', JSON.stringify(c[0]?.title))
check('图标被认成「人」，正文的「在」保留', c[1]?.title === '在 RAG 应用中为了优化检索精度', JSON.stringify(c[1]?.title))
check('图标被认成「人9」', c[2]?.title === 'A2A 协议 与 MCP 协议的关系是怎样的?', JSON.stringify(c[2]?.title))
check('行尾标点连右引号一起清掉', c[3]?.title === '什么查询扩展? 为什么在 RAG 应用中需要', JSON.stringify(c[3]?.title))

// 白名单不能变成「任意单个汉字」，否则「问 什么是闭包？」会被削掉首字
const keepFirst = `问 什么是闭包?
答 什么是原型链?
讲 什么是事件循环?`
check('单字 + 空格开头但不在白名单里 → 不削', splitQuestions(keepFirst)[0]?.title.startsWith('问 '))

// ---------------------------------------------------------------- 常规格式
section('常规编号格式（不能被列表模式带偏）')
const numbered = `1. 请介绍一下你对前端工程化的理解？
解析：模块化、自动化构建、代码规范、持续集成。

2. 你如何看待前端框架的选择？
解析：团队技术栈、项目需求、生态支持。`
const n = splitQuestions(numbered)
check('拆出 2 条', n.length === 2, `实际 ${n.length}`)
check('解析归入 referenceAnswer', n[0]?.referenceAnswer.includes('模块化'))
check('不会把「？」当成新题边界', n.every((r) => !r.title.startsWith('解析')))

section('多种编号写法')
check('中文顿号「1、」', splitQuestions('1、什么是闭包？').length === 1)
check('括号「(2)」', splitQuestions('(2) 什么是原型链？').length === 1)
check('「Q1:」', splitQuestions('Q1: 什么是事件循环？').length === 1)
check('「1】」', splitQuestions('1】 什么是重排？').length === 1)

// ---------------------------------------------------------------- 负例
section('不该被拆散的情形')
const oneQuestion = '什么是 RAG？它和微调有什么区别？什么场景下该选哪个？'
check('单条多问句不按行拆', splitQuestions(oneQuestion).length === 1)

const prose = `面试里常被问到的问题很多，比如工程化怎么落地、性能怎么优化、团队协作怎么推进，
这些都需要结合具体项目讲清楚自己的判断，而不是背概念。
所以准备的时候要按自己的经历来组织答案，别照抄模板。`
check('长句散文不被拆成多条', splitQuestions(prose).length === 1)

const clock = `01:49 状态栏
什么是闭包？
什么是原型链？
什么是事件循环？`
check('状态栏时间不当题号', splitQuestions(clock).length === 3, `实际 ${splitQuestions(clock).length}`)

section('兜底与提示')
check('空文本返回空数组', splitQuestions('   ').length === 0)
check('单行文本能拆成 1 条', splitQuestions('什么是虚拟 DOM？').length === 1)
const hint = segmentationHint(readFileSync(join(here, 'fixtures/ocr-list-screenshot.txt'), 'utf8'))
check('质量提示为 good', hint.level === 'good', hint.message)

await rm(outfile, { force: true })
console.log(`\n${fail === 0 ? '全部通过' : '有失败项'}：${pass} 通过 / ${fail} 失败`)
process.exit(fail === 0 ? 0 : 1)
