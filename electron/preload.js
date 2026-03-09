const { contextBridge, ipcRenderer } = require('electron');

const DEFAULT_CONFIG = {
  serverUrl: 'https://141.8.198.152.nip.io',
};

async function safeInvoke(channel, ...args) {
  try {
    return await ipcRenderer.invoke(channel, ...args);
  } catch {
    return undefined;
  }
}

function normalizeNotificationPayload(payloadOrTitle, maybeBody) {
  if (typeof payloadOrTitle === 'string') {
    return {
      title: payloadOrTitle || 'SafeGram',
      body: typeof maybeBody === 'string' ? maybeBody : '',
    };
  }
  if (payloadOrTitle && typeof payloadOrTitle === 'object') {
    return {
      title: String(payloadOrTitle.title || 'SafeGram'),
      body: String(payloadOrTitle.body || ''),
      icon: payloadOrTitle.icon,
      silent: Boolean(payloadOrTitle.silent),
    };
  }
  return { title: 'SafeGram', body: '' };
}

contextBridge.exposeInMainWorld('electronAPI', {
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getPlatform: () => ipcRenderer.invoke('get-platform'),

  getConfig: async () => {
    const config = await safeInvoke('app:get-config');
    if (config && typeof config === 'object') return config;
    return DEFAULT_CONFIG;
  },

  setConfig: async (key, value) => {
    if (typeof key === 'string') {
      const next = await safeInvoke('app:set-config', key, value);
      if (next && typeof next === 'object') return next;
      return { ...DEFAULT_CONFIG, [key]: value };
    }
    if (key && typeof key === 'object') {
      const next = await safeInvoke('app:set-config', key);
      if (next && typeof next === 'object') return next;
      return { ...DEFAULT_CONFIG, ...key };
    }
    return DEFAULT_CONFIG;
  },

  showNotification: async (payloadOrTitle, maybeBody) => {
    const payload = normalizeNotificationPayload(payloadOrTitle, maybeBody);
    const viaMain = await safeInvoke('show-notification', payload);
    if (viaMain) return true;
    try {
      if (typeof Notification !== 'undefined') {
        new Notification(payload.title, { body: payload.body, silent: payload.silent });
        return true;
      }
    } catch {
      // ignore
    }
    return false;
  },

  openExternal: async (url) => {
    if (typeof url !== 'string' || !url.trim()) return false;
    const ok = await safeInvoke('open-external', url);
    if (ok) return true;
    try {
      if (typeof window !== 'undefined' && window.open) {
        window.open(url, '_blank', 'noopener,noreferrer');
        return true;
      }
    } catch {
      // ignore
    }
    return false;
  },

  minimizeWindow: () => safeInvoke('window:minimize'),
  maximizeWindow: () => safeInvoke('window:maximize'),
  closeWindow: () => safeInvoke('window:close'),

  // Backward-compatible generic bridge for legacy desktop code.
  invoke: (channel, ...args) => safeInvoke(channel, ...args),

  platform: process.platform,
  versions: process.versions,
});
