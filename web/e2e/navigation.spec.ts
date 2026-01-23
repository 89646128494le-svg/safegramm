import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test('should navigate between pages', async ({ page }) => {
    await page.goto('/app/chats');
    
    // Проверяем навигацию
    const navLinks = [
      { text: /чаты|chats/i, path: '/app/chats' },
      { text: /контакты|contacts/i, path: '/app/contacts' },
      { text: /поиск|search/i, path: '/app/search' },
      { text: /настройки|settings/i, path: '/app/settings' },
    ];

    for (const link of navLinks) {
      const navButton = page.getByRole('link', { name: link.text });
      if (await navButton.count() > 0) {
        await navButton.click();
        await expect(page).toHaveURL(new RegExp(link.path));
      }
    }
  });

  test('should handle mobile navigation', async ({ page, isMobile }) => {
    if (!isMobile) {
      test.skip();
    }

    await page.goto('/app/chats');
    
    // Проверяем, что мобильное меню скрыто
    const sidebar = page.locator('.nav-sidebar, [data-testid="nav-sidebar"]');
    if (await sidebar.count() > 0) {
      await expect(sidebar).not.toHaveClass(/open/);
      
      // Открываем меню
      const menuButton = page.locator('button[aria-label*="menu"], .menu-button').first();
      if (await menuButton.count() > 0) {
        await menuButton.click();
        await expect(sidebar).toHaveClass(/open/);
      }
    }
  });
});
