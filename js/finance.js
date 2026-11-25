/* GOAL TRACKERS — js/finance.js (5/5): Keuangan — template rencana, tanggal pelaksanaan, investasi (SBN/SR), pinjaman, start aplikasi */

const ASSET_TYPES = ['SBN', 'SR', 'ORI', 'ST', 'SBR', 'Deposito', 'Obligasi', 'USD', 'Lainnya'];
const ASSET_LABEL = { USD: 'USD — Tabungan Dolar' };
/* ── Tabungan dolar: nominal disimpan dalam USD, dinilai ke Rupiah dengan kurs (Settings.kurs_USD) ── */
const isUsd = a => a && a.jenis === 'USD';
/** Waktu kurs dari server (tanggal + "jam HH.mm"), dalam ms */
const kursSrvAt = () => { const s = S.settings || {}; if (!s.kurs_USD_tgl) return 0;
  const m = /(\d{1,2})[.:](\d{2})/.exec(String(s.kurs_USD_jam || '')); return new Date(`${s.kurs_USD_tgl}T${m ? m[1].padStart(2, '0') + ':' + m[2] : '07:00'}:00+08:00`).getTime() || 0; };
/** Kurs yang dipakai: manual → selalu itu; otomatis → yang paling baru antara server & browser */
const kursUsd = () => { const s = S.settings || {}, srv = Number(s.kurs_USD) || 0;
  if (s.kurs_USD_src === 'manual') return srv || 16000;
  const live = S.ui && S.ui.kursLive;
  if (live && (!srv || (S.ui.kursAt || 0) > kursSrvAt())) return live;
  return srv || live || 16000; };
const kursPakaiLive = () => { const s = S.settings || {}; return s.kurs_USD_src !== 'manual' && !!(S.ui && S.ui.kursLive) && (!Number(s.kurs_USD) || (S.ui.kursAt || 0) > kursSrvAt()); };
/** Kurs terkini langsung dari browser (Coinbase), disegarkan tiap 15 menit; nilai rupiah tabungan dolar ikut berubah */
function ensureKurs(force) {
  const s = S.settings || {};
  if (s.kurs_USD_src === 'manual' || ensureKurs.busy) return;
  const c = lsGet('gt_kurs', null), fresh = c && c.t && Date.now() - c.t < 15 * 60000;
  if (c && c.t && (!S.ui.kursAt || c.t > S.ui.kursAt)) { S.ui.kursLive = c.v; S.ui.kursAt = c.t; }
  if (fresh && !force) return;
  ensureKurs.busy = true;
  fetch('https://api.coinbase.com/v2/exchange-rates?currency=USD', { cache: 'no-store' }).then(r => r.json()).then(j => {
    const v = Math.round(Number(j && j.data && j.data.rates && j.data.rates.IDR));
    if (v > 1000 && v < 100000) {
      const before = kursUsd();
      S.ui.kursLive = v; S.ui.kursAt = Date.now(); lsSet('gt_kurs', { t: S.ui.kursAt, v });
      if (kursUsd() !== before && S.ui.page === 'finance') keepScroll(renderFinance); else if (kursUsd() !== before) renderAll();
    }
  }).catch(() => { }).finally(() => { ensureKurs.busy = false; });
}
setInterval(() => { if (document.visibilityState === 'visible' && S.token && ((S.rekening || []).some(g => isUsdRek(g)) || (S.assets || []).some(a => isUsd(a)))) ensureKurs(true); }, 15 * 60000);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && S.token) ensureKurs(); });
const nomRp = a => Number(a.nominal) * (isUsd(a) ? kursUsd() : 1);
const fmtUsd = n => 'US$ ' + Number(n || 0).toLocaleString('id-ID', { maximumFractionDigits: 2 });
const parseUsd = v => { v = String(v || '').replace(/[^\d.,]/g, ''); if (v.includes(',')) v = v.replace(/\./g, '').replace(',', '.'); else if (/^\d{1,3}(\.\d{3})+$/.test(v)) v = v.replace(/\./g, ''); return Number(v) || 0; };
const nomText = (a, short) => isUsd(a) ? `${fmtUsd(a.nominal)} <span class="muted tiny">≈ ${fmtShort(nomRp(a), 'Rp')}</span>` : (short ? fmtShort(a.nominal, 'Rp') : fmtVal(a.nominal, 'Rp'));
function kursInfoHtml() {
  const s = S.settings || {}, man = s.kurs_USD_src === 'manual';
  ensureKurs();
  const lv = kursPakaiLive(), at = lv ? new Date(S.ui.kursAt) : null;
  const tgl = lv ? today() : s.kurs_USD_tgl;
  const jam = lv ? ', ' + String(at.getHours()).padStart(2, '0') + '.' + String(at.getMinutes()).padStart(2, '0') : (!man && s.kurs_USD_jam ? ', ' + String(s.kurs_USD_jam).replace(/^jam\s*/, '') : '');
  return `<span class="kurs-pill"><i class="bi bi-currency-dollar"></i> Kurs ${fmtVal(kursUsd(), 'Rp')}/USD <small class="muted">${(s.kurs_USD || S.ui.kursLive) ? (man ? 'manual' : 'otomatis') + (tgl ? ' · ' + fmtDate(tgl) + jam : '') : 'perkiraan'}</small>
    <button type="button" class="link-btn" data-action="kursRefresh" title="Ambil kurs terbaru"><i class="bi bi-arrow-clockwise"></i> Perbarui</button>
    <button type="button" class="link-btn" data-action="kursEdit">Ubah</button></span>`;
}
const LOAN_METODE = ['Tanpa bunga', 'Flat', 'Anuitas'];
const JENJANG = ['TK', 'SD', 'SMP', 'SMA', 'Kuliah'];
const TPL_BASE = {
  liburan: { label: 'Rencana Liburan', emoji: '🏖️', cat: 'cat-liburan', judul: 'Rencana Liburan', hint: 'Target = total dana yang dibutuhkan. Tanggal pelaksanaan ditetapkan setelah dana terkumpul.' },
  darurat: { label: 'Dana Darurat', emoji: '🛟', cat: 'cat-darurat', judul: 'Dana Darurat Keluarga', hint: 'Idealnya 6–12 × pengeluaran bulanan rumah tangga.' },
  sekolah: { label: 'Tabungan Sekolah Anak', emoji: '🎓', cat: 'cat-pendidikan', judul: 'Dana Sekolah Anak', hint: 'Target sudah memperhitungkan kenaikan biaya pendidikan per tahun.' }
};
/** Template aktif = daftar dari Pengaturan (Settings.goal_templates) atau bawaan bila belum diatur.
 *  Template bawaan (liburan/darurat/sekolah) tetap punya kalkulator khusus; template baru memakai id "tp-…". */
let _tplRaw = {}, _tplObj = null;
function tplAll() {
  const raw = S.settings ? S.settings.goal_templates : undefined;
  if (raw === _tplRaw && _tplObj) return _tplObj;
  _tplRaw = raw;
  let arr = null;
  try { arr = raw ? JSON.parse(raw) : null; } catch (e) { arr = null; }
  if (!Array.isArray(arr)) arr = Object.keys(TPL_BASE).map(k => ({ id: k, base: k }));
  const o = {};
  arr.forEach(t => {
    if (!t || !t.id) return;
    const b = t.base && TPL_BASE[t.base];
    o[t.id] = b ? Object.assign({}, b, { tipe: 'Finansial', jenis: 'Bersama' }, clean_(t), { base: t.base })
      : Object.assign({ tipe: 'Finansial', jenis: 'Bersama', target: 0, satuan: '', tugas: [] }, t);
  });
  _tplObj = o;
  return o;
}
const clean_ = t => { const o = {}; ['label', 'judul', 'cat', 'hint', 'ikon', 'warna'].forEach(k => { if (t[k]) o[k] = t[k]; }); return o; };
const tplListRaw = () => Object.keys(tplAll()).map(k => { const t = tplAll()[k];
  return t.base ? { id: k, base: t.base, label: t.label, judul: t.judul, cat: t.cat, hint: t.hint, ikon: t.ikon || '', warna: t.warna || '' }
    : { id: k, label: t.label, judul: t.judul, cat: t.cat, hint: t.hint, ikon: t.ikon || '', warna: t.warna || '', tipe: t.tipe, jenis: t.jenis, target: t.target, satuan: t.satuan, tugas: t.tugas || [] }; });
const TPL = new Proxy({}, {
  get: (_, k) => tplAll()[k],
  has: (_, k) => k in tplAll(),
  ownKeys: () => Reflect.ownKeys(tplAll()),
  getOwnPropertyDescriptor: (_, k) => { const o = tplAll(); return k in o ? { value: o[k], enumerable: true, configurable: true, writable: true } : undefined; }
});

// ── Tanggal: tambah k bulan, tanggal disesuaikan ke hari tertentu ──
function addMonthsDay(iso, k, day) {
  const y = Number(iso.slice(0, 4)), m = Number(iso.slice(5, 7)) - 1 + k, d0 = Number(iso.slice(8, 10));
  const t = new Date(y, m, 1);
  const dim = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate();
  return t.getFullYear() + '-' + pad(t.getMonth() + 1) + '-' + pad(Math.min(Number(day) || d0, dim));
}
const parseMeta = s => { try { return s ? JSON.parse(s) : {}; } catch (e) { return {}; } };
const ownerName = id => id ? userById(id).nama : 'Bersama';

// ── Perhitungan investasi ──
function assetInfo(a) {
  const n = Math.max(1, Number(a.tenor_bulan) || 1), t = today();
  const netAsli = Number(a.nominal) * Number(a.kupon_persen) / 100 / 12 * (1 - Number(a.pajak_persen || 0) / 100);
  const net = Math.round(isUsd(a) ? netAsli * kursUsd() : netAsli);
  let k = 0;
  for (let i = 1; i <= n; i++) { if (addMonthsDay(a.tgl_mulai, i, a.tgl_kupon) <= t) k = i; else break; }
  const maturity = addMonthsDay(a.tgl_mulai, n, a.tgl_kupon);
  const next = k < n ? addMonthsDay(a.tgl_mulai, k + 1, a.tgl_kupon) : null;
  const posted = S.assetIncome.filter(x => x.aset_id === a.aset_id).reduce((s, x) => s + Number(x.jumlah), 0);
  return { n, k, left: n - k, net, maturity, next, posted, received: k * net, pct: k / n * 100, done: k >= n || a.status !== 'Aktif' };
}
// ── Perhitungan pinjaman ──
function loanCalc(pokok, bunga, n, metode) {
  const P = Number(pokok) || 0, r = (Number(bunga) || 0) / 100 / 12;
  n = Math.max(1, Number(n) || 1);
  if (metode === 'Anuitas' && r > 0) return Math.round(P * r / (1 - Math.pow(1 + r, -n)));
  if (metode === 'Flat') return Math.round(P / n + P * (Number(bunga) || 0) / 100 / 12);
  return Math.round(P / n);
}
function loanInfo(l) {
  const n = Math.max(1, Number(l.tenor_bulan) || 1), t = today();
  const c = Number(l.cicilan) || loanCalc(l.pokok, l.bunga_persen, n, l.metode);
  let k = 0;
  for (let i = 0; i < n; i++) { if (addMonthsDay(l.tgl_mulai, i, l.tgl_potong) <= t) k = i + 1; else break; }
  if (l.status === 'Lunas') k = n;
  const P = Number(l.pokok), r = (Number(l.bunga_persen) || 0) / 100 / 12;
  let sisaPokok = l.metode === 'Anuitas' && r > 0 ? P * Math.pow(1 + r, k) - c * (Math.pow(1 + r, k) - 1) / r : P - P / n * k;
  sisaPokok = Math.max(0, Math.round(sisaPokok));
  return {
    n, k, left: n - k, c, sisaPokok, sisaBayar: (n - k) * c, pct: k / n * 100, done: k >= n,
    lunas: addMonthsDay(l.tgl_mulai, n - 1, l.tgl_potong), next: k < n ? addMonthsDay(l.tgl_mulai, k, l.tgl_potong) : null
  };
}

// ============================================================
// TEMPLATE RENCANA (form goal)
// ============================================================
function needsExecDate(g) {
  return g.tipe_target === 'Finansial' && g.template !== 'darurat' && g.template !== 'sekolah' && !isRek(g);
}
function tplChipsHtml(cur) {
  return `<div class="field"><span>Mulai dari template <small>(opsional)</small></span><div class="chips chips-wrap">
    ${Object.keys(TPL).map(k => `<button type="button" class="chip-btn cat-chip ${cur === k ? 'on' : ''}" data-action="tplPick" data-tpl="${k}">${tplIc(k)}${TPL[k].label}</button>`).join('')}
    <button type="button" class="chip-btn cat-chip ${!cur ? 'on' : ''}" data-action="tplPick" data-tpl=""><span class="cat-ic" style="--c:#ECECEA"><i class="bi bi-pencil"></i></span>Kustom</button></div></div>`;
}
/** Ikon bulat berwarna (gaya Pinterest) untuk template, mengikuti kategori */
function tplIc(k, cls = 'cat-ic') {
  const t = TPL[k] || {}, c = (S.categories || []).find(x => x.kategori_id === t.cat) || {};
  const ic = t.ikon || c.ikon || { liburan: 'bi-airplane', darurat: 'bi-shield-check', sekolah: 'bi-mortarboard' }[k] || 'bi-bookmark-star';
  return `<span class="${cls}" style="--c:${esc(t.warna || c.warna || '#D5F0F7')}"><i class="bi ${esc(ic)}"></i></span>`;
}
function tplBoxHtml(tpl, m) {
  if (!TPL[tpl]) return '';
  const box = inner => `<div class="card mb-3" style="box-shadow:none;background:var(--soft)"><p class="tiny ${inner ? 'mb-2' : 'mb-0'}"><i class="bi bi-lightbulb"></i> ${esc(TPL[tpl].hint || '')}</p>${inner}</div>`;
  if (tpl === 'liburan') {
    return box(`<label class="field mb-0"><span>Tujuan / destinasi</span><input name="tpl_tujuan" maxlength="60" value="${esc(m.tujuan || '')}" placeholder="mis. Batu, Malang"></label>`);
  }
  if (tpl === 'darurat') {
    return box(`<div class="grid-2">
      <label class="field"><span>Pengeluaran per bulan (Rp)</span><input name="tpl_pengeluaran" inputmode="numeric" data-money data-input="tplCalc" value="${m.pengeluaran ? fmtN(m.pengeluaran) : ''}" placeholder="8.000.000"></label>
      <label class="field"><span>Berapa bulan?</span><select name="tpl_bulan" data-change="tplCalc">${[3, 6, 9, 12].map(b => `<option value="${b}" ${Number(m.bulan || 6) === b ? 'selected' : ''}>${b} bulan</option>`).join('')}</select></label>
    </div><p class="tiny mb-0 fw-bold" id="tplResult"></p>`);
  }
  if (tpl !== 'sekolah') return TPL[tpl].hint ? box('') : '';
  const y = new Date().getFullYear();
  return box(`<div class="grid-2">
      <label class="field"><span>Nama anak</span><input name="tpl_anak" maxlength="40" value="${esc(m.anak || '')}" placeholder="mis. Aisyah"></label>
      <label class="field"><span>Jenjang</span><select name="tpl_jenjang">${JENJANG.map(j => `<option ${m.jenjang === j ? 'selected' : ''}>${j}</option>`).join('')}</select></label>
      <label class="field"><span>Tahun masuk</span><input name="tpl_tahun" type="number" min="${y}" max="${y + 25}" data-input="tplCalc" value="${esc(m.tahun || y + 3)}"></label>
      <label class="field"><span>Kenaikan biaya/thn (%)</span><input name="tpl_inflasi" inputmode="decimal" data-input="tplCalc" value="${esc(m.inflasi === undefined ? 10 : m.inflasi)}"></label>
    </div>
    <label class="field"><span>Biaya masuk saat ini (Rp)</span><input name="tpl_biaya" inputmode="numeric" data-money data-input="tplCalc" value="${m.biaya ? fmtN(m.biaya) : ''}" placeholder="25.000.000"></label>
    <p class="tiny mb-0 fw-bold" id="tplResult"></p>`);
}
function tplPick(tpl) {
  const f = $('#sheet form[data-form=goal]');
  if (!f) return;
  f.template.value = tpl;
  $$('[data-action=tplPick]', f).forEach(b => b.classList.toggle('on', b.dataset.tpl === tpl));
  $('#tplBox').innerHTML = tplBoxHtml(tpl, {});
  const T = TPL[tpl];
  if (!T) return;
  const tr = f.querySelector(`input[name=tipe_target][value=${T.tipe || 'Finansial'}]`);
  if (tr) { tr.checked = true; goalFormTipeChanged(f); }
  const jb = f.querySelector(`input[name=jenis][value=${T.jenis === 'Pribadi' ? 'Pribadi' : 'Bersama'}]`);
  if (jb && !jb.disabled) { jb.checked = true; $('#visField').hidden = jb.value === 'Bersama'; }
  if ([...f.kategori_id.options].some(o => o.value === T.cat)) f.kategori_id.value = T.cat;
  if (T.judul && (!f.judul.value || Object.keys(TPL).some(k => TPL[k].judul === f.judul.value))) f.judul.value = T.judul;
  if (!T.base) {
    if (T.target && T.tipe !== 'Checklist') f.nilai_target.value = fmtN(T.target);
    if (T.satuan && f.satuan && T.tipe !== 'Finansial' && T.tipe !== 'Checklist') f.satuan.value = T.satuan;
    if (T.tugas && T.tugas.length) $('#msList').innerHTML = T.tugas.map(m => msRow({ judul: m.judul, nilai_target: m.nilai || '' }, T.tipe !== 'Checklist')).join('');
  }
  recalcTpl(f);
}
function recalcTpl(f) {
  const t = f.template.value, r = $('#tplResult');
  if (!r) return;
  if (t === 'darurat') {
    const p = parseNum(f.tpl_pengeluaran.value, true), b = Number(f.tpl_bulan.value) || 6;
    if (p > 0) { f.nilai_target.value = fmtN(p * b); r.textContent = `Target = ${b} × ${fmtVal(p, 'Rp')} = ${fmtVal(p * b, 'Rp')}`; }
    else r.textContent = 'Isi pengeluaran bulanan untuk menghitung target.';
  }
  if (t === 'sekolah') {
    const now = new Date().getFullYear();
    const thn = parseInt(f.tpl_tahun.value, 10) || now;
    const biaya = parseNum(f.tpl_biaya.value, true), inf = parseNum(f.tpl_inflasi.value) || 0;
    const yrs = Math.max(0, thn - now);
    if (thn >= now) f.tenggat.value = thn + '-07-01';
    if (biaya > 0) {
      const target = Math.ceil(biaya * Math.pow(1 + inf / 100, yrs) / 100000) * 100000;
      f.nilai_target.value = fmtN(target);
      r.textContent = `Kebutuhan tahun ${thn}: ${fmtVal(target, 'Rp')} (${yrs} tahun lagi, naik ${inf}%/thn)`;
    } else r.textContent = 'Isi biaya masuk saat ini untuk menghitung target.';
  }
}
function tplMetaFromForm(f) {
  const raw = tplMetaFromForm0_(f), ex = goalById(f.goal_id && f.goal_id.value);
  if (ex && isRek(ex)) return raw;
  let m = {}; try { m = JSON.parse(raw || '{}') || {}; } catch (e) { m = {}; }
  const r = f.rek_tujuan && f.tipe_target && f.tipe_target.value === 'Finansial' ? f.rek_tujuan.value : '';
  if (r) m.rek = r; else delete m.rek;
  if (ex) { const old = parseMeta(ex.meta); if (old.itin) m.itin = old.itin; }   // itinerary tidak hilang saat goal diedit
  return Object.keys(m).length ? JSON.stringify(m) : '';
}
/** Rekening tujuan setoran sebuah target tabungan (meta.rek), bila masih ada */
const rekTujuan = g => { const id = parseMeta(g && g.meta).rek; const r = id && (S.rekening || []).find(x => x.goal_id === id && x.status !== 'Arsip'); return r && !isUsdRek(r) ? r : null; };
function rekFieldHtml(d) {
  const list = (typeof rekList === 'function' ? rekList() : []).filter(r => !isUsdRek(r));
  if (!list.length || (d.goal_id && isRek(d))) return '';
  const cur = parseMeta(d.meta).rek || '';
  return `<label class="field" id="rekField" ${d.tipe_target === 'Finansial' ? '' : 'hidden'}><span>Setoran masuk ke rekening <small>(opsional)</small></span>
    <select name="rek_tujuan"><option value="">— tidak dihubungkan —</option>${list.map(r => `<option value="${r.goal_id}" ${r.goal_id === cur ? 'selected' : ''}>${esc(r.judul)} · ${esc(rekJenis(r))}</option>`).join('')}</select>
    <small class="muted">Setiap setor/tarik di target ini otomatis menambah/mengurangi saldo rekening tersebut.</small></label>`;
}
/** Catatan rekening yang berasal dari setoran target g (dikenali dari keterangannya) */
const mirrorLogs_ = (g, r) => { const j = String(g.judul || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return S.logs.filter(l => l.goal_id === r.goal_id && new RegExp('^(Setoran|Penarikan|Pembatalan) ' + j + '( · |$)').test(String(l.catatan || ''))); };
const mirrorNet_ = (g, r) => mirrorLogs_(g, r).reduce((s, l) => s + Number(l.nilai_tambah || 0), 0);
/** Target dihapus / dibatalkan → setoran yang ikut masuk ke rekening ditarik kembali (dicatat sebagai Pembatalan) */
function batalkanMirror_(g) {
  const r = g && !isRek(g) && rekTujuan(g); if (!r) return;
  const net = mirrorNet_(g, r); if (!net) return;
  const log = { log_id: uid(), goal_id: r.goal_id, tanggal: today(), user_id: S.me.user_id, nilai_tambah: -net,
    catatan: `Pembatalan ${g.judul}`.slice(0, 300), foto_url: '', dibuat_pada: nowIso() };
  S.logs.push(log);
  r.nilai_saat_ini = Math.max(0, Number(r.nilai_saat_ini) - net); r.diubah_pada = nowIso();
  Outbox.push('addProgress', [{ log_id: log.log_id, goal_id: r.goal_id, nilai_tambah: -net, catatan: log.catatan, tanggal: log.tanggal }, null]);
  setTimeout(() => toast(`Saldo ${r.judul} ${net > 0 ? 'dikurangi' : 'ditambah'} ${fmtVal(Math.abs(net), 'Rp')}`), 900);
}
/** Target dipulihkan dari arsip → saldonya masuk lagi ke rekening */
function pulihkanMirror_(g) {
  const r = g && !isRek(g) && rekTujuan(g); if (!r || mirrorNet_(g, r)) return;
  const n = Number(g.nilai_saat_ini) || 0; if (n > 0) mirrorKeRekening_(g, n, today(), 'dipulihkan');
}
/** Pasangan sebuah catatan: setoran target ↔ catatan rekening yang dibuat bersamanya */
function logPair_(l) {
  if (!l) return null;
  const id = String(l.log_id);
  if (id.startsWith('rk-')) return S.logs.find(x => x.log_id === id.slice(3)) || null;
  const m = S.logs.find(x => x.log_id === 'rk-' + id); if (m) return m;
  // Catatan lama (sebelum dipasangkan): cocokkan dari keterangan, jumlah & tanggal
  const g = goalById(l.goal_id); if (!g) return null;
  const same = x => x.log_id !== l.log_id && x.user_id === l.user_id && Number(x.nilai_tambah) === Number(l.nilai_tambah) && x.tanggal === l.tanggal;
  if (isRek(g)) {
    const mt = /^(Setoran|Penarikan) (.+?)(?: · .*)?$/.exec(String(l.catatan || '')); if (!mt) return null;
    const src = S.goals.find(x => !isRek(x) && x.judul === mt[2] && parseMeta(x.meta).rek === g.goal_id);
    return src ? S.logs.find(x => x.goal_id === src.goal_id && same(x)) || null : null;
  }
  const r = rekTujuan(g); if (!r) return null;
  return mirrorLogs_(g, r).find(x => same(x) && !/^Pembatalan /.test(x.catatan || '')) || null;
}
/** Hapus satu catatan progres (beserta pasangannya di rekening / target) — saldo keduanya ikut turun */
function hapusLogBerpasangan_(id) {
  const l = S.logs.find(x => x.log_id === id); if (!l) return null;
  const p = logPair_(l), ls = [l].concat(p && p.user_id === S.me.user_id ? [p] : []);
  ls.forEach(x => {
    S.logs = S.logs.filter(y => y.log_id !== x.log_id);
    const g = goalById(x.goal_id);
    if (g) { g.nilai_saat_ini = Math.max(0, Number(g.nilai_saat_ini) - Number(x.nilai_tambah)); g.diubah_pada = nowIso(); if (!isRek(g)) syncStatusLocal(g); }
    Outbox.push('deleteProgress', [x.log_id]);
  });
  saveSnapshot(); renderAll();
  const o = ls[1] && goalById(ls[1].goal_id);
  toast(o ? `Catatan dihapus — saldo ${o.judul} ikut disesuaikan` : 'Catatan dihapus');
  return l;
}
/** Setor/tarik di target tabungan → ikut dicatat di rekening tujuannya */
function mirrorKeRekening_(g, n, tanggal, catatan, srcId) {
  if (!g || isRek(g)) return;
  const r = rekTujuan(g); if (!r) return;
  const log = { log_id: srcId ? 'rk-' + srcId : uid(), goal_id: r.goal_id, tanggal: tanggal || today(), user_id: S.me.user_id, nilai_tambah: n,
    catatan: `${n > 0 ? 'Setoran' : 'Penarikan'} ${g.judul}${catatan ? ' · ' + catatan : ''}`.slice(0, 300), foto_url: '', dibuat_pada: nowIso() };
  S.logs.push(log);
  r.nilai_saat_ini = Math.max(0, Number(r.nilai_saat_ini) + n); r.diubah_pada = nowIso();
  saveSnapshot(); renderAll();
  Outbox.push('addProgress', [{ log_id: log.log_id, goal_id: r.goal_id, nilai_tambah: n, catatan: log.catatan, tanggal: log.tanggal }, null]);
  toast(`${n > 0 ? '+' : ''}${fmtVal(n, 'Rp')} juga masuk ke ${r.judul}`);
}
function tplMetaFromForm0_(f) {
  const ex = goalById(f.goal_id && f.goal_id.value);
  if (ex && isRek(ex)) return ex.meta;            // Tabungan Utama: pertahankan penanda
  const t = f.template.value;
  if (t === 'liburan') return JSON.stringify({ tujuan: f.tpl_tujuan.value.trim() });
  if (t === 'darurat') return JSON.stringify({ pengeluaran: parseNum(f.tpl_pengeluaran.value, true), bulan: Number(f.tpl_bulan.value) || 6 });
  if (t === 'sekolah') return JSON.stringify({ anak: f.tpl_anak.value.trim(), jenjang: f.tpl_jenjang.value, tahun: parseInt(f.tpl_tahun.value, 10) || '', biaya: parseNum(f.tpl_biaya.value, true), inflasi: parseNum(f.tpl_inflasi.value) });
  return '';
}

// ============================================================
// KARTU TAMBAHAN DI DETAIL GOAL & AGENDA
// ============================================================
function extraDetailCards(g) {
  let out = '';
  const m = parseMeta(g.meta);
  if (g.template === 'darurat' && m.pengeluaran) {
    const cover = Number(g.nilai_saat_ini) / m.pengeluaran;
    out += `<div class="card tint" style="--c:#CFF2D6"><h3>🛟 Dana Darurat</h3>
      <p class="mb-2">Target ${m.bulan} × pengeluaran ${fmtShort(m.pengeluaran, 'Rp')}/bln.</p>
      <div class="kv"><div><small>Saat ini cukup untuk</small><b>${fmtN(Math.floor(cover * 10) / 10)} bulan</b></div><div><small>Target</small><b>${m.bulan} bulan</b></div></div></div>`;
  }
  if (g.template === 'sekolah' && m.biaya) {
    out += `<div class="card tint" style="--c:#D5F0F7"><h3>🎓 Sekolah ${esc(m.anak || 'Anak')}</h3>
      <p class="mb-2">Masuk ${esc(m.jenjang || '')} tahun ${esc(m.tahun)}. Biaya saat ini ${fmtShort(m.biaya, 'Rp')}, asumsi naik ${esc(m.inflasi)}%/thn.</p>
      <div class="kv"><div><small>Perlu disisihkan</small><b>${fmtShort(Math.ceil(monthlyNeed(g)), 'Rp')}/bln</b></div><div><small>Sisa waktu</small><b>${Math.max(0, dayDiff(today(), g.tenggat))} hari</b></div></div></div>`;
  }
  if (needsExecDate(g)) {
    const done = goalState(g) === 'done';
    const tujuan = m.tujuan ? ' ke ' + esc(m.tujuan) : '';
    if (g.tgl_pelaksanaan) {
      const h = dayDiff(today(), g.tgl_pelaksanaan);
      out += `<div class="card tint" style="--c:#FBEBB5"><h3>🗓️ Pelaksanaan${tujuan}</h3>
        <p class="mb-2"><b style="font-size:20px">${fmtLong(g.tgl_pelaksanaan)}</b><br><span class="muted">${h > 0 ? 'H-' + h : h === 0 ? 'Hari ini! 🎉' : 'Sudah terlaksana ' + (-h) + ' hari lalu'}</span></p>
        ${canEdit(g) ? `<button class="btn btn-soft btn-sm" data-action="execDate" data-id="${g.goal_id}"><i class="bi bi-calendar-event"></i> Ubah tanggal</button>` : ''}</div>`;
    } else if (done) {
      out += `<div class="card tint" style="--c:#CFF2D6"><h3>🎉 Dana terkumpul!</h3><p class="mb-3">Saatnya menetapkan tanggal pelaksanaan${tujuan}.</p>
        ${canEdit(g) ? `<button class="btn btn-dark btn-sm" data-action="execDate" data-id="${g.goal_id}"><i class="bi bi-calendar-plus"></i> Tetapkan tanggal</button>` : ''}</div>`;
    } else {
      out += `<div class="card"><h3>🗓️ Tanggal Pelaksanaan</h3><p class="muted tiny mb-2">Ditetapkan setelah dana terkumpul. Sisa ${fmtShort(Math.max(0, g.nilai_target - g.nilai_saat_ini), 'Rp')} lagi.</p>
        ${canEdit(g) ? `<button class="link-btn p-0" style="min-height:0" data-action="execDate" data-id="${g.goal_id}">Tetapkan sekarang saja</button>` : ''}</div>`;
    }
  }
  out += pengeluaranCardHtml(g);
  return out;
}
function financeAgendaHtml() {
  const t = today(), ev = [];
  S.goals.forEach(g => {
    if (g.tgl_pelaksanaan && g.tgl_pelaksanaan >= t && dayDiff(t, g.tgl_pelaksanaan) <= 60) {
      ev.push({ d: g.tgl_pelaksanaan, c: goalColor(g), head: '🗓️ Pelaksanaan', body: g.judul, foot: 'H-' + dayDiff(t, g.tgl_pelaksanaan), act: `data-action="openGoal" data-id="${g.goal_id}"` });
    }
  });
  S.assets.filter(a => a.status === 'Aktif').forEach(a => {
    const i = assetInfo(a);
    if (i.next && dayDiff(t, i.next) <= 10) ev.push({ d: i.next, c: '#CFF2D6', head: '💸 Kupon masuk', body: a.nama + ' · ' + fmtShort(i.net, 'Rp'), foot: dayDiff(t, i.next) ? 'Sisa ' + dayDiff(t, i.next) + ' hari' : 'Hari ini', act: 'data-action="nav" data-page="finance" data-fintab="investasi"' });
    if (dayDiff(t, i.maturity) >= 0 && dayDiff(t, i.maturity) <= 60) ev.push({ d: i.maturity, c: '#FBEBB5', head: '🏦 Jatuh tempo', body: a.nama + ' · pokok ' + (isUsd(a) ? fmtUsd(a.nominal) : fmtShort(a.nominal, 'Rp')) + ' kembali', foot: 'Sisa ' + dayDiff(t, i.maturity) + ' hari', act: 'data-action="nav" data-page="finance" data-fintab="investasi"' });
  });
  S.loans.filter(l => l.status !== 'Lunas').forEach(l => {
    const i = loanInfo(l);
    if (i.next && dayDiff(t, i.next) <= 10) ev.push({ d: i.next, c: '#E8D3F5', head: '💳 Potong cicilan', body: l.nama + ' · ke-' + (i.k + 1) + '/' + i.n + ' · ' + fmtShort(i.c, 'Rp'), foot: dayDiff(t, i.next) ? 'Sisa ' + dayDiff(t, i.next) + ' hari' : 'Hari ini', act: 'data-action="nav" data-page="finance" data-fintab="pinjaman"' });
  });
  return ev.sort((a, b) => a.d.localeCompare(b.d)).slice(0, 4).map(e => `<div class="ev tint" style="--c:${esc(e.c)}">
    <div class="ev-head"><span>${e.head}</span><span class="date">${fmtDay(e.d)}</span></div>
    <div class="ev-body">${esc(e.body)}</div>
    <button class="ev-foot w-100" ${e.act}><i class="bi bi-clock"></i> ${esc(e.foot)}</button></div>`).join('');
}
function finExtraHtml() {
  const act = S.assets.filter(a => a.status === 'Aktif');
  const loans = S.loans.filter(l => l.status !== 'Lunas' && !loanInfo(l).done);
  const rk = rekList().filter(g => ['RDPU', 'Dolar'].includes(rekJenis(g)));
  const rdpu = rk.filter(g => rekJenis(g) === 'RDPU').reduce((s, g) => s + rekRp(g), 0);
  const usd = rk.filter(isUsdRek).reduce((s, g) => s + rekUsd(g), 0), usdRp = rk.filter(isUsdRek).reduce((s, g) => s + rekRp(g), 0);
  const rkRow = rk.length ? `<div class="fin-row tiny"><span class="muted">Rekening</span><strong>± ${fmtVal(rdpu + usdRp, 'Rp')}</strong></div>` : '';
  const hx = rkRow + hartaExtraHtml();
  if (!act.length && !loans.length) return hx;
  return `${act.length ? `<div class="fin-row tiny"><span class="muted">Investasi aktif</span><strong>${fmtShort(act.reduce((s, a) => s + nomRp(a), 0), 'Rp')} · kupon ${fmtShort(act.reduce((s, a) => s + assetInfo(a).net, 0), 'Rp')}/bln</strong></div>` : ''}
    ${loans.length ? `<div class="fin-row tiny"><span class="muted">Sisa cicilan</span><strong>${fmtShort(loans.reduce((s, l) => s + loanInfo(l).sisaBayar, 0), 'Rp')}</strong></div>` : ''}${hx}`;
}

// ============================================================
// HALAMAN: PUSAT FINANSIAL (Tabungan & Rencana | Investasi | Pinjaman)
// ============================================================
function renderFinance() {
  const _hs = document.querySelector('#page-finance .harta-scroll'), _hp = _hs ? [_hs.scrollTop, _hs.scrollLeft, S.ui.hartaJenis] : null;
  const tab = S.ui.finTab || 'tabungan';
  const f = finSummary();
  const act = S.assets.filter(a => a.status === 'Aktif');
  const invest = act.reduce((s, a) => s + nomRp(a), 0);
  const kupon = act.reduce((s, a) => s + assetInfo(a).net, 0);
  const runLoans = S.loans.filter(l => l.status !== 'Lunas' && !loanInfo(l).done);
  const sisaPinjam = runLoans.reduce((s, l) => s + loanInfo(l).sisaBayar, 0);
  const cicilan = runLoans.reduce((s, l) => s + loanInfo(l).c, 0);
  const tabs = [['rekening', 'Rekening', rekList().length, 'bi-bank', '#E2F4E8'], ['tabungan', 'Tabungan & Rencana', f.count, 'bi-wallet2', '#CFF2D6'], ['investasi', 'Investasi', S.assets.length, 'bi-graph-up-arrow', '#D5F0F7'],
    ['pinjaman', 'Pinjaman', S.loans.length, 'bi-credit-card', '#E8D3F5'], ['harta', 'Harta', hartaOwned().length, 'bi-gem', '#FBEBB5']]
    .map(([k, l, n, ic, c]) => `<button role="tab" aria-selected="${tab === k}" class="${tab === k ? 'on' : ''}" style="--tc:${c}" data-action="finTab" data-tab="${k}"><span class="tab-ic"><i class="bi ${ic}"></i></span>${l}<span class="n">${n}</span></button>`).join('');
  let body = '';
  if (tab === 'tabungan') body = finSavingsHtml(f);
  else if (tab === 'rekening') body = finRekHtml();
  else if (tab === 'investasi') body = finAssetsHtml();
  else if (tab === 'harta') body = finHartaHtml();
  else body = finLoansHtml();
  const hs = hartaSummary(hartaOwned());
  const hartaTotal = Object.keys(hs).reduce((s, k) => s + hs[k].nilai, 0);
  const hartaSub = ['Emas', 'Tanah'].filter(k => hs[k]).map(k => qtyText(hs[k].qty)).join(' · ');
  $('#page-finance').innerHTML = `
    <div class="page-head fin-head"><div><p class="eyebrow">Tabungan, investasi, cicilan & harta keluarga</p><h1>Pusat Finansial <span class="h-ic" style="--c:#FFE1C7" aria-hidden="true"><i class="bi bi-wallet2"></i></span></h1></div>
      <nav class="fin-secs hscroll" aria-label="Bagian finansial">${finMenuItems().map(([k, l, n]) => `<button class="fin-sec-t ${k === tab ? 'on' : ''}" data-action="finGo" data-tab="${k}" aria-pressed="${k === tab}">${l}${n ? ` <span class="n">${n}</span>` : ''}</button>`).join('')}</nav></div>
    <div class="fin-tabbar mb-3">${(() => { const t = finMenuItems().find(x => x[0] === tab) || finMenuItems()[0]; return tab === 'harta' ? `<div class="fin-left">${hartaTotalBlock()}</div><button class="btn btn-dark btn-sm" data-action="newHarta"><i class="bi bi-plus-lg"></i> Harta lain</button>` : ''; })()}</div>
    ${body}`;
  if (tab === 'tabungan') withChart(() => drawTrend('chFin', savingsSeries(monthsBack(today().slice(0, 7), 12))));
  const _hn = document.querySelector('#page-finance .harta-scroll');
  if (_hn && _hp && _hp[2] === S.ui.hartaJenis) { _hn.scrollTop = _hp[0]; _hn.scrollLeft = _hp[1]; }
}
/** Tampilan per tab (disimpan terpisah): Harta bawaan Daftar (tabel), lainnya Kartu */
const finView = () => { const t = S.ui.finTab || 'tabungan'; S.ui.finViews = S.ui.finViews || {};
  return S.ui.finViews[t] || lsGet('gt_finview_' + t, t === 'harta' ? 'list' : 'grid'); };
/** Pilihan tampilan (peta perjalanan / daftar / kartu) — dipakai semua tab Finansial */
function viewRailHtml(extra = '') {
  return `${extra ? '<div class="rail-stack">' : ''}<div class="view-rail" role="group" aria-label="Pilih tampilan">${[['journey', 'bi-bezier2', 'Peta perjalanan'], ['list', 'bi-list-ul', 'Daftar'], ['grid', 'bi-grid', 'Kartu']]
    .map(([k, i, l]) => `<button class="${finView() === k ? 'on' : ''}" data-action="finView" data-view="${k}" aria-label="${l}" title="${l}" aria-pressed="${finView() === k}"><i class="bi ${i}"></i></button>`).join('')}</div>${extra ? extra + '</div>' : ''}`;
}
function finViewBody(cards, listHtml) {
  const v = finView();
  if (v === 'list') return listHtml;
  if (v === 'journey') {
    const item = c => `<div class="j-item">${c}</div>`;
    if (mqWide.matches) {
      const l = cards.filter((_, i) => i % 2 === 0), r = cards.filter((_, i) => i % 2 === 1);
      return `<div class="journey"><div class="j-col">${l.map(item).join('')}</div><div class="j-col">${r.map(item).join('')}</div></div>`;
    }
    return `<div class="journey">${cards.map(item).join('')}</div>`;
  }
  return `<div class="ggrid">${cards.map(c => `<div class="m-item">${c}</div>`).join('')}</div>`;
}
/** Lencana instrumen investasi (ilustrasi sendiri, bukan logo resmi): warna per jenis + kode seri */
const ASSET_BADGE = {
  SR: ['#8B1A8F', '#F1DDF2', 'SUKUK RITEL'], ST: ['#1B4F8A', '#DCE8F6', 'SUKUK TAB.'], ORI: ['#B42318', '#FDECEA', 'OBLIGASI RI'],
  SBR: ['#A15C07', '#FEF3E2', 'SAVINGS BOND'], SBN: ['#1D4ED8', '#E6EEFD', 'SURAT NEGARA'], Deposito: ['#6D28D9', '#F0E9FD', 'DEPOSITO'],
  Obligasi: ['#334155', '#EEF1F5', 'OBLIGASI'], USD: ['#1E7A46', '#E2F4E8', 'TABUNGAN USD'], Lainnya: ['#475569', '#EEF1F5', 'INVESTASI']
};
/** Ikon gambar per jenis (diunggah pengguna). Jenis lain memakai lencana gambar sendiri. */
/* Logo ST disematkan langsung (data URI) agar tampil seketika tanpa menunggu unduhan gambar */
const ASSET_IMG = { ST: 'data:image/png;base64,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' };
function assetBadgeSvg(a, size) {
  if (a.jenis === 'SR') {                                   // SR: bintang delapan ungu (digambar ulang dari ikon pengguna)
    const w = size || 44, seri = (String(a.nama).match(/\d{2,4}/) || [''])[0];
    return `<svg viewBox="0 0 48 48" width="${w}" height="${w}" role="img" aria-label="SR ${esc(seri)}">
      <polygon points="24.00,3.00 30.15,9.15 38.85,9.15 38.85,17.85 45.00,24.00 38.85,30.15 38.85,38.85 30.15,38.85 24.00,45.00 17.85,38.85 9.15,38.85 9.15,30.15 3.00,24.00 9.15,17.85 9.15,9.15 17.85,9.15" fill="#fff" stroke="#8B1A8F" stroke-width="3.4" stroke-linejoin="round"/>
      <text x="24" y="${seri ? 23.5 : 28.5}" text-anchor="middle" font-family="Arial,sans-serif" font-size="12" font-weight="900" fill="#8B1A8F">SR</text>
      ${seri ? `<text x="24" y="33.5" text-anchor="middle" font-family="Arial,sans-serif" font-size="8.5" font-weight="800" fill="#8B1A8F">${esc(seri)}</text>` : ''}
    </svg>`;
  }
  if (ASSET_IMG[a.jenis]) {
    const w = size || 44, seri = (String(a.nama).match(/\d{2,4}/) || [''])[0];
    return `<span class="asset-img" style="width:${w}px;height:${w}px"><img src="${ASSET_IMG[a.jenis]}" alt="${esc(a.jenis)}" width="${w}" height="${w}">${seri ? `<i>${esc(seri)}</i>` : ''}</span>`;
  }
  const [fg, bg, cap] = ASSET_BADGE[a.jenis] || ASSET_BADGE.Lainnya;
  const kode = a.jenis.length <= 3 ? a.jenis : a.jenis.slice(0, 3).toUpperCase();
  const seri = (String(a.nama).match(/\d{2,4}/) || [''])[0];
  const w = size || 44;
  return `<svg viewBox="0 0 48 48" width="${w}" height="${w}" role="img" aria-label="${esc(a.jenis)} ${esc(seri)}">
    <rect x="1" y="1" width="46" height="46" rx="12" fill="${bg}" stroke="${fg}" stroke-opacity=".35"/>
    <rect x="1" y="1" width="46" height="11" rx="6" fill="${fg}"/><rect x="1" y="7" width="46" height="5" fill="${fg}"/>
    <text x="24" y="9.6" text-anchor="middle" font-family="Arial,sans-serif" font-size="5.2" font-weight="700" fill="#fff" letter-spacing=".3">${cap}</text>
    <text x="24" y="${seri ? 30 : 34}" text-anchor="middle" font-family="Arial,sans-serif" font-size="${kode.length > 2 ? 13 : 16}" font-weight="900" fill="${fg}">${esc(kode)}</text>
    ${seri ? `<text x="24" y="41.5" text-anchor="middle" font-family="Arial,sans-serif" font-size="9" font-weight="800" fill="${fg}" opacity=".85">${esc(seri)}</text>` : ''}
  </svg>`;
}
const finLayout = (cards, listHtml) => `<div class="goals-layout">${viewRailHtml()}<div style="min-width:0">${finViewBody(cards, listHtml)}</div></div>`;
/** Baris ringkas untuk tampilan Daftar */
const finRow = o => `<button class="row-item${o.tint ? ' row-tint' : ''}" ${o.act}${o.tint ? ` style="--c:${o.tint};--fg:${o.fg || 'inherit'}"` : ''}>
    ${o.raw ? `<span class="ic-raw">${o.raw}</span>` : `<span class="ic tint" style="--c:${o.c}">${o.ic}</span>`}
    <span><b>${esc(o.title)}</b><span class="sub">${o.badge || ''}${o.sub}</span>
      <span class="pbar sm mt-2"><span style="width:${Math.min(100, o.pct)}%"></span></span></span>
    <span class="pct">${o.right}</span>
  </button>`;
function finSavingsHtml(f) {
  const list = sortGoals(f.goals, 'tenggat');
  const cards = list.map(g => {
    const done = goalState(g) === 'done';
    const m = parseMeta(g.meta);
    const tag = TPL[g.template] ? `<span class="chip tint tpl-tag" style="--c:${esc(goalColor(g))}"><i class="bi ${esc(TPL[g.template].ikon || (catById(TPL[g.template].cat) || {}).ikon || 'bi-bookmark')}"></i><span class="tt-l">${TPL[g.template].label}</span></span>` : '';
    const mItems = [
      canLog(g) && !done ? `<button data-action="logProgress" data-id="${g.goal_id}"><i class="bi bi-plus-lg"></i> Setor</button>` : '',
      done && needsExecDate(g) && !g.tgl_pelaksanaan && canEdit(g) ? `<button data-action="execDate" data-id="${g.goal_id}"><i class="bi bi-calendar-plus"></i> Tetapkan tanggal pelaksanaan</button>` : '',
      canEdit(g) && bisaPengeluaran(g) ? `<button data-action="newPengeluaran" data-id="${g.goal_id}"><i class="bi bi-receipt"></i> ${PKAT_INFO[pkProfile(g)].btn}</button>` : '',
      `<button data-action="openGoal" data-id="${g.goal_id}"><i class="bi bi-list-ul"></i> Rincian</button>`,
      canEdit(g) ? `<button data-action="editGoal" data-id="${g.goal_id}"><i class="bi bi-pencil"></i> Edit</button>` : ''].join('');
    return `<div class="card tint fin-note has-more" style="--c:${esc(goalColor(g))}">
      ${tag ? `<div class="tpl-row align-items-center gap-2">${tag}${cardMenuBtn(mItems, g.judul)}</div>` : cardMenuBtn(mItems, g.judul)}
      <div class="d-flex align-items-center gap-3">
        <div class="ring" style="--p:${goalPct(g)};--size:84px"><div><b>${pctInt(g)}%</b></div></div>
        <div class="flex-grow-1" style="min-width:0">
          <button class="link-btn p-0 text-start d-block" style="min-height:0;color:var(--text);font-size:17px;font-weight:800" data-action="openGoal" data-id="${g.goal_id}">${esc(g.judul)}</button>
          <div class="tiny muted">${g.jenis === 'Bersama' ? 'Bersama' : esc(userById(g.pemilik_id).nama)}${m.tujuan ? ' · ' + esc(m.tujuan) : ''} · target ${fmtDate(g.tenggat)}</div>
          <div class="mt-1"><b>${fmtShort(g.nilai_saat_ini, 'Rp')}</b> <span class="muted tiny">/ ${fmtShort(g.nilai_target, 'Rp')}</span></div>
        </div>
      </div>
      ${rekTujuan(g) ? `<div class="tiny muted mt-2"><i class="bi bi-arrow-return-right"></i> Setoran masuk ke <b>${esc(rekTujuan(g).judul)}</b></div>` : ''}
      <div class="kv mt-3">
        <div><small>Sisa</small><b>${fmtShort(Math.max(0, g.nilai_target - g.nilai_saat_ini), 'Rp')}</b></div>
        <div><small>${done ? (needsExecDate(g) ? 'Pelaksanaan' : 'Status') : 'Saran setoran'}</small><b>${done ? (needsExecDate(g) ? (g.tgl_pelaksanaan ? fmtDate(g.tgl_pelaksanaan) : 'Belum ditetapkan') : 'Tercapai 🎉') : fmtShort(Math.ceil(monthlyNeed(g)), 'Rp') + '/bln'}</b></div>
      </div>
      ${punyaPengeluaran(g) ? (() => { const a = anggaranInfo(g), lb = a.sisa < 0; return `<div class="kv mt-2"><div><small>Terpakai</small><b>${fmtShort(a.pakai, 'Rp')}</b></div><div><small>${lb ? 'Kelebihan' : 'Sisa anggaran'}</small><b style="color:${lb ? 'var(--red-ink)' : 'var(--green-ink,#1B7F3A)'}">${lb ? '−' : ''}${fmtShort(Math.abs(a.sisa), 'Rp')}</b></div></div>`; })() : ''}
    </div>`;
  });
  const cardArr = cards;
  return `${finSumHead(`Total tabungan terkumpul ${fmtVal(f.saved, 'Rp')}`, `setoran bulan ini ${fmtVal(f.month, 'Rp')}`, 'Target tabungan & rencana keluarga — liburan, sekolah anak, dana darurat, dll. Masing-masing punya target dan tenggat.', '<button class="btn btn-dark btn-sm" data-action="newGoal" data-tipe="Finansial"><i class="bi bi-plus-lg"></i> Target tabungan lain</button>')}
    ${list.length ? finLayout(cardArr, `<div class="glist">${list.map(rowItem).join('')}</div>`) : `<div class="card">${emptyHtml('bi-wallet2', 'Belum ada rencana tabungan. Klik “Target tabungan lain” di kanan atas untuk mulai.')}</div>`}
    <div class="card mt-3"><h3>Tren Tabungan 12 Bulan <span class="muted tiny">batang = setoran per bulan · garis = total terkumpul</span></h3><div class="chart-box"><canvas id="chFin" aria-label="Grafik tren tabungan per bulan" role="img"></canvas></div></div>`;
}
// ── TABUNGAN UTAMA: rekening penampung kupon / imbalan investasi (SR, SBN, ORI, deposito, dll) ──
const utamaGoal = () => (S.rekening || []).find(g => g.status !== 'Arsip' && parseMeta(g.meta).utama);
function createUtama(arahkan) {
  if (utamaGoal()) return utamaGoal();
  const t = today();
  const g = {
    goal_id: uid(), judul: 'Tabungan Utama', deskripsi: 'Penampung kupon & imbalan investasi (SR, SBN, ORI, deposito, dll).',
    kategori_id: S.categories.some(c => c.kategori_id === 'cat-keuangan') ? 'cat-keuangan' : (S.categories[0] || {}).kategori_id,
    jenis: 'Bersama', visibilitas: 'Terlihat pasangan', tipe_target: 'Finansial', nilai_target: 100000000, satuan: 'Rp',
    tgl_mulai: t, tenggat: (Number(t.slice(0, 4)) + 10) + t.slice(4), prioritas: 'Tinggi', ikon: '', warna: '#CFF2D6',
    tgl_pelaksanaan: '', template: '', meta: JSON.stringify({ utama: true })
  };
  S.goals.push(Object.assign({}, g, { pemilik_id: S.me.user_id, nilai_saat_ini: 0, status: 'Aktif', dibuat_pada: nowIso(), diubah_pada: nowIso() }));
  Outbox.push('saveGoal', [g, []]);
  if (arahkan) arahkanKupon(g.goal_id, true);
  saveSnapshot();
  return goalById(g.goal_id);
}
function arahkanKupon(goalId, silent) {
  const list = S.assets.filter(a => a.status === 'Aktif' && a.goal_tujuan_id !== goalId);
  list.forEach(a => { a.goal_tujuan_id = goalId; a.diubah_pada = nowIso(); Outbox.push('saveAsset', [Object.assign({}, a)]); });
  saveSnapshot();
  if (!silent) toast(list.length ? `${list.length} investasi kini mengirim kupon ke Tabungan Utama 🏦` : 'Semua kupon sudah masuk ke Tabungan Utama');
  return list.length;
}
/* ── REKENING PENAMPUNG: rekening bank, RDPU, e-wallet, deposito, dll (disimpan sebagai goal Finansial ber-meta rekening) ── */
const REK_JENIS = {
  Bank: { ic: 'bi-bank', c: '#CFF2D6', ph: 'mis. BSI a.n. Ayah' },
  RDPU: { ic: 'bi-coin-rp', c: '#D5F0F7', ph: 'mis. RDPU Sucorinvest Money Market' },
  'E-Wallet': { ic: 'bi-phone', c: '#E8D3F5', ph: 'mis. GoPay / OVO / DANA' },
  Deposito: { ic: 'bi-safe2', c: '#FBEBB5', ph: 'mis. Deposito Mandiri 12 bln' },
  Dolar: { ic: 'bi-currency-dollar', c: '#E2F4E8', ph: 'mis. Tabungan Dolar BSI', usd: true },
  Lainnya: { ic: 'bi-wallet2', c: '#FFE1C7', ph: 'mis. Celengan rumah' }
};
const REK_TARGET = 1e15;
/** Rekening bersama boleh dihapus suami maupun istri (bukan hanya Admin) */
const canDelRek = g => g.jenis === 'Bersama' ? true : g.pemilik_id === S.me.user_id;
const isRek = g => { const m = parseMeta(g && g.meta); return !!(m.utama || m.rekening); };
const rekJenis = g => { const m = parseMeta(g.meta); return (m.rekening && REK_JENIS[m.rekening.jenis]) ? m.rekening.jenis : 'Bank'; };
const rekList = () => (S.rekening || []).filter(g => g.status !== 'Arsip')
  .sort((a, b) => (parseMeta(b.meta).utama ? 1 : 0) - (parseMeta(a.meta).utama ? 1 : 0) || String(a.dibuat_pada).localeCompare(String(b.dibuat_pada)));
const isUsdRek = g => isRek(g) && rekJenis(g) === 'Dolar';
const rekUsd = g => Number(parseMeta(g.meta).usd) || 0;
/** Nilai rekening dalam Rupiah hari ini (rekening dolar: saldo USD × kurs hari ini) */
const rekRp = g => isUsdRek(g) ? Math.round(rekUsd(g) * kursUsd()) : Number(g.nilai_saat_ini || 0);
const rekIc = (j, size = 46) => { const r = REK_JENIS[j] || REK_JENIS.Lainnya; return `<span class="rek-ic" style="--c:${r.c};width:${size}px;height:${size}px"><i class="bi ${r.ic}"></i></span>`; };
/** Ringkasan jenis harta: lebar & tepi kiri disamakan dengan deretan pilihan jenis di atasnya */
function alignHartaSummary() {
  const nav = document.querySelector('#page-finance .harta-nav'), sm = document.querySelector('#page-finance .fin-tabbar .harta-head-plain');
  if (!nav || !sm) return;
  sm.style.width = innerWidth >= 992 ? Math.round(nav.getBoundingClientRect().width) + 'px' : '';
}
window.addEventListener('resize', () => { if (S.ui && S.ui.page === 'finance' && S.ui.finTab === 'harta') alignHartaSummary(); });
/** Ringkasan di atas tiap bagian Finansial: total besar + keterangan (gaya sama dengan Rekening) */
const finSumHead = (main, extra, desc, btn = '') => `<div class="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-3">
    <div style="min-width:0"><div class="fw-bold fin-total">${main}${extra ? ` <span class="tiny muted fw-normal">· ${extra}</span>` : ''}</div>${desc ? `<p class="tiny muted mb-0" style="max-width:640px">${desc}</p>` : ''}</div>${btn}</div>`;
function finRekHtml() {
  const list = rekList(), u = utamaGoal();
  const add = `<button class="btn btn-dark btn-sm" data-action="rekBaru"><i class="bi bi-plus-lg"></i> Tambah rekening</button>`;
  const intro = `<p class="tiny muted mb-0" style="max-width:640px">Rekening bank, RDPU, e-wallet, deposito & tabungan dolar. Bukan target — saldo terus bertambah. Satu rekening bisa dipilih sebagai penerima kupon investasi otomatis.</p>`;
  if (!list.length) return `<div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">${intro}${add}</div>
    <div class="card">${emptyHtml('bi-bank', 'Belum ada rekening. Tambahkan rekening bank, RDPU, e-wallet, deposito atau tabungan dolar.', add)}</div>`;
  const ym = today().slice(0, 7), ids = new Set(list.map(g => g.goal_id));
  const bulanIni = S.assetIncome.filter(x => ids.has(x.goal_id) && String(x.periode || x.tanggal).slice(0, 7) === ym).reduce((s, x) => s + Number(x.jumlah), 0);
  const saldo = list.reduce((s, g) => s + rekRp(g), 0);
  const lain = S.assets.filter(a => a.status === 'Aktif' && !ids.has(a.goal_tujuan_id));
  const info = g => { const linked = S.assets.filter(a => a.status === 'Aktif' && a.goal_tujuan_id === g.goal_id);
    return { linked, perBulan: linked.reduce((s, a) => s + assetInfo(a).net, 0), main: !!parseMeta(g.meta).utama }; };
  const selisih = g => { const sel = rekRp(g) - Number(g.nilai_saat_ini || 0);
    return Math.abs(sel) >= 1000 ? ` <span style="color:${sel > 0 ? 'var(--green-ink,#1B7F3A)' : 'var(--red-ink)'}">(${sel > 0 ? '+' : '−'}${fmtShort(Math.abs(sel), 'Rp')} kurs)</span>` : ''; };
  const btns = (g, big) => `<button class="btn ${big ? 'btn-mint' : 'btn-soft'} btn-sm" data-action="${isUsdRek(g) ? 'usdTx' : 'logProgress'}" data-id="${g.goal_id}"><i class="bi bi-arrow-left-right"></i> Setor / tarik</button>
      <button class="btn btn-soft btn-sm" data-action="rekHist" data-id="${g.goal_id}"><i class="bi bi-clock-history"></i> Riwayat</button>
      ${canEdit(g) ? `<button class="btn btn-soft btn-sm" data-action="rekEdit" data-id="${g.goal_id}"><i class="bi bi-pencil"></i> Edit</button>` : ''}
      ${canDelRek(g) ? `<button class="btn btn-soft btn-sm rek-del" data-action="rekHapus" data-id="${g.goal_id}" aria-label="Hapus ${esc(g.judul)}"><i class="bi bi-trash3"></i> Hapus</button>` : ''}`;
  const cards = list.map(g => { const r = REK_JENIS[rekJenis(g)] || REK_JENIS.Lainnya, x = info(g);
    return `<div class="card tint fin-note rek-card has-more" style="--c:${r.c}">
      ${cardMenuBtn(btns(g, true), g.judul)}
      <div class="d-flex align-items-center gap-3">
        ${rekIc(rekJenis(g), 52)}
        <div class="flex-grow-1" style="min-width:0">
          <div class="d-flex gap-2 align-items-center flex-wrap"><span class="chip tint tpl-tag" style="--c:${r.c}"><i class="bi ${r.ic}"></i> ${esc(rekJenis(g))}</span>${x.main ? '<span class="badge-s s-done"><i class="bi bi-star-fill"></i> Penerima kupon</span>' : ''}</div>
          <div class="rek-name">${esc(g.judul)}</div>
        </div>
      </div>
      <div class="rek-big mt-3">${isUsdRek(g) ? `${fmtUsd(rekUsd(g))}<small class="d-block muted">≈ ${fmtVal(rekRp(g), 'Rp')}${selisih(g)}</small>` : fmtVal(g.nilai_saat_ini, 'Rp')}</div>
      <p class="tiny muted mt-2 mb-0"><i class="bi bi-arrow-return-right"></i> ${x.linked.length ? `${x.linked.length} investasi mengirim kupon · ±${fmtShort(x.perBulan, 'Rp')}/bln` : 'Belum ada kupon yang diarahkan ke sini'}</p>
    </div>`; });
  const rows = list.map(g => { const x = info(g);
    return `<div class="rek-row">
      ${rekIc(rekJenis(g))}
      <div class="flex-grow-1" style="min-width:0">
        <div class="d-flex align-items-center gap-2 flex-wrap"><b>${esc(g.judul)}</b><span class="tiny muted">${esc(rekJenis(g))}</span>${x.main ? '<span class="badge-s s-done" style="padding:2px 8px;font-size:11px"><i class="bi bi-star-fill"></i> Penerima kupon utama</span>' : ''}</div>
        <div class="tiny muted">${x.linked.length ? `${x.linked.length} investasi mengirim kupon · ±${fmtShort(x.perBulan, 'Rp')}/bln` : 'Belum ada kupon yang diarahkan ke sini'}</div>
      </div>
      <div class="rek-saldo text-end">${isUsdRek(g) ? `${fmtUsd(rekUsd(g))}<small class="d-block muted fw-semibold">≈ ${fmtShort(rekRp(g), 'Rp')}${selisih(g)}</small>` : fmtShort(g.nilai_saat_ini, 'Rp')}</div>
      <div class="d-flex gap-1">
        <button class="icon-btn sm" data-action="${isUsdRek(g) ? 'usdTx' : 'logProgress'}" data-id="${g.goal_id}" title="Setor / tarik" aria-label="Setor atau tarik ${esc(g.judul)}"><i class="bi bi-arrow-left-right"></i></button>
        <button class="icon-btn sm" data-action="rekHist" data-id="${g.goal_id}" title="Riwayat" aria-label="Riwayat ${esc(g.judul)}"><i class="bi bi-clock-history"></i></button>
        ${canEdit(g) ? `<button class="icon-btn sm" data-action="rekEdit" data-id="${g.goal_id}" title="Edit" aria-label="Edit ${esc(g.judul)}"><i class="bi bi-pencil"></i></button>` : ''}
        ${canDelRek(g) ? `<button class="icon-btn sm" data-action="rekHapus" data-id="${g.goal_id}" title="Hapus" aria-label="Hapus ${esc(g.judul)}"><i class="bi bi-trash3"></i></button>` : ''}
      </div></div>`; }).join('');
  return `<div class="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-3">
      <div><div class="fw-bold fin-total">Total saldo ${fmtVal(saldo, 'Rp')} <span class="tiny muted fw-normal">· kupon masuk bulan ini ${fmtVal(bulanIni, 'Rp')}</span></div>${intro}${list.some(isUsdRek) ? `<div class="mt-2">${kursInfoHtml()}</div>` : ''}</div>${add}</div>
    ${lain.length && u ? `<div class="price-box mb-3"><div><small class="muted">${lain.length} investasi aktif belum mengirim kupon ke rekening mana pun</small><b style="font-size:14px">${lain.map(a => esc(a.nama)).join(', ')}</b></div>
      <button class="btn btn-dark btn-sm" data-action="utamaArahkan"><i class="bi bi-arrow-down-circle"></i> Arahkan ke ${esc(u.judul)}</button></div>` : ''}
    ${finLayout(cards, `<div class="card"><div class="rek-list">${rows}</div></div>`)}`;
}
function utamaCardHtml() {
  const list = rekList(), u = utamaGoal();
  const add = `<button class="btn btn-dark btn-sm" data-action="rekBaru"><i class="bi bi-plus-lg"></i> Tambah rekening</button>`;
  if (!list.length) return `<div class="card utama-card mb-3"><div class="d-flex align-items-center gap-3 flex-wrap">
      ${rekIc('Bank', 52)}
      <div class="flex-grow-1" style="min-width:200px"><h3 class="mb-1">Belum ada rekening</h3><p class="tiny muted mb-0">Catat rekening bank, RDPU, e-wallet atau deposito. Pilih satu sebagai penerima kupon utama — kupon bersih investasi (SR, ST, ORI, dll) masuk otomatis tiap tanggal kupon.</p></div>
      ${add}</div></div>`;
  const ym = today().slice(0, 7), ids = new Set(list.map(g => g.goal_id));
  const inc = S.assetIncome.filter(x => ids.has(x.goal_id));
  const bulanIni = inc.filter(x => String(x.periode || x.tanggal).slice(0, 7) === ym).reduce((s, x) => s + Number(x.jumlah), 0);
  const saldo = list.reduce((s, g) => s + rekRp(g), 0);
  const lain = S.assets.filter(a => a.status === 'Aktif' && !ids.has(a.goal_tujuan_id));
  const rows = list.map(g => {
    const linked = S.assets.filter(a => a.status === 'Aktif' && a.goal_tujuan_id === g.goal_id);
    const perBulan = linked.reduce((s, a) => s + assetInfo(a).net, 0);
    const main = parseMeta(g.meta).utama;
    return `<div class="rek-row">
      ${rekIc(rekJenis(g))}
      <div class="flex-grow-1" style="min-width:0">
        <div class="d-flex align-items-center gap-2 flex-wrap"><b>${esc(g.judul)}</b><span class="tiny muted">${esc(rekJenis(g))}</span>${main ? '<span class="badge-s s-done" style="padding:2px 8px;font-size:11px"><i class="bi bi-star-fill"></i> Penerima kupon utama</span>' : ''}</div>
        <div class="tiny muted">${linked.length ? `${linked.length} investasi mengirim kupon · ±${fmtShort(perBulan, 'Rp')}/bln` : 'Belum ada kupon yang diarahkan ke sini'}</div>
      </div>
      ${isUsdRek(g) ? (() => { const sel = rekRp(g) - Number(g.nilai_saat_ini || 0);
        return `<div class="rek-saldo text-end">${fmtUsd(rekUsd(g))}<small class="d-block muted fw-semibold">≈ ${fmtShort(rekRp(g), 'Rp')}${Math.abs(sel) >= 1000 ? ` <span style="color:${sel > 0 ? 'var(--green-ink,#1B7F3A)' : 'var(--red-ink)'}">(${sel > 0 ? '+' : '−'}${fmtShort(Math.abs(sel), 'Rp')} kurs)</span>` : ''}</small></div>`; })() : `<div class="rek-saldo">${fmtShort(g.nilai_saat_ini, 'Rp')}</div>`}
      <div class="d-flex gap-1">
        <button class="icon-btn sm" data-action="${isUsdRek(g) ? 'usdTx' : 'logProgress'}" data-id="${g.goal_id}" title="Setor / tarik" aria-label="Setor atau tarik ${esc(g.judul)}"><i class="bi bi-arrow-left-right"></i></button>
        <button class="icon-btn sm" data-action="rekHist" data-id="${g.goal_id}" title="Riwayat" aria-label="Riwayat ${esc(g.judul)}"><i class="bi bi-clock-history"></i></button>
        ${canEdit(g) ? `<button class="icon-btn sm" data-action="rekEdit" data-id="${g.goal_id}" title="Edit" aria-label="Edit ${esc(g.judul)}"><i class="bi bi-pencil"></i></button>` : ''}
      </div></div>`;
  }).join('');
  return `<div class="card utama-card mb-3">
    <div class="d-flex align-items-center justify-content-between gap-2 flex-wrap mb-2">
      <div><h3 class="mb-0">Daftar Rekening</h3><div class="tiny muted">Total saldo ${fmtVal(saldo, 'Rp')} · kupon masuk bulan ini ${fmtShort(bulanIni, 'Rp')}</div>${list.some(isUsdRek) ? `<div class="mt-1">${kursInfoHtml()}</div>` : ''}</div>${add}</div>
    <div class="rek-list">${rows}</div>
    ${lain.length && u ? `<div class="price-box mt-2"><div><small class="muted">${lain.length} investasi aktif belum mengirim kupon ke rekening mana pun</small><b style="font-size:14px">${lain.map(a => esc(a.nama)).join(', ')}</b></div>
      <button class="btn btn-dark btn-sm" data-action="utamaArahkan"><i class="bi bi-arrow-down-circle"></i> Arahkan ke ${esc(u.judul)}</button></div>` : ''}
  </div>`;
}
function openRekForm(id) {
  const g = id ? goalById(id) : null;
  const jenis = g ? rekJenis(g) : 'Bank';
  const main = g ? !!parseMeta(g.meta).utama : !utamaGoal();
  openSheet(g ? 'Edit Rekening' : 'Rekening Baru', `
  <form data-form="rekening" novalidate>
    <input type="hidden" name="goal_id" value="${g ? g.goal_id : ''}">
    <div class="field"><span>Jenis</span><div class="chips chips-wrap">${Object.keys(REK_JENIS).map(k => `<label class="chip-btn cat-chip ${k === jenis ? 'on' : ''}"><input type="radio" name="jenis" value="${k}" class="visually-hidden" data-change="rekJenis" ${k === jenis ? 'checked' : ''}><span class="cat-ic" style="--c:${REK_JENIS[k].c}"><i class="bi ${REK_JENIS[k].ic}"></i></span>${k}</label>`).join('')}</div></div>
    <label class="field"><span>Nama rekening</span><input name="nama" maxlength="60" required value="${esc(g ? g.judul : '')}" placeholder="${esc(REK_JENIS[jenis].ph)}"><em class="field-err"></em></label>
    ${g ? '' : `<label class="field"><span id="rekSaldoLbl">Saldo saat ini (${jenis === 'Dolar' ? 'USD' : 'Rp'}) <small>(opsional)</small></span><input name="saldo" inputmode="decimal" ${jenis === 'Dolar' ? '' : 'data-money'} placeholder="0"></label>`}
    <div id="rekKurs" class="mb-3" ${jenis === 'Dolar' ? '' : 'hidden'}>${kursInfoHtml()}<small class="d-block muted mt-1">Saldo disimpan dalam USD dan dinilai ke Rupiah dengan kurs hari ini.</small></div>
    <label class="check-row"><input type="checkbox" name="utama" ${main ? 'checked' : ''} ${main && g ? 'disabled' : ''}> <span>Jadikan <b>penerima kupon utama</b> <small class="muted d-block">Kupon investasi baru otomatis diarahkan ke rekening ini.</small></span></label>
    <div class="sheet-foot">${g && canDelRek(g) ? `<button type="button" class="btn btn-soft rek-del" data-action="rekHapus" data-id="${g.goal_id}"><i class="bi bi-trash3"></i> Hapus</button>` : `<button type="button" class="btn btn-soft" data-action="closeSheet">Batal</button>`}<button class="btn btn-dark" type="submit">Simpan</button></div>
  </form>`);
}
function goalSaveArgs_(g) {
  return [{ goal_id: g.goal_id, judul: g.judul, deskripsi: g.deskripsi, kategori_id: g.kategori_id, jenis: g.jenis, visibilitas: g.visibilitas, tipe_target: g.tipe_target,
    nilai_target: g.nilai_target, satuan: g.satuan, tgl_mulai: g.tgl_mulai, tenggat: g.tenggat, prioritas: g.prioritas, ikon: g.ikon, warna: g.warna,
    tgl_pelaksanaan: g.tgl_pelaksanaan, template: g.template, meta: g.meta }, msOf(g.goal_id).map(m => ({ milestone_id: m.milestone_id, judul: m.judul, nilai_target: m.nilai_target }))];
}
function setUtama_(goalId) {
  rekList().forEach(g => {
    const m = parseMeta(g.meta), want = g.goal_id === goalId;
    if (!!m.utama === want) return;
    if (want) m.utama = true; else delete m.utama;
    if (!m.rekening) m.rekening = { jenis: 'Bank' };
    g.meta = JSON.stringify(m); g.diubah_pada = nowIso();
    Outbox.push('saveGoal', goalSaveArgs_(g));
  });
}
function submitRek(f) {
  const nama = f.nama.value.trim();
  if (!nama) { const fd = f.nama.closest('.field'); fd.classList.add('invalid'); fd.querySelector('.field-err').textContent = 'Nama rekening wajib diisi.'; return; }
  const jenis = (f.querySelector('input[name=jenis]:checked') || {}).value || 'Bank';
  const target = REK_TARGET;   // rekening bukan target: nilai teknis sangat besar agar tak pernah 'tercapai'
  const wantMain = f.utama.checked;
  let g = goalById(f.goal_id.value);
  if (g) {
    const m = parseMeta(g.meta); m.rekening = { jenis };
    Object.assign(g, { judul: nama, nilai_target: target, meta: JSON.stringify(m), diubah_pada: nowIso() });
    Outbox.push('saveGoal', goalSaveArgs_(g));
  } else {
    const t = today();
    const meta = { rekening: { jenis } };
    const base = { goal_id: uid(), judul: nama, deskripsi: `Rekening ${jenis} — penampung dana & kupon investasi.`,
      kategori_id: S.categories.some(c => c.kategori_id === 'cat-keuangan') ? 'cat-keuangan' : (S.categories[0] || {}).kategori_id,
      jenis: 'Bersama', visibilitas: 'Terlihat pasangan', tipe_target: 'Finansial', nilai_target: target, satuan: 'Rp',
      tgl_mulai: t, tenggat: (Number(t.slice(0, 4)) + 10) + t.slice(4), prioritas: 'Sedang', ikon: '', warna: REK_JENIS[jenis].c,
      tgl_pelaksanaan: '', template: '', meta: JSON.stringify(meta) };
    g = Object.assign({}, base, { pemilik_id: S.me.user_id, nilai_saat_ini: 0, status: 'Aktif', dibuat_pada: nowIso(), diubah_pada: nowIso() });
    (S.rekening = S.rekening || []).push(g);
    const usd = jenis === 'Dolar' ? parseUsd(f.saldo && f.saldo.value) : 0;
    const saldo = jenis === 'Dolar' ? Math.round(usd * kursUsd()) : (f.saldo ? parseNum(f.saldo.value, true) : 0);
    if (usd > 0) { meta.usd = usd; g.meta = base.meta = JSON.stringify(meta); }
    Outbox.push('saveGoal', [base, []]);
    if (saldo > 0) {
      const cat = usd > 0 ? `Saldo awal ${fmtUsd(usd)} @ ${fmtVal(kursUsd(), 'Rp')}` : 'Saldo awal';
      const log = { log_id: uid(), goal_id: g.goal_id, tanggal: t, user_id: S.me.user_id, nilai_tambah: saldo, catatan: cat, foto_url: '', dibuat_pada: nowIso() };
      S.logs.push(log); g.nilai_saat_ini = saldo; syncStatusLocal(g);
      Outbox.push('addProgress', [{ log_id: log.log_id, goal_id: g.goal_id, nilai_tambah: saldo, catatan: cat, tanggal: t }, null]);
    }
  }
  if (wantMain && !parseMeta(g.meta).utama) setUtama_(g.goal_id);
  saveSnapshot(); closeSheet(); renderAll();
  const ada = wantMain && S.assets.some(a => a.status === 'Aktif' && a.goal_tujuan_id !== g.goal_id);
  if (ada) confirmBox({ title: `Arahkan kupon ke "${g.judul}"?`, text: 'Kupon semua investasi aktif akan masuk ke rekening ini mulai kupon berikutnya. Setoran yang sudah tercatat tidak berubah.', ok: 'Ya, arahkan' }, () => { closeSheet(); arahkanKupon(g.goal_id); renderAll(); });
  else toast(f.goal_id.value ? 'Rekening diperbarui' : 'Rekening ditambahkan 🏦');
}
function finAssetsHtml() {
  const list = S.assets.slice().sort((a, b) => (a.status === 'Aktif' ? 0 : 1) - (b.status === 'Aktif' ? 0 : 1) || a.tgl_mulai.localeCompare(b.tgl_mulai));
  const cards = list.map(a => {
    const i = assetInfo(a);
    const g = goalById(a.goal_tujuan_id);
    const st = a.status !== 'Aktif' ? `<span class="badge-s s-done">${esc(a.status)} 🎉</span>` : `<span class="badge-s s-active">Aktif</span>`;
    const [afg, abg] = ASSET_BADGE[a.jenis] || ASSET_BADGE.Lainnya;
    return `<div class="card tint fin-note has-more" style="--c:${abg};--fg:${afg}">
      <div class="tpl-row d-flex gap-2 align-items-center"><span class="asset-logo" title="${esc(a.jenis)}">${assetBadgeSvg(a, 38)}</span>${st}${cardMenuBtn(`<button data-action="editAsset" data-id="${a.aset_id}"><i class="bi bi-pencil"></i> Edit</button><button class="danger" data-action="delAsset" data-id="${a.aset_id}"><i class="bi bi-trash3"></i> Hapus</button>`, a.nama)}</div>
      <div class="d-flex align-items-center gap-3">
        <div class="ring" style="--p:${i.pct};--size:88px"><div><b>${i.k}</b><small>dari ${i.n} bln</small></div></div>
        <div class="flex-grow-1" style="min-width:0">
          <div style="font-size:18px;font-weight:800">${esc(a.nama)}</div>
          <div class="tiny muted">${esc(ownerName(a.pemilik_id))} · kupon ${fmtN(a.kupon_persen)}%/thn · pajak ${fmtN(a.pajak_persen)}%</div>
          <div class="mt-1"><b>${nomText(a)}</b></div>
        </div>
      </div>
      <div class="kv mt-3">
        <div><small>Sudah berjalan</small><b>${i.k} bulan</b></div>
        <div><small>Sisa tenor</small><b>${i.left} bulan</b></div>
        <div><small>Kupon bersih</small><b>${fmtVal(i.net, 'Rp')}/bln</b></div>
        <div><small>Dana pokok kembali</small><b>${fmtDate(i.maturity)}</b></div>
      </div>
      <p class="tiny muted mt-3 mb-0"><i class="bi bi-arrow-return-right"></i> Kupon masuk ke: <b style="color:var(--text)">${g ? esc(g.judul) : 'tidak diarahkan ke tabungan'}</b>
        ${i.next && a.status === 'Aktif' ? ' · kupon berikutnya ' + fmtDate(i.next) : ''}<br>Total kupon sejak awal ±${fmtShort(i.received, 'Rp')}${i.posted ? ' · tercatat otomatis ' + fmtShort(i.posted, 'Rp') : ''}</p>
    </div>`;
  });
  const rowsA = `<div class="glist">${list.map(a => { const i = assetInfo(a); return finRow({ act: `data-action="editAsset" data-id="${a.aset_id}"`, raw: assetBadgeSvg(a, 44), title: a.nama, tint: (ASSET_BADGE[a.jenis] || ASSET_BADGE.Lainnya)[1], fg: (ASSET_BADGE[a.jenis] || ASSET_BADGE.Lainnya)[0],
    badge: a.status !== 'Aktif' ? `<span class="badge-s s-done" style="padding:2px 8px">${esc(a.status)}</span>` : '<span class="badge-s s-active" style="padding:2px 8px">Aktif</span>',
    sub: `${esc(a.jenis)} · ${isUsd(a) ? fmtUsd(a.nominal) + ' ≈ ' + fmtShort(nomRp(a), 'Rp') : fmtShort(a.nominal, 'Rp')} · ${isUsd(a) ? 'bunga' : 'kupon'} ${fmtShort(i.net, 'Rp')}/bln · ${i.k}/${i.n} bln`, pct: i.pct, right: Math.round(i.pct) + '%' }); }).join('')}</div>`;
  const u = utamaGoal();
  const kuponInfo = `<div class="rek-hint mb-3"><i class="bi bi-arrow-return-right"></i> ${u ? `Kupon baru otomatis masuk ke <b>${esc(u.judul)}</b> ★` : 'Belum ada rekening penerima kupon.'}
    <button class="link-btn" data-action="finTab" data-tab="rekening">${u ? 'Atur rekening' : 'Tambah rekening'}</button></div>`;
  const actA = S.assets.filter(a => a.status === 'Aktif');
  return `${finSumHead(`Total investasi aktif ${fmtVal(Math.round(actA.reduce((s, a) => s + nomRp(a), 0)), 'Rp')}`, `kupon bersih ${fmtVal(actA.reduce((s, a) => s + assetInfo(a).net, 0), 'Rp')}/bln`,
      'Catat SBN, Sukuk Ritel, ORI, ST, deposito, dll. Kupon bersih tiap bulan otomatis masuk ke rekening pilihan (diproses pukul 07.00 WITA pada tanggal kupon).',
      '<button class="btn btn-dark btn-sm" data-action="newAsset"><i class="bi bi-plus-lg"></i> Tambah Investasi</button>')}
    ${S.assets.some(isUsd) ? `<div class="mb-3">${kursInfoHtml()}</div>` : ''}${kuponInfo}
    ${list.length ? finLayout(cards, rowsA) : `<div class="card">${emptyHtml('bi-bank', 'Belum ada investasi tercatat.', '<button class="btn btn-dark btn-sm" data-action="newAsset">Tambah investasi pertama</button>')}</div>`}`;
}
function finLoansHtml() {
  const list = S.loans.slice().sort((a, b) => (loanInfo(a).done ? 1 : 0) - (loanInfo(b).done ? 1 : 0));
  const cards = list.map(l => {
    const i = loanInfo(l);
    return `<div class="card tint fin-note has-more" style="--c:#E8D3F5;--fg:#7E3FB3">
      <div class="tpl-row d-flex gap-2 align-items-center"><span class="chip tint" style="--c:#E8D3F5">${esc(l.pemberi)}</span>${cardMenuBtn(`${!i.done ? `<button data-action="loanLunas" data-id="${l.pinjaman_id}"><i class="bi bi-check2-circle"></i> Tandai lunas</button>` : ''}<button data-action="editLoan" data-id="${l.pinjaman_id}"><i class="bi bi-pencil"></i> Edit</button><button class="danger" data-action="delLoan" data-id="${l.pinjaman_id}"><i class="bi bi-trash3"></i> Hapus</button>`, l.nama)}</div>
      <div class="loan-grid">
        <div class="ring" style="--p:${i.pct};--size:88px"><div><b>${i.k}</b><small>dari ${i.n} bln</small></div></div>
        <div style="min-width:0;align-self:center">
          <div style="font-size:18px;font-weight:800">${esc(l.nama)}</div>
          <div class="tiny muted">${esc(ownerName(l.pemilik_id))} · ${esc(l.metode)}${Number(l.bunga_persen) ? ' ' + fmtN(l.bunga_persen) + '%/thn' : ''} · potong tgl ${esc(l.tgl_potong)}</div>
        </div>
        <div class="loan-st">${i.done ? '<span class="badge-s s-done">Lunas 🎉</span>' : '<span class="badge-s s-active">Berjalan</span>'}</div>
        <div class="loan-pk"><b>${fmtVal(l.pokok, 'Rp')}</b> <span class="muted tiny">pokok</span></div>
      </div>
      <div class="kv mt-3">
        <div><small>Cicilan</small><b>${fmtVal(i.c, 'Rp')}/bln</b></div>
        <div><small>Sisa pokok</small><b>${fmtShort(i.sisaPokok, 'Rp')}</b></div>
        <div><small>Sisa bayar</small><b>${i.left} × = ${fmtShort(i.sisaBayar, 'Rp')}</b></div>
        <div><small>Lunas</small><b>${fmtDate(i.lunas)}</b></div>
      </div>
    </div>`;
  });
  const rowsL = `<div class="glist">${list.map(l => { const i = loanInfo(l); return finRow({ act: `data-action="editLoan" data-id="${l.pinjaman_id}"`, ic: '💳', c: '#E8D3F5', title: l.nama,
    badge: i.done ? '<span class="badge-s s-done" style="padding:2px 8px">Lunas</span>' : '<span class="badge-s s-active" style="padding:2px 8px">Berjalan</span>',
    sub: `${esc(l.pemberi)} · ${fmtShort(i.c, 'Rp')}/bln · sisa ${fmtShort(i.sisaBayar, 'Rp')}`, pct: i.pct, right: i.k + '/' + i.n }); }).join('')}</div>`;
  const runL = S.loans.filter(l => l.status !== 'Lunas' && !loanInfo(l).done);
  return `${finSumHead(`Sisa cicilan ${fmtVal(runL.reduce((s, l) => s + loanInfo(l).sisaBayar, 0), 'Rp')}`, `${fmtVal(runL.reduce((s, l) => s + loanInfo(l).c, 0), 'Rp')}/bln`,
      'Cicilan yang dipotong otomatis dari gaji dihitung berdasarkan tanggal potong. Notifikasi muncul setiap kali cicilan terpotong.',
      '<button class="btn btn-dark btn-sm" data-action="newLoan"><i class="bi bi-plus-lg"></i> Tambah Pinjaman</button>')}
    ${list.length ? finLayout(cards, rowsL) : `<div class="card">${emptyHtml('bi-credit-card', 'Belum ada pinjaman tercatat.', '<button class="btn btn-dark btn-sm" data-action="newLoan">Tambah pinjaman</button>')}</div>`}`;
}

// ============================================================
// FORM: INVESTASI, PINJAMAN, TANGGAL PELAKSANAAN
// ============================================================
function ownerOptions(cur) {
  return `<option value="">Bersama</option>` + S.users.map(u => `<option value="${u.user_id}" ${cur === u.user_id ? 'selected' : ''}>${esc(u.nama)}</option>`).join('');
}
function openAssetForm(id) {
  const a = S.assets.find(x => x.aset_id === id) || { aset_id: uid(), nama: '', jenis: 'SR', pemilik_id: '', nominal: '', kupon_persen: '', pajak_persen: 10, tenor_bulan: 36, tgl_mulai: today(), tgl_kupon: 10, goal_tujuan_id: (utamaGoal() || {}).goal_id || '', status: 'Aktif', catatan: '' };
  const goals = rekList().concat(S.goals.filter(g => g.tipe_target === 'Finansial' && g.status !== 'Arsip'));
  openSheet(id ? 'Edit Investasi' : 'Investasi Baru 🏦', `
  <form data-form="asset" novalidate>
    <input type="hidden" name="aset_id" value="${esc(a.aset_id)}">
    <div class="grid-2">
      <label class="field"><span>Jenis</span><select name="jenis" data-change="assetJenis">${ASSET_TYPES.filter(t => t !== 'USD' || a.jenis === 'USD').map(t => `<option value="${t}" ${a.jenis === t ? 'selected' : ''}>${ASSET_LABEL[t] || t}</option>`).join('')}</select></label>
      <label class="field"><span>Seri / nama</span><input name="nama" maxlength="60" required value="${esc(a.nama)}" placeholder="mis. SR019"><em class="field-err"></em></label>
      <label class="field"><span id="nomLbl">${isUsd(a) ? 'Saldo (USD)' : 'Nominal (Rp)'}</span><input name="nominal" inputmode="decimal" ${isUsd(a) ? '' : 'data-money'} data-input="assetCalc" value="${a.nominal ? (isUsd(a) ? Number(a.nominal).toLocaleString('id-ID', { maximumFractionDigits: 2 }) : fmtN(a.nominal)) : ''}" placeholder="${isUsd(a) ? '1.500' : '50.000.000'}"><em class="field-err"></em></label>
      <label class="field"><span>Kupon / bunga per tahun (%)</span><input name="kupon_persen" inputmode="decimal" data-input="assetCalc" value="${esc(a.kupon_persen)}" placeholder="5"><em class="field-err"></em></label>
      <label class="field"><span>Tenor (bulan)</span><input name="tenor_bulan" type="number" min="1" max="600" data-input="assetCalc" value="${esc(a.tenor_bulan)}"></label>
      <label class="field"><span>Pajak kupon (%)</span><input name="pajak_persen" inputmode="decimal" data-input="assetCalc" value="${esc(a.pajak_persen)}"></label>
      <label class="field"><span>Tanggal mulai (setelmen)</span><input type="date" name="tgl_mulai" data-change="assetCalc" value="${esc(a.tgl_mulai)}"></label>
      <label class="field"><span>Kupon dibayar tiap tanggal</span><input name="tgl_kupon" type="number" min="1" max="31" data-input="assetCalc" value="${esc(a.tgl_kupon)}"></label>
    </div>
    <div id="kursBox" class="mb-3" ${isUsd(a) ? '' : 'hidden'}>${kursInfoHtml()}<small class="d-block muted mt-1">Bunga dolar dikonversi ke Rupiah dengan kurs ini saat dicatat ke tabungan.</small></div>
    <label class="field"><span>Kupon bulanan masuk ke rekening / tabungan</span><select name="goal_tujuan_id"><option value="">— tidak diarahkan —</option>${goals.map(g => `<option value="${g.goal_id}" ${a.goal_tujuan_id === g.goal_id ? 'selected' : ''}>${isRek(g) ? esc(rekJenis(g)) + ' · ' : ''}${esc(g.judul)}${parseMeta(g.meta).utama ? ' ★' : ''}</option>`).join('')}</select>
      <small>Setiap tanggal kupon, kupon bersih otomatis dicatat sebagai setoran ke tabungan ini.</small></label>
    <div class="grid-2">
      <label class="field"><span>Pemilik</span><select name="pemilik_id">${ownerOptions(a.pemilik_id)}</select></label>
      ${id ? `<label class="field"><span>Status</span><select name="status">${['Aktif', 'Jatuh Tempo', 'Dicairkan'].map(s => `<option ${a.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select></label>` : '<input type="hidden" name="status" value="Aktif">'}
    </div>
    <label class="field"><span>Catatan <small>(opsional)</small></span><input name="catatan" maxlength="300" value="${esc(a.catatan)}"></label>
    <div class="card" style="box-shadow:none;background:var(--soft)"><p class="mb-0 tiny fw-bold" id="assetPreview"></p></div>
    <div class="sheet-foot"><button type="button" class="btn btn-soft" data-action="closeSheet">Batal</button><button class="btn btn-dark" type="submit">Simpan</button></div>
  </form>`);
  assetPreview($('#sheet form'));
}
function assetFromForm(f) {
  return {
    aset_id: f.aset_id.value, nama: f.nama.value.trim(), jenis: f.jenis.value, pemilik_id: f.pemilik_id.value,
    nominal: f.jenis.value === 'USD' ? parseUsd(f.nominal.value) : parseNum(f.nominal.value, true), kupon_persen: parseNum(f.kupon_persen.value), pajak_persen: parseNum(f.pajak_persen.value),
    tenor_bulan: parseInt(f.tenor_bulan.value, 10) || 0, tgl_mulai: f.tgl_mulai.value, tgl_kupon: parseInt(f.tgl_kupon.value, 10) || 1,
    goal_tujuan_id: f.goal_tujuan_id.value, status: f.status.value, catatan: f.catatan.value.trim()
  };
}
function assetPreview(f) {
  const el = $('#assetPreview');
  if (!el || !f) return;
  const a = assetFromForm(f);
  if (!(a.nominal > 0) || !(a.tenor_bulan > 0) || !a.tgl_mulai) { el.textContent = 'Isi nominal, kupon, tenor & tanggal untuk melihat perhitungan.'; return; }
  const i = assetInfo(a);
  el.textContent = `${isUsd(a) ? `Saldo ${fmtUsd(a.nominal)} ≈ ${fmtVal(nomRp(a), 'Rp')} · bunga bersih ±${fmtUsd(Math.round(i.net / kursUsd() * 100) / 100)} (≈ ${fmtVal(i.net, 'Rp')})/bln` : `Kupon bersih ±${fmtVal(i.net, 'Rp')}/bln`} · sudah berjalan ${i.k} dari ${i.n} bulan · dana pokok kembali ${fmtDate(i.maturity)}`;
}
function submitAsset(f) {
  const a = assetFromForm(f);
  const err = (name, msg) => { const fe = f[name].closest('.field'); fe.classList.add('invalid'); fe.querySelector('.field-err').textContent = msg; return false; };
  let ok = true;
  if (!a.nama) ok = err('nama', 'Isi seri/nama, mis. SR019.');
  if (!(a.nominal > 0)) ok = err('nominal', 'Isi nominal.');
  if (!(a.kupon_persen >= 0) || f.kupon_persen.value.trim() === '') ok = err('kupon_persen', 'Isi persen kupon.');
  if (!(a.tenor_bulan > 0) || !a.tgl_mulai) { toast('Tenor dan tanggal mulai wajib diisi.', 'error'); ok = false; }
  if (!ok) return;
  const ex = S.assets.find(x => x.aset_id === a.aset_id);
  if (ex) Object.assign(ex, a, { diubah_pada: nowIso() }); else S.assets.push(Object.assign({ dibuat_pada: nowIso(), diubah_pada: nowIso() }, a));
  saveSnapshot(); closeSheet(); S.ui.finTab = 'investasi'; navigateTo('finance', { noHistory: S.ui.page === 'finance' });
  toast('Investasi disimpan 🏦');
  Outbox.push('saveAsset', [a]);
}
function openLoanForm(id) {
  const l = S.loans.find(x => x.pinjaman_id === id) || { pinjaman_id: uid(), nama: 'Pinjaman Kantor', pemberi: 'Perusahaan', pemilik_id: S.me.user_id, pokok: '', bunga_persen: 0, metode: 'Tanpa bunga', tenor_bulan: 24, cicilan: '', tgl_mulai: addMonthsDay(today(), 1, 25), tgl_potong: 25, status: 'Berjalan', catatan: '' };
  openSheet(id ? 'Edit Pinjaman' : 'Pinjaman Baru 💳', `
  <form data-form="loan" novalidate>
    <input type="hidden" name="pinjaman_id" value="${esc(l.pinjaman_id)}">
    <div class="grid-2">
      <label class="field"><span>Nama pinjaman</span><input name="nama" maxlength="60" required value="${esc(l.nama)}"><em class="field-err"></em></label>
      <label class="field"><span>Pemberi pinjaman</span><input name="pemberi" maxlength="60" value="${esc(l.pemberi)}"></label>
      <label class="field"><span>Pokok pinjaman (Rp)</span><input name="pokok" inputmode="numeric" data-money data-input="loanCalc" value="${l.pokok ? fmtN(l.pokok) : ''}" placeholder="30.000.000"><em class="field-err"></em></label>
      <label class="field"><span>Tenor (bulan)</span><input name="tenor_bulan" type="number" min="1" max="600" data-input="loanCalc" value="${esc(l.tenor_bulan)}"></label>
      <label class="field"><span>Metode bunga</span><select name="metode" data-change="loanCalc">${LOAN_METODE.map(m => `<option ${l.metode === m ? 'selected' : ''}>${m}</option>`).join('')}</select></label>
      <label class="field"><span>Bunga per tahun (%)</span><input name="bunga_persen" inputmode="decimal" data-input="loanCalc" value="${esc(l.bunga_persen)}"></label>
      <label class="field"><span>Potongan pertama</span><input type="date" name="tgl_mulai" data-change="loanCalc" value="${esc(l.tgl_mulai)}"></label>
      <label class="field"><span>Dipotong tiap tanggal</span><input name="tgl_potong" type="number" min="1" max="31" data-input="loanCalc" value="${esc(l.tgl_potong)}"></label>
    </div>
    <label class="field"><span>Cicilan per bulan (Rp) <small>(kosongkan = dihitung otomatis)</small></span><input name="cicilan" inputmode="numeric" data-money data-input="loanCalc" value="${l.cicilan ? fmtN(l.cicilan) : ''}"></label>
    <div class="grid-2">
      <label class="field"><span>Atas nama</span><select name="pemilik_id">${ownerOptions(l.pemilik_id)}</select></label>
      ${id ? `<label class="field"><span>Status</span><select name="status">${['Berjalan', 'Lunas'].map(s => `<option ${l.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select></label>` : '<input type="hidden" name="status" value="Berjalan">'}
    </div>
    <label class="field"><span>Catatan <small>(opsional)</small></span><input name="catatan" maxlength="300" value="${esc(l.catatan)}"></label>
    <div class="card" style="box-shadow:none;background:var(--soft)"><p class="mb-0 tiny fw-bold" id="loanPreview"></p></div>
    <div class="sheet-foot"><button type="button" class="btn btn-soft" data-action="closeSheet">Batal</button><button class="btn btn-dark" type="submit">Simpan</button></div>
  </form>`);
  loanPreview($('#sheet form'));
}
function loanFromForm(f) {
  return {
    pinjaman_id: f.pinjaman_id.value, nama: f.nama.value.trim(), pemberi: f.pemberi.value.trim() || 'Perusahaan', pemilik_id: f.pemilik_id.value,
    pokok: parseNum(f.pokok.value, true), bunga_persen: parseNum(f.bunga_persen.value), metode: f.metode.value,
    tenor_bulan: parseInt(f.tenor_bulan.value, 10) || 0, cicilan: parseNum(f.cicilan.value, true),
    tgl_mulai: f.tgl_mulai.value, tgl_potong: parseInt(f.tgl_potong.value, 10) || 1, status: f.status.value, catatan: f.catatan.value.trim()
  };
}
function loanPreview(f) {
  const el = $('#loanPreview');
  if (!el || !f) return;
  const l = loanFromForm(f);
  if (!(l.pokok > 0) || !(l.tenor_bulan > 0) || !l.tgl_mulai) { el.textContent = 'Isi pokok, tenor & potongan pertama untuk melihat perhitungan.'; return; }
  const i = loanInfo(l);
  el.textContent = `Cicilan ${fmtVal(i.c, 'Rp')}/bln · sudah terpotong ${i.k} dari ${i.n} kali · lunas ${fmtDate(i.lunas)} · total bayar ${fmtShort(i.c * i.n, 'Rp')}`;
}
function submitLoan(f) {
  const l = loanFromForm(f);
  const err = (name, msg) => { const fe = f[name].closest('.field'); fe.classList.add('invalid'); fe.querySelector('.field-err').textContent = msg; return false; };
  let ok = true;
  if (!l.nama) ok = err('nama', 'Isi nama pinjaman.');
  if (!(l.pokok > 0)) ok = err('pokok', 'Isi pokok pinjaman.');
  if (!(l.tenor_bulan > 0) || !l.tgl_mulai) { toast('Tenor dan potongan pertama wajib diisi.', 'error'); ok = false; }
  if (!ok) return;
  if (!l.cicilan) l.cicilan = loanCalc(l.pokok, l.bunga_persen, l.tenor_bulan, l.metode);
  const ex = S.loans.find(x => x.pinjaman_id === l.pinjaman_id);
  if (ex) Object.assign(ex, l, { diubah_pada: nowIso() }); else S.loans.push(Object.assign({ dibuat_pada: nowIso(), diubah_pada: nowIso() }, l));
  saveSnapshot(); closeSheet(); S.ui.finTab = 'pinjaman'; navigateTo('finance', { noHistory: S.ui.page === 'finance' });
  toast('Pinjaman disimpan 💳');
  Outbox.push('saveLoan', [l]);
}
function goalPayload(g) {
  const keys = ['goal_id', 'judul', 'deskripsi', 'kategori_id', 'jenis', 'visibilitas', 'tipe_target', 'nilai_target', 'satuan', 'tgl_mulai', 'tenggat', 'prioritas', 'ikon', 'warna', 'tgl_pelaksanaan', 'template', 'meta'];
  const o = {};
  keys.forEach(k => { o[k] = g[k] === undefined ? '' : g[k]; });
  return o;
}
function openExecForm(id) {
  const g = goalById(id);
  if (!g) return;
  const m = parseMeta(g.meta);
  openSheet('Tanggal Pelaksanaan 🗓️', `
  <form data-form="execDate"><input type="hidden" name="goal_id" value="${g.goal_id}">
    <p class="muted">${esc(g.judul)}${m.tujuan ? ' — ' + esc(m.tujuan) : ''}</p>
    <label class="field"><span>Tanggal berangkat / pelaksanaan</span><input type="date" name="tgl" required value="${esc(g.tgl_pelaksanaan || addDays(today(), 30))}"></label>
    <div class="sheet-foot">${g.tgl_pelaksanaan ? '<button type="button" class="btn btn-soft" data-action="execClear" data-id="' + g.goal_id + '">Hapus tanggal</button>' : '<button type="button" class="btn btn-soft" data-action="closeSheet">Batal</button>'}<button class="btn btn-dark" type="submit">Simpan</button></div>
  </form>`);
}
function setExecDate(id, val) {
  const g = goalById(id);
  if (!g) return;
  g.tgl_pelaksanaan = val;
  saveSnapshot(); closeSheet(); renderAll();
  toast(val ? 'Tanggal pelaksanaan: ' + fmtDate(val) + ' 🎉' : 'Tanggal pelaksanaan dihapus');
  Outbox.push('saveGoal', [goalPayload(g), msOf(g.goal_id).map(x => ({ milestone_id: x.milestone_id, judul: x.judul, nilai_target: x.nilai_target }))]);
}

// ── Ekspor ──
function assetRowsExport() {
  return S.assets.map(a => {
    const i = assetInfo(a);
    return { 'Jenis': a.jenis, 'Seri': a.nama, 'Pemilik': ownerName(a.pemilik_id), 'Nominal (Rp)': Math.round(nomRp(a)), 'Nominal asli': isUsd(a) ? fmtUsd(a.nominal) : '', 'Kupon (%/thn)': Number(a.kupon_persen), 'Pajak (%)': Number(a.pajak_persen),
      'Tenor (bln)': i.n, 'Sudah berjalan (bln)': i.k, 'Sisa (bln)': i.left, 'Kupon bersih/bln (Rp)': i.net, 'Mulai': a.tgl_mulai, 'Jatuh tempo': i.maturity,
      'Kupon ke tabungan': (goalById(a.goal_tujuan_id) || {}).judul || '-', 'Status': a.status };
  });
}
function loanRowsExport() {
  return S.loans.map(l => {
    const i = loanInfo(l);
    return { 'Pinjaman': l.nama, 'Pemberi': l.pemberi, 'Atas nama': ownerName(l.pemilik_id), 'Pokok (Rp)': Number(l.pokok), 'Metode': l.metode, 'Bunga (%/thn)': Number(l.bunga_persen),
      'Tenor (bln)': i.n, 'Sudah dibayar (bln)': i.k, 'Cicilan/bln (Rp)': i.c, 'Sisa pokok (Rp)': i.sisaPokok, 'Sisa bayar (Rp)': i.sisaBayar, 'Lunas': i.lunas, 'Status': i.done ? 'Lunas' : 'Berjalan' };
  });
}

// ── Daftarkan aksi, form & input modul keuangan ──
Object.assign(Actions, {
  finTab: d => { S.ui.finTab = d.tab; renderFinance(); },
  finStat: d => { S.ui.finTab = d.tab; renderFinance();
    const t = document.querySelector('#page-finance .fin-tabbar'); if (t && t.getBoundingClientRect().top > innerHeight * .6) t.scrollIntoView({ behavior: 'smooth', block: 'start' }); },
  finView: d => { const t = S.ui.finTab || 'tabungan'; S.ui.finViews = S.ui.finViews || {}; S.ui.finViews[t] = d.view; lsSet('gt_finview_' + t, d.view); renderFinance(); },
  tplPick: d => tplPick(d.tpl || ''),
  newAsset: () => openAssetForm(),
  utamaBuat: () => {
    const ada = S.assets.some(a => a.status === 'Aktif');
    const go = arahkan => { createUtama(arahkan); renderAll(); toast('Tabungan Utama dibuat 🏦' + (arahkan ? ' — kupon investasi diarahkan ke sini' : '')); };
    if (!ada) return go(false);
    confirmBox({ title: 'Arahkan kupon ke Tabungan Utama?', text: 'Kupon semua investasi aktif akan masuk ke Tabungan Utama mulai kupon berikutnya. Setoran yang sudah tercatat di tabungan lain tidak berubah.', ok: 'Ya, arahkan' }, () => { closeSheet(); go(true); });
  },
  utamaArahkan: () => { const g = utamaGoal(); if (g) { arahkanKupon(g.goal_id); renderAll(); } },
  rekBaru: () => openRekForm(),
  rekHapus: d => { const g = goalById(d.id); if (!g) return;
    const linked = S.assets.filter(a => a.goal_tujuan_id === g.goal_id);
    const main = !!parseMeta(g.meta).utama;
    confirmBox({ title: `Hapus rekening "${g.judul}"?`, text: `Saldo dan seluruh riwayat setor/tarik rekening ini ikut terhapus permanen.${linked.length ? ` ${linked.length} investasi yang mengirim kupon ke sini akan dilepas (tidak diarahkan) — atur ulang tujuan kuponnya nanti.` : ''}`, ok: 'Hapus permanen', danger: true }, () => {
      const id = g.goal_id;
      closeSheet();
      S.rekening = (S.rekening || []).filter(x => x.goal_id !== id);
      ['logs', 'achievements', 'reactions', 'notifications'].forEach(k => { S[k] = S[k].filter(x => x.goal_id !== id); });
      linked.forEach(a => { a.goal_tujuan_id = ''; a.diubah_pada = nowIso(); Outbox.push('saveAsset', [Object.assign({}, a)]); });
      Outbox.push('deleteGoal', [id]);
      const next = main && rekList()[0];
      if (next) setUtama_(next.goal_id);
      saveSnapshot(); renderAll();
      toast(`Rekening dihapus${next ? ` — penerima kupon utama kini ${next.judul}` : ''}`);
    }); },
  rekLogDel: d => { const l = S.logs.find(x => x.log_id === d.id); if (!l) return; const r = goalById(l.goal_id);
    const pr = logPair_(l), pg = pr && pr.user_id === S.me.user_id && goalById(pr.goal_id);
    confirmBox({ title: 'Hapus transaksi ini?', text: `Saldo ${r ? r.judul : 'rekening'}${pg ? ' dan ' + pg.judul : ''} akan ${Number(l.nilai_tambah) >= 0 ? 'dikurangi' : 'ditambah'} ${fmtVal(Math.abs(Number(l.nilai_tambah)), 'Rp')}.`, ok: 'Hapus', danger: true }, () => {
      hapusLogBerpasangan_(l.log_id);
      if (r) Actions.rekHist({ id: r.goal_id });
    }); },
  rekHist: d => { const g = goalById(d.id); if (!g) return;
    const logs = S.logs.filter(l => l.goal_id === g.goal_id).sort((a, b) => String(b.tanggal + b.dibuat_pada).localeCompare(String(a.tanggal + a.dibuat_pada)));
    openSheet(`Riwayat — ${esc(g.judul)}`, `<div class="rek-hist">${logs.length ? logs.map(l => `<div class="rek-hist-row"><div><b>${fmtDate(l.tanggal)}</b><small class="d-block muted">${esc(l.catatan || (Number(l.nilai_tambah) >= 0 ? 'Setoran' : 'Penarikan'))} · ${esc(userById(l.user_id).nama || '')}</small></div>
      <span class="d-flex align-items-center gap-2"><b style="color:${Number(l.nilai_tambah) >= 0 ? 'var(--green-ink,#1B7F3A)' : 'var(--red-ink)'}">${Number(l.nilai_tambah) >= 0 ? '+' : '−'}${fmtVal(Math.abs(Number(l.nilai_tambah)), 'Rp')}</b>${l.user_id === S.me.user_id ? `<button class="icon-btn sm ghost" data-action="rekLogDel" data-id="${l.log_id}" title="Hapus transaksi" aria-label="Hapus transaksi"><i class="bi bi-trash3"></i></button>` : ''}</span></div>`).join('') : emptyHtml('bi-clock-history', 'Belum ada transaksi.')}</div>
      <div class="sheet-foot"><button type="button" class="btn btn-dark w-100" data-action="closeSheet">Tutup</button></div>`); },
  usdTx: d => { const g = goalById(d.id); if (!g) return;
    openSheet(`Setor / tarik — ${esc(g.judul)}`, `<form data-form="usdTx" novalidate><input type="hidden" name="goal_id" value="${g.goal_id}">
      <div class="seg mb-3"><label><input type="radio" name="arah" value="1" checked><span><i class="bi bi-plus-lg"></i> Setor</span></label><label><input type="radio" name="arah" value="-1"><span><i class="bi bi-dash-lg"></i> Tarik</span></label></div>
      <label class="field"><span>Jumlah (USD)</span><input name="usd" inputmode="decimal" placeholder="100" data-input="usdTxCalc"><em class="field-err"></em><small id="usdTxRp">Saldo sekarang ${fmtUsd(rekUsd(g))}</small></label>
      <div class="mb-3">${kursInfoHtml()}</div>
      <label class="field"><span>Catatan <small>(opsional)</small></span><input name="catatan" maxlength="120" placeholder="mis. Beli dolar di teller"></label>
      <div class="sheet-foot"><button type="button" class="btn btn-soft" data-action="closeSheet">Batal</button><button class="btn btn-dark" type="submit">Simpan</button></div></form>`); },
  rekEdit: d => openRekForm(d.id),
  rekArsip: d => { const g = goalById(d.id); if (!g) return;
    confirmBox({ title: `Arsipkan "${g.judul}"?`, text: 'Rekening disembunyikan dari daftar. Riwayat saldonya tetap tersimpan dan bisa dibuka dari Goals (filter Diarsipkan).', ok: 'Arsipkan' }, () => {
      closeSheet(); g.status = 'Arsip'; saveSnapshot(); renderAll(); Outbox.push('setGoalArchived', [g.goal_id, true]); toast('Rekening diarsipkan'); }); },
  editAsset: d => openAssetForm(d.id),
  kursRefresh: (d, el) => {
    setBusy(el, true);
    api('saveKursUsd', S.token, 0).then(p => { applyPayload(p); const s = S.settings || {};
      toast(`Kurs dolar: ${fmtVal(Number(s.kurs_USD), 'Rp')}/USD${s.kurs_USD_sumber ? ' · ' + s.kurs_USD_sumber : ''}`); })
      .catch(e => { setBusy(el, false); toast(e.message || 'Gagal mengambil kurs dolar.', 'error'); });
  },
  kursEdit: () => {
    const s = S.settings || {};
    openSheet('Kurs Dolar (USD → Rp)', `<form data-form="kurs" novalidate>
      <p class="tiny muted">Saat ini ${fmtVal(kursUsd(), 'Rp')}/USD${s.kurs_USD_src === 'manual' ? ' (diatur manual)' : ' (otomatis' + (s.kurs_USD_sumber ? ' dari ' + esc(s.kurs_USD_sumber) : '') + ', diperbarui tiap jam saat aplikasi dibuka)'}.</p>
      <label class="field"><span>Kurs manual (Rp per 1 USD)</span><input name="kurs" inputmode="numeric" data-money placeholder="${fmtN(kursUsd())}"><small>Kosongkan lalu Simpan untuk kembali ke kurs otomatis.</small></label>
      <div class="sheet-foot"><button type="button" class="btn btn-soft" data-action="closeSheet">Batal</button><button class="btn btn-dark" type="submit">Simpan</button></div></form>`);
  },
  delAsset: d => confirmBox({ title: 'Hapus investasi ini?', text: 'Catatan investasi & riwayat kupon otomatisnya dihapus. Setoran yang sudah masuk ke tabungan tetap ada.', ok: 'Hapus', danger: true }, () => {
    S.assets = S.assets.filter(x => x.aset_id !== d.id); S.assetIncome = S.assetIncome.filter(x => x.aset_id !== d.id);
    saveSnapshot(); renderAll(); toast('Investasi dihapus'); Outbox.push('deleteAsset', [d.id]);
  }),
  newLoan: () => openLoanForm(),
  editLoan: d => openLoanForm(d.id),
  delLoan: d => confirmBox({ title: 'Hapus pinjaman ini?', text: 'Data pinjaman akan dihapus permanen.', ok: 'Hapus', danger: true }, () => {
    S.loans = S.loans.filter(x => x.pinjaman_id !== d.id); saveSnapshot(); renderAll(); toast('Pinjaman dihapus'); Outbox.push('deleteLoan', [d.id]);
  }),
  loanLunas: d => confirmBox({ title: 'Tandai pinjaman lunas?', text: 'Gunakan bila pinjaman dilunasi lebih cepat.', ok: 'Ya, lunas' }, () => {
    const l = S.loans.find(x => x.pinjaman_id === d.id);
    if (!l) return;
    l.status = 'Lunas'; saveSnapshot(); renderAll(); showCelebration({ emoji: '🎉', title: 'Pinjaman lunas!', text: l.nama + ' sudah lunas. Hebat!' });
    Outbox.push('saveLoan', [Object.assign({}, l)]);
  }),
  execDate: d => openExecForm(d.id),
  execClear: d => setExecDate(d.id, '')
});
const _navOrig = Actions.nav;
Actions.nav = (d, el, e) => { if (d.fintab) S.ui.finTab = d.fintab; _navOrig(d, el, e); };
Object.assign(Changes, {
  assetJenis: el => {
    const f = el.form, usd = el.value === 'USD';
    $('#nomLbl', f).textContent = usd ? 'Saldo (USD)' : 'Nominal (Rp)';
    const n = f.nominal; if (usd) n.removeAttribute('data-money'); else n.setAttribute('data-money', '');
    n.placeholder = usd ? '1.500' : '50.000.000'; n.value = '';
    $('#kursBox', f).hidden = !usd;
    if (usd) { f.pajak_persen.value = 20; if (Number(f.tenor_bulan.value) < 60) f.tenor_bulan.value = 120; if (!f.nama.value) f.nama.value = 'Tabungan Dolar'; }
    assetPreview(f);
  },
  rekJenis: el => { const f = el.form, usd = el.value === 'Dolar'; $$('input[name=jenis]', f).forEach(x => x.closest('label').classList.toggle('on', x.checked)); f.nama.placeholder = REK_JENIS[el.value].ph;
    $('#rekKurs', f).hidden = !usd;
    if (f.saldo) { $('#rekSaldoLbl', f).innerHTML = `Saldo saat ini (${usd ? 'USD' : 'Rp'}) <small>(opsional)</small>`; if (usd) f.saldo.removeAttribute('data-money'); else f.saldo.setAttribute('data-money', ''); f.saldo.value = ''; } },
  tplCalc: el => recalcTpl(el.form),
  assetCalc: el => assetPreview(el.form),
  loanCalc: el => loanPreview(el.form)
});
Object.assign(Inputs, {
  usdTxCalc: el => { const f = el.form, g = goalById(f.goal_id.value), v = parseUsd(el.value); if (!g) return;
    $('#usdTxRp', f).textContent = v > 0 ? `≈ ${fmtVal(Math.round(v * kursUsd()), 'Rp')} · saldo sekarang ${fmtUsd(rekUsd(g))}` : `Saldo sekarang ${fmtUsd(rekUsd(g))}`; },
  tplCalc: debounce(el => recalcTpl(el.form), 150),
  assetCalc: debounce(el => assetPreview(el.form), 150),
  loanCalc: debounce(el => loanPreview(el.form), 150)
});
Object.assign(Forms, {
  usdTx: f => {
    const g = goalById(f.goal_id.value); if (!g) return;
    const arah = Number((f.querySelector('input[name=arah]:checked') || {}).value || 1);
    const usd = parseUsd(f.usd.value);
    const bad = msg => { const fd = f.usd.closest('.field'); fd.classList.add('invalid'); fd.querySelector('.field-err').textContent = msg; };
    if (!(usd > 0)) return bad('Isi jumlah dolar.');
    if (arah < 0 && usd > rekUsd(g) + 1e-9) return bad(`Saldo hanya ${fmtUsd(rekUsd(g))}.`);
    const k = kursUsd(), rp = Math.round(usd * k) * arah, t = today();
    const m = parseMeta(g.meta); m.usd = Math.round((rekUsd(g) + usd * arah) * 100) / 100;
    g.meta = JSON.stringify(m); g.diubah_pada = nowIso();
    const cat = `${arah > 0 ? 'Setor' : 'Tarik'} ${fmtUsd(usd)} @ ${fmtVal(k, 'Rp')}${f.catatan.value.trim() ? ' · ' + f.catatan.value.trim() : ''}`;
    const log = { log_id: uid(), goal_id: g.goal_id, tanggal: t, user_id: S.me.user_id, nilai_tambah: rp, catatan: cat, foto_url: '', dibuat_pada: nowIso() };
    S.logs.push(log); g.nilai_saat_ini = Math.max(0, Number(g.nilai_saat_ini) + rp); syncStatusLocal(g);
    saveSnapshot(); closeSheet(); renderAll(); toast(`${arah > 0 ? '+' : '−'}${fmtUsd(usd)} tercatat`);
    Outbox.push('saveGoal', goalSaveArgs_(g));
    Outbox.push('addProgress', [{ log_id: log.log_id, goal_id: g.goal_id, nilai_tambah: rp, catatan: cat, tanggal: t }, null]);
  },
  kurs: f => {
    const n = parseNum(f.kurs.value, true);
    if (n && (n < 1000 || n > 100000)) { toast('Kurs tidak wajar.', 'error'); return; }
    if (n) Object.assign(S.settings, { kurs_USD: n, kurs_USD_src: 'manual', kurs_USD_tgl: today() }); else S.settings.kurs_USD_src = 'auto';
    saveSnapshot(); closeSheet(); renderAll(); toast(n ? 'Kurs disimpan' : 'Kurs kembali otomatis — diperbarui dari server');
    Outbox.push('saveKursUsd', [n || 0]);
  },
  rekening: f => submitRek(f),
  asset: f => submitAsset(f),
  loan: f => submitLoan(f),
  execDate: f => { if (f.tgl.value) setExecDate(f.goal_id.value, f.tgl.value); }
});

// ── Mulai aplikasi (setelah semua modul dimuat) ──
window.GT = { S, Outbox, navigateTo, renderAll };
window.__GT_PARTS = (window.__GT_PARTS || []).concat('JS5');
/* ---------- Slider kartu horizontal (Goal Bersama, dll) ---------- */
function sliderSync(sc) {
  const box = sc.closest('.slider'); if (!box) return;
  const max = sc.scrollWidth - sc.clientWidth;
  const pv = box.querySelector('.prev'), nx = box.querySelector('.next');
  if (pv) pv.hidden = sc.scrollLeft <= 4;
  if (nx) nx.hidden = sc.scrollLeft >= max - 4;
  let dots = box.nextElementSibling && box.nextElementSibling.classList.contains('slide-dots') ? box.nextElementSibling : null;
  const n = sc.children.length;
  if (max <= 4 || n < 2) { if (dots) dots.remove(); return; }
  if (!dots) { dots = document.createElement('div'); dots.className = 'slide-dots'; dots.setAttribute('aria-hidden', 'true'); box.after(dots); }
  if (dots.children.length !== n) dots.innerHTML = '<span></span>'.repeat(n);
  const step = sc.children[1].offsetLeft - sc.children[0].offsetLeft || 1;
  const idx = sc.scrollLeft >= max - 4 ? n - 1 : Math.round(sc.scrollLeft / step);
  [...dots.children].forEach((d, i) => d.classList.toggle('on', i === idx));
}
function slidersSyncAll() { document.querySelectorAll('.slider .hscroll').forEach(sliderSync); }
document.addEventListener('click', e => {
  const b = e.target.closest('[data-slide]'); if (!b) return;
  e.preventDefault(); e.stopPropagation();
  const sc = b.closest('.slider').querySelector('.hscroll');
  const card = sc.children[0]; const step = card ? card.getBoundingClientRect().width + 16 : sc.clientWidth * .8;
  sc.scrollBy({ left: Number(b.dataset.slide) * step, behavior: 'smooth' });
}, true);
document.addEventListener('scroll', e => { if (e.target.classList && e.target.classList.contains('hscroll')) sliderSync(e.target); }, true);
window.addEventListener('resize', slidersSyncAll);
new MutationObserver(() => requestAnimationFrame(slidersSyncAll)).observe(document.body, { childList: true, subtree: true });
/* Geser dengan mouse (drag) di laptop */
(function () {
  let sc = null, x0 = 0, s0 = 0, moved = false;
  document.addEventListener('pointerdown', e => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    const t = e.target.closest('.slider .hscroll'); if (!t) return;
    sc = t; x0 = e.clientX; s0 = t.scrollLeft; moved = false;
  });
  document.addEventListener('pointermove', e => {
    if (!sc) return; const dx = e.clientX - x0;
    if (!moved && Math.abs(dx) > 6) { moved = true; sc.classList.add('dragging'); }
    if (moved) sc.scrollLeft = s0 - dx;
  });
  document.addEventListener('pointerup', () => {
    if (!sc) return; const t = sc; sc = null;
    if (moved) { t.classList.remove('dragging'); const blk = ev => { ev.stopPropagation(); ev.preventDefault(); }; document.addEventListener('click', blk, { capture: true, once: true }); setTimeout(() => document.removeEventListener('click', blk, true), 50); }
  });
})();

/* Angka besar di kartu ringkasan: kecilkan otomatis agar selalu muat di dalam kotak */
function fitStats(root) {
  (root || document).querySelectorAll('.stats').forEach(row => {
    const bs = [...row.querySelectorAll('.stat b')];
    let min = Infinity;
    bs.forEach(b => {
      b.style.fontSize = '';
      const max = b.parentElement.clientWidth - 20;
      if (max <= 0) return;
      let fs = parseFloat(getComputedStyle(b).fontSize);
      while (b.scrollWidth > max && fs > 14) { fs -= 1; b.style.fontSize = fs + 'px'; }
      min = Math.min(min, fs);
    });
    if (min < Infinity) bs.forEach(b => { b.style.fontSize = min + 'px'; });   // semua angka satu ukuran agar proporsional
  });
}
window.addEventListener('resize', () => fitStats());
/* Semua halaman: render ulang tidak mengembalikan baris geser (kartu ringkasan, tab, chip) ke posisi awal */
function withRows_(root, fn) {
  return function () {
    const sel = '.chips, .tabs, .hscroll, .stats, .jenis-scroll, .table-wrap';
    const r0 = document.querySelector(root);
    const pos = r0 ? [...r0.querySelectorAll(sel)].map(e => e.scrollLeft) : [];
    const out = fn.apply(this, arguments);
    const r1 = document.querySelector(root);
    if (r1 && pos.length) [...r1.querySelectorAll(sel)].forEach((e, i) => { if (pos[i]) e.scrollLeft = pos[i]; });
    if (r1) fitStats(r1);
    return out;
  };
}
renderFinance = withRows_('#page-finance', renderFinance);
renderDashboard = withRows_('#page-dashboard', renderDashboard);
renderGoals = withRows_('#page-goals', renderGoals);
renderDetail = withRows_('#page-detail', renderDetail);
renderReports = withRows_('#page-reports', renderReports);

// ============================================================
// PENGATURAN: TEMPLATE GOAL (tambah / edit / hapus)
// ============================================================
const TIPE_LBL = { Finansial: 'Tabungan (Rp)', Angka: 'Angka', Checklist: 'Checklist', Kebiasaan: 'Kebiasaan' };
function tplSettingsCard() {
  const list = Object.keys(TPL);
  const rows = list.map(k => { const t = TPL[k];
    const sub = t.base ? 'Bawaan · kalkulator otomatis' : `${TIPE_LBL[t.tipe] || t.tipe}${t.target && t.tipe !== 'Checklist' ? ' · ' + (t.tipe === 'Finansial' ? fmtShort(t.target, 'Rp') : fmtN(t.target) + ' ' + esc(t.satuan || '')) : ''}${t.tugas && t.tugas.length ? ' · ' + t.tugas.length + (t.tipe === 'Checklist' ? ' tugas' : ' tahapan') : ''}`;
    return `<div class="cat-item">${tplIc(k, 'ic tint')}<span class="flex-grow-1" style="min-width:0"><b class="d-block">${esc(t.label)}</b><small class="muted tiny">${sub}</small></span>
      <span class="d-flex gap-1"><button class="icon-btn sm" data-action="tplEdit" data-id="${esc(k)}" aria-label="Edit ${esc(t.label)}"><i class="bi bi-pencil"></i></button>
      <button class="icon-btn sm" data-action="tplDelete" data-id="${esc(k)}" aria-label="Hapus ${esc(t.label)}"><i class="bi bi-trash3"></i></button></span></div>`; }).join('');
  const missing = Object.keys(TPL_BASE).filter(k => !TPL[k]);
  return `<div class="card"><h3>Template Goal <button class="btn btn-soft btn-sm" data-action="tplEdit" data-id=""><i class="bi bi-plus-lg"></i> Baru</button></h3>
    <p class="tiny muted">Muncul di "Mulai dari template" saat membuat goal baru.</p>
    ${rows || '<p class="tiny muted mb-0">Belum ada template.</p>'}
    ${missing.length ? `<button class="btn btn-link btn-sm px-0 mt-2" data-action="tplRestore"><i class="bi bi-arrow-counterclockwise"></i> Pulihkan template bawaan (${missing.map(k => TPL_BASE[k].label).join(', ')})</button>` : ''}</div>`;
}
function openTplForm(id) {
  const ex = id && TPL[id];
  const t = ex || { label: '', judul: '', cat: (activeCats()[0] || {}).kategori_id, hint: '', tipe: 'Finansial', jenis: 'Bersama', target: 0, satuan: '', tugas: [] };
  const isBase = !!(ex && ex.base);
  const cc = (S.categories || []).find(x => x.kategori_id === t.cat) || {};
  const curIc = t.ikon || cc.ikon || 'bi-bookmark-star', curW = t.warna || cc.warna || PASTELS[0];
  const r = (name, v, l, cur) => `<label><input type="radio" name="${name}" value="${v}" ${cur === v ? 'checked' : ''} ${name === 'tipe' ? 'data-change="tplFormTipe"' : ''}><span>${l}</span></label>`;
  const tugas = (t.tugas || []).map(m => m.nilai ? `${m.judul} = ${fmtN(m.nilai)}` : m.judul).join('\n');
  openSheet(ex ? 'Edit Template' : 'Template Baru', `
  <form data-form="tplSave" novalidate>
    <input type="hidden" name="id" value="${esc(id || '')}">
    <label class="field"><span>Nama template</span><input name="label" maxlength="40" required value="${esc(t.label)}" placeholder="mis. Tabungan Qurban"><em class="field-err"></em></label>
    <div class="field"><span>Ikon</span><div class="icon-pick">${CAT_ICONS.concat(CAT_ICONS.includes(curIc) ? [] : [curIc]).map(i => `<label><input type="radio" name="ikon" value="${i}" ${curIc === i ? 'checked' : ''} aria-label="${ICON_LABEL[i] || i}"><span title="${ICON_LABEL[i] || ''}"><i class="bi ${i}"></i></span></label>`).join('')}</div></div>
    <div class="field"><span>Warna</span><div class="swatches">${PASTELS.map(x => `<label class="swatch" style="--c:${x}"><input type="radio" name="warna" value="${x}" ${curW === x ? 'checked' : ''} aria-label="Warna ${x}"></label>`).join('')}</div></div>
    <details class="tpl-more" ${ex && !ex.base && (ex.target || (ex.tugas || []).length || ex.tipe !== 'Finansial') ? 'open' : ''}><summary>Isian otomatis goal <small class="muted">(opsional — judul, kategori, target, daftar tugas)</small></summary>
    <label class="field mt-2"><span>Judul goal bawaan</span><input name="judul" maxlength="80" value="${esc(t.judul || '')}" placeholder="mis. Tabungan Qurban 2027"></label>
    <label class="field"><span>Kategori</span><select name="cat">${activeCats().map(c => `<option value="${c.kategori_id}" ${t.cat === c.kategori_id ? 'selected' : ''}>${esc(c.nama)}</option>`).join('')}</select></label>
    ${isBase ? `<p class="tiny muted">Template bawaan: tipe Tabungan dengan kalkulator otomatis, jadi tipe & target tidak bisa diubah di sini.</p>` : `
    <div class="field"><span>Jenis</span><div class="seg">${r('jenis', 'Bersama', '<i class="bi bi-people"></i> Bersama', t.jenis)}${r('jenis', 'Pribadi', '<i class="bi bi-person"></i> Pribadi', t.jenis)}</div></div>
    <div class="field"><span>Tipe target</span><div class="seg" style="flex-wrap:wrap">${['Finansial', 'Angka', 'Checklist', 'Kebiasaan'].map(x => r('tipe', x, TIPE_LBL[x], t.tipe)).join('')}</div></div>
    <div class="grid-2" id="tplTarget" ${t.tipe === 'Checklist' ? 'hidden' : ''}>
      <label class="field"><span id="tplTargetLbl">${t.tipe === 'Finansial' ? 'Target (Rp)' : 'Nilai target'} <small>(opsional)</small></span><input name="target" inputmode="decimal" ${t.tipe === 'Finansial' ? 'data-money' : ''} value="${t.target ? fmtN(t.target) : ''}"></label>
      <label class="field" id="tplUnit" ${t.tipe === 'Finansial' ? 'hidden' : ''}><span>Satuan</span><input name="satuan" maxlength="20" list="unitList" value="${esc(t.satuan || '')}" placeholder="kali"></label>
    </div>
    <label class="field"><span id="tplTugasLbl">${t.tipe === 'Checklist' ? 'Daftar tugas' : 'Tahapan'} <small>(opsional · satu per baris${t.tipe === 'Checklist' ? '' : ', nilai pakai "=" mis. Tiket = 5.000.000'})</small></span><textarea name="tugas" rows="4" placeholder="${t.tipe === 'Checklist' ? 'Bikin paspor\nPesan tiket' : 'Tiket pesawat = 5.000.000\nHotel = 3.000.000'}">${esc(tugas)}</textarea></label>`}
    <label class="field"><span>Petunjuk <small>(opsional)</small></span><textarea name="hint" rows="2" maxlength="240" placeholder="mis. Target = harga hewan qurban tahun depan.">${esc(t.hint || '')}</textarea></label>
    </details>
    <div class="sheet-foot"><button type="button" class="btn btn-soft" data-action="closeSheet">Batal</button><button class="btn btn-dark" type="submit">Simpan</button></div>
  </form>`);
}
function saveTplList(list, msg) {
  S.settings.goal_templates = JSON.stringify(list);
  saveSnapshot(); renderAll(); if (msg) toast(msg);
  Outbox.push('saveTemplates', [list]);
}
Object.assign(Actions, {
  tplEdit: d => openTplForm(d.id),
  tplDelete: d => {
    const t = TPL[d.id]; if (!t) return;
    confirmBox({ title: `Hapus template "${t.label}"?`, text: 'Goal yang sudah dibuat dari template ini tidak ikut terhapus.', ok: 'Hapus', danger: true }, () => {
      saveTplList(tplListRaw().filter(x => x.id !== d.id), 'Template dihapus');
    });
  },
  tplRestore: () => {
    const list = tplListRaw();
    Object.keys(TPL_BASE).forEach(k => { if (!list.some(x => x.id === k)) list.push({ id: k, base: k }); });
    saveTplList(list, 'Template bawaan dipulihkan');
  }
});
Object.assign(Changes, {
  tplFormTipe: el => {
    const f = el.form, tipe = el.value;
    $('#tplTarget', f).hidden = tipe === 'Checklist';
    $('#tplUnit', f).hidden = tipe === 'Finansial';
    $('#tplTargetLbl', f).innerHTML = (tipe === 'Finansial' ? 'Target (Rp)' : 'Nilai target') + ' <small>(opsional)</small>';
    if (tipe === 'Finansial') f.target.setAttribute('data-money', ''); else f.target.removeAttribute('data-money');
    $('#tplTugasLbl', f).innerHTML = (tipe === 'Checklist' ? 'Daftar tugas' : 'Tahapan') + ` <small>(opsional · satu per baris${tipe === 'Checklist' ? '' : ', nilai pakai "=" mis. Tiket = 5.000.000'})</small>`;
  }
});
Object.assign(Forms, {
  tplSave: f => {
    const label = f.label.value.trim();
    if (!label) { const fd = f.label.closest('.field'); fd.classList.add('invalid'); fd.querySelector('.field-err').textContent = 'Nama template wajib diisi.'; return; }
    const id = f.id.value || ('tp-' + Date.now().toString(36));
    const list = tplListRaw();
    const ex = list.find(x => x.id === id);
    const rec = { id, label, judul: f.judul.value.trim(), cat: f.cat.value, hint: f.hint.value.trim(),
      ikon: (f.querySelector('input[name=ikon]:checked') || {}).value || '', warna: (f.querySelector('input[name=warna]:checked') || {}).value || '' };
    if (ex && ex.base) rec.base = ex.base;
    else {
      const tipe = (f.querySelector('input[name=tipe]:checked') || {}).value || 'Finansial';
      Object.assign(rec, { tipe, jenis: (f.querySelector('input[name=jenis]:checked') || {}).value || 'Bersama',
        target: tipe === 'Checklist' ? 0 : parseNum(f.target.value, tipe === 'Finansial') || 0, satuan: f.satuan.value.trim(),
        tugas: f.tugas.value.split('\n').map(x => x.trim()).filter(Boolean).slice(0, 30).map(x => { const [j, v] = x.split('='); return { judul: j.trim().slice(0, 80), nilai: tipe === 'Checklist' ? 0 : parseNum(v || '', tipe === 'Finansial') || 0 }; }).filter(m => m.judul) });
    }
    if (ex) Object.keys(ex).forEach(k => delete ex[k]), Object.assign(ex, rec); else list.push(rec);
    closeSheet(); saveTplList(list, 'Template disimpan');
  }
});

/* Rekening disimpan sebagai baris goal (meta.rekening) di server, tetapi di aplikasi dipisah ke S.rekening
   sehingga TIDAK muncul sebagai goal (Goals, Beranda, laporan, perayaan). */
if (!DATA_KEYS.includes('rekening')) DATA_KEYS.push('rekening');
S.rekening = S.rekening || [];
function splitRek_() {
  if (!S.goals.some(isRek)) return;
  const rk = S.goals.filter(isRek), ids = new Set(rk.map(g => g.goal_id));
  S.goals = S.goals.filter(g => !isRek(g));
  S.rekening = (S.rekening || []).filter(g => !ids.has(g.goal_id)).concat(rk);
}
applyPayload = (f => function (p) {
  if (p && Array.isArray(p.goals)) p = Object.assign({}, p, { goals: p.goals.filter(g => !isRek(g)), rekening: p.goals.filter(isRek) });
  const out = f.call(this, p);
  try { migrateRekTarget_(); } catch (e) { }
  return out;
})(applyPayload);
renderAll = (f => function () { splitRek_(); return f.apply(this, arguments); })(renderAll);
renderPage = (f => function () { splitRek_(); return f.apply(this, arguments); })(renderPage);
/* Rekening tidak dirayakan seperti goal */
localCelebrate = (f => function (g) { return isRek(g) ? [] : f.apply(this, arguments); })(localCelebrate);
/* Rekening lama (target 100 jt) → target teknis tak terbatas, sekali saja */
function migrateRekTarget_() {
  (S.rekening || []).forEach(g => {
    if (Number(g.nilai_target) >= REK_TARGET || !canEdit(g) || g.status === 'Arsip') return;
    g.nilai_target = REK_TARGET; if (g.status === 'Selesai') g.status = 'Aktif';
    Outbox.push('saveGoal', goalSaveArgs_(g));
  });
}
const _openGoal = Actions.openGoal;
Actions.openGoal = d => { const g = goalById(d.id); if (g && isRek(g)) { S.ui.finTab = 'rekening'; navigateTo('finance'); setTimeout(() => Actions.rekHist(d), 60); return; } _openGoal(d); };

/* ── Menu dropdown Finansial di navbar: Rekening · Tabungan & Rencana · Investasi · Pinjaman · Harta ── */
function finMenuItems() {
  const f = finSummary();
  return [['rekening', 'Rekening', rekList().length, 'bi-bank', '#E2F4E8'], ['tabungan', 'Tabungan & Rencana', f.count, 'bi-wallet2', '#CFF2D6'],
    ['investasi', 'Investasi', S.assets.length, 'bi-graph-up-arrow', '#D5F0F7'], ['pinjaman', 'Pinjaman', S.loans.length, 'bi-credit-card', '#E8D3F5'],
    ['harta', 'Harta', hartaOwned().length, 'bi-gem', '#FBEBB5']];
}
function closeFinMenu() { const m = document.getElementById('finMenu'); if (m) m.remove(); document.querySelectorAll('[data-action=finMenu]').forEach(b => b.setAttribute('aria-expanded', 'false')); }
function openFinMenu(btn) {
  if (document.getElementById('finMenu')) { closeFinMenu(); return; }
  const cur = S.ui.page === 'finance' ? (S.ui.finTab || 'tabungan') : '';
  const m = document.createElement('div');
  m.id = 'finMenu'; m.className = 'fin-menu'; m.setAttribute('role', 'menu');
  m.innerHTML = finMenuItems().map(([k, l, n, ic, c]) => `<button role="menuitem" class="${cur === k ? 'on' : ''}" data-action="finGo" data-tab="${k}"><span class="tab-ic" style="--tc:${c}"><i class="bi ${ic}"></i></span><span class="flex-grow-1 text-start">${l}</span><span class="n">${n}</span></button>`).join('');
  document.body.appendChild(m);
  const r = btn.getBoundingClientRect(), up = r.top > innerHeight / 2, w = m.offsetWidth;
  m.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2)) + 'px';
  if (up) m.style.bottom = (innerHeight - r.top + 8) + 'px'; else m.style.top = (r.bottom + 8) + 'px';
  btn.setAttribute('aria-expanded', 'true');
  const first = m.querySelector('button.on') || m.querySelector('button'); if (first) first.focus({ preventScroll: true });
}
Object.assign(Actions, {
  finMenu: (d, el) => openFinMenu(el),
  finGo: d => { closeFinMenu(); S.ui.finTab = d.tab; if (S.ui.page === 'finance') renderFinance(); else navigateTo('finance');
    const on = document.querySelector('#page-finance .fin-secs .on'), row = on && on.parentElement; if (row) { const r = on.getBoundingClientRect(), rr = row.getBoundingClientRect(); if (r.left < rr.left || r.right > rr.right) row.scrollLeft += r.left - rr.left - 16; } }
});
document.addEventListener('click', e => { if (!e.target.closest('#finMenu, [data-action=finMenu]')) closeFinMenu(); }, true);
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeFinMenu(); });
window.addEventListener('resize', closeFinMenu);
window.addEventListener('scroll', closeFinMenu, { passive: true });

try {
  boot();
  window.__GT_BOOTED = true;
} catch (e) {
  window.__gtFail && window.__gtFail(e);
}

/* ═════════ Menu ⋯ di pojok kartu (popover menempel pada tombol) ═════════ */
function cardMenuBtn(itemsHtml, label) {
  return `<button type="button" class="card-more" data-action="cardMenu" aria-haspopup="menu" aria-label="Opsi ${esc(label || '')}" title="Opsi"><i class="bi bi-three-dots"></i></button><template class="cm-items">${itemsHtml}</template>`;
}
function closeCardMenu() { const m = document.getElementById('cardMenu'); if (m) { if (m._btn) m._btn.setAttribute('aria-expanded', 'false'); m.remove(); } }
Actions.cardMenu = (d, el) => {
  const was = document.getElementById('cardMenu'); const same = was && was._btn === el; closeCardMenu(); if (same) return;
  const tpl = el.parentElement.querySelector(':scope > template.cm-items'); if (!tpl) return;
  const m = document.createElement('div'); m.id = 'cardMenu'; m.className = 'fin-menu card-menu'; m.setAttribute('role', 'menu'); m._btn = el;
  m.innerHTML = tpl.innerHTML;
  m.querySelectorAll('button').forEach(b => { b.className = (b.className.includes('rek-del') || b.className.includes('danger') ? 'danger ' : '') + 'cm-item'; b.setAttribute('role', 'menuitem'); });
  document.body.appendChild(m); m._y = scrollY; closeCardMenu._w = window.innerWidth; el.setAttribute('aria-expanded', 'true');
  const r = el.getBoundingClientRect(), w = m.offsetWidth, h = m.offsetHeight;
  let left = r.right - w; if (left < 8) left = 8;
  let top = r.bottom + 8; if (top + h > innerHeight - 8) top = Math.max(8, r.top - h - 8);
  m.style.left = left + 'px'; m.style.top = top + 'px';
};
document.addEventListener('click', e => { if (!document.getElementById('cardMenu') || e.target.closest('[data-action=cardMenu]')) return; setTimeout(closeCardMenu, 0); }, true);
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeCardMenu(); });
window.addEventListener('scroll', () => { const m = document.getElementById('cardMenu'); if (!m) return; if (m._y === undefined) m._y = scrollY; if (Math.abs(scrollY - m._y) > 40) closeCardMenu(); }, true);
window.addEventListener('resize', () => { if (window.innerWidth !== (closeCardMenu._w || 0)) { closeCardMenu._w = window.innerWidth; closeCardMenu(); } });

Forms.addTask = form => {
  const g = goalById(form.goal_id.value); if (!g) return;
  const names = String(form.judul.value || '').split(/\n+/).map(x => x.trim()).filter(Boolean).slice(0, 20);
  if (!names.length) { const e = form.querySelector('.field-err'); if (e) e.textContent = 'Tulis nama tugas dulu.'; form.judul.focus(); return; }
  const cur = msOf(g.goal_id), start = cur.length;
  names.forEach((t, i) => S.milestones.push({ milestone_id: uid(), goal_id: g.goal_id, judul: t.slice(0, 120), nilai_target: 0, urutan: start + i + 1, status: 'Belum', tgl_selesai: '' }));
  g.diubah_pada = nowIso();
  syncStatusLocal(g); saveSnapshot(); closeSheet(); renderAll();
  toast(names.length > 1 ? `${names.length} tugas ditambahkan ✅` : 'Tugas ditambahkan ✅');
  Outbox.push('saveGoal', goalSaveArgs_(g));
};

/* ═════════ Travel itinerary (Hari 1, 2, 3 …) untuk goal liburan — disimpan di meta.itin ═════════ */
const ITIN_JENIS = [['wisata', 'Wisata', 'bi-camera'], ['makan', 'Makan', 'bi-cup-hot'], ['transport', 'Pesawat', 'bi-airplane'], ['mobil', 'Mobil', 'bi-car-front'], ['inap', 'Menginap', 'bi-building'], ['belanja', 'Belanja', 'bi-bag'], ['lain', 'Lainnya', 'bi-geo-alt']];
const ITIN_C = ['#FBEBB5', '#D5F0F7', '#F8CFE0', '#CFF2D6', '#E8D3F5', '#FFE1C7'];
const itinOf = g => { const a = parseMeta(g.meta).itin; return Array.isArray(a) ? a : []; };
function itinSave_(g, days) {
  const m = parseMeta(g.meta); if (days.length) m.itin = days; else delete m.itin;
  g.meta = Object.keys(m).length ? JSON.stringify(m) : ''; g.diubah_pada = nowIso();
  saveSnapshot(); renderAll(); Outbox.push('saveGoal', goalSaveArgs_(g));
}
function itinDate_(g, i) { if (!g.tgl_pelaksanaan) return ''; const d = new Date(g.tgl_pelaksanaan + 'T00:00:00'); d.setDate(d.getDate() + i); return d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' }); }
/** Itinerary hanya untuk goal berkategori Liburan */
function isLiburan_(g) { const c = catById(g.kategori_id) || {}; return g.kategori_id === 'cat-liburan' || /liburan|wisata|travel/i.test(c.nama || '') || g.template === 'liburan'; }
function itinCardHtml(g) {
  const days = itinOf(g), ed = canEdit(g);
  let sel = S.ui.itinSel && S.ui.itinSel.g === g.goal_id ? S.ui.itinSel.i : 0; if (sel >= days.length) sel = Math.max(0, days.length - 1);
  const d = days[sel], c = ITIN_C[sel % ITIN_C.length];
  const tabs = days.map((x, i) => `<button class="itin-tab ${i === sel ? 'on' : ''}" style="--c:${ITIN_C[i % ITIN_C.length]}" data-action="itinSel" data-id="${g.goal_id}" data-i="${i}"><b>Hari ${i + 1}</b>${itinDate_(g, i) ? `<small>${esc(itinDate_(g, i))}</small>` : ''}</button>`).join('')
    + (ed ? `<button class="itin-tab add" data-action="itinAddDay" data-id="${g.goal_id}" title="Tambah hari" aria-label="Tambah hari"><i class="bi bi-plus-lg"></i></button>` : '');
  const panel = d ? (() => {
    const acts = (d.a || []).map((a, idx) => ({ a, idx })).sort((x, y) => String(x.a.j || '99').localeCompare(String(y.a.j || '99')));
    return `<div class="itin-panel" style="--c:${c}">
      <div class="itin-ph"><div class="itin-pt"><b>${d.t ? esc(d.t) : 'Hari ' + (sel + 1)}</b>${itinDate_(g, sel) ? `<span>${esc(itinDate_(g, sel))}</span>` : ''}</div>
        ${ed ? `<button class="card-more itin-more" data-action="cardMenu" aria-label="Opsi hari ${sel + 1}"><i class="bi bi-three-dots"></i></button><template class="cm-items"><button data-action="itinDay" data-id="${g.goal_id}" data-i="${sel}"><i class="bi bi-pencil"></i> Ubah judul hari</button><button class="danger" data-action="itinDelDay" data-id="${g.goal_id}" data-i="${sel}"><i class="bi bi-trash3"></i> Hapus hari</button></template>` : ''}</div>
      <ul class="itin-list">${acts.map(({ a, idx }) => { const k = ITIN_JENIS.find(x => x[0] === a.k) || ITIN_JENIS[ITIN_JENIS.length - 1];
        return `<li ${ed ? `data-action="itinAct" data-id="${g.goal_id}" data-i="${sel}" data-x="${idx}" title="Ubah"` : ''}><span class="itin-j">${esc(a.j || '–')}</span><span class="itin-ic"><i class="bi ${k[2]}"></i></span>
          <span class="itin-n"><b>${esc(a.n)}</b>${a.l ? `<small> · ${esc(a.l)}</small>` : ''}${a.c ? `<small class="d-block">${esc(a.c)}</small>` : ''}</span></li>`; }).join('') || '<li class="itin-empty">Belum ada kegiatan.</li>'}</ul>
      ${ed ? `<button class="itin-add" data-action="itinAct" data-id="${g.goal_id}" data-i="${sel}"><i class="bi bi-plus-lg"></i> Kegiatan</button>` : ''}</div>`;
  })() : '';
  return `<div class="card hc itin-card itin-tall" style="--hc:#FFE1C7"><h3 class="mb-1">🧳 Itinerary</h3>
    <p class="tiny muted mb-2">${days.length ? `${days.length} hari${g.tgl_pelaksanaan ? ` · mulai ${fmtLong(g.tgl_pelaksanaan)}` : ''}` : 'Susun rencana harian: wisata, makan, perjalanan, penginapan.'}</p>
    ${days.length ? `<div class="itin-tabwrap"><button class="itin-nav prev" data-action="itinScroll" data-dir="-1" aria-label="Hari sebelumnya"><i class="bi bi-chevron-left"></i></button><div class="itin-tabs hscroll">${tabs}</div><button class="itin-nav next" data-action="itinScroll" data-dir="1" aria-label="Hari berikutnya"><i class="bi bi-chevron-right"></i></button></div>${panel}` : (ed ? `<button class="itin-start" data-action="itinAddDay" data-id="${g.goal_id}"><i class="bi bi-map"></i><b>Mulai susun itinerary</b><span class="tiny muted">Tambah Hari 1</span></button>` : '')}
  </div>`;
}
Object.assign(Actions, {
  itinSel: d => { S.ui.itinSel = { g: d.id, i: Number(d.i) }; renderAll(); },
  itinAddDay: d => { const g = goalById(d.id); if (!g) return; const days = itinOf(g).concat([{ t: '', a: [] }]); S.ui.itinSel = { g: g.goal_id, i: days.length - 1 }; itinSave_(g, days); toast(`Hari ${days.length} ditambahkan`); },
  itinDelDay: d => { const g = goalById(d.id); if (!g) return; const i = Number(d.i), days = itinOf(g);
    confirmBox({ title: `Hapus Hari ${i + 1}?`, text: `${(days[i].a || []).length} kegiatan di hari ini ikut terhapus. Hari setelahnya akan bergeser maju.`, ok: 'Hapus', danger: true }, () => { days.splice(i, 1); itinSave_(g, days); toast('Hari dihapus'); }); },
  itinDay: d => { const g = goalById(d.id); if (!g) return; const i = Number(d.i), day = itinOf(g)[i] || {};
    openSheet(`Hari ${i + 1}`, `<form data-form="itinDay" novalidate><input type="hidden" name="goal_id" value="${g.goal_id}"><input type="hidden" name="i" value="${i}">
      <label class="field"><span>Judul hari <small>(opsional)</small></span><input name="t" maxlength="60" value="${esc(day.t || '')}" placeholder="Contoh: Jelajah kota Batu"></label>
      <button class="btn btn-dark w-100 mt-2" type="submit">Simpan</button></form>`); },
  itinAct: d => { const g = goalById(d.id); if (!g) return; const i = Number(d.i), day = itinOf(g)[i] || { a: [] }, x = d.x !== undefined && d.x !== '' ? Number(d.x) : -1, a = x >= 0 ? day.a[x] : {};
    openSheet(`${x >= 0 ? 'Ubah' : 'Tambah'} Kegiatan · Hari ${i + 1}`, `<form data-form="itinAct" novalidate><input type="hidden" name="goal_id" value="${g.goal_id}"><input type="hidden" name="i" value="${i}"><input type="hidden" name="x" value="${x}">
      <div class="field"><span>Jenis</span><div class="itin-kinds">${ITIN_JENIS.map(([v, l, ic]) => `<label><input type="radio" name="k" value="${v}" ${(a.k || 'wisata') === v ? 'checked' : ''}><span><i class="bi ${ic}"></i> ${l}</span></label>`).join('')}</div></div>
      <div class="d-flex gap-2"><label class="field" style="flex:0 0 120px"><span>Jam</span><input name="j" type="time" value="${esc(a.j || '')}"></label>
        <label class="field flex-grow-1"><span>Kegiatan</span><input name="n" maxlength="80" value="${esc(a.n || '')}" placeholder="Contoh: Jatim Park 2" required><em class="field-err"></em></label></div>
      <label class="field"><span>Lokasi <small>(opsional)</small></span><input name="l" maxlength="80" value="${esc(a.l || '')}" placeholder="Contoh: Kota Batu"></label>
      <label class="field"><span>Catatan <small>(opsional)</small></span><input name="c" maxlength="100" value="${esc(a.c || '')}" placeholder="Contoh: tiket Rp 150 rb/orang"></label>
      <div class="d-flex gap-2 mt-2">${x >= 0 ? `<button type="button" class="btn btn-soft" data-action="itinDelAct" data-id="${g.goal_id}" data-i="${i}" data-x="${x}"><i class="bi bi-trash3"></i> Hapus</button>` : ''}<button class="btn btn-dark flex-grow-1" type="submit">Simpan</button></div></form>`);
    setTimeout(() => { const n = $('#sheet [name=n]'); if (n && !n.value) n.focus(); }, 80); },
  itinDelAct: d => { const g = goalById(d.id); if (!g) return; const days = itinOf(g), i = Number(d.i), x = Number(d.x);
    if (days[i] && days[i].a) days[i].a.splice(x, 1); closeSheet(); itinSave_(g, days); toast('Kegiatan dihapus'); }
});
Object.assign(Forms, {
  itinDay: f => { const g = goalById(f.goal_id.value); if (!g) return; const days = itinOf(g), i = Number(f.i.value); if (!days[i]) return;
    days[i].t = f.t.value.trim().slice(0, 60); closeSheet(); itinSave_(g, days); toast('Judul hari disimpan'); },
  itinAct: f => { const g = goalById(f.goal_id.value); if (!g) return; const days = itinOf(g), i = Number(f.i.value), x = Number(f.x.value);
    const n = f.n.value.trim(); if (!n) { f.querySelector('.field-err').textContent = 'Isi nama kegiatan.'; f.n.focus(); return; }
    const a = { k: (f.querySelector('[name=k]:checked') || {}).value || 'lain', j: f.j.value, n: n.slice(0, 80), l: f.l.value.trim().slice(0, 80), c: f.c.value.trim().slice(0, 100) };
    Object.keys(a).forEach(k => { if (!a[k]) delete a[k]; });
    if (!days[i]) return; days[i].a = days[i].a || [];
    if (x >= 0) days[i].a[x] = a; else days[i].a.push(a);
    closeSheet(); itinSave_(g, days); toast(x >= 0 ? 'Kegiatan diperbarui' : 'Kegiatan ditambahkan ✈️'); }
});

Actions.itinScroll = (d, el) => { const row = el.parentElement.querySelector('.itin-tabs'); if (row) row.scrollBy({ left: Number(d.dir) * Math.max(160, row.clientWidth * .7), behavior: 'smooth' }); };
/* Tab hari: tampilkan panah hanya bila bisa digeser; hari aktif selalu terlihat */
function itinTabsSync_() {
  document.querySelectorAll('.itin-tabwrap').forEach(w => {
    const r = w.querySelector('.itin-tabs'); if (!r) return;
    const upd = () => { w.classList.toggle('can-l', r.scrollLeft > 4); w.classList.toggle('can-r', r.scrollLeft + r.clientWidth < r.scrollWidth - 4); };
    if (!r._b) { r._b = 1; r.addEventListener('scroll', upd, { passive: true });
      let sx = 0, sl = 0, drag = false;   // geser dengan seret mouse (desktop)
      r.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse') return; drag = true; sx = e.clientX; sl = r.scrollLeft; r._moved = false; });
      window.addEventListener('pointermove', e => { if (!drag) return; const dx = e.clientX - sx; if (Math.abs(dx) > 4) r._moved = true; r.scrollLeft = sl - dx; });
      window.addEventListener('pointerup', () => { drag = false; });
      r.addEventListener('click', e => { if (r._moved) { e.stopPropagation(); e.preventDefault(); r._moved = false; } }, true); }
    const on = r.querySelector('.itin-tab.on'), key = on ? on.dataset.id + ':' + on.dataset.i : '';
    if (on && key !== itinTabsSync_.last) {             // hanya saat hari terpilih berubah
      const sameGoal = itinTabsSync_.last && itinTabsSync_.last.split(':')[0] === on.dataset.id;
      itinTabsSync_.last = key;
      const a = on.offsetLeft, b = a + on.offsetWidth;
      if (a < r.scrollLeft || b > r.scrollLeft + r.clientWidth) {
        const to = Math.max(0, a - (r.clientWidth - on.offsetWidth) / 2);
        if (sameGoal) r.scrollTo({ left: to, behavior: 'smooth' }); else r.scrollLeft = to;
      }
    }
    upd();
  });
}
new MutationObserver(() => itinTabsSync_()).observe(document.body, { childList: true, subtree: true });

/* ═════════ Persiapan perjalanan (tiket, hotel, rental) — tugas bercentang, disimpan di meta.prep ═════════ */
const PREP_JENIS = [['pesawat', 'Tiket pesawat', 'bi-airplane', 'Sudah dibeli'], ['kereta', 'Tiket kereta/bus', 'bi-train-front', 'Sudah dibeli'], ['travel', 'Mobil travel', 'bi-car-front-fill', 'Sudah dibooking'], ['hotel', 'Hotel', 'bi-building', 'Sudah dibooking'], ['mobil', 'Rental mobil', 'bi-car-front', 'Sudah dibooking'], ['lain', 'Lainnya', 'bi-check2-square', 'Sudah beres']];
const prepOf = g => { const a = parseMeta(g.meta).prep; return Array.isArray(a) ? a : []; };
const prepKind = k => PREP_JENIS.find(x => x[0] === k) || PREP_JENIS[PREP_JENIS.length - 1];
function prepSave_(g, list) {
  const m = parseMeta(g.meta); if (list.length) m.prep = list; else delete m.prep;
  g.meta = JSON.stringify(m); g.diubah_pada = nowIso();
  saveSnapshot(); keepScroll(renderAll); Outbox.push('saveGoal', goalSaveArgs_(g));
}
function prepWhen_(p) {
  const f = (s, y) => { const d = new Date(s + 'T00:00:00'); return isNaN(d) ? '' : d.toLocaleDateString('id-ID', y ? { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' } : { weekday: 'short', day: 'numeric', month: 'short' }); };
  if (!p.d1) return '';
  if (!p.d2 || p.d2 === p.d1) return f(p.d1, true) + (p.j ? ' · ' + p.j.replace(':', '.') : '');
  const n = Math.round((new Date(p.d2 + 'T00:00:00') - new Date(p.d1 + 'T00:00:00')) / 864e5);
  // Hotel dihitung per malam; rental/travel/lainnya dihitung per hari, termasuk hari mulai & selesai
  return `${f(p.d1)} – ${f(p.d2, true)}${n > 0 ? ` · ${p.k === 'hotel' ? n + ' malam' : (n + 1) + ' hari'}` : ''}`;
}
function prepCardHtml(g) {
  const list = prepOf(g), ed = canEdit(g) && g.status !== 'Arsip';
  const rows = list.map((p, i) => ({ p, i })).sort((a, b) => String(a.p.d1 || '9').localeCompare(String(b.p.d1 || '9')) || String(a.p.j || '').localeCompare(String(b.p.j || '')));
  const done = list.filter(p => p.ok).length;
  return `<div class="card hc prep-card" style="--hc:#CFF2D6">
    <div class="d-flex justify-content-between align-items-center gap-2 mb-1"><h3 class="mb-0">🎫 Persiapan</h3><span class="muted tiny fw-bold">${done}/${list.length}</span></div>
    <p class="tiny muted mb-2">Tiket, hotel, dan rental yang perlu dibeli atau dibooking.</p>
    ${list.length ? `<div class="exp-bar mb-2" role="img" aria-label="${done} dari ${list.length} beres"><span style="width:${Math.round(done / list.length * 100)}%;background:var(--green-ink,#1B7F3A)"></span></div>` : ''}
    <ul class="prep-list">${rows.map(({ p, i }) => { const k = prepKind(p.k);
      return `<li class="${p.ok ? 'done' : ''}">
        <button class="prep-chk" ${ed ? `data-action="prepToggle" data-id="${g.goal_id}" data-i="${i}"` : 'disabled'} aria-pressed="${!!p.ok}" aria-label="${p.ok ? 'Tandai belum' : 'Tandai sudah'}"><i class="bi bi-check-lg"></i></button>
        <div class="prep-body" ${ed ? `data-action="prepEdit" data-id="${g.goal_id}" data-i="${i}" role="button" tabindex="0"` : ''}>
          <div class="prep-t"><i class="bi ${k[2]}"></i><b>${esc(p.n || k[1])}</b>${p.r ? `<span class="muted"> · ${esc(p.r)}</span>` : ''}</div>
          ${prepWhen_(p) ? `<div class="tiny muted">${esc(prepWhen_(p))}</div>` : ''}
        </div>
        <span class="prep-st ${p.ok ? 'ok' : ''}">${p.ok ? k[3] : 'Belum'}</span>
      </li>`; }).join('') || '<li class="prep-empty tiny muted">Belum ada. Contoh: tiket pesawat Bpp → Sby, hotel, rental mobil.</li>'}</ul>
    ${ed ? `<button class="itin-add mt-2" data-action="prepEdit" data-id="${g.goal_id}"><i class="bi bi-plus-lg"></i> Tambah persiapan</button>` : ''}
  </div>`;
}
Object.assign(Actions, {
  prepToggle: d => { const g = goalById(d.id); if (!g) return; const list = prepOf(g), p = list[Number(d.i)]; if (!p) return;
    p.ok = !p.ok; if (p.ok) p.at = today(); else delete p.at; prepSave_(g, list); toast(p.ok ? `${prepKind(p.k)[3]} ✅` : 'Ditandai belum'); },
  prepEdit: d => { const g = goalById(d.id); if (!g) return; const i = d.i !== undefined && d.i !== '' ? Number(d.i) : -1, p = i >= 0 ? prepOf(g)[i] || {} : { d1: g.tgl_pelaksanaan || '' };
    openSheet(`${i >= 0 ? 'Ubah' : 'Tambah'} Persiapan`, `<form data-form="prepSave" novalidate><input type="hidden" name="goal_id" value="${g.goal_id}"><input type="hidden" name="i" value="${i}">
      <div class="field"><span>Jenis</span><div class="itin-kinds">${PREP_JENIS.map(([v, l, ic]) => `<label><input type="radio" name="k" value="${v}" ${(p.k || 'pesawat') === v ? 'checked' : ''}><span><i class="bi ${ic}"></i> ${l}</span></label>`).join('')}</div></div>
      <label class="field"><span>Nama / keterangan</span><input name="n" maxlength="80" value="${esc(p.n || '')}" placeholder="Contoh: Pelita Air, Hotel 1979, Rental Avanza"></label>
      <label class="field"><span>Tujuan / rute <small>(opsional)</small></span><input name="r" maxlength="60" value="${esc(p.r || '')}" placeholder="Contoh: Bpp → Sby, Kota Batu"></label>
      <div class="d-flex gap-2"><label class="field flex-grow-1"><span>Tanggal</span><input name="d1" type="date" value="${esc(p.d1 || '')}"></label>
        <label class="field flex-grow-1"><span>s/d <small>(opsional)</small></span><input name="d2" type="date" value="${esc(p.d2 || '')}"></label></div>
      <label class="field" style="max-width:160px"><span>Jam <small>(opsional)</small></span><input name="j" type="time" value="${esc(p.j || '')}"></label>
      <label class="check-row mt-1"><input type="checkbox" name="ok" ${p.ok ? 'checked' : ''}> <span>Sudah dibeli / dibooking</span></label>
      <em class="field-err"></em>
      <div class="d-flex gap-2 mt-2">${i >= 0 ? `<button type="button" class="btn btn-soft" data-action="prepDel" data-id="${g.goal_id}" data-i="${i}"><i class="bi bi-trash3"></i> Hapus</button>` : ''}<button class="btn btn-dark flex-grow-1" type="submit">Simpan</button></div></form>`); },
  prepDel: d => { const g = goalById(d.id); if (!g) return; const list = prepOf(g); list.splice(Number(d.i), 1); closeSheet(); prepSave_(g, list); toast('Persiapan dihapus'); }
});
Object.assign(Forms, {
  prepSave: f => { const g = goalById(f.goal_id.value); if (!g) return; const list = prepOf(g), i = Number(f.i.value);
    const k = (f.querySelector('[name=k]:checked') || {}).value || 'lain';
    const p = { k, n: f.n.value.trim().slice(0, 80), r: f.r.value.trim().slice(0, 60), d1: f.d1.value, d2: f.d2.value, j: f.j.value, ok: f.ok.checked };
    if (!p.n && !p.d1) { f.querySelector('.field-err').textContent = 'Isi nama atau tanggalnya.'; f.n.focus(); return; }
    if (p.d1 && p.d2 && p.d2 < p.d1) { f.querySelector('.field-err').textContent = 'Tanggal s/d tidak boleh sebelum tanggal mulai.'; return; }
    const old = i >= 0 ? list[i] || {} : {};
    if (p.ok) p.at = old.at || today();
    Object.keys(p).forEach(x => { if (!p[x]) delete p[x]; });
    if (i >= 0) list[i] = p; else list.push(p);
    closeSheet(); prepSave_(g, list); toast(i >= 0 ? 'Persiapan diperbarui' : 'Persiapan ditambahkan 🎫'); }
});
