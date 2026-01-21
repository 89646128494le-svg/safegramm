@echo off
chcp 65001 >nul
title SafeGram Connection Checker
color 0B

echo ====================================
echo   SafeGram Connection Checker
echo ====================================
echo.

REM Проверка что backend запущен локально
echo [1/3] Checking local backend...
curl -s http://localhost:8080/health >nul 2>&1
if errorlevel 1 (
    echo ❌ Backend not running on localhost:8080
    echo    Please run START_LOCAL_SERVER.bat first
    echo.
) else (
    echo ✅ Backend is running locally
    echo.
)

REM Проверка PostgreSQL
echo [2/3] Checking PostgreSQL...
docker ps | findstr "safegram-postgres" >nul 2>&1
if errorlevel 1 (
    echo ⚠ PostgreSQL container not running
    echo.
) else (
    echo ✅ PostgreSQL is running
    echo.
)

REM Проверка webhook receiver
echo [3/3] Checking webhook receiver...
curl -s http://localhost:3000/status >nul 2>&1
if errorlevel 1 (
    echo ⚠ Webhook receiver not running (optional)
    echo   To enable: cd webhook-receiver ^&^& npm start
    echo.
) else (
    echo ✅ Webhook receiver is running
    echo.
)

echo ====================================
echo   Quick Check Complete
echo ====================================
echo.
echo To check connection:
echo 1. Open your Vercel site
echo 2. Press F12
echo 3. Check Console for errors
echo 4. Check Network tab for API calls
echo.
echo Backend Health: http://localhost:8080/health
echo.
pause
