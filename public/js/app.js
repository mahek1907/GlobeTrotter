// ===================== GLOBAL STATE =====================
const State = {
  user: null,
  citiesCache: [],
  currentTrip: null,   // full trip object currently open in Trip Detail
  pendingStopId: null, // used by add-activity modal
};

// ===================== UI HELPERS =====================
const UI = {
  switchAuthTab(tab) {
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
    document.getElementById('login-form').style.display = 'none';
    document.getElementById('signup-form').style.display = 'none';
    document.getElementById('forgot-form').style.display = 'none';
    this.clearAuthMsg();
    if (tab === 'login') {
      document.querySelector('.auth-tab[data-tab="login"]').classList.add('active');
      document.getElementById('login-form').style.display = 'block';
    } else if (tab === 'signup') {
      document.querySelector('.auth-tab[data-tab="signup"]').classList.add('active');
      document.getElementById('signup-form').style.display = 'block';
    } else {
      document.getElementById('forgot-form').style.display = 'block';
    }
  },
  authError(msg) {
    const el = document.getElementById('auth-error');
    el.textContent = msg; el.style.display = 'block';
    document.getElementById('auth-success').style.display = 'none';
  },
  authSuccess(msg) {
    const el = document.getElementById('auth-success');
    el.textContent = msg; el.style.display = 'block';
    document.getElementById('auth-error').style.display = 'none';
  },
  clearAuthMsg() {
    document.getElementById('auth-error').style.display = 'none';
    document.getElementById('auth-success').style.display = 'none';
  },
  openModal(id) { document.getElementById(id).classList.add('active'); },
  closeModal(id) { document.getElementById(id).classList.remove('active'); },
  fmtMoney(n) { return '$' + Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 }); },
  fmtDate(d) { if (!d) return '—'; const dt = new Date(d + 'T00:00:00'); return dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }); },
  escapeHtml(s) { const d = document.createElement('div'); d.textContent = s ?? ''; return d.innerHTML; },
};

// ===================== ROUTER =====================
const Router = {
  pages: ['dashboard', 'my-trips', 'create-trip', 'trip-detail', 'city-search', 'activity-search', 'profile', 'admin', 'shared'],

  go(page, params) {
    this.pages.forEach(p => {
      document.getElementById('page-' + p).classList.remove('active');
    });
    document.getElementById('page-' + page).classList.add('active');
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    const navLink = document.querySelector(`.nav-link[data-page="${page}"]`);
    if (navLink) navLink.classList.add('active');
    window.scrollTo(0, 0);

    if (page === 'dashboard') Dashboard.load();
    if (page === 'my-trips') Trips.loadList();
    if (page === 'city-search') Cities.init();
    if (page === 'activity-search') Activities.init();
    if (page === 'profile') Profile.load();
    if (page === 'admin') Admin.load();
    if (page === 'trip-detail' && params && params.tripId) TripDetail.open(params.tripId);
    if (page === 'create-trip') document.getElementById('ct-name').value = '';
  },

  handleHash() {
    const hash = window.location.hash;
    const shareMatch = hash.match(/^#\/shared\/(.+)$/);
    if (shareMatch) {
      Shared.loadPublic(shareMatch[1]);
      return true;
    }
    const tripMatch = hash.match(/^#\/trip\/(.+)$/);
    if (tripMatch && State.user) {
      this.go('trip-detail', { tripId: tripMatch[1] });
      return true;
    }
    return false;
  },
};

// ===================== AUTH =====================
const Auth = {
  async login(e) {
    e.preventDefault();
    UI.clearAuthMsg();
    try {
      const email = document.getElementById('login-email').value.trim();
      const password = document.getElementById('login-password').value;
      const data = await Api.post('/auth/login', { email, password });
      this.onAuthed(data);
    } catch (err) { UI.authError(err.message); }
    return false;
  },

  async signup(e) {
    e.preventDefault();
    UI.clearAuthMsg();
    try {
      const name = document.getElementById('signup-name').value.trim();
      const email = document.getElementById('signup-email').value.trim();
      const password = document.getElementById('signup-password').value;
      const data = await Api.post('/auth/signup', { name, email, password });
      this.onAuthed(data);
    } catch (err) { UI.authError(err.message); }
    return false;
  },

  async forgotPassword(e) {
    e.preventDefault();
    UI.clearAuthMsg();
    try {
      const email = document.getElementById('forgot-email').value.trim();
      const newPassword = document.getElementById('forgot-password').value;
      await Api.post('/auth/forgot-password', { email, newPassword });
      UI.authSuccess('Password updated! You can now log in.');
      setTimeout(() => UI.switchAuthTab('login'), 1200);
    } catch (err) { UI.authError(err.message); }
    return false;
  },

  onAuthed(data) {
    localStorage.setItem('gt_token', data.token);
    State.user = data.user;
    App.enterApp();
  },

  logout() {
    localStorage.removeItem('gt_token');
    State.user = null;
    window.location.hash = '';
    document.getElementById('app-shell').classList.remove('active');
    document.getElementById('public-screen').style.display = 'none';
    document.getElementById('auth-screen').style.display = 'flex';
  },

  async tryRestoreSession() {
    const token = Api.token();
    if (!token) return false;
    try {
      const data = await Api.get('/auth/me');
      State.user = data.user;
      return true;
    } catch (e) {
      localStorage.removeItem('gt_token');
      return false;
    }
  },
};

// ===================== APP BOOTSTRAP =====================
const App = {
  enterApp() {
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('public-screen').style.display = 'none';
    document.getElementById('app-shell').classList.add('active');
    document.getElementById('sidebar-name').textContent = State.user.name;
    document.getElementById('sidebar-email').textContent = State.user.email;
    document.getElementById('sidebar-avatar').textContent = State.user.name.charAt(0).toUpperCase();
    document.getElementById('admin-nav-link').style.display = State.user.is_admin ? 'flex' : 'none';

    if (!Router.handleHash()) Router.go('dashboard');
  },

  async init() {
    const restored = await Auth.tryRestoreSession();
    if (restored) {
      this.enterApp();
    } else if (window.location.hash.startsWith('#/shared/')) {
      Router.handleHash();
    } else {
      document.getElementById('auth-screen').style.display = 'flex';
    }
    window.addEventListener('hashchange', () => { if (State.user) Router.handleHash(); });
  },
};

// ===================== DASHBOARD =====================
const Dashboard = {
  async load() {
    document.getElementById('welcome-msg').textContent = `Welcome back, ${State.user.name.split(' ')[0]}!`;
    try {
      const { trips } = await Api.get('/trips');
      const upcoming = trips.filter(t => t.start_date && new Date(t.start_date) >= new Date());
      document.getElementById('stat-trips').textContent = trips.length;
      document.getElementById('stat-cities').textContent = trips.reduce((s, t) => s + t.destination_count, 0);
      document.getElementById('stat-upcoming').textContent = upcoming.length;

      // Estimate total budget across trips (light call per trip would be heavy; approximate using destination count)
      let totalBudgetEstimate = 0;
      const top3 = trips.slice(0, 3);
      for (const t of top3) {
        try {
          const full = await Api.get(`/trips/${t.id}`);
          totalBudgetEstimate += full.trip.budget.total;
        } catch (e) {}
      }
      document.getElementById('stat-budget').textContent = UI.fmtMoney(totalBudgetEstimate);

      const recentEl = document.getElementById('dashboard-recent-trips');
      if (trips.length === 0) {
        recentEl.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><div class="icon">🧳</div>No trips yet. Start planning your first adventure!</div>`;
      } else {
        recentEl.innerHTML = trips.slice(0, 3).map(Trips.cardHtml).join('');
      }
    } catch (err) { console.error(err); }

    try {
      const { cities } = await Api.get('/cities');
      const top = cities.slice(0, 4);
      document.getElementById('dashboard-recommended').innerHTML = top.map(c => `
        <div class="card city-card">
          <div class="city-top"><div><h3>${UI.escapeHtml(c.name)}</h3><div class="country">${UI.escapeHtml(c.country)}</div></div>
          <span class="badge badge-gold">★ ${c.popularity}</span></div>
          <div class="pill-row"><span class="pill">${UI.escapeHtml(c.region)}</span><span class="pill">~$${c.cost_index}/day</span></div>
        </div>`).join('');
    } catch (err) { console.error(err); }
  },
};

// ===================== TRIPS (list, create) =====================
const Trips = {
  cardHtml(t) {
    const dateRange = t.start_date ? `${UI.fmtDate(t.start_date)} – ${UI.fmtDate(t.end_date)}` : 'Dates not set';
    return `
      <div class="card trip-card">
        <div class="cover">🌍</div>
        <h3>${UI.escapeHtml(t.name)}</h3>
        <div class="meta">${dateRange}</div>
        <div class="pill-row">
          <span class="pill">${t.destination_count} destination${t.destination_count === 1 ? '' : 's'}</span>
          ${t.is_public ? '<span class="badge badge-gold">Public</span>' : ''}
        </div>
        <div class="actions">
          <button class="btn btn-primary btn-sm" onclick="Router.go('trip-detail',{tripId:'${t.id}'})">Open</button>
          <button class="btn btn-outline btn-sm" onclick="Trips.deleteFromList('${t.id}')">Delete</button>
        </div>
      </div>`;
  },

  async loadList() {
    const el = document.getElementById('my-trips-list');
    el.innerHTML = '<p style="color:var(--ink-soft)">Loading...</p>';
    try {
      const { trips } = await Api.get('/trips');
      if (trips.length === 0) {
        el.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><div class="icon">🧳</div>No trips yet.<br/><button class="btn btn-gold" style="margin-top:14px" onclick="Router.go('create-trip')">Plan Your First Trip</button></div>`;
        return;
      }
      el.innerHTML = trips.map(this.cardHtml).join('');
    } catch (err) { el.innerHTML = `<div class="error-msg" style="display:block">${err.message}</div>`; }
  },

  async deleteFromList(id) {
    if (!confirm('Delete this trip permanently?')) return;
    try { await Api.del(`/trips/${id}`); this.loadList(); Dashboard.load(); } catch (err) { alert(err.message); }
  },

  async create(e) {
    e.preventDefault();
    const errEl = document.getElementById('create-trip-error');
    errEl.style.display = 'none';
    try {
      const body = {
        name: document.getElementById('ct-name').value.trim(),
        start_date: document.getElementById('ct-start').value || null,
        end_date: document.getElementById('ct-end').value || null,
        description: document.getElementById('ct-desc').value.trim(),
        cover_photo: document.getElementById('ct-cover').value.trim(),
      };
      const { trip } = await Api.post('/trips', body);
      window.location.hash = `#/trip/${trip.id}`;
      Router.go('trip-detail', { tripId: trip.id });
    } catch (err) { errEl.textContent = err.message; errEl.style.display = 'block'; }
    return false;
  },
};

// ===================== TRIP DETAIL (builder / view / calendar / budget / share) =====================
const TripDetail = {
  currentTab: 'builder',
  viewMode: 'list',

  async open(tripId) {
    try {
      const { trip } = await Api.get(`/trips/${tripId}`);
      State.currentTrip = trip;
      document.getElementById('td-name').textContent = trip.name;
      document.getElementById('td-dates').textContent = trip.start_date ? `${UI.fmtDate(trip.start_date)} – ${UI.fmtDate(trip.end_date)}` : 'Dates not set';
      this.switchTab(this.currentTab);
      this.refreshShareBanner();
    } catch (err) { alert(err.message); Router.go('my-trips'); }
  },

  async reload() {
    const { trip } = await Api.get(`/trips/${State.currentTrip.id}`);
    State.currentTrip = trip;
    this.renderCurrentTab();
    this.refreshShareBanner();
  },

  switchTab(tab) {
    this.currentTab = tab;
    ['builder', 'view', 'calendar', 'budget'].forEach(t => {
      document.getElementById('td-' + t).style.display = t === tab ? 'block' : 'none';
      document.getElementById('tab-' + t).classList.toggle('active', t === tab);
    });
    this.renderCurrentTab();
  },

  renderCurrentTab() {
    if (this.currentTab === 'builder') this.renderBuilder();
    if (this.currentTab === 'view') this.renderView();
    if (this.currentTab === 'calendar') this.renderCalendar();
    if (this.currentTab === 'budget') this.renderBudget();
  },

  // ---- 5. Itinerary Builder ----
  renderBuilder() {
    const trip = State.currentTrip;
    const container = document.getElementById('td-stops-container');
    if (trip.stops.length === 0) {
      container.innerHTML = `<div class="empty-state"><div class="icon">🗺️</div>No stops yet. Add your first city below.</div>`;
      return;
    }
    container.innerHTML = trip.stops.map((stop, idx) => `
      <div class="stop-block">
        <div class="stop-header">
          <h3>${idx + 1}. ${UI.escapeHtml(stop.city.name)}, ${UI.escapeHtml(stop.city.country)}
            <span class="stop-dates">(${UI.fmtDate(stop.start_date)} – ${UI.fmtDate(stop.end_date)})</span>
          </h3>
          <div style="display:flex;gap:6px;">
            <button class="btn btn-outline btn-sm" onclick="TripDetail.openAddActivityModal('${stop.id}')">➕ Add Activity</button>
            <button class="btn btn-danger btn-sm" onclick="TripDetail.removeStop('${stop.id}')">Remove</button>
          </div>
        </div>
        ${stop.activities.length === 0
          ? `<div class="empty-hint">No activities added for this stop yet.</div>`
          : stop.activities.map(a => `
            <div class="activity-row">
              <div class="info"><strong>${UI.escapeHtml(a.name)}</strong> · Day ${a.day_number}${a.time_slot ? ' · ' + UI.escapeHtml(a.time_slot) : ''} <span class="pill" style="margin-left:6px;">${a.type}</span></div>
              <div style="display:flex;align-items:center;gap:10px;">
                <span class="cost">$${a.cost}</span>
                <button class="btn btn-outline btn-sm" onclick="TripDetail.removeActivity('${a.id}')">✕</button>
              </div>
            </div>`).join('')}
      </div>
    `).join('');
  },

  async openAddStopModal() {
    if (State.citiesCache.length === 0) {
      const { cities } = await Api.get('/cities');
      State.citiesCache = cities;
    }
    const sel = document.getElementById('modal-city-select');
    sel.innerHTML = State.citiesCache.map(c => `<option value="${c.id}">${UI.escapeHtml(c.name)}, ${UI.escapeHtml(c.country)}</option>`).join('');
    document.getElementById('modal-stop-start').value = '';
    document.getElementById('modal-stop-end').value = '';
    UI.openModal('add-stop-modal');
  },

  async addStop() {
    const city_id = document.getElementById('modal-city-select').value;
    const start_date = document.getElementById('modal-stop-start').value || null;
    const end_date = document.getElementById('modal-stop-end').value || null;
    try {
      await Api.post(`/trips/${State.currentTrip.id}/stops`, { city_id, start_date, end_date });
      UI.closeModal('add-stop-modal');
      await this.reload();
    } catch (err) { alert(err.message); }
  },

  async removeStop(stopId) {
    if (!confirm('Remove this stop and all its activities?')) return;
    try { await Api.del(`/trips/${State.currentTrip.id}/stops/${stopId}`); await this.reload(); } catch (err) { alert(err.message); }
  },

  async openAddActivityModal(stopId) {
    State.pendingStopId = stopId;
    const stop = State.currentTrip.stops.find(s => s.id === stopId);
    const { activities } = await Api.get(`/activities?city_id=${stop.city_id}`);
    const sel = document.getElementById('modal-activity-select');
    sel.innerHTML = activities.map(a => `<option value="${a.id}">${UI.escapeHtml(a.name)} — $${a.cost} (${a.type})</option>`).join('');
    document.getElementById('modal-activity-day').value = 1;
    document.getElementById('modal-activity-time').value = '';
    UI.openModal('add-activity-modal');
  },

  async confirmAddActivity() {
    const activity_id = document.getElementById('modal-activity-select').value;
    const day_number = parseInt(document.getElementById('modal-activity-day').value || '1', 10);
    const time_slot = document.getElementById('modal-activity-time').value.trim();
    try {
      await Api.post(`/trips/${State.currentTrip.id}/stops/${State.pendingStopId}/activities`, { activity_id, day_number, time_slot });
      UI.closeModal('add-activity-modal');
      await this.reload();
    } catch (err) { alert(err.message); }
  },

  async removeActivity(taId) {
    try { await Api.del(`/trips/${State.currentTrip.id}/activities/${taId}`); await this.reload(); } catch (err) { alert(err.message); }
  },

  async deleteTrip() {
    if (!confirm('Delete this entire trip? This cannot be undone.')) return;
    try { await Api.del(`/trips/${State.currentTrip.id}`); window.location.hash = ''; Router.go('my-trips'); } catch (err) { alert(err.message); }
  },

  // ---- 6. Itinerary View ----
  setViewMode(mode) {
    this.viewMode = mode;
    document.getElementById('view-mode-list').classList.toggle('active', mode === 'list');
    document.getElementById('view-mode-calendar').classList.toggle('active', mode === 'calendar');
    this.renderView();
  },

  renderView() {
    const trip = State.currentTrip;
    const el = document.getElementById('td-view-content');
    if (trip.stops.length === 0) { el.innerHTML = `<div class="empty-state">No itinerary built yet.</div>`; return; }

    if (this.viewMode === 'calendar') {
      // grouped by city
      el.innerHTML = trip.stops.map(stop => `
        <div class="card" style="margin-bottom:16px;">
          <h3 style="color:var(--navy-900);margin-bottom:8px;">${UI.escapeHtml(stop.city.name)}, ${UI.escapeHtml(stop.city.country)}</h3>
          <div class="meta" style="margin-bottom:10px;color:var(--ink-soft);font-size:13px;">${UI.fmtDate(stop.start_date)} – ${UI.fmtDate(stop.end_date)}</div>
          ${stop.activities.length === 0 ? '<div class="empty-hint">No activities planned.</div>' :
            stop.activities.map(a => `<div class="activity-row"><div class="info"><strong>${UI.escapeHtml(a.name)}</strong> · Day ${a.day_number}${a.time_slot ? ' · ' + UI.escapeHtml(a.time_slot) : ''}</div><span class="cost">$${a.cost}</span></div>`).join('')}
        </div>`).join('');
    } else {
      // day-wise layout across whole trip
      const dayMap = {};
      trip.stops.forEach(stop => {
        stop.activities.forEach(a => {
          const key = a.day_number;
          if (!dayMap[key]) dayMap[key] = [];
          dayMap[key].push({ ...a, cityName: stop.city.name });
        });
      });
      const days = Object.keys(dayMap).sort((a, b) => a - b);
      if (days.length === 0) { el.innerHTML = `<div class="empty-state">No activities scheduled yet.</div>`; return; }
      el.innerHTML = days.map(d => `
        <div class="card" style="margin-bottom:14px;">
          <h3 style="color:var(--navy-900);margin-bottom:10px;">Day ${d}</h3>
          ${dayMap[d].map(a => `<div class="activity-row"><div class="info"><strong>${UI.escapeHtml(a.name)}</strong> · ${UI.escapeHtml(a.cityName)}${a.time_slot ? ' · ' + UI.escapeHtml(a.time_slot) : ''}</div><span class="cost">$${a.cost}</span></div>`).join('')}
        </div>`).join('');
    }
  },

  // ---- 10. Calendar / Timeline ----
  renderCalendar() {
    const trip = State.currentTrip;
    const el = document.getElementById('td-timeline');
    if (trip.stops.length === 0) { el.innerHTML = `<div class="empty-state">Nothing to show yet.</div>`; return; }
    let html = '';
    trip.stops.forEach(stop => {
      const dayMap = {};
      stop.activities.forEach(a => { if (!dayMap[a.day_number]) dayMap[a.day_number] = []; dayMap[a.day_number].push(a); });
      const days = Object.keys(dayMap).sort((a, b) => a - b);
      html += `<div class="timeline-day"><h4>${UI.escapeHtml(stop.city.name)} · ${UI.fmtDate(stop.start_date)} – ${UI.fmtDate(stop.end_date)}</h4>`;
      if (days.length === 0) {
        html += `<div class="empty-hint">No activities scheduled.</div>`;
      } else {
        days.forEach(d => {
          html += `<div style="margin-bottom:8px;"><strong style="font-size:13px;color:var(--navy-700);">Day ${d}</strong>`;
          dayMap[d].forEach(a => { html += `<div class="activity-row"><div class="info">${UI.escapeHtml(a.name)}${a.time_slot ? ' · ' + UI.escapeHtml(a.time_slot) : ''}</div><span class="cost">$${a.cost}</span></div>`; });
          html += `</div>`;
        });
      }
      html += `</div>`;
    });
    el.innerHTML = html;
  },

  // ---- 9. Budget ----
  renderBudget() {
    const b = State.currentTrip.budget;
    document.getElementById('td-budget-rows').innerHTML = `
      <div class="budget-row"><span>Transport (est.)</span><strong>${UI.fmtMoney(b.transport)}</strong></div>
      <div class="budget-row"><span>Stay (est.)</span><strong>${UI.fmtMoney(b.stay)}</strong></div>
      <div class="budget-row"><span>Activities</span><strong>${UI.fmtMoney(b.activities)}</strong></div>
      <div class="budget-row"><span>Meals (est.)</span><strong>${UI.fmtMoney(b.meals)}</strong></div>
      <div class="budget-row" style="font-size:16px;"><span><strong>Total Estimated Cost</strong></span><strong style="color:var(--navy-900)">${UI.fmtMoney(b.total)}</strong></div>
    `;
    document.getElementById('td-avg-day').textContent = UI.fmtMoney(b.avgPerDay);

    const parts = [
      { label: 'Transport', val: b.transport, color: '#c9a227' },
      { label: 'Stay', val: b.stay, color: '#1e3a5f' },
      { label: 'Activities', val: b.activities, color: '#1e7a4c' },
      { label: 'Meals', val: b.meals, color: '#b3372c' },
    ];
    const max = Math.max(...parts.map(p => p.val), 1);
    document.getElementById('td-budget-bars').innerHTML = parts.map(p => `
      <div style="margin-bottom:12px;">
        <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--ink-soft);"><span>${p.label}</span><span>${UI.fmtMoney(p.val)}</span></div>
        <div class="bar-track"><div class="bar-fill" style="width:${(p.val / max) * 100}%;background:${p.color};"></div></div>
      </div>`).join('');

    const alertEl = document.getElementById('td-budget-alert');
    if (b.avgPerDay > 250) {
      alertEl.innerHTML = `<div class="alert-box">⚠️ This trip averages ${UI.fmtMoney(b.avgPerDay)}/day — consider trimming activities or choosing lower-cost stays to stay on budget.</div>`;
    } else { alertEl.innerHTML = ''; }
  },

  // ---- 11. Sharing ----
  refreshShareBanner() {
    const trip = State.currentTrip;
    const banner = document.getElementById('share-banner');
    const btn = document.getElementById('share-btn');
    if (trip.is_public) {
      banner.style.display = 'flex';
      document.getElementById('share-link-input').value = `${window.location.origin}/#/shared/${trip.public_slug}`;
      btn.textContent = '🔒 Make Private';
    } else {
      banner.style.display = 'none';
      btn.textContent = '🔗 Share Trip';
    }
  },

  async toggleShare() {
    try {
      if (State.currentTrip.is_public) {
        await Api.post(`/trips/${State.currentTrip.id}/unshare`);
      } else {
        await Api.post(`/trips/${State.currentTrip.id}/share`);
      }
      await this.reload();
    } catch (err) { alert(err.message); }
  },

  copyLink() {
    const input = document.getElementById('share-link-input');
    input.select();
    navigator.clipboard.writeText(input.value).then(() => alert('Link copied to clipboard!'));
  },
};

// ===================== 7. CITY SEARCH =====================
const Cities = {
  async init() {
    const { regions } = await Api.get('/cities/regions');
    const sel = document.getElementById('city-region-filter');
    sel.innerHTML = '<option value="">All Regions</option>' + regions.map(r => `<option value="${r}">${r}</option>`).join('');
    this.search();
  },

  async search() {
    const search = document.getElementById('city-search-input').value;
    const region = document.getElementById('city-region-filter').value;
    const { cities } = await Api.get(`/cities?search=${encodeURIComponent(search)}&region=${encodeURIComponent(region)}`);
    const el = document.getElementById('city-results');
    if (cities.length === 0) { el.innerHTML = `<div class="empty-state" style="grid-column:1/-1;">No cities found.</div>`; return; }
    el.innerHTML = cities.map(c => `
      <div class="card city-card">
        <div class="city-top">
          <div><h3>${UI.escapeHtml(c.name)}</h3><div class="country">${UI.escapeHtml(c.country)}</div></div>
          <span class="badge badge-gold">★ ${c.popularity}</span>
        </div>
        <div class="pill-row"><span class="pill">${UI.escapeHtml(c.region)}</span><span class="pill">~$${c.cost_index}/day</span></div>
        <button class="btn btn-outline btn-sm" onclick="Cities.addToTripPrompt('${c.id}')">➕ Add to Trip</button>
      </div>`).join('');
  },

  async addToTripPrompt(cityId) {
    try {
      const { trips } = await Api.get('/trips');
      if (trips.length === 0) { alert('Create a trip first, then add cities to it.'); Router.go('create-trip'); return; }
      const names = trips.map((t, i) => `${i + 1}. ${t.name}`).join('\n');
      const choice = prompt(`Add to which trip?\n${names}\n\nEnter the number:`);
      const idx = parseInt(choice, 10) - 1;
      if (isNaN(idx) || !trips[idx]) return;
      await Api.post(`/trips/${trips[idx].id}/stops`, { city_id: cityId });
      alert(`Added to "${trips[idx].name}"!`);
    } catch (err) { alert(err.message); }
  },
};

// ===================== 8. ACTIVITY SEARCH =====================
const Activities = {
  async init() {
    const { cities } = await Api.get('/cities');
    const citySel = document.getElementById('activity-city-filter');
    citySel.innerHTML = '<option value="">All Cities</option>' + cities.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    const { types } = await Api.get('/activities/types');
    const typeSel = document.getElementById('activity-type-filter');
    typeSel.innerHTML = '<option value="">All Types</option>' + types.map(t => `<option value="${t}">${t[0].toUpperCase() + t.slice(1)}</option>`).join('');
    this.search();
  },

  async search() {
    const search = document.getElementById('activity-search-input').value;
    const city_id = document.getElementById('activity-city-filter').value;
    const type = document.getElementById('activity-type-filter').value;
    const maxCost = document.getElementById('activity-cost-filter').value;
    const { activities } = await Api.get(`/activities?search=${encodeURIComponent(search)}&city_id=${city_id}&type=${type}&maxCost=${maxCost}`);
    const el = document.getElementById('activity-results');
    if (activities.length === 0) { el.innerHTML = `<div class="empty-state" style="grid-column:1/-1;">No activities found.</div>`; return; }
    el.innerHTML = activities.map(a => `
      <div class="card activity-card">
        <div class="city-top"><h3 style="font-size:15px;">${UI.escapeHtml(a.name)}</h3><span class="badge badge-navy act-type">${a.type}</span></div>
        <div class="meta">${UI.escapeHtml(a.city_name)} · ${a.duration_hours}h</div>
        <p style="font-size:12px;color:var(--ink-soft);">${UI.escapeHtml(a.description)}</p>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px;">
          <span class="cost" style="font-weight:700;">$${a.cost}</span>
        </div>
      </div>`).join('');
  },
};

// ===================== 12. PROFILE =====================
const Profile = {
  async load() {
    const { user } = await Api.get('/auth/me');
    State.user = user;
    document.getElementById('profile-name').value = user.name;
    document.getElementById('profile-email').value = user.email;
    document.getElementById('profile-photo').value = user.photo || '';
    document.getElementById('profile-language').value = user.language || 'English';

    const { trips } = await Api.get('/trips');
    const cityIds = new Set();
    const cityCards = [];
    for (const t of trips.slice(0, 5)) {
      try {
        const { trip } = await Api.get(`/trips/${t.id}`);
        trip.stops.forEach(s => {
          if (!cityIds.has(s.city.id)) { cityIds.add(s.city.id); cityCards.push(s.city); }
        });
      } catch (e) {}
    }
    const el = document.getElementById('profile-saved-cities');
    el.innerHTML = cityCards.length === 0
      ? `<div class="empty-state" style="grid-column:1/-1;">No saved destinations yet.</div>`
      : cityCards.map(c => `<div class="card city-card"><h3>${UI.escapeHtml(c.name)}</h3><div class="country">${UI.escapeHtml(c.country)}</div></div>`).join('');
  },

  async update(e) {
    e.preventDefault();
    const msg = document.getElementById('profile-msg');
    try {
      const { user } = await Api.put('/auth/me', {
        name: document.getElementById('profile-name').value.trim(),
        photo: document.getElementById('profile-photo').value.trim(),
        language: document.getElementById('profile-language').value,
      });
      State.user = user;
      document.getElementById('sidebar-name').textContent = user.name;
      document.getElementById('sidebar-avatar').textContent = user.name.charAt(0).toUpperCase();
      msg.textContent = 'Profile updated successfully!'; msg.style.display = 'block';
      setTimeout(() => msg.style.display = 'none', 2500);
    } catch (err) { alert(err.message); }
    return false;
  },

  async deleteAccount() {
    if (!confirm('This will permanently delete your account and all trips. Continue?')) return;
    try { await Api.del('/auth/me'); Auth.logout(); } catch (err) { alert(err.message); }
  },
};

// ===================== 13. ADMIN =====================
const Admin = {
  async load() {
    try {
      const stats = await Api.get('/admin/stats');
      document.getElementById('admin-total-users').textContent = stats.totalUsers;
      document.getElementById('admin-total-trips').textContent = stats.totalTrips;
      document.getElementById('admin-total-stops').textContent = stats.totalStops;
      document.getElementById('admin-public-trips').textContent = stats.publicTrips;

      const maxCity = Math.max(...stats.topCities.map(c => c.uses), 1);
      document.getElementById('admin-top-cities').innerHTML = stats.topCities.map(c => `
        <div style="margin-bottom:10px;">
          <div style="display:flex;justify-content:space-between;font-size:13px;"><span>${UI.escapeHtml(c.name)}, ${UI.escapeHtml(c.country)}</span><span>${c.uses}</span></div>
          <div class="bar-track"><div class="bar-fill" style="width:${(c.uses / maxCity) * 100}%"></div></div>
        </div>`).join('') || '<p style="color:var(--ink-soft);font-size:13px;">No data yet.</p>';

      const maxType = Math.max(...stats.topActivityTypes.map(t => t.uses), 1);
      document.getElementById('admin-top-types').innerHTML = stats.topActivityTypes.map(t => `
        <div style="margin-bottom:10px;">
          <div style="display:flex;justify-content:space-between;font-size:13px;text-transform:capitalize;"><span>${t.type}</span><span>${t.uses}</span></div>
          <div class="bar-track"><div class="bar-fill" style="width:${(t.uses / maxType) * 100}%"></div></div>
        </div>`).join('') || '<p style="color:var(--ink-soft);font-size:13px;">No data yet.</p>';

      const tbody = document.querySelector('#admin-users-table tbody');
      tbody.innerHTML = stats.tripsPerUser.map(u => `<tr><td>${UI.escapeHtml(u.name)}</td><td>${UI.escapeHtml(u.email)}</td><td>${u.trip_count}</td></tr>`).join('');
    } catch (err) {
      document.getElementById('page-admin').innerHTML = `<div class="error-msg" style="display:block">${err.message === 'Admin access required' ? 'You do not have admin access.' : err.message}</div>`;
    }
  },
};

// ===================== 11. SHARED PUBLIC VIEW =====================
const Shared = {
  async loadPublic(slug) {
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('app-shell').classList.remove('active');
    document.getElementById('public-screen').style.display = 'block';
    const el = document.getElementById('public-content');
    el.innerHTML = '<p>Loading shared trip...</p>';
    try {
      const { trip } = await Api.get(`/public/trip/${slug}`);
      el.innerHTML = `
        <h1 style="color:var(--navy-900);margin-bottom:4px;">${UI.escapeHtml(trip.name)}</h1>
        <p style="color:var(--ink-soft);margin-bottom:20px;">${trip.start_date ? UI.fmtDate(trip.start_date) + ' – ' + UI.fmtDate(trip.end_date) : ''}</p>
        <p style="margin-bottom:20px;">${UI.escapeHtml(trip.description || '')}</p>
        <div class="card" style="margin-bottom:20px;">
          <h3 style="margin-bottom:10px;">Estimated Budget: ${UI.fmtMoney(trip.budget.total)}</h3>
          <div style="font-size:13px;color:var(--ink-soft);">Avg ${UI.fmtMoney(trip.budget.avgPerDay)}/day</div>
        </div>
        ${trip.stops.map(stop => `
          <div class="card" style="margin-bottom:16px;">
            <h3 style="color:var(--navy-900);">${UI.escapeHtml(stop.city.name)}, ${UI.escapeHtml(stop.city.country)}</h3>
            <div style="font-size:12px;color:var(--ink-soft);margin-bottom:10px;">${UI.fmtDate(stop.start_date)} – ${UI.fmtDate(stop.end_date)}</div>
            ${stop.activities.map(a => `<div class="activity-row"><div class="info"><strong>${UI.escapeHtml(a.name)}</strong> · Day ${a.day_number}</div><span class="cost">$${a.cost}</span></div>`).join('') || '<div class="empty-hint">No activities listed.</div>'}
          </div>`).join('')}
      `;
    } catch (err) {
      el.innerHTML = `<div class="error-msg" style="display:block">${err.message}</div>`;
    }
  },
};

// ===================== INIT =====================
App.init();
