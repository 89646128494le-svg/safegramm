
import React, { useState, useEffect } from 'react';
import { api } from '../services/api';

interface Theme {
  id: string;
  name: string;
  colors: {
    bg: string;
    fg: string;
    accent: string;
    subtle?: string;
  };
  backgroundUrl?: string;
  isPublic: boolean;
}

interface ThemePickerProps {
  onSelect: (themeId: string | null) => void;
  onClose: () => void;
}

export default function ThemePicker({ onSelect, onClose }: ThemePickerProps) {
  const [themes, setThemes] = useState<Theme[]>([]);
  const [selectedTheme, setSelectedTheme] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newTheme, setNewTheme] = useState({
    name: '',
    bg: '#0b0e13',
    fg: '#e5e7eb',
    accent: '#3b82f6',
    subtle: '#9ca3af'
  });

  useEffect(() => {
    loadThemes();
    loadUserTheme();
  }, []);

  const loadThemes = async () => {
    try {
      const data = await api('/api/themes');
      setThemes(data.themes || []);
    } catch (e) {
      console.error('Failed to load themes:', e);
    }
  };

  const loadUserTheme = async () => {
    try {
      const data = await api('/api/users/me');
      // Предполагаем, что тема хранится в настройках пользователя
      // В реальности нужен отдельный endpoint
    } catch (e) {
      console.error('Failed to load user theme:', e);
    }
  };

  const createTheme = async () => {
    try {
      await api('/api/themes', 'POST', {
        name: newTheme.name,
        colors: {
          bg: newTheme.bg,
          fg: newTheme.fg,
          accent: newTheme.accent,
          subtle: newTheme.subtle
        },
        isPublic: false
      });
      await loadThemes();
      setShowCreate(false);
      setNewTheme({ name: '', bg: '#0b0e13', fg: '#e5e7eb', accent: '#3b82f6', subtle: '#9ca3af' });
    } catch (e: any) {
      alert('Ошибка создания темы: ' + (e.message || 'unknown'));
    }
  };

  const applyTheme = async (themeId: string | null) => {
    try {
      await api('/api/users/me/theme', 'POST', { themeId });
      setSelectedTheme(themeId);
      onSelect(themeId);
      
      // Применяем тему к документу
      if (themeId) {
        const theme = themes.find(t => t.id === themeId);
        if (theme) {
          const root = document.documentElement;
          root.style.setProperty('--bg', theme.colors.bg);
          root.style.setProperty('--fg', theme.colors.fg);
          root.style.setProperty('--accent', theme.colors.accent);
          if (theme.colors.subtle) {
            root.style.setProperty('--subtle', theme.colors.subtle);
          }
          if (theme.backgroundUrl) {
            document.body.style.backgroundImage = `url(${theme.backgroundUrl})`;
          }
        }
      } else {
        // Сброс к дефолтной теме
        const root = document.documentElement;
        root.style.removeProperty('--bg');
        root.style.removeProperty('--fg');
        root.style.removeProperty('--accent');
        root.style.removeProperty('--subtle');
        document.body.style.backgroundImage = '';
      }
    } catch (e: any) {
      alert('Ошибка применения темы: ' + (e.message || 'unknown'));
    }
  };

  return (
    <div className="theme-picker">
      <div className="theme-picker-header">
        <h4>Темы оформления</h4>
        <button onClick={onClose}>✕</button>
      </div>

      <div className="theme-picker-content">
        <div className="theme-options">
          <button
            className={`theme-option ${selectedTheme === null ? 'active' : ''}`}
            onClick={() => applyTheme(null)}
          >
            <div className="theme-preview" style={{ background: '#0b0e13', color: '#e5e7eb' }}>
              Дефолтная
            </div>
          </button>
          {themes.map(theme => (
            <button
              key={theme.id}
              className={`theme-option ${selectedTheme === theme.id ? 'active' : ''}`}
              onClick={() => applyTheme(theme.id)}
            >
              <div
                className="theme-preview"
                style={{
                  background: theme.colors.bg,
                  color: theme.colors.fg,
                  borderColor: theme.colors.accent
                }}
              >
                {theme.name}
              </div>
            </button>
          ))}
        </div>

        <button onClick={() => setShowCreate(!showCreate)} className="create-theme-btn">
          + Создать тему
        </button>

        {showCreate && (
          <div className="create-theme-form">
            <input
              placeholder="Название темы"
              value={newTheme.name}
              onChange={e => setNewTheme({ ...newTheme, name: e.target.value })}
            />
            <div className="color-inputs">
              <label>
                Фон: <input type="color" value={newTheme.bg} onChange={e => setNewTheme({ ...newTheme, bg: e.target.value })} />
              </label>
              <label>
                Текст: <input type="color" value={newTheme.fg} onChange={e => setNewTheme({ ...newTheme, fg: e.target.value })} />
              </label>
              <label>
                Акцент: <input type="color" value={newTheme.accent} onChange={e => setNewTheme({ ...newTheme, accent: e.target.value })} />
              </label>
            </div>
            <div className="create-theme-actions">
              <button onClick={createTheme}>Создать</button>
              <button onClick={() => setShowCreate(false)}>Отмена</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}




