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

## 上生产前必须改的三处

1. `allow_origins=["*"]` → 换成你的实际域名（现在任何网页都能拿你的 Key 刷额度）；
2. 没有鉴权 → 客户端目前不带任何 header，加鉴权要同步改 `src/adapters/network/index.ts`；
3. 没有限流 → 免费额度被刷爆是分钟级的事，至少按 IP 加个令牌桶。

代理刻意不做的事：不落库、不缓存题库、不做用户体系。它只做协议转换和 Key 托管。
