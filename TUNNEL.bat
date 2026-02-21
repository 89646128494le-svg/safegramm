@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo SafeGram: локальный тоннель на порт 8080 (бэкенд API).
echo Сначала запусти START.bat, затем этот файл.
echo После запуска скопируй URL (https://...loca.lt) в настройки приложения как API URL.
echo.
npx -y localtunnel --port 8080
pause
