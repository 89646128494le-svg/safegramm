// Настройки внешнего вида

export interface AppearanceSettings {
  fontSize: 'small' | 'medium' | 'large' | 'xlarge';
  compactMode: boolean;
  showAvatars: boolean;
  animationsEnabled: boolean;
  chatBackgrounds: Record<string, string>; // chatId -> backgroundUrl
  chatColors: Record<string, string>; // chatId -> color
}

const defaultAppearance: AppearanceSettings = {
  fontSize: 'medium',
  compactMode: false,
  showAvatars: true,
  animationsEnabled: true,
  chatBackgrounds: {},
  chatColors: {},
};

// Загрузка настроек внешнего вида
export function loadAppearanceSettings(): AppearanceSettings {
  const stored = localStorage.getItem('appearanceSettings');
  if (!stored) return defaultAppearance;
  
  try {
    const parsed = JSON.parse(stored);
    return { ...defaultAppearance, ...parsed };
  } catch {
    return defaultAppearance;
  }
}

// Сохранение настроек внешнего вида
export function saveAppearanceSettings(settings: AppearanceSettings): void {
  localStorage.setItem('appearanceSettings', JSON.stringify(settings));
  applyAppearanceSettings(settings);
}

// Применение настроек внешнего вида
export function applyAppearanceSettings(settings: AppearanceSettings): void {
  const root = document.documentElement;
  
  // Размер шрифта
  const fontSizeMap = {
    small: '12px',
    medium: '14px',
    large: '16px',
    xlarge: '18px',
  };
  root.style.setProperty('--font-size-base', fontSizeMap[settings.fontSize]);
  
  // Компактный режим
  if (settings.compactMode) {
    root.setAttribute('data-compact', 'true');
    root.style.setProperty('--spacing-sm', '4px');
    root.style.setProperty('--spacing-md', '8px');
    root.style.setProperty('--spacing-lg', '12px');
    root.style.setProperty('--radius-sm', '4px');
    root.style.setProperty('--radius-md', '6px');
  } else {
    root.removeAttribute('data-compact');
    root.style.removeProperty('--spacing-sm');
    root.style.removeProperty('--spacing-md');
    root.style.removeProperty('--spacing-lg');
    root.style.removeProperty('--radius-sm');
    root.style.removeProperty('--radius-md');
  }
  
  // Анимации
  if (!settings.animationsEnabled) {
    root.setAttribute('data-no-animations', 'true');
  } else {
    root.removeAttribute('data-no-animations');
  }
}

// Установка фона для чата
export function setChatBackground(chatId: string, backgroundUrl: string | null): void {
  const settings = loadAppearanceSettings();
  if (backgroundUrl) {
    settings.chatBackgrounds[chatId] = backgroundUrl;
  } else {
    delete settings.chatBackgrounds[chatId];
  }
  saveAppearanceSettings(settings);
}

// Получение фона чата
export function getChatBackground(chatId: string): string | null {
  const settings = loadAppearanceSettings();
  return settings.chatBackgrounds[chatId] || null;
}

// Установка цвета для чата
export function setChatColor(chatId: string, color: string | null): void {
  const settings = loadAppearanceSettings();
  if (color) {
    settings.chatColors[chatId] = color;
  } else {
    delete settings.chatColors[chatId];
  }
  saveAppearanceSettings(settings);
}

// Получение цвета чата
export function getChatColor(chatId: string): string | null {
  const settings = loadAppearanceSettings();
  return settings.chatColors[chatId] || null;
}

// Инициализация настроек при загрузке
export function initAppearance(): void {
  const settings = loadAppearanceSettings();
  applyAppearanceSettings(settings);
  
  const theme = require('./themes').getCurrentTheme();
  if (theme) {
    require('./themes').applyTheme(theme);
  }
}
