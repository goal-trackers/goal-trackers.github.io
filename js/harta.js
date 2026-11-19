/* GOAL TRACKERS — js/harta.js: Harta (emas, perak, tanah, rumah, kendaraan, lainnya)
   Tiap kepemilikan dicatat satu baris. Beli emas/tanah baru = tambah baris baru,
   lalu total per jenis (mis. emas 15 gram) dihitung otomatis. */
const HARTA = {
  Emas:      { satuan: 'gram', emoji: '🪙', icon: 'bi-coin',          c: '#FBEBB5', harga: true,  contoh: 'mis. Antam 5 gr',            simpan: 'mis. Brankas rumah / Pegadaian' },
  Perak:     { satuan: 'gram', emoji: '🥈', icon: 'bi-disc',          c: '#E6E8EE', harga: true,  contoh: 'mis. Perak batangan 100 gr', simpan: 'mis. Brankas rumah' },
  Dinar:     { satuan: 'keping', emoji: '🟡', icon: 'bi-moon-stars', c: '#FFE1C7', harga: true,  contoh: 'mis. Dinar 22K 4,25 gr',     simpan: 'mis. Brankas rumah' },
  Tanah:     { satuan: 'm²',   emoji: '🌳', icon: 'bi-tree',          c: '#CFF2D6', harga: true,  contoh: 'mis. Tanah kavling Batu',    simpan: 'mis. Jl. Mawar No. 3, Batu' },
  Rumah:     { satuan: 'unit', emoji: '🏠', icon: 'bi-house-door',    c: '#F8CFE0', harga: false, contoh: 'mis. Rumah Perum Griya',     simpan: 'Alamat' },
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
const LOGAM = ['Emas', 'Perak', 'Dinar'];
/** Harga pasar milik item sendiri (mis. harga tanah per m² di lokasinya) — dipakai sebelum harga umum. */
const hargaItem = h => LOGAM.includes(h.jenis) ? 0 : (Number(h.harga_pasar) || 0);
function hartaNilai(h) {
  const t = HARTA[h.jenis] || {}, beli = Number(h.harga_beli) || 0;
  const hi = hargaItem(h);
  if (hi > 0) return { v: Number(h.jumlah) * hi, pasar: true, item: true, per: hi };
  if (t.susut && beli > 0 && h.tgl_beli) {
    const r = susutRate(h.jenis), th = usiaTahun(h.tgl_beli);
    return { v: beli * Math.pow(1 - r / 100, th), susut: true, usia: th, rate: r };
  }
  const hp = hargaPasar(h.jenis);
  if (t.harga && hp > 0 && h.satuan === t.satuan) return { v: Number(h.jumlah) * hp, pasar: true, umum: true, per: hp };
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
/** Ikon bulat berwarna (gaya Pinterest) untuk jenis harta */
const hIc = k => `<span class="cat-ic" style="--c:${HARTA[k].c}"><i class="bi ${HARTA[k].icon}"></i></span>`;
function hartaThumb(h, w) {
  if (h.jenis === 'Dinar') return coinSvg(Number(h.jumlah) === 0.5 ? 0.5 : 1, w);
  if ((h.jenis === 'Emas' || h.jenis === 'Perak') && (h.satuan === 'gram' || h.satuan === 'kg')) return barSvg(h.satuan === 'kg' ? Number(h.jumlah) * 1000 : h.jumlah, h.jenis, w);
  const t = HARTA[h.jenis] || HARTA.Lainnya;
  return `<span class="harta-emoji tint" style="--c:${t.c}"><i class="bi ${t.icon}"></i></span>`;
}

/** Nama seri dari kolom Nama tanpa angka berat: "Certicard Antam 5 gr" → "Certicard Antam". */
function seriesOf(h) {
  let n = String(h.nama || '').replace(/\(?\b\d+(?:[.,]\d+)?\s*(?:gr|gram|g|kg|keping|kpg)\b\.?\)?/gi, ' ').replace(/#\d+/g, ' ').replace(/\s+/g, ' ').replace(/^[\s\-·,]+|[\s\-·,]+$/g, '').trim();
  if (!n || n.toLowerCase() === String(h.jenis).toLowerCase()) n = 'Tanpa seri';
  return n;
}
/** Apakah kombinasi filter seri + berat saat ini punya isi? (kalau tidak, filter lain direset agar tabel tidak kosong) */
function hartaComboAda() {
  const k = S.ui.hartaJenis, sSel = S.ui.hartaSeri || 'all', gSel = S.ui.hartaGram || 'all';
  return hartaOwned().some(h => h.jenis === k && (sSel === 'all' || seriesOf(h).toLowerCase() === sSel)
    && (gSel === 'all' || ((h.satuan === 'gram' || h.satuan === 'kg') && Math.round((h.satuan === 'kg' ? h.jumlah * 1000 : Number(h.jumlah)) * 1000) / 1000 === Number(gSel))));
}
/** Render ulang tanpa melompat ke atas: simpan posisi gulir halaman & tabel. */
function keepScroll(fn) {
  const y = window.scrollY, w0 = document.querySelector('#page-finance .harta-scroll');
  const tl = w0 ? w0.scrollLeft : 0, tt = w0 ? w0.scrollTop : 0;
  fn();
  window.scrollTo(0, y);
  const w = document.querySelector('#page-finance .harta-scroll'); if (w) { w.scrollLeft = tl; w.scrollTop = tt; }
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
    { h: '', td: h => hartaThumb(h, 30) }, nama, qty('Berat'), tgl, hb,
    { h: 'Beli /gr', num: 1, td: h => rp(per(h)) },
    { h: jenis === 'Emas' ? 'Taksiran buyback' : 'Taksiran', num: 1, td: h => taks(h).pasar ? `<b>${rp(taks(h).v)}</b>` : '<span class="muted">-</span>', sum: h => taks(h).pasar ? taks(h).v : 0 },
    { h: 'Untung/rugi', num: 1, td: gl }, owner, lok('Tempat simpan'), aksi];
  if (jenis === 'Dinar') return [
    { h: '', td: h => hartaThumb(h, 30) }, nama, qty('Jumlah'), tgl, hb, { h: 'Beli /keping', num: 1, td: h => rp(per(h)) },
    { h: 'Taksiran', num: 1, td: h => taks(h).pasar ? `<b>${rp(taks(h).v)}</b>` : '<span class="muted">-</span>', sum: h => taks(h).pasar ? taks(h).v : 0 },
    { h: 'Untung/rugi', num: 1, td: gl }, owner, lok('Tempat simpan'), aksi];
  if (jenis === 'Tanah') return [
    { h: '', td: h => hartaThumb(h, 30) }, nama, qty('Luas'), tgl, hb, { h: 'Beli /m²', num: 1, td: h => rp(per(h)) },
    { h: 'Pasar /m²', num: 1, td: h => { const n = taks(h); return n.per ? rp(n.per) + `<br><small class="muted">${n.item ? 'harga lokasi' : 'harga umum'}</small>` : '<span class="muted">-</span>'; } },
    { h: 'Taksiran', num: 1, td: h => taks(h).pasar ? `<b>${rp(taks(h).v)}</b>` : '<span class="muted">-</span>', sum: h => taks(h).pasar ? taks(h).v : 0 },
    { h: 'Untung/rugi', num: 1, td: gl }, owner, lok('Lokasi'), aksi];
  if (jenis === 'Kendaraan') return [
    { h: '', td: h => hartaThumb(h, 30) }, nama, tgl, { h: 'Usia', td: h => h.tgl_beli ? fmtUsia(usiaTahun(h.tgl_beli)) : '-' }, hb,
    { h: 'Taksiran jual', num: 1, td: h => taks(h).susut ? `<b>±${rp(taks(h).v)}</b>` : '<span class="muted">-</span>', sum: h => taks(h).susut ? taks(h).v : 0 },
    { h: 'Turun', num: 1, td: gl }, owner, lok('Plat / garasi'), aksi];
  return [{ h: '', td: h => hartaThumb(h, 30) }, nama, qty('Jumlah'), tgl, hb, owner, lok('Lokasi'), aksi];
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
  return `<div class="table-wrap harta-scroll"><table class="tbl harta-tbl"><thead><tr>${head}</tr></thead><tbody>${body}</tbody><tfoot><tr>${foot}</tr></tfoot></table></div>`;
}

/** Kartu satu harta (tampilan Kartu & Peta perjalanan) */
function hartaItemCard(h) {
  const t = HARTA[h.jenis] || HARTA.Lainnya, n = hartaNilai(h), beli = Number(h.harga_beli) || 0;
  const d = beli && (n.pasar || n.susut) ? n.v - beli : null;
  return `<div class="card harta-item tint fin-note" style="--c:${t.c}">
    <div class="d-flex align-items-center gap-3">
      <div class="harta-item-pic">${hartaThumb(h, h.jenis === 'Emas' || h.jenis === 'Perak' ? 46 : 50)}</div>
      <div class="flex-grow-1" style="min-width:0">
        <div class="fw-bold text-truncate" style="font-size:16px">${esc(h.nama)}</div>
        <div class="harta-total" style="font-size:20px">${fmtGram(h.jumlah)} ${esc(h.satuan)}</div>
        <div class="tiny muted">${h.tgl_beli ? 'Beli ' + fmtDate(h.tgl_beli) : 'Tanggal beli -'}${h.tgl_beli && n.susut ? ' · usia ' + fmtUsia(n.usia) : ''}</div>
        ${n.per && !LOGAM.includes(h.jenis) ? `<div class="tiny mt-1"><span class="hp-tag ${n.item ? 'item' : ''}">@ ${fmtShort(n.per, 'Rp')}/${esc(h.satuan)} · ${n.item ? 'harga lokasi' : 'harga umum'}</span></div>` : ''}
      </div>
    </div>
    <div class="kv mt-3">
      <div><small>Harga beli</small><b>${beli ? fmtShort(beli, 'Rp') : '-'}</b></div>
      <div><small>${n.susut ? 'Taksiran jual' : h.jenis === 'Emas' ? 'Taksiran buyback' : 'Taksiran'}</small><b>${n.pasar || n.susut ? fmtShort(n.v, 'Rp') : '-'}</b>${d !== null ? `<small style="color:${d >= 0 ? 'var(--green-ink,#1B7F3A)' : 'var(--red-ink)'}">${d >= 0 ? '+' : '−'}${fmtShort(Math.abs(d), 'Rp')}</small>` : ''}</div>
    </div>
    <div class="d-flex align-items-center gap-2 mt-3">
      <span class="tiny muted flex-grow-1 text-truncate">${esc(ownerName(h.pemilik_id))}${h.lokasi ? ' · ' + esc(h.lokasi) : ''}</span>
      <button class="icon-btn sm" data-action="editHarta" data-id="${h.harta_id}" aria-label="Edit ${esc(h.nama)}"><i class="bi bi-pencil"></i></button>
      <button class="icon-btn sm" data-action="delHarta" data-id="${h.harta_id}" aria-label="Hapus ${esc(h.nama)}"><i class="bi bi-trash3"></i></button>
    </div>
  </div>`;
}

// ── Tab "Harta" di Pusat Finansial: pilih jenis → tabel kolom harta jenis itu ──
/** Harga acuan per jenis — pil ringkas (gaya sama dengan kurs dolar): nilai · sumber/tanggal · Perbarui/Ubah */
function hartaPriceBox(k) {
  const t = HARTA[k], hp = hargaPasar(k), tgl = S.settings['harga_' + k + '_tgl'];
  const pill = (ic, label, sub, btns, note = '') => `<div class="harta-price"><span class="kurs-pill" style="--kp:${t.c}"><i class="bi ${ic}"></i> ${label} ${sub ? `<small class="muted">${sub}</small>` : ''}${btns}</span>${note ? `<small class="d-block muted mt-1">${note}</small>` : ''}</div>`;
  const ubah = (txt = 'Ubah') => `<button type="button" class="link-btn" data-action="hartaHarga" data-jenis="${k}">${txt}</button>`;
  if (t.susut) return pill('bi-graph-down-arrow', `Penyusutan ${fmtN(susutRate(k))}%/tahun`, S.settings['harga_' + k] === undefined || S.settings['harga_' + k] === '' ? 'nilai bawaan' : 'manual', ubah());
  if (!t.harga) return '';
  if (k === 'Emas') {
    const man = S.settings.harga_Emas_src === 'manual';
    return pill('bi-coin', hp ? `Buyback Antam ${fmtVal(hp, 'Rp')}/gr` : 'Buyback Antam belum ada',
      hp ? `${man ? 'manual' : 'otomatis'}${tgl ? ' · ' + fmtDate(tgl) : ''}` : 'tekan Perbarui',
      `<button type="button" class="link-btn" data-action="hartaRefreshEmas"><i class="bi bi-arrow-clockwise"></i> Perbarui</button>${ubah()}`);
  }
  if (k === 'Dinar') {
    const est = dinarEstimasi();
    return pill('bi-moon-stars', hargaDinar() ? `Dinar ${fmtVal(Math.round(hargaDinar()), 'Rp')}/keping` : 'Harga dinar belum ada',
      hp ? 'manual' + (tgl ? ' · ' + fmtDate(tgl) : '') : est ? 'otomatis dari buyback emas' : 'atur, atau perbarui harga emas',
      ubah(hp ? 'Ubah' : 'Atur manual'), !hp && est ? '≈ buyback emas Antam × 4,25 gr × 91,7% (22K)' : '');
  }
  if (k === 'Tanah') return pill('bi-geo-alt', hp ? `Harga umum ${fmtVal(hp, 'Rp')}/m²` : 'Harga umum tanah belum diatur', hp ? 'manual' + (tgl ? ' · ' + fmtDate(tgl) : '') : '',
    ubah(hp ? 'Ubah' : 'Atur'), 'Dipakai untuk tanah yang belum punya harga lokasi sendiri — harga per lokasi diisi lewat ✏️ Edit di tiap tanah.');
  return pill(t.icon, hp ? `Harga ${k.toLowerCase()} ${fmtVal(hp, 'Rp')}/${t.satuan}` : `Harga ${k.toLowerCase()} belum diatur`, hp && tgl ? 'manual · ' + fmtDate(tgl) : 'untuk taksiran nilai', ubah(hp ? 'Ubah' : 'Atur'));
}
/** Pilihan jenis harta sebagai teks (gaya navbar) + tombol Harta lain — tampil di kanan judul Pusat Finansial */
/** Ringkasan jenis harta terpilih (dihitung ulang tiap render → otomatis ikut berubah saat harta ditambah/diubah) */
function hartaJenisSummary() {
  const sum = hartaSummary(hartaOwned()), k = HARTA[S.ui.hartaJenis] ? S.ui.hartaJenis : 'Emas', t = HARTA[k], s = sum[k];
  const noun = { Emas: 'keping', Perak: 'keping', Tanah: 'bidang' }[k];
  const jml = s ? (noun ? `${s.n} ${noun} / ${qtyText(s.qty)}` : qtyText(s.qty)) : (noun ? `0 ${noun}` : '0 ' + t.satuan);
  return `<div class="harta-head-plain">
      <div class="d-flex justify-content-between align-items-start gap-2 flex-wrap">
        <div style="min-width:0">
          <div class="harta-own">${esc(k)} yang dimiliki <b>${jml}</b></div>
          <div class="tiny muted">${s ? `Taksiran ${fmtShort(s.nilai, 'Rp')}${s.modal ? ` · Modal ${fmtShort(s.modal, 'Rp')}` : ''}` : 'Belum ada catatan'}</div>
        </div>
        <button class="btn btn-dark btn-sm harta-add" data-action="newHarta" data-jenis="${k}"><i class="bi bi-plus-lg"></i> Tambah ${esc(k.toLowerCase())}</button>
      </div>
      ${hartaPriceBox(k)}
    </div>`;
}
function hartaHeadNav() {
  const sum = hartaSummary(hartaOwned()), k = HARTA[S.ui.hartaJenis] ? S.ui.hartaJenis : 'Emas';
  return `<div class="harta-nav-wrap"><div class="harta-nav"><nav class="text-tabs" aria-label="Jenis harta">${Object.keys(HARTA).map(j => `<button class="${j === k ? 'on' : ''}" data-action="hartaPilih" data-jenis="${j}" aria-pressed="${j === k}">${j}${sum[j] ? `<span class="n">${sum[j].n}</span>` : ''}</button>`).join('')}</nav>
    <button class="btn btn-soft btn-sm" data-action="newHarta"><i class="bi bi-plus-lg"></i> Harta lain</button></div></div>`;
}
function finHartaHtml() {
  const owned = hartaOwned();
  const sold = (S.harta || []).filter(h => h.status === 'Dijual');
  const sum = hartaSummary(owned);
  const total = Object.keys(sum).reduce((s, k) => s + sum[k].nilai, 0);
  if (!HARTA[S.ui.hartaJenis]) S.ui.hartaJenis = Object.keys(HARTA).find(k => sum[k]) || 'Emas';
  const k = S.ui.hartaJenis, t = HARTA[k], s = sum[k];
  const tabs = Object.keys(HARTA).map(j => `<button class="chip-btn cat-chip ${j === k ? 'on' : ''}" data-action="hartaPilih" data-jenis="${j}" aria-pressed="${j === k}">${hIc(j)}${j}${sum[j] ? ` <span class="n">${sum[j].n}</span>` : ''}</button>`).join('');
  const items = owned.filter(h => h.jenis === k).sort((a, b) => String(b.tgl_beli).localeCompare(String(a.tgl_beli)));
  const isBar = k === 'Emas' || k === 'Perak';
  const wOf = h => Math.round((h.satuan === 'kg' ? Number(h.jumlah) * 1000 : Number(h.jumlah)) * 1000) / 1000;
  const isW = h => h.satuan === 'gram' || h.satuan === 'kg';
  const keyOf = h => seriesOf(h).toLowerCase();
  // Daftar pilihan dari SEMUA catatan (agar tombol tidak hilang), jumlah dihitung silang (faceted)
  const sLabel = {}; items.forEach(h => { if (!sLabel[keyOf(h)]) sLabel[keyOf(h)] = seriesOf(h); });
  const sTotal = {}; items.forEach(h => { sTotal[keyOf(h)] = (sTotal[keyOf(h)] || 0) + 1; });
  const sList = Object.keys(sLabel).sort((a, b) => sTotal[b] - sTotal[a] || a.localeCompare(b));
  const wList = isBar ? [...new Set(items.filter(isW).map(wOf))].sort((a, b) => a - b) : [];
  if (S.ui.hartaSeri !== 'all' && !sList.includes(S.ui.hartaSeri)) S.ui.hartaSeri = 'all';
  if (S.ui.hartaGram !== 'all' && !wList.includes(Number(S.ui.hartaGram))) S.ui.hartaGram = 'all';
  const sSel = S.ui.hartaSeri || 'all', gSel = S.ui.hartaGram || 'all';
  const okS = h => sSel === 'all' || keyOf(h) === sSel;
  const okG = h => !isBar || gSel === 'all' || (isW(h) && wOf(h) === Number(gSel));
  const shown = items.filter(h => okS(h) && okG(h));
  const bySeri = items.filter(okG), byGram = items.filter(okS);      // jumlah seri mengikuti berat terpilih & sebaliknya
  const sCount = {}; bySeri.forEach(h => { sCount[keyOf(h)] = (sCount[keyOf(h)] || 0) + 1; });
  const wCount = {}; byGram.filter(isW).forEach(h => { const w = wOf(h); wCount[w] = (wCount[w] || 0) + 1; });
  const chip = (on, act, attr, label, n) => `<button class="chip-btn ${on ? 'on' : ''} ${n ? '' : 'zero'}" data-action="${act}" ${attr} aria-pressed="${on}">${label} <span class="n">${n || 0}</span></button>`;
  const opt = (v, label, n, on) => `<option value="${esc(String(v))}" ${on ? 'selected' : ''} ${n || on ? '' : 'disabled'}>${label} (${n || 0})</option>`;
  const sSelect = sList.length > 1 ? `<label class="hf-sel"><span>Seri</span><select data-change="hartaSeriSel" aria-label="Filter seri">
      ${opt('all', 'Semua seri', bySeri.length, sSel === 'all')}${sList.map(key => opt(key, esc(sLabel[key]), sCount[key], sSel === key)).join('')}</select></label>` : '';
  const gSelect = isBar && wList.length > 1 ? `<label class="hf-sel"><span>Berat</span><select data-change="hartaGramSel" aria-label="Filter berat">
      ${opt('all', 'Semua berat', byGram.length, gSel === 'all')}${wList.map(w => opt(w, fmtGram(w) + ' gr', wCount[w], String(gSel) === String(w))).join('')}</select></label>` : '';
  const aktif = sSel !== 'all' || (isBar && gSel !== 'all');
  const filterBar = sSelect || gSelect ? `<div class="harta-filter">${sSelect}${gSelect}
      <span class="tiny muted ms-auto">${aktif ? `${shown.length} dari ${items.length} catatan · <button class="link-btn" data-action="hartaReset">Reset</button>` : `${items.length} catatan`}</span></div>` : '';
  const sFilter = filterBar, gFilter = '';
  const soldK = sold.filter(h => h.jenis === k);
  const modalTxt = s && s.modal ? 'modal ' + fmtShort(s.modal, 'Rp') : '';

  const note = k === 'Emas' ? '<p class="tiny muted mt-2 mb-0"><i class="bi bi-info-circle"></i> Taksiran = berat × harga buyback hari ini, sebelum PPh 22 (penjualan > Rp 10 jt dipotong 1,5% dengan NPWP / 3% tanpa NPWP). Harga buyback Antam sama di semua butik, termasuk Balikpapan.</p>' : '';
  const kosong = '<p class="muted my-3">Tidak ada catatan yang cocok dengan filter ini.</p>';
  let table;
  if (!items.length) table = `<div class="card mt-3">${emptyHtml(t.icon, `Belum ada ${k.toLowerCase()} tercatat.`, `<button class="btn btn-dark btn-sm" data-action="newHarta" data-jenis="${k}">Catat ${k.toLowerCase()} pertama</button>`)}</div>`;
  else if (finView() === 'list') table = `<div class="goals-layout mt-3">${viewRailHtml()}<div style="min-width:0">${sFilter}<div class="card">${shown.length ? hartaTableHtml(k, shown) : kosong}${note}</div></div></div>`;
  else table = `<div class="goals-layout mt-3">${viewRailHtml()}<div style="min-width:0">${sFilter}${shown.length ? finViewBody(shown.map(hartaItemCard)) : `<div class="card">${kosong}</div>`}${note ? `<div class="mt-2">${note}</div>` : ''}</div></div>`;
  const soldHtml = soldK.length ? `<details class="card mt-3"><summary class="fw-bold">Riwayat ${k.toLowerCase()} dijual (${soldK.length})</summary>
    <div class="table-wrap mt-2"><table class="tbl harta-tbl"><thead><tr><th></th><th>Nama</th><th class="num">Jumlah</th><th>Tgl jual</th><th class="num">Harga jual</th><th class="num">Modal</th><th></th></tr></thead><tbody>
    ${soldK.map(h => `<tr><td>${hartaThumb(h, 30)}</td><td><b>${esc(h.nama)}</b></td><td class="num">${fmtGram(h.jumlah)} ${esc(h.satuan)}</td><td>${h.tgl_jual ? fmtDate(h.tgl_jual) : '-'}</td><td class="num">${Number(h.harga_jual) ? fmtVal(h.harga_jual, 'Rp') : '-'}</td><td class="num">${Number(h.harga_beli) ? fmtVal(h.harga_beli, 'Rp') : '-'}</td>
      <td><button class="icon-btn sm" data-action="editHarta" data-id="${h.harta_id}" aria-label="Edit"><i class="bi bi-pencil"></i></button></td></tr>`).join('')}</tbody></table></div></details>` : '';
  const hsub = ['Emas', 'Tanah'].filter(j => sum[j]).map(j => qtyText(sum[j].qty)).join(' · ');
  return `<div class="harta-top mb-3">
      <div style="min-width:0"><div class="fw-bold fin-total">Taksiran total semua harta ${fmtVal(Math.round(total), 'Rp')}${hsub ? ` <span class="tiny muted fw-normal">· ${hsub}</span>` : ''}</div>
        <p class="tiny muted mb-0" style="max-width:640px">Emas, perak, dinar, tanah, rumah, kendaraan & lainnya — ditaksir dengan harga buyback Antam, harga lokasi, atau penyusutan.</p></div>
      ${hartaJenisSummary()}
</div>
    ${table}${soldHtml}`;
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
      ${Object.keys(HARTA).map(k => `<label class="chip-btn cat-chip ${h.jenis === k ? 'on' : ''}"><input type="radio" name="jenis" value="${k}" class="visually-hidden" data-change="hartaJenis" ${h.jenis === k ? 'checked' : ''}>${hIc(k)}${k}</label>`).join('')}
    </div></div>
    <label class="field"><span>Nama / seri <small>(dipakai untuk filter)</small></span><input name="nama" maxlength="80" list="hartaNamaList" value="${esc(h.nama)}" placeholder="${esc(t.contoh)}">
      <datalist id="hartaNamaList">${[...new Set(['Certicard Antam', 'Retro', 'Gift Series', 'Antam Batik', 'Antam Imlek', 'Antam Idul Fitri', 'UBS', 'Galeri24'].concat((S.harta || []).map(x => seriesOf(x)).filter(x => x !== 'Tanpa seri')))].map(n => `<option value="${esc(n)}">`).join('')}</datalist>
      <small>Cukup tulis serinya, mis. "Certicard Antam" atau "Retro" — berat diisi di kolom Jumlah.</small></label>
    <div class="grid-2">
      <label class="field"><span>Jumlah</span><input name="jumlah" inputmode="decimal" data-input="hartaCalc" value="${h.jumlah !== '' ? esc(String(h.jumlah).replace('.', ',')) : ''}" placeholder="${h.jenis === 'Tanah' ? '200' : h.jenis === 'Emas' || h.jenis === 'Perak' ? '5' : '1'}"><em class="field-err"></em></label>
      <label class="field"><span>Satuan</span><select name="satuan" data-change="hartaCalc">${HARTA_SATUAN.concat(HARTA_SATUAN.includes(h.satuan) ? [] : [h.satuan]).map(s => `<option ${h.satuan === s ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select></label>
      <label class="field"><span>Harga beli total (Rp) <small>(opsional)</small></span><input name="harga_beli" inputmode="numeric" data-money data-input="hartaCalc" value="${Number(h.harga_beli) ? fmtN(h.harga_beli) : ''}" placeholder="0"></label>
      <label class="field hp-field" ${LOGAM.includes(h.jenis) ? 'hidden' : ''}><span id="hpLabel">${hpLabel(h.jenis)}</span><input name="harga_pasar" inputmode="numeric" data-money data-input="hartaCalc" value="${Number(h.harga_pasar) ? fmtN(h.harga_pasar) : ''}" placeholder="${h.jenis === 'Tanah' ? 'mis. 1.100.000' : 'kosongkan jika tidak tahu'}"><small id="hpHint">${hpHint(h.jenis)}</small></label>
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
function hpLabel(j) { return j === 'Tanah' ? 'Harga pasar per m² di lokasi ini (Rp) <small>(opsional)</small>' : j === 'Kendaraan' ? 'Taksiran harga jual sekarang per unit (Rp) <small>(opsional)</small>' : 'Taksiran nilai sekarang per ' + ((HARTA[j] || {}).satuan || 'unit') + ' (Rp) <small>(opsional)</small>'; }
function hpHint(j) { return j === 'Tanah' ? 'Isi bila harga di lokasi ini berbeda dari harga umum. Kosong = pakai harga umum tanah.' : j === 'Kendaraan' ? 'Kosong = dihitung otomatis dari penyusutan per tahun.' : 'Kosong = pakai harga beli.'; }
function hartaFromForm(f) {
  const jenis = (f.querySelector('input[name=jenis]:checked') || {}).value || 'Emas';
  return {
    harta_id: f.harta_id.value, jenis, nama: f.nama.value.trim() || jenis, jumlah: parseNum(f.jumlah.value), satuan: f.satuan.value,
    harga_beli: parseNum(f.harga_beli.value, true), tgl_beli: f.tgl_beli.value, pemilik_id: f.pemilik_id.value, lokasi: f.lokasi.value.trim(),
    status: f.status.value, tgl_jual: f.status.value === 'Dijual' ? f.tgl_jual.value : '', harga_jual: f.status.value === 'Dijual' ? parseNum(f.harga_jual.value, true) : 0,
    catatan: f.catatan.value.trim(),
    harga_pasar: LOGAM.includes(jenis) || !f.harga_pasar ? '' : (parseNum(f.harga_pasar.value, true) || ''),
    tgl_taksir: today()
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
  if (!LOGAM.includes(h.jenis) && h.jumlah > 0 && Number(h.harga_pasar) > 0) parts.push(`taksiran sekarang ${fmtShort(h.jumlah * Number(h.harga_pasar), 'Rp')} (harga lokasi)`);
  else if (HARTA[h.jenis].susut && h.harga_beli > 0 && h.tgl_beli) { const n = hartaNilai(h); parts.push(`taksiran jual sekarang ±${fmtShort(n.v, 'Rp')} (usia ${fmtUsia(n.usia)}, susut ${fmtN(n.rate)}%/thn)`); }
  if (h.jenis === 'Dinar' && h.jumlah > 0 && !hp && dinarEstimasi()) parts.push(`taksiran ±${fmtShort(h.jumlah * dinarEstimasi(), 'Rp')} (dari harga buyback emas)`);
  if (!(Number(h.harga_pasar) > 0) && HARTA[h.jenis].harga && h.jumlah > 0 && hp > 0 && h.satuan === HARTA[h.jenis].satuan) parts.push(`taksiran sekarang ${fmtShort(h.jumlah * hp, 'Rp')}`);
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
  hartaPilih: d => {
    const row = document.querySelector('#page-finance .jenis-scroll'), x = row ? row.scrollLeft : 0;
    S.ui.hartaJenis = d.jenis; S.ui.hartaGram = 'all'; S.ui.hartaSeri = 'all'; keepScroll(renderFinance);
    const r2 = document.querySelector('#page-finance .jenis-scroll'); if (!r2) return;
    r2.scrollLeft = x;
    const on = r2.querySelector('.chip-btn.on'); if (on) { const a = on.getBoundingClientRect(), b = r2.getBoundingClientRect(); r2.scrollBy({ left: (a.left + a.width / 2) - (b.left + b.width / 2), behavior: 'smooth' }); }
  },
  hartaSeri: d => { S.ui.hartaSeri = d.seri; if (!hartaComboAda()) S.ui.hartaGram = 'all'; keepScroll(renderFinance); const w = document.querySelector('#page-finance .harta-scroll'); if (w) w.scrollTop = 0; },
  hartaGram: d => {
    S.ui.hartaGram = d.gram === 'all' ? 'all' : Number(d.gram); if (!hartaComboAda()) S.ui.hartaSeri = 'all'; keepScroll(renderFinance); const w = document.querySelector('#page-finance .harta-scroll'); if (w) w.scrollTop = 0;
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
    const hpF = f.querySelector('.hp-field'); if (hpF) { hpF.hidden = LOGAM.includes(el.value); $('#hpLabel').innerHTML = hpLabel(el.value); $('#hpHint').textContent = hpHint(el.value); }
    hartaPreview(f);
  },
  hartaCalc: el => hartaPreview(el.form),
  hartaStatus: el => { el.form.querySelectorAll('.sold-f').forEach(x => { x.hidden = el.value !== 'Dijual'; }); }
});
Object.assign(Inputs, { hartaCalc: debounce(el => hartaPreview(el.form), 150), susutCalc: debounce(el => susutPreview(el.form), 120) });
Object.assign(Changes, {
  hartaSeriSel: el => Actions.hartaSeri({ seri: el.value }),
  hartaJenisSel: el => Actions.hartaPilih({ jenis: el.value }),
  hartaGramSel: el => Actions.hartaGram({ gram: el.value })
});
Object.assign(Actions, { hartaReset: () => { S.ui.hartaSeri = 'all'; S.ui.hartaGram = 'all'; keepScroll(renderFinance); } });
Object.assign(Forms, { harta: f => submitHarta(f), hargaHarta: f => submitHarga(f) });
window.__GT_PARTS = (window.__GT_PARTS || []).concat('JS6');
