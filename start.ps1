# WebGuard UX Auditor - Tek Tikla Baslatici (PowerShell)
$root = $PSScriptRoot
$backend = Join-Path $root "backend"
$frontend = Join-Path $root "frontend"

Write-Host ""
Write-Host " ============================================" -ForegroundColor Cyan
Write-Host "  WebGuard UX Auditor - Hizmetler Baslatiliyor" -ForegroundColor Cyan
Write-Host " ============================================" -ForegroundColor Cyan
Write-Host ""

# 1. Backend Baslat
Write-Host "[1/2] Backend baslatiliyor (localhost:8000)..." -ForegroundColor Yellow
Start-Process cmd.exe -ArgumentList "/k", "cd /d `"$backend`" && call .venv\Scripts\activate.bat && uvicorn app.main:app --reload --port 8000" -WindowStyle Normal

# 3 saniye bekle
Start-Sleep -Seconds 3

# 2. Frontend Baslat
Write-Host "[2/2] Frontend baslatiliyor (localhost:3000)..." -ForegroundColor Yellow
Start-Process cmd.exe -ArgumentList "/k", "cd /d `"$frontend`" && npm run dev" -WindowStyle Normal

# 4 saniye bekle
Start-Sleep -Seconds 4

# 3. Tarayiciyi Ac
Write-Host "[3/3] Tarayici aciliyor: http://localhost:3000" -ForegroundColor Green
Start-Process "http://localhost:3000"

Write-Host ""
Write-Host " WebGuard hazir! Tarayicinizda http://localhost:3000 acildi." -ForegroundColor Green
Write-Host " Durdurmak icin stop.bat calistirabilirsiniz." -ForegroundColor Gray
Write-Host ""
