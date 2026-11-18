/* GOAL TRACKERS — js/pengeluaran.js: Catatan pengeluaran rencana (mis. liburan)
   Anggaran = dana yang sudah terkumpul di goal. Setiap pengeluaran dicatat,
   sehingga setelah selesai terlihat sisa (hemat) atau kekurangan (lebih). */
const PKAT = {
  'Transportasi':   { e: '✈️', c: '#D5F0F7' },
  'Penginapan':     { e: '🏨', c: '#E8D3F5' },
  'Makan & minum':  { e: '🍜', c: '#FFE1C7' },
  'Tiket & wisata': { e: '🎟️', c: '#CFF2D6' },
  'Oleh-oleh':      { e: '🎁', c: '#F8D3E3' },
  'Belanja':        { e: '🛍️', c: '#FBEBB5' },
  'Lainnya':        { e: '📌', c: '#E6E8EE' }
};
const pakaiOf = gid => (S.pengeluaran || []).filter(x => x.goal_id === gid);
/** Semua rencana finansial bisa punya catatan pengeluaran (kecuali Tabungan Utama). */
const bisaPengeluaran = g => g && g.tipe_target === 'Finansial' && !parseMeta(g.meta).utama;
const punyaPengeluaran = g => bisaPengeluaran(g) && (g.template === 'liburan' || pakaiOf(g.goal_id).length > 0);
function anggaranInfo(g) {
  const list = pakaiOf(g.goal_id);
  const anggaran = Number(g.nilai_saat_ini) || 0;
  const pakai = list.reduce((s, x) => s + Number(x.jumlah), 0);
  const selesai = g.tgl_pelaksanaan && g.tgl_pelaksanaan < today();
  return { list, anggaran, pakai, sisa: anggaran - pakai, pct: anggaran ? pakai / anggaran * 100 : 0, selesai };
}

/** Kartu di detail goal: ringkasan anggaran vs terpakai + daftar pengeluaran */
function pengeluaranCardHtml(g) {
  if (!punyaPengeluaran(g)) return '';
  const a = anggaranInfo(g), lebih = a.sisa < 0;
  const byKat = {};
  a.list.forEach(x => { byKat[x.kategori] = (byKat[x.kategori] || 0) + Number(x.jumlah); });
  const kats = Object.keys(byKat).sort((x, y) => byKat[y] - byKat[x]);
  const verdict = !a.pakai ? '' : lebih
    ? `<div class="verdict bad"><i class="bi bi-exclamation-triangle"></i><span>${a.selesai ? 'Liburan selesai — ' : ''}pengeluaran <b>lebih ${fmtVal(-a.sisa, 'Rp')}</b> dari anggaran.</span></div>`
    : `<div class="verdict good"><i class="bi bi-emoji-smile"></i><span>${a.selesai ? 'Liburan selesai — ' : 'Masih '}${a.selesai ? '<b>hemat ' + fmtVal(a.sisa, 'Rp') + '</b> dari anggaran 🎉' : 'tersisa <b>' + fmtVal(a.sisa, 'Rp') + '</b> dari anggaran.'}</span></div>`;
  const rows = a.list.slice().sort((x, y) => String(y.tanggal).localeCompare(String(x.tanggal)) || String(y.dibuat_pada).localeCompare(String(x.dibuat_pada))).map(x => {
    const k = PKAT[x.kategori] || PKAT.Lainnya;
    return `<div class="exp-row">
      <span class="exp-ic tint" style="--c:${k.c}" aria-hidden="true">${k.e}</span>
      <div class="flex-grow-1" style="min-width:0"><div class="fw-bold text-truncate">${esc(x.keterangan || x.kategori)}</div>
        <div class="tiny muted">${fmtDate(x.tanggal)} · ${esc(x.kategori)} · dibayar ${esc(userById(x.dibayar_oleh).nama || '-')}</div></div>
      <b class="exp-amt">${fmtShort(x.jumlah, 'Rp')}</b>
      ${canEdit(g) ? `<button class="icon-btn sm" data-action="editPengeluaran" data-id="${x.pengeluaran_id}" aria-label="Edit"><i class="bi bi-pencil"></i></button>` : ''}
    </div>`;
  }).join('');
  return `<div class="card">
    <div class="d-flex justify-content-between align-items-center gap-2 flex-wrap mb-2">
      <h3 class="mb-0">🧾 Catatan Pengeluaran</h3>
      ${canEdit(g) ? `<button class="btn btn-dark btn-sm" data-action="newPengeluaran" data-id="${g.goal_id}"><i class="bi bi-plus-lg"></i> Catat pengeluaran</button>` : ''}
    </div>
    <div class="kv kv3">
      <div><small>Anggaran (dana terkumpul)</small><b>${fmtShort(a.anggaran, 'Rp')}</b></div>
      <div><small>Terpakai</small><b>${fmtShort(a.pakai, 'Rp')}</b></div>
      <div><small>${lebih ? 'Kelebihan' : 'Sisa anggaran'}</small><b style="color:${lebih ? 'var(--red-ink)' : 'var(--green-ink,#1B7F3A)'}">${lebih ? '−' : ''}${fmtShort(Math.abs(a.sisa), 'Rp')}</b></div>
    </div>
    <div class="exp-bar mt-3" role="img" aria-label="Terpakai ${Math.round(a.pct)}% dari anggaran"><span style="width:${Math.min(100, a.pct)}%;background:${lebih ? 'var(--red-ink)' : a.pct > 85 ? '#E8A33B' : 'var(--green-ink,#1B7F3A)'}"></span></div>
    <div class="tiny muted mt-1">${fmtN(Math.round(a.pct))}% anggaran terpakai</div>
    ${verdict}
    ${kats.length ? `<div class="exp-kats mt-3">${kats.map(k => `<span class="chip tint" style="--c:${(PKAT[k] || PKAT.Lainnya).c}">${(PKAT[k] || PKAT.Lainnya).e} ${esc(k)} · <b>${fmtShort(byKat[k], 'Rp')}</b></span>`).join('')}</div>` : ''}
    ${rows ? `<div class="exp-list mt-3">${rows}</div>` : `<p class="tiny muted mt-3 mb-0">Belum ada pengeluaran. Catat tiket, hotel, makan, oleh-oleh, dll. supaya setelah liburan terlihat hemat atau lebih.</p>`}
  </div>`;
}

function openPengeluaranForm(goalId, id) {
  const x = (S.pengeluaran || []).find(r => r.pengeluaran_id === id) || { pengeluaran_id: uid(), goal_id: goalId, tanggal: today(), kategori: 'Makan & minum', keterangan: '', jumlah: '', dibayar_oleh: S.me.user_id };
  const g = goalById(x.goal_id);
  openSheet(id ? 'Edit Pengeluaran' : 'Catat Pengeluaran 🧾', `
  <form data-form="pengeluaran" novalidate>
    <input type="hidden" name="pengeluaran_id" value="${esc(x.pengeluaran_id)}"><input type="hidden" name="goal_id" value="${esc(x.goal_id)}">
    <p class="tiny muted mb-2">${esc(g ? g.judul : '')}</p>
    <div class="field"><span>Kategori</span><div class="chips chips-wrap">
      ${Object.keys(PKAT).map(k => `<label class="chip-btn ${x.kategori === k ? 'on' : ''}"><input type="radio" name="kategori" value="${k}" class="visually-hidden" data-change="pkKat" ${x.kategori === k ? 'checked' : ''}>${PKAT[k].e} ${k}</label>`).join('')}
    </div></div>
    <div class="grid-2">
      <label class="field"><span>Jumlah (Rp)</span><input name="jumlah" inputmode="numeric" data-money value="${x.jumlah ? fmtN(x.jumlah) : ''}" placeholder="0"><em class="field-err"></em></label>
      <label class="field"><span>Tanggal</span><input type="date" name="tanggal" value="${esc(x.tanggal)}"></label>
    </div>
    <label class="field"><span>Keterangan <small>(opsional)</small></span><input name="keterangan" maxlength="120" value="${esc(x.keterangan)}" placeholder="mis. Tiket pesawat PP, Hotel 3 malam, Bakso Malang"></label>
    <label class="field"><span>Dibayar oleh</span><select name="dibayar_oleh">${S.users.map(u => `<option value="${u.user_id}" ${x.dibayar_oleh === u.user_id ? 'selected' : ''}>${esc(u.nama)}</option>`).join('')}</select></label>
    <div class="sheet-foot">
      ${id ? `<button type="button" class="btn btn-soft text-danger me-auto" data-action="delPengeluaran" data-id="${esc(x.pengeluaran_id)}"><i class="bi bi-trash3"></i> Hapus</button>` : ''}
      <button type="button" class="btn btn-soft" data-action="closeSheet">Batal</button><button class="btn btn-dark" type="submit">Simpan</button>
    </div>
  </form>`);
}
function submitPengeluaran(f) {
  const x = {
    pengeluaran_id: f.pengeluaran_id.value, goal_id: f.goal_id.value, tanggal: f.tanggal.value || today(),
    kategori: (f.querySelector('input[name=kategori]:checked') || {}).value || 'Lainnya', keterangan: f.keterangan.value.trim(),
    jumlah: parseNum(f.jumlah.value, true), dibayar_oleh: f.dibayar_oleh.value
  };
  if (!(x.jumlah > 0)) { const fe = f.jumlah.closest('.field'); fe.classList.add('invalid'); fe.querySelector('.field-err').textContent = 'Isi jumlah pengeluaran.'; return; }
  S.pengeluaran = S.pengeluaran || [];
  const ex = S.pengeluaran.find(r => r.pengeluaran_id === x.pengeluaran_id);
  if (ex) Object.assign(ex, x, { diubah_pada: nowIso() });
  else S.pengeluaran.push(Object.assign({ dibuat_oleh: S.me.user_id, dibuat_pada: nowIso(), diubah_pada: nowIso() }, x));
  saveSnapshot(); closeSheet(); keepScroll(renderAll);
  const a = anggaranInfo(goalById(x.goal_id));
  toast(ex ? 'Pengeluaran diperbarui' : `🧾 Tercatat. ${a.sisa >= 0 ? 'Sisa anggaran ' + fmtShort(a.sisa, 'Rp') : 'Lebih ' + fmtShort(-a.sisa, 'Rp') + ' dari anggaran'}`);
  Outbox.push('savePengeluaran', [x]);
}

Object.assign(Actions, {
  newPengeluaran: d => openPengeluaranForm(d.id),
  editPengeluaran: d => openPengeluaranForm(null, d.id),
  delPengeluaran: d => confirmBox({ title: 'Hapus pengeluaran ini?', text: 'Catatan pengeluaran akan dihapus permanen.', ok: 'Hapus', danger: true }, () => {
    S.pengeluaran = (S.pengeluaran || []).filter(r => r.pengeluaran_id !== d.id); saveSnapshot(); keepScroll(renderAll); toast('Pengeluaran dihapus'); Outbox.push('deletePengeluaran', [d.id]);
  })
});
Object.assign(Changes, { pkKat: el => el.form.querySelectorAll('input[name=kategori]').forEach(r => r.closest('.chip-btn').classList.toggle('on', r.checked)) });
Object.assign(Forms, { pengeluaran: f => submitPengeluaran(f) });
window.__GT_PARTS = (window.__GT_PARTS || []).concat('JS7');
