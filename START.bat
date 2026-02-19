@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo SafeGram: запуск сервера (HTTP :8081, WebSocket /ws)...
go run ./cmd/server
pause
