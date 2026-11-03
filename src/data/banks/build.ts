/**
 * 工程化题库（22 题，来源：面试题图 · 工程化页）。
 * 原图 22/23 两题同为 tree shaking 原理，只录一条。
 */
import type { BankItem } from './types'

export const BUILD_BANK: BankItem[] = [
  {
    title: 'package.json 文件中的 devDependencies 和 dependencies 有什么区别？',
    difficulty: 1,
    answer:
      'dependencies 是运行时必需的依赖，生产环境也要装（npm install --production 只装它）；devDependencies 只在开发和构建期用——打包器、转译器、测试框架、linter，产物里不包含它们。判断标准一句话：这个包会被打进最终产物吗？会就进 dependencies。还要注意：bundler 会摇树，别把「只是构建工具」的包误装进 dependencies，会拖累生产安装体积和时间。'
  },
  {
    title: 'webpack5 的主要升级点有哪些？',
    difficulty: 2,
    answer:
      '五个常被问到的：① 持久化缓存 cache.type: "filesystem"，二次构建速度大幅提升；② 模块联邦（Module Federation），多个应用之间直接共享运行时模块，微前端的重要基建；③ node_modules 里的第三方模块不再被 polyfill 塞爆（target 默认 web，自动按需）；④ 更好的 Tree Shaking（嵌套导出、内部模块级 CommonJS 树摇）；⑤ 资源模块内置——asset/resource 等四种模式取代 file-loader/url-loader。加上长期缓存算法和更小的包体。'
  },
  {
    title: '说下 Vite 的原理',
    difficulty: 2,
    answer:
      '开发时「不打包、用原生 ESM」：浏览器 import 到哪个模块，Vite 就按需编译哪个，请求进来走 esbuild（Go 写的，比 babel 快一个量级）把 TS/JSX 现场转成浏览器能跑的 ESM 返回——所以冷启动是毫秒级的，与项目大小几乎无关，只跟你当前打开的页面有关。热更新也是精确到模块的 HMR 边界替换，不走整包重新打包。生产环境则用 Rollup 打包（现在也可以切 Rolldown），因为产物要考虑兼容、摇树和体积，裸 ESM 会引发瀑布式请求。一句话：开发依赖预构建（esbuild）+ 按需编译，生产 Rollup。'
  },
  {
    title: '与 webpack 类似的工具还有哪些？区别？',
    difficulty: 2,
    answer:
      '按代际说：Rollup——基于 ESM 的打包器，摇树干净、产物干净，适合库开发，Vite 生产端用的就是它；esbuild——Go 写的 bundler/minifier，速度快 10~100 倍，常被拿来当预构建和压缩器；Parcel——零配置 bundler，开箱即用；Vite——dev 走原生 ESM 的下一代构建工具；Rspack/Turbopack——Rust 重写的 webpack 兼容/下一代方案，主打速度。定位区别：webpack 全能但慢、配置重，Rollup 适合库，esbuild 适合快，Vite 平衡了开发体验和生产产物。'
  },
  {
    title: '说说如何借助 webpack 来优化前端性能',
    difficulty: 2,
    answer:
      '按「加载快、包体小、缓存稳」三条线：① 代码分割——import() 动态加载、splitChunks 抽公共包，路由级懒加载；② 压缩——TerserPlugin 压 JS、CssMinimizerPlugin、图片压缩；③ 摇树——生产模式 + ESM 写法 + sideEffects 标记；④ 缓存——contenthash 文件名 + runtime chunk 抽离 + moduleIds: "deterministic"，业务改动不影响三方包的缓存；⑤ 体验——preload/prefetch 注入、gzip/brotli 预压缩。每个手段都要能说出「解决了什么」。'
  },
  {
    title: 'webpack proxy 工作原理？为什么能解决跨域？',
    difficulty: 2,
    answer:
      'dev-server 在本地起了一个 Node 中间件（http-proxy-middleware），浏览器请求的是**同源的 dev-server**，dev-server 在服务端把请求转发给真正的目标接口——跨域是浏览器的同源策略限制的，服务端之间不存在这个限制。所以它解决跨域的本质是「同源代理 + 服务端转发」，只存在于开发环境；生产的跨域要靠 Nginx 反向代理或 CORS 响应头。面试要能点出「浏览器的限制，不是 HTTP 的限制」这句话。'
  },
  {
    title: '说说 webpack 的热更新是如何做到的？原理是什么？',
    difficulty: 3,
    answer:
      'HMR 链路四步：① 文件变化时 webpack 增量编译，产出 patch（manifest + 更新模块的 hash）；② dev-server 通过 WebSocket 推送新 hash 给浏览器；③ 客户端 HMR runtime 拿 hash 发起 JSONP 请求拉取更新内容；④ module.hot.accept 里对可热替换的模块执行新代码替换旧模块，并向上冒泡找「接受更新的边界」；找不到边界（比如改了入口依赖的根模块）就整页刷新。关键概念：HMR Runtime 跑在 bundle 里，与 dev-server 的 WebSocket 配合完成「不刷新页面的模块替换」。'
  },
  {
    title: '面试官：说说 Loader 和 Plugin 的区别？编写一个 Loader',
    difficulty: 2,
    answer:
      'Loader 是「文件转换器」：把非 JS 资源翻译成模块（sass→css、ts→js），本质是接收源码字符串、返回结果的纯函数，链式执行、从右到左。Plugin 介入的是「构建生命周期」：通过 tapable 钩子在编译的各个阶段挂回调，能拿到 compiler/compilation 实例，能做的事范围大得多（打包优化、资源注入、生成文件）。手写 loader 就是导出一个函数：\nmodule.exports = function (source) {\n  return source.replace(/console\\.log\\(.*?\\);?/g, "")\n}\n再配 async 风格 this.async() 处理异步转换、this.query 拿参数即可。'
  },
  {
    title: '说说 webpack 中常见的 Plugin？解决了什么问题？',
    difficulty: 2,
    answer:
      '按目的记忆： HtmlWebpackPlugin——生成 HTML 并自动注入打包产物引用；MiniCssExtractPlugin——把 CSS 抽成独立文件（配合 contenthash 做缓存）；TerserWebpackPlugin / CssMinimizerPlugin——压缩；DefinePlugin——编译期注入环境常量（区分开发/生产）；CleanWebpackPlugin（5.x 内置 output.clean）——清空产物目录；CopyWebpackPlugin——静态资源复制；BundleAnalyzerPlugin——分析包体构成。每个都说清「没有它会怎样」就能接住追问。'
  },
  {
    title: '说说 webpack 中常见的 Loader？解决了什么问题？',
    difficulty: 2,
    answer:
      'webpack 只认 JS/JSON，Loader 解决「其他资源怎么变成模块」：babel-loader 把 ES 新语法/TS 转译成目标版本 JS；css-loader 解析 CSS 里的 @import/url()，style-loader 把 CSS 插入 DOM（两者成对、顺序不能反）；sass-loader/less-loader 编译预处理器；postcss-loader 配 autoprefixer 补前缀；file-loader/url-loader（5.x 后被内置 asset module 取代）处理图片字体；vue-loader 把 .vue 单文件组件拆成可编译块。顺序原则：从右到左、从下到上。'
  },
  {
    title: '说说 webpack 的构建流程？',
    difficulty: 3,
    answer:
      '三条主线：① 初始化——读取配置，合并 CLI 参数，创建 Compiler 实例，加载全部插件并挂到 tapable 钩子上，执行 environment/make 前的准备；② 编译——从 entry 出发，调用对应 Loader 转换每个模块，再由 acorn 解析出 AST 收集依赖，递归处理形成依赖图，期间触发 buildModule/normalModuleLoader 等钩子；③ 输出——seal 阶段把模块组合成 chunk（按 entry/动态导入/分包规则），再渲染成 bundle 写入 dist，触发 emit/done。理解成「初始化 → 从入口递归编译建图 → 分组成 chunk 输出」就够接住追问。'
  },
  {
    title: '说说你对 webpack 的理解？解决了什么问题？',
    difficulty: 2,
    answer:
      'webpack 是静态模块打包器：以 entry 为起点，递归分析依赖（Loader 负责把任意资源翻译成模块），构建出依赖图，再按规则组合成浏览器可用的 bundle。它解决的是工程化核心问题：① 浏览器原生不支持模块化时代，把 CommonJS/ESM 统一打包；② 资源依赖关系爆炸（CSS 引图片、JS 分割加载），需要一张统一的依赖图管理；③ 工程能力——按需加载、摇树、压缩、缓存策略、HMR，全都建立在依赖图之上。一句话：把「一堆散装源码」变成「有序可部署的静态资源」的转换器。'
  },
  {
    title: 'webpack loader 和 plugin 实现原理？',
    difficulty: 3,
    answer:
      'Loader 原理：就是个函数（this 上下文里有 query/resourcePath/async 等 API），compiler 在读入文件后按 rule.test 匹配，把源码交给 loader 数组从右往左依次加工，前一个的输出是后一个的输入，最终必须是可执行的 JS 模块。Plugin 原理：基于 tapable 事件流——webpack 构建过程是一系列命名钩子（compile、make、emit…），插件是一个带 apply(compiler) 方法的类，在 apply 里 compiler.hooks.xxx.tap(名字, 回调) 订阅阶段事件，拿到 compilation 对象后可以读写资源、新增 chunk。本质是「发布订阅 + 生命周期注入」。'
  },
  {
    title: '如何提高 webpack 的构建速度？',
    difficulty: 2,
    answer:
      '按收益排序：① 缩小范围——include/exclude 限定 loader 作用、resolve.alias 与 extensions 精简、noParse 跳过无依赖库；② 缓存——webpack5 持久化缓存 filesystem cache，babel-loader 加 cacheDirectory；③ 并行——thread-loader 把耗时的 babel/ts 转译丢进 worker；④ 替换——esbuild-loader/swc-loader 替代 babel，速度快一个量级；⑤ 开发体验——少用 source-map 高精度模式（eval-cheap-module-source-map）、devtool 降级、DllPlugin 已过时不推荐。原则：先 profile（speed-measure）找到瓶颈再动手。'
  },
  {
    title: '说说 webpack-dev-server 的原理',
    difficulty: 2,
    answer:
      'dev-server 在本地起 HTTP 服务，把打包产物放内存里（不落盘），浏览器从内存读取 bundle。文件监听用 webpack 的 watch 模式（聚合多次变更只触发一次编译），编译完成后通过 WebSocket 向页面推送 hash；浏览器里的 HMR Runtime 再按 hash 拉取更新的模块，走 module.hot.accept 替换或整页刷新。再把「同源代理（proxy 解决跨域）」和「historyApiFallback（SPA 路由回退）」算上，就是完整的本地开发闭环。'
  },
  {
    title: '你对 babel 了解吗，能不能说说几个 stage 代表什么意思？',
    difficulty: 2,
    answer:
      'babel 是 JS 语法转译器：parse（babylon 生成 AST）→ transform（插件访问 AST 做改写）→ generate（输出目标代码 + sourcemap）。stage 是历史上 preset-stage-0~3 对 TC39 提案进度的划分：stage-0 最激进（ strawman 想法阶段），stage-1 提案正式化，stage-2 草案（大概率会进标准），stage-3 候选（几乎定稿，等浏览器实现）。这套 preset 已废弃，现代做法是 preset-env 按 browserslist + core-js 按需转译和补 polyfill，不再按「激进程度」选阶段，而是按「目标浏览器需要什么」来。'
  },
  {
    title: 'webpack 的 module、bundle、chunk 分别指的是什么？',
    difficulty: 2,
    answer:
      'module 是「源层面的单位」——任何被 import 的文件都是模块（经过 loader 转换后）；chunk 是「打包过程中的中间产物」——webpack 按 entry、动态 import()、splitChunks 规则把一组模块组织成一个 chunk（一个 chunk 可能含多个 module）；bundle 是「最终产物」——chunk 经过渲染（render manifest → 代码生成）写出的文件。关系一句话：多个 module 组成 chunk，chunk 产出 bundle；大多数情况一一对应，但 splitChunks 会把公共模块拆成独立 chunk。'
  },
  {
    title: '什么是 CI/CD？',
    difficulty: 2,
    answer:
      'CI 持续集成：每次 push 自动跑「安装 → 静态检查 → 单测 → 构建」，尽早暴露集成问题，主干保持可发布状态。CD 两层含义：持续交付（每次通过验证的构建自动打包成可发布产物，随时能上线）和持续部署（再进一步，自动发布到生产，无人工介入）。前端典型流水线：lint + type-check → 单测 → build → 产物上传/部署到静态托管，再加灰度和回滚机制。价值不在工具而在反馈速度：问题在提交后 5 分钟暴露，而不是上线后 5 小时。'
  },
  {
    title: '说说你对前端工程化的理解？',
    difficulty: 2,
    answer:
      '工程化是用系统化手段解决「规模带来的混乱」：模块化（ESM/组件化）管代码组织；构建链路（Vite/webpack + babel/ts）管方言统一和产物优化；规范（ESLint/Prettier/husky + commitlint）管协作一致性；质量（类型检查、单测、E2E、Code Review 门禁）管回归；交付（CI/CD、灰度、监控告警、sourcemap 还原）管上线链路。判断做没做好的标准不是用了多少工具，而是：新人能不能半天跑起项目、上线能不能一键回滚、问题能不能五分钟定位。'
  },
  {
    title: '说说你对 SSG 的理解？',
    difficulty: 2,
    answer:
      'SSG（Static Site Generation）在**构建时**就把页面预渲染成完整 HTML，部署的是纯静态文件。优点：首屏极快（免运行时渲染）、CDN 直发、SEO 友好、无服务器成本；缺点：内容更新要重新构建，不适合高频变化的数据，数据量大了构建时间长。与 SSR 的区别：SSR 每次请求现渲染（动态、要服务器），SSG 构建期渲染（静态、免服务器）。混合方案是 ISR（增量再生，Next.js）和 DSG + 客户端水合。适用：文档站、博客、营销页、内容不常变的官网。'
  },
  {
    title: '聊聊 vite 和 webpack 的区别？',
    difficulty: 2,
    answer:
      '五个维度：① 开发启动——webpack 要把所有模块打包成 bundle 才能起服务，项目越大越慢；Vite 不打包，浏览器按需请求、esbuild 现场编译，冷启动毫秒级；② 热更新——webpack 整包级别增量，Vite 精确到模块且不受项目规模影响；③ 生态——webpack 插件/Loader 生态最全，配置重；Vite 兼容 Rollup 插件，约定大于配置；④ 生产——Vite 用 Rollup 打包，产物质量与 webpack 同级；⑤ 底层——esbuild（Go）做依赖预构建和压缩，天然快。选型：新项目默认 Vite，老大型 webpack 项目迁移看收益。'
  },
  {
    title: 'webpack tree shaking 机制的原理是什么？',
    difficulty: 3,
    extraTags: ['面试高频'],
    answer:
      '前提是 ESM 的静态结构：import/export 在编译期就能确定依赖关系（这是 CommonJS 做不到的）。流程：① webpack 在 make 阶段标记——module graph 上把「没被用到的导出」打上 unused harmony 标记；② Terser 压缩阶段据此把未用代码真正删除（webpack 只标记不删除）。所以摇树效果取决于三点：用 ESM 语法、package.json 声明 sideEffects: false（或精确列出有副作用的文件，否则 CSS 这类「导入即副作用」的会被误删或不敢删）、第三方库提供 ESM 产物。'
  }
]
