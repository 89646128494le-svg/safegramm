import React, { useState, useEffect } from 'react';
import { 
  getAllThemes, 
  applyTheme, 
  getCurrentTheme, 
  saveCustomTheme, 
  deleteCustomTheme,
  Theme,
  defaultThemes 
} from '../services/themes';
import { showToast } from './Toast';

interface EnhancedThemePickerProps {
  onClose: () => void;
}

export default function EnhancedThemePicker({ onClose }: EnhancedThemePickerProps) {
  const [themes, setThemes] = useState<Theme[]>([]);
  const [selectedTheme, setSelectedTheme] = useState<Theme | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [newTheme, setNewTheme] = useState<Partial<Theme>>({
    name: '',
    displayName: '',
    category: 'custom',
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
  });

  useEffect(() => {
    loadThemes();
  }, []);

  const loadThemes = () => {
    const allThemes = getAllThemes();
    setThemes(allThemes);
    const current = getCurrentTheme();
    if (current) {
      setSelectedTheme(current);
    }
  };

  const handleSelectTheme = (theme: Theme) => {
    applyTheme(theme);
    setSelectedTheme(theme);
    showToast(`Тема "${theme.displayName}" применена`, 'success');
  };

  const handleCreateTheme = () => {
    if (!newTheme.name || !newTheme.displayName) {
      showToast('Заполните название темы', 'error');
      return;
    }

    const theme: Theme = {
      id: `custom-${Date.now()}`,
      name: newTheme.name!,
      displayName: newTheme.displayName!,
      category: newTheme.category || 'custom',
      isPublic: false,
      colors: newTheme.colors!,
      backgroundUrl: newTheme.backgroundUrl,
      backgroundBlur: newTheme.backgroundBlur,
      soundTheme: newTheme.soundTheme,
    };

    saveCustomTheme(theme);
    loadThemes();
    setShowCreate(false);
    setNewTheme({
      name: '',
      displayName: '',
      category: 'custom',
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
    });
    showToast('Тема создана', 'success');
  };

  const handleDeleteTheme = (themeId: string) => {
    if (!confirm('Удалить эту тему?')) return;
    deleteCustomTheme(themeId);
    loadThemes();
    if (selectedTheme?.id === themeId) {
      setSelectedTheme(null);
    }
    showToast('Тема удалена', 'success');
  };

  const categories = [
    { id: 'all', name: 'Все' },
    { id: 'dark', name: 'Темные' },
    { id: 'light', name: 'Светлые' },
    { id: 'colorful', name: 'Яркие' },
    { id: 'minimal', name: 'Минималистичные' },
    { id: 'custom', name: 'Мои темы' },
  ];

  const filteredThemes = selectedCategory === 'all' 
    ? themes 
    : themes.filter(t => t.category === selectedCategory);

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.8)',
      zIndex: 10000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div style={{
        background: 'var(--bg-primary)',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '900px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        border: '1px solid var(--border)'
      }}>
        <div style={{
          padding: '24px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h2 style={{ margin: 0, fontSize: '24px', color: 'var(--text-primary)' }}>Темы оформления</h2>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: 'var(--text-primary)',
              padding: '4px 8px'
            }}
          >
            ✕
          </button>
        </div>

        {/* Категории */}
        <div style={{
          padding: '16px 24px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          gap: '8px',
          overflowX: 'auto'
        }}>
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              style={{
                padding: '8px 16px',
                background: selectedCategory === cat.id ? 'var(--accent-primary)' : 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                color: selectedCategory === cat.id ? 'white' : 'var(--text-primary)',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                fontSize: '14px',
                fontWeight: selectedCategory === cat.id ? '600' : '400'
              }}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Список тем */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '24px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: '16px'
        }}>
          {filteredThemes.map(theme => (
            <div
              key={theme.id}
              onClick={() => handleSelectTheme(theme)}
              style={{
                position: 'relative',
                padding: '16px',
                background: 'var(--bg-secondary)',
                border: selectedTheme?.id === theme.id ? '2px solid var(--accent-primary)' : '1px solid var(--border)',
                borderRadius: '12px',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--bg-tertiary)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--bg-secondary)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              {/* Превью темы */}
              <div style={{
                height: '80px',
                background: `linear-gradient(135deg, ${theme.colors.bgPrimary} 0%, ${theme.colors.bgSecondary} 100%)`,
                borderRadius: '8px',
                marginBottom: '12px',
                border: `2px solid ${theme.colors.accentPrimary}`,
                position: 'relative',
                overflow: 'hidden'
              }}>
                <div style={{
                  position: 'absolute',
                  bottom: '8px',
                  left: '8px',
                  right: '8px',
                  background: theme.colors.bgCard,
                  padding: '6px',
                  borderRadius: '4px',
                  fontSize: '10px',
                  color: theme.colors.textPrimary
                }}>
                  {theme.displayName}
                </div>
              </div>
              
              <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '4px' }}>
                {theme.displayName}
              </div>
              
              {selectedTheme?.id === theme.id && (
                <div style={{
                  position: 'absolute',
                  top: '8px',
                  right: '8px',
                  background: 'var(--accent-primary)',
                  color: 'white',
                  borderRadius: '50%',
                  width: '24px',
                  height: '24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '14px'
                }}>
                  ✓
                </div>
              )}
              
              {!theme.isPublic && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteTheme(theme.id);
                  }}
                  style={{
                    position: 'absolute',
                    bottom: '8px',
                    right: '8px',
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: '4px',
                    padding: '4px 8px',
                    color: '#ef4444',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                >
                  Удалить
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Кнопка создания темы */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <button
            onClick={() => setShowCreate(!showCreate)}
            style={{
              padding: '10px 20px',
              background: 'var(--accent-primary)',
              border: 'none',
              borderRadius: '8px',
              color: 'white',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            {showCreate ? '✕ Отмена' : '+ Создать свою тему'}
          </button>
        </div>

        {/* Форма создания темы */}
        {showCreate && (
          <div style={{
            padding: '24px',
            borderTop: '1px solid var(--border)',
            background: 'var(--bg-secondary)',
            maxHeight: '400px',
            overflowY: 'auto'
          }}>
            <h3 style={{ marginTop: 0, marginBottom: '16px' }}>Создать тему</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input
                type="text"
                placeholder="ID темы (латиница, без пробелов)"
                value={newTheme.name || ''}
                onChange={e => setNewTheme({ ...newTheme, name: e.target.value })}
                style={{
                  padding: '10px',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  color: 'var(--text-primary)'
                }}
              />
              
              <input
                type="text"
                placeholder="Название темы"
                value={newTheme.displayName || ''}
                onChange={e => setNewTheme({ ...newTheme, displayName: e.target.value })}
                style={{
                  padding: '10px',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  color: 'var(--text-primary)'
                }}
              />

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px' }}>Фон основной</label>
                  <input
                    type="color"
                    value={newTheme.colors?.bgPrimary || '#0b0e13'}
                    onChange={e => setNewTheme({ 
                      ...newTheme, 
                      colors: { ...newTheme.colors!, bgPrimary: e.target.value }
                    })}
                    style={{ width: '100%', height: '40px' }}
                  />
                </div>
                
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px' }}>Фон вторичный</label>
                  <input
                    type="color"
                    value={newTheme.colors?.bgSecondary || '#1a1d29'}
                    onChange={e => setNewTheme({ 
                      ...newTheme, 
                      colors: { ...newTheme.colors!, bgSecondary: e.target.value }
                    })}
                    style={{ width: '100%', height: '40px' }}
                  />
                </div>
                
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px' }}>Текст основной</label>
                  <input
                    type="color"
                    value={newTheme.colors?.textPrimary || '#e5e7eb'}
                    onChange={e => setNewTheme({ 
                      ...newTheme, 
                      colors: { ...newTheme.colors!, textPrimary: e.target.value }
                    })}
                    style={{ width: '100%', height: '40px' }}
                  />
                </div>
                
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px' }}>Акцент</label>
                  <input
                    type="color"
                    value={newTheme.colors?.accentPrimary || '#3b82f6'}
                    onChange={e => setNewTheme({ 
                      ...newTheme, 
                      colors: { ...newTheme.colors!, accentPrimary: e.target.value }
                    })}
                    style={{ width: '100%', height: '40px' }}
                  />
                </div>
              </div>

              <input
                type="text"
                placeholder="URL фона (необязательно)"
                value={newTheme.backgroundUrl || ''}
                onChange={e => setNewTheme({ ...newTheme, backgroundUrl: e.target.value || undefined })}
                style={{
                  padding: '10px',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  color: 'var(--text-primary)'
                }}
              />

              <button
                onClick={handleCreateTheme}
                style={{
                  padding: '12px',
                  background: 'var(--accent-primary)',
                  border: 'none',
                  borderRadius: '8px',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500'
                }}
              >
                Создать тему
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
