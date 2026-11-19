/* GOAL TRACKERS — js/core.js (1/4): Inti: utilitas, state, sinkronisasi (outbox), boot, router, helper, kartu */
/* ============================================================
   GOAL TRACKERS — Frontend (JavaScript.html)
   Prinsip Instant UX:
   1. SPA murni: semua halaman dirender dari state lokal (0 ms), tanpa
      panggilan server untuk navigasi & tanpa perubahan URL.
   2. Optimistic UI + localStorage: setiap aksi langsung tampil, disimpan
      ke antrean (outbox) lalu disinkronkan di latar belakang.
   3. Backend GAS = REST API (fetch JSON); server cache + batch: 1 panggilan memuat seluruh data.
   4. Polling ringan 60 detik hanya mengambil data bila ada perubahan.
   ============================================================ */

// ── Utilitas ──
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = s => String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const NF = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 });
const fmtN = n => NF.format(Number(n) || 0);
const fmtVal = (n, unit) => unit === 'Rp' ? 'Rp ' + fmtN(n) : fmtN(n) + ' ' + (unit || '');
const fmtShort = (n, unit) => {
  if (unit !== 'Rp') return fmtVal(n, unit);
  const a = Math.abs(Number(n) || 0);
  if (a >= 1e9) return 'Rp ' + fmtN(Math.round(n / 1e8) / 10) + ' M';
  if (a >= 1e6) return 'Rp ' + fmtN(Math.round(n / 1e5) / 10) + ' jt';
  if (a >= 1e3) return 'Rp ' + fmtN(Math.round(n / 100) / 10) + ' rb';
  return 'Rp ' + fmtN(n);
};
const pad = n => String(n).padStart(2, '0');
const isoDate = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => isoDate(new Date());
const nowIso = () => { const d = new Date(); return `${isoDate(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`; };
const addDays = (iso, n) => { const d = new Date(iso.slice(0, 10) + 'T12:00:00'); d.setDate(d.getDate() + n); return isoDate(d); };
const dayDiff = (a, b) => Math.round((new Date(b.slice(0, 10) + 'T12:00:00') - new Date(a.slice(0, 10) + 'T12:00:00')) / 864e5);
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const MONTHS_LONG = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const fmtDate = iso => { if (!iso) return '-'; const [y, m, d] = iso.slice(0, 10).split('-'); return `${+d} ${MONTHS[+m - 1]} ${y}`; };
const fmtDay = iso => { const [, m, d] = iso.slice(0, 10).split('-'); return `${+d} ${MONTHS[+m - 1]}`; };
const fmtLong = iso => { const d = new Date(iso + 'T12:00:00'); return `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS_LONG[d.getMonth()]} ${d.getFullYear()}`; };
const timeAgo = iso => {
  if (!iso) return '';
  const diff = (Date.now() - new Date(iso.length > 10 ? iso : iso + 'T12:00:00').getTime()) / 1000;
  if (diff < 60) return 'baru saja';
  if (diff < 3600) return Math.floor(diff / 60) + ' menit lalu';
  if (diff < 86400) return Math.floor(diff / 3600) + ' jam lalu';
  if (diff < 86400 * 7) return Math.floor(diff / 86400) + ' hari lalu';
  return fmtDate(iso);
};
const uid = () => (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : 'id-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 12);
const debounce = (fn, ms = 250) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
const lsGet = (k, def) => { try { const v = localStorage.getItem(k); return v === null ? def : JSON.parse(v); } catch (e) { return def; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };
const lsDel = k => { try { localStorage.removeItem(k); } catch (e) { } };
const parseNum = (s, money) => {
  s = String(s || '').trim();
  if (money) return Number(s.replace(/[^\d]/g, '')) || 0;
  return Number(s.replace(/\s/g, '').replace(',', '.')) || 0;
};
const PASTELS = ['#CFF2D6', '#E8D3F5', '#D5F0F7', '#FBEBB5', '#F8CFE0', '#FFE1C7'];
const CAT_ICONS = ['bi-wallet2', 'bi-safe2', 'bi-heart-pulse', 'bi-bicycle', 'bi-briefcase', 'bi-mortarboard', 'bi-book', 'bi-moon-stars',
  'bi-airplane', 'bi-house-heart', 'bi-car-front', 'bi-cup-hot', 'bi-flower1', 'bi-gift', 'bi-music-note-beamed', 'bi-camera',
  'bi-lightning-charge', 'bi-tree', 'bi-people', 'bi-balloon-heart', 'bi-palette', 'bi-laptop', 'bi-basket', 'bi-trophy'];
const AVATARS = ['🧔', '👩', '👨', '🧕', '🙂', '😎', '🦸‍♂️', '🦸‍♀️', '🐻', '🐱', '🌸', '⭐'];
const REACTIONS = ['❤️', '🔥', '👏', '💪', '🎉', '🥰'];
const STATE_LABEL = {
  done: ['Selesai 👏', 's-done', 'Selesai'], active: ['Berjalan', 's-active', 'Berjalan'],
  upcoming: ['Akan Datang ⏱', 's-upcoming', 'Akan Datang'], overdue: ['Terlambat', 's-overdue', 'Terlambat'],
  archived: ['Diarsipkan', 's-archived', 'Diarsipkan']
};
const LIB = {
  chart: 'https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.js',
  xlsx: 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
  jspdf: 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js',
  autotable: 'https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.2/dist/jspdf.plugin.autotable.min.js'
};
const KEY = { token: 'gt_token', snap: 'gt_snap_v1', outbox: 'gt_outbox_v1', owner: 'gt_outbox_owner', theme: 'gt_theme', view: 'gt_view' };

// ── State aplikasi (sumber kebenaran untuk render) ──
const DATA_KEYS = ['me', 'users', 'goals', 'milestones', 'logs', 'categories', 'achievements', 'notifications', 'reactions', 'settings', 'version', 'assets', 'assetIncome', 'loans', 'harta', 'pengeluaran'];
const S = {
  token: null, me: null, users: [], goals: [], milestones: [], logs: [], categories: [], achievements: [],
  notifications: [], reactions: [], settings: {}, version: '0', assets: [], assetIncome: [], loans: [], harta: [], pengeluaran: [],
  ui: {
    page: 'dashboard', history: [], detailId: null,
    goalTab: 'semua', goalView: lsGet(KEY.view, 'journey'), goalQuery: '', goalCat: '', goalStatus: 'aktif', goalSort: 'tenggat',
    reportMode: 'bulan', reportMonth: today().slice(0, 7), reportYear: today().slice(0, 4),
    tblQuery: '', tblUser: '', tblJenis: '', tblCat: '', tblPage: 1, celebUser: '',
    pendingPhoto: null, confirmCb: null, celeT: null, offline: false
  }
};

// ============================================================
// SINKRONISASI: API + OUTBOX (OPTIMISTIC UI)
// ============================================================
function api(fn, ...args) {
  // Panggil backend Google Apps Script (REST API) lewat fetch.
  // Content-Type text/plain wajib agar tidak memicu CORS preflight yang ditolak GAS.
  return fetch(GAS_URL, {
    method: 'POST',
    redirect: 'follow',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action: fn, args })
  }).then(r => {
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }).catch(err => {
    throw { message: navigator.onLine === false ? 'Tidak ada koneksi internet.' : 'Server tidak bisa dihubungi (' + ((err && err.message) || 'jaringan') + ').', network: true };
  }).then(res => {
    if (res && res.success) return res.data;
    throw { message: (res && res.message) || 'Terjadi kesalahan.', auth: !!(res && res.auth), server: true };
  });
}

const Outbox = {
  q: lsGet(KEY.outbox, []),
  busy: false, retry: 0, timer: null,
  push(fn, args) {
    this.q.push({ id: uid(), fn, args });
    if (S.me) lsSet(KEY.owner, S.me.user_id);
    this.save();
    this.flush();
  },
  save() {
    if (!lsSet(KEY.outbox, this.q)) {
      // localStorage penuh: simpan tanpa foto (foto tetap terkirim selama sesi ini)
      lsSet(KEY.outbox, this.q.map(op => op.fn === 'addProgress' ? Object.assign({}, op, { args: [op.args[0], null] }) : op));
    }
    updateSync();
  },
  flush() {
    if (this.busy || !this.q.length || !S.token) { updateSync(); return; }
    this.busy = true;
    updateSync();
    const op = this.q[0];
    api(op.fn, S.token, ...op.args).then(data => {
      this.q.shift();
      this.save();
      this.busy = false;
      this.retry = 0;
      S.ui.offline = false;
      if (data && Array.isArray(data.newAchievements)) {
        const streak = data.newAchievements.find(a => /^Streak/.test(a.jenis));
        if (streak) showCelebration({ emoji: '🔥', title: streak.jenis.replace('Streak ', '') + ' hari beruntun!', text: streak.pesan });
      }
      if (!this.q.length && data && data.goals) applyPayload(data);
      this.flush();
    }).catch(err => {
      this.busy = false;
      if (err.auth) { handleAuthLost(); return; }
      if (err.network) {
        S.ui.offline = true;
        this.retry++;
        clearTimeout(this.timer);
        this.timer = setTimeout(() => this.flush(), Math.min(30000, 2000 * this.retry));
        updateSync();
        return;
      }
      // Ditolak server (validasi/hak akses) → buang & kembalikan data dari server
      this.q.shift();
      this.save();
      toast(err.message, 'error', 4200);
      if (!this.q.length) refreshData();
      this.flush();
    });
  },
  clear() { this.q = []; this.save(); }
};

function updateSync() {
  const el = $('#syncState');
  if (!el) return;
  const pending = Outbox.q.length;
  el.className = 'sync' + (S.ui.offline ? ' off' : pending ? ' busy' : '');
  el.innerHTML = `<i class="bi ${S.ui.offline ? 'bi-cloud-slash' : pending ? 'bi-cloud-arrow-up' : 'bi-cloud-check'}"></i>`;
  el.title = S.ui.offline ? `Offline — ${pending} perubahan menunggu` : pending ? `Menyimpan ${pending} perubahan…` : 'Semua perubahan tersimpan';
}

let _snapT;
function saveSnapshot() {
  clearTimeout(_snapT);
  _snapT = setTimeout(() => {
    const snap = {};
    DATA_KEYS.forEach(k => { snap[k] = S[k]; });
    if (!lsSet(KEY.snap, snap)) {
      snap.logs = S.logs.map(l => /^data:/.test(l.foto_url) ? Object.assign({}, l, { foto_url: '' }) : l);
      lsSet(KEY.snap, snap);
    }
  }, 300);
}

function applyPayload(p) {
  if (!p) return;
  DATA_KEYS.forEach(k => { if (p[k] !== undefined) S[k] = p[k]; });
  saveSnapshot();
  renderAll();
}

function refreshData() {
  if (!S.token || Outbox.q.length) return Promise.resolve();
  return api('restoreSession', S.token).then(applyPayload).catch(e => { if (e.auth) handleAuthLost(); });
}

// Polling ringan
let _pollTimer = null;
function startPolling() { stopPolling(); _pollTimer = setInterval(pollNow, 60000); }
function stopPolling() { clearInterval(_pollTimer); }
function pollNow() {
  if (!S.token || document.hidden || Outbox.q.length || Outbox.busy) return;
  api('poll', S.token, S.version).then(r => {
    if (!r.changed) return;
    const before = new Set(S.notifications.map(n => n.notif_id));
    applyPayload(r.payload);
    const fresh = S.notifications.filter(n => !before.has(n.notif_id) && n.dibaca !== 'Ya');
    if (fresh.length) toast('🔔 ' + (fresh.length === 1 ? fresh[0].pesan : fresh.length + ' notifikasi baru'));
  }).catch(e => { if (e.auth) handleAuthLost(); });
}

// ============================================================
// BOOT & AUTENTIKASI
// ============================================================
function boot() {
  applyTheme(lsGet(KEY.theme, null) || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'), true);
  const token = lsGet(KEY.token, null);
  const snap = lsGet(KEY.snap, null);
  if (token && snap && snap.me) {
    // Tampil INSTAN dari snapshot lokal, lalu sinkron di belakang layar
    S.token = token;
    DATA_KEYS.forEach(k => { if (snap[k] !== undefined) S[k] = snap[k]; });
    showApp();
    Outbox.flush();
    refreshData();
    startPolling();
  } else if (token) {
    api('restoreSession', token).then(d => { S.token = token; applyPayload(d); showApp(); startPolling(); })
      .catch(() => { lsDel(KEY.token); showLogin(); });
  } else {
    showLogin();
  }
}

function hideSplash() { const s = $('#splash'); if (!s) return; s.classList.add('hide'); setTimeout(() => s.remove(), 300); }
function showLogin(msg) {
  $('#app').hidden = true;
  $('#view-login').hidden = false;
  $('#loginError').textContent = msg || '';
  hideSplash();
  setTimeout(() => { const i = $('#view-login input[name=email]'); if (i && !i.value) i.focus(); }, 80);
}
function showApp() {
  $('#view-login').hidden = true;
  $('#app').hidden = false;
  hideSplash();
  navigateTo(S.ui.page || 'dashboard', { noHistory: true });
  updateSync();
  prefetchLibs();
}
function onLoggedIn(data) {
  if (lsGet(KEY.owner, null) && lsGet(KEY.owner, null) !== data.me.user_id) Outbox.clear();
  S.token = data.token;
  lsSet(KEY.token, data.token);
  S.ui.page = 'dashboard';
  S.ui.history = [];
  applyPayload(data);
  showApp();
  Outbox.flush();
  startPolling();
  toast(`Selamat datang, ${data.me.nama}! 💞`);
}
function handleAuthLost() {
  S.token = null;
  lsDel(KEY.token);
  stopPolling();
  closeSheet();
  showLogin('Sesi berakhir. Silakan masuk kembali.');
}
function doLogout() {
  const go = () => {
    if (S.token) api('logout', S.token).catch(() => { });
    S.token = null;
    stopPolling();
    [KEY.token, KEY.snap, KEY.owner].forEach(lsDel);
    Outbox.clear();
    DATA_KEYS.forEach(k => { S[k] = Array.isArray(S[k]) ? [] : (k === 'settings' ? {} : null); });
    closeSheet();
    showLogin();
  };
  if (Outbox.q.length) confirmBox({ title: 'Keluar sekarang?', text: `Masih ada ${Outbox.q.length} perubahan yang belum tersimpan ke server dan akan hilang.`, ok: 'Tetap keluar', danger: true }, go);
  else go();
}

let _prefetched = false;
function prefetchLibs() {
  if (_prefetched) return;
  _prefetched = true;
  const idle = window.requestIdleCallback || (cb => setTimeout(cb, 1200));
  idle(() => loadScript(LIB.chart).catch(() => { }));
}

const _scripts = {};
function loadScript(src) {
  if (!_scripts[src]) {
    _scripts[src] = new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = res;
      s.onerror = () => { delete _scripts[src]; rej(new Error('Gagal memuat pustaka. Periksa koneksi internet.')); };
      document.head.appendChild(s);
    });
  }
  return _scripts[src];
}

// ============================================================
// TEMA
// ============================================================
function applyTheme(t, silent) {
  document.documentElement.setAttribute('data-theme', t);
  lsSet(KEY.theme, t);
  const i = $('#themeIcon');
  if (i) i.className = 'bi ' + (t === 'dark' ? 'bi-sun' : 'bi-moon-stars');
  const meta = document.querySelector('meta[name=theme-color]');
  if (meta) meta.content = t === 'dark' ? '#000000' : '#111111';
  if (!silent && S.me) renderPage(S.ui.page);
}

// ============================================================
// ROUTER SPA (tanpa URL, tanpa server)
// ============================================================
// Dibuat saat dipakai (fungsi render ada di JS2/JS3 yang dimuat setelah berkas ini)
let _render = null;
const RENDER = () => _render || (_render = {
  dashboard: renderDashboard, goals: renderGoals, detail: renderDetail, finance: renderFinance,
  celebrate: renderCelebrate, reports: renderReports, settings: renderSettings, notifications: renderNotifications
});
const NAV_GROUP = { detail: 'goals', celebrate: 'more', reports: 'more', settings: 'more', notifications: 'more' };

function navigateTo(page, opts = {}) {
  if (!RENDER()[page]) page = 'dashboard';
  if (!opts.noHistory && S.ui.page && (S.ui.page !== page || page === 'detail')) {
    S.ui.history.push({ page: S.ui.page, detailId: S.ui.detailId });
    if (S.ui.history.length > 30) S.ui.history.shift();
  }
  if (opts.detailId) S.ui.detailId = opts.detailId;
  S.ui.page = page;
  $$('.page').forEach(p => p.classList.toggle('active', p.dataset.page === page));
  renderHeader();
  renderPage(page);
  window.scrollTo(0, 0);
  closeSheet();
}
function goBack() {
  const prev = S.ui.history.pop();
  if (prev) { S.ui.detailId = prev.detailId; navigateTo(prev.page, { noHistory: true }); }
  else navigateTo('dashboard', { noHistory: true });
}
function renderPage(page) {
  // Pertahankan fokus & posisi kursor saat render ulang (mis. data baru dari polling)
  const a = document.activeElement;
  const id = a && a.id && a.closest && a.closest('.page') ? a.id : null;
  let pos = null;
  try { pos = id ? a.selectionStart : null; } catch (e) { }
  if (RENDER()[page]) RENDER()[page]();
  if (id) {
    const el = document.getElementById(id);
    if (el) { el.focus(); try { if (pos !== null) el.setSelectionRange(pos, pos); } catch (e) { } }
  }
}
function renderAll() {
  if (!S.me) return;
  renderHeader();
  keepRows('#page-' + S.ui.page, () => renderPage(S.ui.page));   // pembaruan data tidak menggeser tab/chip ke awal
}
function renderHeader() {
  if (!S.me) return;
  const me = S.me;
  const av = $('#meAvatar');
  av.style.setProperty('--c', me.warna_profil || '#CFF2D6');
  const foto = me.foto && /^data:image\//.test(me.foto) ? me.foto : '';
  av.classList.toggle('has-foto', !!foto);
  if (foto) { av.innerHTML = ''; const im = document.createElement('img'); im.src = foto; im.alt = me.nama; av.appendChild(im); }
  else av.textContent = me.avatar || me.nama.charAt(0).toUpperCase();
  $('#meName').textContent = me.nama;
  $('#meEmail').textContent = me.email;
  const unread = S.notifications.filter(n => n.dibaca !== 'Ya').length;
  const bc = $('#bellCount');
  bc.hidden = !unread;
  bc.textContent = unread > 99 ? '99+' : unread;
  const group = NAV_GROUP[S.ui.page] || S.ui.page;
  $$('[data-nav]').forEach(b => {
    const on = b.dataset.nav === S.ui.page || (b.closest('.bottom-nav') && b.dataset.nav === group) || (b.closest('.top-nav') && S.ui.page === 'detail' && b.dataset.nav === 'goals');
    b.classList.toggle('active', !!on);
    if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  });
}

// ============================================================
// HELPER DOMAIN
// ============================================================
const goalById = id => S.goals.find(g => g.goal_id === id);
const catById = id => S.categories.find(c => c.kategori_id === id) || { kategori_id: '', nama: 'Lainnya', ikon: 'bi-bookmark', warna: '#D5F0F7' };
const userById = id => S.users.find(u => u.user_id === id) || { user_id: id, nama: 'Pengguna', avatar: '', warna_profil: '#D5F0F7' };
const partner = () => S.users.find(u => S.me && u.user_id !== S.me.user_id);
const activeCats = () => S.categories.filter(c => c.aktif !== 'Tidak').sort((a, b) => a.urutan - b.urutan);
const goalPct = g => { const t = Number(g.nilai_target) || 0; return t > 0 ? Math.min(100, (Number(g.nilai_saat_ini) || 0) / t * 100) : 0; };
const pctInt = g => Math.floor(goalPct(g) + 1e-9);
const goalColor = g => g.warna || catById(g.kategori_id).warna;
const goalIcon = g => g.ikon || catById(g.kategori_id).ikon;
const canEdit = g => g.jenis === 'Bersama' || (S.me && g.pemilik_id === S.me.user_id);
const canLog = g => canEdit(g) && g.status !== 'Arsip';
const canDelete = g => g.jenis === 'Bersama' ? isAdmin() : g.pemilik_id === S.me.user_id;
const isAdmin = () => S.me && S.me.peran === 'Admin';
const msOf = id => S.milestones.filter(m => m.goal_id === id).sort((a, b) => a.urutan - b.urutan);
const logsOf = id => S.logs.filter(l => l.goal_id === id).sort((a, b) => (b.tanggal + b.dibuat_pada).localeCompare(a.tanggal + a.dibuat_pada));
const units = () => String(S.settings.satuan_kustom || 'kali,km,kg,buku,jam').split(',').map(s => s.trim()).filter(Boolean);
const PRIO_RANK = { Tinggi: 0, Sedang: 1, Rendah: 2 };

function goalState(g) {
  if (g.status === 'Arsip') return 'archived';
  if (g.status === 'Selesai' || goalPct(g) >= 100) return 'done';
  const t = today();
  if (g.tgl_mulai > t) return 'upcoming';
  if (g.tenggat < t) return 'overdue';
  return 'active';
}
function avatarHtml(u, cls = '') {
  if (u.foto && /^data:image\//.test(u.foto)) return `<span class="avatar has-foto ${cls}" style="--c:${esc(u.warna_profil || '#CFF2D6')}" title="${esc(u.nama)}"><img src="${esc(u.foto)}" alt="${esc(u.nama)}"></span>`;
  return `<span class="avatar ${cls}" style="--c:${esc(u.warna_profil || '#CFF2D6')}" title="${esc(u.nama)}">${esc(u.avatar || (u.nama || '?').charAt(0).toUpperCase())}</span>`;
}
function ownerAvatars(g) {
  return g.jenis === 'Bersama' ? `<span class="avatars">${S.users.map(u => avatarHtml(u, 'sm')).join('')}</span>` : avatarHtml(userById(g.pemilik_id), 'sm');
}
function valueText(g) { return g.tipe_target === 'Checklist' ? `${fmtN(g.nilai_saat_ini)}/${fmtN(g.nilai_target)} tugas` : fmtShort(g.nilai_saat_ini, g.satuan); }
function targetText(g) { return g.tipe_target === 'Checklist' ? '' : fmtShort(g.nilai_target, g.satuan); }
function projection(g) {
  const since = addDays(today(), -30);
  let sum;
  if (g.tipe_target === 'Checklist') sum = S.milestones.filter(m => m.goal_id === g.goal_id && m.status === 'Selesai' && (m.tgl_selesai || '') >= since).length;
  else sum = S.logs.filter(l => l.goal_id === g.goal_id && l.tanggal >= since).reduce((s, l) => s + (Number(l.nilai_tambah) || 0), 0);
  const remain = Math.max(0, g.nilai_target - g.nilai_saat_ini);
  if (remain <= 0) return { done: true, rate: sum / 30 };
  const rate = sum / 30;
  if (rate <= 0) return { rate: 0, eta: null };
  return { rate, eta: addDays(today(), Math.ceil(remain / rate)) };
}
function monthlyNeed(g) {
  const remain = Math.max(0, g.nilai_target - g.nilai_saat_ini);
  const days = Math.max(1, dayDiff(today(), g.tenggat));
  return remain / Math.max(1, days / 30.44);
}
function sortGoals(list, by) {
  const s = list.slice();
  if (by === 'progres') s.sort((a, b) => goalPct(b) - goalPct(a));
  else if (by === 'terbaru') s.sort((a, b) => String(b.dibuat_pada).localeCompare(String(a.dibuat_pada)));
  else if (by === 'prioritas') s.sort((a, b) => (PRIO_RANK[a.prioritas] - PRIO_RANK[b.prioritas]) || a.tenggat.localeCompare(b.tenggat));
  else s.sort((a, b) => a.tenggat.localeCompare(b.tenggat));
  return s;
}
function emptyHtml(icon, text, extra = '') { return `<div class="empty"><i class="bi ${icon}"></i><p class="mb-1">${text}</p>${extra}</div>`; }
/** Perayaan yang masih berlaku: goal masih ada & tidak dibatalkan (arsip sebelum 100%),
 *  ambang % masih tercapai, dan milestone-nya masih tercentang. Yang tidak berlaku disembunyikan. */
function achValid(a) {
  const g = goalById(a.goal_id);
  if (!g) return false;
  const pct = goalPct(g);
  if (g.status === 'Arsip' && pct < 100) return false;
  const t = /^(\d+)%$/.exec(a.jenis);
  if (t) return pct + 1e-9 >= Number(t[1]);
  if (a.jenis === 'Milestone') {
    const m = /^Milestone "([\s\S]*)" pada "/.exec(String(a.pesan));
    if (!m) return true;
    const ms = msOf(g.goal_id).find(x => x.judul === m[1]);
    return !!ms && ms.status === 'Selesai';
  }
  return true;
}
const liveAch = () => S.achievements.filter(achValid);
function hasAch(goalId, jenis, pesan) { return liveAch().some(a => a.goal_id === goalId && a.jenis === jenis && (!pesan || a.pesan === pesan)); }

/** Cermin logika server: sinkron status milestone & goal. */
function syncStatusLocal(g) {
  const ms = msOf(g.goal_id);
  const newly = [];
  if (g.tipe_target === 'Checklist') {
    g.nilai_target = ms.length;
    g.nilai_saat_ini = ms.filter(m => m.status === 'Selesai').length;
  } else {
    ms.forEach(m => {
      if (!(m.nilai_target > 0)) return;
      if (g.nilai_saat_ini >= m.nilai_target && m.status !== 'Selesai') { m.status = 'Selesai'; m.tgl_selesai = today(); newly.push(m); }
      else if (g.nilai_saat_ini < m.nilai_target && m.status === 'Selesai') { m.status = 'Belum'; m.tgl_selesai = ''; }
    });
  }
  if (g.status !== 'Arsip') g.status = goalPct(g) >= 100 ? 'Selesai' : 'Aktif';
  return newly;
}
/** Buat pencapaian lokal (sementara) & kembalikan yang perlu dirayakan. */
function localCelebrate(g, before, newly) {
  const after = goalPct(g);
  const out = [];
  [25, 50, 75, 100].forEach(t => {
    if (before < t && after >= t && !hasAch(g.goal_id, t + '%')) {
      const a = { ach_id: 'tmp-' + uid(), goal_id: g.goal_id, user_id: S.me.user_id, jenis: t + '%', pesan: t === 100 ? `Goal "${g.judul}" tercapai 100%! 🏆` : `Goal "${g.judul}" sudah ${t}% 🎉`, tanggal: nowIso() };
      S.achievements.push(a);
      out.push(a);
    }
  });
  newly.forEach(m => {
    const pesan = `Milestone "${m.judul}" pada "${g.judul}" selesai ✅`;
    if (!hasAch(g.goal_id, 'Milestone', pesan)) {
      const a = { ach_id: 'tmp-' + uid(), goal_id: g.goal_id, user_id: S.me.user_id, jenis: 'Milestone', pesan, tanggal: nowIso() };
      S.achievements.push(a);
      out.push(a);
    }
  });
  return out;
}
function celebrateList(list, g) {
  if (!list.length) return false;
  const top = list.find(a => a.jenis === '100%') || list.filter(a => /%$/.test(a.jenis)).pop() || list[0];
  const map = { '100%': ['🏆', 'Goal tercapai!'], '75%': ['🚀', '75% tercapai!'], '50%': ['🎯', 'Setengah jalan!'], '25%': ['🎉', '25% tercapai!'], Milestone: ['✅', 'Milestone selesai!'] };
  const [emoji, title] = map[top.jenis] || ['🎉', 'Hore!'];
  let text = top.pesan;
  if (top.jenis === '100%' && g && needsExecDate(g)) text += ' Dana terkumpul — saatnya menetapkan tanggal pelaksanaan 🗓️';
  showCelebration({ emoji, title, text });
  return true;
}

// ============================================================
// KOMPONEN KARTU
// ============================================================
function goalCard(g, o = {}) {
  const st = goalState(g);
  const [lbl, cls] = STATE_LABEL[st];
  const cat = catById(g.kategori_id);
  const color = goalColor(g);
  const pct = goalPct(g);
  const priv = g.jenis === 'Pribadi' && g.visibilitas === 'Privat';
  const corner = priv
    ? `<span class="gc-corner lock" title="Privat"><i class="bi bi-lock"></i></span>`
    : `<span class="gc-corner" style="--c:${esc(color)}"><i class="bi ${esc(goalIcon(g))}"></i></span>`;
  const owner = g.jenis === 'Bersama' ? 'Bersama' : esc(userById(g.pemilik_id).nama);
  const logBtn = canLog(g)
    ? `<button class="icon-btn sm" data-action="${g.tipe_target === 'Checklist' ? 'openGoal' : 'logProgress'}" data-id="${g.goal_id}" aria-label="Catat progres ${esc(g.judul)}"><i class="bi bi-plus-lg"></i></button>` : '';
  return `<article class="gcard tint${o.featured ? ' featured' : ''}" style="--c:${esc(color)}" data-action="openGoal" data-id="${g.goal_id}" tabindex="0" role="button" aria-label="Buka ${esc(g.judul)}">
    ${corner}
    ${o.featured ? '<span class="fx-note" aria-hidden="true">✨</span>' : ''}
    <span class="gc-cat"><i class="bi ${esc(cat.ikon)}"></i>${esc(cat.nama)} · ${owner}</span>
    <h3>${esc(g.judul)}</h3>
    ${g.deskripsi ? `<p class="clamp2">${esc(g.deskripsi)}</p>` : ''}
    <div class="pbar" role="progressbar" aria-valuenow="${Math.floor(pct)}" aria-valuemin="0" aria-valuemax="100"><span style="width:${pct}%"></span></div>
    <div class="gc-meta"><span><b>${valueText(g)}</b>${targetText(g) ? ' / ' + targetText(g) : ''}</span><span>${pctInt(g)}%</span></div>
    ${cardChecklist(g)}
    <div class="gc-foot">
      <span class="badge-s ${cls}">${lbl}</span>
      <div class="gc-actions">${o.featured ? ownerAvatars(g) : ''}${logBtn}<button class="icon-btn sm dark" data-action="openGoal" data-id="${g.goal_id}" aria-label="Buka detail"><i class="bi bi-arrow-up-right"></i></button></div>
    </div>
  </article>`;
}
/** Daftar tugas langsung di kartu goal Checklist — bisa dicentang tanpa membuka detail */
function cardChecklist(g, max = 6) {
  const ms = msOf(g.goal_id);
  if (!ms.length) return '';
  const checklist = g.tipe_target === 'Checklist';
  const can = checklist && canEdit(g) && g.status !== 'Arsip';   // tahapan goal angka/finansial tercentang otomatis
  const shown = ms.slice(0, max);
  return `<ul class="gc-tasks" aria-label="Daftar tugas ${esc(g.judul)}">${shown.map(m => {
    const done = m.status === 'Selesai';
    return `<li><button type="button" class="gc-task ${done ? 'done' : ''}" ${can ? `data-action="toggleMs" data-id="${m.milestone_id}"` : 'disabled'} aria-pressed="${done}" aria-label="${done ? 'Batalkan centang' : 'Centang'} ${esc(m.judul)}">
      <span class="ms-check"><i class="bi bi-check-lg"></i></span><span class="t">${esc(m.judul)}</span>${!checklist && m.nilai_target ? `<span class="v">${fmtShort(m.nilai_target, g.satuan)}</span>` : ''}</button></li>`;
  }).join('')}${ms.length > max ? `<li class="tiny muted ps-1">+${ms.length - max} tugas lagi — buka detail</li>` : ''}</ul>`;
}
function rowItem(g) {
  const [lbl, cls] = STATE_LABEL[goalState(g)];
  return `<button class="row-item" data-action="openGoal" data-id="${g.goal_id}">
    <span class="ic tint" style="--c:${esc(goalColor(g))}"><i class="bi ${esc(goalIcon(g))}"></i></span>
    <span><b>${esc(g.judul)}</b><span class="sub"><span class="badge-s ${cls}" style="padding:2px 8px">${lbl}</span>${valueText(g)} · ${fmtDay(g.tenggat)}</span>
      <span class="pbar sm mt-2"><span style="width:${goalPct(g)}%"></span></span></span>
    <span class="pct">${pctInt(g)}%</span>
  </button>`;
}
function miniList(list, theirs) {
  if (!list.length) return `<p class="muted tiny mb-0">${theirs ? 'Belum ada goal pribadi pasangan yang dibagikan.' : 'Belum ada goal pribadi. <button class="link-btn" data-action="newGoal" data-jenis="Pribadi">Buat sekarang</button>'}</p>`;
  return sortGoals(list, 'tenggat').slice(0, 5).map(g => `
    <button class="mini" data-action="openGoal" data-id="${g.goal_id}">
      <span class="ic tint" style="--c:${esc(goalColor(g))}"><i class="bi ${esc(goalIcon(g))}"></i></span>
      <span><b>${esc(g.judul)}</b><span class="pbar sm"><span style="width:${goalPct(g)}%"></span></span></span>
      <span class="pct">${pctInt(g)}%</span>
    </button>`).join('');
}

window.__GT_PARTS = (window.__GT_PARTS || []).concat('JS1');

/** Render ulang tanpa mengembalikan baris geser (tab/chip/kartu) ke awal; pilihan aktif tetap terlihat. */
function keepRows(root, fn) {
  const sel = '.chips, .tabs, .hscroll, .stats, .jenis-scroll';
  const r0 = document.querySelector(root);
  const pos = r0 ? [...r0.querySelectorAll(sel)].map(e => e.scrollLeft) : [];
  const y = window.scrollY;
  fn();
  window.scrollTo(0, y);
  const r1 = document.querySelector(root); if (!r1) return;
  [...r1.querySelectorAll(sel)].forEach((e, i) => {
    if (pos[i] !== undefined) e.scrollLeft = pos[i];
    const on = e.querySelector('.on, [aria-selected="true"]');
    if (on) { const a = on.getBoundingClientRect(), b = e.getBoundingClientRect();
      if (a.left < b.left || a.right > b.right) e.scrollBy({ left: (a.left + a.width / 2) - (b.left + b.width / 2), behavior: 'smooth' }); }   // geser horizontal saja, halaman tidak ikut bergulir
  });
}
