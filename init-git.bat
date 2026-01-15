@echo off
echo ========================================
echo SafeGram - Git Repository Initialization
echo ========================================
echo.

REM Check if git is installed
where git >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Git is not installed or not in PATH
    echo Please install Git from https://git-scm.com/
    pause
    exit /b 1
)

REM Check if already a git repository
if exist .git (
    echo [WARNING] This directory is already a git repository
    echo.
    set /p continue="Do you want to continue? (y/n): "
    if /i not "%continue%"=="y" (
        echo Cancelled.
        pause
        exit /b 0
    )
)

echo [1/4] Initializing git repository...
git init
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Failed to initialize git repository
    pause
    exit /b 1
)

echo [2/4] Adding all files...
git add .
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Failed to add files
    pause
    exit /b 1
)

echo [3/4] Creating initial commit...
git commit -m "Initial commit: SafeGram messenger"
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Failed to create commit
    pause
    exit /b 1
)

echo.
echo [4/4] Git repository initialized successfully!
echo.
echo Next steps:
echo 1. Add remote: git remote add origin https://github.com/89646128494le-svg/SafeGram3.git
echo 2. Push: git push -u origin main
echo.
echo Current branch: 
git branch --show-current
echo.
echo Status:
git status --short
echo.
echo.
echo Do you want to add remote and push now? (y/n)
set /p push_now="> "
if /i "%push_now%"=="y" (
    echo.
    echo Adding remote...
    git remote add origin https://github.com/89646128494le-svg/SafeGram3.git
    if %ERRORLEVEL% NEQ 0 (
        echo [WARNING] Remote might already exist, continuing...
        git remote set-url origin https://github.com/89646128494le-svg/SafeGram3.git
    )
    echo.
    echo Pushing to GitHub...
    git push -u origin main
    if %ERRORLEVEL% EQU 0 (
        echo.
        echo [SUCCESS] Code pushed to GitHub!
        echo Repository: https://github.com/89646128494le-svg/SafeGram3
    ) else (
        echo.
        echo [ERROR] Failed to push. You may need to authenticate.
        echo Run manually: git push -u origin main
    )
)
echo.
pause
