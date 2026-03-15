// web/src/store/useStore.ts
import { create } from 'zustand';
import { safeGetItem, safeRemoveItem, safeSetItem } from '../lib/safeStorage'; // Исправлен импорт (было import create from ...)

interface User {
  id: string;
  username: string;
  avatarUrl?: string;
  status?: 'online' | 'offline';
  email?: string;
  bio?: string;
  plan?: string;
  isPremium?: boolean;
  premiumStatus?: string;
  premiumExpiresAt?: string | null;
  premiumSource?: string;
}

interface UIState {
  theme: 'light' | 'dark' | 'red-black';
  sidebarOpen: boolean;
  notificationsEnabled: boolean;
  stealthMode: boolean;
  /** URL прокси для API/WebSocket (как в Telegram). Пусто = прямое подключение. */
  proxyUrl: string;
}

export interface MaintenanceStatus {
  isActive: boolean;
  message?: string;
  timestamp?: string;
  id?: string;
}

interface AppState {
  user: User | null;
  token: string | null;
  ui: UIState;
  /** Статус техработ с API — обновляется в реальном времени (поллинг + событие). */
  maintenance: MaintenanceStatus | null;
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  setTheme: (theme: UIState['theme']) => void;
  setSidebarOpen: (open: boolean) => void;
  setNotificationsEnabled: (enabled: boolean) => void;
  setStealthMode: (enabled: boolean) => void;
  setProxyUrl: (url: string) => void;
  setMaintenance: (data: MaintenanceStatus | null) => void;
  logout: () => void;
}

export const useStore = create<AppState>()((set) => ({
  user: null,
  token: safeGetItem('token'),
  maintenance: null,
  ui: {
    theme: (safeGetItem('theme') as UIState['theme'] | null) || 'dark',
    sidebarOpen: true,
    notificationsEnabled: true,
    stealthMode: safeGetItem('safegram_stealth_mode') === '1',
    proxyUrl: safeGetItem('safegram_proxy_url') || '',
  },
  setUser: (user) => set({ user }),
  setToken: (token) => {
    if (token) {
      safeSetItem('token', token);
    } else {
      safeRemoveItem('token');
    }
    set({ token });
  },
  setTheme: (theme) => {
    if (typeof window !== 'undefined') {
      safeSetItem('theme', theme);
      document.documentElement.setAttribute('data-theme', theme);
    }
    set((state) => ({ ui: { ...state.ui, theme } }));
  },
  setSidebarOpen: (open) => set((state) => ({ ui: { ...state.ui, sidebarOpen: open } })),
  setNotificationsEnabled: (enabled) => set((state) => ({ ui: { ...state.ui, notificationsEnabled: enabled } })),
  setStealthMode: (enabled) => {
    if (enabled) safeSetItem('safegram_stealth_mode', '1');
    else safeRemoveItem('safegram_stealth_mode');
    set((state) => ({ ui: { ...state.ui, stealthMode: enabled } }));
  },
  setProxyUrl: (url) => {
    if (url) safeSetItem('safegram_proxy_url', url);
    else safeRemoveItem('safegram_proxy_url');
    set((state) => ({ ui: { ...state.ui, proxyUrl: url } }));
  },
  setMaintenance: (data) => set({ maintenance: data }),
  logout: () => {
    safeRemoveItem('token');
    set({ user: null, token: null });
  },
}));
