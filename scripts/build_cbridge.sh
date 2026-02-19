#!/usr/bin/env bash
# Сборка Go-ядра в виде C-библиотеки для C++ (Linux/macOS).
# Требования: CGO_ENABLED=1, gcc/clang.
# Запуск: ./scripts/build_cbridge.sh

set -e
cd "$(dirname "$0")/.."
mkdir -p desktop/lib
CGO_ENABLED=1 go build -buildmode=c-shared -o desktop/lib/safegram_core.so ./cmd/cbridge
echo "OK: desktop/lib/safegram_core.so и safegram_core.h созданы."
