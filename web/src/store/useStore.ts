// web/src/store/useStore.ts
import { create } from 'zustand'; // Исправлен импорт (было import create from ...)

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
  token: typeof window !== 'undefined' ? localStorage.getItem('token') : null,
  maintenance: null,
  ui: {
    theme: (typeof window !== 'undefined' ? localStorage.getItem('theme') : null) as UIState['theme'] || 'dark',
    sidebarOpen: true,
    notificationsEnabled: true,
    stealthMode: typeof window !== 'undefined' ? localStorage.getItem('safegram_stealth_mode') === '1' : false,
    proxyUrl: typeof window !== 'undefined' ? (localStorage.getItem('safegram_proxy_url') || '') : '',
  },
  setUser: (user) => set({ user }),
  setToken: (token) => {
    if (typeof window !== 'undefined') {
      if (token) {
        localStorage.setItem('token', token);
      } else {
        localStorage.removeItem('token');
      }
    }
    set({ token });
  },
  setTheme: (theme) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('theme', theme);
      document.documentElement.setAttribute('data-theme', theme);
    }
    set((state) => ({ ui: { ...state.ui, theme } }));
  },
  setSidebarOpen: (open) => set((state) => ({ ui: { ...state.ui, sidebarOpen: open } })),
  setNotificationsEnabled: (enabled) => set((state) => ({ ui: { ...state.ui, notificationsEnabled: enabled } })),
  setStealthMode: (enabled) => {
    if (typeof window !== 'undefined') {
      if (enabled) localStorage.setItem('safegram_stealth_mode', '1');
      else localStorage.removeItem('safegram_stealth_mode');
    }
    set((state) => ({ ui: { ...state.ui, stealthMode: enabled } }));
  },
  setProxyUrl: (url) => {
    if (typeof window !== 'undefined') {
      if (url) localStorage.setItem('safegram_proxy_url', url);
      else localStorage.removeItem('safegram_proxy_url');
    }
    set((state) => ({ ui: { ...state.ui, proxyUrl: url } }));
  },
  setMaintenance: (data) => set({ maintenance: data }),
  logout: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
    }
    set({ user: null, token: null });
  },
}));
