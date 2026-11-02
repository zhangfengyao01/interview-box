# 面试题匣 · 本地优先面试题库

[![CI](https://github.com/zhangfengyao01/interview-box/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/zhangfengyao01/interview-box/actions/workflows/ci.yml)
![uni-app](https://img.shields.io/badge/uni--app-Vue3%20%2B%20Vite-5B50F5)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6)
![SQLite](https://img.shields.io/badge/SQLite-plus.sqlite-003B57)
![tests](https://img.shields.io/badge/verify%3Abackup-35%20passed-2EA043)
![license](https://img.shields.io/badge/license-MIT-2EA043)

按 `面试题匣prd.md` 实现的面试题知识库：**图片 → OCR → 拆题 → 校对 → 入库 → 复习**，
数据全部存在本机，无账号体系，断网可用。UI 与设计稿
「面试题库智能学习应用界面展示」逐屏对齐。

**技术栈**：uni-app CLI（Vue3 + TypeScript + Vite）· Pinia · SQLite（`plus.sqlite`）· UTS OCR 插件

---

## 界面一览

下面每一张都是**真实渲染的截图**，不是效果图：`npm run build:h5` 出包 → 起静态服务 →
用固定 390px 宽的 iframe 承载页面 → 2 倍图截图（为什么必须走 iframe 见 [6.2](#62-截图为什么必须走-iframe)）。
源码在 `preview/screens.sh`，随时可以自己重跑一遍。

<img src="preview/ui-8-screens.png" width="900" alt="设计稿 8 屏的实现">

<sub>↑ 设计稿指定的 8 屏（<code>01</code>–<code>08</code>）。</sub>

<img src="preview/ui-extra-pages.png" width="900" alt="补充验收的 5 个二级页">

<sub>↑ 设计稿没画、但内部要验收的 5 个二级页（<code>09</code>–<code>13</code>）：编辑题目、复习会话、确认入库、备份恢复、设置。</sub>

> 截图为演示库初始状态：共 18 题、今天还没学，所以复习环是 `0 / 20`。
> 这些数字全部来自真实统计，没有写死（见 [已知限制](#七已知限制如实列出) 第 5 条）。

<details>
<summary>13 屏单张（点击展开，可按编号对照上面两张合集）</summary>

<br>

<table>
  <tr>
    <td align="center" valign="top"><img src="preview/screens/01-home.png" width="170" alt="首页 · 四入口 + 真实统计"><br><sub><b>01</b> 首页 · 四入口 + 真实统计</sub></td>
    <td align="center" valign="top"><img src="preview/screens/02-capture.png" width="170" alt="识别 · 图片 / 粘贴文本"><br><sub><b>02</b> 识别 · 图片 / 粘贴文本</sub></td>
    <td align="center" valign="top"><img src="preview/screens/03-library.png" width="170" alt="题库 · 一个白容器四行"><br><sub><b>03</b> 题库 · 一个白容器四行</sub></td>
    <td align="center" valign="top"><img src="preview/screens/04-review.png" width="170" alt="复习 · 今日进度环"><br><sub><b>04</b> 复习 · 今日进度环</sub></td>
  </tr>
  <tr>
    <td align="center" valign="top"><img src="preview/screens/05-plan.png" width="170" alt="计划 · 1/3/7 天到期表"><br><sub><b>05</b> 计划 · 1/3/7 天到期表</sub></td>
    <td align="center" valign="top"><img src="preview/screens/06-profile.png" width="170" alt="更多 · 备份 / 清空 / 设置"><br><sub><b>06</b> 更多 · 备份 / 清空 / 设置</sub></td>
    <td align="center" valign="top"><img src="preview/screens/07-detail.png" width="170" alt="详情 · 参考回答 + 笔记"><br><sub><b>07</b> 详情 · 参考回答 + 笔记</sub></td>
    <td align="center" valign="top"><img src="preview/screens/08-ocr-result.png" width="170" alt="识别结果 · 按编号拆题"><br><sub><b>08</b> 识别结果 · 按编号拆题</sub></td>
  </tr>
  <tr>
    <td align="center" valign="top"><img src="preview/screens/09-edit.png" width="170" alt="编辑题目 · AI 草稿只作草稿"><br><sub><b>09</b> 编辑题目 · AI 草稿只作草稿</sub></td>
    <td align="center" valign="top"><img src="preview/screens/10-study.png" width="170" alt="复习会话 · 先答后看"><br><sub><b>10</b> 复习会话 · 先答后看</sub></td>
    <td align="center" valign="top"><img src="preview/screens/11-batch-save.png" width="170" alt="确认入库 · 逐题打标"><br><sub><b>11</b> 确认入库 · 逐题打标</sub></td>
    <td align="center" valign="top"><img src="preview/screens/12-backup.png" width="170" alt="备份恢复 · 导出 / 覆盖 / 合并"><br><sub><b>12</b> 备份恢复 · 导出 / 覆盖 / 合并</sub></td>
  </tr>
  <tr>
    <td align="center" valign="top"><img src="preview/screens/13-settings.png" width="170" alt="设置 · 引擎与授权状态"><br><sub><b>13</b> 设置 · 引擎与授权状态</sub></td>
  </tr>
</table>

</details>

---

## 一、运行

```bash
npm install
npm run dev:h5          # 浏览器调试（数据走 storage 降级实现）
npm run dev:app         # APP（需自定义基座，见「已知限制」）
npm run dev:mp-weixin   # 微信小程序（无 SQLite / 无本地 OCR）

npm run type-check      # vue-tsc --noEmit，strict 模式
npm run build:h5        # 产物 dist/build/h5
npm run build:mp-weixin # 产物 dist/build/mp-weixin
npm run preview         # 真实渲染截图，产物 preview/screens/*.png（需本机 Chrome）
npm run verify:backup   # 备份三段式端到端验证（导出 → 清空 → 导入）
```

首次启动自动播种示例数据（4 个分类、10 个标签、18 道题），
`更多 → 清空数据` 可从零开始。播种前先判空，不会覆盖你后来的题。

> `npm run preview` 会调本机 Chrome 截图。默认找
> `/c/Program Files/Google/Chrome/Application/chrome.exe`（Git Bash 写法），
> 装在别处就指定一次：`CHROME_BIN="/c/Program Files (x86)/Google/Chrome/Application/chrome.exe" npm run preview`。
> 没装 Chrome 也不影响开发，只是截图脚本会失败。

---

## 二、目录

```
src/
├── pages/            # 13 个页面，按功能分目录
│   ├── home/         # 首页：四入口 + 统计 + 最近学习
│   ├── library/      # 题库：分类总览 / 列表 / 搜索
│   ├── capture/      # 识别、识别结果校对、批量入库
│   ├── question/     # 详情、编辑（含 AI 草稿）
│   ├── review/       # 复习首页、复习计划
│   ├── study/        # 学习会话
│   └── profile/      # 更多、设置、备份恢复
├── components/       # NavBar / TabBar / QuestionCard / AnswerEditor / TagSelector / OcrProgress …
├── stores/           # Pinia：app（启动与统计）、settings（偏好）
├── services/         # 业务编排：ocr、ai、review、backup、question（拆题 + 打标）
├── repositories/     # 表级读写，唯一接触 DatabaseAdapter 的层
├── adapters/         # 平台差异全部关在这里
│   ├── database/     # sqlite / storage 两套实现 + schema + 字段映射
│   ├── ocr/          # local（UTS 插件）+ cloud（腾讯云走代理）
│   ├── file/         # 图片落 `_doc/interview-box/images/`
│   └── network/      # 只连自己的轻量代理
├── types/            # models / ocr / ai / db
├── utils/            # id、date、text、icons、event
└── styles/           # 设计 token 与公共类
```

---

## 三、数据层

### 3.1 七张表

`categories` · `questions` · `tags` · `question_tags` · `source_assets` ·
`question_sources` · `review_logs`

约定：UUID 主键、毫秒时间戳、`difficulty` 取 1/2/3、
`mastery_status ∈ new | learning | fuzzy | mastered`、软删除用 `deleted_at`。

两张「来源表」是刻意拆开的：

- `source_assets` 存**原始图片 / 原始 OCR 文本**（`raw_text` + 可编辑的 `edited_text`），
  一张图可以支撑多道题，删题不删图；
- `question_sources` 是题目 ↔ 素材的多对多，同时记 OCR 引擎与质量提示。

这样「OCR 原文必须保留」「一图多题」「图片重启后还在」三条要求才有落点，
而不是把图片路径硬塞进 `questions` 一行里。

### 3.2 版本化迁移，不在启动时乱建表

`schema_migrations` 先建，然后只跑**版本号大于已记录值**的迁移，整批包在
`begin / commit / rollback` 里，失败则回滚且保留旧版本号。
新增 v2 只需往 `MIGRATIONS` 追加一项。

### 3.3 一个接口，两套实现

```ts
interface DatabaseAdapter {
  kind: 'sqlite' | 'storage'
  all / first / count / insert / insertMany / update / remove
  transaction / dump / restore / schemaVersion
}
```

- **APP** → `plus.sqlite`（`_doc/interview_box.db`），真正的 SQL 与事务；
- **H5 / 小程序 / APP 打开库失败** → `uni.storage` 全量快照降级。

仓库层只认接口，永不 `if (platform)`。降级不藏着：`dbFallbackInfo()` 把 `engine`
与 `reason` 交给设置页展示（「本地键值快照（降级）：当前平台无 SQLite」）。

> `plus.sqlite` 的 `executeSql` **不支持参数绑定**，所以值全部经 `sqlLit()` 转成字面量
> （单引号翻倍、`undefined`→`NULL`、布尔→0/1）。这是该能力下唯一可行的做法，
> 也是本层最需要小心的地方。

---

## 四、四个关键流程

### 4.1 OCR：本地优先，云端必须你点头

```
拍照/选图 → 复制进 _doc（持久路径）→ 本地 UTS 插件识别
                                   ↓ 失败
                         已授权？ → 二次确认 → 云端代理识别
                                   ↓ 都失败
                        可读错误（两个原因都列出）→ 引导粘贴文本/手录
```

- `OCRAdapter` 只有 `isSupported()` + `recognize()`，云与本地同签名，上层不感知差异；
- 授权状态持久化在 `interview_box_ocr_consent`，**拒绝时不会发出任何网络请求**，
  设置页可随时撤销；
- 多图**顺序识别**，`OcrProgress` 逐图显示进度，一张失败不拖垮整批；
- 识别结果页可直接改文字、按编号拆题、合并相邻题，原文留在 `source_assets`。

### 4.2 AI：只产草稿，绝不覆盖已有答案

```
generate() → AiAnswerDraft（内存草稿，不落库）
   ↓ 用户可改
acceptDraft({ editedText, overwrite })   ← 唯一写 reference_answer 的入口
```

- 答案强制五段式（结论 / 原理 / 落地 / 取舍 / 追问）；
- 已有参考答案时 `overwrite: false` 会被直接拒绝，前端还要再确认一次；
- 写入后 `answer_origin` 标记 `ai` / `ai_edited`，详情页能看出这段答案的来历。

### 4.3 复习：日志先于状态

`applyReview()` 先写 `review_logs`，再更新题目状态与 `next_review_at`。
顺序反了就会出现「状态变了但没记录」，连续天数与会话统计失真。
排期 1/3/7 → 14/30 天，模糊回答回退，已掌握只做长间隔回顾。

### 4.4 备份：带校验的可恢复包

导出 `{ schemaVersion, exportedAt, counts, tables, checksum }`；恢复前先 `validate()`
比对表结构与条数，再按 `replace` / `merge` 写库，`replace` 在事务里先清空。
图片路径原样带上，恢复后仍可打开。

---

## 五、平台差异（能力边界，不是 bug）

| | APP（Android/iOS） | H5 | 微信小程序 |
| --- | --- | --- | --- |
| 数据库 | `plus.sqlite` | storage 快照 | storage 快照 |
| 本地 OCR | UTS 插件（需自行导入） | 不支持 | 不支持 |
| 图片持久化 | 复制进 `_doc` | 临时路径 | 临时路径 |
| 云端 OCR / AI | 走自建代理 | 同 | 同 |

微信小程序产物里 `sqlite.ts` 已被条件编译**整体剔除**（只剩提示文案字符串），
不会因为引用 `plus` 而报错；OCR 走同一套接口，`isSupported()` 返回 false。

---

## 六、验证记录

下表每一项都在 CI 里自动跑（`.github/workflows/ci.yml`，push / PR 触发，Node 22），
不是只在某台机器上手点过一次：

| 项 | 结果 |
| --- | --- |
| `npm run type-check` | **0 error**（strict，覆盖 13 个页面与全部 .vue） |
| `npm run build:h5` | 成功，按路由分包 |
| `npm run build:mp-weixin` | 成功，`plus.sqlite` 未进包 |
| `npm run verify:backup` | **35 项全通过**（导出 → 清空 → 覆盖恢复 → 合并恢复，含 5 条负例） |
| 产物密钥扫描 | `dist/` 内无 `sk-` / `AKID` / `gh?_` / 私钥块，命中即 fail |
| 密钥泄漏检查 | 产物内无 secret / token 字样（客户端本就不存密钥） |
| 视觉对照 | `npm run preview` 真实渲染 **13 屏**（设计稿 8 屏 + 5 个二级页），逐屏比对，全部图见上面的[界面一览](#界面一览) |

### 6.0 备份恢复验的是什么

`npm run verify:backup` 跑的不是重写一遍的逻辑，而是 `services/backup` + `adapters/database`
的真代码（用 esbuild 把 TS 打成临时 ESM，垫一个内存版 `uni` storage 再执行）：

1. 播种 → 埋「探针笔记 / 探针答案 / 一条复习记录」→ 导出；
2. **负例**：改条数、抬高 schema 版本、换 app 名、半截 JSON、缺题目数组 —— 五种坏文件必须被挡；
3. 清空（题目/分类归零）；
4. **覆盖恢复**：七张表逐表逐行与导出前完全一致，笔记/答案/复习记录都在；
5. **合并恢复**：库里已有 → 新增 0、跳过 N，且用户改过的笔记**没被覆盖**；
6. 删掉一题再合并 → 能补回，计数正确。

跑的是 storage 引擎（H5/小程序同款降级实现）；`plus.sqlite` 需要真机，**没覆盖**，脚本会打印引擎名。

### 6.1 UI 还原的做法

设计稿是一张 1254×1254 的 JPG 拼图，**肉眼估色不可靠**，所以颜色是算出来的：
把每个屏的手机区域切出来，对饱和像素做 `quantize()` 聚类再取中位数，得到

| token | 值 | 用途 |
| --- | --- | --- |
| `--primary` | `#5B50F5` | 主色（早先误判为 `#6C5CE7`，偏红） |
| `--primary-deep` | `#4A3FE0` | 按压 / 深色描边 |
| `--primary-soft` | `#EAEBFD` | 浅紫底（chip、按钮底） |
| `--bg-page` | `#F5F5FE` | **页面底不是纯白**，是带紫的浅灰 |
| `--text` | `#171A2C` | 正文近黑 |

结构差异不是靠改色能解决的，逐项重建：我的题库改成「一个白容器 + 四行 + 容器内主按钮」、
首页入口图标换成实心（图标下面不再垫方块）、TabBar 选中态用实心图标 + 短下划线、
banner 加「扫描框背板 + 倾斜纸张 + 手绘标语弧线」、复习页圆环用 conic-gradient 蓝紫渐变、
头像用纯 CSS 画（不引位图）。

### 6.2 截图为什么必须走 iframe

headless Chrome 有约 **504px 的最小视口**，直接 `--window-size=390,844` 会按 504 渲染再裁切，
右侧内容直接丢失（表现为「相册识别」卡片被切）。所以 `preview/live_shot.html` 用一个固定
`390px` 的 iframe 承载页面、外层窗口开成 390×N，再按 2 倍图截图。
详情页/识别结果页依赖运行时数据（演示库每次冷启动都会重新播种、id 是随机 uuid），
所以探针页要么先启动应用读出 id 再 `location.hash` 跳转，要么先把草稿写进 storage 再跳。

---

## 七、已知限制（如实列出）

1. **真机未验证**：`plus.sqlite` 与 UTS OCR 需要 Android/iOS 打包环境。本仓库完成的是
   类型检查 + H5 / 小程序编译 + H5 运行逻辑，**没有在真机上跑过**。
   备份恢复的端到端验证（`npm run verify:backup`）跑的是 storage 引擎，`plus.sqlite` 未覆盖。
2. **`local-ocr-lite` 未内置**：UTS 插件需从插件市场导入 `nativeplugins/` 并打自定义基座；
   未安装时 `capabilities()` 如实报告「未安装 UTS 插件」，页面提示改用粘贴文本。
3. **云端代理未提供**：只有 `adapters/network` 与设置页的端点配置，
   服务端（腾讯云 OCR / 大模型转发）需自行实现，约定见 `services/ocr`、`services/ai`。
4. **插画是 CSS/图标复现**：设计稿的手绘插画（banner 纸张、日历、头像）用渐变块 + 图标重画，
   不是位图原样抠图。
5. **示例数据是 18 题**：设计稿上的 128 题 / 12 今日新增 / 92% 掌握率是示意值，
   首页数字全部来自真实统计，不写死。演示数据里今天还没学，所以复习页圆环是 0/20。
6. **无账号与多端同步**：PRD 明确本地优先，同步不在本期范围。

---

## 八、开发工具

- `preview/screens.sh`（`npm run preview`）：起临时静态服务 → 逐屏真实渲染截图 → 关服务。
  产物在 `preview/screens/`，2 倍图：`01-08` 是设计稿的 8 屏，`09-13` 是设计稿没画、
  但内部要验收的二级页（编辑题目 / 复习会话 / 批量入库 / 备份恢复 / 设置）。
- `preview/shoot.sh`：单屏截图，`bash preview/shoot.sh <名字> <路由> [高度] [query]`。
- `preview/live_shot.html`：390px iframe 承载页；路由里写 `{{id}}` 时，先启动应用读出题目 id
  再替换进去跳转（演示库每次冷启动都会重新播种，id 是随机 uuid）。
- `preview/_seed.html`：把一份草稿写进 storage 后再跳过去，用于验收识别结果页（`kind=ocr`）
  和批量入库页（`kind=batch`）—— 这两页没有 URL 入参，只能靠 storage 交接。
- `preview/_measure.html`：在 iframe 里跑 `getBoundingClientRect` / `elementFromPoint`，
  定位「文字被谁盖住」这类只在实际渲染里才暴露的问题。
- `scripts/verify-backup.mjs`（`npm run verify:backup`）：备份三段式的端到端验证，见 6.0。
- `scripts/port-page.js`：迁移期用于把旧页面「原样保留 template/style、只换 script」，
  保证换技术栈不改像素。

---

## 九、许可证

[MIT](LICENSE) © 2026 张凤垚。随便用、随便改，保留版权声明即可。

界面按给定设计稿复刻，设计稿版权归原作者；仓库内不含任何设计源文件。
项目不内置任何 OCR / 大模型的密钥，也没有账号体系，**没有收集任何用户数据**。
