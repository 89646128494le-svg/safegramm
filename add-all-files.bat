@echo off
chcp 65001 >nul
echo =================================== SafeGram - Add All Files to GitHub ===================================
echo.

echo [1/5] Checking Git...
git --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Git is not installed!
    pause
    exit /b 1
)

echo [2/5] Checking Git repository...
if not exist ".git" (
    echo Initializing Git repository...
    git init
    git branch -M main
    git remote add origin https://github.com/89646128494le-svg/safegram2 2>nul
    git remote set-url origin https://github.com/89646128494le-svg/safegram2
)

echo [3/5] Fetching remote changes...
git fetch origin main 2>nul
git pull origin main --allow-unrelated-histories --no-edit 2>nul

echo [4/5] Adding all project files (excluding .git)...
git add -A
git reset -- .git/
git reset -- .gitignore
git add .gitignore

echo [5/5] Creating commit and pushing...
git commit -m "Add SafeGram complete project: multi-page website, admin panel, backend, frontend, desktop app"
git branch -M main
git push -u origin main

if errorlevel 1 (
    echo.
    echo ERROR: Push failed!
    echo Possible reasons:
    echo - Authentication required (need GitHub token)
    echo - Network connection issue
    echo.
    echo If authentication is required:
    echo 1. Use GitHub Desktop
    echo 2. Use personal access token (PAT)
    echo 3. Use SSH keys
    pause
    exit /b 1
)

echo.
echo =================================== SUCCESS! All files pushed to GitHub ===================================
echo Repository: https://github.com/89646128494le-svg/safegram2
echo.
echo Next steps:
echo 1. Go to vercel.com
echo 2. Import repository from GitHub
echo 3. Follow instructions in DEPLOY_AND_API_KEYS.md
echo.
pause
