@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo SafeGram: туннель Cloudflare на порт 8082 (API). Без страницы «Продолжить» — гости заходят сразу.
echo Сначала запусти START.bat или API (server-go на :8082), затем этот файл.
echo.
echo Если cloudflared не установлен: winget install cloudflare.cloudflared
echo Или скачай: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/
echo.
cloudflared tunnel --url http://localhost:8082 --edge-ip-version 4
if errorlevel 1 (
  echo.
  echo Ошибка: cloudflared не найден. Установи: winget install cloudflare.cloudflared
)
pause
