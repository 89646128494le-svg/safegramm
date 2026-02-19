# Сборка Go-ядра в виде C-библиотеки для C++ (Windows).
# Требования: Go с CGO (CGO_ENABLED=1), MinGW (gcc в PATH).
# Запуск из корня репо: .\scripts\build_cbridge.ps1
# Запуск из desktop:    ..\scripts\build_cbridge.ps1

$ErrorActionPreference = "Stop"
# Корень репо = родитель папки scripts
$ModuleRoot = Split-Path -Parent $PSScriptRoot
$LibDir = Join-Path $ModuleRoot "desktop\lib"
$Cbridge = Join-Path $ModuleRoot "cmd\cbridge"

if (-not (Test-Path (Join-Path $ModuleRoot "go.mod"))) {
    Write-Error "Корень репозитория не найден (нет go.mod). Запустите скрипт из папки проекта или из desktop: ..\scripts\build_cbridge.ps1"
    exit 1
}
if (-not (Test-Path $Cbridge)) {
    Write-Error "Не найдена папка cmd\cbridge. Запуск из корня репо: cd путь\к\SafeGram перезапуск"
    exit 1
}

# CGO требует gcc в PATH
$gcc = Get-Command gcc -ErrorAction SilentlyContinue
if (-not $gcc) {
    Write-Host ""
    Write-Host "C-компилятор (gcc) не найден в PATH. CGO нужен для сборки библиотеки." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Установка gcc на Windows (один из вариантов):" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  1. MSYS2 (удобно, через winget):" -ForegroundColor White
    Write-Host "     winget install MSYS2.MSYS2"
    Write-Host "     Закройте и откройте терминал MSYS2 UCRT64, выполните:"
    Write-Host "     pacman -S mingw-w64-ucrt-x86_64-gcc"
    Write-Host "     Добавьте в системный PATH: C:\msys64\ucrt64\bin"
    Write-Host ""
    Write-Host "  2. WinLibs (один архив):" -ForegroundColor White
    Write-Host "     https://winlibs.com — скачайте сборку 64-bit (x86_64 / UCRT), НЕ 32-bit (i686). Папку bin в PATH"
    Write-Host ""
    Write-Host "  3. Chocolatey: choco install mingw" -ForegroundColor White
    Write-Host ""
    Write-Host "После установки перезапустите терминал и снова выполните скрипт." -ForegroundColor Green
    Write-Host ""
    exit 1
}

if (-not (Test-Path $LibDir)) { New-Item -ItemType Directory -Path $LibDir -Force | Out-Null }

# Если в PATH есть и 32-bit и 64-bit MinGW, Go может взять первый (32-bit) и дать "64-bit mode not compiled in".
# Задайте SAFEGRAM_MINGW64 или SAFEGRAM_CC чтобы явно указать 64-bit gcc:
#   $env:SAFEGRAM_MINGW64 = "C:\mingw64\bin"
#   $env:SAFEGRAM_CC = "C:\mingw64\bin\gcc.exe"
if ($env:SAFEGRAM_MINGW64) {
    $env:Path = $env:SAFEGRAM_MINGW64 + ";" + $env:Path
    $gcc64 = Join-Path $env:SAFEGRAM_MINGW64 "gcc.exe"
    if (Test-Path $gcc64) { $env:CC = $gcc64 }
}
if ($env:SAFEGRAM_CC) { $env:CC = $env:SAFEGRAM_CC }

Push-Location $ModuleRoot
try {
    $env:CGO_ENABLED = "1"
    go build -buildmode=c-shared -o (Join-Path $LibDir "safegram_core.dll") (Join-Path $ModuleRoot "cmd\cbridge")
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    Write-Host 'OK: desktop\lib\safegram_core.dll and safegram_core.h created.'
} finally {
    Pop-Location
}
