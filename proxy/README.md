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
GET  /healthz            {ok, mock, model, baseUrl, keyConfigured}   // 不打上游，不花钱
POST /api/ai/answer      请求 {question, category, difficulty, style, sections[]}
                         响应 {answerMarkdown, followUps[]}
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

## 上生产前必须改的三处

1. `allow_origins=["*"]` → 换成你的实际域名（现在任何网页都能拿你的 Key 刷额度）；
2. 没有鉴权 → 客户端目前不带任何 header，加鉴权要同步改 `src/adapters/network/index.ts`；
3. 没有限流 → 免费额度被刷爆是分钟级的事，至少按 IP 加个令牌桶。

代理刻意不做的事：不落库、不缓存题库、不做用户体系。它只做协议转换和 Key 托管。
