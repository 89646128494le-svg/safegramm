@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo SafeGram: локальный тоннель на порт 8081.
echo После запуска скопируй URL (https://...loca.lt) в Vercel: переменная VITE_API_URL
echo.
npx -y localtunnel --port 8081
pause
