# Генератор VAPID ключей для push-уведомлений
# Использует Go утилиту для генерации ключей

$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$goScript = Join-Path $scriptPath "server-go\cmd\generate-vapid\main.go"

if (Test-Path $goScript) {
    Push-Location (Split-Path -Parent $goScript)
    go run main.go
    Pop-Location
} else {
    Write-Host "Файл не найден: $goScript"
    Write-Host ""
    Write-Host "Альтернативный способ - используйте онлайн генератор:"
    Write-Host "https://web-push-codelab.glitch.me/"
    Write-Host ""
    Write-Host "Или установите web-push в Node.js проекте:"
    Write-Host "cd server"
    Write-Host "npm install web-push"
    Write-Host "node src/generate_vapid.js"
}

