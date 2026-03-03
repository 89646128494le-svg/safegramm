# Build stage
FROM golang:1.23-alpine AS builder

WORKDIR /app

# Меньше нагрузка на сеть при таймаутах; повторные попытки загрузки модулей
ENV GOPROXY=https://proxy.golang.org,direct
ENV GOMAXPROCS=1

# Сначала только go.mod — так сборка работает даже без go.sum в репозитории
COPY go.mod ./
RUN for i in 1 2 3 4 5; do go mod download && break; echo "retry $i..."; sleep 20; done

COPY . .

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

