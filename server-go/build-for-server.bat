@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo Building SafeGram server for Linux (amd64)...
set GOOS=linux
set GOARCH=amd64
set CGO_ENABLED=0
go build -ldflags="-s -w" -o main .

if %ERRORLEVEL% NEQ 0 (
  echo Build failed. Install Go from https://go.dev/dl/
  exit /b 1
)

echo Done. Binary: main
echo Upload to server: server-go\main and server-go\.env
echo On server: docker build -f Dockerfile.prebuilt -t safegram-server . ^&^& bash start-container.sh
