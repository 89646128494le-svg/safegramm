# Руководство по локализации SafeGram

## Обзор

SafeGram использует систему интернационализации (i18n) для поддержки нескольких языков. В настоящее время поддерживаются:
- Русский (ru) - по умолчанию
- Английский (en)

## Использование в компонентах

### Базовое использование

```typescript
import { useTranslation } from '../i18n';

function MyComponent() {
  const { t } = useTranslation();
  
  return (
    <div>
      <h1>{t('chat.title')}</h1>
      <button>{t('common.send')}</button>
    </div>
  );
}
```

### С параметрами

```typescript
const { t } = useTranslation();

// В переводе: "Ожидающих сообщений: {count}"
const message = t('offline.pendingMessages', { count: 5 });
// Результат: "Ожидающих сообщений: 5"
```

### Форматирование дат и времени

```typescript
const { formatDate, formatTime, formatRelativeTime } = useTranslation();

const date = new Date();
formatDate(date); // "15 января 2024 г."
formatTime(date); // "14:30"
formatRelativeTime(date); // "2 часа назад"
```

### Переключение языка

```typescript
const { locale, changeLocale } = useTranslation();

// Текущий язык
console.log(locale); // 'ru' или 'en'

// Переключить на английский
changeLocale('en');
```

## Структура переводов

Переводы организованы по категориям:

- `common.*` - общие строки (кнопки, действия)
- `chat.*` - чаты и сообщения
- `group.*` - группы и каналы
- `call.*` - звонки
- `settings.*` - настройки
- `notification.*` - уведомления
- `security.*` - безопасность
- `offline.*` - офлайн режим
- `export.*` - экспорт и резервное копирование
- `statistics.*` - статистика
- `bot.*` - боты
- `calendar.*` - календарь
- `todo.*` - задачи
- `errors.*` - ошибки
- `auth.*` - аутентификация

## Добавление нового языка

1. Создайте файл `web/src/i18n/locales/[code].ts`:

```typescript
export const de = {
  common: {
    loading: 'Lädt...',
    // ... остальные переводы
  },
  // ... остальные категории
};
```

2. Импортируйте в `web/src/i18n/index.ts`:

```typescript
import { de } from './locales/de';
const translations = {
  ru,
  en,
  de
};
```

3. Обновите тип `Locale`:

```typescript
export type Locale = 'ru' | 'en' | 'de';
```

## Добавление новых ключей перевода

1. Добавьте ключ во все файлы локализации (`ru.ts`, `en.ts`, и т.д.)
2. Используйте ключ в компонентах через `t('category.key')`

## Автоматическое определение языка

Система автоматически определяет язык браузера при первом запуске:
- Если язык браузера начинается с 'ru', выбирается русский
- Иначе выбирается английский

Язык сохраняется в `localStorage` и сохраняется между сессиями.

## Локализация дат и времени

Система использует `Intl.DateTimeFormat` для форматирования дат и времени в соответствии с выбранным языком.

### Примеры

```typescript
// Русский
formatDate(new Date('2024-01-15')); 
// "15 января 2024 г."

// Английский
formatDate(new Date('2024-01-15')); 
// "January 15, 2024"
```

## Плюрализация

Для русского языка автоматически применяется правильная форма множественного числа:

```typescript
// 1 минута назад
formatRelativeTime(oneMinuteAgo); // "1 минуту назад"

// 2 минуты назад
formatRelativeTime(twoMinutesAgo); // "2 минуты назад"

// 5 минут назад
formatRelativeTime(fiveMinutesAgo); // "5 минут назад"
```
