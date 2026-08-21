require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const https = require('https');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuid } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3087;
const JWT_SECRET = process.env.JWT_SECRET || 'a-trainer-development-secret';
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const APP_URL = process.env.APP_URL || 'https://training.smarbiz.sbs';
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';

app.disable('x-powered-by');
app.use(express.json({ limit: '3mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const cityCoordinates = {
  'Frankfurt am Main': [50.1109, 8.6821],
  'Offenbach am Main': [50.0956, 8.7761],
  'Wiesbaden': [50.0782, 8.2398],
  'Mainz': [49.9929, 8.2473],
  'Darmstadt': [49.8728, 8.6512]
};

const defaultAvailability = (slots = ['08:00', '12:00', '17:00']) => ({
  0: [], 1: slots, 2: slots, 3: slots, 4: slots, 5: slots, 6: ['09:00', '11:00']
});

const seedTrainers = [
  {
    id: 'tr-lena', name: 'Lena Hoffmann', headline: 'Functional Strength & Mobility Coach', city: 'Frankfurt am Main', area: 'Westend', lat: 50.1164, lng: 8.6697,
    specialties: ['Krafttraining', 'Mobilität'], trainingTypes: ['1:1 Personal Training', 'Functional Training'], price: 85, rating: 4.9, reviews: 47,
    experience: 8, languages: ['Deutsch', 'Englisch'], certifications: ['B-Lizenz Fitnesstrainer', 'Functional Training Coach'],
    bio: 'Strukturiertes Kraft- und Mobility-Coaching für Menschen, die messbare Fortschritte wollen. Technik, Alltagstauglichkeit und nachhaltige Routinen stehen im Mittelpunkt.',
    image: 'https://images.unsplash.com/photo-1594381898411-846e7d193883?auto=format&fit=crop&w=900&q=85',
    gallery: [], venues: ['Outdoor', 'Fitnessstudio', 'Bei dir zu Hause'], verified: true,
    slots: ['07:00', '08:30', '17:00', '18:30'], availability: defaultAvailability(['07:00','08:30','17:00','18:30']), blockedDates: []
  },
  {
    id: 'tr-david', name: 'David Klein', headline: 'Kraftaufbau & Körpertransformation', city: 'Frankfurt am Main', area: 'Sachsenhausen', lat: 50.1012, lng: 8.6869,
    specialties: ['Muskelaufbau', 'Körpertransformation'], trainingTypes: ['Krafttraining', 'Hypertrophie'], price: 95, rating: 5.0, reviews: 61,
    experience: 10, languages: ['Deutsch', 'Englisch'], certifications: ['A-Lizenz Fitnesstrainer', 'Personal Trainer'],
    bio: 'Evidenzbasiertes Kraft- und Körperkompositions-Coaching mit klaren Plänen, sauberer Technik und einem System, das in deinen Alltag passt.',
    image: 'https://images.unsplash.com/photo-1567013127542-490d757e51fc?auto=format&fit=crop&w=900&q=85',
    gallery: [], venues: ['Fitnessstudio', 'Outdoor'], verified: true,
    slots: ['06:30', '09:00', '16:30', '19:00'], availability: defaultAvailability(['06:30','09:00','16:30','19:00']), blockedDates: []
  },
  {
    id: 'tr-aylin', name: 'Aylin Demir', headline: 'Abnehmen, Ernährung & nachhaltige Routinen', city: 'Offenbach am Main', area: 'Zentrum', lat: 50.1054, lng: 8.7617,
    specialties: ['Abnehmen', 'Ernährung'], trainingTypes: ['1:1 Coaching', 'Ernährungscoaching'], price: 72, rating: 4.8, reviews: 34,
    experience: 6, languages: ['Deutsch', 'Türkisch', 'Englisch'], certifications: ['Ernährungsberaterin', 'Fitnesstrainerin B-Lizenz'],
    bio: 'Nachhaltiges Abnehm- und Fitnesscoaching ohne Crash-Diäten. Training, Gewohnheiten und Ernährung werden zu einem praktikablen System verbunden.',
    image: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=900&q=85',
    gallery: [], venues: ['Bei dir zu Hause', 'Outdoor', 'Online'], verified: true,
    slots: ['08:00', '10:00', '15:30', '18:00'], availability: defaultAvailability(['08:00','10:00','15:30','18:00']), blockedDates: []
  },
  {
    id: 'tr-jonas', name: 'Jonas Weber', headline: 'Laufcoach & Ausdauertrainer', city: 'Wiesbaden', area: 'Mitte', lat: 50.0817, lng: 8.2451,
    specialties: ['Laufen', 'Ausdauer'], trainingTypes: ['Lauftraining', 'Conditioning'], price: 78, rating: 4.9, reviews: 29,
    experience: 7, languages: ['Deutsch', 'Englisch'], certifications: ['Lauftrainer', 'Athletiktrainer'],
    bio: 'Vom ersten 5-km-Lauf bis zur neuen Bestzeit: individuelles Lauf- und Konditionstraining mit klarer Belastungssteuerung.',
    image: 'https://images.unsplash.com/photo-1530137073520-4ea6e2f10a48?auto=format&fit=crop&w=900&q=85',
    gallery: [], venues: ['Outdoor', 'Online'], verified: true,
    slots: ['07:00', '12:00', '17:30', '19:30'], availability: defaultAvailability(['07:00','12:00','17:30','19:30']), blockedDates: []
  },
  {
    id: 'tr-sophia', name: 'Sophia Martin', headline: 'Pilates, Core & Mobility', city: 'Mainz', area: 'Altstadt', lat: 49.9984, lng: 8.2691,
    specialties: ['Pilates', 'Mobilität'], trainingTypes: ['Pilates', 'Mobility'], price: 80, rating: 4.9, reviews: 52,
    experience: 9, languages: ['Deutsch', 'Englisch', 'Französisch'], certifications: ['Pilates Trainerin', 'Mobility Coach'],
    bio: 'Private Pilates- und Mobility-Einheiten mit Fokus auf Haltung, Core-Kontrolle und ein besseres Körpergefühl.',
    image: 'https://images.unsplash.com/photo-1518310383802-640c2de311b2?auto=format&fit=crop&w=900&q=85',
    gallery: [], venues: ['Studio', 'Bei dir zu Hause', 'Online'], verified: true,
    slots: ['08:30', '11:00', '16:00', '18:30'], availability: defaultAvailability(['08:30','11:00','16:00','18:30']), blockedDates: []
  },
  {
    id: 'tr-emre', name: 'Emre Kaya', headline: 'Boxen & Kondition für jedes Level', city: 'Darmstadt', area: 'Bessungen', lat: 49.8588, lng: 8.6518,
    specialties: ['Boxen', 'Kondition'], trainingTypes: ['Boxtraining', 'Conditioning'], price: 88, rating: 4.7, reviews: 23,
    experience: 5, languages: ['Deutsch', 'Türkisch'], certifications: ['Boxtrainer', 'Athletiktrainer'],
    bio: 'Technikorientiertes Box- und Konditionstraining für Anfänger und Fortgeschrittene. Intensiv, klar und ohne Einschüchterung.',
    image: 'https://images.unsplash.com/photo-1549719386-74dfcbf7dbed?auto=format&fit=crop&w=900&q=85',
    gallery: [], venues: ['Fitnessstudio', 'Outdoor'], verified: true,
    slots: ['09:00', '14:00', '17:00', '20:00'], availability: defaultAvailability(['09:00','14:00','17:00','20:00']), blockedDates: []
  }
];

const specialtyMap = {
  Strength:'Krafttraining', 'Muscle gain':'Muskelaufbau', 'Body transformation':'Körpertransformation',
  'Weight loss':'Abnehmen', Nutrition:'Ernährung', Mobility:'Mobilität', Running:'Laufen', Endurance:'Ausdauer',
  Boxing:'Boxen', Conditioning:'Kondition', Pilates:'Pilates', 'Personal Training':'Personal Training'
};
const venueMap = { Gym:'Fitnessstudio', 'At your home':'Bei dir zu Hause', Outdoor:'Outdoor', Online:'Online', Studio:'Studio' };

function asArray(value) {
  if (Array.isArray(value)) return value.filter(Boolean).map((x) => String(x).trim()).filter(Boolean);
  if (!value) return [];
  return String(value).split(',').map((x) => x.trim()).filter(Boolean);
}
function num(value, fallback = 0) { const n = Number(value); return Number.isFinite(n) ? n : fallback; }
function normalizeAvailability(value, fallbackSlots) {
  const out = {};
  for (let i = 0; i < 7; i++) out[i] = asArray(value?.[i] || value?.[String(i)] || (i > 0 && i < 6 ? fallbackSlots : i === 6 ? fallbackSlots.slice(0, 2) : []));
  return out;
}

function ensureDb() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({ users: [], trainers: seedTrainers, bookings: [], messages: [], reviews: [] }, null, 2));
    return;
  }
  const db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  db.users ||= []; db.trainers ||= []; db.bookings ||= []; db.messages ||= []; db.reviews ||= [];
  if (!db.trainers.length) db.trainers = seedTrainers;
  for (const t of db.trainers) {
    t.specialties = asArray(t.specialties).map((x) => specialtyMap[x] || x);
    t.venues = asArray(t.venues).map((x) => venueMap[x] || x);
    t.trainingTypes = asArray(t.trainingTypes || t.specialties);
    t.languages = asArray(t.languages || ['Deutsch']).map((x) => x === 'English' ? 'Englisch' : x);
    t.certifications = asArray(t.certifications);
    t.gallery = asArray(t.gallery);
    t.blockedDates = asArray(t.blockedDates);
    t.slots = asArray(t.slots || ['08:00','12:00','17:00']);
    t.availability = normalizeAvailability(t.availability, t.slots);
    t.headline ||= `${t.specialties[0] || 'Personal Training'} · Personal Trainer`;
    t.bio ||= 'Professionelles Personal Training mit individueller Betreuung.';
    if (!Number.isFinite(Number(t.lat)) || !Number.isFinite(Number(t.lng))) {
      const c = cityCoordinates[t.city]; if (c) { t.lat = c[0]; t.lng = c[1]; }
    }
  }
  for (const u of db.users) {
    u.area ||= ''; u.avatar ||= ''; u.bio ||= ''; u.goals = asArray(u.goals); u.preferredTraining = asArray(u.preferredTraining);
    u.languages = asArray(u.languages || ['Deutsch']); u.fitnessLevel ||= ''; u.lat = u.lat ?? null; u.lng = u.lng ?? null;
  }
  for (const b of db.bookings) {
    b.paymentMethod ||= 'vor_ort'; b.paymentStatus ||= 'offen'; b.currency ||= 'EUR';
  }
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}
function readDb() { ensureDb(); return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); }
function writeDb(db) { fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2)); }

function safeUser(user) { if (!user) return null; const { passwordHash, ...safe } = user; return safe; }
function publicClient(user) {
  if (!user) return null;
  return { id:user.id, name:user.name, avatar:user.avatar || '', bio:user.bio || '', city:user.city || '', area:user.area || '', goals:user.goals || [], fitnessLevel:user.fitnessLevel || '', preferredTraining:user.preferredTraining || [], languages:user.languages || ['Deutsch'] };
}
function sign(user) { return jwt.sign({ id:user.id, role:user.role }, JWT_SECRET, { expiresIn:'30d' }); }
function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error:'Bitte melde dich zuerst an.' });
  try { req.auth = jwt.verify(token, JWT_SECRET); next(); }
  catch { return res.status(401).json({ error:'Deine Sitzung ist abgelaufen. Bitte melde dich erneut an.' }); }
}
function distanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371, r = (v) => v * Math.PI / 180;
  const dLat = r(lat2-lat1), dLon = r(lon2-lon1);
  const a = Math.sin(dLat/2)**2 + Math.cos(r(lat1))*Math.cos(r(lat2))*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}
function ratingFor(db, trainer) {
  const list = db.reviews.filter((r) => r.trainerId === trainer.id);
  if (!list.length) return { rating:num(trainer.rating, 5), reviewCount:num(trainer.reviews, 0) };
  return { rating:list.reduce((s,r) => s + num(r.rating), 0)/list.length, reviewCount:list.length };
}
function hydrateTrainer(db, trainer, origin) {
  const r = ratingFor(db, trainer);
  const result = { ...trainer, rating:r.rating, reviews:r.reviewCount, reviewCount:r.reviewCount };
  if (origin && Number.isFinite(Number(trainer.lat)) && Number.isFinite(Number(trainer.lng))) result.distanceKm = distanceKm(origin.lat, origin.lng, Number(trainer.lat), Number(trainer.lng));
  return result;
}
function findUser(db, id) { return db.users.find((u) => u.id === id); }
function findBookingForUser(db, id, user) {
  const b = db.bookings.find((x) => x.id === id);
  if (!b || !user) return null;
  const owns = user.role === 'trainer' ? b.trainerId === user.trainerId : b.clientId === user.id;
  return owns ? b : null;
}
function availableSlots(db, trainer, date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return [];
  if ((trainer.blockedDates || []).includes(date)) return [];
  const day = new Date(`${date}T12:00:00`).getDay();
  const base = asArray(trainer.availability?.[day] || trainer.availability?.[String(day)] || trainer.slots);
  return base.filter((time) => !db.bookings.some((b) => b.trainerId === trainer.id && b.date === date && b.time === time && !['cancelled','declined'].includes(b.status)));
}

function stripeRequest(method, endpoint, fields) {
  return new Promise((resolve, reject) => {
    const body = fields ? new URLSearchParams(fields).toString() : '';
    const req = https.request({ hostname:'api.stripe.com', path:`/v1${endpoint}`, method, headers:{ Authorization:`Bearer ${STRIPE_SECRET_KEY}`, ...(body ? {'Content-Type':'application/x-www-form-urlencoded','Content-Length':Buffer.byteLength(body)} : {}) } }, (res) => {
      let raw=''; res.on('data',(d)=>raw+=d); res.on('end',()=>{
        let data={}; try { data=JSON.parse(raw); } catch {}
        if (res.statusCode >= 200 && res.statusCode < 300) resolve(data); else reject(new Error(data?.error?.message || 'Stripe-Zahlung konnte nicht vorbereitet werden.'));
      });
    });
    req.on('error', reject); if (body) req.write(body); req.end();
  });
}

app.get('/api/health', (_req,res) => res.json({ ok:true, app:'A+Trainer', version:'2.0' }));
app.get('/api/config', (_req,res) => res.json({ stripeEnabled:Boolean(STRIPE_SECRET_KEY), currency:'EUR' }));

app.get('/api/trainers', (req,res) => {
  const db=readDb(); const q=String(req.query.search||'').trim().toLowerCase(); const specialty=String(req.query.specialty||'').trim().toLowerCase(); const maxPrice=num(req.query.maxPrice); const radius=num(req.query.radius, 50);
  const lat=Number(req.query.lat), lng=Number(req.query.lng); const origin=Number.isFinite(lat)&&Number.isFinite(lng)?{lat,lng}:null;
  let list=db.trainers.filter((t)=>t.active!==false).map((t)=>hydrateTrainer(db,t,origin));
  if(q) list=list.filter((t)=>[t.name,t.headline,t.city,t.area,t.bio,...(t.specialties||[]),...(t.trainingTypes||[])].join(' ').toLowerCase().includes(q));
  if(specialty) list=list.filter((t)=>(t.specialties||[]).some((s)=>s.toLowerCase().includes(specialty)));
  if(maxPrice) list=list.filter((t)=>num(t.price)<=maxPrice);
  if(origin) list=list.filter((t)=>t.distanceKm==null || t.distanceKm<=radius).sort((a,b)=>(a.distanceKm??999)-(b.distanceKm??999) || b.rating-a.rating);
  else list.sort((a,b)=>b.rating-a.rating);
  res.json(list);
});
app.get('/api/trainers/:id', (req,res) => {
  const db=readDb(); const t=db.trainers.find((x)=>x.id===req.params.id&&x.active!==false); if(!t) return res.status(404).json({error:'Trainer nicht gefunden.'});
  const reviews=db.reviews.filter((r)=>r.trainerId===t.id).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,8).map((r)=>({ ...r, clientName:findUser(db,r.clientId)?.name || 'Kunde' }));
  res.json({ ...hydrateTrainer(db,t), recentReviews:reviews });
});
app.get('/api/trainers/:id/availability', (req,res) => {
  const db=readDb(); const t=db.trainers.find((x)=>x.id===req.params.id&&x.active!==false); if(!t) return res.status(404).json({error:'Trainer nicht gefunden.'});
  const date=String(req.query.date||''); if(!date) return res.status(400).json({error:'Bitte wähle ein Datum.'});
  res.json({ date, slots:availableSlots(db,t,date) });
});
app.get('/api/trainers/:id/reviews', (req,res) => {
  const db=readDb(); res.json(db.reviews.filter((r)=>r.trainerId===req.params.id).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).map((r)=>({ ...r, clientName:findUser(db,r.clientId)?.name || 'Kunde' })));
});

app.post('/api/auth/register', async (req,res) => {
  const { role='client', name, email, password, phone='', city='', specialty='', goal='', fitnessLevel='', headline='' }=req.body||{};
  if(!['client','trainer'].includes(role)) return res.status(400).json({error:'Ungültiger Kontotyp.'});
  if(!name||!email||!password) return res.status(400).json({error:'Name, E-Mail und Passwort sind erforderlich.'});
  if(String(password).length<6) return res.status(400).json({error:'Das Passwort muss mindestens 6 Zeichen enthalten.'});
  const db=readDb(); if(db.users.some((u)=>u.email.toLowerCase()===String(email).toLowerCase())) return res.status(409).json({error:'Mit dieser E-Mail-Adresse besteht bereits ein Konto.'});
  const user={ id:uuid(), role, name:String(name).trim(), email:String(email).trim().toLowerCase(), phone:String(phone).trim(), city:String(city).trim(), area:'', avatar:'', bio:'', goals:goal?[String(goal).trim()]:[], fitnessLevel:String(fitnessLevel||''), preferredTraining:[], languages:['Deutsch'], lat:null, lng:null, passwordHash:await bcrypt.hash(password,10), createdAt:new Date().toISOString() };
  if(role==='trainer') {
    const trainerId=uuid(); user.trainerId=trainerId; const coords=cityCoordinates[user.city]||[null,null];
    db.trainers.unshift({ id:trainerId,userId:user.id,name:user.name,headline:String(headline||`${specialty||'Personal Training'} · Personal Trainer`),city:user.city||'Frankfurt am Main',area:'',lat:coords[0],lng:coords[1],specialties:[specialty||'Personal Training'],trainingTypes:[specialty||'Personal Training'],price:75,rating:5,reviews:0,experience:1,languages:['Deutsch'],certifications:[],bio:'Ergänze dein Profil, damit Kunden sofort sehen, was dein Training besonders macht.',image:'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=900&q=85',gallery:[],venues:['Fitnessstudio','Outdoor'],verified:false,slots:['08:00','12:00','17:00'],availability:defaultAvailability(['08:00','12:00','17:00']),blockedDates:[],active:true });
  }
  db.users.push(user); writeDb(db); res.status(201).json({token:sign(user),user:safeUser(user)});
});
app.post('/api/auth/login', async (req,res) => {
  const {email,password}=req.body||{}; const db=readDb(); const user=db.users.find((u)=>u.email.toLowerCase()===String(email||'').toLowerCase());
  if(!user||!(await bcrypt.compare(String(password||''),user.passwordHash))) return res.status(401).json({error:'E-Mail oder Passwort ist nicht korrekt.'});
  res.json({token:sign(user),user:safeUser(user)});
});
app.get('/api/me', auth, (req,res) => { const u=findUser(readDb(),req.auth.id); if(!u)return res.status(404).json({error:'Konto nicht gefunden.'}); res.json(safeUser(u)); });
app.patch('/api/me/profile', auth, (req,res) => {
  const db=readDb(); const user=findUser(db,req.auth.id); if(!user)return res.status(404).json({error:'Konto nicht gefunden.'});
  const scalar=['name','phone','city','area','avatar','bio','fitnessLevel']; for(const k of scalar) if(req.body[k]!==undefined) user[k]=String(req.body[k]).trim();
  for(const k of ['goals','preferredTraining','languages']) if(req.body[k]!==undefined) user[k]=asArray(req.body[k]);
  if(req.body.lat!==undefined) user.lat=Number.isFinite(Number(req.body.lat))?Number(req.body.lat):null; if(req.body.lng!==undefined) user.lng=Number.isFinite(Number(req.body.lng))?Number(req.body.lng):null;
  if(user.role==='trainer'&&user.trainerId){ const t=db.trainers.find((x)=>x.id===user.trainerId); if(t){ t.name=user.name;t.city=user.city;t.area=user.area;t.lat=user.lat??t.lat;t.lng=user.lng??t.lng;if(user.avatar)t.image=user.avatar; } }
  writeDb(db); res.json(safeUser(user));
});
app.patch('/api/me/trainer', auth, (req,res) => {
  const db=readDb(); const user=findUser(db,req.auth.id); if(!user||user.role!=='trainer'||!user.trainerId)return res.status(403).json({error:'Ein Trainerkonto ist erforderlich.'});
  const t=db.trainers.find((x)=>x.id===user.trainerId); if(!t)return res.status(404).json({error:'Trainerprofil nicht gefunden.'});
  for(const k of ['name','headline','city','area','bio','image']) if(req.body[k]!==undefined)t[k]=String(req.body[k]).trim();
  for(const k of ['specialties','trainingTypes','languages','certifications','venues','gallery','blockedDates']) if(req.body[k]!==undefined)t[k]=asArray(req.body[k]);
  if(req.body.price!==undefined){const v=num(req.body.price,-1);if(v<0||v>2000)return res.status(400).json({error:'Bitte gib einen gültigen Preis ein.'});t.price=v;}
  if(req.body.experience!==undefined)t.experience=Math.max(0,Math.min(60,num(req.body.experience)));
  if(req.body.lat!==undefined)t.lat=Number.isFinite(Number(req.body.lat))?Number(req.body.lat):t.lat; if(req.body.lng!==undefined)t.lng=Number.isFinite(Number(req.body.lng))?Number(req.body.lng):t.lng;
  if(req.body.availability!==undefined)t.availability=normalizeAvailability(req.body.availability,t.slots||[]);
  t.slots=[...new Set(Object.values(t.availability||{}).flat())].sort();
  user.name=t.name;user.city=t.city;user.area=t.area;user.avatar=t.image;user.lat=t.lat;user.lng=t.lng;
  writeDb(db);res.json(hydrateTrainer(db,t));
});

app.get('/api/bookings', auth, (req,res) => {
  const db=readDb(); const user=findUser(db,req.auth.id); if(!user)return res.status(404).json({error:'Konto nicht gefunden.'});
  let list=user.role==='trainer'?db.bookings.filter((b)=>b.trainerId===user.trainerId):db.bookings.filter((b)=>b.clientId===user.id);
  res.json(list.map((b)=>({ ...b,trainer:db.trainers.find((t)=>t.id===b.trainerId)||null,client:publicClient(findUser(db,b.clientId)),messagesCount:db.messages.filter((m)=>m.bookingId===b.id).length,review:db.reviews.find((r)=>r.bookingId===b.id)||null })).sort((a,b)=>`${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`)));
});
app.get('/api/calendar', auth, (req,res) => {
  const db=readDb(); const user=findUser(db,req.auth.id); if(!user)return res.status(404).json({error:'Konto nicht gefunden.'});
  const from=String(req.query.from||new Date().toISOString().slice(0,10)),to=String(req.query.to||'9999-12-31'); const list=(user.role==='trainer'?db.bookings.filter((b)=>b.trainerId===user.trainerId):db.bookings.filter((b)=>b.clientId===user.id)).filter((b)=>b.date>=from&&b.date<=to&&!['cancelled','declined'].includes(b.status)); res.json(list);
});
app.post('/api/bookings', auth, (req,res) => {
  const {trainerId,date,time,venue='Fitnessstudio',note='',paymentMethod='vor_ort'}=req.body||{}; const db=readDb(); const user=findUser(db,req.auth.id); if(!user)return res.status(404).json({error:'Konto nicht gefunden.'}); if(user.role!=='client')return res.status(403).json({error:'Bitte nutze ein Kundenkonto, um einen Trainer zu buchen.'});
  const t=db.trainers.find((x)=>x.id===trainerId&&x.active!==false); if(!t)return res.status(404).json({error:'Trainer nicht gefunden.'}); if(!date||!time)return res.status(400).json({error:'Bitte wähle Datum und Uhrzeit.'});
  const chosen=new Date(`${date}T${time}:00`); if(Number.isNaN(chosen.getTime())||chosen<new Date())return res.status(400).json({error:'Bitte wähle einen zukünftigen Termin.'});
  if(!availableSlots(db,t,date).includes(time))return res.status(409).json({error:'Diese Uhrzeit ist nicht mehr verfügbar. Bitte wähle einen anderen Termin.'});
  if(t.venues?.length&&!t.venues.includes(venue))return res.status(400).json({error:'Dieser Trainingsort wird vom Trainer nicht angeboten.'});
  const booking={id:uuid(),trainerId,clientId:user.id,date,time,venue,note:String(note).slice(0,500),price:num(t.price),currency:'EUR',status:'confirmed',paymentMethod:paymentMethod==='stripe'?'stripe':'vor_ort',paymentStatus:'offen',createdAt:new Date().toISOString()}; db.bookings.push(booking);writeDb(db);res.status(201).json(booking);
});
app.patch('/api/bookings/:id', auth, (req,res) => {
  const db=readDb(); const user=findUser(db,req.auth.id); const b=findBookingForUser(db,req.params.id,user); if(!b)return res.status(404).json({error:'Buchung nicht gefunden.'});
  const allowed=user.role==='trainer'?['confirmed','completed','declined','cancelled']:['cancelled']; if(!allowed.includes(req.body.status))return res.status(400).json({error:'Ungültiger Buchungsstatus.'}); b.status=req.body.status;b.updatedAt=new Date().toISOString();writeDb(db);res.json(b);
});

app.get('/api/bookings/:id/messages', auth, (req,res) => {
  const db=readDb();const user=findUser(db,req.auth.id);const b=findBookingForUser(db,req.params.id,user);if(!b)return res.status(404).json({error:'Buchung nicht gefunden.'});
  res.json(db.messages.filter((m)=>m.bookingId===b.id).sort((a,b)=>a.createdAt.localeCompare(b.createdAt)).map((m)=>({ ...m,senderName:findUser(db,m.senderId)?.name||'A+Trainer' })));
});
app.post('/api/bookings/:id/messages', auth, (req,res) => {
  const text=String(req.body?.text||'').trim(); if(!text)return res.status(400).json({error:'Bitte schreibe eine Nachricht.'}); if(text.length>2000)return res.status(400).json({error:'Die Nachricht ist zu lang.'});
  const db=readDb();const user=findUser(db,req.auth.id);const b=findBookingForUser(db,req.params.id,user);if(!b)return res.status(404).json({error:'Buchung nicht gefunden.'});
  const m={id:uuid(),bookingId:b.id,senderId:user.id,text,createdAt:new Date().toISOString()};db.messages.push(m);writeDb(db);res.status(201).json({...m,senderName:user.name});
});

app.post('/api/bookings/:id/review', auth, (req,res) => {
  const db=readDb();const user=findUser(db,req.auth.id);const b=findBookingForUser(db,req.params.id,user);if(!b)return res.status(404).json({error:'Buchung nicht gefunden.'});if(user.role!=='client')return res.status(403).json({error:'Nur Kunden können Bewertungen abgeben.'});if(b.status!=='completed')return res.status(400).json({error:'Bewertungen sind nach einer abgeschlossenen Einheit möglich.'});if(db.reviews.some((r)=>r.bookingId===b.id))return res.status(409).json({error:'Diese Einheit wurde bereits bewertet.'});
  const rating=num(req.body.rating);if(rating<1||rating>5)return res.status(400).json({error:'Bitte wähle 1 bis 5 Sterne.'});const comment=String(req.body.comment||'').trim().slice(0,1200);const review={id:uuid(),bookingId:b.id,trainerId:b.trainerId,clientId:user.id,rating,comment,createdAt:new Date().toISOString()};db.reviews.push(review);writeDb(db);res.status(201).json(review);
});

app.post('/api/bookings/:id/payment', auth, async (req,res) => {
  const db=readDb();const user=findUser(db,req.auth.id);const b=findBookingForUser(db,req.params.id,user);if(!b)return res.status(404).json({error:'Buchung nicht gefunden.'});if(user.role!=='client')return res.status(403).json({error:'Nur der Kunde kann die Zahlung starten.'});if(['cancelled','declined'].includes(b.status))return res.status(400).json({error:'Diese Buchung kann nicht mehr bezahlt werden.'});
  const method=String(req.body?.method||'stripe');if(method==='vor_ort'){b.paymentMethod='vor_ort';b.paymentStatus='offen';writeDb(db);return res.json({ok:true,paymentMethod:'vor_ort'});}if(!STRIPE_SECRET_KEY)return res.status(503).json({error:'Online-Zahlung ist noch nicht aktiviert. Du kannst vor Ort bezahlen.'});
  try{const t=db.trainers.find((x)=>x.id===b.trainerId);const session=await stripeRequest('POST','/checkout/sessions',{mode:'payment',success_url:`${APP_URL}/?payment=success&session_id={CHECKOUT_SESSION_ID}`,cancel_url:`${APP_URL}/?payment=cancelled`,customer_email:user.email,client_reference_id:b.id,'metadata[bookingId]':b.id,'metadata[clientId]':user.id,'line_items[0][quantity]':'1','line_items[0][price_data][currency]':'eur','line_items[0][price_data][unit_amount]':String(Math.round(num(b.price)*100)),'line_items[0][price_data][product_data][name]':`Personal Training mit ${t?.name||'A+Trainer'}`});b.paymentMethod='stripe';b.stripeSessionId=session.id;writeDb(db);res.json({checkoutUrl:session.url});}catch(e){res.status(502).json({error:e.message});}
});
app.post('/api/payments/confirm', auth, async (req,res) => {
  if(!STRIPE_SECRET_KEY)return res.status(503).json({error:'Online-Zahlung ist nicht aktiviert.'});const user=findUser(readDb(),req.auth.id);if(!user)return res.status(404).json({error:'Konto nicht gefunden.'});
  try{const session=await stripeRequest('GET',`/checkout/sessions/${encodeURIComponent(String(req.body?.sessionId||''))}`);const db=readDb();const b=db.bookings.find((x)=>x.id===session?.metadata?.bookingId&&x.clientId===user.id);if(!b)return res.status(404).json({error:'Zahlung konnte keiner Buchung zugeordnet werden.'});if(session.payment_status==='paid'){b.paymentStatus='bezahlt';b.paidAt=new Date().toISOString();b.stripeSessionId=session.id;writeDb(db);}res.json({paymentStatus:b.paymentStatus,bookingId:b.id});}catch(e){res.status(502).json({error:e.message});}
});

app.get('*',(req,res)=>{if(req.path.startsWith('/api/'))return res.status(404).json({error:'Nicht gefunden.'});res.sendFile(path.join(__dirname,'public','index.html'));});
ensureDb();app.listen(PORT,'0.0.0.0',()=>console.log(`A+Trainer läuft auf Port ${PORT}`));
