@echo off
chcp 65001 >nul
title SafeGram Control Panel
color 0A

:menu
cls
echo.
echo ╔═══════════════════════════════════════════════════════════╗
echo ║           SafeGram Control Panel                         ║
echo ╚═══════════════════════════════════════════════════════════╝
echo.
echo [1] 🚀 Запустить всё (Docker + Go + React)
echo [2] 🔄 Перезапустить Go бэкенд
echo [3] 🔄 Перезапустить React фронтенд
echo [4] 🔄 Перезапустить Docker (PostgreSQL + Redis)
echo [5] ⏹  Остановить всё
echo [6] 📊 Показать статус
echo [7] 🗑  Очистить логи
echo [8] ❌ Выход
echo.
set /p choice="Выберите действие (1-8): "

if "%choice%"=="1" goto start_all
if "%choice%"=="2" goto restart_backend
if "%choice%"=="3" goto restart_frontend
if "%choice%"=="4" goto restart_docker
if "%choice%"=="5" goto stop_all
if "%choice%"=="6" goto show_status
if "%choice%"=="7" goto clear_logs
if "%choice%"=="8" goto exit
goto menu

:start_all
cls
echo.
echo ╔═══════════════════════════════════════════════════════════╗
echo ║           Запуск всех сервисов...                        ║
echo ╚═══════════════════════════════════════════════════════════╝
echo.

echo [1/4] Запуск PostgreSQL и Redis...
docker compose up -d db redis
if errorlevel 1 (
    echo ❌ Ошибка запуска Docker контейнеров
    pause
    goto menu
)

echo.
echo [2/4] Ожидание готовности БД (10 секунд)...
timeout /t 10 /nobreak >nul

echo.
echo [3/4] Запуск Go бэкенда...
start "SafeGram Go Backend" cmd /k "cd server-go && run.bat"
timeout /t 3 /nobreak >nul

echo.
echo [4/4] Запуск React фронтенда...
start "SafeGram Frontend" cmd /k "cd web && npm run dev -- --host 0.0.0.0"
timeout /t 2 /nobreak >nul

echo.
echo ✅ Все сервисы запущены!
echo.
echo    🌐 Фронтенд: http://localhost:5173
echo    🌐 Фронтенд (сеть): http://192.168.1.105:5173
echo    🔌 API: http://localhost:8080
echo    🗄️  PostgreSQL: localhost:5432
echo    📦 Redis: localhost:6379
echo.
pause
goto menu

:restart_backend
cls
echo.
echo ╔═══════════════════════════════════════════════════════════╗
echo ║           Перезапуск Go бэкенда...                       ║
echo ╚═══════════════════════════════════════════════════════════╝
echo.

echo Остановка старых процессов...
taskkill /FI "WINDOWTITLE eq SafeGram Go Backend*" /F >nul 2>&1
timeout /t 2 /nobreak >nul

echo Запуск нового процесса...
start "SafeGram Go Backend" cmd /k "cd server-go && run.bat"

echo.
echo ✅ Go бэкенд перезапущен!
echo.
pause
goto menu

:restart_frontend
cls
echo.
echo ╔═══════════════════════════════════════════════════════════╗
echo ║           Перезапуск React фронтенда...                  ║
echo ╚═══════════════════════════════════════════════════════════╝
echo.

echo Остановка старых процессов...
taskkill /FI "WINDOWTITLE eq SafeGram Frontend*" /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq npm*" /F >nul 2>&1
timeout /t 2 /nobreak >nul

echo Запуск нового процесса...
start "SafeGram Frontend" cmd /k "cd web && npm run dev -- --host 0.0.0.0"

echo.
echo ✅ React фронтенд перезапущен!
echo.
pause
goto menu

:restart_docker
cls
echo.
echo ╔═══════════════════════════════════════════════════════════╗
echo ║           Перезапуск Docker контейнеров...               ║
echo ╚═══════════════════════════════════════════════════════════╝
echo.

echo Остановка контейнеров...
docker compose stop db redis
timeout /t 2 /nobreak >nul

echo Запуск контейнеров...
docker compose up -d db redis

echo.
echo ✅ Docker контейнеры перезапущены!
echo.
pause
goto menu

:stop_all
cls
echo.
echo ╔═══════════════════════════════════════════════════════════╗
echo ║           Остановка всех сервисов...                      ║
echo ╚═══════════════════════════════════════════════════════════╝
echo.

echo Остановка Go бэкенда...
taskkill /FI "WINDOWTITLE eq SafeGram Go Backend*" /F >nul 2>&1

echo Остановка React фронтенда...
taskkill /FI "WINDOWTITLE eq SafeGram Frontend*" /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq npm*" /F >nul 2>&1

echo Остановка Docker контейнеров...
docker compose stop db redis

echo.
echo ✅ Все сервисы остановлены!
echo.
pause
goto menu

:show_status
cls
echo.
echo ╔═══════════════════════════════════════════════════════════╗
echo ║           Статус сервисов                                ║
echo ╚═══════════════════════════════════════════════════════════╝
echo.

echo [Docker контейнеры]
docker compose ps db redis
echo.

echo [Go бэкенд]
tasklist /FI "WINDOWTITLE eq SafeGram Go Backend*" 2>nul | find /I "cmd.exe" >nul
if errorlevel 1 (
    echo ❌ Не запущен
) else (
    echo ✅ Запущен
)
echo.

echo [React фронтенд]
tasklist /FI "WINDOWTITLE eq SafeGram Frontend*" 2>nul | find /I "cmd.exe" >nul
if errorlevel 1 (
    echo ❌ Не запущен
) else (
    echo ✅ Запущен
)
echo.

echo [Порты]
netstat -an | findstr ":8080" >nul
if errorlevel 1 (
    echo ❌ Порт 8080 (Go API) - не используется
) else (
    echo ✅ Порт 8080 (Go API) - занят
)

netstat -an | findstr ":5173" >nul
if errorlevel 1 (
    echo ❌ Порт 5173 (React) - не используется
) else (
    echo ✅ Порт 5173 (React) - занят
)

netstat -an | findstr ":5432" >nul
if errorlevel 1 (
    echo ❌ Порт 5432 (PostgreSQL) - не используется
) else (
    echo ✅ Порт 5432 (PostgreSQL) - занят
)

netstat -an | findstr ":6379" >nul
if errorlevel 1 (
    echo ❌ Порт 6379 (Redis) - не используется
) else (
    echo ✅ Порт 6379 (Redis) - занят
)
echo.
pause
goto menu

:clear_logs
cls
echo.
echo ╔═══════════════════════════════════════════════════════════╗
echo ║           Очистка логов                                  ║
echo ╚═══════════════════════════════════════════════════════════╝
echo.

if exist "server-go\*.log" (
    del /Q "server-go\*.log" >nul 2>&1
    echo ✅ Логи Go бэкенда очищены
)

if exist "web\*.log" (
    del /Q "web\*.log" >nul 2>&1
    echo ✅ Логи React фронтенда очищены
)

if exist ".cursor\debug.log" (
    del /Q ".cursor\debug.log" >nul 2>&1
    echo ✅ Debug логи очищены
)

echo.
echo ✅ Очистка завершена!
echo.
pause
goto menu

:exit
cls
echo.
echo До свидания!
timeout /t 1 >nul
exit

