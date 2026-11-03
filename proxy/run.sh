#!/usr/bin/env bash
# 起 AI 代理（bash / macOS / Linux 用；Windows 双击 run.bat 即可）
# 用法：bash proxy/run.sh
set -e
cd "$(dirname "$0")"

# Python 探测顺序：项目内 .venv → 托管 venv → 系统 python
PY="python"
for c in "../.venv/Scripts/python.exe" "../.venv/bin/python" \
         "$HOME/.workbuddy/binaries/python/envs/default/Scripts/python.exe"; do
  if [ -x "$c" ]; then PY="$c"; break; fi
done

if ! "$PY" -c "import fastapi, uvicorn, httpx, dotenv" 2>/dev/null; then
  echo "[!] 缺依赖，先执行：$PY -m pip install -r requirements.txt"
  exit 1
fi

[ -f .env ] || echo "[!] 没有 .env：复制 .env.example 为 .env 并填 LLM_API_KEY，或 MOCK=1 先看 UI 效果"

echo "代理启动中 —— 客户端「设置 → AI 答案助手 → 服务端地址」填 http://127.0.0.1:8000"
exec "$PY" -m uvicorn app:app --host 127.0.0.1 --port 8000 --reload
