/**
 * React 题库（23 题，来源：面试题图 · React 页）。
 *
 * 答案统一写成「面试口述简洁版」：先把结论一句话说清，再补 2~4 个展开点，
 * 能接住追问但不写成文档。需要代码的题给最小可背版本。
 */
import type { BankItem } from './types'

export const REACT_BANK: BankItem[] = [
  {
    title: 'Fiber 架构的工作原理？',
    difficulty: 3,
    answer:
      'Fiber 把一次渲染拆成一个个工作单元，每个组件对应一个 Fiber 节点，节点之间用 child、sibling、return 三根指针连成一棵链表树。Reconciler 处理完一个节点后可以「暂停」下来，把控制权交还给浏览器，下次从当前节点继续，靠的是链表结构可以随时断点续作。整个更新分成 render（可中断，做 diff 计算）和 commit（不可中断，同步执行 DOM 操作）两个阶段，中间用双缓冲（current 树和 workInProgress 树）完成切换。'
  },
  {
    title: 'React Reconciler 为何要采用 Fiber 架构？',
    difficulty: 3,
    answer:
      '老的 Stack Reconciler 是递归对比，一旦开始就必须把整棵树 diff 完，大组件树会长时间占用主线程，掉帧、输入卡顿都没法救。Fiber 把递归改成可中断的循环：任务有了优先级和时间切片，渲染能让路给用户输入和动画。本质上是为了把「同步不可打断的渲染」改成「可调度、可恢复的渲染」，这是并发特性（Suspense、transition）的前提。'
  },
  {
    title: 'useState 是如何实现的？',
    difficulty: 3,
    answer:
      'useState 背后是 Fiber 节点上的 hook 链表：每个 hook 按 `useState` 调用顺序挂在 fiber.memoizedState 链上，这就是为什么 hook 不能写在条件分支里——顺序一变就对不上号。调用时先按序号取 hook，初次挂载把初始值写入；更新时把这次 update 排进队列，render 阶段依次执行 queue 里的动作算出新状态，返回后 React 调度一次重渲染。函数组件本身每次都重新执行，状态能留住全靠这条挂在 fiber 上的链表。'
  },
  {
    title: 'React Fiber 是什么？',
    difficulty: 2,
    answer:
      'Fiber 有两层含义：一是数据结构——每个组件对应一个 Fiber 节点，保存着类型、props、state、effect 标记和三根指针，是虚拟 DOM 在 React 16 之后的升级版；二是架构——基于这个链表结构做可中断、可恢复、有优先级的协调过程。一句话：Fiber 就是让 React 从「一次性递归渲染」变成「可调度的增量渲染」。'
  },
  {
    title: '简单介绍下 React 中的 diff 算法',
    difficulty: 2,
    answer:
      'React diff 有三个前提策略把 O(n³) 降到 O(n)：① 只对同层节点比较，不跨层移动；② 类型不同直接销毁重建子树，不再往下比；③ 通过 key 标识同一层级中可复用的列表项。列表 diff 时先用 key 匹配旧节点，能复用的打上移动/更新标记，不能复用的删除。所以 key 要稳定唯一，用数组下标在插入删除时会错误复用状态。'
  },
  {
    title: '如何让 useEffect 支持 async/await？',
    difficulty: 2,
    answer:
      'useEffect 的回调约定返回的是清理函数，而 async 函数返回 Promise，直接写会报类型错误。标准做法是在里面再包一层立即执行的 async 函数，把异步逻辑放进去；清理逻辑放在外层返回的函数里，配合一个 cancelled 标志在组件卸载后丢弃过期结果。也可以抽成自定义 hook（如 useAsync）统一处理加载态和竞态。'
  },
  {
    title: 'React Fiber 是如何实现更新过程可控的？',
    difficulty: 3,
    answer:
      '三个机制配合：① 可中断——render 阶段以 Fiber 节点为工作单元，每完成一个检查 shouldYield，时间片用完就让出主线程，靠链表记录进度下次续作；② 优先级——不同来源的更新带不同 lanes 优先级，高优先级（输入、点击）可以打断低优先级渲染，低优先级任务保存在调度队列里稍后重做；③ 双缓冲——workInProgress 树做完后一次性切换成 current，commit 阶段同步执行不可分割，保证用户不会看到渲染到一半的界面。'
  },
  {
    title: 'React 中懒加载的实现原理是什么？',
    difficulty: 2,
    answer:
      'React.lazy 接收一个返回 import() 的工厂函数，底层是动态 import 天然的按需加载能力：打包器会把被引入模块拆成独立 chunk，首次渲染时组件处于 pending，抛出一个 Promise 给 Suspense 捕获，显示 fallback；模块加载完成后触发重渲染，替换成真实组件。本质是「代码分割 + Suspense 状态机」，loading 和错误边界都由 Suspense/ErrorBoundary 承担。'
  },
  {
    title: 'React 中怎么实现状态自动保存（KeepAlive）？',
    difficulty: 3,
    answer:
      'React 没有 Vue 那样的内置 KeepAlive，因为它的 reconciler 不保留卸载组件的 fiber。常见三种实现：① 自己用 display:none 缓存——不卸载组件，只是藏起来，状态天然保留，但要自己管理缓存上限；② 用 React.createPortal 把隐藏的组件挂到分离的 DOM 容器里，切换时搬移 DOM 而不销毁实例；③ 用 react-activation 这类库，原理是在 Commit 阶段把 fiber 子树「保存」下来，恢复时重新挂回。核心思路都是：卸载是状态丢失的根源，所以要藏不要卸。'
  },
  {
    title: 'React 有哪些性能优化的方法？',
    difficulty: 2,
    answer:
      '分三层说。渲染层：组件懒加载 + Suspense、React.memo 缓存组件、useMemo/useCallback 缓存对象和回调、合理拆分 state 减小更新波及面、长列表虚拟滚动；数据层：状态下放（colocation）、用 key 稳定列表复用、避免在 render 里创建新对象字面量传给深层组件；工程层：路由级代码分割、分析 bundle 用 production 构建、防抖节流高频事件。原则是先用 Profiler 定位再优化，不凭感觉。'
  },
  {
    title: '不同版本的 React 都做过哪些优化？',
    difficulty: 2,
    answer:
      '按版本线背：16 把架构换成 Fiber，引入 ErrorBoundary、Hooks（16.8）；17 主要是事件机制重构，事件委托从 document 改到 root 容器，为多版本共存铺路；18 是并发元年——并发渲染、自动批处理（promise/原生事件里也批了）、Transitions（低优先级更新）、Suspense 完善、useDeferredValue/startTransition；19 落地了 Server Components、Actions、useOptimistic、use() API 和资源预加载，把「数据获取与渲染协同」往前推了一大步。'
  },
  {
    title: 'React 18 新特性',
    difficulty: 2,
    answer:
      '核心是并发渲染的落地：① createRoot 开启的并发模式，渲染可中断可恢复；② 自动批处理，异步回调里的多次 setState 也合并成一次渲染；③ startTransition / useDeferredValue，把非紧急更新标记为可打断；④ Suspense 在服务端支持流式 SSR（renderToPipeableStream + selectHydration 按需水合）；⑤ 新 hooks：useId（SSR 稳定 id）、useTransition、useDeferredValue。一句话总结：18 的关键词是「并发」，其他特性都建立在它之上。'
  },
  {
    title: '说说你对 React Hook 的闭包陷阱的理解，有哪些解决方案？',
    difficulty: 3,
    answer:
      '陷阱的根源：每次 render 都是一次新的函数执行，effect/定时器/事件回调捕获的是**那一次 render 的 props 和 state** 快照。比如 setInterval 里读到的 count 永远是首次的值。解决方案：① 依赖数组写全，让 effect 在值变化时重建；② 函数式更新 setState(prev => prev + 1)，不依赖闭包里的旧值；③ 用 useRef 存一个始终指向最新值的 ref（配合 useEffect 同步）；④ setInterval 场景直接用自定义 hook useInterval，把回调存 ref、每次渲染替换。'
  },
  {
    title: 'React 中，怎么给 children 添加额外的属性？',
    difficulty: 2,
    answer:
      'children 本质是 React 元素（对象），不能直接改 props（不可变），标准做法是 React.cloneElement：React.Children.map 遍历 children，对每个合法元素 cloneElement(child, { extraProp }) 生成带新属性的副本返回。要判断 element 类型避免对字符串/Fragment 报错。另一种思路是用 Context 提供数据，让子组件自己消费，避免侵入 children。'
  },
  {
    title: 'Fiber 为什么是 React 性能的一个飞跃？',
    difficulty: 3,
    answer:
      '因为渲染从「不可控」变成「可调度」。以前一次 diff 必须一口气跑完，树一大主线程就被锁死；Fiber 之后渲染被切成时间片，能被更高优先级的交互打断再续上，掉帧率大幅下降。更深远的是它解锁了并发能力：Suspense 渲染可以「等待」、Transitions 可以标记低优先级、SSR 可以流式输出——这些在同步递归架构下都做不了。所以飞跃不是某一个点快了，而是整个渲染模型升级了。'
  },
  {
    title: 'React 是否支持给标签设置自定义的属性？',
    difficulty: 1,
    answer:
      '支持。React 16 之前会把不认识的属性丢掉，16 开始把这些属性原样透传给 DOM，所以 <div my-attr="x" /> 会真实出现在 HTML 里。注意两点：自定义属性要用小写中划线形式直接写，不能用 data-* 之外的驼峰（会被当作 SVG/不识别处理）；style/className 这类 React 专属属性名仍然要按 React 约定写。'
  },
  {
    title: '说说 React render 阶段的执行过程',
    difficulty: 3,
    answer:
      'render 阶段从 hostRoot 或被标记的 fiber 开始，以 workLoop 循环处理工作单元，全程可中断。每个节点经历 beginWork（根据新旧 props/state 计算是否需要更新，diff 出子 fiber，打上 Placement/Update/Delete 等 flag）和 completeWork（收集 flags 到副作用链表，创建/复用 DOM 实例）。整棵树处理完后得到一棵带副作用清单的 workInProgress 树。这个阶段纯计算、无副作用，所以被打断重做是安全的。'
  },
  {
    title: 'React 中，Fiber 是如何实现时间切片的？',
    difficulty: 3,
    answer:
      '调度器（Scheduler）按优先级把任务排进队列，用 MessageChannel（宏任务，比 setTimeout 稳定）在每帧绘制后检查剩余时间：workLoop 每处理完一个 fiber 节点就调 shouldYield()，当前帧时间片（约 5ms）用完就退出循环让出主线程，把控制权还给浏览器做输入响应和渲染；下一帧继续从上次中断的 fiber 接着跑。任务队列是按优先级排序的小顶堆，过期任务会升级优先级防止饿死。'
  },
  {
    title: '说说 React commit 阶段的执行过程',
    difficulty: 3,
    answer:
      'commit 分三个不可打断的子阶段：① beforeMutation，读 DOM 快照（类组件 getSnapshotBeforeUpdate）；② mutation，按副作用链表同步执行 DOM 增删改，函数组件在此执行所有 layout effect 的清理函数；③ layout，同步执行 useLayoutEffect / componentDidMount 等生命周期，完成后 React 把 workInProgress 树正式切换为 current，浏览器才绘制。被动效果（useEffect）被调度成异步， paint 之后才执行，避免阻塞首帧。'
  },
  {
    title: 'React 中的路由懒加载是什么？原理是什么？',
    difficulty: 2,
    answer:
      '把每个路由对应的页面组件用 React.lazy(() => import("./page")) 包一层，配合 <Suspense fallback>，这样打包时每个页面被拆成独立 chunk，首屏只加载当前路由的代码，跳转时才拉取对应 chunk。原理是动态 import() 让 Webpack/Vite 做代码分割，lazy 组件把「模块加载」建模成一个可 Suspense 的状态：pending 显示 fallback，resolve 后渲染真实组件。通常再配 ErrorBoundary 兜加载失败。'
  },
  {
    title: 'React 中为什么不直接使用 requestIdleCallback？',
    difficulty: 3,
    answer:
      '四个原因：① 兼容性，Safari 长期不支持，React 要跑在所有平台（包括 RN）；② 触发频率不稳定，空闲时间是浏览器「猜」的，屏幕 FPS 低时可能 2 秒才回调一次，调度粒度太粗；③ 它的 idle 回调里做高优先级插队很麻烦，React 需要的是「固定 5ms 时间片 + 按优先级排序的任务队列」，rIC 给不了这种确定性；④ 跨端环境（Native）根本没有 rIC。所以 Scheduler 用 MessageChannel 自己实现了带优先级堆的切片调度。'
  },
  {
    title: 'React 组件间怎么进行通信？',
    difficulty: 1,
    answer:
      '按关系选方案：父子用 props + 回调；跨层用 Context（主题、登录态这类全局数据）；兄弟组件状态提升到共同父级，或用状态库（Redux/Zustand/Jotai）做全局共享；不相干组件间的事件通信用 mitt 这类发布订阅；拿到子组件实例/CDom 场景用 ref + useImperativeHandle 暴露方法。原则：简单关系别上重武器，全局状态才进状态库。'
  },
  {
    title: 'React 和 Vue 在技术层面有哪些区别？',
    difficulty: 2,
    answer:
      '核心五点：① 响应式——Vue 基于依赖追踪（Proxy 收集依赖，精确到组件/属性级更新），React 靠「不可变 + 重新渲染」，setState 触发整个组件子树重跑再 diff；② 模板 vs JSX——Vue 模板编译期可做静态提升、patchFlag 等定向优化，JSX 表达力强但优化靠手动 memo；③ 更新粒度——Vue 是组件级，React 是自顶向下（所以需要 memo）；④ 生态理念——React 推 RSC/并发这类激进演进，Vue 渐进式、内置更多官方方案（Router/Pinia）；⑤ Hooks vs 组合式 API 思路相似，但 Vue 的 setup 只执行一次，React 函数每次渲染都执行，闭包陷阱是 React 特有的。'
  }
]
