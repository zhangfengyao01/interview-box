#!/usr/bin/env bash
# 一次跑完所有页面的真实渲染截图：起个临时静态服务 → 逐屏截 2 倍图 → 关掉服务。
# 前提：已经 npm run build:h5（没构建过会先构建一次）。
# 产物：preview/screens/*.png
#   01-08 = 设计稿里的 8 屏（用来和设计稿比）
#   09-13 = 设计稿没画、但内部要验收的二级页
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIST="$ROOT/dist/build/h5"
PORT=4567

if [ ! -f "$DIST/index.html" ]; then
  echo "dist 不存在，先构建 h5 …"
  ( cd "$ROOT" && npx uni build -p h5 >/dev/null 2>&1 )
fi

# 截图用的探针页要跟产物同源，否则读不到 localStorage
cp "$ROOT/preview/live_shot.html" "$DIST/_shot.html"
cp "$ROOT/preview/_seed.html" "$DIST/_seed.html"
cp "$ROOT/preview/_measure.html" "$DIST/_measure.html"

( cd "$DIST" && python -m http.server "$PORT" --bind 127.0.0.1 >/dev/null 2>&1 ) &
SERVER=$!
trap 'kill $SERVER 2>/dev/null || true' EXIT

# 等服务起来
for _ in $(seq 1 40); do
  if curl -fs "http://127.0.0.1:$PORT/index.html" >/dev/null 2>&1; then break; fi
  sleep 0.25
done

CHROME="${CHROME_BIN:-/c/Program Files/Google/Chrome/Application/chrome.exe}"

shoot() { bash "$ROOT/preview/shoot.sh" "$@"; }

shoot 01-home      /pages/home/index       900
shoot 02-capture   /pages/capture/index    900
shoot 03-library   /pages/library/index    900
shoot 04-review    /pages/review/index     900
shoot 05-plan      /pages/review/plan      1000
shoot 06-profile   /pages/profile/index    900
shoot 07-detail    /pages/question/detail  1180 "id=auto"
shoot 09-edit      "/pages/question/edit?id={{id}}"  1100
shoot 10-study     "/pages/study/session?mode=review" 900
shoot 12-backup    /pages/profile/backup   1100
shoot 13-settings  /pages/profile/settings 1100

# 这两个页依赖一份草稿，走单独入口注入后再截
seed_shot() {
  local kind="$1" out="$2" h="$3"
  local win
  win=$(cygpath -w "$ROOT/preview/screens/$out" 2>/dev/null || echo "$ROOT/preview/screens/$out")
  "$CHROME" --headless=new --disable-gpu --no-sandbox --hide-scrollbars \
    --force-device-scale-factor=2 --virtual-time-budget=20000 \
    --window-size=390,"$h" --screenshot="$win" \
    "http://127.0.0.1:$PORT/_seed.html?kind=$kind&h=$h" 2>&1 | grep -v "^\[" | tail -1
}

seed_shot ocr   08-ocr-result.png 1250
seed_shot batch 11-batch-save.png 1300

echo "完成：preview/screens/"
