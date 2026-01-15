@echo off
echo ========================================
echo   SafeGram - Запуск приложения
echo ========================================
echo.

echo [1/3] Запуск PostgreSQL и Redis...
docker compose up -d db redis

echo.
echo [2/3] Ожидание готовности БД (10 секунд)...
timeout /t 10 /nobreak >nul

echo.
echo [3/3] Выберите вариант запуска:
echo.
echo   1. Docker Compose (Node.js бэкенд) - Рекомендуется
echo   2. Go бэкенд + React фронтенд (локально)
echo.
set /p choice="Ваш выбор (1 или 2): "

if "%choice%"=="1" goto docker
if "%choice%"=="2" goto local
goto end

:docker
echo.
echo Запуск через Docker Compose...
docker compose up -d --build
echo.
echo ✅ Приложение запущено!
echo    Веб-приложение: http://localhost:8081
echo    API: http://localhost:8080
goto end

:local
echo.
echo Запуск Go бэкенда...
start "SafeGram Go Backend" cmd /k "cd server-go && run.bat"
timeout /t 3 /nobreak >nul

echo.
echo Запуск React фронтенда...
start "SafeGram Frontend" cmd /k "cd web && npm run dev"
echo.
echo ✅ Приложение запущено!
echo    Веб-приложение: http://localhost:5173
echo    API: http://localhost:8080
goto end

:end
echo.
pause

