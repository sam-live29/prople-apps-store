// Prople Store Firebase Cloud Messaging Service Worker
/* eslint-disable no-undef */
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

try {
  firebase.initializeApp({
    apiKey: "AIzaSyC5iotZL4UVF7QcdVn1ps3gIcetBDt9sc4",
    authDomain: "prople-store-3efed.firebaseapp.com",
    projectId: "prople-store-3efed",
    storageBucket: "prople-store-3efed.firebasestorage.app",
    messagingSenderId: "374295310162",
    appId: "1:374295310162:web:dcd5f14a552ddbf96dd48b"
  });

  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    const title = payload.notification?.title || payload.data?.title || 'Prople Store';
    const options = {
      body: payload.notification?.body || payload.data?.message || payload.data?.body || '',
      icon: payload.notification?.icon || payload.data?.icon || '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      data: {
        url: payload.data?.url || payload.data?.actionUrl || '/'
      },
      vibrate: [150, 80, 150],
      tag: payload.data?.tag || `prople-${Date.now()}`
    };

    self.registration.showNotification(title, options);
  });
} catch (e) {
  console.warn('Firebase messaging SW initialization notice:', e);
}

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
