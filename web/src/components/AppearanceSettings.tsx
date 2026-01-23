import React, { useState, useEffect } from 'react';
import {
  loadAppearanceSettings,
  saveAppearanceSettings,
  AppearanceSettings as AppearanceSettingsType,
  setChatBackground,
  setChatColor,
  getChatBackground,
  getChatColor,
} from '../services/appearance';
import { showToast } from './Toast';

interface AppearanceSettingsProps {
  chatId?: string;
  onClose: () => void;
}

export default function AppearanceSettings({ chatId, onClose }: AppearanceSettingsProps) {
  const [settings, setSettings] = useState<AppearanceSettingsType>(loadAppearanceSettings());
  const [chatBackgroundUrl, setChatBackgroundUrl] = useState<string>('');
  const [chatColorValue, setChatColorValue] = useState<string>('');

  useEffect(() => {
    if (chatId) {
      const bg = getChatBackground(chatId);
      const color = getChatColor(chatId);
      setChatBackgroundUrl(bg || '');
      setChatColorValue(color || '');
    }
  }, [chatId]);

  const handleSave = () => {
    saveAppearanceSettings(settings);
    showToast('Настройки сохранены', 'success');
  };

  const handleFontSizeChange = (size: AppearanceSettingsType['fontSize']) => {
    setSettings(prev => ({ ...prev, fontSize: size }));
    saveAppearanceSettings({ ...settings, fontSize: size });
  };

  const handleCompactModeChange = (enabled: boolean) => {
    setSettings(prev => ({ ...prev, compactMode: enabled }));
    saveAppearanceSettings({ ...settings, compactMode: enabled });
  };

  const handleShowAvatarsChange = (enabled: boolean) => {
    setSettings(prev => ({ ...prev, showAvatars: enabled }));
    saveAppearanceSettings({ ...settings, showAvatars: enabled });
  };

  const handleAnimationsChange = (enabled: boolean) => {
    setSettings(prev => ({ ...prev, animationsEnabled: enabled }));
    saveAppearanceSettings({ ...settings, animationsEnabled: enabled });
  };

  const handleChatBackgroundSave = () => {
    if (chatId) {
      setChatBackground(chatId, chatBackgroundUrl || null);
      showToast('Фон чата сохранен', 'success');
    }
  };

  const handleChatColorSave = () => {
    if (chatId) {
      setChatColor(chatId, chatColorValue || null);
      showToast('Цвет чата сохранен', 'success');
    }
  };

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
        maxWidth: '600px',
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
          <h2 style={{ margin: 0, fontSize: '24px', color: 'var(--text-primary)' }}>Внешний вид</h2>
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

        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '24px'
        }}>
          {/* Размер шрифта */}
          <div style={{ marginBottom: '24px' }}>
            <h3 style={{ marginTop: 0, marginBottom: '12px', fontSize: '18px' }}>Размер шрифта</h3>
            <div style={{ display: 'flex', gap: '8px' }}>
              {(['small', 'medium', 'large', 'xlarge'] as const).map(size => (
                <button
                  key={size}
                  onClick={() => handleFontSizeChange(size)}
                  style={{
                    flex: 1,
                    padding: '12px',
                    background: settings.fontSize === size ? 'var(--accent-primary)' : 'var(--bg-secondary)',
                    border: `1px solid ${settings.fontSize === size ? 'var(--accent-primary)' : 'var(--border)'}`,
                    borderRadius: '8px',
                    color: settings.fontSize === size ? 'white' : 'var(--text-primary)',
                    cursor: 'pointer',
                    fontSize: size === 'small' ? '12px' : size === 'medium' ? '14px' : size === 'large' ? '16px' : '18px',
                    fontWeight: settings.fontSize === size ? '600' : '400'
                  }}
                >
                  {size === 'small' ? 'Маленький' :
                   size === 'medium' ? 'Средний' :
                   size === 'large' ? 'Большой' : 'Очень большой'}
                </button>
              ))}
            </div>
          </div>

          {/* Компактный режим */}
          <div style={{ marginBottom: '24px' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '16px',
              background: 'var(--bg-secondary)',
              borderRadius: '8px'
            }}>
              <div>
                <div style={{ fontSize: '16px', fontWeight: '500', marginBottom: '4px' }}>Компактный режим</div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  Более компактное отображение элементов интерфейса
                </div>
              </div>
              <label style={{
                position: 'relative',
                display: 'inline-block',
                width: '50px',
                height: '26px'
              }}>
                <input
                  type="checkbox"
                  checked={settings.compactMode}
                  onChange={e => handleCompactModeChange(e.target.checked)}
                  style={{ opacity: 0, width: 0, height: 0 }}
                />
                <span style={{
                  position: 'absolute',
                  cursor: 'pointer',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: settings.compactMode ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                  borderRadius: '26px',
                  transition: '0.3s'
                }}>
                  <span style={{
                    position: 'absolute',
                    content: '""',
                    height: '20px',
                    width: '20px',
                    left: '3px',
                    bottom: '3px',
                    background: 'white',
                    borderRadius: '50%',
                    transition: '0.3s',
                    transform: settings.compactMode ? 'translateX(24px)' : 'translateX(0)'
                  }} />
                </span>
              </label>
            </div>
          </div>

          {/* Показывать аватары */}
          <div style={{ marginBottom: '24px' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '16px',
              background: 'var(--bg-secondary)',
              borderRadius: '8px'
            }}>
              <div>
                <div style={{ fontSize: '16px', fontWeight: '500', marginBottom: '4px' }}>Показывать аватары</div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  Отображать фото профилей в списке чатов
                </div>
              </div>
              <label style={{
                position: 'relative',
                display: 'inline-block',
                width: '50px',
                height: '26px'
              }}>
                <input
                  type="checkbox"
                  checked={settings.showAvatars}
                  onChange={e => handleShowAvatarsChange(e.target.checked)}
                  style={{ opacity: 0, width: 0, height: 0 }}
                />
                <span style={{
                  position: 'absolute',
                  cursor: 'pointer',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: settings.showAvatars ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                  borderRadius: '26px',
                  transition: '0.3s'
                }}>
                  <span style={{
                    position: 'absolute',
                    content: '""',
                    height: '20px',
                    width: '20px',
                    left: '3px',
                    bottom: '3px',
                    background: 'white',
                    borderRadius: '50%',
                    transition: '0.3s',
                    transform: settings.showAvatars ? 'translateX(24px)' : 'translateX(0)'
                  }} />
                </span>
              </label>
            </div>
          </div>

          {/* Анимации */}
          <div style={{ marginBottom: '24px' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '16px',
              background: 'var(--bg-secondary)',
              borderRadius: '8px'
            }}>
              <div>
                <div style={{ fontSize: '16px', fontWeight: '500', marginBottom: '4px' }}>Анимации</div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  Включить плавные анимации интерфейса
                </div>
              </div>
              <label style={{
                position: 'relative',
                display: 'inline-block',
                width: '50px',
                height: '26px'
              }}>
                <input
                  type="checkbox"
                  checked={settings.animationsEnabled}
                  onChange={e => handleAnimationsChange(e.target.checked)}
                  style={{ opacity: 0, width: 0, height: 0 }}
                />
                <span style={{
                  position: 'absolute',
                  cursor: 'pointer',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: settings.animationsEnabled ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                  borderRadius: '26px',
                  transition: '0.3s'
                }}>
                  <span style={{
                    position: 'absolute',
                    content: '""',
                    height: '20px',
                    width: '20px',
                    left: '3px',
                    bottom: '3px',
                    background: 'white',
                    borderRadius: '50%',
                    transition: '0.3s',
                    transform: settings.animationsEnabled ? 'translateX(24px)' : 'translateX(0)'
                  }} />
                </span>
              </label>
            </div>
          </div>

          {/* Настройки для конкретного чата */}
          {chatId && (
            <>
              <div style={{ marginTop: '32px', marginBottom: '16px', paddingTop: '24px', borderTop: '1px solid var(--border)' }}>
                <h3 style={{ marginTop: 0, marginBottom: '16px', fontSize: '18px' }}>Настройки этого чата</h3>
              </div>

              {/* Фон чата */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>
                  Фон чата (URL изображения)
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    value={chatBackgroundUrl}
                    onChange={e => setChatBackgroundUrl(e.target.value)}
                    placeholder="https://example.com/image.jpg"
                    style={{
                      flex: 1,
                      padding: '10px',
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      color: 'var(--text-primary)'
                    }}
                  />
                  <button
                    onClick={handleChatBackgroundSave}
                    style={{
                      padding: '10px 20px',
                      background: 'var(--accent-primary)',
                      border: 'none',
                      borderRadius: '8px',
                      color: 'white',
                      cursor: 'pointer'
                    }}
                  >
                    Сохранить
                  </button>
                  <button
                    onClick={() => {
                      setChatBackgroundUrl('');
                      if (chatId) {
                        setChatBackground(chatId, null);
                        showToast('Фон чата удален', 'success');
                      }
                    }}
                    style={{
                      padding: '10px 20px',
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      color: 'var(--text-primary)',
                      cursor: 'pointer'
                    }}
                  >
                    Удалить
                  </button>
                </div>
              </div>

              {/* Цвет чата */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>
                  Цветовая схема чата
                </label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input
                    type="color"
                    value={chatColorValue || '#3b82f6'}
                    onChange={e => setChatColorValue(e.target.value)}
                    style={{ width: '60px', height: '40px', cursor: 'pointer' }}
                  />
                  <input
                    type="text"
                    value={chatColorValue}
                    onChange={e => setChatColorValue(e.target.value)}
                    placeholder="#3b82f6"
                    style={{
                      flex: 1,
                      padding: '10px',
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      color: 'var(--text-primary)'
                    }}
                  />
                  <button
                    onClick={handleChatColorSave}
                    style={{
                      padding: '10px 20px',
                      background: 'var(--accent-primary)',
                      border: 'none',
                      borderRadius: '8px',
                      color: 'white',
                      cursor: 'pointer'
                    }}
                  >
                    Сохранить
                  </button>
                  <button
                    onClick={() => {
                      setChatColorValue('');
                      if (chatId) {
                        setChatColor(chatId, null);
                        showToast('Цвет чата удален', 'success');
                      }
                    }}
                    style={{
                      padding: '10px 20px',
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      color: 'var(--text-primary)',
                      cursor: 'pointer'
                    }}
                  >
                    Удалить
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '12px'
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 20px',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              color: 'var(--text-primary)',
              cursor: 'pointer'
            }}
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}
