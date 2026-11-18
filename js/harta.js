/* GOAL TRACKERS — js/harta.js: Harta (emas, perak, tanah, rumah, kendaraan, lainnya)
   Tiap kepemilikan dicatat satu baris. Beli emas/tanah baru = tambah baris baru,
   lalu total per jenis (mis. emas 15 gram) dihitung otomatis. */
const HARTA = {
  Emas:      { satuan: 'gram', emoji: '🪙', icon: 'bi-coin',          c: '#FBEBB5', harga: true,  contoh: 'mis. Antam 5 gr',            simpan: 'mis. Brankas rumah / Pegadaian' },
  Perak:     { satuan: 'gram', emoji: '🥈', icon: 'bi-coin',          c: '#E6E8EE', harga: true,  contoh: 'mis. Perak batangan 100 gr', simpan: 'mis. Brankas rumah' },
  Tanah:     { satuan: 'm²',   emoji: '🌳', icon: 'bi-tree',          c: '#CFF2D6', harga: true,  contoh: 'mis. Tanah kavling Batu',    simpan: 'mis. Jl. Mawar No. 3, Batu' },
  Rumah:     { satuan: 'unit', emoji: '🏠', icon: 'bi-house-door',    c: '#FFE1C7', harga: false, contoh: 'mis. Rumah Perum Griya',     simpan: 'Alamat' },
  Kendaraan: { satuan: 'unit', emoji: '🚗', icon: 'bi-car-front',     c: '#D5F0F7', harga: false, contoh: 'mis. Motor Vario 2023',      simpan: 'mis. Plat nomor / garasi' },
  Lainnya:   { satuan: 'unit', emoji: '📦', icon: 'bi-box-seam',      c: '#E8D3F5', harga: false, contoh: 'mis. Koleksi, peralatan',    simpan: 'Lokasi' }
};
const HARTA_SATUAN = ['gram', 'kg', 'm²', 'hektare', 'unit', 'keping', 'batang'];

const hartaOwned = () => (S.harta || []).filter(h => h.status !== 'Dijual');
const hargaPasar = jenis => Number(S.settings['harga_' + jenis]) || 0;
const fmtQty = (n, sat) => fmtN(Math.round(Number(n) * 1000) / 1000) + ' ' + sat;

/** Nilai taksiran satu harta: jumlah × harga pasar/satuan (bila diatur & satuan cocok), selain itu harga beli. */
function hartaNilai(h) {
  const hp = hargaPasar(h.jenis), def = (HARTA[h.jenis] || {}).satuan;
  if (hp > 0 && h.satuan === def) return { v: Number(h.jumlah) * hp, pasar: true };
  return { v: Number(h.harga_beli) || 0, pasar: false };
}
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

// ── Tab "Harta" di Pusat Finansial ──
function finHartaHtml() {
  const owned = hartaOwned();
  const sold = (S.harta || []).filter(h => h.status === 'Dijual');
  const sum = hartaSummary(owned);
  const total = Object.keys(sum).reduce((s, k) => s + sum[k].nilai, 0);
  const quick = Object.keys(HARTA).map(k => `<button class="chip-btn" data-action="newHarta" data-jenis="${k}">${HARTA[k].emoji} ${k === 'Emas' || k === 'Tanah' || k === 'Perak' ? 'Beli ' + k.toLowerCase() : k}</button>`).join('');

  const groups = Object.keys(HARTA).filter(k => sum[k]).map(k => {
    const t = HARTA[k], s = sum[k];
    const items = owned.filter(h => h.jenis === k).sort((a, b) => String(b.tgl_beli).localeCompare(String(a.tgl_beli)));
    const hp = hargaPasar(k);
    const gain = s.modal > 0 && hp > 0 ? (s.nilai - s.modal) / s.modal * 100 : null;
    const rows = items.map(h => {
      const per = Number(h.harga_beli) > 0 && Number(h.jumlah) > 0 ? Number(h.harga_beli) / Number(h.jumlah) : 0;
      return `<div class="harta-row">
        <div class="harta-qty tint" style="--c:${t.c}"><b>${fmtN(Math.round(Number(h.jumlah) * 1000) / 1000)}</b><small>${esc(h.satuan)}</small></div>
        <div class="flex-grow-1" style="min-width:0">
          <div class="fw-bold text-truncate">${esc(h.nama)}</div>
          <div class="tiny muted">${h.tgl_beli ? 'Beli ' + fmtDate(h.tgl_beli) : 'Tanggal beli -'}${Number(h.harga_beli) ? ' · ' + fmtShort(h.harga_beli, 'Rp') + (per ? ' (' + fmtShort(per, 'Rp') + '/' + esc(h.satuan) + ')' : '') : ''}</div>
          <div class="tiny muted text-truncate">${esc(ownerName(h.pemilik_id))}${h.lokasi ? ' · ' + esc(h.lokasi) : ''}</div>
        </div>
        <div class="d-flex gap-1">
          <button class="icon-btn sm" data-action="editHarta" data-id="${h.harta_id}" aria-label="Edit ${esc(h.nama)}"><i class="bi bi-pencil"></i></button>
          <button class="icon-btn sm" data-action="delHarta" data-id="${h.harta_id}" aria-label="Hapus ${esc(h.nama)}"><i class="bi bi-trash3"></i></button>
        </div>
      </div>`;
    }).join('');
    return `<div class="card harta-card">
      <div class="harta-head">
        <div class="harta-ic tint" style="--c:${t.c}" aria-hidden="true">${t.emoji}</div>
        <div class="flex-grow-1" style="min-width:0">
          <div class="tiny muted fw-bold">${esc(k)} · ${s.n} catatan</div>
          <div class="harta-total">${qtyText(s.qty)}</div>
          <div class="tiny muted">${hp > 0 ? 'Taksiran ' + fmtShort(s.nilai, 'Rp') + ' @ ' + fmtShort(hp, 'Rp') + '/' + t.satuan + (gain !== null ? ` · <b style="color:${gain >= 0 ? 'var(--green-ink, #1B7F3A)' : 'var(--red-ink)'}">${gain >= 0 ? '+' : ''}${fmtN(Math.round(gain * 10) / 10)}%</b>` : '') : 'Modal beli ' + fmtShort(s.modal, 'Rp')}</div>
        </div>
        <button class="btn btn-dark btn-sm harta-add" data-action="newHarta" data-jenis="${k}"><i class="bi bi-plus-lg"></i> Tambah ${esc(k.toLowerCase())}</button>
      </div>
      ${t.harga ? `<button class="link-btn p-0 tiny" style="min-height:32px" data-action="hartaHarga" data-jenis="${k}"><i class="bi bi-tag"></i> ${hp > 0 ? 'Ubah harga ' + k.toLowerCase() + ' per ' + t.satuan + ' (diatur ' + (S.settings['harga_' + k + '_tgl'] ? fmtDate(S.settings['harga_' + k + '_tgl']) : '-') + ')' : 'Atur harga ' + k.toLowerCase() + ' per ' + t.satuan + ' untuk taksiran nilai'}</button>` : ''}
      <div class="harta-list mt-2">${rows}</div>
    </div>`;
  }).join('');

  const soldHtml = sold.length ? `<details class="card mt-3"><summary class="fw-bold">Riwayat dijual (${sold.length})</summary>
    <div class="harta-list mt-2">${sold.map(h => `<div class="harta-row">
      <div class="harta-qty" style="background:var(--soft)"><b>${fmtN(Number(h.jumlah))}</b><small>${esc(h.satuan)}</small></div>
      <div class="flex-grow-1" style="min-width:0"><div class="fw-bold text-truncate">${HARTA[h.jenis] ? HARTA[h.jenis].emoji : ''} ${esc(h.nama)}</div>
        <div class="tiny muted">Dijual ${h.tgl_jual ? fmtDate(h.tgl_jual) : ''}${Number(h.harga_jual) ? ' · ' + fmtShort(h.harga_jual, 'Rp') : ''}${Number(h.harga_beli) ? ' · modal ' + fmtShort(h.harga_beli, 'Rp') : ''}</div></div>
      <button class="icon-btn sm" data-action="editHarta" data-id="${h.harta_id}" aria-label="Edit"><i class="bi bi-pencil"></i></button></div>`).join('')}</div></details>` : '';

  return `<div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-2">
      <p class="tiny muted mb-0" style="max-width:560px">Catat emas, tanah, rumah, kendaraan & harta lain. Setiap kali beli lagi, tambahkan catatan baru — totalnya (mis. emas 15 gram) dihitung otomatis.</p>
      <button class="btn btn-dark btn-sm" data-action="newHarta"><i class="bi bi-plus-lg"></i> Tambah Harta</button></div>
    <div class="chips chips-wrap mb-3">${quick}</div>
    ${owned.length ? `<div class="stat-line mb-3"><span class="muted tiny">Taksiran total harta</span> <b>${fmtShort(total, 'Rp')}</b></div><div class="ggrid">${groups}</div>`
      : `<div class="card">${emptyHtml('bi-gem', 'Belum ada harta tercatat.', '<button class="btn btn-dark btn-sm" data-action="newHarta" data-jenis="Emas">Catat emas pertama</button>')}</div>`}
    ${soldHtml}`;
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
    <label class="field"><span>Nama / keterangan singkat</span><input name="nama" maxlength="80" value="${esc(h.nama)}" placeholder="${esc(t.contoh)}"></label>
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
  if (h.jumlah > 0 && hp > 0 && h.satuan === HARTA[h.jenis].satuan) parts.push(`taksiran sekarang ${fmtShort(h.jumlah * hp, 'Rp')}`);
  el.textContent = parts.length ? parts.join(' · ') : 'Isi jumlah (mis. 5 gram, 200 m²) untuk melihat total.';
}
function submitHarta(f) {
  const h = hartaFromForm(f);
  if (!(h.jumlah > 0)) { const fe = f.jumlah.closest('.field'); fe.classList.add('invalid'); fe.querySelector('.field-err').textContent = 'Isi jumlah, mis. 5 atau 0,5.'; return; }
  S.harta = S.harta || [];
  const ex = S.harta.find(x => x.harta_id === h.harta_id);
  if (ex) Object.assign(ex, h, { diubah_pada: nowIso() });
  else S.harta.push(Object.assign({ dibuat_oleh: S.me.user_id, dibuat_pada: nowIso(), diubah_pada: nowIso() }, h));
  saveSnapshot(); closeSheet(); S.ui.finTab = 'harta'; navigateTo('finance', { noHistory: S.ui.page === 'finance' });
  const tot = hartaSummary(hartaOwned())[h.jenis];
  toast(ex ? 'Harta diperbarui' : `${HARTA[h.jenis].emoji} Tercatat! Total ${h.jenis.toLowerCase()}: ${tot ? qtyText(tot.qty) : '-'}`);
  Outbox.push('saveHarta', [h]);
}

// ── Form harga pasar per satuan (emas/gram, tanah/m²) ──
function openHargaForm(jenis) {
  const t = HARTA[jenis]; if (!t) return;
  const hp = hargaPasar(jenis);
  openSheet(`Harga ${jenis} ${t.emoji}`, `
  <form data-form="hargaHarta"><input type="hidden" name="jenis" value="${jenis}">
    <p class="muted tiny">Dipakai untuk menaksir nilai ${jenis.toLowerCase()} yang Anda miliki. Perbarui sesekali${jenis === 'Emas' ? ', mis. dari harga buyback Antam/Pegadaian hari ini' : ''}. Kosongkan untuk memakai harga beli.</p>
    <label class="field"><span>Harga per ${t.satuan} (Rp)</span><input name="harga" inputmode="numeric" data-money value="${hp ? fmtN(hp) : ''}" placeholder="${jenis === 'Emas' ? '1.500.000' : jenis === 'Tanah' ? '2.000.000' : '15.000'}"></label>
    <div class="sheet-foot"><button type="button" class="btn btn-soft" data-action="closeSheet">Batal</button><button class="btn btn-dark" type="submit">Simpan</button></div>
  </form>`);
}
function submitHarga(f) {
  const jenis = f.jenis.value, v = parseNum(f.harga.value, true);
  S.settings['harga_' + jenis] = v ? String(v) : '';
  S.settings['harga_' + jenis + '_tgl'] = v ? today() : '';
  saveSnapshot(); closeSheet(); S.ui.finTab = 'harta'; renderFinance();
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
  delHarta: d => confirmBox({ title: 'Hapus catatan harta ini?', text: 'Kalau hartanya dijual, sebaiknya Edit → status "Dijual" agar riwayatnya tetap ada.', ok: 'Hapus', danger: true }, () => {
    S.harta = (S.harta || []).filter(x => x.harta_id !== d.id); saveSnapshot(); renderAll(); toast('Catatan harta dihapus'); Outbox.push('deleteHarta', [d.id]);
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
Object.assign(Inputs, { hartaCalc: debounce(el => hartaPreview(el.form), 150) });
Object.assign(Forms, { harta: f => submitHarta(f), hargaHarta: f => submitHarga(f) });
window.__GT_PARTS = (window.__GT_PARTS || []).concat('JS6');
