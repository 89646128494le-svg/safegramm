/**
 * Preload Script
 * 
 * Безопасный мост между main и renderer процессами
 * Предоставляет API для взаимодействия с Electron
 */

const { contextBridge, ipcRenderer } = require('electron');

// API для работы с приложением
contextBridge.exposeInMainWorld('electronAPI', {
  // Конфигурация
  getConfig: () => ipcRenderer.invoke('app:get-config'),
  setConfig: (key, value) => ipcRenderer.invoke('app:set-config', key, value),

  // Управление окном
  showWindow: () => ipcRenderer.invoke('app:show-window'),
  minimizeWindow: () => ipcRenderer.invoke('app:minimize-window'),
  maximizeWindow: () => ipcRenderer.invoke('app:maximize-window'),
  closeWindow: () => ipcRenderer.invoke('app:close-window'),

  // Автозапуск
  setAutoStart: (enabled) => ipcRenderer.invoke('app:set-auto-start', enabled),

  // Уведомления
  showNotification: (options) => ipcRenderer.invoke('app:show-notification', options),

  // Диалоги
  showDialog: (options) => ipcRenderer.invoke('app:show-dialog', options),

  // Внешние ссылки
  openExternal: (url) => ipcRenderer.invoke('app:open-external', url),

  // Версия
  getVersion: () => ipcRenderer.invoke('app:get-version'),

  // События от main process
  on: (channel, callback) => {
    const validChannels = ['toggle-mute', 'navigate', 'update-available'];
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (event, ...args) => callback(...args));
    }
  },

  off: (channel, callback) => {
    ipcRenderer.removeListener(channel, callback);
  }
});

// Информация о платформе
contextBridge.exposeInMainWorld('platform', {
  platform: process.platform,
  isWindows: process.platform === 'win32',
  isMac: process.platform === 'darwin',
  isLinux: process.platform === 'linux'
});
