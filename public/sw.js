self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let title = 'Energy Tracker';
  let body = 'Petit rappel pour une saisie, si tu veux.';
  let url = '/';

  if (event.data) {
    try {
      const payload = event.data.json();
      if (payload && typeof payload === 'object') {
        if (typeof payload.title === 'string' && payload.title.trim()) {
          title = payload.title.trim();
        }
        if (typeof payload.body === 'string' && payload.body.trim()) {
          body = payload.body.trim();
        }
        if (
          payload.data &&
          typeof payload.data === 'object' &&
          typeof payload.data.url === 'string' &&
          payload.data.url.startsWith('/')
        ) {
          url = payload.data.url;
        }
      }
    } catch {
      const text = event.data.text();
      if (text) {
        body = text;
      }
    }
  }

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      data: { url },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl =
    event.notification.data &&
    typeof event.notification.data.url === 'string' &&
    event.notification.data.url.startsWith('/')
      ? event.notification.data.url
      : '/';

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });
      for (const client of allClients) {
        if ('focus' in client) {
          await client.focus();
          if ('navigate' in client) {
            await client.navigate(targetUrl);
          }
          return;
        }
      }
      if (self.clients.openWindow) {
        await self.clients.openWindow(targetUrl);
      }
    })(),
  );
});
