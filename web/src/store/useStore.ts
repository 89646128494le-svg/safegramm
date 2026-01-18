import { create } from 'zustand';

interface User {
  id: string;
  username: string;
  avatarUrl?: string;
  status?: 'online' | 'offline';
  email?: string;
  bio?: string;
}

interface UIState {
  theme: 'light' | 'dark' | 'red-black';
  sidebarOpen: boolean;
  notificationsEnabled: boolean;
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
  logout: () => void;
}

export const useStore = create<AppState>()((set) => ({
  user: null,
  token: typeof window !== 'undefined' ? localStorage.getItem('token') : null,
  ui: {
    theme: (typeof window !== 'undefined' ? localStorage.getItem('theme') : null) as UIState['theme'] || 'dark',
    sidebarOpen: true,
    notificationsEnabled: true,
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
  logout: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
    }
    set({ user: null, token: null });
  },
}));
