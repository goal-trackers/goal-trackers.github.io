/* GOAL TRACKERS — js/actions.js (4/4): Form, aksi, event listener, dan start aplikasi */
// ============================================================
// FORM: GOAL
// ============================================================
function msRow(m, showVal) {
  return `<div class="ms-row ${showVal ? '' : 'no-val'}" data-ms-id="${esc(m.milestone_id || uid())}">
    <input name="ms_judul" value="${esc(m.judul || '')}" placeholder="${showVal ? 'Nama tahapan' : 'Nama tugas'}" maxlength="80" aria-label="Nama tahapan">
    ${showVal ? `<input name="ms_val" inputmode="decimal" value="${m.nilai_target ? fmtN(m.nilai_target) : ''}" placeholder="Target" aria-label="Target tahapan">` : ''}
    <button type="button" class="icon-btn sm" data-action="msUp" aria-label="Naikkan urutan"><i class="bi bi-arrow-up"></i></button>
    <button type="button" class="icon-btn sm" data-action="msDel" aria-label="Hapus tahapan"><i class="bi bi-x-lg"></i></button>
  </div>`;
}
function openGoalForm(g, preset = {}) {
  const isNew = !g;
  const t = today();
  const d = g || {
    goal_id: uid(), judul: '', deskripsi: '', jenis: preset.jenis || 'Pribadi', visibilitas: 'Terlihat pasangan',
    kategori_id: (preset.tipe === 'Finansial' && S.categories.some(c => c.kategori_id === 'cat-keuangan')) ? 'cat-keuangan' : (activeCats()[0] || {}).kategori_id,
    tipe_target: preset.tipe || 'Angka', nilai_target: '', satuan: 'kali', tgl_mulai: t, tenggat: addDays(t, 90), prioritas: 'Sedang', warna: '',
    template: ''
  };
  const ms = g ? msOf(g.goal_id) : [];
  const showVal = d.tipe_target !== 'Checklist';
  const radio = (name, val, label, cur, chg) => `<label><input type="radio" name="${name}" value="${val}" ${cur === val ? 'checked' : ''} ${chg ? `data-change="${chg}"` : ''}><span>${label}</span></label>`;
  const catsOpt = activeCats().concat(S.categories.filter(c => c.aktif === 'Tidak' && c.kategori_id === d.kategori_id))
    .map(c => `<option value="${c.kategori_id}" ${c.kategori_id === d.kategori_id ? 'selected' : ''}>${esc(c.nama)}</option>`).join('');
  const lockJenis = g && g.jenis === 'Bersama' && g.pemilik_id !== S.me.user_id;
  openSheet(isNew ? 'Goal Baru ✨' : 'Edit Goal', `
  <form data-form="goal" novalidate>
    <input type="hidden" name="goal_id" value="${esc(d.goal_id)}">
    <input type="hidden" name="template" value="${esc(d.template || '')}">
    ${isNew ? tplChipsHtml(d.template || '') : ''}
    <div id="tplBox">${tplBoxHtml(d.template || '', parseMeta(d.meta))}</div>
    <label class="field"><span>Judul goal</span><input name="judul" maxlength="80" required value="${esc(d.judul)}" placeholder="mis. Dana Liburan Keluarga"><em class="field-err"></em></label>
    <label class="field"><span>Deskripsi <small>(opsional)</small></span><textarea name="deskripsi" maxlength="500" placeholder="Kenapa goal ini penting?">${esc(d.deskripsi)}</textarea></label>
    <div class="field"><span>Jenis</span><div class="seg">${radio('jenis', 'Pribadi', '<i class="bi bi-person"></i> Pribadi', d.jenis, 'goalJenis')}${radio('jenis', 'Bersama', '<i class="bi bi-people"></i> Bersama', d.jenis, 'goalJenis')}</div>${lockJenis ? '<small>Goal bersama milik pasangan tidak bisa diubah menjadi pribadi.</small>' : ''}</div>
    <div class="field" id="visField" ${d.jenis === 'Bersama' ? 'hidden' : ''}><span>Visibilitas</span><div class="seg">${radio('visibilitas', 'Terlihat pasangan', '<i class="bi bi-eye"></i> Terlihat pasangan', d.visibilitas)}${radio('visibilitas', 'Privat', '<i class="bi bi-lock"></i> Privat', d.visibilitas)}</div><small>Goal privat hanya terlihat oleh Anda.</small></div>
    <label class="field"><span>Kategori</span><select name="kategori_id">${catsOpt}</select></label>
    <div class="field"><span>Tipe target</span><div class="seg" style="flex-wrap:wrap">${radio('tipe_target', 'Angka', 'Angka', d.tipe_target, 'goalTipe')}${radio('tipe_target', 'Finansial', 'Finansial', d.tipe_target, 'goalTipe')}${radio('tipe_target', 'Checklist', 'Checklist', d.tipe_target, 'goalTipe')}${radio('tipe_target', 'Kebiasaan', 'Kebiasaan', d.tipe_target, 'goalTipe')}</div></div>
    <div class="grid-2" id="targetFields" ${d.tipe_target === 'Checklist' ? 'hidden' : ''}>
      <label class="field"><span id="targetLabel">${d.tipe_target === 'Finansial' ? 'Target (Rp)' : 'Nilai target'}</span><input name="nilai_target" inputmode="decimal" ${d.tipe_target === 'Finansial' ? 'data-money' : ''} value="${d.nilai_target ? fmtN(d.nilai_target) : ''}" placeholder="${d.tipe_target === 'Finansial' ? '15.000.000' : '100'}"><em class="field-err"></em></label>
      <label class="field" id="unitField" ${d.tipe_target === 'Finansial' ? 'hidden' : ''}><span>Satuan</span><input name="satuan" list="unitList" maxlength="20" value="${esc(d.satuan === 'Rp' || d.satuan === 'tugas' ? 'kali' : d.satuan)}"></label>
    </div>
    <datalist id="unitList">${units().map(x => `<option value="${esc(x)}">`).join('')}</datalist>
    <div class="grid-2">
      <label class="field"><span>Mulai</span><input type="date" name="tgl_mulai" value="${esc(d.tgl_mulai)}" required></label>
      <label class="field"><span>Tenggat</span><input type="date" name="tenggat" value="${esc(d.tenggat)}" required><em class="field-err"></em></label>
    </div>
    <div class="field"><span>Prioritas</span><div class="seg">${radio('prioritas', 'Rendah', 'Rendah', d.prioritas)}${radio('prioritas', 'Sedang', 'Sedang', d.prioritas)}${radio('prioritas', 'Tinggi', 'Tinggi', d.prioritas)}</div></div>
    <div class="field"><span>Warna kartu <small>(kosong = ikut kategori)</small></span><div class="swatches">
      <label class="swatch" style="--c:var(--soft)"><input type="radio" name="warna" value="" ${!d.warna ? 'checked' : ''} aria-label="Ikut kategori"><i class="bi bi-slash-lg" style="position:absolute;inset:0;display:grid;place-items:center"></i></label>
      ${PASTELS.map(c => `<label class="swatch" style="--c:${c}"><input type="radio" name="warna" value="${c}" ${d.warna === c ? 'checked' : ''} aria-label="Warna ${c}"></label>`).join('')}</div></div>
    <div class="field"><span id="msLabel">${d.tipe_target === 'Checklist' ? 'Daftar tugas <small>(minimal 1)</small>' : 'Milestone <small>(opsional — selesai otomatis saat nilai tercapai)</small>'}</span>
      <div id="msList">${(ms.length ? ms : (d.tipe_target === 'Checklist' ? [{}] : [])).map(m => msRow(m, showVal)).join('')}</div>
      <button type="button" class="btn btn-soft btn-sm" data-action="msAdd"><i class="bi bi-plus-lg"></i> Tambah ${d.tipe_target === 'Checklist' ? 'tugas' : 'milestone'}</button><em class="field-err" id="msErr"></em></div>
    <p class="form-error" id="goalErr" role="alert"></p>
    <div class="sheet-foot"><button type="button" class="btn btn-soft" data-action="closeSheet">Batal</button><button class="btn btn-dark" type="submit">${isNew ? 'Buat Goal' : 'Simpan'}</button></div>
  </form>`);
  if (lockJenis) $$('#sheet input[name=jenis]').forEach(i => { i.disabled = true; });
  if (isNew && preset.tpl) tplPick(preset.tpl);
}
function goalFormTipeChanged(form) {
  const tipe = form.tipe_target.value;
  const showVal = tipe !== 'Checklist';
  $('#targetFields').hidden = !showVal;
  $('#unitField').hidden = tipe === 'Finansial';
  $('#targetLabel').textContent = tipe === 'Finansial' ? 'Target (Rp)' : 'Nilai target';
  const ti = form.nilai_target;
  if (tipe === 'Finansial') { ti.setAttribute('data-money', ''); ti.placeholder = '15.000.000'; }
  else { ti.removeAttribute('data-money'); ti.placeholder = '100'; }
  if (tipe === 'Kebiasaan' && !form.satuan.value) form.satuan.value = 'kali';
  $('#msLabel').innerHTML = tipe === 'Checklist' ? 'Daftar tugas <small>(minimal 1)</small>' : 'Milestone <small>(opsional — selesai otomatis saat nilai tercapai)</small>';
  const rows = $$('#msList .ms-row').map(r => ({ milestone_id: r.dataset.msId, judul: r.querySelector('[name=ms_judul]').value, nilai_target: r.querySelector('[name=ms_val]') ? parseNum(r.querySelector('[name=ms_val]').value, tipe === 'Finansial') : 0 }));
  $('#msList').innerHTML = (rows.length ? rows : (tipe === 'Checklist' ? [{}] : [])).map(m => msRow(m, showVal)).join('');
}
function submitGoal(form) {
  $$('.field-err', form).forEach(e => { e.textContent = ''; });
  $$('.field.invalid', form).forEach(e => e.classList.remove('invalid'));
  const err = (name, msg) => { const el = form[name]; const f = el && el.closest('.field'); if (f) { f.classList.add('invalid'); const e = f.querySelector('.field-err'); if (e) e.textContent = msg; } return false; };
  const tipe = form.tipe_target.value;
  const jenis = (form.querySelector('input[name=jenis]:checked') || {}).value;
  const money = tipe === 'Finansial';
  const goal = {
    goal_id: form.goal_id.value, judul: form.judul.value.trim(), deskripsi: form.deskripsi.value.trim(), jenis,
    visibilitas: jenis === 'Bersama' ? 'Terlihat pasangan' : form.visibilitas.value, kategori_id: form.kategori_id.value, tipe_target: tipe,
    nilai_target: tipe === 'Checklist' ? 0 : parseNum(form.nilai_target.value, money),
    satuan: tipe === 'Finansial' ? 'Rp' : tipe === 'Checklist' ? 'tugas' : (form.satuan.value.trim() || 'kali'),
    tgl_mulai: form.tgl_mulai.value, tenggat: form.tenggat.value, prioritas: form.prioritas.value, warna: form.warna.value, ikon: '',
    template: form.template.value, meta: tplMetaFromForm(form),
    tgl_pelaksanaan: (goalById(form.goal_id.value) || {}).tgl_pelaksanaan || ''
  };
  const msList = $$('#msList .ms-row').map(r => ({ milestone_id: r.dataset.msId, judul: r.querySelector('[name=ms_judul]').value.trim(), nilai_target: r.querySelector('[name=ms_val]') ? parseNum(r.querySelector('[name=ms_val]').value, money) : 0 })).filter(m => m.judul);
  let ok = true;
  if (!goal.judul) ok = err('judul', 'Judul wajib diisi.');
  if (tipe !== 'Checklist' && !(goal.nilai_target > 0)) ok = err('nilai_target', 'Isi nilai target lebih dari 0.');
  if (!goal.tgl_mulai || !goal.tenggat) ok = err('tenggat', 'Tanggal wajib diisi.');
  else if (goal.tenggat < goal.tgl_mulai) ok = err('tenggat', 'Tenggat harus setelah tanggal mulai.');
  if (tipe === 'Checklist' && !msList.length) { $('#msErr').textContent = 'Tambahkan minimal 1 tugas.'; ok = false; }
  if (!ok) { const f = form.querySelector('.invalid input, .invalid select'); if (f) f.focus(); return; }

  // ── Optimistic: langsung ubah state lokal ──
  let g = goalById(goal.goal_id);
  const isNew = !g;
  if (isNew) { g = Object.assign({}, goal, { pemilik_id: S.me.user_id, nilai_saat_ini: 0, status: 'Aktif', dibuat_pada: nowIso(), diubah_pada: nowIso() }); S.goals.push(g); }
  else Object.assign(g, goal, { diubah_pada: nowIso() });
  const oldMs = msOf(g.goal_id);
  S.milestones = S.milestones.filter(m => m.goal_id !== g.goal_id).concat(msList.map((m, i) => {
    const prev = oldMs.find(o => o.milestone_id === m.milestone_id);
    return { milestone_id: m.milestone_id, goal_id: g.goal_id, judul: m.judul, nilai_target: m.nilai_target, urutan: i + 1, status: prev ? prev.status : 'Belum', tgl_selesai: prev ? prev.tgl_selesai : '' };
  }));
  syncStatusLocal(g);
  saveSnapshot();
  closeSheet();
  if (isNew) navigateTo('detail', { detailId: g.goal_id }); else renderAll();
  toast(isNew ? 'Goal dibuat! Semangat 💪' : 'Perubahan disimpan');
  Outbox.push('saveGoal', [goal, msList]);
}

// ============================================================
// FORM: CATAT PROGRES
// ============================================================
function loggableGoals(tipe) {
  return S.goals.filter(g => canLog(g) && g.tipe_target !== 'Checklist' && goalState(g) !== 'done' && (!tipe || g.tipe_target === tipe));
}
function quickValsHtml(g) {
  if (!g) return '';
  const vals = g.tipe_target === 'Finansial' ? [[50000, '50rb'], [100000, '100rb'], [250000, '250rb'], [500000, '500rb'], [1000000, '1jt']]
    : g.tipe_target === 'Kebiasaan' ? [[1, '+1'], [2, '+2'], [3, '+3']] : [[1, '+1'], [5, '+5'], [10, '+10']];
  return vals.map(([v, l]) => `<button type="button" class="chip-btn" data-action="quickVal" data-v="${v}">${l}</button>`).join('');
}
function openProgressForm(goalId, tipe) {
  let g = goalId ? goalById(goalId) : null;
  const list = g ? [g] : sortGoals(loggableGoals(tipe), 'prioritas');
  if (!list.length) {
    toast(tipe === 'Finansial' ? 'Belum ada target tabungan aktif. Buat dulu ya!' : 'Belum ada goal yang bisa dicatat. Buat goal dulu ya!');
    openGoalForm(null, { tipe });
    return;
  }
  g = g || list[0];
  S.ui.pendingPhoto = null;
  openSheet(tipe === 'Finansial' ? 'Setor Tabungan 💰' : 'Catat Progres ✍️', `
  <form data-form="progress" novalidate>
    ${goalId ? `<input type="hidden" name="goal_id" value="${g.goal_id}"><div class="row-item mb-3" style="box-shadow:none;background:var(--soft)"><span class="ic tint" style="--c:${esc(goalColor(g))}"><i class="bi ${esc(goalIcon(g))}"></i></span><span><b>${esc(g.judul)}</b><span class="sub">${valueText(g)} / ${targetText(g)}</span></span><span class="pct">${pctInt(g)}%</span></div>`
      : `<label class="field"><span>Goal</span><select name="goal_id" data-change="progGoal">${list.map(x => `<option value="${x.goal_id}">${esc(x.judul)} (${pctInt(x)}%)</option>`).join('')}</select></label>`}
    <div class="field"><span>Arah</span><div class="seg"><label><input type="radio" name="arah" value="1" checked><span><i class="bi bi-plus-circle"></i> ${g.tipe_target === 'Finansial' ? 'Setor' : 'Tambah'}</span></label><label><input type="radio" name="arah" value="-1"><span><i class="bi bi-dash-circle"></i> ${g.tipe_target === 'Finansial' ? 'Tarik' : 'Kurangi'}</span></label></div></div>
    <label class="field"><span id="valLabel">${g.tipe_target === 'Finansial' ? 'Jumlah (Rp)' : 'Jumlah (' + esc(g.satuan) + ')'}</span><input name="nilai" inputmode="decimal" ${g.tipe_target === 'Finansial' ? 'data-money' : ''} value="${g.tipe_target === 'Kebiasaan' ? 1 : ''}" required placeholder="0"><em class="field-err"></em></label>
    <div class="quick-vals" id="quickVals">${quickValsHtml(g)}</div>
    <div class="grid-2">
      <label class="field"><span>Tanggal</span><input type="date" name="tanggal" value="${today()}" max="${today()}"></label>
      <label class="field"><span>Catatan <small>(opsional)</small></span><input name="catatan" maxlength="300" placeholder="mis. bonus bulanan"></label>
    </div>
    <label class="photo-drop"><input type="file" accept="image/*" data-change="photoPick"><i class="bi bi-camera fs-4"></i><span id="photoLabel">Tambah foto kenangan (opsional)</span></label>
    <div class="sheet-foot"><button type="button" class="btn btn-soft" data-action="closeSheet">Batal</button><button class="btn btn-dark" type="submit">Simpan</button></div>
  </form>`);
}
function progressGoalChanged(form) {
  const g = goalById(form.goal_id.value);
  if (!g) return;
  const money = g.tipe_target === 'Finansial';
  $('#valLabel').textContent = money ? 'Jumlah (Rp)' : `Jumlah (${g.satuan})`;
  if (money) form.nilai.setAttribute('data-money', ''); else form.nilai.removeAttribute('data-money');
  form.nilai.value = g.tipe_target === 'Kebiasaan' ? 1 : '';
  $('#quickVals').innerHTML = quickValsHtml(g);
}
function submitProgress(form) {
  const g = goalById(form.goal_id.value);
  if (!g) return;
  const money = g.tipe_target === 'Finansial';
  const n = parseNum(form.nilai.value, money) * Number(form.arah.value);
  const fe = form.nilai.closest('.field');
  if (!n) { fe.classList.add('invalid'); fe.querySelector('.field-err').textContent = 'Isi jumlah lebih dari 0.'; form.nilai.focus(); return; }
  const photo = S.ui.pendingPhoto;
  const log = { log_id: uid(), goal_id: g.goal_id, tanggal: form.tanggal.value || today(), user_id: S.me.user_id, nilai_tambah: n, catatan: form.catatan.value.trim(), foto_url: photo ? photo.preview : '', dibuat_pada: nowIso() };
  // ── Optimistic ──
  const before = goalPct(g);
  S.logs.push(log);
  g.nilai_saat_ini = Math.max(0, Number(g.nilai_saat_ini) + n);
  g.diubah_pada = nowIso();
  const newly = syncStatusLocal(g);
  const cele = localCelebrate(g, before, newly);
  saveSnapshot();
  closeSheet();
  renderAll();
  if (!celebrateList(cele, g)) toast(`${n > 0 ? '+' : ''}${fmtVal(n, g.satuan)} tercatat untuk "${g.judul}"`);
  Outbox.push('addProgress', [
    { log_id: log.log_id, goal_id: log.goal_id, nilai_tambah: n, catatan: log.catatan, tanggal: log.tanggal },
    photo ? { data: photo.data, mime: photo.mime } : null
  ]);
}
/** Foto profil: potong persegi di tengah, perkecil ke 160 px (±10 KB) */
function squareAvatar(file, size = 160, q = 0.82) {
  return new Promise((res, rej) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      const side = Math.min(img.width, img.height), sx = (img.width - side) / 2, sy = (img.height - side) / 2;
      const c = document.createElement('canvas'); c.width = c.height = size;
      const ctx = c.getContext('2d'); ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
      URL.revokeObjectURL(url);
      let out = c.toDataURL('image/jpeg', q);
      if (out.length > 44000) out = c.toDataURL('image/jpeg', 0.6);
      res(out);
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('Foto tidak bisa dibaca.')); };
    img.src = url;
  });
}
function setMyPhoto(v) {
  S.me.foto = v;
  const u = S.users.find(x => x.user_id === S.me.user_id); if (u) u.foto = v;
  saveSnapshot(); renderAll();
  Outbox.push('saveProfilePhoto', [v]);
}
function compressImage(file, max = 1280, q = 0.8) {
  return new Promise((res, rej) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      const dataUrl = c.toDataURL('image/jpeg', q);
      res({ data: dataUrl.split(',')[1], mime: 'image/jpeg', preview: dataUrl });
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('Foto tidak bisa dibaca.')); };
    img.src = url;
  });
}

// ============================================================
// FORM LAIN: KATEGORI, RESET PIN
// ============================================================
function openCategoryForm(id) {
  const c = S.categories.find(x => x.kategori_id === id) || { kategori_id: uid(), nama: '', ikon: 'bi-bookmark-star', warna: '#D5F0F7' };
  openSheet(id ? 'Edit Kategori' : 'Kategori Baru', `
  <form data-form="category" novalidate>
    <input type="hidden" name="kategori_id" value="${esc(c.kategori_id)}">
    <label class="field"><span>Nama kategori</span><input name="nama" maxlength="30" required value="${esc(c.nama)}" placeholder="mis. Pendidikan Anak"><em class="field-err"></em></label>
    <div class="field"><span>Ikon</span><div class="icon-pick">${CAT_ICONS.concat(CAT_ICONS.includes(c.ikon) ? [] : [c.ikon]).map(i => `<label><input type="radio" name="ikon" value="${i}" ${c.ikon === i ? 'checked' : ''} aria-label="${i}"><span><i class="bi ${i}"></i></span></label>`).join('')}</div></div>
    <div class="field"><span>Warna</span><div class="swatches">${PASTELS.map(x => `<label class="swatch" style="--c:${x}"><input type="radio" name="warna" value="${x}" ${c.warna === x ? 'checked' : ''} aria-label="Warna ${x}"></label>`).join('')}</div></div>
    <div class="sheet-foot"><button type="button" class="btn btn-soft" data-action="closeSheet">Batal</button><button class="btn btn-dark" type="submit">Simpan</button></div>
  </form>`);
}

// ============================================================
// AKSI (event delegation — satu listener untuk seluruh app)
// ============================================================
const Actions = {
  dashGo: d => { S.ui.goalStatus = d.status; S.ui.goalTab = 'semua'; S.ui.goalCat = ''; S.ui.goalQuery = ''; navigateTo('goals'); },
  nav: d => { if (d.page === 'goals' && d.tab) { S.ui.goalTab = d.tab; S.ui.goalStatus = 'aktif'; } navigateTo(d.page); },
  back: () => goBack(),
  openGoal: d => { if (d.id) navigateTo('detail', { detailId: d.id }); },
  newGoal: d => openGoalForm(null, { jenis: d.jenis, tipe: d.tipe, tpl: d.tpl }),
  editGoal: d => { const g = goalById(d.id); if (g) openGoalForm(g); },
  logProgress: d => openProgressForm(d.id, d.tipe),
  quickAdd: () => openSheet('Tambah', `<div class="menu-list">
      <button data-action="logProgress"><i class="bi bi-plus-circle"></i> Catat progres</button>
      <button data-action="logProgress" data-tipe="Finansial"><i class="bi bi-wallet2"></i> Setor tabungan</button>
      <button data-action="newGoal" data-jenis="Pribadi"><i class="bi bi-person"></i> Goal pribadi baru</button>
      <button data-action="newGoal" data-jenis="Bersama"><i class="bi bi-people"></i> Goal bersama baru</button></div>`),
  moreMenu: () => {
    const unread = S.notifications.filter(n => n.dibaca !== 'Ya').length;
    openSheet('Lainnya', `<div class="menu-list">
      <button data-action="nav" data-page="celebrate"><i class="bi bi-stars"></i> Galeri Perayaan</button>
      <button data-action="nav" data-page="reports"><i class="bi bi-bar-chart-line"></i> Laporan</button>
      <button data-action="nav" data-page="notifications"><i class="bi bi-bell"></i> Notifikasi ${unread ? `<span class="chip ms-auto" style="background:var(--mint)">${unread}</span>` : ''}</button>
      <button data-action="nav" data-page="settings"><i class="bi bi-sliders"></i> Pengaturan</button>
      <button data-action="toggleTheme"><i class="bi bi-circle-half"></i> Mode ${document.documentElement.getAttribute('data-theme') === 'dark' ? 'terang' : 'gelap'}</button>
      <button class="danger" data-action="logout"><i class="bi bi-box-arrow-right"></i> Keluar</button></div>`);
  },
  profileMenu: () => openSheet('Akun', `<div class="d-flex align-items-center gap-3 mb-3">${avatarHtml(S.me, 'lg')}<div><b>${esc(S.me.nama)}</b><div class="tiny muted">${esc(S.me.email)} · ${esc(S.me.peran)}</div></div></div>
    <div class="menu-list">
      <button data-action="nav" data-page="settings"><i class="bi bi-person-gear"></i> Profil & Pengaturan</button>
      <button data-action="nav" data-page="notifications"><i class="bi bi-bell"></i> Notifikasi</button>
      <button data-action="reload"><i class="bi bi-arrow-repeat"></i> Muat ulang data</button>
      <button class="danger" data-action="logout"><i class="bi bi-box-arrow-right"></i> Keluar</button></div>`),
  closeSheet: () => closeSheet(),
  toggleTheme: () => { applyTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'); closeSheet(); },
  togglePin: (d, el) => { const i = el.parentElement.querySelector('input'); i.type = i.type === 'password' ? 'text' : 'password'; el.innerHTML = `<i class="bi ${i.type === 'password' ? 'bi-eye' : 'bi-eye-slash'}"></i>`; },
  goalTab: d => { S.ui.goalTab = d.tab; keepRows('#page-goals', renderGoals); },
  goalCat: d => { S.ui.goalCat = d.id; keepRows('#page-goals', renderGoals); },
  goalView: d => { S.ui.goalView = d.view; lsSet(KEY.view, d.view); keepRows('#page-goals', renderGoals); },
  msAdd: () => { const tipe = $('#sheet form').tipe_target.value; $('#msList').insertAdjacentHTML('beforeend', msRow({}, tipe !== 'Checklist')); const r = $$('#msList .ms-row').pop(); r.querySelector('input').focus(); },
  msDel: (d, el) => el.closest('.ms-row').remove(),
  msUp: (d, el) => { const r = el.closest('.ms-row'); if (r.previousElementSibling) r.parentNode.insertBefore(r, r.previousElementSibling); },
  quickVal: (d) => { const f = $('#sheet form'); const money = f.nilai.hasAttribute('data-money'); const cur = parseNum(f.nilai.value, money); const v = cur + Number(d.v); f.nilai.value = money ? fmtN(v) : String(v); },
  toggleMs: d => {
    const m = S.milestones.find(x => x.milestone_id === d.id);
    const g = m && goalById(m.goal_id);
    if (!m || !g) return;
    const done = m.status !== 'Selesai';
    const before = goalPct(g);
    m.status = done ? 'Selesai' : 'Belum';
    m.tgl_selesai = done ? today() : '';
    syncStatusLocal(g);
    const cele = done ? localCelebrate(g, before, [m]) : [];
    saveSnapshot();
    renderAll();
    if (done && !celebrateList(cele, g)) toast('Tugas selesai ✅');
    Outbox.push('toggleMilestone', [m.milestone_id, done]);
  },
  react: (d, el) => {
    const r = { reaksi_id: uid(), goal_id: d.id, user_id: S.me.user_id, emoji: d.emoji, dibuat_pada: nowIso() };
    S.reactions.push(r);
    saveSnapshot();
    renderAll();
    toast(`Semangat ${d.emoji} terkirim!`);
    Outbox.push('addReaction', [{ reaksi_id: r.reaksi_id, goal_id: r.goal_id, emoji: r.emoji }]);
  },
  deleteLog: d => confirmBox({ title: 'Hapus catatan progres?', text: 'Nilai goal akan dikurangi sesuai catatan ini.', ok: 'Hapus', danger: true }, () => {
    const l = S.logs.find(x => x.log_id === d.id);
    if (!l) return;
    const g = goalById(l.goal_id);
    S.logs = S.logs.filter(x => x.log_id !== d.id);
    if (g) { g.nilai_saat_ini = Math.max(0, g.nilai_saat_ini - Number(l.nilai_tambah)); syncStatusLocal(g); }
    saveSnapshot();
    renderAll();
    toast('Catatan dihapus');
    Outbox.push('deleteProgress', [d.id]);
  }),
  goalMore: d => {
    const g = goalById(d.id);
    if (!g) return;
    openSheet('Opsi Goal', `<div class="menu-list">
      <button data-action="editGoal" data-id="${g.goal_id}"><i class="bi bi-pencil"></i> Edit goal</button>
      <button data-action="archiveGoal" data-id="${g.goal_id}"><i class="bi ${g.status === 'Arsip' ? 'bi-arrow-counterclockwise' : 'bi-archive'}"></i> ${g.status === 'Arsip' ? 'Pulihkan dari arsip' : 'Arsipkan'}</button>
      ${canDelete(g) ? `<button class="danger" data-action="deleteGoal" data-id="${g.goal_id}"><i class="bi bi-trash3"></i> Hapus permanen</button>` : '<p class="tiny muted mb-0 px-2">Hanya Admin yang bisa menghapus goal bersama.</p>'}</div>`);
  },
  archiveGoal: d => {
    const g = goalById(d.id);
    if (!g) return;
    const arch = g.status !== 'Arsip';
    g.status = arch ? 'Arsip' : (goalPct(g) >= 100 ? 'Selesai' : 'Aktif');
    saveSnapshot();
    closeSheet();
    renderAll();
    toast(arch ? 'Goal diarsipkan' : 'Goal dipulihkan');
    Outbox.push('setGoalArchived', [g.goal_id, arch]);
  },
  deleteGoal: d => confirmBox({ title: 'Hapus goal ini?', text: 'Semua milestone, catatan progres, dan pencapaiannya ikut terhapus. Tindakan ini tidak bisa dibatalkan.', ok: 'Hapus permanen', danger: true }, () => {
    const id = d.id;
    S.goals = S.goals.filter(g => g.goal_id !== id);
    ['milestones', 'logs', 'achievements', 'reactions', 'notifications'].forEach(k => { S[k] = S[k].filter(x => x.goal_id !== id); });
    saveSnapshot();
    S.ui.history = S.ui.history.filter(h => !(h.page === 'detail' && h.detailId === id));
    navigateTo('goals', { noHistory: true });
    toast('Goal dihapus');
    Outbox.push('deleteGoal', [id]);
  }),
  confirmOk: () => { const cb = S.ui.confirmCb; S.ui.confirmCb = null; closeSheet(); if (cb) cb(); },
  previewPhoto: d => {
    const m = /[?&]id=([^&]+)/.exec(d.src);
    const dl = m ? 'https:' + '/' + '/drive.google.com/uc?export=download&id=' + m[1] : '';
    openSheet('Foto Progres', `<img class="preview-img" src="${esc(d.src)}" alt="Foto progres"><div class="sheet-foot"><button class="btn btn-soft" data-action="closeSheet"><i class="bi bi-x-lg"></i> Tutup</button>${dl ? `<a class="btn btn-dark" href="${esc(dl)}" target="_blank" rel="noopener"><i class="bi bi-download"></i> Unduh</a>` : ''}</div>`);
  },
  notifOpen: d => {
    const n = S.notifications.find(x => x.notif_id === d.id);
    if (!n) return;
    if (n.dibaca !== 'Ya') { n.dibaca = 'Ya'; saveSnapshot(); Outbox.push('markNotificationsRead', [[n.notif_id]]); }
    if (n.goal_id && goalById(n.goal_id)) navigateTo('detail', { detailId: n.goal_id }); else renderAll();
  },
  readAll: () => { S.notifications.forEach(n => { n.dibaca = 'Ya'; }); saveSnapshot(); renderAll(); Outbox.push('markNotificationsRead', ['all']); },
  catEdit: d => openCategoryForm(d.id),
  catDelete: d => {
    const c = S.categories.find(x => x.kategori_id === d.id);
    if (!c) return;
    if (activeCats().length <= 1) { toast('Minimal harus ada 1 kategori.', 'error'); return; }
    confirmBox({ title: `Hapus kategori "${c.nama}"?`, text: S.goals.some(g => g.kategori_id === c.kategori_id) ? 'Kategori ini masih dipakai goal, jadi hanya disembunyikan dari pilihan.' : 'Kategori akan dihapus.', ok: 'Hapus', danger: true }, () => {
      if (S.goals.some(g => g.kategori_id === c.kategori_id)) c.aktif = 'Tidak'; else S.categories = S.categories.filter(x => x.kategori_id !== c.kategori_id);
      saveSnapshot(); renderAll(); Outbox.push('deleteCategory', [c.kategori_id]);
    });
  },
  unitDel: d => { const list = units().filter(x => x !== d.unit); S.settings.satuan_kustom = list.join(','); saveSnapshot(); renderAll(); Outbox.push('saveUnits', [list]); },
  removeProfilePhoto: () => confirmBox({ title: 'Hapus foto profil?', text: 'Avatar emoji akan dipakai kembali.', ok: 'Hapus', danger: true }, () => { setMyPhoto(''); toast('Foto profil dihapus'); }),
  editMember: d => {
    const u = userById(d.id), self = d.id === S.me.user_id;
    openSheet('Edit Anggota', `<form data-form="editMember" autocomplete="off" novalidate><input type="hidden" name="uid" value="${esc(d.id)}">
      <label class="field"><span>Nama</span><input name="nama" maxlength="40" value="${esc(u.nama)}" required></label>
      <label class="field"><span>Email login</span><input name="email" type="email" inputmode="email" autocapitalize="off" value="${esc(u.email)}" required><small>Dipakai untuk login. Setiap anggota harus punya email berbeda.</small></label>
      <div class="grid-2">
        <label class="field"><span>Avatar (emoji)</span><input name="avatar" maxlength="8" value="${esc(u.avatar || '')}" placeholder="👩"></label>
        <label class="field"><span>Peran</span><select name="peran" ${self ? 'disabled' : ''}>${['Admin', 'Partner'].map(r => `<option ${u.peran === r ? 'selected' : ''}>${r}</option>`).join('')}</select>${self ? '<small>Peran sendiri tidak bisa diubah.</small>' : ''}</label>
      </div>
      <p class="form-error" id="memberErr"></p>
      <div class="sheet-foot"><button type="button" class="btn btn-soft" data-action="closeSheet">Batal</button><button class="btn btn-dark" type="submit">Simpan</button></div></form>`);
  },
  resetPin: d => {
    const u = userById(d.id);
    openSheet('Reset PIN ' + esc(u.nama), `<form data-form="resetPin" autocomplete="off"><input type="hidden" name="uid" value="${esc(d.id)}">
      <label class="field"><span>PIN baru (6 digit)</span><input name="pin" type="text" inputmode="numeric" maxlength="6" required></label>
      <p class="form-error" id="resetErr"></p><div class="sheet-foot"><button type="button" class="btn btn-soft" data-action="closeSheet">Batal</button><button class="btn btn-dark" type="submit">Reset PIN</button></div></form>`);
  },
  backup: async (d, el) => {
    setBusy(el, true);
    try {
      const r = await api('backupData', S.token);
      openSheet('Cadangan Dibuat ✅', `<p>${esc(r.name)}</p><div class="sheet-foot"><button class="btn btn-soft" data-action="closeSheet">Tutup</button><a class="btn btn-dark" href="${esc(r.url)}" target="_blank" rel="noopener"><i class="bi bi-box-arrow-up-right"></i> Buka</a></div>`);
    } catch (e) { e.auth ? handleAuthLost() : toast(e.message, 'error'); }
    setBusy(el, false);
  },
  reload: async (d, el) => {
    closeSheet();
    if (Outbox.q.length) { toast('Menyelesaikan sinkronisasi dulu…'); Outbox.flush(); return; }
    toast('Memuat ulang data…');
    await refreshData();
  },
  logout: () => doLogout(),
  exportXlsx: (d, el) => exportXlsx(el),
  exportPdf: (d, el) => exportPdf(el),
  tblUser: d => { S.ui.tblUser = d.id; S.ui.tblPage = 1; renderReports(); },
  tblPage: d => { S.ui.tblPage += Number(d.dir); renderReportTable(); },
  celebUser: d => { S.ui.celebUser = d.id; renderCelebrate(); },
  closeCelebration: () => { $('#celebration').hidden = true; clearTimeout(S.ui.celeT); }
};

const Changes = {
  goalStatus: el => { S.ui.goalStatus = el.value; renderGoalList(); },
  goalSort: el => { S.ui.goalSort = el.value; renderGoalList(); },
  goalJenis: el => { $('#visField').hidden = el.value === 'Bersama'; },
  goalTipe: el => goalFormTipeChanged(el.form),
  progGoal: el => progressGoalChanged(el.form),
  profilePhoto: async el => {
    const f = el.files && el.files[0];
    if (!f) return;
    if (String(f.type).indexOf('image') !== 0) { toast('Pilih file gambar.', 'error'); return; }
    try { setMyPhoto(await squareAvatar(f)); toast('Foto profil diperbarui 📸'); }
    catch (e) { toast(e.message, 'error'); }
  },
  photoPick: async el => {
    const f = el.files && el.files[0];
    if (!f) return;
    if (String(f.type).indexOf('image') !== 0) { toast('Pilih file gambar.', 'error'); return; }
    try {
      const p = await compressImage(f);
      if (p.data.length > 2800000) throw new Error('Foto terlalu besar.');
      S.ui.pendingPhoto = p;
      const drop = el.closest('.photo-drop');
      let img = drop.querySelector('img');
      if (!img) { img = document.createElement('img'); img.alt = 'Pratinjau foto'; drop.prepend(img); }
      img.src = p.preview;
      $('#photoLabel').textContent = 'Foto siap — ketuk untuk ganti';
    } catch (e) { toast(e.message, 'error'); }
  },
  reportMode: el => { S.ui.reportMode = el.value; S.ui.tblPage = 1; renderReports(); },
  reportMonth: el => { if (el.value) { S.ui.reportMonth = el.value; S.ui.tblPage = 1; renderReports(); } },
  reportYear: el => { S.ui.reportYear = el.value; S.ui.tblPage = 1; renderReports(); },
  tblJenis: el => { S.ui.tblJenis = el.value; S.ui.tblPage = 1; renderReportTable(); },
  tblCat: el => { S.ui.tblCat = el.value; S.ui.tblPage = 1; renderReportTable(); },
  themeSel: el => applyTheme(el.value),
  viewSel: el => { S.ui.goalView = el.value; lsSet(KEY.view, el.value); toast('Tampilan bawaan disimpan'); }
};

const Inputs = {
  goalSearch: debounce(el => { S.ui.goalQuery = el.value; renderGoalList(); }, 200),
  tblSearch: debounce(el => { S.ui.tblQuery = el.value; S.ui.tblPage = 1; renderReportTable(); }, 250)
};

const Forms = {
  login: async f => {
    const err = $('#loginError');
    const email = f.email.value.trim(), pin = f.pin.value.trim();
    err.textContent = '';
    if (!email || !/^\d{6}$/.test(pin)) { err.textContent = 'Isi email dan PIN 6 digit angka.'; return; }
    const btn = f.querySelector('button[type=submit]');
    setBusy(btn, true);
    try { onLoggedIn(await api('login', email, pin)); f.pin.value = ''; }
    catch (e) { err.textContent = e.message; }
    setBusy(btn, false);
  },
  dashSearch: f => { S.ui.goalQuery = f.q.value.trim(); S.ui.goalTab = 'semua'; S.ui.goalStatus = 'semua'; navigateTo('goals'); },
  goal: f => submitGoal(f),
  progress: f => submitProgress(f),
  category: f => {
    const nama = f.nama.value.trim();
    if (!nama) { f.nama.closest('.field').classList.add('invalid'); f.nama.closest('.field').querySelector('.field-err').textContent = 'Nama wajib diisi.'; return; }
    const cat = { kategori_id: f.kategori_id.value, nama, ikon: (f.querySelector('input[name=ikon]:checked') || {}).value || 'bi-bookmark-star', warna: (f.querySelector('input[name=warna]:checked') || {}).value || '#D5F0F7' };
    const ex = S.categories.find(c => c.kategori_id === cat.kategori_id);
    if (ex) Object.assign(ex, cat, { aktif: 'Ya' }); else S.categories.push(Object.assign({ urutan: S.categories.length + 1, aktif: 'Ya' }, cat));
    saveSnapshot(); closeSheet(); renderAll(); toast('Kategori disimpan');
    Outbox.push('saveCategory', [cat]);
  },
  unit: f => {
    const v = f.unit.value.trim();
    if (!v) return;
    const list = units();
    if (!list.includes(v)) list.push(v);
    S.settings.satuan_kustom = list.join(',');
    saveSnapshot(); renderAll(); Outbox.push('saveUnits', [list]);
  },
  profile: f => {
    const p = { nama: f.nama.value.trim(), avatar: (f.querySelector('input[name=avatar]:checked') || {}).value || S.me.avatar, warna_profil: (f.querySelector('input[name=warna_profil]:checked') || {}).value || S.me.warna_profil };
    if (!p.nama) { toast('Nama wajib diisi.', 'error'); return; }
    Object.assign(S.me, p);
    const u = S.users.find(x => x.user_id === S.me.user_id);
    if (u) Object.assign(u, p);
    saveSnapshot(); renderAll(); toast('Profil disimpan');
    Outbox.push('saveProfile', [p]);
  },
  pin: async f => {
    const err = $('#pinError');
    err.textContent = '';
    if (!/^\d{6}$/.test(f.new1.value)) { err.textContent = 'PIN baru harus 6 digit angka.'; return; }
    if (f.new1.value !== f.new2.value) { err.textContent = 'Ulangi PIN baru tidak sama.'; return; }
    const btn = f.querySelector('button[type=submit]');
    setBusy(btn, true);
    try { await api('changePin', S.token, f.old.value, f.new1.value); f.reset(); toast('PIN berhasil diganti 🔒'); }
    catch (e) { e.auth ? handleAuthLost() : (err.textContent = e.message); }
    setBusy(btn, false);
  },
  editMember: async f => {
    const email = f.email.value.trim().toLowerCase();
    if (!f.nama.value.trim()) { $('#memberErr').textContent = 'Nama wajib diisi.'; return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { $('#memberErr').textContent = 'Format email tidak valid.'; return; }
    if (S.users.some(u => u.user_id !== f.uid.value && String(u.email).toLowerCase() === email)) { $('#memberErr').textContent = 'Email ini sudah dipakai anggota lain.'; return; }
    const btn = f.querySelector('button[type=submit]');
    setBusy(btn, true);
    try {
      const p = await api('adminUpdateMember', S.token, f.uid.value, { nama: f.nama.value.trim(), email, avatar: f.avatar.value.trim(), peran: f.peran.disabled ? undefined : f.peran.value });
      applyPayload(p); closeSheet(); toast('Data anggota disimpan. Login berikutnya memakai email ' + email + '.');
    } catch (e) { e.auth ? handleAuthLost() : ($('#memberErr').textContent = /tidak dikenal|unknown|Aksi/i.test(e.message || '') ? 'Backend belum diperbarui. Pasang Kode.gs terbaru lalu buat Versi baru.' : e.message); }
    setBusy(btn, false);
  },
  resetPin: async f => {
    if (!/^\d{6}$/.test(f.pin.value)) { $('#resetErr').textContent = 'PIN harus 6 digit angka.'; return; }
    const btn = f.querySelector('button[type=submit]');
    setBusy(btn, true);
    try { await api('adminResetPin', S.token, f.uid.value, f.pin.value); closeSheet(); toast('PIN direset. Beritahu pasangan PIN barunya.'); }
    catch (e) { e.auth ? handleAuthLost() : ($('#resetErr').textContent = e.message); }
    setBusy(btn, false);
  },
  adminSettings: f => {
    S.settings.pengingat_hari = f.pengingat_hari.value;
    saveSnapshot(); toast('Pengingat disimpan');
    Outbox.push('saveSettings', [{ pengingat_hari: f.pengingat_hari.value }]);
  }
};

// ── Listener global (delegasi) ──
document.addEventListener('click', e => {
  const el = e.target.closest('[data-action]');
  if (!el || el.disabled) return;
  const fn = Actions[el.dataset.action];
  if (!fn) return;
  e.preventDefault();
  fn(el.dataset, el, e);
});
document.addEventListener('change', e => {
  const el = e.target.closest('[data-change]');
  if (el && Changes[el.dataset.change]) Changes[el.dataset.change](el);
});
document.addEventListener('input', e => {
  const el = e.target;
  if (el.hasAttribute && el.hasAttribute('data-money')) {
    const digits = el.value.replace(/[^\d]/g, '');
    el.value = digits ? fmtN(Number(digits)) : '';
  }
  const f = el.closest && el.closest('.field.invalid');
  if (f) { f.classList.remove('invalid'); const fe = f.querySelector('.field-err'); if (fe) fe.textContent = ''; }
  if (el.dataset && Inputs[el.dataset.input]) Inputs[el.dataset.input](el);
});
document.addEventListener('submit', e => {
  const f = e.target;
  if (Forms[f.dataset.form]) { e.preventDefault(); Forms[f.dataset.form](f); }
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (!$('#celebration').hidden) Actions.closeCelebration();
    else closeSheet();
  }
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('article[role=button]')) { e.preventDefault(); e.target.click(); }
});
document.addEventListener('visibilitychange', () => { if (!document.hidden) { Outbox.flush(); pollNow(); } });
window.addEventListener('online', () => { S.ui.offline = false; Outbox.flush(); });
const onMq = () => { if (S.ui.page === 'goals') renderGoalList(); };
if (mqWide.addEventListener) mqWide.addEventListener('change', onMq); else if (mqWide.addListener) mqWide.addListener(onMq);

// ── Mulai ──

// boot() dipanggil di akhir JS5 (setelah semua modul dimuat)
window.__GT_PARTS = (window.__GT_PARTS || []).concat('JS4');
