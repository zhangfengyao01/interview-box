/**
 * 性能优化题库（21 题，来源：面试题图 · 性能优化页）。
 * 原图 15 与 React 页「性能优化方法」重复、21 与工程化页「webpack 优化性能」重复，各只录一条。
 */
import type { BankItem } from './types'

export const PERF_BANK: BankItem[] = [
  {
    title: 'script 标签放在 header 里和放在 body 底部里有什么区别？',
    difficulty: 1,
    answer:
      'script 默认会阻塞 HTML 解析：解析到脚本要等它下载并执行完才继续，放 head 里且脚本大时，页面会长时间白屏——因为 DOM 还没解析出来。放 body 底部让 DOM 先解析完，脚本不阻塞首屏内容渲染，但首屏可用时间仍受脚本执行影响。现代方案是 head 里加 defer（下载不阻塞、DOMContentLoaded 前按序执行）或 async（下载不阻塞、执行时机不定），两者都比「挪到底部」更好，因为下载阶段可以并行。'
  },
  {
    title: '前端性能优化指标有哪些？怎么进行性能检测？',
    difficulty: 2,
    extraTags: ['面试高频'],
    answer:
      'Core Web Vitals 三件套：LCP（最大内容绘制，2.5s 内好）、INP（交互到下一帧，200ms 内好）、CLS（累积布局偏移，0.1 内好）；辅助指标 FCP（首次内容绘制）、TTFB、DOMContentLoaded/Load。检测三路：① 实验室——Lighthouse/Chrome DevTools Performance 面板；② 线上真实用户（RUM）——PerformanceObserver 采集 web-vitals 库指标上报；③ 压测/竞品对比。原则：先定指标基线和目标，再优化，否则无法证明有效。'
  },
  {
    title: 'SPA（单页应用）首屏加载速度慢怎么解决？',
    difficulty: 2,
    extraTags: ['面试高频'],
    answer:
      '按「资源到得早、包体更小、首屏先渲染」三板斧：① 网络——CDN、HTTP2、gzip/brotli、DNS 预解析、关键资源 preload；② 包体——路由级代码分割（懒加载）、三方库按需引入、Tree Shaking、分析 bundle 砍大头；③ 首屏策略——SSR/SSG 或预渲染让 HTML 先到、骨架屏改善体感、接口预取（prefetch data）、非首屏组件延迟加载；④ 缓存——contenthash 长缓存 + HTML 不缓存。落地时先量 LCP 找瓶颈，别平均用力。'
  },
  {
    title: '如何使用 CSS 提高页面性能？',
    difficulty: 2,
    answer:
      '四个方向：① 阻塞控制——关键 CSS 内联首屏、非关键 CSS 异步加载（media 交换技巧）、避免 @import 串行加载；② 渲染成本——少用会触发重排的属性做动画（用 transform/opacity 走合成层）、will-change 提升前告知、contain 限定重排范围；③ 选择器——避免过深嵌套和通配符（现代引擎影响小但仍有意义）、减少 layout-thrashing 的读写交替；④ 内容可见性——content-visibility: auto + contain-intrinsic-size 让屏外内容跳过渲染，长列表收益巨大。'
  },
  {
    title: '怎么进行站点内的图片性能优化？',
    difficulty: 2,
    answer:
      '格式、尺寸、加载时机三层：① 格式——优先 WebP/AVIF（比 JPEG 小 25~50%），图标用 SVG，简单图用 CSS 代替；② 尺寸——按显示尺寸出图 + srcset/sizes 响应式多倍图、压缩（质量 75 左右性价比最高）、图标合并雪碧图或直接 SVG symbol；③ 加载——首屏外的图 loading="lazy" 懒加载、首屏 LCP 图 preload + fetchpriority="high"、占位防 CLS（定宽高）、小图转 base64 内联省请求。核心原则：对的字节、对的时间、对的位置。'
  },
  {
    title: '虚拟 DOM 一定更快吗？',
    difficulty: 3,
    answer:
      '不一定。虚拟 DOM 是「用 JS 计算换 DOM 操作」的折中：它的优势是比**盲目的全量 innerHTML 重渲染**快、比**手工精细操作 DOM** 省心，但直接对比性能上限，精心手写的定向 DOM 更新（或者编译期知道该更新哪的模板方案）可以完全绕过 diff，比虚拟 DOM 更快。虚拟 DOM 卖点其实是声明式开发体验 + 跨平台能力（渲染器可换），性能只是「够快且稳定」。能说出「vdom 的对手是 manual DOM manipulation，不是原生 DOM」这句是加分项。'
  },
  {
    title: '有些框架不用虚拟 DOM，但是它们的性能也不错，是为什么？',
    difficulty: 3,
    answer:
      '代表是 Svelte 和 SolidJS，思路是「编译时框架」：编译器在构建期就分析出「哪个状态变了会影响哪段 DOM」，直接生成定向更新的代码（细粒度响应式 + 预编译的 DOM 操作），运行时既不需要 diff 也不需要 vdom。性能好是因为把「运行时才能做的决策」提前到了编译期，产物小且没有 diff 开销。代价是灵活性：动态性特别强的结构（组件类型运行时才确定）表达起来更绕。Vue 3 模板层的 patchFlag 也是同思路的折中——保留 vdom 但用编译信息缩小 diff 范围。'
  },
  {
    title: '如果某个页面有几百个函数需要执行，可以怎么优化页面？',
    difficulty: 2,
    answer:
      '先分类再动手：① 降频——事件回调做防抖节流，被动监听 passive: true；② 延后——非关键逻辑用 requestIdleCallback / setTimeout 拆到空闲期，任务切片（每片 <50ms）避免长任务阻塞交互；③ 按需——懒执行（用到才算）、缓存函数结果（memoize）避免重复计算；④ 并行——纯计算量大就丢 Web Worker；⑤ 批处理——操作 DOM 的函数合并到一帧内（rAF 批量写）。本质都是同一个原则：别让主线程同时干所有事。'
  },
  {
    title: '讲下 png8、png16、png32 的区别，并简单讲讲 png 的原理',
    difficulty: 2,
    answer:
      '数字指的是颜色深度：png8 每像素 8 位（256 色的调色板索引），体积最小，适合扁平插画和图标；png24 指 RGB 各 8 位（约 1670 万色，无 alpha）；png32 = png24 + 8 位 alpha 通道，支持半透明。PNG 原理：无损压缩——先做预测滤波（每个像素记录与预测值的差值，让数据更集中），再用 DEFLATE（LZ77 + 哈夫曼）压缩，所以照片类内容压不动，适合线条、文字、需要透明的图。对比记忆：jpg 有损适合照片、png 无损适合图形和透明。'
  },
  {
    title: '页面加载过程中，JS 文件是不是一定会阻塞 DOM 解析和渲染？',
    difficulty: 2,
    answer:
      '分情况，不是一定：① 默认 script——阻塞解析（HTML 解析器要停下来等下载+执行，因为脚本可能改写 DOM）；② async——下载不阻塞解析，但执行时会暂停解析（执行顺序不保证）；③ defer——下载不阻塞，解析完按序执行（DOMContentLoaded 之前）；④ type="module"——默认 defer 行为。渲染（绘制）则是另一回事：即使解析被阻塞，浏览器可能先渲染已解析的部分。一句话：默认阻塞解析、defer/async 下载不阻塞、执行时机不同。'
  },
  {
    title: 'React.memo() 和 useMemo() 的用法是什么，有哪些区别？',
    difficulty: 2,
    answer:
      'React.memo 是**组件级**缓存：高阶组件，对 props 做浅比较，相同就跳过整个组件重渲染，用于「父组件更新但这个组件的 props 没变」的场景；useMemo 是**值级**缓存：缓存一次昂贵计算的结果，依赖数组不变就不重算，用于组件内部。配合关系：父组件传对象/函数字面量给 memo 子组件时，必须用 useMemo/useCallback 包住，否则每次渲染都是新引用，memo 直接失效。一句话：memo 缓存组件，useMemo 缓存数据，经常搭配使用。'
  },
  {
    title: '导致页面加载白屏时间长的原因有哪些，怎么进行优化？',
    difficulty: 2,
    answer:
      '先定位原因再对症：① 网络慢——TTFB 高、资源大：CDN、压缩、HTTP2、预连接；② JS 包太大——首屏 bundle 动辄几 MB：代码分割、懒加载、按需引入、摇树；③ 渲染被阻塞——head 里同步脚本、关键 CSS 缺失：defer、关键 CSS 内联；④ 渲染链路长——纯 CSR 要等「HTML→JS 下载执行→接口返回→渲染」全链路：SSR/SSG/预渲染、接口预取、骨架屏；⑤ 执行错误——脚本异常直接白屏：ErrorBoundary、错误监控。优化顺序永远是：先用 Performance 面板/水滴图定位是哪段慢。'
  },
  {
    title: '如果一个列表有 100000 个数据，这个该怎么进行展示？',
    difficulty: 2,
    extraTags: ['面试高频'],
    answer:
      '核心思路：只渲染看得见的。虚拟滚动是标准答案——容器固定高度、内部用一个撑起总高度的占位元素，监听滚动算出可视区间 start/end，只渲染这一段（上下多渲染几条缓冲），用 transform 或 padding 定位偏移，监听 scroll 时重算；不定高场景用「预估高度 + 渲染后修正」或二分定位。补充手段：分页 + 无限滚动、搜索/过滤前置到服务端、数据不直接全量拉。React 用 react-window，Vue 用 vue-virtual-scroller；追问「每项高度不同」时要能讲修正策略。'
  },
  {
    title: 'DNS 预解析是什么？怎么实现？',
    difficulty: 1,
    answer:
      'DNS 解析是请求链路的第一跳（几十到几百毫秒），预解析就是提前完成它：<link rel="dns-prefetch" href="//api.example.com">。浏览器也会自动对页面里出现的域名做预解析（X-DNS-Prefetch-Control 头控制开关）。和它容易混的是 preconnect——更进一步，除了 DNS 还提前完成 TCP 握手和 TLS 协商：<link rel="preconnect">，用于确定马上要请求的关键域名（API、CDN）。用法：对「马上要用」的域名用 preconnect，对「稍后可能用」的用 dns-prefetch，别滥用。'
  },
  {
    title: '浏览器为什么要请求并发数限制？',
    difficulty: 2,
    answer:
      '服务端和客户端两头的原因：① 保护服务端——每个连接占内存和文件句柄，无限制并发会瞬间打垮服务器，也容易被恶意请求攻击；② 客户端公平——多标签页、多站点共享带宽和本地资源，限制单域并发避免一个站点饿死其他站点；③ 本地瓶颈——HTTP1.1 时代浏览器对同域限制 6 个左右，超出的请求排队，这也是「域名分片」和「升级 HTTP2」的由来。HTTP2 多路复用后一条连接就能并发多个流，浏览器对 HTTP2 的并发限制放宽到每域一条连接，限制就从「连接数」变成了「流数」。'
  },
  {
    title: '如何确定页面的可用性时间，什么是 Performance API？',
    difficulty: 2,
    answer:
      'Performance API 提供高精度时间线：performance.now() 是单调时钟，适合测量代码执行耗时；performance.timing（旧）/ PerformanceNavigationTiming（新）给出导航全过程的时间点（DNS、TCP、响应、DOM 解析、load），相减得到各阶段耗时；PerformanceObserver 异步订阅 paint（FCP）、LCP、CLS、长任务（longtask）等指标。可用性（用户真正能操作）通常用「首屏内容可见 + 主线程可响应」衡量：以 LCP 或自定义首屏标记 + FID/INP 组合上报，web-vitals 库是现成封装。'
  },
  {
    title: '谈谈对 window.requestAnimationFrame 的理解',
    difficulty: 2,
    answer:
      'rAF 告诉浏览器「下一帧重绘前执行这个回调」，回调频率与屏幕刷新率对齐（60Hz 就是约 16.7ms 一次）。三大价值：① 对齐渲染节拍——动画按帧调度，不撕裂不掉帧；② 自动暂停——标签页不可见时 rAF 停止，省电（setTimeout 不会停）；③ 批量 DOM 更新——把多次写合并到一帧，避免布局抖动。对比 setTimeout 做动画：间隔不受控、可能跳帧、后台照跑。用式：递归调用 rAF 实现循环动画，配 cancelAnimationFrame 取消。'
  },
  {
    title: 'CSS 加载会造成阻塞吗？',
    difficulty: 2,
    answer:
      '会，但阻塞的对象不同：① CSS 不阻塞 HTML 解析（DOM 树照常构建）；② 阻塞渲染——浏览器规则是「CSSOM 构建完成前不渲染任何内容」，避免无样式闪烁，所以 head 里的 CSS 没加载完页面就白着；③ 阻塞其后的 JS——JS 可能要读样式（getComputedStyle），所以 CSS 之后声明的同步 JS 要等 CSS 加载完才执行。优化：关键 CSS 内联、非关键 CSS 异步（media 打印技巧或 preload）、避免 @import 串行、压缩拆分。'
  },
  {
    title: '什么是内存泄漏？什么原因会导致呢？',
    difficulty: 2,
    extraTags: ['面试高频'],
    answer:
      '该被回收的内存因为仍被引用而无法释放，持续累积导致页面越来越卡甚至崩溃。JS 里常见原因：① 意外的全局变量（漏 var/赋值给未声明变量）；② 被遗忘的定时器和回调（setInterval 一直持有闭包）；③ 闭包长期持有大对象；④ 游离的 DOM 引用（JS 变量还存着已从页面移除的节点）；⑤ 事件监听未解绑（尤其组件卸载时）；⑥ 无限增长的缓存/Map。排查用 Chrome Memory 面板拍堆快照对比增长，或 Performance 录制看内存阶梯式不回落。预防：卸载时统一清理（useEffect 的 cleanup、onUnmounted）。'
  },
  {
    title: '说说常规的前端性能优化手段',
    difficulty: 2,
    extraTags: ['面试高频'],
    answer:
      '按「网络 → 体积 → 渲染 → 运行时 → 感知」五段答：网络——CDN、HTTP2、强缓存+协商缓存、预连接/预加载；体积——代码分割、摇树、压缩（JS/CSS/图片、WebP）、按需引入组件库；渲染——关键 CSS 内联、首屏 SSR/骨架屏、图片懒加载、虚拟列表；运行时——防抖节流、长任务切片、Web Worker、避免内存泄漏；感知——骨架屏、渐进加载、乐观更新。回答时一定补一句方法论：先建立指标基线（LCP/INP/CLS）→ Performance 定位瓶颈 → 针对性优化 → 复测对比，面试官要的是工程思路不是清单背诵。'
  },
  {
    title: '什么是 CSS Sprites？',
    difficulty: 1,
    answer:
      '雪碧图：把多个小图标合并成一张大图，用 background-position 偏移显示对应区域，减少 HTTP 请求数。是 HTTP1.1 时代（同域 6 并发限制）的经典优化，优点是请求合并、总字节数更小；缺点是维护麻烦（加图标要重出图）、无法按需缓存（改一个图标整图缓存失效）、高清屏要出多倍图。现代替代：iconfont 字体、SVG symbol 复用（可缩放可变色）、或直接上 HTTP2 后不再强求请求合并。回答时点出「它的历史背景和为什么现在用得少了」最能体现理解。'
  }
]
