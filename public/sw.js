// DeegTimer Service Worker
// Plant systeem-notificaties voor actieve timers, ook bij vergrendeld scherm.

const alarms = new Map(); // timerId -> timeoutHandle

self.addEventListener('message', event => {
  const { type, id, name, emoji, remaining } = event.data;

  if (type === 'SCHEDULE') {
    // Herplan: verwijder bestaand alarm voor deze timer
    if (alarms.has(id)) clearTimeout(alarms.get(id));

    const handle = setTimeout(async () => {
      alarms.delete(id);

      // Toon geen notificatie als de app al op de voorgrond staat —
      // de in-app alert is dan al zichtbaar.
      const windowClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });
      if (windowClients.some(c => c.focused)) return;

      self.registration.showNotification(`${emoji} ${name} is klaar!`, {
        body: 'Tik hier om terug te gaan naar de deegtimer',
        tag: `timer-${id}`,
        renotify: true,
        vibrate: [300, 100, 300, 100, 300],
        data: { id },
      });
    }, remaining * 1000);

    alarms.set(id, handle);
  }

  if (type === 'CANCEL') {
    if (alarms.has(id)) {
      clearTimeout(alarms.get(id));
      alarms.delete(id);
    }
  }
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
