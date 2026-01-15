@echo off
echo ========================================
echo   SafeGram - Docker Compose запуск
echo ========================================
echo.

echo Запуск всех сервисов...
docker compose up -d --build

echo.
echo ✅ Приложение запущено!
echo    Веб-приложение: http://localhost:8081
echo    API: http://localhost:8080
echo.
echo Для просмотра логов: docker compose logs -f
echo Для остановки: docker compose down
echo.
pause

