import assert from 'node:assert/strict';

const base = process.env.BASE_URL || 'http://127.0.0.1:3087';
const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const password = 'Test12345!';

async function request(path, { method = 'GET', token, body, expect = 200 } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${base}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  assert.equal(res.status, expect, `${method} ${path}: erwartet ${expect}, erhalten ${res.status}: ${JSON.stringify(data)}`);
  return data;
}

function futureDate(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

console.log('1/10 Healthcheck');
assert.equal((await request('/api/health')).app, 'A+Trainer');

console.log('2/10 Kundenkonto registrieren');
const clientEmail = `kunde-${suffix}@example.de`;
const clientReg = await request('/api/auth/register', {
  method: 'POST', expect: 201,
  body: { role:'client', name:'CI Testkunde', email:clientEmail, password, city:'Frankfurt am Main', phone:'+49123456789' }
});
assert.equal(clientReg.user.role, 'client');
assert.ok(clientReg.token);

console.log('3/10 Doppelregistrierung und Login prüfen');
const duplicate = await request('/api/auth/register', {
  method:'POST', expect:409,
  body:{ role:'client', name:'CI Testkunde', email:clientEmail, password, city:'Frankfurt am Main' }
});
assert.match(duplicate.error, /bereits ein Konto/i);
const clientLogin = await request('/api/auth/login', { method:'POST', body:{ email:clientEmail, password } });
assert.equal(clientLogin.user.email, clientEmail);
const clientToken = clientLogin.token;
assert.equal((await request('/api/me', { token:clientToken })).name, 'CI Testkunde');

console.log('4/10 Trainersuche prüfen');
const trainers = await request('/api/trainers?specialty=Krafttraining');
assert.ok(Array.isArray(trainers) && trainers.length > 0, 'Keine Trainer für Krafttraining gefunden');
const lena = trainers.find((t) => t.id === 'tr-lena') || trainers[0];
assert.ok(lena.slots.length > 0 && lena.venues.length > 0);

console.log('5/10 Buchung als Kunde erstellen');
const booking = await request('/api/bookings', {
  method:'POST', token:clientToken, expect:201,
  body:{ trainerId:lena.id, date:futureDate(2), time:lena.slots[0], venue:lena.venues[0], note:'Automatischer E2E-Test' }
});
assert.equal(booking.status, 'confirmed');
const clientBookings = await request('/api/bookings', { token:clientToken });
assert.ok(clientBookings.some((b) => b.id === booking.id));

console.log('6/10 Buchung als Kunde stornieren');
const cancelled = await request(`/api/bookings/${booking.id}`, { method:'PATCH', token:clientToken, body:{ status:'cancelled' } });
assert.equal(cancelled.status, 'cancelled');

console.log('7/10 Trainerkonto registrieren und Login prüfen');
const trainerEmail = `trainer-${suffix}@example.de`;
const trainerReg = await request('/api/auth/register', {
  method:'POST', expect:201,
  body:{ role:'trainer', name:'CI Testtrainer', email:trainerEmail, password, city:'Frankfurt am Main', specialty:'Mobilität' }
});
assert.equal(trainerReg.user.role, 'trainer');
assert.ok(trainerReg.user.trainerId);
const trainerLogin = await request('/api/auth/login', { method:'POST', body:{ email:trainerEmail, password } });
const trainerToken = trainerLogin.token;

console.log('8/10 Trainerprofil bearbeiten');
const edited = await request('/api/me/trainer', {
  method:'PATCH', token:trainerToken,
  body:{ price:99, experience:4, bio:'Deutsches Testprofil', specialties:['Mobilität','Krafttraining'], venues:['Fitnessstudio'], slots:['12:00','18:00'], languages:['Deutsch'] }
});
assert.equal(edited.price, 99);
assert.deepEqual(edited.slots, ['12:00','18:00']);
const publicProfile = await request(`/api/trainers/${trainerReg.user.trainerId}`);
assert.equal(publicProfile.bio, 'Deutsches Testprofil');

console.log('9/10 Kunde bucht neuen Trainer, Trainer sieht Buchung');
const trainerBooking = await request('/api/bookings', {
  method:'POST', token:clientToken, expect:201,
  body:{ trainerId:trainerReg.user.trainerId, date:futureDate(3), time:'12:00', venue:'Fitnessstudio', note:'Bis gleich' }
});
const trainerBookings = await request('/api/bookings', { token:trainerToken });
assert.ok(trainerBookings.some((b) => b.id === trainerBooking.id && b.client?.name === 'CI Testkunde'));

console.log('10/10 Trainer schließt Einheit ab');
const completed = await request(`/api/bookings/${trainerBooking.id}`, { method:'PATCH', token:trainerToken, body:{ status:'completed' } });
assert.equal(completed.status, 'completed');

console.log('✅ Alle A+Trainer End-to-End-Flows funktionieren.');
