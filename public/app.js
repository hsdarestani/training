const state = {
  trainers: [],
  user: null,
  token: localStorage.getItem('aTrainerToken') || '',
  selectedTrainer: null,
  filters: { search: '', specialty: '', maxPrice: '' }
};

const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const modalBackdrop = $('#modalBackdrop');
const modal = $('#modal');

async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (state.token) headers.Authorization = `Bearer ${state.token}`;
  const res = await fetch(path, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Something went wrong.');
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
  modal.innerHTML = `<button class="modal-close" aria-label="Close">×</button>${content}`;
  modalBackdrop.classList.remove('hidden');
  $('.modal-close', modal).addEventListener('click', closeModal);
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[c]));
}

function formatDate(date) {
  return new Intl.DateTimeFormat('en-DE', { weekday: 'short', day: '2-digit', month: 'short' }).format(new Date(`${date}T12:00:00`));
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
    area.innerHTML = `<button class="btn ghost" data-action="login">Log in</button><button class="btn light" data-action="signup">Create account</button>`;
  } else {
    area.innerHTML = `<button class="btn ghost" data-action="bookings">Bookings</button><button class="btn light" data-action="account">${escapeHtml(state.user.name.split(' ')[0])}</button>`;
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
  } catch (e) {
    toast(e.message, true);
  }
}

function renderTrainers() {
  const grid = $('#trainerGrid');
  $('#resultsCount').textContent = `${state.trainers.length} trainer${state.trainers.length === 1 ? '' : 's'} available`;
  $('#emptyState').classList.toggle('hidden', state.trainers.length > 0);
  grid.innerHTML = state.trainers.map((t) => `
    <article class="trainer-card" data-trainer-id="${t.id}">
      <div class="trainer-image" style="background-image:url('${escapeHtml(t.image)}')">
        <span class="trainer-price">€${Number(t.price).toFixed(0)} / session</span>
        ${t.verified ? '<span class="verified">✓ VERIFIED</span>' : '<span class="verified">NEW TRAINER</span>'}
      </div>
      <div class="trainer-body">
        <div class="trainer-topline">
          <div><h3>${escapeHtml(t.name)}</h3><div class="trainer-location">⌖ ${escapeHtml(t.city)}${t.area ? ` · ${escapeHtml(t.area)}` : ''}</div></div>
          <div class="rating">★ ${Number(t.rating || 5).toFixed(1)} <span>(${t.reviews || 0})</span></div>
        </div>
        <div class="chips">${(t.specialties || []).slice(0, 3).map((s) => `<span class="chip">${escapeHtml(s)}</span>`).join('')}</div>
        <div class="trainer-footer"><span><b>${t.experience || 1} years</b> experience</span><button aria-label="View ${escapeHtml(t.name)}">→</button></div>
      </div>
    </article>`).join('');
  $$('.trainer-card', grid).forEach((card) => card.addEventListener('click', () => showTrainer(card.dataset.trainerId)));
}

function showTrainer(id) {
  const t = state.trainers.find((x) => x.id === id) || state.selectedTrainer;
  if (!t) return;
  state.selectedTrainer = t;
  const defaultDate = tomorrow();
  openModal(`
    <div class="profile-modal">
      <div class="profile-image" style="background-image:url('${escapeHtml(t.image)}')">
        <div class="profile-price"><strong>€${Number(t.price).toFixed(0)}</strong> <small>/ private session</small></div>
      </div>
      <div class="profile-content">
        <span class="kicker">${t.verified ? '✓ VERIFIED TRAINER' : 'NEW TRAINER'}</span>
        <h2>${escapeHtml(t.name)}</h2>
        <div class="profile-meta">★ ${Number(t.rating || 5).toFixed(1)} (${t.reviews || 0} reviews) · ⌖ ${escapeHtml(t.city)}${t.area ? `, ${escapeHtml(t.area)}` : ''}</div>
        <div class="chips">${(t.specialties || []).map((s) => `<span class="chip">${escapeHtml(s)}</span>`).join('')}</div>
        <p class="profile-bio">${escapeHtml(t.bio)}</p>
        <div class="profile-section"><h4>TRAINER DETAILS</h4><div class="profile-facts"><div><b>${t.experience || 1} years</b><br>experience</div><div><b>${escapeHtml((t.languages || []).join(' · '))}</b><br>languages</div><div><b>${escapeHtml((t.venues || []).join(' · '))}</b><br>locations</div><div><b>1:1 private</b><br>session format</div></div></div>
        <div class="booking-box">
          <h4>BOOK YOUR SESSION</h4>
          <div class="booking-row"><input type="date" id="bookingDate" min="${defaultDate}" value="${defaultDate}"><select id="bookingVenue">${(t.venues || ['Gym']).map((v) => `<option>${escapeHtml(v)}</option>`).join('')}</select></div>
          <div class="slot-row">${(t.slots || ['08:00','12:00','17:00']).map((s, i) => `<button type="button" class="slot${i === 0 ? ' active' : ''}" data-time="${s}">${s}</button>`).join('')}</div>
          <textarea id="bookingNote" rows="2" placeholder="Anything your trainer should know? (optional)"></textarea>
          <button class="book-now" id="bookNow">Book for €${Number(t.price).toFixed(0)} →</button>
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
    closeModal(); showAuth('login'); toast('Sign in as a client to book your session.'); return;
  }
  if (state.user.role !== 'client') return toast('Trainer accounts cannot book sessions.', true);
  const activeSlot = $('.slot.active', modal);
  try {
    await api('/api/bookings', {
      method: 'POST',
      body: JSON.stringify({ trainerId: t.id, date: $('#bookingDate', modal).value, time: activeSlot?.dataset.time, venue: $('#bookingVenue', modal).value, note: $('#bookingNote', modal).value })
    });
    closeModal(); toast(`Booked with ${t.name}. See you soon!`); showDashboard();
  } catch (e) { toast(e.message, true); }
}

function showAuth(mode = 'login', trainerRole = false) {
  const isRegister = mode === 'register';
  openModal(`
    <div class="auth-wrap">
      <a href="#" class="brand"><span class="brand-mark">A+</span><span>TRAINER</span></a>
      <div class="auth-tabs"><button class="${!isRegister ? 'active' : ''}" data-auth-tab="login">Log in</button><button class="${isRegister ? 'active' : ''}" data-auth-tab="register">Create account</button></div>
      ${isRegister ? registerForm(trainerRole) : loginForm()}
    </div>`);
  $$('[data-auth-tab]', modal).forEach((b) => b.addEventListener('click', () => showAuth(b.dataset.authTab, trainerRole)));
  const form = $('form', modal);
  form.addEventListener('submit', isRegister ? register : login);
  const roleSelect = $('#regRole', modal);
  if (roleSelect) roleSelect.addEventListener('change', toggleTrainerFields);
}

function loginForm() {
  return `<form id="loginForm"><div class="form-grid"><div class="field full"><label>Email</label><input type="email" name="email" required placeholder="you@example.com"></div><div class="field full"><label>Password</label><input type="password" name="password" required placeholder="••••••••"></div></div><button class="submit-btn">Log in →</button><p class="auth-note">Your bookings and trainer profile stay connected to this account.</p></form>`;
}

function registerForm(trainerRole) {
  return `<form id="registerForm"><div class="form-grid"><div class="field full"><label>I want to</label><select name="role" id="regRole"><option value="client" ${!trainerRole ? 'selected' : ''}>Find and book a trainer</option><option value="trainer" ${trainerRole ? 'selected' : ''}>Offer personal training</option></select></div><div class="field"><label>Full name</label><input name="name" required placeholder="Your name"></div><div class="field"><label>City</label><input name="city" required placeholder="Frankfurt am Main"></div><div class="field full trainer-only ${trainerRole ? '' : 'hidden'}"><label>Main specialty</label><input name="specialty" placeholder="e.g. Strength training"></div><div class="field"><label>Email</label><input type="email" name="email" required placeholder="you@example.com"></div><div class="field"><label>Phone</label><input name="phone" placeholder="+49 ..."></div><div class="field full"><label>Password</label><input type="password" name="password" minlength="6" required placeholder="At least 6 characters"></div></div><button class="submit-btn">Create my A+Trainer account →</button><p class="auth-note">By continuing, you agree to the platform terms and privacy policy.</p></form>`;
}

function toggleTrainerFields() {
  $('.trainer-only', modal)?.classList.toggle('hidden', $('#regRole', modal).value !== 'trainer');
}

async function login(e) {
  e.preventDefault();
  const form = new FormData(e.currentTarget);
  try {
    const data = await api('/api/auth/login', { method:'POST', body: JSON.stringify(Object.fromEntries(form)) });
    setSession(data); closeModal(); toast(`Welcome back, ${data.user.name.split(' ')[0]}.`); showDashboard();
  } catch (err) { toast(err.message, true); }
}

async function register(e) {
  e.preventDefault();
  const form = new FormData(e.currentTarget);
  try {
    const data = await api('/api/auth/register', { method:'POST', body: JSON.stringify(Object.fromEntries(form)) });
    setSession(data); closeModal(); toast('Your A+Trainer account is ready.'); await loadTrainers(); showDashboard();
  } catch (err) { toast(err.message, true); }
}

function setSession(data) {
  state.token = data.token; state.user = data.user;
  localStorage.setItem('aTrainerToken', data.token); renderHeader();
}

function logout() {
  state.token = ''; state.user = null; localStorage.removeItem('aTrainerToken'); closeModal(); renderHeader(); toast('Logged out.');
}

async function showDashboard() {
  if (!state.user) return showAuth('login');
  let bookings = [];
  try { bookings = await api('/api/bookings'); } catch (e) { return toast(e.message, true); }
  const upcoming = bookings.filter((b) => !['cancelled','declined'].includes(b.status));
  const roleLabel = state.user.role === 'trainer' ? 'Trainer dashboard' : 'My training';
  openModal(`
    <div class="dashboard">
      <div class="dashboard-head"><div><span class="kicker">${roleLabel}</span><h2>Hi, ${escapeHtml(state.user.name.split(' ')[0])}.</h2><p>${upcoming.length} active booking${upcoming.length === 1 ? '' : 's'} · ${escapeHtml(state.user.city || '')}</p></div><button class="logout-btn" id="logoutBtn">Log out</button></div>
      ${state.user.role === 'trainer' ? `<div class="chips"><span class="chip">Your public profile is live</span><span class="chip">Bookings appear here automatically</span></div>` : ''}
      <div class="profile-section"><h4>${bookings.length ? 'SESSIONS' : 'NO SESSIONS YET'}</h4>
        ${bookings.length ? `<div class="booking-list">${bookings.map((b) => bookingItem(b)).join('')}</div>` : `<div class="empty-state"><div>◫</div><h3>Your schedule is clear</h3><p>${state.user.role === 'trainer' ? 'New client bookings will appear here.' : 'Find a trainer and book your first private session.'}</p>${state.user.role === 'client' ? '<button class="btn accent" data-dashboard-discover>Find a trainer</button>' : ''}</div>`}
      </div>
    </div>`, true);
  $('#logoutBtn', modal).addEventListener('click', logout);
  $('[data-dashboard-discover]', modal)?.addEventListener('click', () => { closeModal(); scrollToId('discover'); });
  $$('[data-booking-status]', modal).forEach((b) => b.addEventListener('click', () => updateBooking(b.dataset.bookingId, b.dataset.bookingStatus)));
}

function bookingItem(b) {
  const d = new Date(`${b.date}T12:00:00`);
  const counterpart = state.user.role === 'trainer' ? b.client?.name || 'Client' : b.trainer?.name || 'Trainer';
  const subtitle = state.user.role === 'trainer' ? `${b.time} · ${escapeHtml(b.venue)}` : `${b.time} · ${escapeHtml(b.venue)} · €${b.price}`;
  let actions = '';
  if (!['cancelled','declined','completed'].includes(b.status)) {
    actions = state.user.role === 'trainer'
      ? `<div class="booking-actions"><button data-booking-id="${b.id}" data-booking-status="completed">Complete</button><button data-booking-id="${b.id}" data-booking-status="declined">Decline</button></div>`
      : `<div class="booking-actions"><button data-booking-id="${b.id}" data-booking-status="cancelled">Cancel</button></div>`;
  }
  return `<div class="booking-item"><div class="booking-date"><strong>${String(d.getDate()).padStart(2,'0')}</strong><small>${d.toLocaleString('en',{month:'short'})}</small></div><div class="booking-info"><b>${escapeHtml(counterpart)}</b><small>${subtitle}</small></div><div><span class="status ${b.status}">${escapeHtml(b.status)}</span>${actions}</div></div>`;
}

async function updateBooking(id, status) {
  try { await api(`/api/bookings/${id}`, { method:'PATCH', body:JSON.stringify({ status }) }); toast(`Booking marked ${status}.`); showDashboard(); }
  catch (e) { toast(e.message, true); }
}

function scrollToId(id) {
  document.getElementById(id)?.scrollIntoView({ behavior:'smooth', block:'start' });
}

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
  if (!navigator.geolocation) return toast('Location is not available in this browser.', true);
  navigator.geolocation.getCurrentPosition(() => {
    $('#searchInput').value = 'Frankfurt'; state.filters.search = 'Frankfurt'; loadTrainers(); toast('Showing trainers near your current area.');
  }, () => toast('Allow location access to use Near me.', true));
});

if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));

(async function init() {
  await restoreSession();
  await loadTrainers();
})();
