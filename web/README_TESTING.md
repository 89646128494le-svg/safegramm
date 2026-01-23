# Руководство по тестированию SafeGram

## Установка зависимостей

```bash
npm install
```

## Unit тесты (Jest)

Запуск всех unit тестов:
```bash
npm test
```

Запуск в режиме watch:
```bash
npm run test:watch
```

Запуск с покрытием кода:
```bash
npm run test:coverage
```

### Структура тестов

- `src/__tests__/` - директория с unit тестами
  - `i18n.test.ts` - тесты системы локализации
  - `ConnectionStatus.test.tsx` - тесты компонента статуса соединения
  - `VirtualizedMessages.test.tsx` - тесты виртуализированного списка сообщений
  - `offlineQueue.test.ts` - тесты офлайн очереди

## E2E тесты (Playwright)

Запуск всех E2E тестов:
```bash
npm run test:e2e
```

Запуск с UI:
```bash
npm run test:e2e:ui
```

Запуск в режиме отладки:
```bash
npm run test:e2e:debug
```

### Структура E2E тестов

- `e2e/` - директория с E2E тестами
  - `chat.spec.ts` - тесты функциональности чата
  - `navigation.spec.ts` - тесты навигации
  - `i18n.spec.ts` - тесты локализации

### Браузеры

Тесты запускаются в следующих браузерах:
- Chromium (Desktop)
- Firefox (Desktop)
- WebKit/Safari (Desktop)
- Mobile Chrome (Pixel 5)
- Mobile Safari (iPhone 12)

## Написание новых тестов

### Unit тесты

```typescript
import { render, screen } from '@testing-library/react';
import MyComponent from '../components/MyComponent';

describe('MyComponent', () => {
  test('should render correctly', () => {
    render(<MyComponent />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });
});
```

### E2E тесты

```typescript
import { test, expect } from '@playwright/test';

test('should do something', async ({ page }) => {
  await page.goto('/app/chats');
  await expect(page.locator('.chat-list')).toBeVisible();
});
```

## Покрытие кода

Целевое покрытие:
- Branches: 50%
- Functions: 50%
- Lines: 50%
- Statements: 50%

Текущее покрытие можно проверить командой `npm run test:coverage`.
