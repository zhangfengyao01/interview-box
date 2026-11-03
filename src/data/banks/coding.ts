/**
 * 编程题库（24 题，来源：面试题图 · 编程题页）。
 * 原图编号缺 13/15/17（图片本身没有这几行），实有 24 题。
 * 手写题给「最小可背实现」，控制在一个屏幕内能写完的量。
 */
import type { BankItem } from './types'

export const CODING_BANK: BankItem[] = [
  {
    title: '使用 Promise 实现红绿灯交替重复',
    difficulty: 2,
    extraTags: ['面试高频'],
    answer:
      '思路：每个灯封装成「亮 delay 毫秒后 resolve」的 Promise，用 async 循环串行 await，天然无限重复：\nconst light = (color, ms) => new Promise(r => setTimeout(r, ms))\nasync function run() {\n  while (true) {\n    await light("红", 3000); console.log("红")\n    await light("绿", 2000); console.log("绿")\n    await light("黄", 1000); console.log("黄")\n  }\n}\n要点：while + await 就是「交替重复」的全部；如果面试官要求可中断，加一个标志位在循环条件里判断。'
  },
  {
    title: 'bind、call、apply 有什么区别？如何实现一个 bind？',
    difficulty: 2,
    extraTags: ['面试高频'],
    answer:
      '区别一句话：call/apply 立即调用，只有参数形式不同（call 逐个传、apply 传数组）；bind 不调用，返回一个永久绑定 this 且可预设参数的新函数。手写 bind 的四个要点：返回新函数、闭包保存 context 和前置参数、新函数被 new 调用时 this 要让位给实例（用原型链桥接）、要维护原型的传递：\nFunction.prototype.myBind = function (ctx, ...pre) {\n  const fn = this\n  function bound(...args) {\n    return fn.apply(this instanceof bound ? this : ctx, [...pre, ...args])\n  }\n  bound.prototype = Object.create(fn.prototype)\n  return bound\n}'
  },
  {
    title: '利用字符重复出现的次数，编写一种字符串压缩方法',
    difficulty: 2,
    answer:
      '经典题："aabcccccaaa" 压缩为 "a2b1c5a3"，若压缩后更长则返回原串。一次遍历计数：\nfunction compress(s) {\n  let out = "", count = 1\n  for (let i = 1; i <= s.length; i++) {\n    if (s[i] === s[i - 1]) count++\n    else { out += s[i - 1] + count; count = 1 }\n  }\n  return out.length < s.length ? out : s\n}\n要点：循环到 s.length（含末尾越界那次）来收尾最后一个字符；最后按题意比较长度取短的。'
  },
  {
    title: '说说 new 操作符具体干了什么？',
    difficulty: 2,
    extraTags: ['面试高频'],
    answer:
      '四步：① 创建一个空对象；② 把它的 __proto__ 指向构造函数的 prototype；③ 以这个对象为 this 执行构造函数；④ 构造函数若显式返回对象则用返回值，否则返回新对象。手写：\nfunction myNew(Ctor, ...args) {\n  const obj = Object.create(Ctor.prototype)\n  const ret = Ctor.apply(obj, args)\n  return ret instanceof Object ? ret : obj\n}'
  },
  {
    title: '如何实现上拉加载、下拉刷新？',
    difficulty: 2,
    answer:
      '上拉加载：监听滚动（或 IntersectionObserver），当「滚动位置接近底部」（scrollTop + clientHeight >= scrollHeight - threshold）时触发分页请求，注意加 loading 标志防重复触发、没有更多数据时停止监听。下拉刷新：touchstart 记录起点，touchmove 计算下拉位移并做阻尼（超过阈值增速放缓），松手时若超过阈值就触发刷新并展示动画；原生场景可直接用 CSS overscroll-behavior 或容器自带的 refresher。小程序里 onReachBottom / onPullDownRefresh 生命周期就是这两件事的封装。'
  },
  {
    title: '大文件怎么实现断点续传？',
    difficulty: 3,
    answer:
      '核心是「分块 + 记录进度 + 秒传」：① 前端按固定大小（如 5MB）用 file.slice 切块，每块算 hash（worker 里用 spark-md5 增量算，避免卡主线程），文件 hash = 唯一标识；② 上传前先问服务端这个 hash 已收到哪些块，已收齐直接秒传；③ 并发上传缺失的块（控制在 3~6 个并发），服务端按索引落盘；④ 全部完成后通知服务端合并。中断后重传只补缺失块。暂停/恢复就是 abort 当前请求 + 记录已完成块列表。'
  },
  {
    title: '什么是防抖和节流，以及如何编码实现？',
    difficulty: 2,
    extraTags: ['面试高频'],
    answer:
      '防抖：事件停止触发 n 毫秒后才执行一次，中途触发就重新计时——搜索框输入联想用这个。节流：n 毫秒内最多执行一次——滚动、resize 这类高频事件用这个。最小实现：\nconst debounce = (fn, wait) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), wait) } }\nconst throttle = (fn, wait) => { let last = 0; return (...a) => { const now = Date.now(); if (now - last >= wait) { last = now; fn(...a) } } }\n面试常追问：要不要立即执行第一次、取消方法、this 保留——能主动提这三点就够亮点。'
  },
  {
    title: '说说 ajax 的原理，以及如何实现？',
    difficulty: 2,
    answer:
      '原理：通过浏览器提供的 XMLHttpRequest（或 fetch）在不刷新页面的前提下向服务器发 HTTP 请求，用回调/Promise 接收响应，再局部更新 DOM。核心是浏览器的同源策略与 HTTP 缓存照常生效，异步靠事件模型（onreadystatechange / Promise）。手写 XHR 五步：new XMLHttpRequest → open(method, url) → 设置 onreadystatechange（readyState === 4 时处理）→ setRequestHeader（POST 时）→ send(body)。fetch 是它的现代替代，基于 Promise、支持流式读取，但要手动判断 res.ok。'
  },
  {
    title: '深拷贝浅拷贝有什么区别？怎么实现深拷贝？',
    difficulty: 2,
    extraTags: ['面试高频'],
    answer:
      '浅拷贝只复制第一层，嵌套的引用类型仍共享（Object.assign、展开运算符、slice）；深拷贝递归复制所有层级，两对象完全独立。实现方案：① JSON.parse(JSON.stringify)——最简单，但丢 function、undefined、Symbol、Date 变字符串、循环引用直接报错；② structuredClone——原生 API，支持循环引用和常见类型，但函数仍不支持；③ 手写递归：WeakMap 记录已拷贝对象解决循环引用，按类型分发（Date/RegExp/Map/Set/普通对象/数组）。手写版是面试标配， WeakMap 这一步是区分度所在。'
  },
  {
    title: '用 js 实现二叉树的定义和基本操作',
    difficulty: 2,
    extraTags: ['数据结构'],
    answer:
      '定义 + 插入 + 三种遍历：\nclass Node { constructor(v) { this.val = v; this.left = null; this.right = null } }\nfunction insert(root, v) {\n  if (!root) return new Node(v)\n  if (v < root.val) root.left = insert(root.left, v)\n  else root.right = insert(root.right, v)\n  return root\n}\nconst inorder = (n, out = []) => (n && (inorder(n.left, out), out.push(n.val), inorder(n.right, out)), out)\n要点：BST 插入按「小左大右」递归落位；中序遍历结果天然有序；层序用队列 BFS。面试常追问删除节点——找到后用右子树最小节点替换。'
  },
  {
    title: '如何实现一个轮播图组件？',
    difficulty: 2,
    answer:
      '核心四块：① 结构——外层 overflow:hidden 视口 + 内层 flex 轨道，translateX 控制位移；② 切换——index 状态 + transition 动画，首尾无缝用「首尾各克隆一张」的技巧，滑过边界后瞬间（无过渡）跳回真实首尾；③ 交互——触摸/鼠标事件记录 start 位移，松手时按位移超过阈值决定翻页还是回弹，自动播放用 setInterval 并在 hover/touchstart 时暂停；④ 可访问性与细节——图片懒加载、指示器同步、窗口 resize 重算宽度。用 IntersectionObserver 也能实现无位移的淡入淡出版本。'
  },
  {
    title: '写出一个函数 trans，将数字转换成汉语的输出',
    difficulty: 3,
    answer:
      '思路按「节」处理：中文习惯四位一节（万/亿），每节内按 千百十 读，再拼节单位。关键点：零的处理——中间连续零只读一个、节末的零不读；10~19 读「十X」不读「一十」。简化版：\nfunction trans(n) {\n  const d = "零一二三四五六七八九", u = ["", "十", "百", "千"], s = ["", "万", "亿"]\n  if (n === 0) return "零"\n  let out = "", section = 0\n  while (n > 0) {\n    const part = n % 10000; n = Math.floor(n / 10000)\n    let str = "", zero = false, p = part, i = 0\n    while (p > 0) {\n      const digit = p % 10\n      if (digit === 0) { zero = p % 10000 !== 0 && part % 1000 !== 0 && i < 3 && str !== "" ? true : zero }\n      else str = d[digit] + u[i] + (zero && str ? "零" : "") + str, zero = false\n      p = Math.floor(p / 10); i++\n    }\n    if (part > 0) out = str + s[section] + out\n    section++\n  }\n  return out\n}\n面试重点是讲清「四位一节 + 零的规则」，代码可以现场再推。'
  },
  {
    title: '编写一个 vue 组件，组件内部使用插槽接收外部内容',
    difficulty: 2,
    answer:
      '三种插槽的用法各给一行就够。默认插槽：<div><slot></slot></div>，父组件 <Card>内容</Card>；具名插槽：<slot name="header"/>，父组件用 template #header 传入；作用域插槽（重点）：<slot :row="item" :index="i"/>，父组件 template #default="{ row }" 接收子组件数据，实现「内容父组件定、数据子组件供」。追问点：插槽内容的渲染作用域在父组件；3.x 的编译优化会把动态插槽定位成组件更新的一部分。'
  },
  {
    title: '去除字符串中出现次数最少的字符，不改变原字符串的顺序',
    difficulty: 2,
    answer:
      '先统计次数，再过滤掉次数等于最小值的字符：\nfunction removeLeast(s) {\n  const count = {}\n  for (const ch of s) count[ch] = (count[ch] || 0) + 1\n  const min = Math.min(...Object.values(count))\n  return [...s].filter(ch => count[ch] !== min).join("")\n}\n要点：filter 按 [...s] 原顺序遍历，天然保序；Map 也可以，但对象足够且更快。'
  },
  {
    title: '树转数组',
    difficulty: 2,
    extraTags: ['数据结构'],
    answer:
      '把嵌套树拍平成带 parentId 的扁平数组，DFS 前序即可：\nfunction treeToArray(node, parentId = null, out = []) {\n  const { children, ...rest } = node\n  out.push({ ...rest, parentId })\n  children?.forEach(child => treeToArray(child, node.id, out))\n  return out\n}\n要点：children 从节点上摘掉再 push；parentId 记录父子关系，恢复时靠它回挂。多棵根传数组外面套一层循环即可。'
  },
  {
    title: '数组转树',
    difficulty: 2,
    extraTags: ['数据结构'],
    answer:
      '两遍 O(n)：先建 id → 节点映射，再按 parentId 挂接：\nfunction arrayToTree(list) {\n  const map = {}, roots = []\n  list.forEach(item => { map[item.id] = { ...item, children: [] } })\n  list.forEach(item => {\n    const node = map[item.id]\n    item.parentId ? map[item.parentId]?.children.push(node) : roots.push(node)\n  })\n  return roots\n}\n要点：两遍遍历避免递归查找父级的 O(n²)；乱序输入也能处理（第一遍先建全量 map）。'
  },
  {
    title: '删除链表的一个节点',
    difficulty: 1,
    extraTags: ['数据结构'],
    answer:
      '单链表删除值等于 target 的节点：用 dummy 头简化「删头」的边界：\nfunction deleteNode(head, target) {\n  const dummy = { next: head }\n  let prev = dummy\n  while (prev.next && prev.next.val !== target) prev = prev.next\n  if (prev.next) prev.next = prev.next.next\n  return dummy.next\n}\n要点：dummy 让头节点和其他节点逻辑统一；O(n) 找、O(1) 删。若已知被删节点且非尾，可以「值替换法」：把 next 的值拷过来再跳过 next，O(1) 完成。'
  },
  {
    title: '请实现一个函数，要求在页面请求很多时限制并发数',
    difficulty: 3,
    extraTags: ['面试高频'],
    answer:
      '维护一个执行队列，同时只跑 limit 个，完成一个就补一个：\nfunction limitConcurrency(tasks, limit) {\n  return new Promise(resolve => {\n    const result = []\n    let index = 0, done = 0\n    const next = () => {\n      if (done === tasks.length) return resolve(result)\n      const cur = index++\n      tasks[cur]().then(v => { result[cur] = v }).finally(() => { done++; next() })\n    }\n    for (let i = 0; i < Math.min(limit, tasks.length); i++) next()\n  })\n}\n要点：起点先放 limit 个任务；每个任务 finally 里补位；结果按下标存保序。这是浏览器并发上限（HTTP1.1 同域 6 个）场景的标准解法。'
  },
  {
    title: '实现一个请求函数 fetchWithRetry（失败重试）',
    difficulty: 2,
    extraTags: ['面试高频'],
    answer:
      '递归版最清晰，支持次数 + 退避间隔：\nasync function fetchWithRetry(url, option = {}, retries = 3, delay = 500) {\n  try {\n    const res = await fetch(url, option)\n    if (!res.ok) throw new Error("HTTP " + res.status)\n    return res\n  } catch (e) {\n    if (retries <= 0) throw e\n    await new Promise(r => setTimeout(r, delay))\n    return fetchWithRetry(url, option, retries - 1, delay * 2)\n  }\n}\n要点：只有网络错误和 5xx 该重试，4xx 重试没意义；指数退避防止打爆服务端；可加 AbortSignal 支持主动取消。'
  },
  {
    title: '链表中，环的入口节点',
    difficulty: 3,
    extraTags: ['数据结构'],
    answer:
      '快慢指针两段式：① 快指针每次走 2、慢指针每次走 1，相遇说明有环；② 把一个指针放回 head，两个指针同速前进，再次相遇的节点就是入口。原理：head 到入口距离 a，入口到相遇点 b，环剩余 c——相遇时慢指针走了 a+b，快指针走了 a+b+k(b+c)，由 2(a+b)=a+b+k(b+c) 推出 a = (k-1)(b+c)+c，所以从头走 a 步和从相遇点走若干整圈再走 c 步会在入口汇合。时间 O(n) 空间 O(1)，比 hash 记录法优雅。'
  },
  {
    title: '多叉树指定层节点的个数',
    difficulty: 2,
    extraTags: ['数据结构'],
    answer:
      'BFS 按层计数最直接：\nfunction countAtLevel(root, level) {\n  if (!root || level < 1) return 0\n  let queue = [root], cur = 1\n  while (queue.length && cur < level) {\n    const next = []\n    queue.forEach(n => next.push(...(n.children || [])))\n    queue = next; cur++\n  }\n  return cur === level ? queue.length : 0\n}\n递归版：count(node, l) = l === 1 ? 1 : (node.children || []).reduce((s, c) => s + count(c, l - 1), 0)。'
  },
  {
    title: '请手写"快速排序"',
    difficulty: 2,
    extraTags: ['数据结构', '面试高频'],
    answer:
      '易写版（额外空间，好背）：\nfunction quickSort(arr) {\n  if (arr.length <= 1) return arr\n  const [pivot, ...rest] = arr\n  return [...quickSort(rest.filter(x => x < pivot)), pivot, ...quickSort(rest.filter(x => x >= pivot))]\n}\n面试要能补充原地版本：双指针 partition，左右指针向中间收，把小于 pivot 的换到左边。平均 O(nlogn)，最坏 O(n²)（已有序 + 首元素做 pivot），随机取 pivot 可避免；不稳定。'
  },
  {
    title: '使用 js 实现有序数组原地去重',
    difficulty: 1,
    extraTags: ['数据结构'],
    answer:
      '双指针原地做，空间 O(1)：\nfunction dedupSorted(arr) {\n  let k = 0\n  for (let i = 1; i < arr.length; i++) {\n    if (arr[i] !== arr[k]) arr[++k] = arr[i]\n  }\n  arr.length = k + 1\n  return arr\n}\n要点：k 是「已去重区间的末尾」，i 往后扫，遇到新值就往前放；有序性保证相等的都相邻，所以一个指针就够。无序数组要去重用 Set，但要 O(n) 空间。'
  },
  {
    title: '计算出下面数组中的平均时间',
    difficulty: 1,
    answer:
      '原图的数据被截断了，按常见形态实现：数组元素是 "mm:ss" 或 "hh:mm:ss" 格式的时间字符串，求平均。' +
      'function avgTime(list) {\n  const secs = list.map(t => t.split(":").reduce((acc, x) => acc * 60 + +x, 0))\n  const avg = Math.round(secs.reduce((a, b) => a + b, 0) / list.length)\n  const mm = String(Math.floor(avg / 60)).padStart(2, "0")\n  const ss = String(avg % 60).padStart(2, "0")\n  return mm + ":" + ss\n}\n要点：先统一折算成秒再平均，最后格式化回去；遇到截断题先向面试官确认数据格式。'
  }
]
