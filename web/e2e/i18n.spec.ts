import { test, expect } from '@playwright/test';

test.describe('Localization', () => {
  test('should switch language', async ({ page }) => {
    await page.goto('/app/settings');
    
    // Ищем селектор языка
    const langSelector = page.locator('select, [data-testid="language-selector"]').first();
    
    if (await langSelector.count() > 0) {
      // Переключаем на английский
      await langSelector.selectOption('en');
      
      // Проверяем, что текст изменился
      await expect(page.locator('body')).toContainText(/settings|chats/i);
      
      // Переключаем обратно на русский
      await langSelector.selectOption('ru');
      
      // Проверяем, что текст вернулся
      await expect(page.locator('body')).toContainText(/настройки|чаты/i);
    }
  });

  test('should persist language preference', async ({ page, context }) => {
    await page.goto('/app/settings');
    
    const langSelector = page.locator('select, [data-testid="language-selector"]').first();
    
    if (await langSelector.count() > 0) {
      // Устанавливаем английский
      await langSelector.selectOption('en');
      
      // Перезагружаем страницу
      await page.reload();
      
      // Проверяем, что язык сохранился
      const selectedValue = await langSelector.inputValue();
      expect(selectedValue).toBe('en');
    }
  });
});
