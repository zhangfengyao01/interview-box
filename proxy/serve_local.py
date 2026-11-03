#!/usr/bin/env python
"""本地真机验证用：把 H5 产物和 AI 代理挂到**同一个 https 源**下。

为什么必须同源：手机浏览器访问自签 https 站点时，只在「打开页面」这一步给一次
「继续访问」的信任机会；而 XHR/fetch 打到**另一个**自签源时会被直接拦掉
（ERR_CERT_AUTHORITY_INVALID），没有手动继续的入口 —— 所以代理和页面必须同源。

同源之后，手机上的验证流程就变成：
  1. 连同一个 WiFi，浏览器打开 https://<局域网IP>:8443/
  2. 证书警告 → 点「继续访问」（一次）
  3. 应用里：设置 → AI 答案助手 → 服务端地址填 https://<局域网IP>:8443
  4. 生成答案 → 这一步是手机经过真实网络打到本机代理，再转发到模型厂商

只用于本地验证，不要拿它上生产（自签证书、无鉴权、无限制）。

用法：
    python proxy/serve_local.py           # 默认 8443
    python proxy/serve_local.py --port 9000
"""

from __future__ import annotations

import argparse
import datetime
import ipaddress
import socket
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / "dist" / "build" / "h5"
CERT_DIR = ROOT / "proxy" / "_local"
CERT = CERT_DIR / "cert.pem"
KEY = CERT_DIR / "key.pem"

# 直接 `python proxy/serve_local.py` 时 sys.path[0] 是 proxy/ 目录，
# 那样 `import proxy.app` 会找不到包（uvicorn 代理调用 `proxy.serve_local:app` 时则没问题）。
# 补上项目根，两种跑法都能 import。
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

# 证书目录不放进版本库（.gitignore 里已加 proxy/_local/）


def lan_ip() -> str:
    """拿本机在局域网里的地址：连一个外网 UDP Socket 看本地出口用哪个网卡。
    不发包，只是让内核选路由，所以不会真的联网。"""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("223.5.5.5", 80))
        return s.getsockname()[0]
    except OSError:
        return "127.0.0.1"
    finally:
        s.close()


def ensure_cert() -> None:
    """没有证书就现场签一张，SAN 里带上局域网 IP 和 localhost。

    SAN 是必须的：现代浏览器只看 subjectAltName，不看 CN ——
    少了 IP 条目，即便点了「继续访问」，XHR 仍会因为主机名不匹配被拒。
    """
    if CERT.exists() and KEY.exists():
        return

    from cryptography import x509
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import ec
    from cryptography.x509.oid import NameOID

    CERT_DIR.mkdir(parents=True, exist_ok=True)
    ip = lan_ip()

    key = ec.generate_private_key(ec.SECP256R1())
    name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "interview-box-local")])
    san = [
        x509.DNSName("localhost"),
        x509.IPAddress(ipaddress.ip_address(ip)),
        x509.IPAddress(ipaddress.ip_address("127.0.0.1")),
    ]

    cert = (
        x509.CertificateBuilder()
        .subject_name(name)
        .issuer_name(name)
        .public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=1))
        .not_valid_after(datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=30))
        .add_extension(x509.SubjectAlternativeName(san), critical=False)
        .add_extension(x509.BasicConstraints(ca=True, path_length=None), critical=True)
        .sign(key, hashes.SHA256())
    )

    KEY.write_bytes(
        key.private_bytes(
            serialization.Encoding.PEM,
            serialization.PrivateFormat.PKCS8,
            serialization.NoEncryption(),
        )
    )
    CERT.write_bytes(cert.public_bytes(serialization.Encoding.PEM))
    print(f"[cert] 已生成自签证书：{CERT}（SAN 含 {ip} / localhost，有效期 30 天）")


def build_if_missing() -> None:
    if (DIST / "index.html").exists():
        return
    print("[build] dist 里没有 H5 产物，先构建一次 …")
    subprocess.run(["npm", "run", "build:h5"], cwd=str(ROOT), check=True, shell=True)


def main() -> int:
    parser = argparse.ArgumentParser(description="本地真机验证：https 同源托管 H5 + AI 代理")
    parser.add_argument("--port", type=int, default=8443)
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument(
        "--no-ssl",
        action="store_true",
        help="只起 http，交给内网穿透工具去提供 https（穿透出来的域名是合法证书，手机不用手动信任）",
    )
    args = parser.parse_args()

    import uvicorn
    from fastapi.staticfiles import StaticFiles

    from proxy.app import app  # 代理本体，路由已在里面注册完

    build_if_missing()

    # 必须放在所有 API 路由注册之后：Starlette 按 routes 顺序匹配，
    # 这个挂载会兜住 / 下面的一切，但前面注册过的 /api/... 与 /healthz 优先命中。
    app.mount("/", StaticFiles(directory=str(DIST), html=True), name="h5")

    if args.no_ssl:
        print(f"\n  穿透模式：本机只起 http://127.0.0.1:{args.port}")
        print("  再跑：cloudflared tunnel --url http://127.0.0.1:<port>")
        print("  拿到的 https 域名既是页面地址、也是「服务端地址」——同源，证书是合法的\n")
        uvicorn.run(app, host=args.host, port=args.port, log_level="info")
        return 0

    ensure_cert()
    ip = lan_ip()

    base = f"https://{ip}:{args.port}"
    print(f"\n  手机（连同一 WiFi）打开：{base}/")
    print(f"  应用里「服务端地址」填：{base}")
    print("  证书警告选「继续访问」即可（同源，一次信任通吃页面与接口）\n")

    uvicorn.run(
        app,
        host=args.host,
        port=args.port,
        ssl_certfile=str(CERT),
        ssl_keyfile=str(KEY),
        log_level="info",
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
