@echo off
chcp 65001 >nul
title SafeGram Cloudflare Tunnel
color 0E

echo ====================================
echo   SafeGram Cloudflare Tunnel
echo ====================================
echo.

REM Проверка наличия cloudflared
set CLOUDFLARED_PATH=C:\cloudflared\cloudflared.exe

if not exist "%CLOUDFLARED_PATH%" (
    echo ERROR: cloudflared not found at %CLOUDFLARED_PATH%
    echo.
    echo Please download from:
    echo https://github.com/cloudflare/cloudflared/releases/latest
    echo.
    echo Download: cloudflared-windows-amd64.exe
    echo Rename to: cloudflared.exe
    echo Place in: C:\cloudflared\
    echo.
    pause
    exit /b 1
)

echo Backend should be running on http://localhost:8080
echo.
echo Starting Cloudflare Tunnel...
echo.
echo Your public URL will appear below.
echo Copy it and update VITE_API_URL in Vercel.
echo.
echo Press Ctrl+C to stop
echo.
echo ====================================
echo.

REM Запуск Cloudflare Tunnel в быстром режиме
REM Если ошибка - попробуйте обновить cloudflared до последней версии
%CLOUDFLARED_PATH% tunnel --url http://localhost:8080

REM Если ошибка edge-ip-version, обновите cloudflared:
REM https://github.com/cloudflare/cloudflared/releases/latest

pause
