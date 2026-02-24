@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo SafeGram: туннель ngrok на порт 8082 (API). Часто работает с телефона и из любой сети.
echo Сначала запусти API (server-go на :8082), затем этот файл.
echo.
echo Первый раз: зарегистрируйся на https://ngrok.com, скопируй authtoken и выполни:
echo   ngrok config add-authtoken ТВОЙ_ТОКЕН
echo.
ngrok http 8082
if errorlevel 1 (
  echo.
  echo Ошибка. Установи ngrok: winget install ngrok.ngrok  или скачай с https://ngrok.com/download
)
pause
