# AI 答案代理

客户端（`src/services/ai`）只跟这个代理说话，不直连模型厂商。原因写在 `app.py` 顶部：
Key 打包进客户端等于公开。

## 跑起来

```bash
pip install -r proxy/requirements.txt
cp proxy/.env.example proxy/.env      # 填入 LLM_API_KEY
# Windows 双击 proxy/run.bat；bash 下 bash proxy/run.sh
```

客户端「我的 → 设置 → AI 答案助手」：打开开关，服务端地址填 `http://127.0.0.1:8000`。
代理设了 `PROXY_TOKEN` 的话，同一页的「访问令牌」填一样的值。

**没有 Key 也想先看 UI 效果**：`.env` 里设 `MOCK=1`，代理会返回一份结构正确的假答案，
「生成 → 编辑 → 采用」整条链路照常能走通，只是内容标了 mock。

## 换模型

只改 `.env` 三行，代码不动（要求上游兼容 OpenAI 的 `/chat/completions`）：

| 方案 | `LLM_BASE_URL` | `LLM_MODEL` | 说明 |
|---|---|---|---|
| 智谱（默认） | `https://open.bigmodel.cn/api/paas/v4` | `glm-4-flash` | 永久免费，国内直连 |
| 硅基流动 | `https://api.siliconflow.cn/v1` | `Qwen/Qwen2.5-7B-Instruct` | 小模型永久免费档 |
| DeepSeek | `https://api.deepseek.com/v1` | `deepseek-chat` | 便宜，非免费 |
| 本地 Ollama | `http://127.0.0.1:11434/v1` | `qwen2.5:7b` | 完全离线，Key 随便填 |

## 接口

```
GET  /healthz            {ok, mock, model, baseUrl, keyConfigured, authRequired, rateLimitPerMin}
                         // 不打上游、不鉴权、不限流 —— 它是探活用的，被限住只会让人误判故障
POST /api/ai/answer      请求 {question, category, difficulty, style, sections[]}
                         响应 {answerMarkdown, followUps[]}
                         // PROXY_TOKEN 设了时要求 Authorization: Bearer <token>
```

字段定义与 `src/types/ai.ts` 的 `AnswerRequest` / `AnswerResult` 一一对应。

## 真机验证（手机也能调通）

`proxy/serve_local.py` 把 **H5 产物和代理挂在同一个源**下。同源是必须的：
手机浏览器只在「打开页面」时给一次信任机会，XHR 打到另一个自签源会被直接拦掉
（`ERR_CERT_AUTHORITY_INVALID`），连「继续访问」都点不了。同源之后，一次信任通吃页面和接口。

三种场景，实测数据都记在下面：

| 场景 | 地址 | 证书 |
|---|---|---|
| 局域网直连（同一 WiFi） | `python proxy/serve_local.py` → `https://<局域网IP>:8443` | 自签，脚本现场生成（SAN 含 IP，30 天），手机点一次「继续访问」 |
| **公网穿透（推荐）** | `bash proxy/serve_public.sh`（Windows 双击 `serve_public.bat`）→ `https://*.trycloudflare.com` | **合法签发**，手机无需任何信任操作 |
| 穿透后给小程序用 | 同上，但需手机端「打开调试」跳过域名校验，见下 | 同上 |

公网方案用的是 cloudflared 免注册的快速隧道：它给的域名自带合法证书，
比自签更省事，也不要求手机和电脑在同一个网络。

```bash
# 前置：PATH 里有 cloudflared（改名后丢到任意 PATH 目录即可）
#   https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe
bash proxy/serve_public.sh          # Windows 双击 proxy/serve_public.bat
```

打印出的 `https://xxx.trycloudflare.com` 一个地址用两处：
浏览器打开它就是 H5 应用；应用里「服务端地址」也填它。

**小程序真机的硬门槛（绕不过，别白费力气）**：小程序要求 request 域名是
**已备案域名**且配置在后台白名单里，自签证书和穿透域名都不满足。
开发阶段唯一可行的办法是手机端「打开调试」临时跳过域名校验：
开发者工具预览扫码 → 手机上胶囊菜单 ⋯ → 打开调试 → 重新进入小程序。
正式版/体验版仍然必须备案域名。

## 接口安全：令牌、限流、CORS

三样都已经有实现，靠环境变量开关（`.env` 里设置）：

| 变量 | 默认 | 作用 |
|---|---|---|
| `PROXY_TOKEN` | 空 | 设了之后请求必须带 `Authorization: Bearer <token>`，否则 401。空 = 不校验（本地零摩擦） |
| `RATE_LIMIT_PER_MIN` | `10` | 每 IP 每分钟允许的请求数，超限返回 429 + `Retry-After`。`0` = 不限 |
| `ALLOWED_ORIGINS` | 空 | 额外放行的源，逗号分隔。默认已放行 `localhost` / `127.0.0.1` / 私有网段（`192.168.x.x`、`10.x`、`172.16-31.x`）任意端口 |

客户端侧对应改动已经做完了：设置页「访问令牌」→ `src/adapters/network` 在 header 带
`Authorization`；没填就不带，所以本地不设令牌照样能通。回归脚本
`npm run verify:network` 会抓实际发出的 header 验证这条链路，已接进 CI。

两点要先说清楚，别以为设完就万事大吉：

1. **令牌和限流都是进程内内存态**——单进程没问题，用 `--workers N` 起多进程时
   每个进程各算各的（实际限额变成 N 倍），正式部署要换成 Redis 这类共享存储；
2. **X-Forwarded-For 决定限流按谁算**——我取的是最左边那个值，所以它只有在你信任的
   反代/穿透后面才可信；直接裸奔在公网上，这个头是可以伪造的，限流会被绕过。

代理刻意不做的事：不落库、不缓存题库、不做用户体系。它只做协议转换和 Key 托管。
