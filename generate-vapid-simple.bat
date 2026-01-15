@echo off
echo ========================================
echo Генерация VAPID ключей
echo ========================================
echo.

REM Проверяем Go
go version >nul 2>&1
if errorlevel 1 (
    echo [ОШИБКА] Go не найден!
    echo Установите Go: https://golang.org/dl/
    pause
    exit /b 1
)

echo [OK] Go найден
echo.

REM Переходим в директорию генератора
cd /d "%~dp0server-go\cmd\generate-vapid" 2>nul
if errorlevel 1 (
    echo [ОШИБКА] Не удалось перейти в директорию генератора
    echo Проверьте путь: %~dp0server-go\cmd\generate-vapid
    echo.
    echo Альтернатива: используйте онлайн генератор
    echo https://web-push-codelab.glitch.me/
    pause
    exit /b 1
)

echo [OK] Директория найдена: %CD%
echo.

REM Проверяем наличие main.go
if not exist "main.go" (
    echo [ОШИБКА] Файл main.go не найден!
    echo Текущая директория: %CD%
    pause
    exit /b 1
)

echo [OK] Файл main.go найден
echo.
echo Запускаем генератор...
echo.

REM Запускаем генератор
go run main.go

echo.
echo ========================================
echo Готово! Скопируйте ключи в .env файл
echo ========================================
pause

