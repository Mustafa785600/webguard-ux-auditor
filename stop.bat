@echo off
title WebGuard - Durduruluyor...
echo.
echo  ============================================
echo   WebGuard Servisleri Durduruluyor...
echo  ============================================
echo.

REM Windows Terminal pencerelerini ve process'leri sonlandir
taskkill /F /FI "WINDOWTITLE eq WebGuard-Backend*" >nul 2>&1
taskkill /F /FI "WINDOWTITLE eq WebGuard-Frontend*" >nul 2>&1
taskkill /F /IM uvicorn.exe >nul 2>&1
taskkill /F /IM node.exe /FI "WINDOWTITLE eq WebGuard*" >nul 2>&1

echo.
echo  Tum WebGuard servisleri (Backend & Frontend) durduruldu.
echo.
ping 127.0.0.1 -n 3 >nul
exit
