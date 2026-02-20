// web/src/store/useStore.ts
import { create } from 'zustand';

interface User {
  id: string;
  username: string;
  avatarUrl?: string;
  status?: 'online' | 'offline' | 'away' | 'dnd' | string;
  statusText?: string;
  email?: string;
  bio?: string;
  plan?: string;
  roles?: string[];
}

interface UIState {
  theme: 'light' | 'dark' | 'red-black' | 'contrast' | 'muted';
  sidebarOpen: boolean;
  notificationsEnabled: boolean;
  proxyUrl: string;
  /** Выйти через X минут неактивности; 0 = выключено */
  autoLogoutMinutes: number;
  /** Звук: сообщения, звонки, упоминания */
  soundMessage: boolean;
  soundCall: boolean;
  soundMention: boolean;
  /** Размер шрифта в чате */
  chatFontSize: 'small' | 'normal' | 'large';
  /** Быстрые ответы (шаблоны фраз) */
  quickReplies: string[];
}

interface AppState {
  user: User | null;
  token: string | null;
  ui: UIState;
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  setTheme: (theme: UIState['theme']) => void;
  setSidebarOpen: (open: boolean) => void;
  setNotificationsEnabled: (enabled: boolean) => void;
  setProxyUrl: (url: string) => void;
  setAutoLogoutMinutes: (v: number) => void;
  setSoundMessage: (v: boolean) => void;
  setSoundCall: (v: boolean) => void;
  setSoundMention: (v: boolean) => void;
  setChatFontSize: (v: UIState['chatFontSize']) => void;
  setQuickReplies: (v: string[]) => void;
  logout: () => void;
}

const load = (key: string, def: string) => (typeof window !== 'undefined' ? localStorage.getItem(key) : null) || def;
const loadNum = (key: string, def: number) => {
  const v = typeof window !== 'undefined' ? localStorage.getItem(key) : null;
  if (v == null) return def;
  const n = parseInt(v, 10);
  return isNaN(n) ? def : n;
};
const loadBool = (key: string, def: boolean) => {
  const v = typeof window !== 'undefined' ? localStorage.getItem(key) : null;
  return v === '1' ? true : v === '0' ? false : def;
};
const loadJson = <T>(key: string, def: T): T => {
  try {
    const v = typeof window !== 'undefined' ? localStorage.getItem(key) : null;
    return v ? JSON.parse(v) : def;
  } catch {
    return def;
  }
};

export const useStore = create<AppState>()((set, get) => ({
  user: null,
  token: typeof window !== 'undefined' ? localStorage.getItem('token') : null,
  ui: {
    theme: (load('theme', 'dark') as UIState['theme']) || 'dark',
    sidebarOpen: true,
    notificationsEnabled: true,
    proxyUrl: load('safegram_proxy_url', ''),
    autoLogoutMinutes: loadNum('safegram_auto_logout', 0),
    soundMessage: loadBool('safegram_sound_message', true),
    soundCall: loadBool('safegram_sound_call', true),
    soundMention: loadBool('safegram_sound_mention', true),
    chatFontSize: (load('safegram_chat_font_size', 'normal') as UIState['chatFontSize']) || 'normal',
    quickReplies: loadJson<string[]>('safegram_quick_replies', ['Ок', 'Спасибо', 'До связи', 'Перезвоню']),
  },
  setUser: (user) => set({ user }),
  setToken: (token) => {
    if (typeof window !== 'undefined') {
      if (token) localStorage.setItem('token', token);
      else localStorage.removeItem('token');
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
  setProxyUrl: (url) => {
    if (typeof window !== 'undefined') {
      if (url) localStorage.setItem('safegram_proxy_url', url);
      else localStorage.removeItem('safegram_proxy_url');
    }
    set((state) => ({ ui: { ...state.ui, proxyUrl: url } }));
  },
  setAutoLogoutMinutes: (v) => {
    if (typeof window !== 'undefined') localStorage.setItem('safegram_auto_logout', String(v));
    set((state) => ({ ui: { ...state.ui, autoLogoutMinutes: v } }));
  },
  setSoundMessage: (v) => {
    if (typeof window !== 'undefined') localStorage.setItem('safegram_sound_message', v ? '1' : '0');
    set((state) => ({ ui: { ...state.ui, soundMessage: v } }));
  },
  setSoundCall: (v) => {
    if (typeof window !== 'undefined') localStorage.setItem('safegram_sound_call', v ? '1' : '0');
    set((state) => ({ ui: { ...state.ui, soundCall: v } }));
  },
  setSoundMention: (v) => {
    if (typeof window !== 'undefined') localStorage.setItem('safegram_sound_mention', v ? '1' : '0');
    set((state) => ({ ui: { ...state.ui, soundMention: v } }));
  },
  setChatFontSize: (v) => {
    if (typeof window !== 'undefined') localStorage.setItem('safegram_chat_font_size', v);
    set((state) => ({ ui: { ...state.ui, chatFontSize: v } }));
  },
  setQuickReplies: (v) => {
    if (typeof window !== 'undefined') localStorage.setItem('safegram_quick_replies', JSON.stringify(v));
    set((state) => ({ ui: { ...state.ui, quickReplies: v } }));
  },
  logout: () => {
    if (typeof window !== 'undefined') localStorage.removeItem('token');
    set({ user: null, token: null });
  },
}));