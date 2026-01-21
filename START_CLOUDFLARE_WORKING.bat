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
    pause
    exit /b 1
)

echo Backend should be running on http://localhost:8080
echo.
echo Starting Cloudflare Tunnel...
echo.

REM Удаляем старую конфигурацию если есть проблема
REM (опционально, раскомментируйте если нужно)
REM del /q "%USERPROFILE%\.cloudflared\config.yml" 2>nul

REM Запуск Cloudflare Tunnel с минимальными параметрами
REM Используем --url без дополнительных параметров
echo Your public URL will appear below...
echo Copy it and update VITE_API_URL in Vercel.
echo.
echo Press Ctrl+C to stop
echo.
echo ====================================
echo.

%CLOUDFLARED_PATH% tunnel --url http://127.0.0.1:8080

pause
