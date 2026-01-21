@echo off
chcp 65001 >nul
title SafeGram Backend Server
color 0A

echo ====================================
echo   SafeGram Backend - Local Server
echo ====================================
echo.

REM Переход в директорию проекта
cd /d "%~dp0"
cd server-go

REM Сборка backend (пересборка всегда для актуальности)
echo [1/5] Building backend...
go build -o main.exe .
if errorlevel 1 (
    echo.
    echo ERROR: Failed to build backend!
    echo Please check the errors above and fix them.
    echo.
    pause
    exit /b 1
)
echo ✓ Backend built successfully

echo.

REM Запуск PostgreSQL через Docker (если используется)
echo [2/5] Starting PostgreSQL...
docker start safegram-postgres 2>nul
if errorlevel 1 (
    echo ⚠ PostgreSQL container not found. Starting new one...
    docker run -d --name safegram-postgres -e POSTGRES_USER=safegram -e POSTGRES_PASSWORD=safegram -e POSTGRES_DB=safegram -p 5432:5432 -v safegram-data:/var/lib/postgresql/data postgres:16-alpine
)
echo ✓ PostgreSQL running

echo.

REM Запуск Redis через Docker (если используется)
echo [3/5] Starting Redis...
docker start safegram-redis 2>nul
if errorlevel 1 (
    echo ⚠ Redis container not found. Starting new one...
    docker run -d --name safegram-redis -p 6379:6379 -v safegram-redis-data:/data redis:7-alpine
)
echo ✓ Redis running

echo.

REM Ожидание готовности PostgreSQL
echo [4/5] Waiting for PostgreSQL to be ready...
timeout /t 5 >nul

echo.

REM Запуск backend
echo [5/5] Starting SafeGram Backend...
echo.
echo ====================================
echo   Backend starting on port 8080
echo   Local URL: http://localhost:8080
echo ====================================
echo.
echo To get public URL, run ngrok in separate terminal:
echo   C:\ngrok\ngrok.exe http 8080
echo.
echo Press Ctrl+C to stop
echo.

REM Запуск backend
main.exe

pause
