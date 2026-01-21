@echo off
chcp 65001 >nul
title SafeGram Cloudflare Tunnel Setup
color 0E

echo ====================================
echo   SafeGram Cloudflare Tunnel Setup
echo ====================================
echo.

REM Проверка наличия cloudflared
set CLOUDFLARED_PATH=C:\cloudflared\cloudflared.exe

if not exist "%CLOUDFLARED_PATH%" (
    echo ERROR: cloudflared not found at %CLOUDFLARED_PATH%
    echo.
    echo Please download cloudflared from:
    echo https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/
    echo.
    echo Extract it to C:\cloudflared\
    echo.
    pause
    exit /b 1
)

echo [1/4] Checking Cloudflare authentication...

REM Проверка авторизации
%CLOUDFLARED_PATH% tunnel list >nul 2>&1
if errorlevel 1 (
    echo.
    echo Cloudflare Tunnel is not authenticated!
    echo.
    echo Please:
    echo 1. Sign up at https://dash.cloudflare.com (free)
    echo 2. Run: %CLOUDFLARED_PATH% tunnel login
    echo 3. Run: %CLOUDFLARED_PATH% tunnel create safegram
    echo.
    pause
    exit /b 1
)

echo ✓ Cloudflare authenticated

echo.
echo [2/4] Checking for 'safegram' tunnel...

REM Проверка существования туннеля
%CLOUDFLARED_PATH% tunnel list | findstr "safegram" >nul
if errorlevel 1 (
    echo ⚠ Tunnel 'safegram' not found. Creating...
    %CLOUDFLARED_PATH% tunnel create safegram
    echo.
    echo ✓ Tunnel created!
    echo.
    echo IMPORTANT: You need to configure the tunnel route in Cloudflare dashboard
    echo Or use quick tunnel mode:
    goto :quick
) else (
    echo ✓ Tunnel 'safegram' found
)

echo.
echo [3/4] Starting Cloudflare Tunnel...
echo.
echo ====================================
echo   Cloudflare Tunnel starting...
echo   Your permanent URL will appear below
echo ====================================
echo.
echo Press Ctrl+C to stop
echo.

REM Запуск туннеля
%CLOUDFLARED_PATH% tunnel run safegram
goto :end

:quick
echo.
echo [Quick Mode] Starting quick tunnel (no setup required)...
echo.
echo ====================================
echo   Cloudflare Quick Tunnel starting...
echo   Temporary URL will appear below
echo ====================================
echo.
echo Press Ctrl+C to stop
echo.

%CLOUDFLARED_PATH% tunnel --url http://localhost:8080

:end
pause
