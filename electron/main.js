const { app, BrowserWindow, ipcMain, nativeImage, Tray, Menu } = require('electron');
const path = require('path');

// Разрешаем самоподписанный сертификат для локального HTTPS
app.commandLine.appendSwitch('ignore-certificate-errors');
app.commandLine.appendSwitch('allow-insecure-localhost', 'true');

let tray = null;
let loginWin = null;
let chatWin = null;

function createLogin() {
  loginWin = new BrowserWindow({
    width: 460,
    height: 560,
    resizable: false,
    title: 'SafeGram — вход',
    webPreferences: { nodeIntegration: true, contextIsolation: false }
  });
  loginWin.setMenuBarVisibility(false);
  loginWin.loadFile(path.join(__dirname, 'auth.html'));
}

function openChat({ token, serverUrl }) {
  if (chatWin && !chatWin.isDestroyed()) chatWin.close();
  chatWin = new BrowserWindow({
    width: 1140,
    height: 740,
    title: 'SafeGram'
  });
  chatWin.setMenuBarVisibility(false);
  const url = serverUrl.replace(/\/$/, '') + '/#token=' + encodeURIComponent(token);
  chatWin.loadURL(url);
}

app.whenReady().then(() => {
  const iconPath = path.join(__dirname, 'icon.ico');
  const icon = nativeImage.createFromPath(iconPath);
  tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon);
  tray.setToolTip('SafeGram Complete');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Открыть', click: () => (loginWin || chatWin)?.show() },
    { type: 'separator' },
    { label: 'Выход', click: () => app.quit() }
  ]));
  createLogin();
});

// Игнорируем ошибки самоподписанного сертификата (только для локалки)
app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
  event.preventDefault();
  callback(true);
});

app.on('window-all-closed', () => { /* держим трей */ });

ipcMain.on('auth-success', (_, payload) => openChat(payload));
