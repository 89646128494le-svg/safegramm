@echo off
chcp 65001 >nul
echo ========================================
echo Создание аккаунта владельца SafeGram
echo ========================================
echo.

cd /d "%~dp0"
cd server-go\cmd\create-owner

if not exist "main.go" (
    echo ❌ Ошибка: файл main.go не найден
    echo Убедитесь, что вы находитесь в правильной директории
    pause
    exit /b 1
)

echo Введите данные для аккаунта владельца:
echo.
set /p USERNAME="Имя пользователя: "
set /p PASSWORD="Пароль: "
set /p EMAIL="Email (необязательно, нажмите Enter чтобы пропустить): "

if "%EMAIL%"=="" (
    go run main.go %USERNAME% %PASSWORD%
) else (
    go run main.go %USERNAME% %PASSWORD% %EMAIL%
)

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ✅ Аккаунт владельца успешно создан!
    echo Теперь вы можете войти в систему с этими учетными данными.
) else (
    echo.
    echo ❌ Ошибка при создании аккаунта
    echo Проверьте:
    echo - Запущен ли PostgreSQL
    echo - Правильно ли установлена переменная DATABASE_URL
    echo - Существует ли база данных safegram
)

echo.
pause
