import express from 'express';
import webpush from 'web-push';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(__dirname, 'data');
const KEYS_FILE   = path.join(DATA, 'vapid-keys.json');
const ALARMS_FILE = path.join(DATA, 'alarms.json');

if (!fs.existsSync(DATA)) fs.mkdirSync(DATA, { recursive: true });

// VAPID-sleutels: eenmalig genereren, daarna hergebruiken
let vapidKeys;
if (fs.existsSync(KEYS_FILE)) {
  vapidKeys = JSON.parse(fs.readFileSync(KEYS_FILE, 'utf8'));
} else {
  vapidKeys = webpush.generateVAPIDKeys();
  fs.writeFileSync(KEYS_FILE, JSON.stringify(vapidKeys, null, 2));
  console.log('Nieuwe VAPID-sleutels gegenereerd en opgeslagen.');
}

webpush.setVapidDetails(
  'mailto:timer@deegtimer.app',
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

// Geplande alarmen: Map<timerId, { subscription, name, emoji, fireAt, handle }>
const alarms = new Map();

function saveAlarms() {
  const data = {};
  for (const [id, { subscription, name, emoji, fireAt }] of alarms) {
    data[id] = { subscription, name, emoji, fireAt };
  }
  try { fs.writeFileSync(ALARMS_FILE, JSON.stringify(data, null, 2)); } catch {}
}

async function sendPush(subscription, timerId, name, emoji) {
  try {
    await webpush.sendNotification(
      subscription,
      JSON.stringify({ title: `${emoji} ${name} is klaar!`, body: 'Tik om terug te gaan.', tag: `timer-${timerId}` })
    );
  } catch (e) {
    // 410 = subscription verlopen, verwijder uit opgeslagen alarmen
    if (e.statusCode === 410) console.log(`Subscription verlopen voor timer ${timerId}`);
    else console.error(`Push mislukt (${e.statusCode}):`, e.body);
  }
}

function scheduleAlarm(timerId, subscription, name, emoji, fireAt) {
  if (alarms.has(timerId)) clearTimeout(alarms.get(timerId).handle);
  const delay = Math.max(0, fireAt - Date.now());
  const handle = setTimeout(async () => {
    alarms.delete(timerId);
    saveAlarms();
    await sendPush(subscription, timerId, name, emoji);
  }, delay);
  alarms.set(timerId, { subscription, name, emoji, fireAt, handle });
  saveAlarms();
}

// Herstel alarmen na server-herstart
if (fs.existsSync(ALARMS_FILE)) {
  try {
    const saved = JSON.parse(fs.readFileSync(ALARMS_FILE, 'utf8'));
    const now = Date.now();
    for (const [id, { subscription, name, emoji, fireAt }] of Object.entries(saved)) {
      if (fireAt <= now) {
        console.log(`Gemist alarm voor ${name}, stuur push direct.`);
        sendPush(subscription, id, name, emoji);
      } else {
        scheduleAlarm(id, subscription, name, emoji, fireAt);
        console.log(`Alarm hersteld voor ${name} over ${Math.round((fireAt - now) / 1000)}s`);
      }
    }
  } catch (e) { console.error('Kon alarmen niet herstellen:', e); }
}

const app = express();
app.use(cors());
app.use(express.json());

// Serveer de gebouwde frontend (productie)
const DIST = path.join(__dirname, '..', 'dist');
if (fs.existsSync(DIST)) {
  app.use('/deegtimer', express.static(DIST));
  app.get('/deegtimer/*', (_, res) => res.sendFile(path.join(DIST, 'index.html')));
}

app.get('/api/vapid-public-key', (_, res) => {
  res.json({ publicKey: vapidKeys.publicKey });
});

app.post('/api/schedule', (req, res) => {
  const { subscription, timerId, name, emoji, fireAt } = req.body;
  if (!subscription || !timerId || !fireAt) return res.status(400).json({ error: 'Velden ontbreken' });
  scheduleAlarm(timerId, subscription, name, emoji, fireAt);
  res.json({ ok: true });
});

app.post('/api/cancel', (req, res) => {
  const { timerId } = req.body;
  if (alarms.has(timerId)) {
    clearTimeout(alarms.get(timerId).handle);
    alarms.delete(timerId);
    saveAlarms();
  }
  res.json({ ok: true });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`DeegTimer server actief op poort ${PORT}`));
