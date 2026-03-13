const CACHE_NAME = 'safegram-v1';
const OFFLINE_URL = '/offline.html';

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(['/', '/offline.html', '/manifest.webmanifest', '/favicon.png']);
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE_NAME; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  if (event.request.mode !== 'navigate') return;
  event.respondWith(
    fetch(event.request).catch(function () {
      return caches.match(event.request).then(function (r) {
        return r || caches.match('/').then(function (index) {
          return caches.match(OFFLINE_URL).then(function (off) { return off || new Response('<h1>Нет соединения</h1><p>SafeGram офлайн. <a href="/">Обновить</a></p>', { headers: { 'Content-Type': 'text/html' } }); });
        });
      });
    })
  );
});

self.addEventListener('push', function (event) {
  if (!event.data) return;
  const data = event.data.json();
  const options = {
    body: data.body || '',
    icon: data.icon || '/favicon.ico',
    badge: data.badge || '/favicon.ico',
    image: data.image || undefined, // Превью изображения
    data: data.data || {},
    tag: data.tag || 'safegram-notification',
    requireInteraction: data.requireInteraction || false,
    vibrate: data.vibrate || [200, 100, 200],
    timestamp: data.timestamp || Date.now(),
    // Действия в уведомлении (если поддерживается)
    actions: data.actions || []
  };
  event.waitUntil(self.registration.showNotification(data.title || 'SafeGram', options));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  const data = event.notification.data;
  const action = event.action; // Действие, если было нажато
  
  let url = data.url || '/';
  
  // Обработка действий
  if (action === 'reply') {
    // Открываем чат для ответа
    url = data.url || '/app/chats';
  } else if (action === 'call') {
    // Инициируем звонок
    url = data.url ? `${data.url}?call=true` : '/app/chats';
  } else if (action === 'view') {
    // Просто открываем чат
    url = data.url || '/app/chats';
  }
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      // Ищем открытое окно с нужным URL
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url.includes(url.split('?')[0]) && 'focus' in client) {
          return client.focus().then(() => {
            // Отправляем сообщение в окно о действии
            if (action) {
              client.postMessage({ type: 'notification_action', action, data });
            }
          });
        }
      }
      // Если окно не найдено, открываем новое
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});
