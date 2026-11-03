#!/usr/bin/env bash
# 把本机的 H5 + AI 代理暴露成一个公网 https 地址（给真机验证用）。
#
# 关键是同源：页面和接口来自同一个 URL，所以那一个地址既是「页面地址」，
# 也是设置里要填的「服务端地址」。cloudflared 给的是合法证书，
# 手机上不会出现证书警告（比自签省一次手动信任）。
#
# 前置：PATH 里有 cloudflared
#   https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe
#   下载后改名 cloudflared（chmod +x），丢进任意 PATH 目录
set -e
cd "$(dirname "$0")/.."

PY="python"
for c in ".venv/Scripts/python.exe" ".venv/bin/python" \
         "$HOME/.workbuddy/binaries/python/envs/default/Scripts/python.exe"; do
  if [ -x "$c" ]; then PY="$c"; break; fi
done

command -v cloudflared >/dev/null 2>&1 || {
  echo "[!] PATH 里没有 cloudflared"
  echo "    下载：https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe"
  exit 1
}

echo "启动本机后端 http://127.0.0.1:8000（H5 + 代理，同源）…"
MOCK="${MOCK:-}" "$PY" proxy/serve_local.py --port 8000 --no-ssl &
BACKEND=$!
trap 'kill $BACKEND 2>/dev/null || true' EXIT
sleep 4

echo
echo "下面打印出的 https://*.trycloudflare.com 既是页面地址，也是「服务端地址」。"
echo
cloudflared tunnel --url http://127.0.0.1:8000
