@echo off
chcp 65001 >nul
title SafeGram - Restart Backend
color 0A

echo ====================================
echo   SafeGram - Restart Backend
echo ====================================
echo.

cd /d "%~dp0\server-go"

echo [1/3] Stopping old backend (if running)...
taskkill /F /IM main.exe 2>nul
timeout /t 2 >nul

echo [2/3] Building backend...
go build -o main.exe .
if errorlevel 1 (
    echo.
    echo ERROR: Build failed!
    pause
    exit /b 1
)
echo ✓ Build successful

echo.
echo [3/3] Starting backend...
echo.
echo ====================================
echo   Backend running on port 8080
echo ====================================
echo.
echo Next: Start LocalTunnel in another terminal:
echo   npx localtunnel --port 8080
echo.
echo Press Ctrl+C to stop
echo.

start cmd /k "main.exe"

timeout /t 3 >nul
echo.
echo Backend started in new window!
echo.
pause
