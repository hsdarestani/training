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

app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const seedTrainers = [
  {
    id: 'tr-lena', name: 'Lena Hoffmann', city: 'Frankfurt am Main', area: 'Westend',
    specialties: ['Strength', 'Mobility'], price: 85, rating: 4.9, reviews: 47,
    experience: 8, languages: ['Deutsch', 'English'],
    bio: 'Functional strength coaching with a calm, structured approach. Ideal for busy professionals who want measurable progress without fitness-industry noise.',
    image: 'https://images.unsplash.com/photo-1594381898411-846e7d193883?auto=format&fit=crop&w=900&q=85',
    venues: ['Outdoor', 'Gym', 'At your home'], verified: true,
    slots: ['07:00', '08:30', '17:00', '18:30']
  },
  {
    id: 'tr-david', name: 'David Klein', city: 'Frankfurt am Main', area: 'Sachsenhausen',
    specialties: ['Muscle gain', 'Body transformation'], price: 95, rating: 5.0, reviews: 61,
    experience: 10, languages: ['Deutsch', 'English'],
    bio: 'Evidence-based strength and body recomposition coaching. Clear plans, precise technique and training that fits your real week.',
    image: 'https://images.unsplash.com/photo-1567013127542-490d757e51fc?auto=format&fit=crop&w=900&q=85',
    venues: ['Gym', 'Outdoor'], verified: true,
    slots: ['06:30', '09:00', '16:30', '19:00']
  },
  {
    id: 'tr-aylin', name: 'Aylin Demir', city: 'Offenbach am Main', area: 'Zentrum',
    specialties: ['Weight loss', 'Nutrition'], price: 72, rating: 4.8, reviews: 34,
    experience: 6, languages: ['Deutsch', 'Türkçe', 'English'],
    bio: 'Sustainable fat-loss and fitness coaching without crash diets. Training, habits and nutrition in one practical system.',
    image: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=900&q=85',
    venues: ['At your home', 'Outdoor', 'Online'], verified: true,
    slots: ['08:00', '10:00', '15:30', '18:00']
  },
  {
    id: 'tr-jonas', name: 'Jonas Weber', city: 'Wiesbaden', area: 'Mitte',
    specialties: ['Running', 'Endurance'], price: 78, rating: 4.9, reviews: 29,
    experience: 7, languages: ['Deutsch', 'English'],
    bio: 'Running and conditioning coach for first 5Ks, faster race times and stronger everyday endurance.',
    image: 'https://images.unsplash.com/photo-1530137073520-4ea6e2f10a48?auto=format&fit=crop&w=900&q=85',
    venues: ['Outdoor', 'Online'], verified: true,
    slots: ['07:00', '12:00', '17:30', '19:30']
  },
  {
    id: 'tr-sophia', name: 'Sophia Martin', city: 'Mainz', area: 'Altstadt',
    specialties: ['Pilates', 'Mobility'], price: 80, rating: 4.9, reviews: 52,
    experience: 9, languages: ['Deutsch', 'English', 'Français'],
    bio: 'Private Pilates and mobility sessions focused on posture, core control and feeling better in your body.',
    image: 'https://images.unsplash.com/photo-1518310383802-640c2de311b2?auto=format&fit=crop&w=900&q=85',
    venues: ['Studio', 'At your home', 'Online'], verified: true,
    slots: ['08:30', '11:00', '16:00', '18:30']
  },
  {
    id: 'tr-emre', name: 'Emre Kaya', city: 'Darmstadt', area: 'Bessungen',
    specialties: ['Boxing', 'Conditioning'], price: 88, rating: 4.7, reviews: 23,
    experience: 5, languages: ['Deutsch', 'Türkçe'],
    bio: 'Technique-led boxing and conditioning for beginners and experienced athletes. Sharp sessions, no intimidation.',
    image: 'https://images.unsplash.com/photo-1549719386-74dfcbf7dbed?auto=format&fit=crop&w=900&q=85',
    venues: ['Gym', 'Outdoor'], verified: true,
    slots: ['09:00', '14:00', '17:00', '20:00']
  }
];

function ensureDb() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({ users: [], trainers: seedTrainers, bookings: [] }, null, 2));
  }
}

function readDb() {
  ensureDb();
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}

function writeDb(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

function safeUser(user) {
  const { passwordHash, ...safe } = user;
  return safe;
}

function sign(user) {
  return jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '30d' });
}

function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Please sign in first.' });
  try {
    req.auth = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Your session has expired.' });
  }
}

app.get('/api/health', (_req, res) => res.json({ ok: true, app: 'A+Trainer' }));

app.get('/api/trainers', (req, res) => {
  const db = readDb();
  const q = String(req.query.search || '').trim().toLowerCase();
  const city = String(req.query.city || '').trim().toLowerCase();
  const specialty = String(req.query.specialty || '').trim().toLowerCase();
  const maxPrice = Number(req.query.maxPrice || 0);

  let list = db.trainers.filter((t) => t.active !== false);
  if (q) list = list.filter((t) => [t.name, t.city, t.area, ...(t.specialties || [])].join(' ').toLowerCase().includes(q));
  if (city) list = list.filter((t) => `${t.city} ${t.area || ''}`.toLowerCase().includes(city));
  if (specialty) list = list.filter((t) => (t.specialties || []).some((s) => s.toLowerCase().includes(specialty)));
  if (maxPrice) list = list.filter((t) => Number(t.price) <= maxPrice);
  list.sort((a, b) => (b.rating || 0) - (a.rating || 0));
  res.json(list);
});

app.get('/api/trainers/:id', (req, res) => {
  const trainer = readDb().trainers.find((t) => t.id === req.params.id && t.active !== false);
  if (!trainer) return res.status(404).json({ error: 'Trainer not found.' });
  res.json(trainer);
});

app.post('/api/auth/register', async (req, res) => {
  const { role = 'client', name, email, password, phone = '', city = '', specialty = '' } = req.body || {};
  if (!['client', 'trainer'].includes(role)) return res.status(400).json({ error: 'Invalid account type.' });
  if (!name || !email || !password) return res.status(400).json({ error: 'Name, email and password are required.' });
  if (String(password).length < 6) return res.status(400).json({ error: 'Password must contain at least 6 characters.' });

  const db = readDb();
  if (db.users.some((u) => u.email.toLowerCase() === String(email).toLowerCase())) {
    return res.status(409).json({ error: 'An account with this email already exists.' });
  }

  const user = {
    id: uuid(), role, name: String(name).trim(), email: String(email).trim().toLowerCase(),
    phone: String(phone).trim(), city: String(city).trim(), passwordHash: await bcrypt.hash(password, 10),
    createdAt: new Date().toISOString()
  };

  if (role === 'trainer') {
    const trainerId = uuid();
    user.trainerId = trainerId;
    db.trainers.unshift({
      id: trainerId, userId: user.id, name: user.name, city: user.city || 'Frankfurt am Main', area: '',
      specialties: [specialty || 'Personal Training'], price: 75, rating: 5.0, reviews: 0, experience: 1,
      languages: ['Deutsch'], bio: 'Independent personal trainer on A+Trainer.',
      image: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=900&q=85',
      venues: ['Gym', 'Outdoor'], verified: false, slots: ['08:00', '12:00', '17:00'], active: true
    });
  }

  db.users.push(user);
  writeDb(db);
  res.status(201).json({ token: sign(user), user: safeUser(user) });
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body || {};
  const db = readDb();
  const user = db.users.find((u) => u.email.toLowerCase() === String(email || '').toLowerCase());
  if (!user || !(await bcrypt.compare(String(password || ''), user.passwordHash))) {
    return res.status(401).json({ error: 'Email or password is incorrect.' });
  }
  res.json({ token: sign(user), user: safeUser(user) });
});

app.get('/api/me', auth, (req, res) => {
  const user = readDb().users.find((u) => u.id === req.auth.id);
  if (!user) return res.status(404).json({ error: 'Account not found.' });
  res.json(safeUser(user));
});

app.patch('/api/me/trainer', auth, (req, res) => {
  const db = readDb();
  const user = db.users.find((u) => u.id === req.auth.id);
  if (!user || user.role !== 'trainer' || !user.trainerId) return res.status(403).json({ error: 'Trainer account required.' });
  const trainer = db.trainers.find((t) => t.id === user.trainerId);
  if (!trainer) return res.status(404).json({ error: 'Trainer profile not found.' });

  const allowed = ['name', 'city', 'area', 'price', 'bio', 'image', 'experience', 'languages', 'venues', 'slots', 'specialties'];
  allowed.forEach((key) => {
    if (req.body[key] !== undefined) trainer[key] = req.body[key];
  });
  writeDb(db);
  res.json(trainer);
});

app.get('/api/bookings', auth, (req, res) => {
  const db = readDb();
  const user = db.users.find((u) => u.id === req.auth.id);
  if (!user) return res.status(404).json({ error: 'Account not found.' });
  let list;
  if (user.role === 'trainer') list = db.bookings.filter((b) => b.trainerId === user.trainerId);
  else list = db.bookings.filter((b) => b.clientId === user.id);

  const enriched = list.map((b) => ({
    ...b,
    trainer: db.trainers.find((t) => t.id === b.trainerId) || null,
    client: safeUser(db.users.find((u) => u.id === b.clientId) || { id: b.clientId, name: 'Client' })
  })).sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
  res.json(enriched);
});

app.post('/api/bookings', auth, (req, res) => {
  const { trainerId, date, time, venue = 'Gym', note = '' } = req.body || {};
  const db = readDb();
  const user = db.users.find((u) => u.id === req.auth.id);
  if (!user) return res.status(404).json({ error: 'Account not found.' });
  if (user.role !== 'client') return res.status(403).json({ error: 'Use a client account to book a trainer.' });
  const trainer = db.trainers.find((t) => t.id === trainerId && t.active !== false);
  if (!trainer) return res.status(404).json({ error: 'Trainer not found.' });
  if (!date || !time) return res.status(400).json({ error: 'Choose a date and time.' });
  const chosen = new Date(`${date}T${time}:00`);
  if (Number.isNaN(chosen.getTime()) || chosen < new Date()) return res.status(400).json({ error: 'Please choose a future session.' });

  const conflict = db.bookings.some((b) => b.trainerId === trainerId && b.date === date && b.time === time && !['cancelled', 'declined'].includes(b.status));
  if (conflict) return res.status(409).json({ error: 'That slot has just been booked. Please choose another time.' });

  const booking = {
    id: uuid(), trainerId, clientId: user.id, date, time, venue, note: String(note).slice(0, 500),
    price: Number(trainer.price), status: 'confirmed', createdAt: new Date().toISOString()
  };
  db.bookings.push(booking);
  writeDb(db);
  res.status(201).json(booking);
});

app.patch('/api/bookings/:id', auth, (req, res) => {
  const db = readDb();
  const user = db.users.find((u) => u.id === req.auth.id);
  const booking = db.bookings.find((b) => b.id === req.params.id);
  if (!user || !booking) return res.status(404).json({ error: 'Booking not found.' });
  const owns = user.role === 'trainer' ? booking.trainerId === user.trainerId : booking.clientId === user.id;
  if (!owns) return res.status(403).json({ error: 'You cannot change this booking.' });

  const allowed = user.role === 'trainer' ? ['confirmed', 'completed', 'declined', 'cancelled'] : ['cancelled'];
  if (!allowed.includes(req.body.status)) return res.status(400).json({ error: 'Invalid booking status.' });
  booking.status = req.body.status;
  booking.updatedAt = new Date().toISOString();
  writeDb(db);
  res.json(booking);
});

app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found.' });
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

ensureDb();
app.listen(PORT, '0.0.0.0', () => console.log(`A+Trainer running on :${PORT}`));
