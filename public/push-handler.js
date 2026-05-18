/**
 * Push notification handler — loaded by the generated Service Worker via
 * Workbox's `importScripts` config. Listens for incoming Web Push events
 * and shows a notification + handles taps.
 */

self.addEventListener('push', (event) => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch {
    try { payload = { title: 'FlickPick', body: event.data?.text?.() || '' }; } catch {}
  }
  const title = payload.title || 'FlickPick';
  const options = {
    body:    payload.body || '',
    icon:    payload.icon || '/icons/icon-192.png',
    badge:   payload.badge || '/icons/icon-192.png',
    tag:     payload.tag || 'flickpick',
    data:    { url: payload.url || '/' },
    vibrate: [40, 60, 40],
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification?.data?.url || '/';
  event.waitUntil((async () => {
    const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    // If a tab is already open, focus it and route there.
    for (const c of allClients) {
      if ('focus' in c) {
        try {
          await c.focus();
          if ('navigate' in c) await c.navigate(target).catch(() => {});
          return;
        } catch {}
      }
    }
    // Otherwise open a new window.
    if (self.clients.openWindow) await self.clients.openWindow(target);
  })());
});
