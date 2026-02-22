@echo off
chcp 65001 >nul
cd /d "%~dp0"
title SafeGram — запуск
echo.
echo  [1/5] Запуск ядра Go (HTTP :8081, TCP :8084) + TG-бот...
start "SafeGram Core (Go + TG)" cmd /k "cd /d "%~dp0" && set TCP_PORT=8084 && title SafeGram Core ^& TG Bot && go run ./cmd/server"
echo       Окно "SafeGram Core" — алерты и команды бота в Telegram (только Lev).
echo.
echo  [2/5] Запуск API (server-go :8082)...
start "SafeGram API" cmd /k "cd /d "%~dp0server-go" && set PORT=8082 && title SafeGram API && go run ."
echo       Окно "SafeGram API" открыто.
echo.
echo  [3/5] Ожидание 6 сек, пока API поднимется...
timeout /t 6 /nobreak >nul
echo.
echo  [4/5] Запуск LocalTunnel (скопируй URL из окна "SafeGram Tunnel")...
start "SafeGram Tunnel" cmd /k "cd /d "%~dp0" && title SafeGram Tunnel && npx -y localtunnel --port 8082"
echo       Окно "SafeGram Tunnel" открыто — скопируй https://...loca.lt в настройки приложения (API на 8082).
echo.
echo  [5/5] Запуск фронта (Vite)...
start "SafeGram Web" cmd /k "cd /d "%~dp0web" && title SafeGram Web && npm run dev"
echo       Окно "SafeGram Web" открыто — открой http://localhost:5173 в браузере.
echo.
echo  Готово. Go-ядро :8081/:8084, API (server-go) :8082, фронт :5173. Туннель — порт 8082.
echo  В Telegram напиши боту /help — команды /status, /report, /nn.
echo.
pause
