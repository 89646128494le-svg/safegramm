@echo off
chcp 65001 >nul
title SafeGram LocalTunnel
color 0C

echo ====================================
echo   SafeGram LocalTunnel
echo   (Alternative to Cloudflare)
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

echo Checking localtunnel installation...

REM Проверка наличия localtunnel
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
echo Backend should be running on http://localhost:8080
echo.
echo Starting LocalTunnel...
echo.
echo Your public URL will appear below.
echo Copy it and update VITE_API_URL in Vercel.
echo.
echo NOTE: URL will change each time you restart
echo.
echo Press Ctrl+C to stop
echo.
echo ====================================
echo.

REM Запуск localtunnel
lt --port 8080

pause
