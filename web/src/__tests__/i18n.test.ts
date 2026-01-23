import { i18n } from '../i18n';

describe('i18n', () => {
  beforeEach(() => {
    localStorage.clear();
    i18n.setLocale('ru');
  });

  test('should return Russian translation by default', () => {
    expect(i18n.t('common.loading')).toBe('Загрузка...');
    expect(i18n.t('chat.title')).toBe('Чаты');
  });

  test('should switch to English', () => {
    i18n.setLocale('en');
    expect(i18n.t('common.loading')).toBe('Loading...');
    expect(i18n.t('chat.title')).toBe('Chats');
  });

  test('should replace parameters in translations', () => {
    expect(i18n.t('offline.pendingMessages', { count: 5 })).toBe('Ожидающих сообщений: 5');
    
    i18n.setLocale('en');
    expect(i18n.t('offline.pendingMessages', { count: 3 })).toBe('Pending messages: 3');
  });

  test('should format dates correctly', () => {
    const date = new Date('2024-01-15');
    const formatted = i18n.formatDate(date);
    expect(formatted).toContain('2024');
    
    i18n.setLocale('en');
    const formattedEn = i18n.formatDate(date);
    expect(formattedEn).toContain('2024');
  });

  test('should format relative time', () => {
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
    
    const relative = i18n.formatRelativeTime(fiveMinutesAgo);
    expect(relative).toContain('минут');
    
    i18n.setLocale('en');
    const relativeEn = i18n.formatRelativeTime(fiveMinutesAgo);
    expect(relativeEn).toContain('minutes');
  });

  test('should return key if translation not found', () => {
    const result = i18n.t('nonexistent.key' as any);
    expect(result).toBe('nonexistent.key');
  });
});
