/**
 * TypeScript 题库（26 题，来源：面试题图 · TypeScript 页）。
 *
 * 原图 19/23 两题同题（判断入参是否数组），只录一条；净增 26。
 * 注意：原图里「请实现下面的 xx 方法」这组题带着代码骨架，但截图未包含骨架内容，
 * 这里按社区通行语义实现，并在答案开头注明假定签名 —— 面试被追问时先确认题目要求再写。
 */
import type { BankItem } from './types'

export const TS_BANK: BankItem[] = [
  {
    title: '说说对 TypeScript 中命名空间与模块的理解？区别？',
    difficulty: 2,
    answer:
      '模块：ES6 标准的 import/export，一个文件一个独立作用域，依赖由打包器/运行时解析，是现代 TS 的默认组织方式。命名空间：namespace 关键字把代码包进全局对象，靠 /// 引用，主要为了兼容旧的全局脚本代码和给类型做分组声明。区别：模块有独立的文件作用域和依赖图、可摇树；命名空间共享全局作用域、无法按需加载。新项目一律用模块，命名空间只在声明文件里偶尔用来组织类型。'
  },
  {
    title: '说说你对 typescript 的理解？与 javascript 的区别？',
    difficulty: 1,
    answer:
      'TS 是 JS 的超集：在 JS 之上加了静态类型系统和完善的工程能力（接口、泛型、枚举、装饰器），编译后输出纯 JS。区别三点：① 类型层面——TS 编译期做类型检查，把「undefined is not a function」这类运行时错误提前到编码期；② 工程层面——有了类型就有 IDE 智能提示、重构安全性和可维护的多人协作；③ 运行层面——TS 不能直接执行，必须编译（tsc/babel/esbuild）成 JS，类型在运行时完全不存在。一句话：类型是写给人 IDE 看的，不是给机器执行的。'
  },
  {
    title: 'TypeScript 中泛型是什么？',
    difficulty: 2,
    answer:
      '泛型是「类型的参数」：定义时不指定具体类型，使用时再传入，让同一段逻辑适配多种类型且不丢失类型信息。最常见的是泛型函数 identity<T>(v: T): T、泛型约束 T extends { length: number }、泛型默认值和条件类型配合（T extends string ? A : B）。核心价值：用 any 能跑但丢掉类型检查，为每个类型写一遍又冗余，泛型兼得两边的优点。工具类型 Partial、ReturnType 全是泛型应用的典型。'
  },
  {
    title: 'TypeScript 中有哪些声明变量的方式？',
    difficulty: 1,
    answer:
      '三种：var（函数作用域、存在变量提升、可重复声明，TS/ES6 后基本淘汰）、let（块级作用域、不可重复声明、有暂时性死区）、const（块级作用域且声明时必须初始化、绑定不可重新赋值，但对象的属性仍可修改）。实践约定：默认 const，需要重新赋值才用 let，禁用 var。类型层面还有 type、interface、enum 这些「声明类型」的方式，与变量声明区分开。'
  },
  {
    title: '什么是 TypeScript 的方法重载？',
    difficulty: 2,
    answer:
      'TS 的重载是「签名层面的多态」：对同一个函数声明多个参数/返回类型的组合，调用时按声明顺序匹配最前面命中的签名。注意实现签名（带函数体那个）对外不可见，且必须兼容所有重载签名。JS 运行时并没有真重载，实现体内部还是要靠 typeof/arguments 自己分派。典型场景：document.getElementById 风格的「传字符串返回 A、传对象返回 B」的 API。'
  },
  {
    title: '请实现下面的 sleep 方法',
    difficulty: 1,
    answer:
      '假定签名 sleep(ms: number): Promise<void>，让 await 暂停指定毫秒。核心是 Promise + setTimeout：\nconst sleep = (ms: number): Promise<void> =>\n  new Promise((resolve) => setTimeout(resolve, ms))\n用法：await sleep(1000)。如果要支持取消，可以在内部保存 timer，把 resolve 包一层，外部调用 abort 时 clearTimeout 并 resolve。'
  },
  {
    title: 'TypeScript 中 is 关键字有什么用？',
    difficulty: 2,
    answer:
      'is 是类型谓词，用在自定义类型守卫的返回值上：function isFish(pet: Fish | Bird): pet is Fish。作用是把「运行时判断结果」和「类型收窄」绑定起来——函数返回 true 时，调用方作用域里这个参数就被 TS 当作 Fish 类型，可以直接访问 Fish 的属性。区别于直接返回 boolean：普通 boolean 无法向编译器传递判断依据，收窄不了类型。is 只能在带类型标注的函数签名上用。'
  },
  {
    title: 'TypeScript 支持的访问修饰符有哪些？',
    difficulty: 1,
    answer:
      '三个，只对 class 成员生效：public（默认，内外都可访问）、private（仅本类内部可访问，编译期检查，运行时不存在）、protected（本类 + 子类可访问）。另外 TS 4.x 后支持真正的私有字段 #field（ECMAScript 标准，运行时强制隔离）和参数属性写法 constructor(private name: string) 自动声明并赋值。区别点：private 编译后消失，# 私有字段在运行时也进不去。'
  },
  {
    title: '请实现下面的 myMap 方法',
    difficulty: 2,
    answer:
      '假定要给数组实现一个 myMap，行为与 Array.prototype.map 一致（含 index 和原数组入参）：\nfunction myMap<T, R>(arr: T[], fn: (item: T, index: number, source: T[]) => R): R[] {\n  const result: R[] = []\n  for (let i = 0; i < arr.length; i++) {\n    if (i in arr) result[i] = fn(arr[i], i, arr)\n  }\n  return result\n}\n要点：泛型保证输入输出类型关联；用 `i in arr` 跳过稀疏数组的空洞，与原生行为一致。'
  },
  {
    title: '请实现下面的 treePath 方法',
    difficulty: 2,
    answer:
      '假定语义：给一棵树（{ id, children }）和目标 id，返回从根到目标的路径数组。DFS 回溯即可：\nfunction treePath(tree, targetId, path = []) {\n  path.push(tree.id)\n  if (tree.id === targetId) return path\n  for (const child of tree.children || []) {\n    const found = treePath(child, targetId, path)\n    if (found) return found\n  }\n  path.pop()\n  return null\n}\n要点：找到后一路 return 传播结果，找不到要 pop 回溯，否则路径会残留兄弟分支的 id。'
  },
  {
    title: '请实现下面的 produat 方法',
    difficulty: 2,
    answer:
      '原图的代码骨架被截断了，我按常见语义实现：计算数组元素的乘积（product）。' +
      'function produat(arr: number[]): number {\n  return arr.reduce((acc, n) => acc * n, 1)\n}\n如果题目要的是「除自身以外的乘积」（LeetCode 238 那种），就用前缀积乘后缀积，两次遍历 O(n)、不用除法。面试时遇到截断题先和面试官确认要求，是加分项。'
  },
  {
    title: '请实现下面的 myAl 方法',
    difficulty: 3,
    answer:
      '原图骨架被截断，按最常见语义实现 myAll：手写 Promise.all（TS 版带泛型保持结果元组类型）：\nfunction myAll<T extends readonly unknown[]>(promises: T): Promise<{ -readonly [P in keyof T]: Awaited<T[P]> }> {\n  return new Promise((resolve, reject) => {\n    const list = Array.from(promises) as unknown[]\n    const result: unknown[] = []\n    let done = 0\n    if (!list.length) return resolve(result as never)\n    list.forEach((p, i) => {\n      Promise.resolve(p).then((v) => {\n        result[i] = v\n        if (++done === list.length) resolve(result as never)\n      }, reject)\n    })\n  })\n}\n要点：计数器判断完成、按下标存结果保持顺序、任一失败立即 reject、空数组直接 resolve。'
  },
  {
    title: '请实现下面的 sum 方法',
    difficulty: 2,
    answer:
      '这题常见的考法是柯里化求和：sum(1)(2)(3)() 或 sum(1,2)(3) 求和。' +
      'function sum(...args: number[]): number {\n  const total = args.reduce((a, b) => a + b, 0)\n  const proxy = (...next: number[]) => sum(total + next.reduce((a, b) => a + b, 0))\n  ;(proxy as any).valueOf = () => total\n  ;(proxy as any).toString = () => String(total)\n  return proxy as never\n}\n要点：递归返回函数自身持续收集参数；用 valueOf/toString 隐式转出结果。如果题目只是简单可变参数求和，reduce 一行就够。'
  },
  {
    title: '请实现下面的 mergeArray 方法',
    difficulty: 2,
    answer:
      '常见语义：合并两个有序数组为一个有序数组（不直接 concat+sort）。双指针归并：\nfunction mergeArray(a: number[], b: number[]): number[] {\n  const result: number[] = []\n  let i = 0, j = 0\n  while (i < a.length && j < b.length) {\n    result.push(a[i] <= b[j] ? a[i++] : b[j++])\n  }\n  return result.concat(a.slice(i), b.slice(j))\n}\n时间 O(m+n)。泛型化可以加一个比较器参数 mergeArray<T>(a: T[], b: T[], cmp: (x: T, y: T) => number)。'
  },
  {
    title: '请实现下面的 firstsinglechar 方法',
    difficulty: 2,
    answer:
      '语义：返回字符串中第一个只出现一次的字符。两次遍历 + 计数表：\nfunction firstsinglechar(s: string): string {\n  const count = new Map<string, number>()\n  for (const ch of s) count.set(ch, (count.get(ch) ?? 0) + 1)\n  for (const ch of s) if (count.get(ch) === 1) return ch\n  return ""\n}\n时间 O(n) 空间 O(字符集)。用 Map 保持插入顺序，第二轮遍历直接查计数即可，不需要记录位置。'
  },
  {
    title: '实现 reverseWord 方法',
    difficulty: 2,
    answer:
      '语义：按单词反转句子顺序，单词内部不动："hello world ts" → "ts world hello"。\nfunction reverseWord(s: string): string {\n  return s.trim().split(/\\s+/).reverse().join(" ")\n}\n要点：用 /\\s+/ 切分容忍多个空格；trim 处理首尾空格。若要原地双指针解法，就是整体反转再逐词反转，面试可提一句体现算法功底。'
  },
  {
    title: '如何定义一个数组，它的元素可能是字符串类型…（联合类型）',
    difficulty: 1,
    answer:
      '用联合类型标注数组元素：let arr: (string | number)[] = ["a", 1]。注意与 string[] | number[] 的区别——前者每个元素都可以是两者之一，后者要么全是 string 要么全是 number。更精确的异构固定结构用元组：let tuple: [string, number] = ["a", 1]，位置和类型一一对应。'
  },
  {
    title: '请补充 objToArray 函数',
    difficulty: 2,
    answer:
      '语义：把对象转成数组。最常见的两种目标形态：\n① 取值：const objToArray = <T>(obj: Record<string, T>): T[] => Object.values(obj)\n② 取键值对：const objToArray = <T>(obj: Record<string, T>): { key: string; value: T }[] =>\n  Object.entries(obj).map(([key, value]) => ({ key, value }))\n要点：用 Record<string, T> 约束入参是同值对象，泛型保住值类型；只想要自身可枚举属性时 Object.values/entries 正好符合，不会带上原型链属性。'
  },
  {
    title: '使用 TS 实现一个判断传入参数是否是数组类型的方法',
    difficulty: 2,
    answer:
      '运行时用 Array.isArray + 类型守卫把结果传给编译器：\nfunction isArray<T = unknown>(value: unknown): value is T[] {\n  return Array.isArray(value)\n}\n用法：if (isArray<string>(v)) { v.forEach(s => s.toUpperCase()) }，收窄后 v 就是 string[]。要点：入参用 unknown 而不是 any（unknown 更严谨，逼调用方收窄）；返回值必须写 value is T[]，写 boolean 就失去守卫能力。'
  },
  {
    title: 'TypeScript 的内置数据类型有哪些？',
    difficulty: 1,
    answer:
      '基础类型：string、number、boolean、null、undefined、symbol、bigint。复合类型：array（T[]）、tuple（元组）、enum、object、function。特殊类型：any（放弃检查）、unknown（安全的 any，用前必须收窄）、void（无返回）、never（永不返回/不可达）、unknown 之外还有字面量类型和联合/交叉。内置工具类型也是日常高频：Partial、Required、Readonly、Pick、Omit、Record、ReturnType。'
  },
  {
    title: 'TS 中 any 和 unknown 有什么区别？',
    difficulty: 2,
    answer:
      'any 是关掉检查：赋给谁、被谁赋值都行，任何属性随便访问，类型系统对它完全放行。unknown 是安全的 top type：任何值都能赋给它，但它赋给别的类型前必须先收窄（typeof/instanceof/类型守卫），也不能直接访问属性。一句话：any 是「我不管了」，unknown 是「先验证再使用」。新代码里所有 formerly-any 的入参都该用 unknown，配合收窄既灵活又安全。'
  },
  {
    title: '如何将 unknown 类型指定为一个更具体的类型？',
    difficulty: 2,
    answer:
      '四种手段，按推荐排序：① 类型守卫收窄——typeof/instanceof/in 或自定义 is 函数，编译器自动收窄；② 断言 value as SpecificType（或 <SpecificType>value），强制指定，风险自负；③ 结构验证库（zod/valibot）在运行时解析并直接返回具体类型，边界数据（接口响应）首选；④ 赋值给具体类型的变量时让 TS 检查兼容性。原则：能守卫不断言，断言只在「你比编译器知道得多」时用。'
  },
  {
    title: 'tsconfig.json 文件有什么用？',
    difficulty: 1,
    answer:
      '它是 TS 项目的编译配置文件，声明「这个目录是一个 TS 项目」，控制编译选项和文件范围。关键配置分几组：files/include/exclude 定哪些文件参与编译；compilerOptions 定编译行为——target（输出 JS 版本）、module/moduleResolution（模块体系）、strict（strictNullChecks、noImplicitAny 等一整套严格检查）、paths（路径别名）、outDir/noEmit（只检查不产出）。工程里 TS 通常只做类型检查（noEmit: true），转译交给 babel/esbuild，tsconfig 就成了「类型检查 + IDE 提示」的配置中枢。'
  },
  {
    title: 'TypeScript 中的 Declare 关键字有什么用？',
    difficulty: 2,
    answer:
      'declare 用来「声明已存在、但不是这份代码产出的东西」：declare const window 之外的第三方全局变量、declare function 告诉编译器这个函数运行时存在（CDN 引入的库）、declare module "*.css" 给非 TS 资源补类型、declare namespace 组织全局声明、declare global 在模块里扩展全局（比如给 window 挂自定义属性）。它只产出类型信息，编译后完全消失，不生成任何 JS。一句话：负责让编译器认识「外面的世界」。'
  },
  {
    title: '解释下 TypeScript 中的枚举',
    difficulty: 2,
    answer:
      'enum 把一组相关常量组织成有名字的集合。数字枚举默认从 0 自增且支持反向映射（Status[1] === "Open"）；字符串枚举每个成员显式赋值，没有反向映射但调试可读。计算成员和常量成员可以混用。要注意的点：const enum 编译期内联、不生成对象，但与 isolatedModules 有兼容坑；很多团队约定改用 as const 对象字面量替代 enum（类型推导更自然、无运行时开销、不进 JS 产物）。面试时把「enum 的问题 + as const 替代方案」说出来是亮点。'
  },
  {
    title: 'TypeScript 的主要特点是什么？',
    difficulty: 1,
    answer:
      '四个关键词：① 静态类型——编译期检查，把运行时错误提前暴露；② 渐进式——可以和 JS 混用，逐步加类型，any 兜底保证存量代码可迁移；③ 超集兼容——所有合法 JS 都是合法 TS，遵循 ECMA 标准演进；④ 工程友好——类型即文档，IDE 补全、跳转、重构全部建立在类型之上，大团队协作成本显著降低。代价是多一层编译和类型标注成本，所以规模越大、协作人越多的项目收益越明显。'
  }
]
