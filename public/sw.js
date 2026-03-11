// DeegTimer Service Worker

// Push-notificatie van de server ontvangen en tonen
self.addEventListener('push', event => {
  if (!event.data) return;
  const { title, body, tag } = event.data.json();
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag,
      renotify: true,
      vibrate: [300, 100, 300, 100, 300],
    })
  );
});

// Bij klikken op notificatie: open of focus de app
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const client of list) {
        if ('focus' in client) return client.focus();
      }
      return clients.openWindow(self.registration.scope);
    })
  );
});
