@echo off
chcp 65001 >nul
echo Starting SafeGram Webhook Receiver...
cd /d "%~dp0"
if not exist node_modules (
    echo Installing dependencies...
    call npm install
)
npm start
