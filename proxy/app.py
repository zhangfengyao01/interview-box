"""AI 答案代理 —— 这个应用唯一需要的服务端。

为什么需要它：客户端（H5 / 微信小程序 / APP）只要内置了厂商 API Key，就等于公开。
小程序包能反编译、H5 能看 Network、抓包工具一把抓 —— Key 一旦泄露，烧的是你的额度。
所以客户端不直连模型厂商，只跟这个代理说话，Key 只存在于服务端环境变量里。

职责刻意只有三件，不做第四件：
1. 把客户端的结构化请求翻译成一次模型调用（OpenAI 兼容协议）；
2. 把模型输出收敛成客户端约定的 {answerMarkdown, followUps}；
3. 把厂商 Key 留在服务端。

不落库、不缓存题库、不做用户体系 —— 代理里出现任何业务状态，都是在给自己挖坑。

跑起来：
    pip install -r proxy/requirements.txt
    set LLM_API_KEY=你的key           # Windows；bash 下用 export
    python -m uvicorn proxy.app:app --port 8000
客户端「设置 → AI 答案助手 → 服务端地址」填 http://127.0.0.1:8000 即可。
"""

from __future__ import annotations

import json
import os
import re
from pathlib import Path
from typing import Literal

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# ---------------------------------------------------------------- 配置
# .env 和本文件同目录，且必须在读环境变量之前加载。
# 用 .env 而不是 `set LLM_API_KEY=...`：Key 留在文件里，不会进 shell 历史，
# 也不会被 `ps` / 进程列表带出去。已存在的真实环境变量优先（load_dotenv 默认不覆盖）。
load_dotenv(Path(__file__).with_name(".env"))

# 默认指向智谱 GLM-4-Flash：国内可直连、有永久免费额度、协议与 OpenAI 兼容，
# 换硅基流动 / DeepSeek / 本地 Ollama 只需改这三个环境变量，代码一行不用动。
LLM_BASE_URL = os.getenv("LLM_BASE_URL", "https://open.bigmodel.cn/api/paas/v4").rstrip("/")
LLM_API_KEY = os.getenv("LLM_API_KEY", "")
LLM_MODEL = os.getenv("LLM_MODEL", "glm-4-flash")

# 客户端那边是 45s 超时（services/ai/index.ts），这里故意设 40s：
# 让代理先超时、先返回一个可读的错误，而不是让客户端等到自己断线，
# 那样用户只会看到一个笼统的「网络请求失败」。
UPSTREAM_TIMEOUT = float(os.getenv("UPSTREAM_TIMEOUT", "40"))

# MOCK=1 时不调模型，直接返回一份结构正确的样例。
# 用途：没有 Key 也能在真机上把「生成 → 编辑 → 采用」整条 UI 链路走通。
MOCK = os.getenv("MOCK", "") in ("1", "true", "yes")

DEFAULT_SECTIONS = [
    "面试时可以直接回答的内容",
    "核心原理",
    "必要的代码示例",
    "常见问题和容易踩的坑",
    "面试官可能追问的问题",
]

STYLE_HINT = {
    "interview": "按面试口头表达来写：先给结论，再展开原理，句子短、可以直接背下来。",
    "detailed": "按技术文档来写：覆盖原理、边界条件和实现细节，允许长句和专业术语。",
    "project": "结合一线项目经验来写：给出可复述的场景、技术取舍和踩过的坑，不要空泛。",
}

DIFFICULTY_HINT = {
    "easy": "提问者预期是初级岗，别堆术语。",
    "medium": "提问者预期是中高级岗，要讲清原理和取舍。",
    "hard": "提问者预期是资深岗，需要有深度和边界分析。",
}


# ---------------------------------------------------------------- 契约
# 字段与 src/types/ai.ts 的 AnswerRequest 一一对应。
# 加字段要同步改客户端，否则这里会静默忽略（Pydantic 默认忽略多余字段）。
class AnswerRequest(BaseModel):
    question: str = Field(min_length=1, max_length=2000)
    category: str = ""
    difficulty: Literal["easy", "medium", "hard"] = "medium"
    style: Literal["interview", "detailed", "project"] = "interview"
    sections: list[str] = Field(default_factory=list)


class AnswerResponse(BaseModel):
    answerMarkdown: str
    followUps: list[str] = Field(default_factory=list)


app = FastAPI(title="interview-box AI proxy", version="1.0.0")

# 本地开发：H5 跑在 localhost:8080/5173，代理在 8000，跨源必须放行。
# 生产环境要把 allow_origins 收紧成你的实际域名，别留 *（否则任何网页都能拿你的 Key 刷额度）。
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------- 提示词
def build_prompt(req: AnswerRequest) -> list[dict]:
    """把请求拼成 chat messages。

    两个刻意的设计：
    1. 要求「只输出 JSON」—— 客户端要的是 {answerMarkdown, followUps} 两个字段，
       让模型直接给结构，比让它写 markdown 再去猜哪里是追问可靠得多；
    2. 段数由客户端的 sections 决定，不写死在 prompt 里 —— 客户端想加一段
       「延伸阅读」时，代理不用跟着改。
    """
    sections = req.sections or DEFAULT_SECTIONS
    section_list = "\n".join(f"{i}. {s}" for i, s in enumerate(sections, 1))

    system = (
        "你是一位有十年经验的中文技术面试官兼面试辅导老师。"
        "你写出的答案要能被求职者直接背下来、并在真实面试里说出口。"
        "不确定的内容宁可写「这一点我不确定」，不要编造 API 名称或版本号。"
    )

    user = f"""请为下面这道面试题准备参考答案。

题目：{req.question}
分类：{req.category or "未分类"}
难度：{req.difficulty}（{DIFFICULTY_HINT[req.difficulty]}）
风格：{STYLE_HINT[req.style]}

答案必须严格按以下 {len(sections)} 个部分组织，每部分用 `## ` 加二级标题：
{section_list}

输出要求（很重要）：
- 只输出一个 JSON 对象，不要任何解释性文字，不要 markdown 代码围栏；
- 结构：{{"answerMarkdown": "用 markdown 写的完整答案", "followUps": ["追问1", "追问2"]}}
- followUps 是面试官听完这段回答后最可能追问的 3-5 个问题，每个不超过 25 字；
- answerMarkdown 里的代码块请标注语言。"""

    return [
        {"role": "system", "content": system},
        {"role": "user", "content": user},
    ]


# ---------------------------------------------------------------- 解析
_FENCE = re.compile(r"^```(?:json)?\s*|\s*```$", re.MULTILINE)


def parse_model_content(content: str, sections: list[str]) -> AnswerResponse:
    """从模型回复里取出结构化结果。

    模型被要求输出纯 JSON，但现实里它经常裹一层 ```json 围栏，或者在前言里
    先客气两句。所以这里的策略是「先宽松取 JSON，取不到再优雅降级」：
    JSON 解析失败时不报错，而是把整段文字当成答案、从追问段里抽 followUps ——
    宁可少几个追问，也不能让用户对着一个报错弹窗。
    """
    text = (content or "").strip()
    if not text:
        raise HTTPException(status_code=502, detail="模型返回了空内容")

    candidate = _FENCE.sub("", text).strip()
    start, end = candidate.find("{"), candidate.rfind("}")
    if start >= 0 and end > start:
        try:
            data = json.loads(candidate[start : end + 1])
            markdown = str(data.get("answerMarkdown") or "").strip()
            if markdown:
                raw_follow = data.get("followUps") or []
                follow = [str(x).strip() for x in raw_follow if str(x).strip()][:8]
                return AnswerResponse(answerMarkdown=markdown, followUps=follow)
        except (json.JSONDecodeError, AttributeError, TypeError):
            pass  # 落到下面的降级分支

    return AnswerResponse(answerMarkdown=candidate, followUps=extract_follow_ups(candidate, sections))


def extract_follow_ups(markdown: str, sections: list[str]) -> list[str]:
    """降级路径：从「面试官可能追问的问题」这一节里抽列表项。"""
    title = next((s for s in sections if "追问" in s), "面试官可能追问的问题")
    lines = markdown.splitlines()
    out: list[str] = []
    inside = False
    for line in lines:
        stripped = line.strip()
        if stripped.startswith("#"):
            inside = title in stripped
            continue
        if not inside:
            continue
        bullet = re.match(r"^[-*+]\s+(.+)$|^\d+[.、)]\s*(.+)$", stripped)
        if bullet:
            item = (bullet.group(1) or bullet.group(2) or "").strip()
            if item:
                out.append(item)
    return out[:8]


# ---------------------------------------------------------------- 上游调用
async def call_llm(req: AnswerRequest) -> AnswerResponse:
    if MOCK:
        return mock_answer(req)

    if not LLM_API_KEY:
        # 说清楚缺什么、去哪儿配，而不是抛一个 500 让人猜。
        raise HTTPException(
            status_code=503,
            detail="服务端未设置 LLM_API_KEY（智谱开放平台可申请，GLM-4-Flash 有免费额度）",
        )

    payload = {
        "model": LLM_MODEL,
        "messages": build_prompt(req),
        "temperature": 0.6,
        "max_tokens": 2048,
        "stream": False,
    }

    try:
        async with httpx.AsyncClient(timeout=UPSTREAM_TIMEOUT) as client:
            resp = await client.post(
                f"{LLM_BASE_URL}/chat/completions",
                headers={
                    "Authorization": f"Bearer {LLM_API_KEY}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail=f"上游模型 {UPSTREAM_TIMEOUT:.0f}s 未返回，请重试")
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"连不上模型服务：{exc.__class__.__name__}")

    if resp.status_code >= 400:
        # 只透出上游的错误摘要，绝不回显请求头（里面有 Key）。
        detail = resp.text[:300].replace("\n", " ")
        raise HTTPException(status_code=502, detail=f"模型服务返回 {resp.status_code}：{detail}")

    try:
        body = resp.json()
        content = body["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError, ValueError):
        raise HTTPException(status_code=502, detail="模型返回体不符合 OpenAI 兼容格式")

    return parse_model_content(content, req.sections or DEFAULT_SECTIONS)


# ---------------------------------------------------------------- 路由
@app.get("/healthz")
async def healthz() -> dict:
    """给客户端 / 运维一个不花钱的自检：不打上游，只报配置状态。"""
    return {
        "ok": True,
        "mock": MOCK,
        "model": LLM_MODEL,
        "baseUrl": LLM_BASE_URL,
        "keyConfigured": bool(LLM_API_KEY),
    }


@app.post("/api/ai/answer", response_model=AnswerResponse)
async def answer(req: AnswerRequest) -> AnswerResponse:
    return await call_llm(req)


# ---------------------------------------------------------------- Mock
def mock_answer(req: AnswerRequest) -> AnswerResponse:
    """不带 Key 也能验收整条 AI 链路用的假答案。内容标注清楚是 mock，别混进真实题库。"""
    sections = req.sections or DEFAULT_SECTIONS
    blocks = [f"## {s}\n\n（mock 数据 · 未调用真实模型）本节演示「{s}」的排版效果。" for s in sections]
    return AnswerResponse(
        answerMarkdown=f"# {req.question}\n\n" + "\n\n".join(blocks),
        followUps=["这个方案在什么量级下会出问题？", "如果让你重做一次，会改哪里？", "线上怎么监控它？"],
    )
