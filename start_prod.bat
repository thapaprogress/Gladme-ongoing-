@echo off
title GladME Studio V5 - Production
echo ========================================
echo   GladME Studio V5 - Production Mode
echo ========================================
echo.

if not exist "frontend\dist" (
  echo [BUILD] Building frontend...
  cd frontend
  call npm ci
  call npm run build
  cd ..
)

if not exist "backend\.env" (
  echo [SETUP] Creating .env from template...
  copy "backend\.env.example" "backend\.env" >nul
  echo [!] Edit backend\.env - set JWT_SECRET before deploying!
  notepad "backend\.env"
  pause
  exit /b 1
)

if not exist "backend\venv\Scripts\python.exe" (
  echo [SETUP] Creating venv + deps...
  python -m venv backend\venv
  backend\venv\Scripts\pip install -r backend\requirements.txt --quiet
)

set FRONTEND_DIST=%CD%\frontend\dist

echo [START] uvicorn 4 workers on 0.0.0.0:8000
echo   Open: http://localhost:8000

backend\venv\Scripts\activate && uvicorn main:app --host 0.0.0.0 --port 8000 --workers 1 --proxy-headers