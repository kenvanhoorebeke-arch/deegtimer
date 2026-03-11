// DeegTimer Service Worker
// Plant systeem-notificaties voor actieve timers.
// Alarmen worden opgeslagen als absolute eindtijden zodat ze een SW-herstart overleven.

const DB_NAME = 'deegtimer-alarms';
const DB_VERSION = 1;
const STORE = 'alarms';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = e => e.target.result.createObjectStore(STORE, { keyPath: 'id' });
    req.onsuccess = e => resolve(e.target.result);
    req.onerror   = () => reject(req.error);
  });
}

async function saveAlarm(id, name, emoji, fireAt) {
  const db = await openDB();
  db.transaction(STORE, 'readwrite').objectStore(STORE).put({ id, name, emoji, fireAt });
}

async function deleteAlarm(id) {
  const db = await openDB();
  db.transaction(STORE, 'readwrite').objectStore(STORE).delete(id);
}

async function getAllAlarms() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, 'readonly').objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

const handles = new Map(); // timerId -> timeoutHandle

function scheduleTimeout(id, name, emoji, fireAt) {
  if (handles.has(id)) clearTimeout(handles.get(id));
  const delay = Math.max(0, fireAt - Date.now());
  const h = setTimeout(async () => {
    handles.delete(id);
    await deleteAlarm(id);
    const windowClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    // Toon notificatie als de app NIET gefocust is (app op voorgrond regelt zelf het alarm)
    if (windowClients.some(c => c.focused)) return;
    self.registration.showNotification(`${emoji} ${name} is klaar!`, {
      body: 'Tik hier om terug te gaan naar de deegtimer',
      tag: `timer-${id}`,
      renotify: true,
      vibrate: [300, 100, 300, 100, 300],
      data: { id },
    });
  }, delay);
  handles.set(id, h);
}

// Bij (her)start SW: controleer op gemiste alarmen en plan bestaande in
self.addEventListener('activate', event => {
  event.waitUntil(
    getAllAlarms().then(alarms => {
      const now = Date.now();
      alarms.forEach(({ id, name, emoji, fireAt }) => {
        if (fireAt <= now) {
          // Gemist alarm: stuur direct een notificatie
          deleteAlarm(id);
          self.registration.showNotification(`${emoji} ${name} is klaar!`, {
            body: 'Tik hier om terug te gaan naar de deegtimer',
            tag: `timer-${id}`,
            renotify: true,
            vibrate: [300, 100, 300, 100, 300],
            data: { id },
          });
        } else {
          scheduleTimeout(id, name, emoji, fireAt);
        }
      });
    }).catch(() => {})
  );
});

self.addEventListener('message', event => {
  const { type, id, name, emoji, remaining } = event.data;

  if (type === 'SCHEDULE') {
    const fireAt = Date.now() + remaining * 1000;
    saveAlarm(id, name, emoji, fireAt).catch(() => {});
    scheduleTimeout(id, name, emoji, fireAt);
  }

  if (type === 'CANCEL') {
    if (handles.has(id)) { clearTimeout(handles.get(id)); handles.delete(id); }
    deleteAlarm(id).catch(() => {});
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
