@echo off
chcp 65001 >nul
title SafeGram - Server + Tunnel (Simple)
color 0A

echo ====================================
echo   SafeGram - Server + Tunnel
echo   (Simple Version - No Docker)
echo ====================================
echo.

REM Переход в директорию проекта
cd /d "%~dp0"

REM Проверка наличия backend директории
if not exist "server-go" (
    echo ERROR: server-go directory not found!
    pause
    exit /b 1
)

REM ====================================
REM Сборка backend
REM ====================================
echo [1/2] Building backend...
cd server-go
go build -o main.exe .
if errorlevel 1 (
    echo ERROR: Failed to build backend!
    pause
    exit /b 1
)
echo ✓ Backend built successfully
cd ..

echo.

REM ====================================
REM Запуск туннеля
REM ====================================
echo [2/2] Starting tunnel...

REM Проверяем localtunnel (предпочтительный вариант)
where lt >nul 2>&1
if not errorlevel 1 (
    echo Starting localtunnel...
    start "SafeGram Tunnel" cmd /k "chcp 65001 >nul && title SafeGram Tunnel && color 0E && echo SafeGram Tunnel (localtunnel) && echo. && echo Public URL will appear below. && echo Copy it and update VITE_API_URL in Vercel. && echo. && lt --port 8080 && pause"
    timeout /t 2 >nul
    goto :start_server
)

REM Проверяем Cloudflare
if exist "C:\cloudflared\cloudflared.exe" (
    echo Starting Cloudflare Tunnel...
    start "SafeGram Tunnel" cmd /k "chcp 65001 >nul && title SafeGram Tunnel && color 0E && echo SafeGram Tunnel (Cloudflare) && echo. && echo Public URL will appear below. && echo Copy it and update VITE_API_URL in Vercel. && echo. && C:\cloudflared\cloudflared.exe tunnel --url http://127.0.0.1:8080 && pause"
    timeout /t 2 >nul
    goto :start_server
)

REM Проверяем ngrok
if exist "C:\ngrok\ngrok.exe" (
    echo Starting ngrok...
    start "SafeGram Tunnel" cmd /k "chcp 65001 >nul && title SafeGram Tunnel && color 0B && echo SafeGram Tunnel (ngrok) && echo. && echo Public URL will appear below. && echo Copy it and update VITE_API_URL in Vercel. && echo. && C:\ngrok\ngrok.exe http 8080 && pause"
    timeout /t 2 >nul
    goto :start_server
)

REM Если ничего не найдено
echo ⚠ No tunnel found. Backend will run without tunnel.
echo You can access it locally at http://localhost:8080
echo.
echo To add tunnel, install one of:
echo   - localtunnel: npm install -g localtunnel
echo   - Cloudflare: Download from https://github.com/cloudflare/cloudflared/releases
echo   - ngrok: Download from https://ngrok.com/download

:start_server
echo.
echo ====================================
echo   Starting SafeGram Backend
echo ====================================
echo.
echo Backend: http://localhost:8080
echo.
echo Press Ctrl+C to stop
echo.
echo ====================================
echo.

cd server-go
main.exe

pause
