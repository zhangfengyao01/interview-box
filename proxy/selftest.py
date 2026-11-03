"""代理离线自测：不需要 API Key，也不需要联网。

思路：起一个假的「上游模型服务」（返回 OpenAI 兼容结构），把代理的 LLM_BASE_URL
指过去，然后用 httpx 的 ASGITransport 直接调代理 —— 走的是完整 HTTP 处理链路，
只是末端换成了一个可控的桩。

覆盖 6 种情况：
  1. 模型规规矩矩返回纯 JSON            → 解析出 answerMarkdown + followUps
  2. 模型把 JSON 裹在 ```json 围栏里    → 照样解析得出
  3. 模型完全不听话、返回纯 markdown    → 降级：整段当答案，从「追问」段抽 followUps
  4. 上游 500                          → 代理回 502，且不泄漏 Key
  5. 服务端没配 Key                    → 代理回 503，提示明确
  6. MOCK=1                            → 不调上游也能返回结构完整的样例

跑法（项目根目录）：python proxy/selftest.py
"""

from __future__ import annotations

import asyncio
import importlib
import os
import sys
import threading
import time
from pathlib import Path

# Request 必须放在模块顶层：本文件有 `from __future__ import annotations`，
# 注解会变成字符串，FastAPI 靠模块全局命名空间去解析它 ——
# 写进 make_stub() 的局部作用域会解析失败，被当成 query 参数（实测报 422）。
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

STUB_PORT = int(os.getenv("STUB_PORT", "8899"))
PASS: list[str] = []
FAIL: list[str] = []


def check(name: str, ok: bool, detail: str = "") -> None:
    (PASS if ok else FAIL).append(name)
    print(f"  {'PASS' if ok else 'FAIL'}  {name}{'' if ok else '  ← ' + detail}")


# ---------------------------------------------------------------- 假上游
def make_stub():
    stub = FastAPI()

    @stub.post("/v1/chat/completions")
    async def completions(request: Request):
        body = await request.json()
        question = body["messages"][-1]["content"]

        if "BOOM" in question:
            return JSONResponse(status_code=500, content={"error": "upstream exploded"})

        if "PLAIN" in question:
            content = (
                "# 纯文本答案\n\n## 面试时可以直接回答的内容\n\n先说结论。\n\n"
                "## 面试官可能追问的问题\n\n- 追问甲\n- 追问乙\n"
            )
        elif "FENCE" in question:
            content = (
                '好，下面是答案：\n```json\n{"answerMarkdown": "# 围栏答案\\n\\n正文",'
                ' "followUps": ["围栏追问"]}\n```\n'
            )
        else:
            content = '{"answerMarkdown": "# RAG 答案\\n\\n正文", "followUps": ["追问一", "追问二"]}'

        return {"choices": [{"message": {"role": "assistant", "content": content}}]}

    return stub


def serve_stub() -> threading.Thread:
    import uvicorn

    config = uvicorn.Config(make_stub(), host="127.0.0.1", port=STUB_PORT, log_level="error")
    server = uvicorn.Server(config)
    thread = threading.Thread(target=server.run, daemon=True)
    thread.start()

    for _ in range(50):
        import socket

        with socket.socket() as s:
            if s.connect_ex(("127.0.0.1", STUB_PORT)) == 0:
                return thread
        time.sleep(0.1)
    raise RuntimeError("桩服务没起来")


# ---------------------------------------------------------------- 代理实例
def load_app(**env):
    """按给定环境变量重新加载代理模块（模块级常量在 import 时求值，所以必须 reload）。"""
    # 新变量加进 app.py 后必须同步加到这个清理名单里：漏掉就会「继承」上一组的配置，
    # 实测 PROXY_TOKEN 漏清过一次，限流那组全都拿到 401。
    for key in (
        "LLM_BASE_URL",
        "LLM_API_KEY",
        "LLM_MODEL",
        "MOCK",
        "UPSTREAM_TIMEOUT",
        "PROXY_TOKEN",
        "RATE_LIMIT_PER_MIN",
        "ALLOWED_ORIGINS",
    ):
        os.environ.pop(key, None)
    os.environ.update(env)
    import proxy.app as mod

    return importlib.reload(mod)


async def ask(module, payload: dict, headers: dict | None = None):
    import httpx

    transport = httpx.ASGITransport(app=module.app)
    async with httpx.AsyncClient(transport=transport, base_url="http://proxy") as client:
        return await client.post("/api/ai/answer", json=payload, headers=headers or {})


def rule(title: str) -> None:
    print(f"\n{title}")


async def main() -> int:
    serve_stub()
    base = {"category": "AI 大模型", "difficulty": "medium", "style": "interview",
            "sections": ["面试时可以直接回答的内容", "核心原理", "常见问题和容易踩的坑", "面试官可能追问的问题"]}

    rule("1. 上游返回纯 JSON")
    mod = load_app(LLM_BASE_URL=f"http://127.0.0.1:{STUB_PORT}/v1", LLM_API_KEY="k", LLM_MODEL="stub")
    r = await ask(mod, {**base, "question": "RAG 的完整流程是什么？"})
    body = r.json()
    check("HTTP 200", r.status_code == 200, str(r.status_code))
    check("answerMarkdown 解析正确", body.get("answerMarkdown", "").startswith("# RAG 答案"), str(body)[:120])
    check("followUps 取到 2 条", body.get("followUps") == ["追问一", "追问二"], str(body.get("followUps")))

    rule("2. JSON 被 ```json 围栏包住")
    r = await ask(mod, {**base, "question": "FENCE 测试"})
    body = r.json()
    check("HTTP 200", r.status_code == 200, str(r.status_code))
    check("围栏被剥掉", body.get("answerMarkdown", "").startswith("# 围栏答案"), str(body)[:120])
    check("followUps 正常", body.get("followUps") == ["围栏追问"], str(body.get("followUps")))

    rule("3. 模型不听话，返回纯 markdown（降级路径）")
    r = await ask(mod, {**base, "question": "PLAIN 测试"})
    body = r.json()
    check("HTTP 200（没报错）", r.status_code == 200, str(r.status_code))
    check("整段被当作答案", body.get("answerMarkdown", "").startswith("# 纯文本答案"), str(body)[:120])
    check("从追问段抽出 2 条", body.get("followUps") == ["追问甲", "追问乙"], str(body.get("followUps")))

    rule("4. 上游 500")
    r = await ask(mod, {**base, "question": "BOOM 测试"})
    check("代理回 502", r.status_code == 502, str(r.status_code))
    check("错误里不含 Key", "k" * 8 not in r.text and "Bearer" not in r.text, r.text[:120])

    rule("5. 服务端没配 Key")
    mod_nokey = load_app(LLM_BASE_URL=f"http://127.0.0.1:{STUB_PORT}/v1", LLM_API_KEY="", LLM_MODEL="stub")
    r = await ask(mod_nokey, {**base, "question": "RAG 的完整流程是什么？"})
    check("回 503", r.status_code == 503, str(r.status_code))
    check("提示写明缺 LLM_API_KEY", "LLM_API_KEY" in r.text, r.text[:120])

    rule("6. MOCK=1 不调上游")
    mod_mock = load_app(MOCK="1", LLM_API_KEY="", LLM_MODEL="stub")
    r = await ask(mod_mock, {**base, "question": "CI/CD 是什么？"})
    body = r.json()
    check("HTTP 200", r.status_code == 200, str(r.status_code))
    check("答案标了 mock", "mock" in body.get("answerMarkdown", "").lower(), str(body)[:120])
    check("四个小节都在", body.get("answerMarkdown", "").count("## ") == 4, str(body.get("answerMarkdown"))[:200])

    rule("7. /healthz 不打上游")
    import httpx

    # reload 是原地改模块对象，前面第 6 步把 mod 变成 MOCK 配置了，
    # 这里必须重新载入一份配了 Key 的实例，否则读到的是上一步的状态。
    mod = load_app(LLM_BASE_URL=f"http://127.0.0.1:{STUB_PORT}/v1", LLM_API_KEY="k", LLM_MODEL="stub")
    transport = httpx.ASGITransport(app=mod.app)
    async with httpx.AsyncClient(transport=transport, base_url="http://proxy") as client:
        h = (await client.get("/healthz")).json()
    check("keyConfigured=true", h.get("keyConfigured") is True, str(h))
    check("model 回显", h.get("model") == "stub", str(h))
    check("未配令牌时 authRequired=false", h.get("authRequired") is False, str(h))
    check("默认限流 10/分", h.get("rateLimitPerMin") == 10, str(h))

    # ---------------------------------------------------------------- 8. 鉴权
    rule("8. 访问令牌（PROXY_TOKEN）")
    mod_auth = load_app(
        LLM_BASE_URL=f"http://127.0.0.1:{STUB_PORT}/v1",
        LLM_API_KEY="k",
        LLM_MODEL="stub",
        PROXY_TOKEN="secret-token",
    )
    r = await ask(mod_auth, {**base, "question": "RAG 的完整流程是什么？"})
    check("不带令牌 → 401", r.status_code == 401, str(r.status_code))
    r = await ask(mod_auth, {**base, "question": "RAG 的完整流程是什么？"}, {"Authorization": "Bearer wrong"})
    check("错误令牌 → 401", r.status_code == 401, str(r.status_code))
    r = await ask(
        mod_auth,
        {**base, "question": "RAG 的完整流程是什么？"},
        {"Authorization": "Bearer secret-token"},
    )
    check("正确令牌 → 200", r.status_code == 200, str(r.status_code) + " " + r.text[:120])
    r = await ask(mod_auth, {**base, "question": "RAG 的完整流程是什么？"}, {"Authorization": "secret-token"})
    check("兼容不带 Bearer 前缀", r.status_code == 200, str(r.status_code))

    # ---------------------------------------------------------------- 9. 限流
    rule("9. 限流（RATE_LIMIT_PER_MIN=2）")
    mod_rate = load_app(
        LLM_BASE_URL=f"http://127.0.0.1:{STUB_PORT}/v1",
        LLM_API_KEY="k",
        LLM_MODEL="stub",
        RATE_LIMIT_PER_MIN="2",
    )
    ok1 = await ask(mod_rate, {**base, "question": "第一次"})
    ok2 = await ask(mod_rate, {**base, "question": "第二次"})
    third = await ask(mod_rate, {**base, "question": "第三次"})
    check("前两次放行", ok1.status_code == 200 and ok2.status_code == 200, f"{ok1.status_code}/{ok2.status_code}")
    check("第三次 429", third.status_code == 429, str(third.status_code))
    check("429 带 Retry-After", third.headers.get("retry-after") is not None, str(dict(third.headers)))

    transport = httpx.ASGITransport(app=mod_rate.app)
    async with httpx.AsyncClient(transport=transport, base_url="http://proxy") as client:
        health = [ (await client.get("/healthz")).status_code for _ in range(5) ]
    check("healthz 不受限流", set(health) == {200}, str(health))

    # ---------------------------------------------------------------- 10. CORS
    rule("10. CORS 收紧")
    mod_cors = load_app(
        LLM_BASE_URL=f"http://127.0.0.1:{STUB_PORT}/v1",
        LLM_API_KEY="k",
        LLM_MODEL="stub",
        ALLOWED_ORIGINS="https://my-site.example",
    )
    transport = httpx.ASGITransport(app=mod_cors.app)
    async with httpx.AsyncClient(transport=transport, base_url="http://proxy") as client:
        local = await client.options(
            "/api/ai/answer",
            headers={"Origin": "http://localhost:5173", "Access-Control-Request-Method": "POST"},
        )
        allowed = await client.options(
            "/api/ai/answer",
            headers={"Origin": "https://my-site.example", "Access-Control-Request-Method": "POST"},
        )
        stranger = await client.options(
            "/api/ai/answer",
            headers={"Origin": "https://evil.example", "Access-Control-Request-Method": "POST"},
        )
    check("本地源放行", local.headers.get("access-control-allow-origin") == "http://localhost:5173", str(dict(local.headers)))
    check("白名单源放行", allowed.headers.get("access-control-allow-origin") == "https://my-site.example", str(dict(allowed.headers)))
    check(
        "陌生源不放行（不给 allow-origin 头）",
        "access-control-allow-origin" not in stranger.headers,
        str(dict(stranger.headers)),
    )

    print(f"\n{'=' * 40}\n通过 {len(PASS)} 项，失败 {len(FAIL)} 项")
    if FAIL:
        for name in FAIL:
            print(f"  - {name}")
        return 1
    print("全部通过：代理在不联网、不配 Key 的情况下也能验证完整链路。")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
