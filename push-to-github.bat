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
git remote add origin https://github.com/89646128494le-svg/safegram2

echo [4/6] Adding files...
git add .

echo [5/7] Creating commit...
git commit -m "Initial commit: SafeGram multi-page website with admin panel and service management" 2>nul
if errorlevel 1 (
    echo WARNING: No changes to commit or commit failed
    echo You may need to configure Git user:
    echo   git config --global user.name "Your Name"
    echo   git config --global user.email "your.email@example.com"
    echo.
    echo Continuing anyway...
)

echo [6/7] Fetching remote changes...
git fetch origin main 2>nul

echo [7/7] Merging remote changes (if any)...
git branch -M main
git pull origin main --allow-unrelated-histories --no-edit 2>nul
if errorlevel 1 (
    echo Warning: Pull failed or conflicts. Trying to continue...
)

echo [8/8] Pushing to GitHub...
git push -u origin main

if errorlevel 1 (
    echo.
    echo ERROR: Push failed!
    echo.
    echo The remote repository has changes that conflict with yours.
    echo.
    echo Solutions:
    echo 1. Pull and merge manually:
    echo    git pull origin main --allow-unrelated-histories
    echo    git push origin main
    echo.
    echo 2. Force push (WARNING: This will overwrite remote changes!):
    echo    git push -u origin main --force
    echo.
    echo 3. Use GitHub Desktop for easier conflict resolution
    echo.
    echo For instructions, see DEPLOY_AND_API_KEYS.md
    pause
    exit /b 1
) else (
    echo.
    echo ===================================
    echo   SUCCESS! Code pushed to GitHub
    echo ===================================
    echo.
    echo Repository: https://github.com/89646128494le-svg/safegram2
    echo.
    echo Next steps:
    echo 1. Go to vercel.com
    echo 2. Import repository from GitHub
    echo 3. Follow instructions in DEPLOY_AND_API_KEYS.md
)

echo.
pause
