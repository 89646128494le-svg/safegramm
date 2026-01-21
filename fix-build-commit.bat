@echo off
chcp 65001 >nul
cd /d "%~dp0"
git add web/src/components/EnhancedChatWindow.tsx web/vercel.json
git commit -m "Fix: Remove duplicate cancelRecording function and optimize Vercel build config"
git push origin main
pause
