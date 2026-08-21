const state = {
  trainers: [],
  user: null,
  token: localStorage.getItem('aTrainerToken') || '',
  selectedTrainer: null,
  pendingTrainerId: null,
  filters: { search: '', specialty: '', maxPrice: '' }
};

const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const modalBackdrop = $('#modalBackdrop');
const modal = $('#modal');

const specialtyLabels = {
  'Strength': 'Krafttraining', 'Krafttraining': 'Krafttraining',
  'Muscle gain': 'Muskelaufbau', 'Muskelaufbau': 'Muskelaufbau',
  'Body transformation': 'Körpertransformation', 'Körpertransformation': 'Körpertransformation',
  'Weight loss': 'Abnehmen', 'Abnehmen': 'Abnehmen',
  'Nutrition': 'Ernährung', 'Ernährung': 'Ernährung',
  'Mobility': 'Mobilität', 'Mobilität': 'Mobilität',
  'Running': 'Laufen', 'Laufen': 'Laufen',
  'Endurance': 'Ausdauer', 'Ausdauer': 'Ausdauer',
  'Boxing': 'Boxen', 'Boxen': 'Boxen',
  'Conditioning': 'Kondition', 'Kondition': 'Kondition',
  'Pilates': 'Pilates', 'Personal Training': 'Personal Training'
};
const venueLabels = {
  'Outdoor': 'Outdoor', 'Gym': 'Fitnessstudio', 'Fitnessstudio': 'Fitnessstudio',
  'At your home': 'Bei dir zu Hause', 'Bei dir zu Hause': 'Bei dir zu Hause',
  'Online': 'Online', 'Studio': 'Studio'
};
const statusLabels = {
  confirmed: 'Bestätigt', completed: 'Abgeschlossen', cancelled: 'Storniert', declined: 'Abgelehnt'
};

async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (state.token) headers.Authorization = `Bearer ${state.token}`;
  const res = await fetch(path, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Etwas ist schiefgelaufen. Bitte versuche es erneut.');
  return data;
}

function toast(message, error = false) {
  const node = document.createElement('div');
  node.className = `toast${error ? ' error' : ''}`;
  node.textContent = message;
  $('#toastStack').appendChild(node);
  setTimeout(() => node.remove(), 3200);
}

function closeModal() {
  modalBackdrop.classList.add('hidden');
  modal.innerHTML = '';
  modal.className = 'modal';
}

function openModal(content, wide = false) {
  modal.className = `modal${wide ? ' wide' : ''}`;
  modal.innerHTML = `<button class="modal-close" aria-label="Schließen">×</button>${content}`;
  modalBackdrop.classList.remove('hidden');
  $('.modal-close', modal).addEventListener('click', closeModal);
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[c]));
}

function fmtSpecialty(value) { return specialtyLabels[value] || value; }
function fmtVenue(value) { return venueLabels[value] || value; }
function fmtStatus(value) { return statusLabels[value] || value; }
function formatDate(date) {
  return new Intl.DateTimeFormat('de-DE', { weekday: 'short', day: '2-digit', month: 'short' }).format(new Date(`${date}T12:00:00`));
}
function tomorrow() {
  const d = new Date(); d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

async function restoreSession() {
  if (!state.token) return renderHeader();
  try {
    state.user = await api('/api/me');
  } catch {
    state.token = ''; localStorage.removeItem('aTrainerToken');
  }
  renderHeader();
}

function renderHeader() {
  const area = $('#headerActions');
  if (!state.user) {
    area.innerHTML = `<button class="btn ghost" data-action="login">Anmelden</button><button class="btn light" data-action="signup">Registrieren</button>`;
  } else {
    area.innerHTML = `<button class="btn ghost" data-action="bookings">Buchungen</button><button class="btn light" data-action="account">${escapeHtml(state.user.name.split(' ')[0])}</button>`;
  }
}

async function loadTrainers() {
  const params = new URLSearchParams();
  if (state.filters.search) params.set('search', state.filters.search);
  if (state.filters.specialty) params.set('specialty', state.filters.specialty);
  if (state.filters.maxPrice) params.set('maxPrice', state.filters.maxPrice);
  try {
    state.trainers = await api(`/api/trainers?${params.toString()}`);
    renderTrainers();
  } catch (e) { toast(e.message, true); }
}

function renderTrainers() {
  const grid = $('#trainerGrid');
  $('#resultsCount').textContent = `${state.trainers.length} ${state.trainers.length === 1 ? 'Trainer verfügbar' : 'Trainer verfügbar'}`;
  $('#emptyState').classList.toggle('hidden', state.trainers.length > 0);
  grid.innerHTML = state.trainers.map((t) => `
    <article class="trainer-card" data-trainer-id="${t.id}">
      <div class="trainer-image" style="background-image:url('${escapeHtml(t.image)}')">
        <span class="trainer-price">${Number(t.price).toFixed(0)} € / Einheit</span>
        ${t.verified ? '<span class="verified">✓ GEPRÜFT</span>' : '<span class="verified">NEUER TRAINER</span>'}
      </div>
      <div class="trainer-body">
        <div class="trainer-topline">
          <div><h3>${escapeHtml(t.name)}</h3><div class="trainer-location">⌖ ${escapeHtml(t.city)}${t.area ? ` · ${escapeHtml(t.area)}` : ''}</div></div>
          <div class="rating">★ ${Number(t.rating || 5).toFixed(1).replace('.', ',')} <span>(${t.reviews || 0})</span></div>
        </div>
        <div class="chips">${(t.specialties || []).slice(0, 3).map((s) => `<span class="chip">${escapeHtml(fmtSpecialty(s))}</span>`).join('')}</div>
        <div class="trainer-footer"><span><b>${t.experience || 1} ${Number(t.experience) === 1 ? 'Jahr' : 'Jahre'}</b> Erfahrung</span><button aria-label="Profil von ${escapeHtml(t.name)} öffnen">→</button></div>
      </div>
    </article>`).join('');
  $$('.trainer-card', grid).forEach((card) => card.addEventListener('click', () => showTrainer(card.dataset.trainerId)));
}

async function showTrainer(id) {
  let t = state.trainers.find((x) => x.id === id);
  if (!t) {
    try { t = await api(`/api/trainers/${id}`); } catch (e) { return toast(e.message, true); }
  }
  state.selectedTrainer = t;
  const defaultDate = tomorrow();
  openModal(`
    <div class="profile-modal">
      <div class="profile-image" style="background-image:url('${escapeHtml(t.image)}')">
        <div class="profile-price"><strong>${Number(t.price).toFixed(0)} €</strong> <small>/ private Einheit</small></div>
      </div>
      <div class="profile-content">
        <span class="kicker">${t.verified ? '✓ GEPRÜFTER TRAINER' : 'NEUER TRAINER'}</span>
        <h2>${escapeHtml(t.name)}</h2>
        <div class="profile-meta">★ ${Number(t.rating || 5).toFixed(1).replace('.', ',')} (${t.reviews || 0} Bewertungen) · ⌖ ${escapeHtml(t.city)}${t.area ? `, ${escapeHtml(t.area)}` : ''}</div>
        <div class="chips">${(t.specialties || []).map((s) => `<span class="chip">${escapeHtml(fmtSpecialty(s))}</span>`).join('')}</div>
        <p class="profile-bio">${escapeHtml(t.bio || '')}</p>
        <div class="profile-section"><h4>TRAINER-DETAILS</h4><div class="profile-facts"><div><b>${t.experience || 1} ${Number(t.experience) === 1 ? 'Jahr' : 'Jahre'}</b><br>Erfahrung</div><div><b>${escapeHtml((t.languages || []).join(' · '))}</b><br>Sprachen</div><div><b>${escapeHtml((t.venues || []).map(fmtVenue).join(' · '))}</b><br>Trainingsorte</div><div><b>1:1 privat</b><br>Trainingsformat</div></div></div>
        <div class="booking-box">
          <h4>TRAINING BUCHEN</h4>
          <div class="booking-row"><input type="date" id="bookingDate" min="${defaultDate}" value="${defaultDate}"><select id="bookingVenue">${(t.venues || ['Fitnessstudio']).map((v) => `<option value="${escapeHtml(v)}">${escapeHtml(fmtVenue(v))}</option>`).join('')}</select></div>
          <div class="slot-row">${(t.slots || ['08:00','12:00','17:00']).map((s, i) => `<button type="button" class="slot${i === 0 ? ' active' : ''}" data-time="${s}">${s}</button>`).join('')}</div>
          <textarea id="bookingNote" rows="2" placeholder="Gibt es etwas, das dein Trainer wissen sollte? (optional)"></textarea>
          <button class="book-now" id="bookNow">Für ${Number(t.price).toFixed(0)} € buchen →</button>
        </div>
      </div>
    </div>`, true);
  $$('.slot', modal).forEach((btn) => btn.addEventListener('click', () => {
    $$('.slot', modal).forEach((b) => b.classList.remove('active')); btn.classList.add('active');
  }));
  $('#bookNow', modal).addEventListener('click', () => bookTrainer(t));
}

async function bookTrainer(t) {
  if (!state.user) {
    state.pendingTrainerId = t.id;
    closeModal(); showAuth('login'); toast('Melde dich an, um diese Einheit zu buchen.'); return;
  }
  if (state.user.role !== 'client') return toast('Trainerkonten können keine Trainingseinheiten buchen.', true);
  const activeSlot = $('.slot.active', modal);
  if (!activeSlot) return toast('Bitte wähle eine Uhrzeit.', true);
  try {
    await api('/api/bookings', {
      method: 'POST',
      body: JSON.stringify({ trainerId: t.id, date: $('#bookingDate', modal).value, time: activeSlot.dataset.time, venue: $('#bookingVenue', modal).value, note: $('#bookingNote', modal).value })
    });
    closeModal(); state.pendingTrainerId = null;
    toast(`Termin bei ${t.name} erfolgreich gebucht.`); showDashboard();
  } catch (e) { toast(e.message, true); }
}

function showAuth(mode = 'login', trainerRole = false) {
  const isRegister = mode === 'register';
  openModal(`
    <div class="auth-wrap">
      <a href="#" class="brand"><span class="brand-mark">A+</span><span>TRAINER</span></a>
      <div class="auth-tabs"><button class="${!isRegister ? 'active' : ''}" data-auth-tab="login">Anmelden</button><button class="${isRegister ? 'active' : ''}" data-auth-tab="register">Registrieren</button></div>
      ${isRegister ? registerForm(trainerRole) : loginForm()}
    </div>`);
  $$('[data-auth-tab]', modal).forEach((b) => b.addEventListener('click', () => showAuth(b.dataset.authTab, trainerRole)));
  $('form', modal).addEventListener('submit', isRegister ? register : login);
  const roleSelect = $('#regRole', modal);
  if (roleSelect) roleSelect.addEventListener('change', toggleTrainerFields);
}

function loginForm() {
  return `<form id="loginForm"><div class="form-grid"><div class="field full"><label>E-Mail</label><input type="email" name="email" autocomplete="email" required placeholder="name@beispiel.de"></div><div class="field full"><label>Passwort</label><input type="password" name="password" autocomplete="current-password" required placeholder="••••••••"></div></div><button class="submit-btn">Anmelden →</button><p class="auth-note">Deine Buchungen und dein Trainerprofil bleiben mit diesem Konto verbunden.</p></form>`;
}

function registerForm(trainerRole) {
  return `<form id="registerForm"><div class="form-grid"><div class="field full"><label>Ich möchte</label><select name="role" id="regRole"><option value="client" ${!trainerRole ? 'selected' : ''}>Einen Trainer finden und buchen</option><option value="trainer" ${trainerRole ? 'selected' : ''}>Personal Training anbieten</option></select></div><div class="field"><label>Vor- und Nachname</label><input name="name" autocomplete="name" required placeholder="Dein Name"></div><div class="field"><label>Stadt</label><input name="city" autocomplete="address-level2" required placeholder="Frankfurt am Main"></div><div class="field full trainer-only ${trainerRole ? '' : 'hidden'}"><label>Hauptschwerpunkt</label><input name="specialty" placeholder="z. B. Krafttraining"></div><div class="field"><label>E-Mail</label><input type="email" name="email" autocomplete="email" required placeholder="name@beispiel.de"></div><div class="field"><label>Telefon</label><input name="phone" autocomplete="tel" placeholder="+49 ..."></div><div class="field full"><label>Passwort</label><input type="password" name="password" autocomplete="new-password" minlength="6" required placeholder="Mindestens 6 Zeichen"></div></div><button class="submit-btn">A+Trainer-Konto erstellen →</button><p class="auth-note">Mit der Registrierung stimmst du den Nutzungsbedingungen und der Datenschutzerklärung zu.</p></form>`;
}

function toggleTrainerFields() {
  $('.trainer-only', modal)?.classList.toggle('hidden', $('#regRole', modal).value !== 'trainer');
}

async function afterAuth(data, message) {
  setSession(data); closeModal(); toast(message);
  await loadTrainers();
  if (state.pendingTrainerId && data.user.role === 'client') {
    const id = state.pendingTrainerId; state.pendingTrainerId = null; return showTrainer(id);
  }
  showDashboard();
}

async function login(e) {
  e.preventDefault();
  const submit = $('.submit-btn', e.currentTarget); submit.disabled = true; submit.textContent = 'Anmeldung läuft ...';
  const form = new FormData(e.currentTarget);
  try {
    const data = await api('/api/auth/login', { method:'POST', body: JSON.stringify(Object.fromEntries(form)) });
    await afterAuth(data, `Willkommen zurück, ${data.user.name.split(' ')[0]}!`);
  } catch (err) { toast(err.message, true); submit.disabled = false; submit.textContent = 'Anmelden →'; }
}

async function register(e) {
  e.preventDefault();
  const submit = $('.submit-btn', e.currentTarget); submit.disabled = true; submit.textContent = 'Konto wird erstellt ...';
  const form = new FormData(e.currentTarget);
  try {
    const data = await api('/api/auth/register', { method:'POST', body: JSON.stringify(Object.fromEntries(form)) });
    await afterAuth(data, 'Dein A+Trainer-Konto ist bereit.');
  } catch (err) { toast(err.message, true); submit.disabled = false; submit.textContent = 'A+Trainer-Konto erstellen →'; }
}

function setSession(data) {
  state.token = data.token; state.user = data.user;
  localStorage.setItem('aTrainerToken', data.token); renderHeader();
}

function logout() {
  state.token = ''; state.user = null; state.pendingTrainerId = null;
  localStorage.removeItem('aTrainerToken'); closeModal(); renderHeader(); toast('Du wurdest abgemeldet.');
}

async function showDashboard() {
  if (!state.user) return showAuth('login');
  let bookings = [];
  try { bookings = await api('/api/bookings'); } catch (e) { return toast(e.message, true); }
  const active = bookings.filter((b) => !['cancelled','declined','completed'].includes(b.status));
  const roleLabel = state.user.role === 'trainer' ? 'TRAINER-DASHBOARD' : 'MEIN TRAINING';
  openModal(`
    <div class="dashboard">
      <div class="dashboard-head"><div><span class="kicker">${roleLabel}</span><h2>Hallo ${escapeHtml(state.user.name.split(' ')[0])}.</h2><p>${active.length} ${active.length === 1 ? 'aktive Buchung' : 'aktive Buchungen'} · ${escapeHtml(state.user.city || '')}</p></div><button class="logout-btn" id="logoutBtn">Abmelden</button></div>
      ${state.user.role === 'trainer' ? `<div class="chips"><span class="chip">Dein öffentliches Profil ist online</span><span class="chip">Neue Buchungen erscheinen automatisch hier</span></div><div style="margin-top:16px"><button class="btn accent" id="editTrainerProfile">Trainerprofil bearbeiten</button></div>` : ''}
      <div class="profile-section"><h4>${bookings.length ? 'TRAININGSEINHEITEN' : 'NOCH KEINE TERMINE'}</h4>
        ${bookings.length ? `<div class="booking-list">${bookings.map(bookingItem).join('')}</div>` : `<div class="empty-state"><div>◫</div><h3>Dein Kalender ist noch frei</h3><p>${state.user.role === 'trainer' ? 'Neue Buchungen deiner Kunden erscheinen hier.' : 'Finde einen Trainer und buche deine erste private Einheit.'}</p>${state.user.role === 'client' ? '<button class="btn accent" data-dashboard-discover>Trainer finden</button>' : ''}</div>`}
      </div>
    </div>`, true);
  $('#logoutBtn', modal).addEventListener('click', logout);
  $('#editTrainerProfile', modal)?.addEventListener('click', showTrainerProfileEditor);
  $('[data-dashboard-discover]', modal)?.addEventListener('click', () => { closeModal(); scrollToId('discover'); });
  $$('[data-booking-status]', modal).forEach((b) => b.addEventListener('click', () => updateBooking(b.dataset.bookingId, b.dataset.bookingStatus)));
}

function bookingItem(b) {
  const d = new Date(`${b.date}T12:00:00`);
  const counterpart = state.user.role === 'trainer' ? b.client?.name || 'Kunde' : b.trainer?.name || 'Trainer';
  const subtitle = state.user.role === 'trainer' ? `${b.time} · ${escapeHtml(fmtVenue(b.venue))}` : `${b.time} · ${escapeHtml(fmtVenue(b.venue))} · ${b.price} €`;
  let actions = '';
  if (!['cancelled','declined','completed'].includes(b.status)) {
    actions = state.user.role === 'trainer'
      ? `<div class="booking-actions"><button data-booking-id="${b.id}" data-booking-status="completed">Abschließen</button><button data-booking-id="${b.id}" data-booking-status="declined">Ablehnen</button></div>`
      : `<div class="booking-actions"><button data-booking-id="${b.id}" data-booking-status="cancelled">Stornieren</button></div>`;
  }
  return `<div class="booking-item"><div class="booking-date"><strong>${String(d.getDate()).padStart(2,'0')}</strong><small>${d.toLocaleString('de-DE',{month:'short'}).replace('.','')}</small></div><div class="booking-info"><b>${escapeHtml(counterpart)}</b><small>${subtitle}</small></div><div><span class="status ${b.status}">${escapeHtml(fmtStatus(b.status))}</span>${actions}</div></div>`;
}

async function updateBooking(id, status) {
  try {
    await api(`/api/bookings/${id}`, { method:'PATCH', body:JSON.stringify({ status }) });
    toast(status === 'cancelled' ? 'Buchung wurde storniert.' : status === 'completed' ? 'Training wurde abgeschlossen.' : 'Buchungsstatus wurde aktualisiert.');
    showDashboard();
  } catch (e) { toast(e.message, true); }
}

async function showTrainerProfileEditor() {
  let t;
  try { t = await api(`/api/trainers/${state.user.trainerId}`); } catch (e) { return toast(e.message, true); }
  openModal(`<div class="auth-wrap"><span class="kicker">TRAINERPROFIL</span><h2>Profil bearbeiten</h2><form id="trainerProfileForm"><div class="form-grid">
    <div class="field"><label>Name</label><input name="name" required value="${escapeHtml(t.name)}"></div>
    <div class="field"><label>Stadt</label><input name="city" required value="${escapeHtml(t.city)}"></div>
    <div class="field"><label>Stadtteil</label><input name="area" value="${escapeHtml(t.area || '')}"></div>
    <div class="field"><label>Preis pro Einheit (€)</label><input type="number" min="0" name="price" required value="${Number(t.price)}"></div>
    <div class="field"><label>Erfahrung (Jahre)</label><input type="number" min="0" name="experience" value="${Number(t.experience || 1)}"></div>
    <div class="field"><label>Schwerpunkte</label><input name="specialties" value="${escapeHtml((t.specialties || []).map(fmtSpecialty).join(', '))}" placeholder="Krafttraining, Mobilität"></div>
    <div class="field full"><label>Über mich</label><textarea name="bio" rows="4">${escapeHtml(t.bio || '')}</textarea></div>
    <div class="field full"><label>Bild-URL</label><input name="image" value="${escapeHtml(t.image || '')}"></div>
    <div class="field"><label>Sprachen</label><input name="languages" value="${escapeHtml((t.languages || []).join(', '))}"></div>
    <div class="field"><label>Trainingsorte</label><input name="venues" value="${escapeHtml((t.venues || []).map(fmtVenue).join(', '))}"></div>
    <div class="field full"><label>Verfügbare Uhrzeiten</label><input name="slots" value="${escapeHtml((t.slots || []).join(', '))}" placeholder="08:00, 12:00, 17:00"></div>
  </div><button class="submit-btn">Profil speichern →</button></form></div>`, true);
  $('#trainerProfileForm', modal).addEventListener('submit', saveTrainerProfile);
}

async function saveTrainerProfile(e) {
  e.preventDefault();
  const form = Object.fromEntries(new FormData(e.currentTarget));
  const split = (v) => String(v || '').split(',').map((x) => x.trim()).filter(Boolean);
  const payload = { ...form, price:Number(form.price), experience:Number(form.experience), specialties:split(form.specialties), languages:split(form.languages), venues:split(form.venues), slots:split(form.slots) };
  try {
    await api('/api/me/trainer', { method:'PATCH', body:JSON.stringify(payload) });
    await loadTrainers(); toast('Trainerprofil wurde gespeichert.'); showDashboard();
  } catch (e) { toast(e.message, true); }
}

function scrollToId(id) { document.getElementById(id)?.scrollIntoView({ behavior:'smooth', block:'start' }); }
function handleAction(action) {
  if (action === 'discover' || action === 'home') return scrollToId(action === 'home' ? 'home' : 'discover');
  if (action === 'how') return scrollToId('how');
  if (action === 'for-trainers') return scrollToId('for-trainers');
  if (action === 'trainer-signup') return showAuth('register', true);
  if (action === 'signup') return showAuth('register');
  if (action === 'login') return showAuth('login');
  if (action === 'bookings' || action === 'account') return showDashboard();
}

document.addEventListener('click', (e) => {
  const target = e.target.closest('[data-action]');
  if (!target) return;
  e.preventDefault(); handleAction(target.dataset.action);
});
modalBackdrop.addEventListener('click', (e) => { if (e.target === modalBackdrop) closeModal(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modalBackdrop.classList.contains('hidden')) closeModal(); });

$('#heroSearch').addEventListener('submit', (e) => {
  e.preventDefault();
  state.filters.search = [$('#heroCity').value, $('#heroGoal').value].filter(Boolean).join(' ');
  $('#searchInput').value = state.filters.search; loadTrainers(); scrollToId('discover');
});
let searchTimer;
$('#searchInput').addEventListener('input', (e) => {
  clearTimeout(searchTimer); searchTimer = setTimeout(() => { state.filters.search = e.target.value.trim(); loadTrainers(); }, 250);
});
$('#specialtyFilter').addEventListener('change', (e) => { state.filters.specialty = e.target.value; loadTrainers(); });
$('#priceFilter').addEventListener('change', (e) => { state.filters.maxPrice = e.target.value; loadTrainers(); });
$('#clearFilters').addEventListener('click', () => {
  state.filters = { search:'', specialty:'', maxPrice:'' }; $('#searchInput').value=''; $('#specialtyFilter').value=''; $('#priceFilter').value=''; loadTrainers();
});
$('#nearMeButton').addEventListener('click', () => {
  if (!navigator.geolocation) return toast('Standortzugriff wird von diesem Browser nicht unterstützt.', true);
  navigator.geolocation.getCurrentPosition(() => {
    toast('Standort erkannt. Zeige Trainer aus deiner Region.');
    scrollToId('discover');
  }, () => toast('Bitte erlaube den Standortzugriff für diese Funktion.', true));
});

if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
(async function init() { await restoreSession(); await loadTrainers(); })();
