@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo SafeGram: LocalTunnel на порт 8082 (API). Работает везде.
echo Гостям: один раз открыть ссылку в браузере, нажать «Продолжить» — потом логин и чаты работают.
echo Сначала запусти API (server-go на :8082), затем этот файл.
echo.
npx -y localtunnel --port 8082
pause
