# SafeGram — только веб-версия

Все функции доступны в веб-приложении. Бэкенд — server-go (Go).

## Быстрый старт

1. **Зависимости**
   ```bash
   npm install
   cd server-go && go mod download && cd ..
   ```

2. **Бэкенд** (в одном терминале)
   ```bash
   npm run server
   ```
   Или: `cd server-go && go run .`  
   Нужны PostgreSQL и Redis (см. `server-go/.env.example`).

3. **Фронтенд** (в другом терминале)
   ```bash
   npm run dev
   ```
   Откроется http://localhost:5173 (или порт из вывода Vite).

4. **Одной командой** (сервер + веб)
   ```bash
   npm run dev:all
   ```

## Сборка для продакшена

```bash
npm run build
```
Собранный сайт в `web/dist/`. Раздавать через любой статический хостинг (Vercel, Netlify, nginx).  
В настройках хостинга или через переменные окружения при сборке задайте `VITE_API_URL` на ваш API (например, туннель или домен server-go).

## Переменные окружения

- **web**: скопируйте `web/.env.example` в `web/.env` и при необходимости измените `VITE_API_URL`.
- **server-go**: скопируйте `server-go/.env.example` в `server-go/.env` и задайте `DATABASE_URL`, `JWT_SECRET`, `REDIS_URL`, `PORT` и т.д.

## Доступные скрипты (корень проекта)

| Команда | Описание |
|--------|----------|
| `npm run dev` | Запуск только веб (Vite) |
| `npm run dev:web` | То же |
| `npm run dev:server` | Запуск только бэкенда (server-go) |
| `npm run dev:all` | Сервер + веб в одном окне |
| `npm run build` | Сборка веб в `web/dist/` |
| `npm run preview` | Превью собранного веб-сайта |
| `npm run server` | Запуск бэкенда (alias для dev:server) |

Все функции (чаты, серверы, контакты, звонки, админка, Safety AI, боты и т.д.) работают в веб-интерфейсе.

---

**Деплой: фронт на Vercel, API на своём ПК** — см. [docs/VERCEL_AND_SERVER_ON_PC.md](docs/VERCEL_AND_SERVER_ON_PC.md).
