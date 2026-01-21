@echo off
chcp 65001 >nul
title SafeGram - Create Owner Account
color 0A

echo ====================================
echo   SafeGram - Create Owner Account
echo ====================================
echo.

REM Проверка что мы в правильной директории
cd /d "%~dp0"
cd server-go\cmd\create-owner

REM Проверка наличия Go
where go >nul 2>&1
if errorlevel 1 (
    echo ERROR: Go not found!
    echo Please install Go from: https://go.dev/dl/
    echo.
    pause
    exit /b 1
)

REM Запрос данных
set /p OWNER_USERNAME="Enter username (default: owner): "
if "%OWNER_USERNAME%"=="" set OWNER_USERNAME=owner

set /p OWNER_PASSWORD="Enter password: "
if "%OWNER_PASSWORD%"=="" (
    echo ERROR: Password is required!
    pause
    exit /b 1
)

set /p OWNER_EMAIL="Enter email (optional, press Enter to skip): "

REM Загрузка переменных окружения из .env в server-go
if exist "..\..\..\server-go\.env" (
    echo.
    echo Loading .env file...
    for /f "usebackq tokens=*" %%a in ("..\..\..\server-go\.env") do (
        set "%%a"
    )
)

REM Установка DATABASE_URL если не установлен
if "%DATABASE_URL%"=="" (
    set DATABASE_URL=postgres://safegram:safegram@localhost:5432/safegram?sslmode=disable
    echo.
    echo ⚠️  DATABASE_URL not set, using default
)

echo.
echo Creating owner account...
echo Username: %OWNER_USERNAME%
echo Email: %OWNER_EMAIL%
echo.

REM Создание owner
if "%OWNER_EMAIL%"=="" (
    go run main.go %OWNER_USERNAME% %OWNER_PASSWORD%
) else (
    go run main.go %OWNER_USERNAME% %OWNER_PASSWORD% %OWNER_EMAIL%
)

if errorlevel 1 (
    echo.
    echo ERROR: Failed to create owner account
    echo.
    echo Check:
    echo 1. PostgreSQL is running
    echo 2. DATABASE_URL is correct
    echo 3. Database 'safegram' exists
    echo.
    pause
    exit /b 1
)

echo.
echo ====================================
echo   Owner account created successfully!
echo ====================================
echo.
echo You can now login with:
echo Username: %OWNER_USERNAME%
echo Password: %OWNER_PASSWORD%
echo.
pause
