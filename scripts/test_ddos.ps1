# Тестовый DDoS: много запросов к API для проверки срабатывания rate limit.
# Запуск: $env:BASE_URL="http://localhost:8081"; .\scripts\test_ddos.ps1

$BaseUrl = if ($env:BASE_URL) { $env:BASE_URL } else { "http://localhost:8081" }
$Url = "$BaseUrl/api/notify/status"
$Count = 150
$Ok = 0

for ($i = 1; $i -le $Count; $i++) {
    try {
        $r = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2 -ErrorAction SilentlyContinue
        if ($r.StatusCode -eq 200) { $Ok++ }
    } catch { }
    Write-Host "`rЗапрос $i/$Count (200: $Ok)" -NoNewline
}
Write-Host ""

if ($Ok -lt $Count) {
    Write-Host "Защита сработала: не все запросы прошли (200: $Ok из $Count)."
} else {
    Write-Host "Все запросы вернули 200. Для проверки rate limit настрой Guard."
}
