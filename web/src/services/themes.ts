// Система тем для SafeGram

export interface Theme {
  id: string;
  name: string;
  displayName: string;
  colors: {
    bgPrimary: string;
    bgSecondary: string;
    bgTertiary: string;
    bgCard: string;
    textPrimary: string;
    textSecondary: string;
    accentPrimary: string;
    accentSecondary: string;
    border: string;
    success: string;
    warning: string;
    danger: string;
    info: string;
  };
  backgroundUrl?: string;
  backgroundBlur?: number;
  soundTheme?: string; // ID звуковой темы
  isPublic: boolean;
  category: 'dark' | 'light' | 'colorful' | 'minimal' | 'custom';
}

// Предустановленные темы
export const defaultThemes: Theme[] = [
  // Темные темы
  {
    id: 'dark-classic',
    name: 'dark-classic',
    displayName: 'Классическая темная',
    category: 'dark',
    isPublic: true,
    colors: {
      bgPrimary: '#0b0e13',
      bgSecondary: '#1a1d29',
      bgTertiary: '#252936',
      bgCard: 'rgba(26, 29, 41, 0.8)',
      textPrimary: '#e5e7eb',
      textSecondary: '#9ca3af',
      accentPrimary: '#3b82f6',
      accentSecondary: '#60a5fa',
      border: '#374151',
      success: '#10b981',
      warning: '#f59e0b',
      danger: '#ef4444',
      info: '#3b82f6',
    },
  },
  {
    id: 'dark-blue',
    name: 'dark-blue',
    displayName: 'Синяя темная',
    category: 'dark',
    isPublic: true,
    colors: {
      bgPrimary: '#0a1628',
      bgSecondary: '#132238',
      bgTertiary: '#1e2f47',
      bgCard: 'rgba(19, 34, 56, 0.8)',
      textPrimary: '#e0e7ff',
      textSecondary: '#a5b4fc',
      accentPrimary: '#3b82f6',
      accentSecondary: '#60a5fa',
      border: '#1e3a8a',
      success: '#10b981',
      warning: '#f59e0b',
      danger: '#ef4444',
      info: '#3b82f6',
    },
  },
  {
    id: 'dark-green',
    name: 'dark-green',
    displayName: 'Зеленая темная',
    category: 'dark',
    isPublic: true,
    colors: {
      bgPrimary: '#0a1f0f',
      bgSecondary: '#132e1a',
      bgTertiary: '#1e3d26',
      bgCard: 'rgba(19, 46, 26, 0.8)',
      textPrimary: '#d1fae5',
      textSecondary: '#a7f3d0',
      accentPrimary: '#10b981',
      accentSecondary: '#34d399',
      border: '#065f46',
      success: '#10b981',
      warning: '#f59e0b',
      danger: '#ef4444',
      info: '#3b82f6',
    },
  },
  {
    id: 'dark-purple',
    name: 'dark-purple',
    displayName: 'Фиолетовая темная',
    category: 'dark',
    isPublic: true,
    colors: {
      bgPrimary: '#1a0a2e',
      bgSecondary: '#2d1b4e',
      bgTertiary: '#3d2a5e',
      bgCard: 'rgba(45, 27, 78, 0.8)',
      textPrimary: '#e9d5ff',
      textSecondary: '#d8b4fe',
      accentPrimary: '#a855f7',
      accentSecondary: '#c084fc',
      border: '#6b21a8',
      success: '#10b981',
      warning: '#f59e0b',
      danger: '#ef4444',
      info: '#3b82f6',
    },
  },
  {
    id: 'dark-red',
    name: 'dark-red',
    displayName: 'Красная темная (Redux)',
    category: 'dark',
    isPublic: true,
    colors: {
      bgPrimary: '#1a0a0a',
      bgSecondary: '#2d1b1b',
      bgTertiary: '#3d2a2a',
      bgCard: 'rgba(45, 27, 27, 0.8)',
      textPrimary: '#fee2e2',
      textSecondary: '#fecaca',
      accentPrimary: '#ef4444',
      accentSecondary: '#f87171',
      border: '#7f1d1d',
      success: '#10b981',
      warning: '#f59e0b',
      danger: '#ef4444',
      info: '#3b82f6',
    },
    soundTheme: 'redux',
  },
  {
    id: 'dark-orange',
    name: 'dark-orange',
    displayName: 'Оранжевая темная',
    category: 'dark',
    isPublic: true,
    colors: {
      bgPrimary: '#1a0f0a',
      bgSecondary: '#2d1f1b',
      bgTertiary: '#3d2f2a',
      bgCard: 'rgba(45, 31, 27, 0.8)',
      textPrimary: '#fed7aa',
      textSecondary: '#fdba74',
      accentPrimary: '#f97316',
      accentSecondary: '#fb923c',
      border: '#7c2d12',
      success: '#10b981',
      warning: '#f59e0b',
      danger: '#ef4444',
      info: '#3b82f6',
    },
  },
  // Светлые темы
  {
    id: 'light-classic',
    name: 'light-classic',
    displayName: 'Классическая светлая',
    category: 'light',
    isPublic: true,
    colors: {
      bgPrimary: '#ffffff',
      bgSecondary: '#f9fafb',
      bgTertiary: '#f3f4f6',
      bgCard: 'rgba(255, 255, 255, 0.9)',
      textPrimary: '#111827',
      textSecondary: '#6b7280',
      accentPrimary: '#3b82f6',
      accentSecondary: '#60a5fa',
      border: '#e5e7eb',
      success: '#10b981',
      warning: '#f59e0b',
      danger: '#ef4444',
      info: '#3b82f6',
    },
  },
  {
    id: 'light-blue',
    name: 'light-blue',
    displayName: 'Синяя светлая',
    category: 'light',
    isPublic: true,
    colors: {
      bgPrimary: '#eff6ff',
      bgSecondary: '#dbeafe',
      bgTertiary: '#bfdbfe',
      bgCard: 'rgba(255, 255, 255, 0.9)',
      textPrimary: '#1e3a8a',
      textSecondary: '#3b82f6',
      accentPrimary: '#2563eb',
      accentSecondary: '#3b82f6',
      border: '#93c5fd',
      success: '#10b981',
      warning: '#f59e0b',
      danger: '#ef4444',
      info: '#3b82f6',
    },
  },
  // Яркие темы
  {
    id: 'colorful-rainbow',
    name: 'colorful-rainbow',
    displayName: 'Радужная',
    category: 'colorful',
    isPublic: true,
    colors: {
      bgPrimary: '#0f0c29',
      bgSecondary: '#302b63',
      bgTertiary: '#24243e',
      bgCard: 'rgba(48, 43, 99, 0.8)',
      textPrimary: '#ffffff',
      textSecondary: '#e0e0e0',
      accentPrimary: '#ff6b6b',
      accentSecondary: '#4ecdc4',
      border: '#6c5ce7',
      success: '#51cf66',
      warning: '#ffd93d',
      danger: '#ff6b6b',
      info: '#4ecdc4',
    },
  },
  {
    id: 'colorful-neon',
    name: 'colorful-neon',
    displayName: 'Неоновая',
    category: 'colorful',
    isPublic: true,
    colors: {
      bgPrimary: '#000000',
      bgSecondary: '#1a0033',
      bgTertiary: '#330066',
      bgCard: 'rgba(26, 0, 51, 0.9)',
      textPrimary: '#00ffff',
      textSecondary: '#ff00ff',
      accentPrimary: '#00ff00',
      accentSecondary: '#ffff00',
      border: '#ff00ff',
      success: '#00ff00',
      warning: '#ffff00',
      danger: '#ff00ff',
      info: '#00ffff',
    },
  },
  // Минималистичные темы
  {
    id: 'minimal-gray',
    name: 'minimal-gray',
    displayName: 'Минималистичная серая',
    category: 'minimal',
    isPublic: true,
    colors: {
      bgPrimary: '#fafafa',
      bgSecondary: '#f5f5f5',
      bgTertiary: '#eeeeee',
      bgCard: 'rgba(255, 255, 255, 0.95)',
      textPrimary: '#212121',
      textSecondary: '#757575',
      accentPrimary: '#424242',
      accentSecondary: '#616161',
      border: '#e0e0e0',
      success: '#4caf50',
      warning: '#ff9800',
      danger: '#f44336',
      info: '#2196f3',
    },
  },
  {
    id: 'minimal-black',
    name: 'minimal-black',
    displayName: 'Минималистичная черная',
    category: 'minimal',
    isPublic: true,
    colors: {
      bgPrimary: '#000000',
      bgSecondary: '#1a1a1a',
      bgTertiary: '#2a2a2a',
      bgCard: 'rgba(26, 26, 26, 0.95)',
      textPrimary: '#ffffff',
      textSecondary: '#b0b0b0',
      accentPrimary: '#ffffff',
      accentSecondary: '#e0e0e0',
      border: '#404040',
      success: '#4caf50',
      warning: '#ff9800',
      danger: '#f44336',
      info: '#2196f3',
    },
  },
];

// Применение темы к документу
export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  
  // Применяем цвета
  root.style.setProperty('--bg-primary', theme.colors.bgPrimary);
  root.style.setProperty('--bg-secondary', theme.colors.bgSecondary);
  root.style.setProperty('--bg-tertiary', theme.colors.bgTertiary);
  root.style.setProperty('--bg-card', theme.colors.bgCard);
  root.style.setProperty('--text-primary', theme.colors.textPrimary);
  root.style.setProperty('--text-secondary', theme.colors.textSecondary);
  root.style.setProperty('--accent-primary', theme.colors.accentPrimary);
  root.style.setProperty('--accent-secondary', theme.colors.accentSecondary);
  root.style.setProperty('--border', theme.colors.border);
  root.style.setProperty('--success', theme.colors.success);
  root.style.setProperty('--warning', theme.colors.warning);
  root.style.setProperty('--danger', theme.colors.danger);
  root.style.setProperty('--info', theme.colors.info);
  
  // Применяем фон
  if (theme.backgroundUrl) {
    document.body.style.backgroundImage = `url(${theme.backgroundUrl})`;
    document.body.style.backgroundSize = 'cover';
    document.body.style.backgroundPosition = 'center';
    document.body.style.backgroundRepeat = 'no-repeat';
    if (theme.backgroundBlur) {
      document.body.style.backdropFilter = `blur(${theme.backgroundBlur}px)`;
    }
  } else {
    document.body.style.backgroundImage = '';
    document.body.style.backdropFilter = '';
  }
  
  // Сохраняем в localStorage
  localStorage.setItem('selectedTheme', theme.id);
  
  // Применяем звуковую тему если есть
  if (theme.soundTheme) {
    localStorage.setItem('soundTheme', theme.soundTheme);
    // Применяем звуковую тему к настройкам уведомлений
    const notificationSettings = JSON.parse(localStorage.getItem('notificationSettings') || '{}');
    const soundThemeMap: Record<string, string> = {
      'redux': 'alert',
      'default': 'default',
      'gentle': 'gentle',
      'modern': 'modern',
    };
    const mappedSound = soundThemeMap[theme.soundTheme] || theme.soundTheme;
    notificationSettings.soundType = mappedSound;
    notificationSettings.soundMessage = mappedSound;
    notificationSettings.soundCall = mappedSound;
    localStorage.setItem('notificationSettings', JSON.stringify(notificationSettings));
  }
}

// Получение текущей темы
export function getCurrentTheme(): Theme | null {
  const themeId = localStorage.getItem('selectedTheme');
  if (!themeId) return null;
  
  const theme = defaultThemes.find(t => t.id === themeId);
  if (theme) return theme;
  
  // Загружаем кастомную тему из localStorage
  const customThemes = getCustomThemes();
  return customThemes.find(t => t.id === themeId) || null;
}

// Получение всех кастомных тем
export function getCustomThemes(): Theme[] {
  const stored = localStorage.getItem('customThemes');
  if (!stored) return [];
  try {
    return JSON.parse(stored);
  } catch {
    return [];
  }
}

// Сохранение кастомной темы
export function saveCustomTheme(theme: Theme): void {
  const customThemes = getCustomThemes();
  const existingIndex = customThemes.findIndex(t => t.id === theme.id);
  
  if (existingIndex >= 0) {
    customThemes[existingIndex] = theme;
  } else {
    customThemes.push(theme);
  }
  
  localStorage.setItem('customThemes', JSON.stringify(customThemes));
}

// Удаление кастомной темы
export function deleteCustomTheme(themeId: string): void {
  const customThemes = getCustomThemes();
  const filtered = customThemes.filter(t => t.id !== themeId);
  localStorage.setItem('customThemes', JSON.stringify(filtered));
}

// Получение всех тем (предустановленные + кастомные)
export function getAllThemes(): Theme[] {
  return [...defaultThemes, ...getCustomThemes()];
}

// Сброс к дефолтной теме
export function resetTheme(): void {
  const root = document.documentElement;
  root.style.removeProperty('--bg-primary');
  root.style.removeProperty('--bg-secondary');
  root.style.removeProperty('--bg-tertiary');
  root.style.removeProperty('--bg-card');
  root.style.removeProperty('--text-primary');
  root.style.removeProperty('--text-secondary');
  root.style.removeProperty('--accent-primary');
  root.style.removeProperty('--accent-secondary');
  root.style.removeProperty('--border');
  root.style.removeProperty('--success');
  root.style.removeProperty('--warning');
  root.style.removeProperty('--danger');
  root.style.removeProperty('--info');
  document.body.style.backgroundImage = '';
  document.body.style.backdropFilter = '';
  localStorage.removeItem('selectedTheme');
}
