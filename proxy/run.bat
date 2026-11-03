@echo off
REM Start the AI proxy on http://127.0.0.1:8000  (console output is English on purpose:
REM Chinese text inside a .bat gets mangled by the console codepage on Windows.)
setlocal
cd /d "%~dp0"

if not exist ".env" if "%MOCK%"=="" (
  echo [!] No .env found. Copy .env.example to .env and fill LLM_API_KEY,
  echo     or run "set MOCK=1" first to preview the UI without a real model.
  echo.
)

if exist "..\.venv\Scripts\python.exe" (
  set "PY=..\.venv\Scripts\python.exe"
) else (
  set "PY=python"
)

%PY% -c "import fastapi, uvicorn, httpx, dotenv" 2>nul
if errorlevel 1 (
  echo [!] Missing dependencies. Run: %PY% -m pip install -r requirements.txt
  exit /b 1
)

echo Starting AI proxy ... set the client endpoint to http://127.0.0.1:8000
%PY% -m uvicorn app:app --host 127.0.0.1 --port 8000 --reload
