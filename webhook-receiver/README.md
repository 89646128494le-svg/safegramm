# SafeGram Webhook Receiver

Локальное приложение для получения логов и уведомлений от SafeGram сервера.

## Установка

```bash
cd webhook-receiver
npm install
```

## Запуск

```bash
npm start
```

Сервер запустится на `http://localhost:3000`

## Webhook URL

Для локального использования:
- `http://localhost:3000/webhook`

Для внешнего доступа (если сервер в облаке):
- Используйте ngrok: `ngrok http 3000`
- Или настройте порт-форвардинг на вашем роутере
- Или используйте ваш внешний IP: `http://your-ip:3000/webhook`

## Функции

- ✅ Прием логов от SafeGram сервера
- ✅ Цветной вывод в консоль
- ✅ Сохранение логов в файлы (logs/safegram-YYYY-MM-DD.log)
- ✅ Разные уровни логирования (info, warning, error, debug)
- ✅ API для просмотра логов

## Endpoints

- `GET /` - Информация о сервисе
- `GET /status` - Статус сервиса
- `POST /webhook` - Webhook endpoint для получения логов
- `GET /logs` - Получить логи за сегодня

## Использование

1. Запустите приложение
2. В админ-панели SafeGram укажите webhook URL
3. Логи будут автоматически приходить на ваш ПК
