#!/usr/bin/env bash
# 一次跑完所有页面的真实渲染截图：起个临时静态服务 → 逐屏截 2 倍图 → 拼两张合集 → 关掉服务。
# 前提：已经 npm run build:h5（没构建过会先构建一次）。
# 产物：
#   preview/screens/01-13.png   单屏 2 倍图（01-08 = 设计稿里的 8 屏，09-13 = 设计稿没画的二级页）
#   preview/ui-8-screens.png    README 顶部合集：01-08，两行四列
#   preview/ui-extra-pages.png  README 顶部合集：09-13，一行五列
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIST="$ROOT/dist/build/h5"

# 端口不能写死。上一轮脚本非正常退出时留下的 http.server 会一直占着 4567：
# 新 server 静默 bind 失败，Chrome 却连上了那个老 server，拼图页 404 → 截出 22KB 空白图（真踩过）。
# 让内核分配一个空闲端口，从根上断掉这类问题。
PORT=$(python - <<'PY'
import socket
s = socket.socket()
s.bind(("127.0.0.1", 0))
print(s.getsockname()[1])
s.close()
PY
)

if [ ! -f "$DIST/index.html" ]; then
  echo "dist 不存在，先构建 h5 …"
  ( cd "$ROOT" && npx uni build -p h5 >/dev/null 2>&1 )
fi

# 截图用的探针页要跟产物同源，否则读不到 localStorage
cp "$ROOT/preview/live_shot.html" "$DIST/_shot.html"
cp "$ROOT/preview/_seed.html" "$DIST/_seed.html"
cp "$ROOT/preview/_measure.html" "$DIST/_measure.html"

# exec 是必须的：让子 shell 被 python 直接顶掉，$! 拿到的才是 python 的 pid。
# 少了 exec，$! 是那层 bash，kill 掉它之后 python 变成孤儿进程继续占着端口（实测漏过，见上面的注释）。
( cd "$DIST" && exec python -m http.server "$PORT" --bind 127.0.0.1 >/dev/null 2>&1 ) &
SERVER=$!
trap 'kill $SERVER 2>/dev/null || true' EXIT

# 等服务起来
for _ in $(seq 1 40); do
  if curl -fs "http://127.0.0.1:$PORT/index.html" >/dev/null 2>&1; then break; fi
  sleep 0.25
done

CHROME="${CHROME_BIN:-/c/Program Files/Google/Chrome/Application/chrome.exe}"

# shoot.sh 是子进程，端口得 export 出去它才看得见
export PORT

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

# ---------- 拼两张合集图（README 顶部用） ----------
# 为什么不用 Pillow / imagemagick：本机 pip 装不上 pillow，imagemagick 也不一定在；
# 而 Chrome 本来就是这脚本的依赖 —— 用「HTML 网格 + 整页截图」拼，零新增依赖。
# 规则：每行固定高度、每张按原图宽高比算宽度。截图高矮不一（07/08/11 特别长），
# 直接按宽度缩会参差不齐，固定高度才对齐。
#
# 拼图页必须和图片同源：临时目录放在已 serve 的 $DIST 下，HTML 里用相对路径引 shots/，
# 否则 Chrome 加载图片会 404 —— 这个坑踩过：截出来只有 22KB 的空白图。
COMPOSE_DIR="$DIST/_compose"
rm -rf "$COMPOSE_DIR"
mkdir -p "$COMPOSE_DIR/shots"
cp "$ROOT"/preview/screens/*.png "$COMPOSE_DIR/shots/"

# 从 PNG 头里读宽高（IHDR 紧跟在 8 字节签名 + 4 字节长度 + 4 字节类型之后，即偏移 16）。
# 不引外部命令之外的依赖：od 在 Git Bash 与 CI 的 ubuntu 上都有。
png_size() {
  local b
  b=($(od -An -tu1 -j16 -N8 "$1"))
  echo $(( (b[0] << 24) | (b[1] << 16) | (b[2] << 8) | b[3] )) \
       $(( (b[4] << 24) | (b[5] << 16) | (b[6] << 8) | b[7] ))
}

# compose <输出文件名> <行高> <每行列数> <截图文件名…>
compose() {
  local out="$1" cellh="$2" cols="$3"
  shift 3
  local names=("$@")
  local html="$COMPOSE_DIR/$out.html"
  local gap=20 pad=20
  local rows=$(( (${#names[@]} + cols - 1) / cols ))
  local i row=0 maxw=0 roww=0

  : > "$html"
  printf '<!doctype html><meta charset="utf-8"><body style="margin:0;background:#eef0f6">' >> "$html"

  for ((i = 0; i < ${#names[@]}; i++)); do
    if (( i % cols == 0 )); then
      # 注意别写成 `(( row > 0 )) && printf …`：行首为真时 `(( 0 ))` 返回 1，
      # 在 set -e 下会把整个脚本带退出。
      if (( row > 0 )); then
        printf '<div style="height:%dpx"></div>' "$gap" >> "$html"
      fi
      printf '<div style="display:flex;gap:%dpx;padding:0 %dpx;align-items:flex-start">' "$gap" "$pad" >> "$html"
      roww=$(( pad * 2 + gap * (cols - 1) ))
    fi
    read -r sw sh <<< "$(png_size "$COMPOSE_DIR/shots/${names[$i]}")"
    local w=$(( (cellh * sw + sh / 2) / sh ))
    roww=$(( roww + w ))
    printf '<img src="shots/%s" style="width:%dpx;height:%dpx;display:block;border-radius:8px;box-shadow:0 2px 10px rgba(30,30,60,.12)">' \
      "${names[$i]}" "$w" "$cellh" >> "$html"
    if (( (i + 1) % cols == 0 || i == ${#names[@]} - 1 )); then
      printf '</div>' >> "$html"
      if (( roww > maxw )); then maxw=$roww; fi
      row=$(( row + 1 ))
    fi
  done
  printf '</body>' >> "$html"

  local H=$(( pad * 2 + cellh * rows + gap * (rows - 1) ))
  local win
  win=$(cygpath -w "$ROOT/preview/$out" 2>/dev/null || echo "$ROOT/preview/$out")
  echo "  拼 $out：${maxw}x${H}"
  "$CHROME" --headless=new --disable-gpu --no-sandbox --hide-scrollbars \
    --force-device-scale-factor=1 --virtual-time-budget=20000 \
    --window-size="$maxw","$H" --screenshot="$win" \
    "http://127.0.0.1:$PORT/_compose/$out.html" 2>&1 | grep -v "^\[" | tail -1
}

compose ui-8-screens.png 850 4 \
  01-home.png 02-capture.png 03-library.png 04-review.png \
  05-plan.png 06-profile.png 07-detail.png 08-ocr-result.png

compose ui-extra-pages.png 830 5 \
  09-edit.png 10-study.png 11-batch-save.png 12-backup.png 13-settings.png

rm -rf "$COMPOSE_DIR"

echo "完成：preview/screens/ + ui-8-screens.png + ui-extra-pages.png"
