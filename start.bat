@echo off
title GladME Studio V5

echo ========================================
echo   GladME Studio V5 - Unified IDE
echo ========================================
echo.

:: Check for .env
if not exist "backend\.env" (
  echo [SETUP] Creating .env from template...
  copy "backend\.env.example" "backend\.env" >nul
  echo [!] Please edit backend\.env and set your JWT_SECRET before continuing.
  echo     Opening .env now...
  notepad "backend\.env"
  pause
)

:: Check for Python venv
if not exist "backend\venv\Scripts\python.exe" (
  echo [SETUP] Creating Python virtual environment...
  python -m venv backend\venv
  echo [SETUP] Installing backend dependencies...
  backend\venv\Scripts\pip install -r backend\requirements.txt --quiet
)

:: Check for node_modules
if not exist "frontend\node_modules" (
  echo [SETUP] Installing frontend dependencies...
  cd frontend
  npm install --silent
  cd ..
)

echo.
echo [1/2] Starting backend on http://localhost:8000 ...
start "GladME Backend" cmd /k "cd backend && venv\Scripts\activate && python main.py"

timeout /t 2 /nobreak >nul

echo [2/2] Starting frontend on http://localhost:5173 ...
start "GladME Frontend" cmd /k "cd frontend && npm run dev"

timeout /t 3 /nobreak >nul

echo.
echo ========================================
echo   GladME Studio V5 is running!
echo   Open: http://localhost:5173
echo ========================================
echo.
start "" "http://localhost:5173"
pause
