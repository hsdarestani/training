require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuid } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3087;
const JWT_SECRET = process.env.JWT_SECRET || 'a-trainer-development-secret';
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
let dbReady = false;

app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const seedTrainers = [
  {
    id: 'tr-lena', name: 'Lena Hoffmann', city: 'Frankfurt am Main', area: 'Westend',
    specialties: ['Krafttraining', 'Mobilität'], price: 85, rating: 4.9, reviews: 47,
    experience: 8, languages: ['Deutsch', 'Englisch'],
    bio: 'Funktionelles Krafttraining mit einem ruhigen, strukturierten Ansatz. Ideal für Berufstätige, die messbare Fortschritte ohne unnötigen Fitness-Hype möchten.',
    image: 'https://images.unsplash.com/photo-1594381898411-846e7d193883?auto=format&fit=crop&w=900&q=85',
    venues: ['Outdoor', 'Fitnessstudio', 'Bei dir zu Hause'], verified: true,
    slots: ['07:00', '08:30', '17:00', '18:30']
  },
  {
    id: 'tr-david', name: 'David Klein', city: 'Frankfurt am Main', area: 'Sachsenhausen',
    specialties: ['Muskelaufbau', 'Körpertransformation'], price: 95, rating: 5.0, reviews: 61,
    experience: 10, languages: ['Deutsch', 'Englisch'],
    bio: 'Evidenzbasiertes Krafttraining und Körperrekomposition. Klare Trainingspläne, saubere Technik und ein Konzept, das in deinen Alltag passt.',
    image: 'https://images.unsplash.com/photo-1567013127542-490d757e51fc?auto=format&fit=crop&w=900&q=85',
    venues: ['Fitnessstudio', 'Outdoor'], verified: true,
    slots: ['06:30', '09:00', '16:30', '19:00']
  },
  {
    id: 'tr-aylin', name: 'Aylin Demir', city: 'Offenbach am Main', area: 'Zentrum',
    specialties: ['Abnehmen', 'Ernährung'], price: 72, rating: 4.8, reviews: 34,
    experience: 6, languages: ['Deutsch', 'Türkisch', 'Englisch'],
    bio: 'Nachhaltiges Abnehmen und Fitness ohne Crash-Diäten. Training, Gewohnheiten und Ernährung in einem alltagstauglichen System.',
    image: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=900&q=85',
    venues: ['Bei dir zu Hause', 'Outdoor', 'Online'], verified: true,
    slots: ['08:00', '10:00', '15:30', '18:00']
  },
  {
    id: 'tr-jonas', name: 'Jonas Weber', city: 'Wiesbaden', area: 'Mitte',
    specialties: ['Laufen', 'Ausdauer'], price: 78, rating: 4.9, reviews: 29,
    experience: 7, languages: ['Deutsch', 'Englisch'],
    bio: 'Lauf- und Ausdauertraining für den ersten 5-km-Lauf, schnellere Wettkampfzeiten und mehr Kondition im Alltag.',
    image: 'https://images.unsplash.com/photo-1530137073520-4ea6e2f10a48?auto=format&fit=crop&w=900&q=85',
    venues: ['Outdoor', 'Online'], verified: true,
    slots: ['07:00', '12:00', '17:30', '19:30']
  },
  {
    id: 'tr-sophia', name: 'Sophia Martin', city: 'Mainz', area: 'Altstadt',
    specialties: ['Pilates', 'Mobilität'], price: 80, rating: 4.9, reviews: 52,
    experience: 9, languages: ['Deutsch', 'Englisch', 'Französisch'],
    bio: 'Private Pilates- und Mobilitätseinheiten mit Fokus auf Haltung, Rumpfstabilität und ein besseres Körpergefühl.',
    image: 'https://images.unsplash.com/photo-1518310383802-640c2de311b2?auto=format&fit=crop&w=900&q=85',
    venues: ['Studio', 'Bei dir zu Hause', 'Online'], verified: true,
    slots: ['08:30', '11:00', '16:00', '18:30']
  },
  {
    id: 'tr-emre', name: 'Emre Kaya', city: 'Darmstadt', area: 'Bessungen',
    specialties: ['Boxen', 'Kondition'], price: 88, rating: 4.7, reviews: 23,
    experience: 5, languages: ['Deutsch', 'Türkisch'],
    bio: 'Technikorientiertes Box- und Konditionstraining für Anfänger und Fortgeschrittene. Intensive Einheiten in einer entspannten Atmosphäre.',
    image: 'https://images.unsplash.com/photo-1549719386-74dfcbf7dbed?auto=format&fit=crop&w=900&q=85',
    venues: ['Fitnessstudio', 'Outdoor'], verified: true,
    slots: ['09:00', '14:00', '17:00', '20:00']
  }
];

function ensureDb() {
  if (dbReady) return;
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({ users: [], trainers: seedTrainers, bookings: [] }, null, 2));
    dbReady = true;
    return;
  }
  try {
    const db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    db.users = Array.isArray(db.users) ? db.users : [];
    db.trainers = Array.isArray(db.trainers) ? db.trainers : [];
    db.bookings = Array.isArray(db.bookings) ? db.bookings : [];
    for (const seed of seedTrainers) {
      const index = db.trainers.findIndex((t) => t.id === seed.id);
      if (index >= 0) db.trainers[index] = { ...db.trainers[index], ...seed };
      else db.trainers.push(seed);
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
  } catch {
    fs.writeFileSync(DB_FILE, JSON.stringify({ users: [], trainers: seedTrainers, bookings: [] }, null, 2));
  }
  dbReady = true;
}

function readDb() { ensureDb(); return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); }
function writeDb(db) { fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2)); }
function safeUser(user) { const { passwordHash, ...safe } = user; return safe; }
function sign(user) { return jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '30d' }); }
function cleanString(value, max = 300) { return String(value ?? '').trim().slice(0, max); }
function cleanList(value, maxItems = 12) {
  const arr = Array.isArray(value) ? value : String(value ?? '').split(',');
  return arr.map((v) => cleanString(v, 80)).filter(Boolean).slice(0, maxItems);
}

function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Bitte melde dich zuerst an.' });
  try { req.auth = jwt.verify(token, JWT_SECRET); next(); }
  catch { return res.status(401).json({ error: 'Deine Sitzung ist abgelaufen. Bitte melde dich erneut an.' }); }
}

app.get('/api/health', (_req, res) => res.json({ ok: true, app: 'A+Trainer' }));

app.get('/api/trainers', (req, res) => {
  const db = readDb();
  const q = cleanString(req.query.search, 100).toLowerCase();
  const city = cleanString(req.query.city, 100).toLowerCase();
  const specialty = cleanString(req.query.specialty, 100).toLowerCase();
  const maxPrice = Number(req.query.maxPrice || 0);
  let list = db.trainers.filter((t) => t.active !== false);
  if (q) list = list.filter((t) => [t.name, t.city, t.area, ...(t.specialties || [])].join(' ').toLowerCase().includes(q));
  if (city) list = list.filter((t) => `${t.city} ${t.area || ''}`.toLowerCase().includes(city));
  if (specialty) list = list.filter((t) => (t.specialties || []).some((s) => String(s).toLowerCase().includes(specialty)));
  if (maxPrice > 0) list = list.filter((t) => Number(t.price) <= maxPrice);
  list.sort((a, b) => (b.rating || 0) - (a.rating || 0));
  res.json(list);
});

app.get('/api/trainers/:id', (req, res) => {
  const trainer = readDb().trainers.find((t) => t.id === req.params.id && t.active !== false);
  if (!trainer) return res.status(404).json({ error: 'Trainer wurde nicht gefunden.' });
  res.json(trainer);
});

app.post('/api/auth/register', async (req, res) => {
  const { role = 'client', name, email, password, phone = '', city = '', specialty = '' } = req.body || {};
  if (!['client', 'trainer'].includes(role)) return res.status(400).json({ error: 'Ungültiger Kontotyp.' });
  if (!cleanString(name) || !cleanString(email) || !String(password || '')) return res.status(400).json({ error: 'Name, E-Mail und Passwort sind erforderlich.' });
  if (String(password).length < 6) return res.status(400).json({ error: 'Das Passwort muss mindestens 6 Zeichen lang sein.' });
  const normalizedEmail = cleanString(email, 200).toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) return res.status(400).json({ error: 'Bitte gib eine gültige E-Mail-Adresse ein.' });

  const db = readDb();
  if (db.users.some((u) => String(u.email).toLowerCase() === normalizedEmail)) return res.status(409).json({ error: 'Für diese E-Mail-Adresse gibt es bereits ein Konto.' });

  const user = {
    id: uuid(), role, name: cleanString(name, 120), email: normalizedEmail,
    phone: cleanString(phone, 50), city: cleanString(city, 120), passwordHash: await bcrypt.hash(String(password), 10),
    createdAt: new Date().toISOString()
  };

  if (role === 'trainer') {
    const trainerId = uuid();
    user.trainerId = trainerId;
    db.trainers.unshift({
      id: trainerId, userId: user.id, name: user.name, city: user.city || 'Frankfurt am Main', area: '',
      specialties: [cleanString(specialty, 80) || 'Personal Training'], price: 75, rating: 5.0, reviews: 0, experience: 1,
      languages: ['Deutsch'], bio: 'Selbstständiger Personal Trainer auf A+Trainer.',
      image: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=900&q=85',
      venues: ['Fitnessstudio', 'Outdoor'], verified: false, slots: ['08:00', '12:00', '17:00'], active: true
    });
  }

  db.users.push(user); writeDb(db);
  res.status(201).json({ token: sign(user), user: safeUser(user) });
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body || {};
  const db = readDb();
  const user = db.users.find((u) => String(u.email).toLowerCase() === cleanString(email, 200).toLowerCase());
  if (!user || !(await bcrypt.compare(String(password || ''), user.passwordHash))) return res.status(401).json({ error: 'E-Mail oder Passwort ist falsch.' });
  res.json({ token: sign(user), user: safeUser(user) });
});

app.get('/api/me', auth, (req, res) => {
  const user = readDb().users.find((u) => u.id === req.auth.id);
  if (!user) return res.status(404).json({ error: 'Konto wurde nicht gefunden.' });
  res.json(safeUser(user));
});

app.patch('/api/me/trainer', auth, (req, res) => {
  const db = readDb();
  const user = db.users.find((u) => u.id === req.auth.id);
  if (!user || user.role !== 'trainer' || !user.trainerId) return res.status(403).json({ error: 'Für diese Aktion ist ein Trainerkonto erforderlich.' });
  const trainer = db.trainers.find((t) => t.id === user.trainerId);
  if (!trainer) return res.status(404).json({ error: 'Trainerprofil wurde nicht gefunden.' });

  const body = req.body || {};
  if (body.name !== undefined) trainer.name = cleanString(body.name, 120) || trainer.name;
  if (body.city !== undefined) trainer.city = cleanString(body.city, 120) || trainer.city;
  if (body.area !== undefined) trainer.area = cleanString(body.area, 120);
  if (body.bio !== undefined) trainer.bio = cleanString(body.bio, 1200);
  if (body.image !== undefined) trainer.image = cleanString(body.image, 1000);
  if (body.price !== undefined) trainer.price = Math.max(0, Math.min(10000, Number(body.price) || 0));
  if (body.experience !== undefined) trainer.experience = Math.max(0, Math.min(80, Number(body.experience) || 0));
  if (body.languages !== undefined) trainer.languages = cleanList(body.languages);
  if (body.venues !== undefined) trainer.venues = cleanList(body.venues);
  if (body.slots !== undefined) trainer.slots = cleanList(body.slots, 24).filter((s) => /^([01]\d|2[0-3]):[0-5]\d$/.test(s));
  if (body.specialties !== undefined) trainer.specialties = cleanList(body.specialties);
  user.name = trainer.name; user.city = trainer.city;
  writeDb(db);
  res.json(trainer);
});

app.get('/api/bookings', auth, (req, res) => {
  const db = readDb();
  const user = db.users.find((u) => u.id === req.auth.id);
  if (!user) return res.status(404).json({ error: 'Konto wurde nicht gefunden.' });
  const list = user.role === 'trainer' ? db.bookings.filter((b) => b.trainerId === user.trainerId) : db.bookings.filter((b) => b.clientId === user.id);
  const enriched = list.map((b) => ({
    ...b,
    trainer: db.trainers.find((t) => t.id === b.trainerId) || null,
    client: safeUser(db.users.find((u) => u.id === b.clientId) || { id: b.clientId, name: 'Kunde' })
  })).sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
  res.json(enriched);
});

app.post('/api/bookings', auth, (req, res) => {
  const { trainerId, date, time, venue = 'Fitnessstudio', note = '' } = req.body || {};
  const db = readDb();
  const user = db.users.find((u) => u.id === req.auth.id);
  if (!user) return res.status(404).json({ error: 'Konto wurde nicht gefunden.' });
  if (user.role !== 'client') return res.status(403).json({ error: 'Bitte verwende ein Kundenkonto, um einen Trainer zu buchen.' });
  const trainer = db.trainers.find((t) => t.id === trainerId && t.active !== false);
  if (!trainer) return res.status(404).json({ error: 'Trainer wurde nicht gefunden.' });
  if (!date || !time) return res.status(400).json({ error: 'Bitte wähle Datum und Uhrzeit.' });
  if (!(trainer.slots || []).includes(String(time))) return res.status(400).json({ error: 'Diese Uhrzeit wird von diesem Trainer nicht angeboten.' });
  if (!(trainer.venues || []).includes(String(venue))) return res.status(400).json({ error: 'Bitte wähle einen angebotenen Trainingsort.' });
  const chosen = new Date(`${date}T${time}:00`);
  if (Number.isNaN(chosen.getTime()) || chosen <= new Date()) return res.status(400).json({ error: 'Bitte wähle einen zukünftigen Termin.' });

  const conflict = db.bookings.some((b) => b.trainerId === trainerId && b.date === date && b.time === time && !['cancelled', 'declined'].includes(b.status));
  if (conflict) return res.status(409).json({ error: 'Dieser Termin wurde gerade gebucht. Bitte wähle eine andere Uhrzeit.' });

  const booking = {
    id: uuid(), trainerId, clientId: user.id, date:String(date), time:String(time), venue:String(venue), note:cleanString(note, 500),
    price:Number(trainer.price), status:'confirmed', createdAt:new Date().toISOString()
  };
  db.bookings.push(booking); writeDb(db);
  res.status(201).json(booking);
});

app.patch('/api/bookings/:id', auth, (req, res) => {
  const db = readDb();
  const user = db.users.find((u) => u.id === req.auth.id);
  const booking = db.bookings.find((b) => b.id === req.params.id);
  if (!user || !booking) return res.status(404).json({ error: 'Buchung wurde nicht gefunden.' });
  const owns = user.role === 'trainer' ? booking.trainerId === user.trainerId : booking.clientId === user.id;
  if (!owns) return res.status(403).json({ error: 'Du kannst diese Buchung nicht ändern.' });
  const allowed = user.role === 'trainer' ? ['confirmed', 'completed', 'declined', 'cancelled'] : ['cancelled'];
  if (!allowed.includes(req.body.status)) return res.status(400).json({ error: 'Ungültiger Buchungsstatus.' });
  booking.status = req.body.status;
  booking.updatedAt = new Date().toISOString();
  writeDb(db); res.json(booking);
});

app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Nicht gefunden.' });
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

ensureDb();
app.listen(PORT, '0.0.0.0', () => console.log(`A+Trainer läuft auf Port ${PORT}`));
