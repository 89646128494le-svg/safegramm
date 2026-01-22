@echo off
chcp 65001 >nul
title SafeGram - Commit and Push
color 0A

echo ====================================
echo   SafeGram - Commit and Push
echo ====================================
echo.

cd /d "%~dp0"

echo [1/4] Checking Git status...
git status --short
echo.

echo [2/4] Adding files...
git add vercel.json
git add web/package.json
git add web/vercel.json
echo.

echo [3/4] Creating commit...
git commit -m "Fix Vercel build: move Vite to dependencies, add root vercel.json"
echo.

echo [4/4] Pushing to GitHub...
git push origin main
echo.

echo ====================================
echo   SUCCESS! Changes pushed to GitHub
echo ====================================
echo.
echo Next: Redeploy in Vercel Dashboard
echo.
pause
