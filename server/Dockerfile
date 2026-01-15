FROM node:20-alpine

WORKDIR /app

# Устанавливаем зависимости
COPY package*.json ./
RUN apk add --no-cache openssl1.1-compat || apk add --no-cache openssl
RUN npm install

# Копируем весь сервер (включая prisma/schema.prisma)
COPY . .

# Генерируем Prisma Client (не критично, если схемы нет)
RUN npx prisma generate --schema prisma/schema.prisma || true

ENV NODE_ENV=production \
    PORT=8080

EXPOSE 8080

CMD ["node", "src/index.js"]
