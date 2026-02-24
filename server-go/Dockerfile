# Build stage
FROM golang:1.23-alpine AS builder

WORKDIR /app

# Копируем go.mod (go.sum может быть в .gitignore — не обязателен для сборки)
COPY go.mod ./
RUN go mod download

# Копируем исходный код
COPY . .

# Генерируем go.sum и собираем с минимальным параллелизмом (меньше RAM на VPS)
ENV GOMAXPROCS=1
RUN go mod tidy && CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -p 1 -o main .

# Final stage
FROM alpine:latest

RUN apk --no-cache add ca-certificates wget

WORKDIR /app

# Копируем бинарник из builder stage
COPY --from=builder /app/main .

RUN mkdir -p /app/uploads /app/logs

EXPOSE 8080

CMD ["./main"]

