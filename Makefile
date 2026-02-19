# SafeGram Core: сборка Go-сервера, клиента и C-библиотеки для C++

GO ?= go
MODULE := github.com/89646128494le-svg/safegram-core
CBRIDGE_DIR := cmd/cbridge
OUT_DIR := build
LIB_DIR := desktop/lib

.PHONY: all server client cbridge clean

all: server client

# Обычная сборка сервера и Go-клиента
server:
	$(GO) build -o $(OUT_DIR)/server ./cmd/server
client:
	$(GO) build -o $(OUT_DIR)/client ./cmd/client

# C-библиотека для C++ (требует CGO_ENABLED=1 и C-компилятор)
# Результат: desktop/lib/safegram_core.so (Linux) или safegram_core.dll (Windows) + .h
cbridge:
	@mkdir -p $(LIB_DIR)
	$(GO) build -buildmode=c-shared -o $(LIB_DIR)/safegram_core$(SHARED_EXT) ./$(CBRIDGE_DIR)

# Расширение shared-библиотеи по ОС (задаётся снаружи или по умолчанию)
SHARED_EXT ?= .so
ifeq ($(OS),Windows_NT)
SHARED_EXT = .dll
endif

clean:
	rm -rf $(OUT_DIR) $(LIB_DIR)/safegram_core.*
