@echo off
chcp 65001 >nul
echo =================================== SafeGram - Push to New Repository ===================================
echo.

REM Переходим в директорию проекта (где находится этот скрипт)
cd /d "%~dp0"
echo [1/6] Project directory: %CD%

REM Проверяем, что мы в правильной директории
if not exist "web" (
    echo ERROR: 'web' directory not found!
    echo Make sure you're running this script from the SafeGram project root.
    pause
    exit /b 1
)

REM Удаляем существующий .git, если он есть в проекте
if exist ".git" (
    echo [2/6] Removing existing .git...
    rd /s /q .git 2>nul
)

REM Инициализируем новый git репозиторий
echo [3/6] Initializing git repository...
git init
git branch -M main

REM Настраиваем remote на новый репозиторий
echo [4/6] Setting up remote repository...
git remote add origin https://github.com/89646128494le-svg/safegramm.git

REM Добавляем файлы проекта (игнорируя .gitignore)
echo [5/6] Adding project files...
git add -A

REM Проверяем статус
echo.
echo Files staged for commit:
git status --short | findstr /V "^??" | findstr /V "AppData" | findstr /V "Desktop" | findstr /V "Documents" | findstr /V "Downloads" | findstr /V "Pictures" | findstr /V "Music" | findstr /V "Videos" | findstr /V "OneDrive" | findstr /V "Contacts" | findstr /V "Favorites" | findstr /V "Links" | findstr /V "Searches" | findstr /V "Saved Games" | findstr /V "3D Objects" | findstr /V "Adobe" | findstr /V "PycharmProjects" | findstr /V "safegram-desktop" | findstr /V "source" | findstr /V "server" | findstr /V "node_modules" | findstr /V ".cache" | findstr /V ".cargo" | findstr /V ".cloudflared" | findstr /V ".codex" | findstr /V ".cursor" | findstr /V ".docker" | findstr /V ".expo" | findstr /V ".gemini" | findstr /V ".gitconfig" | findstr /V ".gk" | findstr /V ".gradle" | findstr /V ".keras" | findstr /V ".local" | findstr /V ".redhat" | findstr /V ".rustup" | findstr /V ".vscode" | findstr /V "NTUSER" | findstr /V "ntuser" | findstr /V "inst.ini" | findstr /V "nuuid.ini" | findstr /V "useruid.ini" | findstr /V "vmlogs" | findstr /V "gradle" | findstr /V "go" | findstr /V "safemax" | findstr /V ".bash_history" | findstr /V "package-lock.json" | findstr /V "package.json" | findstr /V "-1.14-windows.xml" | findstr /V "OpenVPN" | findstr /V "Tracing"

REM Создаем коммит
echo.
echo [6/6] Creating commit...
git commit -m "Initial commit: SafeGram - Multi-page website, admin panel, backend (Go), frontend (React), desktop app (Electron)"

if errorlevel 1 (
    echo.
    echo ERROR: Commit failed!
    echo This might mean there are no files to commit (all ignored by .gitignore).
    echo.
    echo Checking project structure:
    dir /b /a-d | findstr /V "node_modules" | findstr /V ".git" | findstr /V "AppData" | findstr /V "Desktop" | findstr /V "Documents" | findstr /V "Downloads" | findstr /V "Pictures" | findstr /V "Music" | findstr /V "Videos" | findstr /V "OneDrive" | findstr /V "Contacts" | findstr /V "Favorites" | findstr /V "Links" | findstr /V "Searches" | findstr /V "Saved Games" | findstr /V "3D Objects" | findstr /V "Adobe" | findstr /V "PycharmProjects" | findstr /V "safegram-desktop" | findstr /V "source" | findstr /V "server" | findstr /V "node_modules" | findstr /V ".cache" | findstr /V ".cargo" | findstr /V ".cloudflared" | findstr /V ".codex" | findstr /V ".cursor" | findstr /V ".docker" | findstr /V ".expo" | findstr /V ".gemini" | findstr /V ".gitconfig" | findstr /V ".gk" | findstr /V ".gradle" | findstr /V ".keras" | findstr /V ".local" | findstr /V ".redhat" | findstr /V ".rustup" | findstr /V ".vscode" | findstr /V "NTUSER" | findstr /V "ntuser" | findstr /V "inst.ini" | findstr /V "nuuid.ini" | findstr /V "useruid.ini" | findstr /V "vmlogs" | findstr /V "gradle" | findstr /V "go" | findstr /V "safemax" | findstr /V ".bash_history" | findstr /V "package-lock.json" | findstr /V "package.json" | findstr /V "-1.14-windows.xml" | findstr /V "OpenVPN" | findstr /V "Tracing"
    pause
    exit /b 1
)

echo.
echo =================================== SUCCESS! ===================================
echo Git repository initialized and committed.
echo.
echo Next step: Push to GitHub
echo Run: git push -u origin main
echo.
echo When prompted for credentials:
echo   Username: 89646128494le-svg
echo   Password: [your Personal Access Token - see GITHUB_AUTHENTICATION.md]
echo.
echo Or use GitHub Desktop for easier authentication.
echo.
pause
