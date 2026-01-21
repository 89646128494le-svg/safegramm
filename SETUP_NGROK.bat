@echo off
chcp 65001 >nul
title SafeGram ngrok Setup
color 0B

echo ====================================
echo   SafeGram ngrok Setup
echo ====================================
echo.

REM Проверка наличия ngrok
set NGROK_PATH=C:\ngrok\ngrok.exe

if not exist "%NGROK_PATH%" (
    echo ERROR: ngrok not found at %NGROK_PATH%
    echo.
    echo Please download ngrok from: https://ngrok.com/download
    echo Extract it to C:\ngrok\
    echo.
    pause
    exit /b 1
)

echo [1/3] Starting ngrok tunnel...
echo.
echo NOTE: If ngrok asks for authtoken, run this command in PowerShell:
echo   %NGROK_PATH% authtoken YOUR_TOKEN
echo.
echo You can get your token from: https://dashboard.ngrok.com/get-started/your-authtoken
echo.

echo.
echo [2/3] Starting ngrok tunnel...
echo.
echo ====================================
echo   ngrok tunnel starting...
echo   Public URL will appear below
echo ====================================
echo.
echo Press Ctrl+C to stop
echo.

REM Запуск ngrok
%NGROK_PATH% http 8080

pause
