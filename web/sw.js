// Enhanced PWA Service Worker для SafeGram
const CACHE_NAME = 'safegram-v2';
const OFFLINE_CACHE = 'safegram-offline-v1';
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/src/main.tsx',
  '/src/styles.css',
  '/src/styles/globals.css',
  '/src/styles/mobile.css'
];

// Установка
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(CORE_ASSETS);
    }).then(() => {
      return self.skipWaiting();
    })
  );
});

// Активация
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME && name !== OFFLINE_CACHE)
          .map((name) => caches.delete(name))
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// Стратегия кэширования: Network First, затем Cache, затем Offline
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Пропускаем не-GET запросы и внешние ресурсы (кроме API)
  if (request.method !== 'GET') {
    return;
  }

  // Для API используем Network Only (но можно кэшировать GET запросы)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).catch(() => {
        // Если офлайн, возвращаем кэшированный ответ или пустой
        return caches.match(request).then((response) => {
          return response || new Response(
            JSON.stringify({ error: 'Offline', message: 'Нет подключения к интернету' }),
            { 
              status: 503,
              headers: { 'Content-Type': 'application/json' }
            }
          );
        });
      })
    );
    return;
  }

  // Для статических ресурсов: Network First, затем Cache
  event.respondWith(
    fetch(request)
      .then((response) => {
        // Кэшируем успешные ответы
        if (response.status === 200) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        // Если офлайн, используем кэш
        return caches.match(request).then((response) => {
          if (response) {
            return response;
          }
          // Если нет в кэше, возвращаем офлайн страницу
          if (request.mode === 'navigate') {
            return caches.match('/index.html');
          }
          return new Response('Offline', { status: 503 });
        });
      })
  );
});

// Push уведомления
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    console.error('Failed to parse push data:', e);
  }

  const title = data.title || 'SafeGram';
  const options = {
    body: data.body || '',
    icon: data.icon || '/icons/icon-192.png',
    badge: data.badge || '/icons/icon-192.png',
    image: data.image,
    data: data.data || {},
    tag: data.tag || 'safegram-notification',
    requireInteraction: data.requireInteraction || false,
    vibrate: data.vibrate || [200, 100, 200],
    timestamp: data.timestamp || Date.now(),
    actions: data.actions || []
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Клик по уведомлению
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const action = event.action;

  let url = data.url || '/';
  
  // Обработка действий
  if (action === 'reply') {
    url = data.url || '/app/chats';
  } else if (action === 'call') {
    url = data.url ? `${data.url}?call=true` : '/app/chats';
  } else if (action === 'view') {
    url = data.url || '/app/chats';
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Ищем открытое окно
      for (const client of clientList) {
        if (client.url.includes(url.split('?')[0]) && 'focus' in client) {
          return client.focus().then(() => {
            if (action) {
              client.postMessage({ type: 'notification_action', action, data });
            }
          });
        }
      }
      // Открываем новое окно
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});

// Синхронизация в фоне (Background Sync)
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-messages') {
    event.waitUntil(
      // Здесь можно синхронизировать офлайн сообщения
      Promise.resolve()
    );
  }
});
