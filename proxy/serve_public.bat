@echo off
REM Expose the local H5 + AI proxy as a public HTTPS URL (for phone testing).
REM Console output is English on purpose: Chinese text in .bat gets mangled by the console codepage.
REM
REM Why: the app and the proxy are served from the SAME origin, so one URL is both
REM the page address and the "server endpoint" you paste into Settings.
REM cloudflared issues a real certificate -> no "certificate warning" on the phone.
REM
REM Prereq: cloudflared on PATH.
REM   https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe
REM   (rename to cloudflared.exe and drop it anywhere in PATH)
setlocal
cd /d "%~dp0\.."

if exist ".venv\Scripts\python.exe" (
  set "PY=.venv\Scripts\python.exe"
) else (
  set "PY=python"
)

where cloudflared >nul 2>nul
if errorlevel 1 (
  echo [!] cloudflared not found on PATH.
  echo     Download: https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe
  echo     Rename to cloudflared.exe and put it in any PATH directory.
  exit /b 1
)

REM The proxy only allows localhost/private networks by default; the tunnel domain is public,
REM so it has to be allowed explicitly. "*" is a deliberate trade-off for local verification
REM (PROXY_TOKEN still protects the endpoint if you set one) - do NOT do this in production.
set ALLOWED_ORIGINS=*

echo Starting backend on http://127.0.0.1:8000 (H5 + proxy, same origin) ...
start "interview-box backend" cmd /c "%PY% proxy\serve_local.py --port 8000 --no-ssl"
timeout /t 4 /nobreak >nul

echo Opening tunnel. The https://*.trycloudflare.com URL printed below is BOTH
echo the page address and the endpoint for Settings ^> AI answer assistant.
echo.
cloudflared tunnel --url http://127.0.0.1:8000
