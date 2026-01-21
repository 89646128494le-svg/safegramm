@echo off
chcp 65001 >nul
echo =================================== SafeGram - Initialize Git Correctly ===================================
echo.

REM Переходим в директорию проекта
cd /d "%~dp0"
echo [1/7] Current directory: %CD%

REM Удаляем .git из домашней директории, если он там есть
echo [2/7] Checking for existing git repository...
if exist "%USERPROFILE%\.git" (
    echo WARNING: Git repository found in home directory!
    echo This will be ignored. We'll create a new one in the project directory.
)

REM Удаляем .git из текущей директории, если он существует
if exist ".git" (
    echo [3/7] Removing existing .git from project directory...
    rd /s /q .git 2>nul
)

REM Инициализируем git в директории проекта
echo [4/7] Initializing git repository in project directory...
git init
git branch -M main

REM Настраиваем remote
echo [5/7] Setting up remote repository...
git remote remove origin 2>nul
git remote add origin https://github.com/89646128494le-svg/safegramm.git

REM Добавляем только файлы проекта (игнорируя .gitignore)
echo [6/7] Adding project files...
git add -A

REM Проверяем, что добавилось
echo.
echo Files staged for commit:
git status --short | findstr /V "^??" | findstr /V "AppData" | findstr /V "Desktop" | findstr /V "Documents" | findstr /V "Downloads" | findstr /V "Pictures" | findstr /V "Music" | findstr /V "Videos" | findstr /V "OneDrive" | findstr /V "Contacts" | findstr /V "Favorites" | findstr /V "Links" | findstr /V "Searches" | findstr /V "Saved Games" | findstr /V "3D Objects" | findstr /V "Adobe" | findstr /V "PycharmProjects" | findstr /V "safegram-desktop" | findstr /V "source" | findstr /V "server" | findstr /V "node_modules" | findstr /V ".cache" | findstr /V ".cargo" | findstr /V ".cloudflared" | findstr /V ".codex" | findstr /V ".cursor" | findstr /V ".docker" | findstr /V ".expo" | findstr /V ".gemini" | findstr /V ".gitconfig" | findstr /V ".gk" | findstr /V ".gradle" | findstr /V ".keras" | findstr /V ".local" | findstr /V ".redhat" | findstr /V ".rustup" | findstr /V ".vscode" | findstr /V "NTUSER" | findstr /V "ntuser" | findstr /V "inst.ini" | findstr /V "nuuid.ini" | findstr /V "useruid.ini" | findstr /V "vmlogs" | findstr /V "gradle" | findstr /V "go" | findstr /V "safemax" | findstr /V ".bash_history" | findstr /V "package-lock.json" | findstr /V "package.json" | findstr /V "-1.14-windows.xml" | findstr /V "OpenVPN" | findstr /V "Tracing" | findstr /V "Favorites" | findstr /V "Links" | findstr /V "Searches" | findstr /V "Saved Games" | findstr /V "3D Objects" | findstr /V "Adobe" | findstr /V "PycharmProjects" | findstr /V "safegram-desktop" | findstr /V "source" | findstr /V "server" | findstr /V "node_modules" | findstr /V ".cache" | findstr /V ".cargo" | findstr /V ".cloudflared" | findstr /V ".codex" | findstr /V ".cursor" | findstr /V ".docker" | findstr /V ".expo" | findstr /V ".gemini" | findstr /V ".gitconfig" | findstr /V ".gk" | findstr /V ".gradle" | findstr /V ".keras" | findstr /V ".local" | findstr /V ".redhat" | findstr /V ".rustup" | findstr /V ".vscode" | findstr /V "NTUSER" | findstr /V "ntuser" | findstr /V "inst.ini" | findstr /V "nuuid.ini" | findstr /V "useruid.ini" | findstr /V "vmlogs" | findstr /V "gradle" | findstr /V "go" | findstr /V "safemax" | findstr /V ".bash_history" | findstr /V "package-lock.json" | findstr /V "package.json" | findstr /V "-1.14-windows.xml" | findstr /V "OpenVPN" | findstr /V "Tracing" | findstr /V "Favorites" | findstr /V "Links" | findstr /V "Searches" | findstr /V "Saved Games" | findstr /V "3D Objects" | findstr /V "Adobe" | findstr /V "PycharmProjects" | findstr /V "safegram-desktop" | findstr /V "source" | findstr /V "server" | findstr /V "node_modules" | findstr /V ".cache" | findstr /V ".cargo" | findstr /V ".cloudflared" | findstr /V ".codex" | findstr /V ".cursor" | findstr /V ".docker" | findstr /V ".expo" | findstr /V ".gemini" | findstr /V ".gitconfig" | findstr /V ".gk" | findstr /V ".gradle" | findstr /V ".keras" | findstr /V ".local" | findstr /V ".redhat" | findstr /V ".rustup" | findstr /V ".vscode" | findstr /V "NTUSER" | findstr /V "ntuser" | findstr /V "inst.ini" | findstr /V "nuuid.ini" | findstr /V "useruid.ini" | findstr /V "vmlogs" | findstr /V "gradle" | findstr /V "go" | findstr /V "safemax" | findstr /V ".bash_history" | findstr /V "package-lock.json" | findstr /V "package.json" | findstr /V "-1.14-windows.xml" | findstr /V "OpenVPN" | findstr /V "Tracing"

REM Создаем коммит
echo.
echo [7/7] Creating commit...
git commit -m "Initial commit: SafeGram - Multi-page website, admin panel, backend (Go), frontend (React), desktop app (Electron)"

if errorlevel 1 (
    echo.
    echo ERROR: Commit failed!
    echo This might mean there are no files to commit (all ignored by .gitignore).
    echo.
    echo Checking what files are in the project directory:
    dir /b /a-d | findstr /V "node_modules" | findstr /V ".git" | findstr /V "AppData" | findstr /V "Desktop" | findstr /V "Documents" | findstr /V "Downloads" | findstr /V "Pictures" | findstr /V "Music" | findstr /V "Videos" | findstr /V "OneDrive" | findstr /V "Contacts" | findstr /V "Favorites" | findstr /V "Links" | findstr /V "Searches" | findstr /V "Saved Games" | findstr /V "3D Objects" | findstr /V "Adobe" | findstr /V "PycharmProjects" | findstr /V "safegram-desktop" | findstr /V "source" | findstr /V "server" | findstr /V "node_modules" | findstr /V ".cache" | findstr /V ".cargo" | findstr /V ".cloudflared" | findstr /V ".codex" | findstr /V ".cursor" | findstr /V ".docker" | findstr /V ".expo" | findstr /V ".gemini" | findstr /V ".gitconfig" | findstr /V ".gk" | findstr /V ".gradle" | findstr /V ".keras" | findstr /V ".local" | findstr /V ".redhat" | findstr /V ".rustup" | findstr /V ".vscode" | findstr /V "NTUSER" | findstr /V "ntuser" | findstr /V "inst.ini" | findstr /V "nuuid.ini" | findstr /V "useruid.ini" | findstr /V "vmlogs" | findstr /V "gradle" | findstr /V "go" | findstr /V "safemax" | findstr /V ".bash_history" | findstr /V "package-lock.json" | findstr /V "package.json" | findstr /V "-1.14-windows.xml" | findstr /V "OpenVPN" | findstr /V "Tracing"
    pause
    exit /b 1
)

echo.
echo =================================== SUCCESS! ===================================
echo Git repository initialized in project directory.
echo.
echo Next step: Push to GitHub
echo Run: git push -u origin main
echo.
echo When prompted for credentials:
echo   Username: 89646128494le-svg
echo   Password: [your Personal Access Token]
echo.
pause
