@echo off
echo ===================================
echo   SafeGram - Push to GitHub
echo ===================================
echo.

REM Переходим в директорию скрипта
cd /d "%~dp0"

echo [1/6] Checking Git...
git --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Git is not installed!
    echo Please install Git from https://git-scm.com/
    pause
    exit /b 1
)

echo [2/6] Initializing Git repository...
if exist .git (
    echo Git repository already exists
) else (
    git init
)

echo [3/6] Setting up remote...
git remote remove origin 2>nul
git remote add origin https://github.com/89646128494le-svg/SafeGram3.git

echo [4/6] Adding files...
git add .

echo [5/6] Creating commit...
git commit -m "Initial commit: SafeGram multi-page website with admin panel and service management" 2>nul
if errorlevel 1 (
    echo WARNING: No changes to commit or commit failed
    echo You may need to configure Git user:
    echo   git config --global user.name "Your Name"
    echo   git config --global user.email "your.email@example.com"
)

echo [6/6] Pushing to GitHub...
git branch -M main
git push -u origin main

if errorlevel 1 (
    echo.
    echo ERROR: Push failed!
    echo.
    echo Possible reasons:
    echo - GitHub repository does not exist
    echo - Authentication required (need GitHub token)
    echo - Network connection issue
    echo.
    echo If authentication is required, you can:
    echo 1. Use GitHub Desktop
    echo 2. Use personal access token (PAT)
    echo 3. Use SSH keys
    echo.
    echo For instructions, see DEPLOY_AND_API_KEYS.md
) else (
    echo.
    echo ===================================
    echo   SUCCESS! Code pushed to GitHub
    echo ===================================
    echo.
    echo Repository: https://github.com/89646128494le-svg/SafeGram3
    echo.
    echo Next steps:
    echo 1. Go to vercel.com
    echo 2. Import repository from GitHub
    echo 3. Follow instructions in DEPLOY_AND_API_KEYS.md
)

echo.
pause
