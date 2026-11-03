#!/usr/bin/env bash
# 真实渲染截图：绕过 headless Chrome 约 504px 的最小视口，用固定 390px 的 iframe 承载页面。
# 用法：bash preview/shoot.sh <名字> <路由> [高度=844] [附加 query，如 id=auto]
# 产物：preview/screens/<名字>.png（2 倍图，780 宽）
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CHROME="${CHROME_BIN:-/c/Program Files/Google/Chrome/Application/chrome.exe}"
NAME="$1"
ROUTE="$2"
H="${3:-844}"
EXTRA="$4"
mkdir -p "$ROOT/preview/screens"
OUT="$ROOT/preview/screens/${NAME}.png"
WIN=$(cygpath -w "$OUT" 2>/dev/null || echo "$OUT")

# 端口由 screens.sh 通过环境变量传入（它会挑一个空闲端口）；单独手动跑时才用 4567。
PORT="${PORT:-4567}"
URL="http://127.0.0.1:${PORT}/_shot.html?p=${ROUTE}&h=${H}"
if [ -n "$EXTRA" ]; then URL="${URL}&${EXTRA}"; fi

"$CHROME" --headless=new --disable-gpu --no-sandbox --hide-scrollbars \
  --force-device-scale-factor=2 --virtual-time-budget=20000 \
  --window-size=390,"$H" --screenshot="$WIN" "$URL" 2>&1 | grep -v "^\[" | tail -1
