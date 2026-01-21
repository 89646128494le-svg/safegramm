@echo off
chcp 65001 >nul
echo ========================================
echo SafeGram Webhook Receiver - Windows
echo ========================================
echo.

cd /d "%~dp0"

REM Проверка Node.js
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ОШИБКА] Node.js не найден!
    echo.
    echo Установите Node.js с https://nodejs.org/
    pause
    exit /b 1
)

echo [OK] Node.js найден: 
node --version
echo.

REM Установка зависимостей
if not exist "node_modules" (
    echo [УСТАНОВКА] Установка зависимостей...
    call npm install
    echo.
)

REM Проверка порта
netstat -ano | findstr ":3000" >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo [ВНИМАНИЕ] Порт 3000 уже занят!
    echo Остановите другой процесс или измените PORT в index.js
    echo.
    pause
)

echo [ЗАПУСК] Запуск Webhook Receiver...
echo.
echo Webhook URL для настройки:
echo   Локально: http://localhost:3000/webhook
echo.
echo Для использования с VPS используйте ngrok или SSH туннель
echo.
echo Нажмите Ctrl+C для остановки
echo.
echo ========================================
echo.

npm start
