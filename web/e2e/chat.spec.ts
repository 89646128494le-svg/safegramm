import { test, expect } from '@playwright/test';

test.describe('Chat Functionality', () => {
  test.beforeEach(async ({ page }) => {
    // Переходим на страницу логина
    await page.goto('/login');
    
    // Ждём загрузки страницы
    await page.waitForLoadState('networkidle');
    
    // Здесь можно добавить логин, если нужен
    // await page.fill('input[name="username"]', 'testuser');
    // await page.fill('input[name="password"]', 'testpass');
    // await page.click('button[type="submit"]');
  });

  test('should display chat list', async ({ page }) => {
    await page.goto('/app/chats');
    await expect(page.locator('.chat-list, [data-testid="chat-list"]')).toBeVisible();
  });

  test('should send a message', async ({ page }) => {
    await page.goto('/app/chats');
    
    // Ждём загрузки чатов
    await page.waitForSelector('.chat-list-item, [data-testid="chat-item"]', { timeout: 5000 }).catch(() => {});
    
    // Кликаем на первый чат (если есть)
    const firstChat = page.locator('.chat-list-item, [data-testid="chat-item"]').first();
    if (await firstChat.count() > 0) {
      await firstChat.click();
      
      // Ждём открытия окна чата
      await page.waitForSelector('.chat-input, [data-testid="chat-input"]', { timeout: 5000 });
      
      // Вводим сообщение
      const input = page.locator('.chat-input, [data-testid="chat-input"]').first();
      await input.fill('Test message');
      
      // Отправляем (Enter или кнопка)
      await input.press('Enter');
      
      // Проверяем, что сообщение появилось
      await expect(page.locator('.message, [data-testid="message"]').last()).toContainText('Test message');
    }
  });

  test('should handle offline mode', async ({ page, context }) => {
    await page.goto('/app/chats');
    
    // Переводим в офлайн режим
    await context.setOffline(true);
    
    // Пытаемся отправить сообщение
    const input = page.locator('.chat-input, [data-testid="chat-input"]').first();
    if (await input.count() > 0) {
      await input.fill('Offline message');
      await input.press('Enter');
      
      // Проверяем, что появилось уведомление об офлайн режиме
      await expect(page.locator('.toast, [data-testid="toast"]')).toContainText(/офлайн|offline/i);
    }
    
    // Возвращаем онлайн
    await context.setOffline(false);
  });
});
