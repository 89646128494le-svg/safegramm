// Basic cache + push
const CACHE='sgv1'; const CORE=['/','/index.html','/style.css','/main.js','/manifest.webmanifest'];
self.addEventListener('install',e=>{ e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE))); self.skipWaiting(); });
self.addEventListener('activate',e=>{ e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch',e=>{
  const url=new URL(e.request.url);
  if (url.origin===location.origin) {
    e.respondWith(caches.match(e.request).then(r=> r || fetch(e.request).then(res=>{ const copy=res.clone(); caches.open(CACHE).then(c=>c.put(e.request, copy)); return res; })));
  }
});
self.addEventListener('push', event => {
  let data = {}; try { data = event.data.json(); } catch {}
  const title = data.title || 'SafeGram'; const options = { body: data.body || '', data };
  event.waitUntil(self.registration.showNotification(title, options));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(clients.matchAll({ type:'window'}).then(clis => {
    for (const c of clis) { if ('focus' in c) return c.focus(); }
    if (clients.openWindow) return clients.openWindow('/');
  }));
});
