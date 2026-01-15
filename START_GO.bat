@echo off
echo ========================================
echo   SafeGram - Go бэкенд + React фронтенд
echo ========================================
echo.

echo [1/4] Запуск PostgreSQL и Redis...
docker compose up -d db redis

echo.
echo [2/4] Ожидание готовности БД (10 секунд)...
timeout /t 10 /nobreak >nul

echo.
echo [3/4] Запуск Go бэкенда...
start "SafeGram Go Backend" cmd /k "cd server-go && run.bat"

echo.
echo [4/4] Ожидание запуска бэкенда (5 секунд)...
timeout /t 5 /nobreak >nul

echo.
echo Запуск React фронтенда...
start "SafeGram Frontend" cmd /k "cd web && npm run dev"

echo.
echo ✅ Приложение запущено!
echo    Веб-приложение: http://localhost:5173
echo    API: http://localhost:8080
echo.
pause

