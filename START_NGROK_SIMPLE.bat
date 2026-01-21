@echo off
chcp 65001 >nul
title SafeGram ngrok - Simple
color 0B

echo ====================================
echo   SafeGram ngrok Tunnel
echo ====================================
echo.

REM Проверка наличия ngrok
set NGROK_PATH=C:\ngrok\ngrok.exe

if not exist "%NGROK_PATH%" (
    echo ERROR: ngrok not found at %NGROK_PATH%
    echo.
    echo Please:
    echo 1. Download from: https://ngrok.com/download
    echo 2. Extract to C:\ngrok\
    echo 3. Sign up at https://ngrok.com (free)
    echo 4. Get authtoken from: https://dashboard.ngrok.com/get-started/your-authtoken
    echo 5. Run: %NGROK_PATH% authtoken YOUR_TOKEN
    echo.
    pause
    exit /b 1
)

echo Starting ngrok tunnel on port 8080...
echo.
echo Your public URL will appear below.
echo Copy it and update VITE_API_URL in Vercel.
echo.
echo Press Ctrl+C to stop
echo.
echo ====================================
echo.

REM Запуск ngrok напрямую (без проверки authtoken)
%NGROK_PATH% http 8080

pause
