@echo off
set DATABASE_URL=postgres://safegram:safegram@localhost:5432/safegram?sslmode=disable
set REDIS_URL=localhost:6379
set JWT_SECRET=dev-secret-test-change-in-production
set PORT=8080
echo Запуск SafeGram Go сервера...
go run main.go

