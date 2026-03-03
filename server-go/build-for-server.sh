#!/bin/bash
# Сборка бинарника для Linux (на ПК или в CI). Результат: файл main в текущей папке.
set -e
cd "$(dirname "$0")"

echo "Building SafeGram server for Linux (amd64)..."
GOOS=linux GOARCH=amd64 CGO_ENABLED=0 go build -ldflags="-s -w" -o main .

echo "Done. Binary: $(pwd)/main"
echo "Upload to server: main + .env + Dockerfile.prebuilt"
echo "On server: docker build -f Dockerfile.prebuilt -t safegram-server . && bash start-container.sh"
