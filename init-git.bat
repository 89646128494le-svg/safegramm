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
echo 1. Create a repository on GitHub
echo 2. Add remote: git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
echo 3. Push: git push -u origin main
echo.
echo Current branch: 
git branch --show-current
echo.
echo Status:
git status --short
echo.
pause
