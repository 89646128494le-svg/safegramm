@echo off
chcp 65001 >nul
echo ========================================
echo Генерация VAPID ключей для push-уведомлений
echo ========================================
echo.

REM Получаем директорию, где находится bat-файл
set "SCRIPT_DIR=%~dp0"
echo Текущая директория: %SCRIPT_DIR%
echo.

REM Проверяем наличие Go
where go >nul 2>&1
if %errorlevel% neq 0 (
    echo ОШИБКА: Go не найден в PATH!
    echo Установите Go с https://golang.org/dl/
    echo.
    pause
    exit /b 1
)

echo Go найден, продолжаем...
echo.

REM Переходим в директорию с генератором
set "GEN_DIR=%SCRIPT_DIR%server-go\cmd\generate-vapid"
echo Проверяем директорию: %GEN_DIR%
echo.

if not exist "%GEN_DIR%" (
    echo ОШИБКА: Директория не найдена: %GEN_DIR%
    echo.
    echo Проверьте структуру проекта:
    echo   - server-go\cmd\generate-vapid\main.go
    echo.
    pause
    exit /b 1
)

cd /d "%GEN_DIR%"
if %errorlevel% neq 0 (
    echo ОШИБКА: Не удалось перейти в директорию!
    pause
    exit /b 1
)

if not exist "main.go" (
    echo ОШИБКА: Файл main.go не найден в %GEN_DIR%
    echo.
    echo Альтернативные способы:
    echo 1. Онлайн генератор: https://web-push-codelab.glitch.me/
    echo 2. Установите web-push в Node.js: npm install web-push
    echo    Затем: node server/src/generate_vapid.js
    echo.
    pause
    exit /b 1
)

echo Запускаем генератор...
echo Текущая директория: %CD%
echo.
go run main.go
if %errorlevel% neq 0 (
    echo.
    echo ОШИБКА: Не удалось запустить генератор!
    echo Проверьте, что Go установлен правильно.
    echo Текущая директория: %CD%
    echo.
    pause
    exit /b 1
)

echo.
echo ========================================
echo Генерация завершена!
echo Скопируйте ключи в ваш .env файл
echo ========================================
pause

