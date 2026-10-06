// Prople Store Service Worker for Native Mobile Push & PWA Notifications
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key.includes('precache') || key.includes('workbox') || key.includes('app-cache')) {
            return caches.delete(key);
          }
          return Promise.resolve();
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen);
      }
    })
  );
});

self.addEventListener('push', (event) => {
  if (!event.data) return;
  try {
    const payload = event.data.json();
    const title = payload.title || 'Prople Store';
    const options = {
      body: payload.body || payload.message || '',
      icon: payload.icon || '/pwa-192x192.png',
      badge: payload.badge || '/pwa-192x192.png',
      data: payload.data || { url: payload.url || '/' },
      tag: payload.tag || `prople-${Date.now()}`,
      vibrate: [100, 50, 100],
      requireInteraction: payload.priority === 'critical'
    };
    event.waitUntil(self.registration.showNotification(title, options));
  } catch {
    const text = event.data.text();
    event.waitUntil(
      self.registration.showNotification('Prople Store', {
        body: text,
        icon: '/pwa-192x192.png'
      })
    );
  }
});

// Direct message channel for native foreground/background notification dispatch
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const title = event.data.title || 'Prople Store';
    const options = {
      body: event.data.options?.body || '',
      icon: event.data.options?.icon || '/pwa-192x192.png',
      badge: event.data.options?.badge || '/pwa-192x192.png',
      data: event.data.options?.data || { url: '/' },
      tag: event.data.options?.tag || `prople-${Date.now()}`,
      vibrate: event.data.options?.vibrate || [150, 80, 150],
      requireInteraction: false
    };
    event.waitUntil(self.registration.showNotification(title, options));
  }
});
