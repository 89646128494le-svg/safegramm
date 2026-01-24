@echo off
chcp 65001 >nul
title SafeGram Backend + LocalTunnel
color 0A

echo ====================================
echo   SafeGram Backend + LocalTunnel
echo   All-in-One Server Launcher
echo ====================================
echo.

REM Проверка наличия Node.js
where node >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js not found!
    echo.
    echo Please install Node.js from:
    echo https://nodejs.org/
    echo.
    pause
    exit /b 1
)

REM Проверка наличия localtunnel
echo Checking localtunnel installation...
where lt >nul 2>&1
if errorlevel 1 (
    echo localtunnel not found. Installing...
    echo.
    npm install -g localtunnel
    if errorlevel 1 (
        echo ERROR: Failed to install localtunnel
        echo.
        echo Try running as Administrator or install manually:
        echo npm install -g localtunnel
        echo.
        pause
        exit /b 1
    )
)

echo.
echo [1/4] Starting PostgreSQL...
docker start safegram-postgres 2>nul || docker run -d --name safegram-postgres -e POSTGRES_USER=safegram -e POSTGRES_PASSWORD=safegram123 -e POSTGRES_DB=safegram -p 5432:5432 postgres:15-alpine
timeout /t 2 /nobreak >nul
echo ✓ PostgreSQL started

echo.
echo [2/4] Starting Redis...
docker start safegram-redis 2>nul || docker run -d --name safegram-redis -p 6379:6379 redis:7-alpine
timeout /t 1 /nobreak >nul
echo ✓ Redis started

echo.
echo [3/4] Building and starting Go backend...
cd /d "%~dp0server-go"

REM Проверка наличия .env файла
if not exist ".env" (
    echo Creating .env file from example...
    if exist ".env.example" (
        copy ".env.example" ".env" >nul
    ) else (
        echo DATABASE_URL=postgres://safegram:safegram123@localhost:5432/safegram?sslmode=disable> .env
        echo JWT_SECRET=your-super-secret-jwt-key-change-in-production>> .env
        echo PORT=8080>> .env
        echo REDIS_URL=redis://localhost:6379>> .env
        echo ALLOWED_ORIGINS=http://localhost:5173,http://localhost:8080>> .env
        echo GMAIL_USER=safegram.noreply@gmail.com>> .env
        echo GMAIL_APP_PASSWORD=>> .env
    )
    echo ✓ .env file created
)

REM Сборка Go приложения
echo Building backend...
go build -o safegram-server.exe . 2>nul
if errorlevel 1 (
    echo ERROR: Failed to build Go backend
    echo Make sure Go is installed and GOPATH is set
    pause
    exit /b 1
)
echo ✓ Backend built successfully

echo.
echo [4/4] Starting backend and LocalTunnel...
echo.
echo ====================================
echo   Starting services...
echo ====================================
echo.

REM Запускаем бэкенд в фоне
start "SafeGram Backend" cmd /c "cd /d "%~dp0server-go" && safegram-server.exe"

REM Ждём пока бэкенд запустится
echo Waiting for backend to start...
timeout /t 3 /nobreak >nul

REM Проверяем что бэкенд работает
curl -s http://localhost:8080/health >nul 2>&1
if errorlevel 1 (
    echo Waiting more for backend...
    timeout /t 3 /nobreak >nul
)

echo.
echo ====================================
echo   Backend is running on port 8080
echo   Starting LocalTunnel...
echo ====================================
echo.
echo Your public URL will appear below.
echo Copy it and update VITE_API_URL in Vercel:
echo.
echo   VITE_API_URL = https://YOUR-URL.loca.lt
echo   VITE_WS_URL  = wss://YOUR-URL.loca.lt
echo.
echo Then Redeploy on Vercel!
echo.
echo Press Ctrl+C to stop all services
echo ====================================
echo.

REM Запуск localtunnel
lt --port 8080

REM Когда localtunnel остановлен, останавливаем бэкенд
echo.
echo Stopping backend...
taskkill /FI "WINDOWTITLE eq SafeGram Backend*" /F >nul 2>&1

echo.
echo All services stopped.
pause
