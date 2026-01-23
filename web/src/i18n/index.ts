import { ru } from './locales/ru';
import { en } from './locales/en';

export type Locale = 'ru' | 'en';

export type TranslationKey = 
  | keyof typeof ru.common
  | `chat.${keyof typeof ru.chat}`
  | `group.${keyof typeof ru.group}`
  | `call.${keyof typeof ru.call}`
  | `settings.${keyof typeof ru.settings}`
  | `notification.${keyof typeof ru.notification}`
  | `security.${keyof typeof ru.security}`
  | `offline.${keyof typeof ru.offline}`
  | `export.${keyof typeof ru.export}`
  | `statistics.${keyof typeof ru.statistics}`
  | `bot.${keyof typeof ru.bot}`
  | `calendar.${keyof typeof ru.calendar}`
  | `todo.${keyof typeof ru.todo}`
  | `errors.${keyof typeof ru.errors}`
  | `auth.${keyof typeof ru.auth}`;

const translations = {
  ru,
  en
};

// Получаем язык из localStorage или определяем по браузеру
const getBrowserLocale = (): Locale => {
  const stored = localStorage.getItem('locale') as Locale;
  if (stored && (stored === 'ru' || stored === 'en')) {
    return stored;
  }
  
  const browserLang = navigator.language.toLowerCase();
  if (browserLang.startsWith('ru')) {
    return 'ru';
  }
  return 'en';
};

// Создаём контекст для i18n
class I18n {
  private locale: Locale = getBrowserLocale();

  setLocale(locale: Locale) {
    this.locale = locale;
    localStorage.setItem('locale', locale);
    // Обновляем lang в HTML
    document.documentElement.lang = locale;
  }

  getLocale(): Locale {
    return this.locale;
  }

  t(key: TranslationKey, params?: Record<string, string | number>): string {
    const keys = key.split('.');
    let value: any = translations[this.locale];

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        console.warn(`Translation key not found: ${key}`);
        return key;
      }
    }

    if (typeof value !== 'string') {
      console.warn(`Translation value is not a string: ${key}`);
      return key;
    }

    // Заменяем параметры в строке {param}
    if (params) {
      return value.replace(/\{(\w+)\}/g, (match, paramKey) => {
        return params[paramKey]?.toString() || match;
      });
    }

    return value;
  }

  // Форматирование дат
  formatDate(date: Date | number, options?: Intl.DateTimeFormatOptions): string {
    const dateObj = date instanceof Date ? date : new Date(date);
    return new Intl.DateTimeFormat(this.locale === 'ru' ? 'ru-RU' : 'en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      ...options
    }).format(dateObj);
  }

  // Форматирование времени
  formatTime(date: Date | number, options?: Intl.DateTimeFormatOptions): string {
    const dateObj = date instanceof Date ? date : new Date(date);
    return new Intl.DateTimeFormat(this.locale === 'ru' ? 'ru-RU' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit',
      ...options
    }).format(dateObj);
  }

  // Форматирование относительного времени (например, "2 часа назад")
  formatRelativeTime(date: Date | number): string {
    const dateObj = date instanceof Date ? date : new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - dateObj.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (this.locale === 'ru') {
      if (diffSec < 60) return 'только что';
      if (diffMin < 60) return `${diffMin} ${this.pluralize(diffMin, 'минуту', 'минуты', 'минут')} назад`;
      if (diffHour < 24) return `${diffHour} ${this.pluralize(diffHour, 'час', 'часа', 'часов')} назад`;
      if (diffDay < 7) return `${diffDay} ${this.pluralize(diffDay, 'день', 'дня', 'дней')} назад`;
      return this.formatDate(dateObj);
    } else {
      if (diffSec < 60) return 'just now';
      if (diffMin < 60) return `${diffMin} ${diffMin === 1 ? 'minute' : 'minutes'} ago`;
      if (diffHour < 24) return `${diffHour} ${diffHour === 1 ? 'hour' : 'hours'} ago`;
      if (diffDay < 7) return `${diffDay} ${diffDay === 1 ? 'day' : 'days'} ago`;
      return this.formatDate(dateObj);
    }
  }

  // Плюрализация для русского языка
  private pluralize(count: number, one: string, few: string, many: string): string {
    if (this.locale !== 'ru') return one;
    
    const mod10 = count % 10;
    const mod100 = count % 100;
    
    if (mod10 === 1 && mod100 !== 11) return one;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
    return many;
  }
}

// Экспортируем singleton
export const i18n = new I18n();

// React hook для использования в компонентах
import { useState, useEffect } from 'react';

export function useTranslation() {
  const [locale, setLocaleState] = useState<Locale>(i18n.getLocale());

  useEffect(() => {
    // Слушаем изменения локали
    const handleStorageChange = () => {
      setLocaleState(i18n.getLocale());
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const t = (key: TranslationKey, params?: Record<string, string | number>) => {
    return i18n.t(key, params);
  };

  const changeLocale = (newLocale: Locale) => {
    i18n.setLocale(newLocale);
    setLocaleState(newLocale);
    // Принудительно обновляем компоненты
    window.dispatchEvent(new Event('localechange'));
  };

  return {
    t,
    locale,
    changeLocale,
    formatDate: (date: Date | number, options?: Intl.DateTimeFormatOptions) => i18n.formatDate(date, options),
    formatTime: (date: Date | number, options?: Intl.DateTimeFormatOptions) => i18n.formatTime(date, options),
    formatRelativeTime: (date: Date | number) => i18n.formatRelativeTime(date)
  };
}

// Инициализация при загрузке
if (typeof window !== 'undefined') {
  document.documentElement.lang = i18n.getLocale();
}
