const { app, BrowserWindow, Menu, shell, ipcMain, dialog, Tray, nativeImage, Notification } = require('electron');
const path = require('path');
const fs = require('fs');
const isDev = process.env.NODE_ENV === 'development';

// Desktop always loads local packaged web bundle (standalone app mode).
const LOCAL_BUILD_PATH = path.join(__dirname, 'renderer', 'dist', 'index.html');
const DEFAULT_SERVER_URL = 'https://141.8.198.152.nip.io';
const CONFIG_FILE_NAME = 'safegram-desktop-config.json';

// Настройка автообновления
let autoUpdater = null;
if (app.isPackaged && !isDev) {
  try {
    autoUpdater = require('electron-updater').autoUpdater;
  } catch (error) {
    console.warn('autoUpdater is unavailable:', error?.message || error);
  }
}

let mainWindow;
let tray = null;

function getConfigPath() {
  return path.join(app.getPath('userData'), CONFIG_FILE_NAME);
}

function normalizeServerUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return DEFAULT_SERVER_URL;
  if (!/^https?:\/\//i.test(raw)) return DEFAULT_SERVER_URL;
  return raw.replace(/\/+$/, '');
}

function readConfig() {
  const fallback = {
    serverUrl: DEFAULT_SERVER_URL,
  };
  try {
    const filePath = getConfigPath();
    if (!fs.existsSync(filePath)) return fallback;
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return {
      ...fallback,
      ...parsed,
      serverUrl: normalizeServerUrl(parsed?.serverUrl),
    };
  } catch {
    return fallback;
  }
}

function writeConfig(patch = {}) {
  const next = {
    ...readConfig(),
    ...patch,
  };
  next.serverUrl = normalizeServerUrl(next.serverUrl);
  const filePath = getConfigPath();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(next, null, 2), 'utf8');
  return next;
}

function createWindow() {
  // Создаем главное окно
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    icon: path.join(__dirname, 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      allowRunningInsecureContent: false
    },
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    frame: true,
    show: false,
    backgroundColor: '#0b0e13'
  });

  if (fs.existsSync(LOCAL_BUILD_PATH)) {
    mainWindow.loadFile(LOCAL_BUILD_PATH);
  } else {
    const missingBundleHtml = [
      '<!doctype html>',
      '<html><head><meta charset="utf-8"><title>SafeGram Desktop</title></head>',
      '<body style="margin:0;min-height:100vh;background:#0b0e13;color:#e2e8f0;font-family:system-ui;display:flex;align-items:center;justify-content:center;">',
      '<div style="max-width:680px;padding:24px;text-align:center;">',
      '<h1 style="margin:0 0 12px;">Desktop bundle is missing</h1>',
      '<p style="margin:0 0 12px;color:#9fb0c3;">Build web locally and run desktop again.</p>',
      '<pre style="margin:0;background:#111826;padding:12px;border-radius:8px;white-space:pre-wrap;">npm --prefix ../web run build</pre>',
      '</div></body></html>',
    ].join('');
    mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(missingBundleHtml)}`);
  }

  // Показываем окно когда готово
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    
    if (isDev) {
      mainWindow.webContents.openDevTools();
    }
  });

  // Обработка внешних ссылок
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Prevent in-app navigation to external web origins.
  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    try {
      const parsedUrl = new URL(navigationUrl);
      const allowedProtocols = new Set(['file:', 'data:', 'devtools:']);
      if (!allowedProtocols.has(parsedUrl.protocol)) {
        event.preventDefault();
        shell.openExternal(navigationUrl);
      }
    } catch {
      event.preventDefault();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Создаем меню
  createMenu();
  
  // Создаем tray icon
  createTray();
}

function createTray() {
  if (process.platform === 'darwin' || process.platform === 'win32') {
    const iconPath = path.join(__dirname, 'icon.ico');
    const icon = nativeImage.createFromPath(iconPath);
    
    if (!icon.isEmpty()) {
      tray = new Tray(icon);
      tray.setToolTip('SafeGram');
      tray.setContextMenu(Menu.buildFromTemplate([
        {
          label: 'Открыть SafeGram',
          click: () => {
            if (mainWindow) {
              mainWindow.show();
              mainWindow.focus();
            } else {
              createWindow();
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Выход',
          click: () => {
            app.quit();
          }
        }
      ]));
      
      tray.on('click', () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        } else {
          createWindow();
        }
      });
    }
  }
}

function createMenu() {
  const template = [
    {
      label: 'Файл',
      submenu: [
        {
          label: 'Выход',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: 'Правка',
      submenu: [
        { role: 'undo', label: 'Отменить' },
        { role: 'redo', label: 'Повторить' },
        { type: 'separator' },
        { role: 'cut', label: 'Вырезать' },
        { role: 'copy', label: 'Копировать' },
        { role: 'paste', label: 'Вставить' },
        { role: 'selectAll', label: 'Выделить все' }
      ]
    },
    {
      label: 'Вид',
      submenu: [
        { role: 'reload', label: 'Перезагрузить' },
        { role: 'forceReload', label: 'Принудительная перезагрузка' },
        { role: 'toggleDevTools', label: 'Инструменты разработчика' },
        { type: 'separator' },
        { role: 'resetZoom', label: 'Сбросить масштаб' },
        { role: 'zoomIn', label: 'Увеличить' },
        { role: 'zoomOut', label: 'Уменьшить' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Полноэкранный режим' }
      ]
    },
    {
      label: 'Окно',
      submenu: [
        { role: 'minimize', label: 'Свернуть' },
        { role: 'close', label: 'Закрыть' }
      ]
    },
    {
      label: 'Помощь',
      submenu: [
        {
          label: 'О SafeGram',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'О SafeGram',
              message: 'SafeGram Desktop',
              detail: `Версия ${app.getVersion()}\nБезопасный мессенджер с end-to-end шифрованием`
            });
          }
        },
        {
          label: 'Документация',
          click: () => {
            shell.openExternal('https://github.com/your-username/safegram');
          }
        }
      ]
    }
  ];

  if (process.platform === 'darwin') {
    template.unshift({
      label: app.getName(),
      submenu: [
        { role: 'about', label: 'О программе' },
        { type: 'separator' },
        { role: 'services', label: 'Сервисы' },
        { type: 'separator' },
        { role: 'hide', label: 'Скрыть SafeGram' },
        { role: 'hideOthers', label: 'Скрыть остальные' },
        { role: 'unhide', label: 'Показать все' },
        { type: 'separator' },
        { role: 'quit', label: 'Выход' }
      ]
    });
  }

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// IPC обработчики
ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

ipcMain.handle('get-platform', () => {
  return process.platform;
});

ipcMain.handle('app:get-config', () => {
  return readConfig();
});

ipcMain.handle('app:set-config', (_event, keyOrPatch, value) => {
  if (typeof keyOrPatch === 'string') {
    return writeConfig({ [keyOrPatch]: value });
  }
  if (keyOrPatch && typeof keyOrPatch === 'object') {
    return writeConfig(keyOrPatch);
  }
  return readConfig();
});

ipcMain.handle('window:minimize', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.minimize();
  }
  return true;
});

ipcMain.handle('window:maximize', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
  }
  return true;
});

ipcMain.handle('window:close', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.close();
  }
  return true;
});

ipcMain.handle('open-external', (_event, url) => {
  if (typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!/^https?:\/\//i.test(trimmed) && !/^mailto:/i.test(trimmed)) return false;
  shell.openExternal(trimmed);
  return true;
});

ipcMain.handle('show-notification', (_event, payload) => {
  const title = String(payload?.title || 'SafeGram');
  const body = String(payload?.body || '');
  const silent = Boolean(payload?.silent);
  if (!Notification.isSupported()) return false;
  new Notification({ title, body, silent }).show();
  return true;
});

// Автообновление
autoUpdater?.on('update-available', () => {
  if (mainWindow) {
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Обновление доступно',
      message: 'Доступна новая версия SafeGram',
      detail: 'Обновление будет загружено в фоновом режиме',
      buttons: ['OK']
    });
  }
});

autoUpdater?.on('update-downloaded', () => {
  if (mainWindow) {
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Обновление готово',
      message: 'Обновление загружено',
      detail: 'Приложение будет перезапущено для установки обновления',
      buttons: ['Перезапустить сейчас', 'Позже']
    }).then((result) => {
      if (result.response === 0) {
        autoUpdater.quitAndInstall();
      }
    });
  }
});

autoUpdater?.on('error', (error) => {
  console.error('Auto-updater error:', error);
});

// Инициализация
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // На macOS приложения обычно остаются активными
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Обработка протокола
app.setAsDefaultProtocolClient('safegram');

// Предотвращаем множественные экземпляры
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}
