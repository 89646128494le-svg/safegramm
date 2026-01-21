@echo off
chcp 65001 >nul
echo =================================== SafeGram - Fix Git Repository ===================================
echo.

echo [1/6] Checking current directory...
cd /d "%~dp0"
echo Current directory: %CD%

echo [2/6] Checking if .git exists in project directory...
if exist ".git" (
    echo .git found in project directory - OK
) else (
    echo .git not found - initializing...
    git init
    git branch -M main
)

echo [3/6] Setting up remote...
git remote remove origin 2>nul
git remote add origin https://github.com/89646128494le-svg/safegram2.git
git remote set-url origin https://github.com/89646128494le-svg/safegram2.git

echo [4/6] Fetching remote changes...
git fetch origin main 2>nul
git pull origin main --allow-unrelated-histories --no-edit 2>nul

echo [5/6] Adding all project files...
git add -A
git reset -- .git/

echo [6/6] Creating commit and pushing...
git commit -m "Add SafeGram complete project: multi-page website, admin panel, backend, frontend, desktop app" 2>nul
git branch -M main
git push -u origin main

if errorlevel 1 (
    echo.
    echo ERROR: Push failed!
    echo.
    echo This usually means authentication is required.
    echo Please use Personal Access Token (PAT) or GitHub Desktop.
    echo.
    echo See GITHUB_AUTHENTICATION.md for instructions.
    pause
    exit /b 1
)

echo.
echo =================================== SUCCESS! ===================================
echo Repository: https://github.com/89646128494le-svg/safegram2
echo All files have been pushed successfully!
echo.
pause
