// Preload скрипт для безопасного взаимодействия с Electron API
const { contextBridge, ipcRenderer } = require('electron');

// Предоставляем безопасный API для renderer процесса
contextBridge.exposeInMainWorld('electronAPI', {
  // Информация о приложении
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getPlatform: () => ipcRenderer.invoke('get-platform'),
  
  // Уведомления
  showNotification: (title, body) => {
    // Используем Web Notifications API, если доступно
    if ('Notification' in window) {
      new Notification(title, { body });
    }
  },
  
  // Системная информация
  platform: process.platform,
  versions: process.versions
});

// Логируем информацию о платформе
console.log('SafeGram Desktop - Electron', process.versions.electron);
console.log('Platform:', process.platform);
