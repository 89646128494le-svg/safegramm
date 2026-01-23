const { app, BrowserWindow, Menu, shell, ipcMain, dialog, Tray, nativeImage } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const isDev = process.env.NODE_ENV === 'development';

// URL для загрузки приложения
// В production можно использовать Vercel URL или локальную сборку
const PRODUCTION_URL = process.env.SAFEGRAM_URL || 'https://your-vercel-app.vercel.app';
const LOCAL_BUILD_PATH = path.join(__dirname, '../web/dist/index.html');

// Настройка автообновления
if (!isDev) {
  autoUpdater.checkForUpdatesAndNotify();
}

let mainWindow;
let tray = null;

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

  // Определяем URL для загрузки
  let startUrl;
  if (isDev) {
    startUrl = 'http://localhost:5173';
  } else {
    // Пробуем загрузить локальную сборку, если есть
    const fs = require('fs');
    if (fs.existsSync(LOCAL_BUILD_PATH)) {
      startUrl = `file://${LOCAL_BUILD_PATH}`;
    } else {
      // Иначе загружаем с Vercel
      startUrl = PRODUCTION_URL;
    }
  }
  
  mainWindow.loadURL(startUrl);

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

  // Предотвращаем навигацию на внешние сайты
  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl);
    
    if (isDev) {
      if (parsedUrl.origin !== 'http://localhost:5173') {
        event.preventDefault();
        shell.openExternal(navigationUrl);
      }
    } else {
      // В production разрешаем только file:// или наш домен
      const isOurDomain = parsedUrl.origin === new URL(PRODUCTION_URL).origin;
      if (parsedUrl.protocol !== 'file:' && !isOurDomain) {
        event.preventDefault();
        shell.openExternal(navigationUrl);
      }
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

// Автообновление
autoUpdater.on('update-available', () => {
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

autoUpdater.on('update-downloaded', () => {
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

autoUpdater.on('error', (error) => {
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
