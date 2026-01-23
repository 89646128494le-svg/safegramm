@echo off
chcp 65001 >nul
title SafeGram - Server + Tunnel
color 0B

echo ====================================
echo   SafeGram - Server + Tunnel
echo ====================================
echo.

REM Переход в директорию проекта
cd /d "%~dp0"

if not exist "server-go" (
    echo ERROR: server-go directory not found!
    pause
    exit /b 1
)

REM ====================================
REM Сборка backend
REM ====================================
echo [1/3] Building backend...
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
REM Проверка доступных туннелей
REM ====================================
set HAS_LOCALTUNNEL=0
set HAS_CLOUDFLARE=0
set HAS_NGROK=0

where lt >nul 2>&1
if not errorlevel 1 set HAS_LOCALTUNNEL=1

if exist "C:\cloudflared\cloudflared.exe" set HAS_CLOUDFLARE=1

if exist "C:\ngrok\ngrok.exe" set HAS_NGROK=1

REM Если ничего не найдено
if %HAS_LOCALTUNNEL%==0 if %HAS_CLOUDFLARE%==0 if %HAS_NGROK%==0 (
    echo ⚠ No tunnel found!
    echo.
    echo Available options:
    echo   1. Install localtunnel: npm install -g localtunnel
    echo   2. Download Cloudflare: https://github.com/cloudflare/cloudflared/releases
    echo   3. Download ngrok: https://ngrok.com/download
    echo.
    echo Starting backend without tunnel...
    goto :start_server
)

REM ====================================
REM Выбор туннеля
REM ====================================
echo [2/3] Select tunnel:
echo.
if %HAS_LOCALTUNNEL%==1 echo   1. LocalTunnel (recommended - no setup needed)
if %HAS_CLOUDFLARE%==1 echo   2. Cloudflare Tunnel (free, stable)
if %HAS_NGROK%==1 echo   3. ngrok (may require auth)
echo   4. No tunnel (local only)
echo.
set /p TUNNEL_CHOICE="Enter choice (1-4): "

if "%TUNNEL_CHOICE%"=="1" if %HAS_LOCALTUNNEL%==1 (
    set TUNNEL_CMD=lt --port 8080
    set TUNNEL_NAME=LocalTunnel
    goto :start_tunnel
)

if "%TUNNEL_CHOICE%"=="2" if %HAS_CLOUDFLARE%==1 (
    set TUNNEL_CMD=C:\cloudflared\cloudflared.exe tunnel --url http://127.0.0.1:8080
    set TUNNEL_NAME=Cloudflare
    goto :start_tunnel
)

if "%TUNNEL_CHOICE%"=="3" if %HAS_NGROK%==1 (
    set TUNNEL_CMD=C:\ngrok\ngrok.exe http 8080
    set TUNNEL_NAME=ngrok
    goto :start_tunnel
)

if "%TUNNEL_CHOICE%"=="4" (
    set TUNNEL_NAME=None
    goto :start_server
)

REM Если выбор неверный, используем первый доступный
echo Invalid choice. Using first available tunnel...
if %HAS_LOCALTUNNEL%==1 (
    set TUNNEL_CMD=lt --port 8080
    set TUNNEL_NAME=LocalTunnel
    goto :start_tunnel
)
if %HAS_CLOUDFLARE%==1 (
    set TUNNEL_CMD=C:\cloudflared\cloudflared.exe tunnel --url http://127.0.0.1:8080
    set TUNNEL_NAME=Cloudflare
    goto :start_tunnel
)
if %HAS_NGROK%==1 (
    set TUNNEL_CMD=C:\ngrok\ngrok.exe http 8080
    set TUNNEL_NAME=ngrok
    goto :start_tunnel
)

:start_tunnel
echo.
echo [3/3] Starting %TUNNEL_NAME% tunnel...
start "SafeGram Tunnel (%TUNNEL_NAME%)" cmd /k "chcp 65001 >nul && title SafeGram Tunnel && color 0E && echo ==================================== && echo   SafeGram Tunnel (%TUNNEL_NAME%) && echo ==================================== && echo. && echo Backend: http://localhost:8080 && echo. && echo Public URL will appear below. && echo Copy it and update VITE_API_URL in Vercel. && echo. && echo Press Ctrl+C to stop && echo. && echo ==================================== && echo. && %TUNNEL_CMD% && pause"
timeout /t 2 >nul

:start_server
REM ====================================
REM Запуск Docker (опционально)
REM ====================================
echo.
echo Starting Docker containers (if needed)...
docker start safegram-postgres 2>nul
docker start safegram-redis 2>nul
timeout /t 2 >nul

echo.
echo ====================================
echo   Starting SafeGram Backend
echo ====================================
echo.
echo Backend: http://localhost:8080
if not "%TUNNEL_NAME%"=="None" (
    echo Tunnel: %TUNNEL_NAME% (running in separate window)
) else (
    echo Tunnel: Not started
)
echo.
echo Press Ctrl+C to stop backend
echo.
echo ====================================
echo.

cd server-go
main.exe

echo.
echo Backend stopped.
pause
