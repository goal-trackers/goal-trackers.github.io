/* GOAL TRACKERS — js/harta.js: Harta (emas, perak, tanah, rumah, kendaraan, lainnya)
   Tiap kepemilikan dicatat satu baris. Beli emas/tanah baru = tambah baris baru,
   lalu total per jenis (mis. emas 15 gram) dihitung otomatis. */
const HARTA = {
  Emas:      { satuan: 'gram', emoji: '🪙', icon: 'bi-coin',          c: '#FBEBB5', harga: true,  contoh: 'mis. Antam 5 gr',            simpan: 'mis. Brankas rumah / Pegadaian' },
  Perak:     { satuan: 'gram', emoji: '🥈', icon: 'bi-coin',          c: '#E6E8EE', harga: true,  contoh: 'mis. Perak batangan 100 gr', simpan: 'mis. Brankas rumah' },
  Dinar:     { satuan: 'keping', emoji: '🟡', icon: 'bi-coin',        c: '#F6E3A1', harga: true,  contoh: 'mis. Dinar 22K 4,25 gr',     simpan: 'mis. Brankas rumah' },
  Tanah:     { satuan: 'm²',   emoji: '🌳', icon: 'bi-tree',          c: '#CFF2D6', harga: true,  contoh: 'mis. Tanah kavling Batu',    simpan: 'mis. Jl. Mawar No. 3, Batu' },
  Rumah:     { satuan: 'unit', emoji: '🏠', icon: 'bi-house-door',    c: '#FFE1C7', harga: false, contoh: 'mis. Rumah Perum Griya',     simpan: 'Alamat' },
  Kendaraan: { satuan: 'unit', emoji: '🚗', icon: 'bi-car-front',     c: '#D5F0F7', harga: false, susut: 5, contoh: 'mis. Motor Vario 2023',      simpan: 'mis. Plat nomor / garasi' },
  Lainnya:   { satuan: 'unit', emoji: '📦', icon: 'bi-box-seam',      c: '#E8D3F5', harga: false, contoh: 'mis. Koleksi, peralatan',    simpan: 'Lokasi' }
};
const HARTA_SATUAN = ['gram', 'kg', 'm²', 'hektare', 'unit', 'keping', 'batang'];

const hartaOwned = () => (S.harta || []).filter(h => h.status !== 'Dijual');
const hargaPasar = jenis => Number(S.settings['harga_' + jenis]) || 0;
const fmtQty = (n, sat) => fmtN(Math.round(Number(n) * 1000) / 1000) + ' ' + sat;

/** Penyusutan per tahun (%) untuk jenis yang nilainya turun (kendaraan). Disimpan di Settings "harga_<jenis>". */
const susutRate = jenis => { const t = HARTA[jenis]; if (!t || !t.susut) return 0; const v = S.settings['harga_' + jenis]; return v === undefined || v === '' ? t.susut : Number(v) || 0; };
const usiaTahun = iso => iso ? Math.max(0, (new Date(today() + 'T12:00:00') - new Date(iso + 'T12:00:00')) / (365.25 * 864e5)) : 0;
/** Nilai taksiran satu harta:
 *  - emas/perak/tanah: jumlah × harga pasar/satuan (bila diatur & satuan cocok)
 *  - kendaraan: harga beli × (1 − susut%)^usia (saldo menurun)
 *  - selain itu: harga beli */
function hartaNilai(h) {
  const t = HARTA[h.jenis] || {}, beli = Number(h.harga_beli) || 0;
  if (t.susut && beli > 0 && h.tgl_beli) {
    const r = susutRate(h.jenis), th = usiaTahun(h.tgl_beli);
    return { v: beli * Math.pow(1 - r / 100, th), susut: true, usia: th, rate: r };
  }
  const hp = hargaPasar(h.jenis);
  if (t.harga && hp > 0 && h.satuan === t.satuan) return { v: Number(h.jumlah) * hp, pasar: true };
  if (h.jenis === 'Dinar' && h.satuan === 'keping' && dinarEstimasi() > 0) return { v: Number(h.jumlah) * dinarEstimasi(), pasar: true, estimasi: true };
  return { v: beli, pasar: false };
}
/** 1 dinar = 4,25 gr emas 22K (kadar 91,7%). Taksiran dari harga buyback emas Antam bila harga dinar belum diatur. */
const DINAR_GRAM = 4.25, DINAR_KADAR = 0.917;
const dinarEstimasi = () => hargaPasar('Emas') * DINAR_GRAM * DINAR_KADAR;
const hargaDinar = () => hargaPasar('Dinar') || dinarEstimasi();
const fmtUsia = th => fmtN(Math.round(th * 10) / 10) + ' thn';
/** Total per jenis: { jumlah per satuan, nilai, modal, banyak } */
function hartaSummary(list) {
  const out = {};
  list.forEach(h => {
    const s = out[h.jenis] || (out[h.jenis] = { qty: {}, nilai: 0, modal: 0, n: 0 });
    s.qty[h.satuan] = (s.qty[h.satuan] || 0) + Number(h.jumlah);
    s.nilai += hartaNilai(h).v; s.modal += Number(h.harga_beli) || 0; s.n++;
  });
  return out;
}
const qtyText = q => Object.keys(q).map(k => fmtQty(q[k], k)).join(' + ');

// ── Ringkasan kecil untuk kartu finansial di beranda ──
function hartaExtraHtml() {
  const sum = hartaSummary(hartaOwned());
  const keys = Object.keys(HARTA).filter(k => sum[k]);
  if (!keys.length) return '';
  return `<div class="fin-row tiny"><span class="muted">Harta</span><strong>${keys.slice(0, 3).map(k => HARTA[k].emoji + ' ' + qtyText(sum[k].qty)).join(' · ')}</strong></div>`;
}

// ── Ilustrasi batangan emas/perak (bukan foto/logo merek), ukuran mengikuti berat ──
let _barSeq = 0;
const fmtGram = g => fmtN(Math.round(Number(g) * 1000) / 1000);
function barSvg(gram, metal, w) {
  const id = 'gb' + (++_barSeq), silver = metal === 'Perak';
  const c = silver ? ['#FFFFFF', '#E3E6EC', '#9CA3AF', '#F1F3F6', '#7B8290'] : ['#FFF6C9', '#F6CF55', '#C38A1C', '#F9DE7E', '#8E5E12'];
  const ink = silver ? '#4B5260' : '#6B4508', g = Number(gram) || 0;
  const big = g >= 100;                                   // ≥100 gr: batangan melintang
  const W = big ? 120 : 64, H = big ? 70 : 96;
  const label = fmtGram(g) + (g >= 1000 ? '' : '');
  const fs = String(label).length > 4 ? 13 : 17;
  return `<svg class="bar-svg" viewBox="0 0 ${W} ${H}" width="${w || (big ? 64 : 40)}" role="img" aria-label="Batangan ${silver ? 'perak' : 'emas'} ${label} gram">
    <defs>
      <linearGradient id="${id}a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c[0]}"/><stop offset=".28" stop-color="${c[1]}"/><stop offset=".55" stop-color="${c[2]}"/><stop offset=".78" stop-color="${c[3]}"/><stop offset="1" stop-color="${c[4]}"/></linearGradient>
      <linearGradient id="${id}b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c[3]}"/><stop offset=".5" stop-color="${c[1]}"/><stop offset="1" stop-color="${c[2]}"/></linearGradient>
      <linearGradient id="${id}s" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
    </defs>
    <rect x="1.5" y="1.5" width="${W - 3}" height="${H - 3}" rx="${big ? 10 : 8}" fill="url(#${id}a)" stroke="${c[4]}" stroke-width="1.5"/>
    <rect x="7" y="7" width="${W - 14}" height="${H - 14}" rx="${big ? 6 : 5}" fill="url(#${id}b)" stroke="${c[0]}" stroke-opacity=".7"/>
    <rect x="7" y="7" width="${(W - 14) * .45}" height="${H - 14}" rx="5" fill="url(#${id}s)" transform="skewX(-12) translate(${big ? 14 : 10} 0)"/>
    ${big
      ? `<text x="${W / 2}" y="${H / 2 - 2}" text-anchor="middle" font-family="Georgia,serif" font-weight="700" font-size="20" fill="${ink}">${label} g</text>
         <text x="${W / 2}" y="${H / 2 + 14}" text-anchor="middle" font-family="Arial,sans-serif" font-weight="700" font-size="8" letter-spacing="1" fill="${ink}" opacity=".85">FINE ${silver ? 'SILVER 999' : 'GOLD 999.9'}</text>`
      : `<text x="${W / 2}" y="${H * .30}" text-anchor="middle" font-family="Arial,sans-serif" font-weight="700" font-size="6.5" letter-spacing=".8" fill="${ink}" opacity=".85">FINE ${silver ? 'SILVER' : 'GOLD'}</text>
         <text x="${W / 2}" y="${H * .56}" text-anchor="middle" font-family="Georgia,serif" font-weight="700" font-size="${fs}" fill="${ink}">${label}</text>
         <text x="${W / 2}" y="${H * .69}" text-anchor="middle" font-family="Arial,sans-serif" font-weight="700" font-size="8" fill="${ink}">gram</text>
         <text x="${W / 2}" y="${H * .84}" text-anchor="middle" font-family="Arial,sans-serif" font-weight="700" font-size="7" letter-spacing=".5" fill="${ink}" opacity=".85">${silver ? '999' : '999.9'}</text>`}
  </svg>`;
}
function coinSvg(n, w) {
  const id = 'dn' + (++_barSeq);
  return `<svg class="bar-svg" viewBox="0 0 80 80" width="${w || 40}" role="img" aria-label="Koin dinar ${fmtGram(n)} keping">
    <defs><radialGradient id="${id}a" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#FFF6C9"/><stop offset=".45" stop-color="#F2C94C"/><stop offset=".85" stop-color="#C38A1C"/><stop offset="1" stop-color="#8E5E12"/></radialGradient>
      <linearGradient id="${id}b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F9DE7E"/><stop offset="1" stop-color="#B07A16"/></linearGradient></defs>
    <circle cx="40" cy="40" r="38" fill="url(#${id}b)" stroke="#8E5E12" stroke-width="1.5"/>
    <circle cx="40" cy="40" r="32" fill="url(#${id}a)"/>
    <circle cx="40" cy="40" r="27" fill="none" stroke="#8E5E12" stroke-opacity=".55" stroke-dasharray="2 2.4"/>
    <text x="40" y="36" text-anchor="middle" font-family="Georgia,serif" font-weight="700" font-size="17" fill="#6B4508">${Number(n) === 0.5 ? '½' : '1'}</text>
    <text x="40" y="50" text-anchor="middle" font-family="Arial,sans-serif" font-weight="700" font-size="9" letter-spacing="1" fill="#6B4508">DINAR</text>
    <text x="40" y="60" text-anchor="middle" font-family="Arial,sans-serif" font-weight="700" font-size="6" fill="#6B4508" opacity=".8">22K</text>
  </svg>`;
}
function hartaThumb(h, w) {
  if (h.jenis === 'Dinar') return coinSvg(Number(h.jumlah) === 0.5 ? 0.5 : 1, w);
  if ((h.jenis === 'Emas' || h.jenis === 'Perak') && (h.satuan === 'gram' || h.satuan === 'kg')) return barSvg(h.satuan === 'kg' ? Number(h.jumlah) * 1000 : h.jumlah, h.jenis, w);
  const t = HARTA[h.jenis] || HARTA.Lainnya;
  return `<span class="harta-emoji tint" style="--c:${t.c}">${t.emoji}</span>`;
}

/** Nama seri dari kolom Nama tanpa angka berat: "Certicard Antam 5 gr" → "Certicard Antam". */
function seriesOf(h) {
  let n = String(h.nama || '').replace(/\(?\b\d+(?:[.,]\d+)?\s*(?:gr|gram|g|kg|keping|kpg)\b\.?\)?/gi, ' ').replace(/#\d+/g, ' ').replace(/\s+/g, ' ').replace(/^[\s\-·,]+|[\s\-·,]+$/g, '').trim();
  if (!n || n.toLowerCase() === String(h.jenis).toLowerCase()) n = 'Tanpa seri';
  return n;
}
/** Render ulang tanpa melompat ke atas: simpan posisi gulir halaman & tabel. */
function keepScroll(fn) {
  const y = window.scrollY, tw = document.querySelector('#page-finance .harta-tbl') ? document.querySelector('#page-finance .harta-tbl').parentElement.scrollLeft : 0;
  fn();
  window.scrollTo(0, y);
  const w = document.querySelector('#page-finance .harta-tbl'); if (w) w.parentElement.scrollLeft = tw;
}

// ── Kolom tabel per jenis harta ──
function hartaCols(jenis) {
  const rp = v => v ? fmtVal(Math.round(v), 'Rp') : '<span class="muted">-</span>';
  const beli = h => Number(h.harga_beli) || 0;
  const per = h => beli(h) && Number(h.jumlah) ? beli(h) / Number(h.jumlah) : 0;
  const taks = h => hartaNilai(h);
  const gl = h => { const n = taks(h); if (!beli(h) || (!n.pasar && !n.susut)) return '<span class="muted">-</span>'; const d = n.v - beli(h), pc = d / beli(h) * 100;
    return `<span style="color:${d >= 0 ? 'var(--green-ink,#1B7F3A)' : 'var(--red-ink)'}">${d >= 0 ? '+' : '−'}${fmtShort(Math.abs(d), 'Rp')}<br><small>${d >= 0 ? '+' : '−'}${fmtN(Math.round(Math.abs(pc) * 10) / 10)}%</small></span>`; };
  const nama = { h: 'Nama', td: h => `<b>${esc(h.nama)}</b>${h.catatan ? `<div class="tiny muted">${esc(h.catatan)}</div>` : ''}` };
  const tgl = { h: 'Tgl beli', td: h => h.tgl_beli ? fmtDate(h.tgl_beli) : '-' };
  const hb = { h: 'Harga beli', num: 1, td: h => rp(beli(h)), sum: h => beli(h) };
  const owner = { h: 'Atas nama', td: h => esc(ownerName(h.pemilik_id)) };
  const lok = lbl => ({ h: lbl, td: h => h.lokasi ? esc(h.lokasi) : '<span class="muted">-</span>' });
  const qty = lbl => ({ h: lbl, num: 1, td: h => `<b>${fmtGram(h.jumlah)}</b> ${esc(h.satuan)}`, sumQty: true });
  const aksi = { h: '', td: h => `<div class="d-flex gap-1 justify-content-end"><button class="icon-btn sm" data-action="editHarta" data-id="${h.harta_id}" aria-label="Edit ${esc(h.nama)}"><i class="bi bi-pencil"></i></button><button class="icon-btn sm" data-action="delHarta" data-id="${h.harta_id}" aria-label="Hapus ${esc(h.nama)}"><i class="bi bi-trash3"></i></button></div>` };
  if (jenis === 'Emas' || jenis === 'Perak') return [
    { h: '', td: h => hartaThumb(h) }, nama, qty('Berat'), tgl, hb,
    { h: 'Beli /gr', num: 1, td: h => rp(per(h)) },
    { h: jenis === 'Emas' ? 'Taksiran buyback' : 'Taksiran', num: 1, td: h => taks(h).pasar ? `<b>${rp(taks(h).v)}</b>` : '<span class="muted">-</span>', sum: h => taks(h).pasar ? taks(h).v : 0 },
    { h: 'Untung/rugi', num: 1, td: gl }, owner, lok('Tempat simpan'), aksi];
  if (jenis === 'Dinar') return [
    { h: '', td: h => hartaThumb(h) }, nama, qty('Jumlah'), tgl, hb, { h: 'Beli /keping', num: 1, td: h => rp(per(h)) },
    { h: 'Taksiran', num: 1, td: h => taks(h).pasar ? `<b>${rp(taks(h).v)}</b>` : '<span class="muted">-</span>', sum: h => taks(h).pasar ? taks(h).v : 0 },
    { h: 'Untung/rugi', num: 1, td: gl }, owner, lok('Tempat simpan'), aksi];
  if (jenis === 'Tanah') return [
    { h: '', td: h => hartaThumb(h) }, nama, qty('Luas'), tgl, hb, { h: 'Beli /m²', num: 1, td: h => rp(per(h)) },
    { h: 'Taksiran', num: 1, td: h => taks(h).pasar ? `<b>${rp(taks(h).v)}</b>` : '<span class="muted">-</span>', sum: h => taks(h).pasar ? taks(h).v : 0 },
    { h: 'Untung/rugi', num: 1, td: gl }, owner, lok('Lokasi'), aksi];
  if (jenis === 'Kendaraan') return [
    { h: '', td: h => hartaThumb(h) }, nama, tgl, { h: 'Usia', td: h => h.tgl_beli ? fmtUsia(usiaTahun(h.tgl_beli)) : '-' }, hb,
    { h: 'Taksiran jual', num: 1, td: h => taks(h).susut ? `<b>±${rp(taks(h).v)}</b>` : '<span class="muted">-</span>', sum: h => taks(h).susut ? taks(h).v : 0 },
    { h: 'Turun', num: 1, td: gl }, owner, lok('Plat / garasi'), aksi];
  return [{ h: '', td: h => hartaThumb(h) }, nama, qty('Jumlah'), tgl, hb, owner, lok('Lokasi'), aksi];
}
function hartaTableHtml(jenis, items) {
  const cols = hartaCols(jenis);
  const head = cols.map(c => `<th${c.num ? ' class="num"' : ''}>${c.h}</th>`).join('');
  const body = items.map(h => `<tr>${cols.map(c => `<td${c.num ? ' class="num"' : ''}>${c.td(h)}</td>`).join('')}</tr>`).join('');
  const qtyT = qtyText(hartaSummary(items)[jenis] ? hartaSummary(items)[jenis].qty : {});
  const foot = cols.map((c, i) => {
    if (i === 1) return `<td><b>Total (${items.length})</b></td>`;
    if (c.sumQty) return `<td class="num"><b>${qtyT}</b></td>`;
    if (c.sum) { const v = items.reduce((s, h) => s + c.sum(h), 0); return `<td class="num"><b>${v ? fmtVal(Math.round(v), 'Rp') : '-'}</b></td>`; }
    return '<td></td>';
  }).join('');
  return `<div class="table-wrap"><table class="tbl harta-tbl"><thead><tr>${head}</tr></thead><tbody>${body}</tbody><tfoot><tr>${foot}</tr></tfoot></table></div>`;
}

// ── Tab "Harta" di Pusat Finansial: pilih jenis → tabel kolom harta jenis itu ──
function hartaPriceBox(k) {
  const t = HARTA[k], hp = hargaPasar(k), tgl = S.settings['harga_' + k + '_tgl'];
  if (t.susut) return `<div class="price-box"><div><small class="muted">Penyusutan</small><b>${fmtN(susutRate(k))}% / tahun</b><small class="muted">${S.settings['harga_' + k] === undefined || S.settings['harga_' + k] === '' ? 'nilai bawaan' : 'diatur manual'}</small></div>
    <button class="btn btn-soft btn-sm" data-action="hartaHarga" data-jenis="${k}"><i class="bi bi-sliders"></i> Ubah</button></div>`;
  if (!t.harga) return '';
  if (k === 'Emas') {
    const auto = S.settings.harga_Emas_src === 'antam';
    return `<div class="price-box"><div><small class="muted">Harga buyback Antam (Logam Mulia)</small><b>${hp ? fmtVal(hp, 'Rp') + ' /gr' : 'Belum ada'}</b>
      <small class="muted">${hp ? (auto ? '<i class="bi bi-arrow-repeat"></i> otomatis · ' : '<i class="bi bi-pencil"></i> manual · ') + (tgl ? fmtDate(tgl) : '') : 'Tekan "Perbarui" untuk mengambil harga hari ini'}</small></div>
      <div class="d-flex gap-2 flex-wrap"><button class="btn btn-dark btn-sm" data-action="hartaRefreshEmas"><i class="bi bi-arrow-clockwise"></i> Perbarui</button>
      <button class="btn btn-soft btn-sm" data-action="hartaHarga" data-jenis="Emas">Atur manual</button></div></div>`;
  }
  if (k === 'Dinar') {
    const est = dinarEstimasi();
    return `<div class="price-box"><div><small class="muted">Harga dinar per keping</small><b>${hargaDinar() ? fmtVal(Math.round(hargaDinar()), 'Rp') : 'Belum ada'}</b>
      <small class="muted">${hp ? 'diatur manual' + (tgl ? ' · ' + fmtDate(tgl) : '') : est ? '≈ buyback emas Antam × 4,25 gr × 91,7% (22K)' : 'Atur harga, atau perbarui harga emas di tab Emas'}</small></div>
      <button class="btn btn-soft btn-sm" data-action="hartaHarga" data-jenis="Dinar"><i class="bi bi-tag"></i> ${hp ? 'Ubah' : 'Atur manual'}</button></div>`;
  }
  return `<div class="price-box"><div><small class="muted">Harga ${k.toLowerCase()} per ${t.satuan}</small><b>${hp ? fmtVal(hp, 'Rp') : 'Belum diatur'}</b><small class="muted">${hp && tgl ? 'diatur ' + fmtDate(tgl) : 'untuk taksiran nilai'}</small></div>
    <button class="btn btn-soft btn-sm" data-action="hartaHarga" data-jenis="${k}"><i class="bi bi-tag"></i> ${hp ? 'Ubah' : 'Atur'}</button></div>`;
}
function finHartaHtml() {
  const owned = hartaOwned();
  const sold = (S.harta || []).filter(h => h.status === 'Dijual');
  const sum = hartaSummary(owned);
  const total = Object.keys(sum).reduce((s, k) => s + sum[k].nilai, 0);
  if (!HARTA[S.ui.hartaJenis]) S.ui.hartaJenis = Object.keys(HARTA).find(k => sum[k]) || 'Emas';
  const k = S.ui.hartaJenis, t = HARTA[k], s = sum[k];
  const tabs = Object.keys(HARTA).map(j => `<button class="chip-btn ${j === k ? 'on' : ''}" data-action="hartaPilih" data-jenis="${j}" aria-pressed="${j === k}">${HARTA[j].emoji} ${j}${sum[j] ? ` <span class="n">${sum[j].n}</span>` : ''}</button>`).join('');
  const items = owned.filter(h => h.jenis === k).sort((a, b) => String(b.tgl_beli).localeCompare(String(a.tgl_beli)));
  const isBar = k === 'Emas' || k === 'Perak';
  const wOf = h => Math.round((h.satuan === 'kg' ? Number(h.jumlah) * 1000 : Number(h.jumlah)) * 1000) / 1000;
  const wCount = {};
  if (isBar) items.forEach(h => { if (h.satuan === 'gram' || h.satuan === 'kg') { const w = wOf(h); wCount[w] = (wCount[w] || 0) + 1; } });
  const wList = Object.keys(wCount).map(Number).sort((a, b) => a - b);
  if (S.ui.hartaGram !== 'all' && !wList.includes(Number(S.ui.hartaGram))) S.ui.hartaGram = 'all';
  const gSel = S.ui.hartaGram || 'all';
  // Filter seri / nama (mis. Certicard Antam, Retro, Gift Series) — dari kolom Nama tanpa angka berat
  const sCount = {}, sLabel = {};
  items.forEach(h => { const sr = seriesOf(h); const key = sr.toLowerCase(); sCount[key] = (sCount[key] || 0) + 1; if (!sLabel[key]) sLabel[key] = sr; });
  const sList = Object.keys(sCount).sort((a, b) => sCount[b] - sCount[a] || a.localeCompare(b));
  if (S.ui.hartaSeri !== 'all' && !sList.includes(S.ui.hartaSeri)) S.ui.hartaSeri = 'all';
  const sSel = S.ui.hartaSeri || 'all';
  const shown = items.filter(h => (!isBar || gSel === 'all' || ((h.satuan === 'gram' || h.satuan === 'kg') && wOf(h) === Number(gSel)))
    && (sSel === 'all' || seriesOf(h).toLowerCase() === sSel));
  const sFilter = sList.length > 1 ? `<div class="filter-row"><span class="tiny muted fw-bold">Seri / nama</span><div class="chips chips-wrap seri-filter" role="tablist" aria-label="Filter seri">
      <button class="chip-btn ${sSel === 'all' ? 'on' : ''}" data-action="hartaSeri" data-seri="all" aria-pressed="${sSel === 'all'}">Semua <span class="n">${items.length}</span></button>
      ${sList.map(key => `<button class="chip-btn ${sSel === key ? 'on' : ''}" data-action="hartaSeri" data-seri="${esc(key)}" aria-pressed="${sSel === key}">${esc(sLabel[key])} <span class="n">${sCount[key]}</span></button>`).join('')}
    </div></div>` : '';
  const gFilter = isBar && wList.length > 1 ? `<div class="filter-row"><span class="tiny muted fw-bold">Berat</span><div class="chips chips-wrap gram-filter" role="tablist" aria-label="Filter berat">
      <button class="chip-btn ${gSel === 'all' ? 'on' : ''}" data-action="hartaGram" data-gram="all" aria-pressed="${gSel === 'all'}">Semua <span class="n">${items.length}</span></button>
      ${wList.map(w => `<button class="chip-btn ${String(gSel) === String(w) ? 'on' : ''}" data-action="hartaGram" data-gram="${w}" aria-pressed="${String(gSel) === String(w)}">${fmtGram(w)} gr <span class="n">${wCount[w]}</span></button>`).join('')}
    </div></div>` : '';
  const soldK = sold.filter(h => h.jenis === k);
  const modalTxt = s && s.modal ? 'modal ' + fmtShort(s.modal, 'Rp') : '';
  const head = `<div class="card harta-head-card">
      <div class="harta-head">
        <div class="harta-ic tint" style="--c:${t.c}" aria-hidden="true">${k === 'Emas' || k === 'Perak' ? barSvg(s ? (s.qty.gram || 0) + (s.qty.kg || 0) * 1000 : 0, k, 46) : k === 'Dinar' ? coinSvg(1, 44) : t.emoji}</div>
        <div class="flex-grow-1" style="min-width:0">
          <div class="tiny muted fw-bold">${esc(k)} yang dimiliki · ${s ? s.n : 0} catatan</div>
          <div class="harta-total">${s ? qtyText(s.qty) : '0 ' + t.satuan}</div>
          <div class="tiny muted">${s ? 'Taksiran ' + fmtShort(s.nilai, 'Rp') + (modalTxt ? ' · ' + modalTxt : '') : 'Belum ada catatan'}</div>
        </div>
        <button class="btn btn-dark btn-sm harta-add" data-action="newHarta" data-jenis="${k}"><i class="bi bi-plus-lg"></i> Tambah ${esc(k.toLowerCase())}</button>
      </div>
      ${hartaPriceBox(k)}
    </div>`;
  const table = items.length ? `<div class="card mt-3">${sFilter}${gFilter}${shown.length ? hartaTableHtml(k, shown) : '<p class="muted my-3">Tidak ada catatan yang cocok dengan filter ini.</p>'}${k === 'Emas' ? '<p class="tiny muted mt-2 mb-0"><i class="bi bi-info-circle"></i> Taksiran = berat × harga buyback hari ini, sebelum PPh 22 (penjualan > Rp 10 jt dipotong 1,5% dengan NPWP / 3% tanpa NPWP). Harga buyback Antam sama di semua butik, termasuk Balikpapan.</p>' : ''}</div>`
    : `<div class="card mt-3">${emptyHtml(t.icon, `Belum ada ${k.toLowerCase()} tercatat.`, `<button class="btn btn-dark btn-sm" data-action="newHarta" data-jenis="${k}">Catat ${k.toLowerCase()} pertama</button>`)}</div>`;
  const soldHtml = soldK.length ? `<details class="card mt-3"><summary class="fw-bold">Riwayat ${k.toLowerCase()} dijual (${soldK.length})</summary>
    <div class="table-wrap mt-2"><table class="tbl harta-tbl"><thead><tr><th></th><th>Nama</th><th class="num">Jumlah</th><th>Tgl jual</th><th class="num">Harga jual</th><th class="num">Modal</th><th></th></tr></thead><tbody>
    ${soldK.map(h => `<tr><td>${hartaThumb(h, 30)}</td><td><b>${esc(h.nama)}</b></td><td class="num">${fmtGram(h.jumlah)} ${esc(h.satuan)}</td><td>${h.tgl_jual ? fmtDate(h.tgl_jual) : '-'}</td><td class="num">${Number(h.harga_jual) ? fmtVal(h.harga_jual, 'Rp') : '-'}</td><td class="num">${Number(h.harga_beli) ? fmtVal(h.harga_beli, 'Rp') : '-'}</td>
      <td><button class="icon-btn sm" data-action="editHarta" data-id="${h.harta_id}" aria-label="Edit"><i class="bi bi-pencil"></i></button></td></tr>`).join('')}</tbody></table></div></details>` : '';
  return `<div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-2">
      <p class="tiny muted mb-0">Taksiran total semua harta <b style="color:var(--text);font-size:16px">${fmtShort(total, 'Rp')}</b></p>
      <button class="btn btn-soft btn-sm" data-action="newHarta"><i class="bi bi-plus-lg"></i> Harta lain</button></div>
    <div class="chips chips-wrap mb-3" role="tablist" aria-label="Jenis harta">${tabs}</div>
    ${head}${table}${soldHtml}`;
}

// ── Form tambah / edit harta ──
function openHartaForm(id, jenis) {
  const h = (S.harta || []).find(x => x.harta_id === id) || { harta_id: uid(), jenis: HARTA[jenis] ? jenis : 'Emas', nama: '', jumlah: '', satuan: '', harga_beli: '', tgl_beli: today(), pemilik_id: '', lokasi: '', status: 'Dimiliki', tgl_jual: '', harga_jual: '', catatan: '' };
  if (!h.satuan) h.satuan = HARTA[h.jenis].satuan;
  const t = HARTA[h.jenis];
  openSheet(id ? 'Edit Harta' : 'Harta Baru ' + t.emoji, `
  <form data-form="harta" novalidate>
    <input type="hidden" name="harta_id" value="${esc(h.harta_id)}">
    <div class="field"><span>Jenis harta</span><div class="chips chips-wrap">
      ${Object.keys(HARTA).map(k => `<label class="chip-btn ${h.jenis === k ? 'on' : ''}"><input type="radio" name="jenis" value="${k}" class="visually-hidden" data-change="hartaJenis" ${h.jenis === k ? 'checked' : ''}>${HARTA[k].emoji} ${k}</label>`).join('')}
    </div></div>
    <label class="field"><span>Nama / seri <small>(dipakai untuk filter)</small></span><input name="nama" maxlength="80" list="hartaNamaList" value="${esc(h.nama)}" placeholder="${esc(t.contoh)}">
      <datalist id="hartaNamaList">${[...new Set(['Certicard Antam', 'Retro', 'Gift Series', 'Antam Batik', 'Antam Imlek', 'Antam Idul Fitri', 'UBS', 'Galeri24'].concat((S.harta || []).map(x => seriesOf(x)).filter(x => x !== 'Tanpa seri')))].map(n => `<option value="${esc(n)}">`).join('')}</datalist>
      <small>Cukup tulis serinya, mis. "Certicard Antam" atau "Retro" — berat diisi di kolom Jumlah.</small></label>
    <div class="grid-2">
      <label class="field"><span>Jumlah</span><input name="jumlah" inputmode="decimal" data-input="hartaCalc" value="${h.jumlah !== '' ? esc(String(h.jumlah).replace('.', ',')) : ''}" placeholder="${h.jenis === 'Tanah' ? '200' : h.jenis === 'Emas' || h.jenis === 'Perak' ? '5' : '1'}"><em class="field-err"></em></label>
      <label class="field"><span>Satuan</span><select name="satuan" data-change="hartaCalc">${HARTA_SATUAN.concat(HARTA_SATUAN.includes(h.satuan) ? [] : [h.satuan]).map(s => `<option ${h.satuan === s ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select></label>
      <label class="field"><span>Harga beli total (Rp) <small>(opsional)</small></span><input name="harga_beli" inputmode="numeric" data-money data-input="hartaCalc" value="${Number(h.harga_beli) ? fmtN(h.harga_beli) : ''}" placeholder="0"></label>
      <label class="field"><span>Tanggal beli</span><input type="date" name="tgl_beli" value="${esc(h.tgl_beli)}"></label>
      <label class="field"><span>Pemilik / atas nama</span><select name="pemilik_id">${ownerOptions(h.pemilik_id)}</select></label>
      <label class="field"><span>Lokasi / tempat simpan <small>(opsional)</small></span><input name="lokasi" maxlength="120" value="${esc(h.lokasi)}" placeholder="${esc(t.simpan)}"></label>
    </div>
    ${id ? `<div class="grid-2">
      <label class="field"><span>Status</span><select name="status" data-change="hartaStatus">${['Dimiliki', 'Dijual'].map(s => `<option ${h.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select></label>
      <span></span>
      <label class="field sold-f" ${h.status === 'Dijual' ? '' : 'hidden'}><span>Tanggal jual</span><input type="date" name="tgl_jual" value="${esc(h.tgl_jual || today())}"></label>
      <label class="field sold-f" ${h.status === 'Dijual' ? '' : 'hidden'}><span>Harga jual (Rp)</span><input name="harga_jual" inputmode="numeric" data-money value="${Number(h.harga_jual) ? fmtN(h.harga_jual) : ''}"></label>
    </div>` : '<input type="hidden" name="status" value="Dimiliki"><input type="hidden" name="tgl_jual" value=""><input type="hidden" name="harga_jual" value="">'}
    <label class="field"><span>Catatan <small>(opsional)</small></span><input name="catatan" maxlength="300" value="${esc(h.catatan)}" placeholder="mis. no. sertifikat, kadar 24K"></label>
    <div class="card" style="box-shadow:none;background:var(--soft)"><p class="mb-0 tiny fw-bold" id="hartaPreview"></p></div>
    <div class="sheet-foot"><button type="button" class="btn btn-soft" data-action="closeSheet">Batal</button><button class="btn btn-dark" type="submit">Simpan</button></div>
  </form>`);
  hartaPreview($('#sheet form'));
}
function hartaFromForm(f) {
  const jenis = (f.querySelector('input[name=jenis]:checked') || {}).value || 'Emas';
  return {
    harta_id: f.harta_id.value, jenis, nama: f.nama.value.trim() || jenis, jumlah: parseNum(f.jumlah.value), satuan: f.satuan.value,
    harga_beli: parseNum(f.harga_beli.value, true), tgl_beli: f.tgl_beli.value, pemilik_id: f.pemilik_id.value, lokasi: f.lokasi.value.trim(),
    status: f.status.value, tgl_jual: f.status.value === 'Dijual' ? f.tgl_jual.value : '', harga_jual: f.status.value === 'Dijual' ? parseNum(f.harga_jual.value, true) : 0,
    catatan: f.catatan.value.trim()
  };
}
function hartaPreview(f) {
  const el = $('#hartaPreview');
  if (!el || !f) return;
  const h = hartaFromForm(f);
  const same = hartaOwned().filter(x => x.jenis === h.jenis && x.satuan === h.satuan && x.harta_id !== h.harta_id);
  const before = same.reduce((s, x) => s + Number(x.jumlah), 0);
  const parts = [];
  if (h.jumlah > 0) parts.push(`Total ${h.jenis.toLowerCase()} setelah disimpan: ${fmtQty(before + (h.status === 'Dijual' ? 0 : h.jumlah), h.satuan)}`);
  if (h.jumlah > 0 && h.harga_beli > 0) parts.push(`harga beli ${fmtVal(Math.round(h.harga_beli / h.jumlah), 'Rp')}/${h.satuan}`);
  const hp = hargaPasar(h.jenis);
  if (HARTA[h.jenis].susut && h.harga_beli > 0 && h.tgl_beli) { const n = hartaNilai(h); parts.push(`taksiran jual sekarang ±${fmtShort(n.v, 'Rp')} (usia ${fmtUsia(n.usia)}, susut ${fmtN(n.rate)}%/thn)`); }
  if (h.jenis === 'Dinar' && h.jumlah > 0 && !hp && dinarEstimasi()) parts.push(`taksiran ±${fmtShort(h.jumlah * dinarEstimasi(), 'Rp')} (dari harga buyback emas)`);
  if (HARTA[h.jenis].harga && h.jumlah > 0 && hp > 0 && h.satuan === HARTA[h.jenis].satuan) parts.push(`taksiran sekarang ${fmtShort(h.jumlah * hp, 'Rp')}`);
  const txt = esc(parts.length ? parts.join(' · ') : 'Isi jumlah (mis. 5 gram, 200 m²) untuk melihat total.');
  el.innerHTML = ((h.jenis === 'Emas' || h.jenis === 'Perak') && (h.satuan === 'gram' || h.satuan === 'kg') || h.jenis === 'Dinar') && h.jumlah > 0
    ? `<span class="d-flex align-items-center gap-3">${hartaThumb(h, 44)}<span>${txt}</span></span>` : txt;
}
function submitHarta(f) {
  const h = hartaFromForm(f);
  if (!(h.jumlah > 0)) { const fe = f.jumlah.closest('.field'); fe.classList.add('invalid'); fe.querySelector('.field-err').textContent = 'Isi jumlah, mis. 5 atau 0,5.'; return; }
  S.harta = S.harta || [];
  const ex = S.harta.find(x => x.harta_id === h.harta_id);
  if (ex) Object.assign(ex, h, { diubah_pada: nowIso() });
  else S.harta.push(Object.assign({ dibuat_oleh: S.me.user_id, dibuat_pada: nowIso(), diubah_pada: nowIso() }, h));
  saveSnapshot(); closeSheet(); S.ui.finTab = 'harta';
  if (S.ui.page === 'finance') { if (S.ui.hartaJenis !== h.jenis) { S.ui.hartaJenis = h.jenis; S.ui.hartaGram = 'all'; } keepScroll(renderFinance); }
  else { S.ui.hartaJenis = h.jenis; navigateTo('finance'); }
  const tot = hartaSummary(hartaOwned())[h.jenis];
  toast(ex ? 'Harta diperbarui' : `${HARTA[h.jenis].emoji} Tercatat! Total ${h.jenis.toLowerCase()}: ${tot ? qtyText(tot.qty) : '-'}`);
  Outbox.push('saveHarta', [h]);
}

// ── Form harga pasar per satuan (emas/gram, tanah/m²) ──
function openHargaForm(jenis) {
  const t = HARTA[jenis]; if (!t) return;
  if (t.susut) {
    openSheet(`Penyusutan ${jenis} ${t.emoji}`, `
    <form data-form="hargaHarta"><input type="hidden" name="jenis" value="${jenis}">
      <p class="muted tiny">Taksiran harga jual = harga beli × (1 − penyusutan)<sup>usia</sup>. Di Indonesia, mobil Jepang populer (Avanza, Xenia, BR-V, dll) umumnya turun ±5–6% per tahun dalam harga jual ke dealer; mobil mewah/Eropa dan motor biasanya lebih cepat (10–15%). Cocokkan dengan harga bekas di OLX/Carmudi untuk tahun & tipe yang sama.</p>
      <label class="field"><span>Penyusutan per tahun (%)</span><input name="harga" inputmode="decimal" data-input="susutCalc" value="${fmtN(susutRate(jenis))}"></label>
      <div class="card" style="box-shadow:none;background:var(--soft)"><div class="tiny fw-bold" id="susutPreview"></div></div>
      <div class="sheet-foot"><button type="button" class="btn btn-soft" data-action="closeSheet">Batal</button><button class="btn btn-dark" type="submit">Simpan</button></div>
    </form>`);
    susutPreview($('#sheet form'));
    return;
  }
  const hp = hargaPasar(jenis);
  openSheet(`Harga ${jenis} ${t.emoji}`, `
  <form data-form="hargaHarta"><input type="hidden" name="jenis" value="${jenis}">
    <p class="muted tiny">Dipakai untuk menaksir nilai ${jenis.toLowerCase()} yang Anda miliki. Perbarui sesekali${jenis === 'Emas' ? ', mis. dari harga buyback Antam/Pegadaian hari ini' : ''}. Kosongkan untuk memakai harga beli.</p>
    <label class="field"><span>Harga per ${t.satuan} (Rp)</span><input name="harga" inputmode="numeric" data-money value="${hp ? fmtN(hp) : ''}" placeholder="${jenis === 'Emas' ? '1.500.000' : jenis === 'Tanah' ? '2.000.000' : '15.000'}"></label>
    <div class="sheet-foot"><button type="button" class="btn btn-soft" data-action="closeSheet">Batal</button><button class="btn btn-dark" type="submit">Simpan</button></div>
  </form>`);
}
function susutPreview(f) {
  const el = $('#susutPreview'); if (!el || !f) return;
  const r = Math.min(90, Math.max(0, parseNum(f.harga.value)));
  const cars = hartaOwned().filter(h => h.jenis === f.jenis.value && Number(h.harga_beli) > 0 && h.tgl_beli);
  el.innerHTML = cars.length ? cars.map(h => { const th = usiaTahun(h.tgl_beli); return `${esc(h.nama)}: ${fmtShort(h.harga_beli, 'Rp')} (${fmtUsia(th)}) → <b>±${fmtShort(Number(h.harga_beli) * Math.pow(1 - r / 100, th), 'Rp')}</b>`; }).join('<br>')
    : 'Belum ada kendaraan dengan harga & tanggal beli.';
}
function submitHarga(f) {
  const jenis = f.jenis.value, isSusut = !!HARTA[jenis].susut;
  const v = isSusut ? Math.min(90, Math.max(0, parseNum(f.harga.value))) : parseNum(f.harga.value, true);
  if (isSusut) {
    S.settings['harga_' + jenis] = String(v); S.settings['harga_' + jenis + '_tgl'] = today();
    saveSnapshot(); closeSheet(); S.ui.finTab = 'harta'; keepScroll(renderFinance);
    toast(`Penyusutan ${jenis.toLowerCase()} ${fmtN(v)}%/tahun disimpan`);
    Outbox.push('saveHargaHarta', [jenis, v]);
    return;
  }
  S.settings['harga_' + jenis] = v ? String(v) : '';
  S.settings['harga_' + jenis + '_tgl'] = v ? today() : '';
  if (jenis === 'Emas') S.settings.harga_Emas_src = v ? 'manual' : '';
  saveSnapshot(); closeSheet(); S.ui.finTab = 'harta'; keepScroll(renderFinance);
  toast(v ? `Harga ${jenis.toLowerCase()} ${fmtShort(v, 'Rp')}/${HARTA[jenis].satuan} disimpan` : 'Harga dihapus');
  Outbox.push('saveHargaHarta', [jenis, v || '']);
}

// ── Ekspor ──
function hartaRowsExport() {
  return (S.harta || []).map(h => ({
    'Jenis': h.jenis, 'Nama': h.nama, 'Jumlah': Number(h.jumlah), 'Satuan': h.satuan, 'Harga beli (Rp)': Number(h.harga_beli) || 0, 'Tanggal beli': h.tgl_beli || '-',
    'Atas nama': ownerName(h.pemilik_id), 'Lokasi': h.lokasi || '-', 'Status': h.status, 'Taksiran nilai (Rp)': h.status === 'Dijual' ? 0 : Math.round(hartaNilai(h).v),
    'Tanggal jual': h.tgl_jual || '-', 'Harga jual (Rp)': Number(h.harga_jual) || 0, 'Catatan': h.catatan || ''
  }));
}

// ── Daftarkan aksi, form & input ──
Object.assign(Actions, {
  newHarta: d => openHartaForm(null, d.jenis),
  editHarta: d => openHartaForm(d.id),
  hartaHarga: d => openHargaForm(d.jenis),
  hartaPilih: d => { S.ui.hartaJenis = d.jenis; S.ui.hartaGram = 'all'; S.ui.hartaSeri = 'all'; keepScroll(renderFinance); },
  hartaSeri: d => { S.ui.hartaSeri = d.seri; keepScroll(renderFinance); },
  hartaGram: d => {
    S.ui.hartaGram = d.gram === 'all' ? 'all' : Number(d.gram); keepScroll(renderFinance);
  },
  hartaRefreshEmas: (d, el) => {
    setBusy(el, true);
    api('refreshHargaEmas', S.token).then(p => { keepScroll(() => applyPayload(p)); toast('Harga buyback emas: ' + fmtVal(hargaPasar('Emas'), 'Rp') + '/gr (' + fmtDate(S.settings.harga_Emas_tgl) + ')'); })
      .catch(e => { setBusy(el, false); const m = String(e.message || ''); toast(/UrlFetchApp|external_request|permission/i.test(m) ? 'Backend belum diberi izin akses internet. Di Apps Script, jalankan fungsi perbaruiHargaEmasSekarang sekali lalu klik Izinkan.' : (m || 'Gagal mengambil harga emas.'), 'error'); });
  },
  delHarta: d => confirmBox({ title: 'Hapus catatan harta ini?', text: 'Kalau hartanya dijual, sebaiknya Edit → status "Dijual" agar riwayatnya tetap ada.', ok: 'Hapus', danger: true }, () => {
    S.harta = (S.harta || []).filter(x => x.harta_id !== d.id); saveSnapshot(); keepScroll(renderAll); toast('Catatan harta dihapus'); Outbox.push('deleteHarta', [d.id]);
  })
});
Object.assign(Changes, {
  hartaJenis: el => {
    const f = el.form, t = HARTA[el.value];
    f.querySelectorAll('input[name=jenis]').forEach(r => r.closest('.chip-btn').classList.toggle('on', r.checked));
    f.satuan.value = t.satuan; f.nama.placeholder = t.contoh; f.lokasi.placeholder = t.simpan;
    hartaPreview(f);
  },
  hartaCalc: el => hartaPreview(el.form),
  hartaStatus: el => { el.form.querySelectorAll('.sold-f').forEach(x => { x.hidden = el.value !== 'Dijual'; }); }
});
Object.assign(Inputs, { hartaCalc: debounce(el => hartaPreview(el.form), 150), susutCalc: debounce(el => susutPreview(el.form), 120) });
Object.assign(Forms, { harta: f => submitHarta(f), hargaHarta: f => submitHarga(f) });
window.__GT_PARTS = (window.__GT_PARTS || []).concat('JS6');
