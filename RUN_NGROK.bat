@echo off
chcp 65001 >nul
title SafeGram ngrok
color 0B

echo ====================================
echo   Starting ngrok Tunnel
echo ====================================
echo.
echo Backend should be running on http://localhost:8080
echo.
echo Your public URL will appear below.
echo Copy it and update VITE_API_URL in Vercel.
echo.
echo Press Ctrl+C to stop
echo.
echo ====================================
echo.

REM Запуск ngrok напрямую
C:\ngrok\ngrok.exe http 8080

pause
