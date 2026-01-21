@echo off
chcp 65001 >nul
title SafeGram Logs Viewer
color 0E

echo ====================================
echo   SafeGram Logs Viewer
echo ====================================
echo.

REM Проверка webhook receiver логов
if exist "webhook-receiver\logs" (
    echo 📁 Webhook Receiver Logs:
    echo.
    dir /b "webhook-receiver\logs\safegram-*.log" 2>nul
    echo.
    echo To view today's logs:
    echo type "webhook-receiver\logs\safegram-%date:~-4,4%-%date:~-10,2%-%date:~-7,2%.log"
    echo.
) else (
    echo ⚠ No webhook logs directory found
    echo   Run webhook receiver first: cd webhook-receiver ^&^& npm start
    echo.
)

echo ====================================
echo   Log Locations
echo ====================================
echo.
echo 1. Backend Console Logs:
echo    - Check the window where START_LOCAL_SERVER.bat is running
echo.
echo 2. Webhook Receiver Logs:
echo    - Folder: webhook-receiver\logs\
echo    - File: safegram-YYYY-MM-DD.log
echo.
echo 3. Frontend Logs:
echo    - Open your Vercel site
echo    - Press F12 → Console
echo.
echo 4. Backend Logs (if running as service):
echo    - Check Task Manager → Services
echo    - Or check Windows Event Viewer
echo.
pause
