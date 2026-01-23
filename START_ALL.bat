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

REM Проверка наличия backend директории
if not exist "server-go" (
    echo ERROR: server-go directory not found!
    echo Please run this script from the project root.
    pause
    exit /b 1
)

REM ====================================
REM Шаг 1: Сборка backend
REM ====================================
echo [1/4] Building backend...
cd server-go
go build -o main.exe .
if errorlevel 1 (
    echo.
    echo ERROR: Failed to build backend!
    echo Please check the errors above and fix them.
    echo.
    pause
    exit /b 1
)
echo ✓ Backend built successfully
cd ..

echo.

REM ====================================
REM Шаг 2: Запуск Docker контейнеров
REM ====================================
echo [2/4] Starting Docker containers...

REM PostgreSQL
docker start safegram-postgres 2>nul
if errorlevel 1 (
    echo ⚠ PostgreSQL container not found. Starting new one...
    docker run -d --name safegram-postgres -e POSTGRES_USER=safegram -e POSTGRES_PASSWORD=safegram -e POSTGRES_DB=safegram -p 5432:5432 -v safegram-data:/var/lib/postgresql/data postgres:16-alpine 2>nul
)
echo ✓ PostgreSQL running

REM Redis
docker start safegram-redis 2>nul
if errorlevel 1 (
    echo ⚠ Redis container not found. Starting new one...
    docker run -d --name safegram-redis -p 6379:6379 -v safegram-redis-data:/data redis:7-alpine 2>nul
)
echo ✓ Redis running

echo.

REM ====================================
REM Шаг 3: Ожидание готовности PostgreSQL
REM ====================================
echo [3/4] Waiting for PostgreSQL to be ready...
timeout /t 3 >nul

echo.

REM ====================================
REM Шаг 4: Запуск туннеля в отдельном окне
REM ====================================
echo [4/4] Starting tunnel...

REM Определяем какой туннель использовать
set TUNNEL_TYPE=localtunnel
set TUNNEL_CMD=

REM Проверяем localtunnel (самый простой)
where lt >nul 2>&1
if not errorlevel 1 (
    set TUNNEL_TYPE=localtunnel
    set TUNNEL_CMD=lt --port 8080
    goto :start_tunnel
)

REM Проверяем Cloudflare Tunnel
if exist "C:\cloudflared\cloudflared.exe" (
    set TUNNEL_TYPE=cloudflare
    set TUNNEL_CMD=C:\cloudflared\cloudflared.exe tunnel --url http://127.0.0.1:8080
    goto :start_tunnel
)

REM Проверяем ngrok
if exist "C:\ngrok\ngrok.exe" (
    set TUNNEL_TYPE=ngrok
    set TUNNEL_CMD=C:\ngrok\ngrok.exe http 8080
    goto :start_tunnel
)

REM Если ничего не найдено, предлагаем установить localtunnel
echo ⚠ No tunnel found. Installing localtunnel...
where node >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js not found!
    echo Please install Node.js from https://nodejs.org/
    echo.
    echo You can also manually start a tunnel:
    echo   - Cloudflare: C:\cloudflared\cloudflared.exe tunnel --url http://127.0.0.1:8080
    echo   - ngrok: C:\ngrok\ngrok.exe http 8080
    echo   - localtunnel: npm install -g localtunnel ^&^& lt --port 8080
    echo.
    set TUNNEL_TYPE=none
    goto :start_server
)

echo Installing localtunnel globally...
call npm install -g localtunnel
if errorlevel 1 (
    echo ⚠ Failed to install localtunnel. Continuing without tunnel...
    echo You can start tunnel manually in another terminal.
    set TUNNEL_TYPE=none
    goto :start_server
)

set TUNNEL_TYPE=localtunnel
set TUNNEL_CMD=lt --port 8080

:start_tunnel
echo.
echo Starting %TUNNEL_TYPE% tunnel in separate window...
echo.
start "SafeGram Tunnel (%TUNNEL_TYPE%)" cmd /k "chcp 65001 >nul && title SafeGram Tunnel && color 0E && echo ==================================== && echo   SafeGram Tunnel (%TUNNEL_TYPE%) && echo ==================================== && echo. && echo Backend URL: http://localhost:8080 && echo. && echo Your public URL will appear below. && echo Copy it and update VITE_API_URL in Vercel. && echo. && echo Press Ctrl+C to stop && echo. && echo ==================================== && echo. && %TUNNEL_CMD% && pause"

REM Небольшая задержка перед запуском сервера
timeout /t 2 >nul

:start_server
echo.
echo ====================================
echo   Starting SafeGram Backend
echo ====================================
echo.
echo Backend URL: http://localhost:8080
if not "%TUNNEL_TYPE%"=="none" (
    echo Tunnel: Running in separate window (%TUNNEL_TYPE%)
) else (
    echo Tunnel: Not started (install localtunnel or use manual tunnel)
)
echo.
echo Press Ctrl+C to stop backend
echo (Tunnel window can be closed separately)
echo.
echo ====================================
echo.

REM Запуск backend в текущем окне
cd server-go
main.exe

REM Если сервер остановился
echo.
echo Backend stopped.
pause
