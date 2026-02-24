# Сборка бинарника для Linux (залить на сервер в server-go/ и запустить docker compose -f docker-compose.prebuilt.yml up -d --build)
$env:GOOS = "linux"
$env:GOARCH = "amd64"
Push-Location $PSScriptRoot
go mod tidy
go build -o main .
Pop-Location
Write-Host "Готово: server-go/main. Залей на сервер: scp main root@IP_СЕРВЕРА:/opt/safegram-api/server-go/"
