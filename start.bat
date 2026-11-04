@echo off
title WebGuard - Baslatiliyor...
echo.
echo  ============================================
echo   WebGuard UX Auditor - Hizmetler Baslatiliyor
echo  ============================================
echo.

set "ROOT=%~dp0"
set "ROOT=%ROOT:~0,-1%"

REM --- 1. Backend Baslat ---
echo [1/2] Backend baslatiliyor (localhost:8000)...
start "WebGuard-Backend" cmd /k "cd /d "%ROOT%\backend" && call .venv\Scripts\activate.bat && uvicorn app.main:app --reload --port 8000"

REM 3 saniye bekle
ping 127.0.0.1 -n 4 >nul

REM --- 2. Frontend Baslat ---
echo [2/2] Frontend baslatiliyor (localhost:3000)...
start "WebGuard-Frontend" cmd /k "cd /d "%ROOT%\frontend" && npm run dev"

REM 4 saniye bekle
ping 127.0.0.1 -n 5 >nul

REM --- 3. Tarayiciyi Ac ---
echo [3/3] Tarayici aciliyor: http://localhost:3000
start "" "http://localhost:3000"

echo.
echo  ======================================================
echo   WebGuard basariyla baslatildi!
echo   - Backend:  http://localhost:8000/docs
echo   - Frontend: http://localhost:3000
echo   Durdurmak icin stop.bat dosyasini calistirabilirsiniz.
echo  ======================================================
echo.
exit
