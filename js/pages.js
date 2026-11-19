/* GOAL TRACKERS — js/pages.js (2/4): Halaman: dashboard, goals, detail, finansial, perayaan */
// ============================================================
// HALAMAN: DASHBOARD
// ============================================================
function finSummary() {
  const fg = S.goals.filter(g => g.tipe_target === 'Finansial' && g.status !== 'Arsip');
  const ids = new Set(fg.map(g => g.goal_id));
  const ym = today().slice(0, 7);
  const lastYm = addDays(ym + '-01', -1).slice(0, 7);
  const sumMonth = m => S.logs.filter(l => ids.has(l.goal_id) && l.tanggal.slice(0, 7) === m).reduce((s, l) => s + (Number(l.nilai_tambah) || 0), 0);
  return {
    count: fg.length, goals: fg,
    target: fg.reduce((s, g) => s + Number(g.nilai_target), 0),
    saved: fg.reduce((s, g) => s + Number(g.nilai_saat_ini), 0),
    month: sumMonth(ym), last: sumMonth(lastYm)
  };
}
function insights() {
  const out = [];
  const ym = today().slice(0, 7);
  const live = S.goals.filter(g => g.status !== 'Arsip');
  // 1. Progres tercepat bulan ini
  let best = null, bestGain = 0;
  live.forEach(g => {
    if (g.tipe_target === 'Checklist' || !(g.nilai_target > 0)) return;
    const gain = S.logs.filter(l => l.goal_id === g.goal_id && l.tanggal.slice(0, 7) === ym).reduce((s, l) => s + Number(l.nilai_tambah), 0) / g.nilai_target * 100;
    if (gain > bestGain) { bestGain = gain; best = g; }
  });
  if (best) out.push({ c: '#CFF2D6', t: `"${best.judul}" naik ${fmtN(Math.round(bestGain))}% bulan ini — progres tercepat! 🚀` });
  // 2. Tabungan bulan ini vs bulan lalu
  const f = finSummary();
  if (f.count) {
    if (f.month > 0 && f.last > 0) {
      const d = Math.round((f.month - f.last) / f.last * 100);
      out.push({ c: '#FFE1C7', t: `Tabungan bulan ini ${fmtShort(f.month, 'Rp')}, ${d >= 0 ? 'naik' : 'turun'} ${Math.abs(d)}% dibanding bulan lalu.` });
    } else if (f.month > 0) out.push({ c: '#FFE1C7', t: `Sudah menabung ${fmtShort(f.month, 'Rp')} bulan ini. Pertahankan! 💰` });
    else out.push({ c: '#FFE1C7', t: `Belum ada setoran tabungan bulan ini. Sedikit pun berarti 🙂` });
  }
  // 3. Goal berisiko terlambat
  const risky = live.filter(g => goalState(g) === 'active' && g.tipe_target !== 'Checklist').map(g => ({ g, p: projection(g) }))
    .filter(x => !x.p.done && (!x.p.eta || x.p.eta > x.g.tenggat)).sort((a, b) => a.g.tenggat.localeCompare(b.g.tenggat))[0];
  if (risky) out.push({ c: '#FBEBB5', t: `"${risky.g.judul}" berisiko terlambat. Butuh ±${fmtShort(Math.ceil(monthlyNeed(risky.g)), risky.g.satuan)} per bulan agar tepat waktu.` });
  // 4. Pencapaian bulan ini
  const achMonth = liveAch().filter(a => String(a.tanggal).slice(0, 7) === ym).length;
  if (achMonth) out.push({ c: '#E8D3F5', t: `Kalian meraih ${achMonth} pencapaian bulan ini. Rayakan! 🎉` });
  if (!out.length) out.push({ c: '#D5F0F7', t: 'Mulai dengan satu goal kecil hari ini — langkah kecil tetap langkah maju. 💪' });
  return out.slice(0, 4);
}
function agendaHtml() {
  const list = S.goals.filter(g => ['active', 'overdue', 'upcoming'].includes(goalState(g))).sort((a, b) => a.tenggat.localeCompare(b.tenggat)).slice(0, 5);
  const cards = list.map(g => {
    const left = dayDiff(today(), g.tenggat);
    const lbl = left > 1 ? `Sisa ${left} hari` : left === 1 ? 'Besok' : left === 0 ? 'Hari ini' : `Terlambat ${-left} hari`;
    return `<div class="ev tint" style="--c:${esc(goalColor(g))}">
      <div class="ev-head">${ownerAvatars(g)}<span>${g.jenis === 'Bersama' ? 'Goal Bersama' : 'Goal Pribadi'}</span><span class="date">${fmtDay(g.tenggat)}</span></div>
      <div class="ev-body"><b>${esc(g.judul)}</b><br><span class="tiny">${valueText(g)}${targetText(g) ? ' dari ' + targetText(g) : ''} · ${pctInt(g)}%</span></div>
      <button class="ev-foot w-100" data-action="openGoal" data-id="${g.goal_id}"><i class="bi bi-clock"></i> ${lbl}</button>
    </div>`;
  }).join('');
  return `<h2 class="side-title">Agenda & Tenggat <span aria-hidden="true">📅</span></h2>${cards || ''}${financeAgendaHtml()}${cards || financeAgendaHtml() ? '' : '<p class="muted">Tidak ada tenggat dekat. Santai dulu ☕</p>'}
    <button class="ev dashed w-100" data-action="newGoal"><i class="bi bi-plus-circle"></i> Tambah goal baru</button>`;
}
function recentAchHtml() {
  const list = liveAch().sort((a, b) => String(b.tanggal).localeCompare(String(a.tanggal))).slice(0, 3);
  if (!list.length) return '';
  return `<h2 class="side-title">Pencapaian Terbaru <span aria-hidden="true">🎉</span></h2>` + list.map(a => {
    const g = goalById(a.goal_id) || {};
    return `<div class="ev tint" style="--c:${esc(g.kategori_id ? goalColor(g) : '#CFF2D6')}">
      <div class="ev-head">${avatarHtml(userById(a.user_id), 'sm')}<span>${esc(a.jenis)}</span><span class="date">${fmtDay(a.tanggal)}</span></div>
      <div class="ev-body">${esc(a.pesan)}</div></div>`;
  }).join('') + `<button class="link-btn" data-action="nav" data-page="celebrate">Lihat galeri perayaan →</button>`;
}
function renderDashboard() {
  const me = S.me, p = partner();
  const live = S.goals.filter(g => g.status !== 'Arsip');
  const done = live.filter(g => goalState(g) === 'done').length;
  const running = live.filter(g => ['active', 'overdue'].includes(goalState(g))).length;
  const soon = live.filter(g => goalState(g) !== 'done' && dayDiff(today(), g.tenggat) >= 0 && dayDiff(today(), g.tenggat) <= 14).length;
  const shared = sortGoals(live.filter(g => g.jenis === 'Bersama' && goalState(g) !== 'done'), 'prioritas');
  const mine = live.filter(g => g.jenis === 'Pribadi' && g.pemilik_id === me.user_id && goalState(g) !== 'done');
  const theirs = live.filter(g => g.jenis === 'Pribadi' && g.pemilik_id !== me.user_id && goalState(g) !== 'done');
  const f = finSummary();
  const h = new Date().getHours();
  const greet = h < 11 ? 'Selamat pagi' : h < 15 ? 'Selamat siang' : h < 18 ? 'Selamat sore' : 'Selamat malam';
  $('#page-dashboard').innerHTML = `
  <div class="dash">
    <div class="dash-main">
      <div class="page-head">
        <div><p class="eyebrow">${greet} · ${fmtLong(today())}</p><h1>Halo, ${esc(me.nama)} <span aria-hidden="true">👋</span></h1></div>
        <form class="search-pill" data-form="dashSearch" role="search"><i class="bi bi-search"></i><input id="dashSearch" name="q" type="search" placeholder="Cari goal lalu tekan Enter…" aria-label="Cari goal"></form>
      </div>
      <div class="stats">
        <button class="stat tint" style="--c:#D5F0F7" data-action="dashGo" data-status="live" aria-label="Lihat semua goal"><b>${live.length}</b><span>Total Goal</span></button>
        <button class="stat tint" style="--c:#CFF2D6" data-action="dashGo" data-status="selesai" aria-label="Lihat goal selesai"><b>${done}</b><span>Selesai</span>${done ? '<span class="pop" aria-hidden="true">🎉</span>' : ''}</button>
        <button class="stat" data-action="dashGo" data-status="aktif" aria-label="Lihat goal berjalan"><b>${running}</b><span>Berjalan</span></button>
        <div class="stat dashed"><b>${soon}</b><span>Tenggat ≤ 14 hari</span></div>
      </div>
      <div class="dash-two mt-3">
        <div class="insight"><h3><i class="bi bi-stars"></i> Insight Pintar</h3><ul>${insights().map(i => `<li style="--c:${i.c}">${esc(i.t)}</li>`).join('')}</ul></div>
        ${f.count ? `<div class="card fin-card">
          <h3 class="mb-0">Tabungan Target <button class="link-btn" data-action="nav" data-page="finance">Detail →</button></h3>
          <div class="fin-row"><b>${fmtShort(f.saved, 'Rp')}</b><span class="muted tiny">dari ${fmtShort(f.target, 'Rp')}</span></div>
          <div class="pbar"><span style="width:${f.target ? Math.min(100, f.saved / f.target * 100) : 0}%"></span></div>
          <div class="fin-row tiny"><span class="muted">Bulan ini</span><strong>+${fmtShort(f.month, 'Rp')}</strong></div>
          ${finExtraHtml()}
          <button class="btn btn-mint btn-sm" data-action="logProgress" data-tipe="Finansial"><i class="bi bi-wallet2"></i> Setor tabungan</button>
        </div>` : `<div class="card">${emptyHtml('bi-wallet2', 'Belum ada target finansial.', '<button class="btn btn-dark btn-sm" data-action="newGoal" data-tipe="Finansial">Buat target tabungan</button>')}</div>`}
      </div>
      <h2 class="sec-title">Goal Bersama <span aria-hidden="true">💞</span> <button class="link-btn ms-auto" data-action="nav" data-page="goals" data-tab="bersama">Lihat semua</button></h2>
      ${shared.length ? `<div class="slider"><button type="button" class="slide-btn prev" data-slide="-1" aria-label="Geser ke kiri"><i class="bi bi-chevron-left"></i></button><div class="hscroll">${shared.map((g, i) => goalCard(g, { featured: i === 0 })).join('')}</div><button type="button" class="slide-btn next" data-slide="1" aria-label="Geser ke kanan"><i class="bi bi-chevron-right"></i></button></div>`
        : `<div class="card">${emptyHtml('bi-people', 'Belum ada goal bersama yang berjalan.', '<button class="btn btn-dark btn-sm" data-action="newGoal" data-jenis="Bersama">Buat goal bersama</button>')}</div>`}
      <div class="dash-two mt-2">
        <div class="card"><h3>Goal Saya ${avatarHtml(me, 'sm')}</h3>${miniList(mine)}</div>
        <div class="card"><h3>Goal ${esc(p ? p.nama : 'Pasangan')} ${p ? avatarHtml(p, 'sm') : ''}</h3>${miniList(theirs, true)}</div>
      </div>
    </div>
    <aside class="dash-side" aria-label="Agenda dan pencapaian">${agendaHtml()}${recentAchHtml()}</aside>
  </div>`;
}

// ============================================================
// HALAMAN: GOALS
// ============================================================
const mqWide = matchMedia('(min-width: 768px)');
function filteredGoals() {
  const u = S.ui, me = S.me.user_id;
  let list = S.goals.slice();
  if (u.goalTab === 'saya') list = list.filter(g => g.jenis === 'Pribadi' && g.pemilik_id === me);
  else if (u.goalTab === 'pasangan') list = list.filter(g => g.jenis === 'Pribadi' && g.pemilik_id !== me);
  else if (u.goalTab === 'bersama') list = list.filter(g => g.jenis === 'Bersama');
  if (u.goalCat) list = list.filter(g => g.kategori_id === u.goalCat);
  if (u.goalStatus === 'aktif') list = list.filter(g => ['active', 'upcoming', 'overdue'].includes(goalState(g)));
  else if (u.goalStatus === 'selesai') list = list.filter(g => goalState(g) === 'done');
  else if (u.goalStatus === 'arsip') list = list.filter(g => goalState(g) === 'archived');
  else if (u.goalStatus === 'live') list = list.filter(g => goalState(g) !== 'archived');
  const q = u.goalQuery.trim().toLowerCase();
  if (q) list = list.filter(g => (g.judul + ' ' + g.deskripsi).toLowerCase().includes(q));
  return sortGoals(list, u.goalSort);
}
function renderGoals() {
  const u = S.ui, me = S.me.user_id;
  const notArch = S.goals.filter(g => g.status !== 'Arsip');
  const count = {
    semua: notArch.length, saya: notArch.filter(g => g.jenis === 'Pribadi' && g.pemilik_id === me).length,
    pasangan: notArch.filter(g => g.jenis === 'Pribadi' && g.pemilik_id !== me).length, bersama: notArch.filter(g => g.jenis === 'Bersama').length
  };
  const p = partner();
  const tabs = [['semua', 'Semua'], ['saya', 'Milik Saya'], ['pasangan', p ? 'Milik ' + p.nama : 'Pasangan'], ['bersama', 'Bersama']]
    .map(([k, l]) => `<button role="tab" aria-selected="${u.goalTab === k}" class="${u.goalTab === k ? 'on' : ''}" data-action="goalTab" data-tab="${k}">${esc(l)}<span class="n">${count[k]}</span></button>`).join('');
  // Hitungan kategori mengikuti tab yang dipilih (Semua / Milik Saya / Pasangan / Bersama)
  const inTab = notArch.filter(g => u.goalTab === 'saya' ? (g.jenis === 'Pribadi' && g.pemilik_id === me)
    : u.goalTab === 'pasangan' ? (g.jenis === 'Pribadi' && g.pemilik_id !== me)
    : u.goalTab === 'bersama' ? g.jenis === 'Bersama' : true);
  const catN = {}; inTab.forEach(g => { catN[g.kategori_id] = (catN[g.kategori_id] || 0) + 1; });
  const cats = `<button class="chip-btn ${!u.goalCat ? 'on' : ''}" data-action="goalCat" data-id="">Semua kategori<span class="n">${inTab.length}</span></button>` +
    activeCats().map(c => { const n = catN[c.kategori_id] || 0; return `<button class="chip-btn cat-chip ${u.goalCat === c.kategori_id ? 'on' : ''} ${n ? '' : 'zero'}" data-action="goalCat" data-id="${c.kategori_id}"><span class="cat-ic" style="--c:${esc(c.warna || '#D5F0F7')}"><i class="bi ${esc(c.ikon)}"></i></span>${esc(c.nama)}<span class="n">${n}</span></button>`; }).join('');
  const opt = (v, l, cur) => `<option value="${v}" ${cur === v ? 'selected' : ''}>${l}</option>`;
  const views = [['journey', 'bi-bezier2', 'Peta perjalanan'], ['list', 'bi-list-ul', 'Daftar'], ['grid', 'bi-grid', 'Kartu']]
    .map(([k, i, l]) => `<button class="${u.goalView === k ? 'on' : ''}" data-action="goalView" data-view="${k}" aria-label="${l}" title="${l}" aria-pressed="${u.goalView === k}"><i class="bi ${i}"></i></button>`).join('');
  $('#page-goals').innerHTML = `
    <div class="page-head">
      <div><p class="eyebrow">${count.semua} goal berjalan & selesai</p><h1>Goal Kami <span aria-hidden="true">🎯</span></h1></div>
      <label class="search-pill"><i class="bi bi-search"></i><input id="goalSearch" type="search" placeholder="Cari judul goal…" value="${esc(u.goalQuery)}" data-input="goalSearch" aria-label="Cari goal"></label>
    </div>
    <div class="toolbar">
      <div class="tabs" role="tablist">${tabs}</div>
      <div class="chips">${cats}</div>
      <div class="toolbar-row">
        <select data-change="goalStatus" aria-label="Filter status">${opt('aktif', 'Sedang berjalan', u.goalStatus)}${opt('selesai', 'Selesai', u.goalStatus)}${opt('arsip', 'Diarsipkan', u.goalStatus)}${opt('live', 'Semua (tanpa arsip)', u.goalStatus)}${opt('semua', 'Semua status', u.goalStatus)}</select>
        <select data-change="goalSort" aria-label="Urutkan">${opt('tenggat', 'Tenggat terdekat', u.goalSort)}${opt('progres', 'Progres tertinggi', u.goalSort)}${opt('prioritas', 'Prioritas', u.goalSort)}${opt('terbaru', 'Terbaru dibuat', u.goalSort)}</select>
        <button class="btn btn-dark btn-sm ms-auto" data-action="newGoal"><i class="bi bi-plus-lg"></i> Goal Baru</button>
      </div>
    </div>
    <div class="goals-layout">
      <div class="view-rail" role="group" aria-label="Pilih tampilan">${views}</div>
      <div id="goalList"></div>
    </div>`;
  renderGoalList();
}
function renderGoalList() {
  const box = $('#goalList');
  if (!box) return;
  const list = filteredGoals();
  if (!list.length) {
    box.innerHTML = `<div class="card">${emptyHtml('bi-search', S.ui.goalQuery ? 'Tidak ada goal yang cocok dengan pencarian.' : 'Belum ada goal di sini.', '<button class="btn btn-dark btn-sm" data-action="newGoal">Buat goal baru</button>')}</div>`;
    return;
  }
  const v = S.ui.goalView;
  if (v === 'list') { box.innerHTML = `<div class="glist">${list.map(rowItem).join('')}</div>`; return; }
  if (v === 'grid') { box.innerHTML = `<div class="ggrid">${list.map(g => `<div class="m-item">${goalCard(g)}</div>`).join('')}</div>`; return; }
  const featured = list.find(g => g.jenis === 'Bersama' && goalState(g) !== 'done');
  const item = g => `<div class="j-item">${goalCard(g, { featured: g === featured })}</div>`;
  if (mqWide.matches) {
    const left = list.filter((_, i) => i % 2 === 0), right = list.filter((_, i) => i % 2 === 1);
    box.innerHTML = `<div class="journey"><div class="j-col">${left.map(item).join('')}</div><div class="j-col">${right.map(item).join('')}</div></div>`;
  } else {
    box.innerHTML = `<div class="journey">${list.map(item).join('')}</div>`;
  }
}

// ============================================================
// HALAMAN: DETAIL GOAL
// ============================================================
function renderDetail() {
  const g = goalById(S.ui.detailId);
  const page = $('#page-detail');
  if (!g) {
    page.innerHTML = `<button class="back" data-action="back"><i class="bi bi-arrow-left"></i> Kembali</button><div class="card">${emptyHtml('bi-question-circle', 'Goal tidak ditemukan atau sudah dihapus.')}</div>`;
    return;
  }
  const cat = catById(g.kategori_id), color = goalColor(g), pct = goalPct(g), st = goalState(g);
  const [lbl, cls] = STATE_LABEL[st];
  const ms = msOf(g.goal_id), logs = logsOf(g.goal_id), proj = projection(g);
  const left = dayDiff(today(), g.tenggat), remain = Math.max(0, g.nilai_target - g.nilai_saat_ini);
  const priv = g.jenis === 'Pribadi' && g.visibilitas === 'Privat';
  const checklist = g.tipe_target === 'Checklist';
  const edit = canEdit(g);

  const kv = [
    ['Sisa', checklist ? `${fmtN(remain)} tugas` : fmtShort(remain, g.satuan)],
    ['Sisa waktu', st === 'done' ? 'Selesai 🎉' : left >= 0 ? `${left} hari` : `Lewat ${-left} hari`],
    ['Proyeksi tercapai', proj.done ? 'Sudah tercapai' : proj.eta ? fmtDate(proj.eta) + (proj.eta > g.tenggat ? ' ⚠️' : ' ✅') : 'Belum cukup data'],
    g.tipe_target === 'Finansial' && !proj.done ? ['Saran setoran', fmtShort(Math.ceil(monthlyNeed(g)), 'Rp') + '/bln'] : ['Rata-rata 30 hari', checklist ? `${fmtN(Math.round(proj.rate * 30))} tugas` : fmtShort(Math.round(proj.rate * 30 * 100) / 100, g.satuan)]
  ].map(([k, v]) => `<div><small>${k}</small><b>${v}</b></div>`).join('');

  const msHtml = ms.length ? ms.map(m => {
    const done = m.status === 'Selesai';
    const clickable = checklist && edit && g.status !== 'Arsip';
    const tag = clickable ? 'button' : 'div';
    return `<${tag} class="ms-item ${done ? 'done' : ''} w-100 text-start" ${clickable ? `data-action="toggleMs" data-id="${m.milestone_id}" aria-pressed="${done}"` : ''}>
      <span class="ms-check"><i class="bi bi-check-lg"></i></span>
      <span class="ms-title">${esc(m.judul)}</span>
      ${!checklist && m.nilai_target ? `<span class="ms-val">${fmtShort(m.nilai_target, g.satuan)}</span>` : ''}
      ${done && m.tgl_selesai ? `<span class="ms-val">${fmtDay(m.tgl_selesai)}</span>` : ''}
    </${tag}>`;
  }).join('') : `<p class="muted tiny mb-0">Belum ada milestone. ${edit ? '<button class="link-btn" data-action="editGoal" data-id="' + g.goal_id + '">Tambah lewat Edit</button>' : ''}</p>`;

  let contrib = '';
  if (g.jenis === 'Bersama' && !checklist) {
    const total = logs.reduce((s, l) => s + Math.max(0, Number(l.nilai_tambah)), 0) || 1;
    contrib = `<div class="card"><h3>Kontribusi Kalian</h3><div class="contrib">${S.users.map(u => {
      const sum = logs.filter(l => l.user_id === u.user_id).reduce((s, l) => s + Number(l.nilai_tambah), 0);
      const share = Math.max(0, sum) / total * 100;
      return `<div class="contrib-row">${avatarHtml(u, 'sm')}<div><div class="d-flex justify-content-between"><span>${esc(u.nama)}</span><span class="muted">${Math.round(share)}%</span></div><div class="pbar sm dark"><span style="width:${share}%"></span></div></div><b>${fmtShort(sum, g.satuan)}</b></div>`;
    }).join('')}</div></div>`;
  }

  const reacts = S.reactions.filter(r => r.goal_id === g.goal_id);
  const counts = REACTIONS.map(e => [e, reacts.filter(r => r.emoji === e).length]);
  const canReact = g.jenis === 'Bersama' || g.pemilik_id !== S.me.user_id;
  const lastReact = reacts.slice().sort((a, b) => String(b.dibuat_pada).localeCompare(String(a.dibuat_pada)))[0];
  const reactCard = `<div class="card"><h3>Semangat <span aria-hidden="true">💌</span></h3>
    <div class="react-bar">${counts.map(([e, n]) => canReact
      ? `<button class="react-btn" data-action="react" data-emoji="${e}" data-id="${g.goal_id}" aria-label="Kirim ${e}">${e}${n ? `<small>${n}</small>` : ''}</button>`
      : `<span class="react-btn">${e}${n ? `<small>${n}</small>` : '<small>0</small>'}</span>`).join('')}</div>
    <p class="tiny muted mt-3 mb-0">${lastReact ? `Terakhir: ${esc(userById(lastReact.user_id).nama)} ${lastReact.emoji} · ${timeAgo(lastReact.dibuat_pada)}` : canReact ? 'Kirim semangat untuk goal ini!' : 'Semangat dari pasangan akan muncul di sini.'}</p></div>`;

  const logHtml = logs.length ? logs.slice(0, 60).map(l => {
    const u = userById(l.user_id), n = Number(l.nilai_tambah);
    return `<div class="log-item">${avatarHtml(u, 'sm')}
      <div><div><span class="val ${n < 0 ? 'neg' : ''}">${n > 0 ? '+' : ''}${fmtVal(n, g.satuan)}</span> <span class="muted tiny">· ${esc(u.nama)} · ${fmtDate(l.tanggal)}</span></div>
        ${l.catatan ? `<p>${esc(l.catatan)}</p>` : ''}
        ${l.foto_url ? `<img class="log-thumb" src="${esc(l.foto_url)}" alt="Foto progres" loading="lazy" data-action="previewPhoto" data-src="${esc(l.foto_url)}">` : ''}</div>
      ${l.user_id === S.me.user_id && g.status !== 'Arsip' ? `<button class="icon-btn sm ghost" data-action="deleteLog" data-id="${l.log_id}" aria-label="Hapus catatan"><i class="bi bi-trash3"></i></button>` : '<span></span>'}
    </div>`;
  }).join('') : `<p class="muted tiny mb-0">${checklist ? 'Goal checklist dicatat lewat centang tugas di atas.' : 'Belum ada catatan progres.'}</p>`;

  page.innerHTML = `
    <button class="back" data-action="back"><i class="bi bi-arrow-left"></i> Kembali</button>
    <div class="hero tint" style="--c:${esc(color)}">
      <div class="hero-top">
        <span class="chip"><i class="bi ${esc(cat.ikon)}"></i>${esc(cat.nama)}</span>
        <span class="chip">${g.jenis === 'Bersama' ? '<i class="bi bi-people"></i> Bersama' : `<i class="bi bi-person"></i> ${esc(userById(g.pemilik_id).nama)}`}</span>
        ${g.jenis === 'Pribadi' ? `<span class="chip"><i class="bi ${priv ? 'bi-lock' : 'bi-eye'}"></i>${esc(g.visibilitas)}</span>` : ''}
        <span class="chip"><i class="bi bi-flag"></i>${esc(g.prioritas)}</span>
        <span class="badge-s ${cls}">${lbl}</span>
      </div>
      <div><h1>${esc(g.judul)}</h1>${g.deskripsi ? `<p>${esc(g.deskripsi)}</p>` : ''}</div>
      <div class="hero-main">
        <div class="ring" style="--p:${pct}"><div><b>${pctInt(g)}%</b><small>tercapai</small></div></div>
        <div class="hero-nums"><small class="muted">${checklist ? 'Tugas selesai' : 'Terkumpul'}</small><b>${valueText(g)}</b>
          <span class="muted tiny">${targetText(g) ? 'dari ' + fmtVal(g.nilai_target, g.satuan) + ' · ' : ''}${fmtDate(g.tgl_mulai)} – ${fmtDate(g.tenggat)}</span></div>
      </div>
      <div class="hero-actions">
        ${canLog(g) && !checklist ? `<button class="btn btn-dark" data-action="logProgress" data-id="${g.goal_id}"><i class="bi bi-plus-lg"></i> Catat Progres</button>` : ''}
        ${edit ? `<button class="btn btn-soft" data-action="editGoal" data-id="${g.goal_id}"><i class="bi bi-pencil"></i> Edit</button>` : ''}
        ${edit ? `<button class="icon-btn" style="background:var(--card)" data-action="goalMore" data-id="${g.goal_id}" aria-label="Opsi lainnya"><i class="bi bi-three-dots"></i></button>` : ''}
      </div>
    </div>
    <div class="detail-grid">
      <div class="card"><h3>Ringkasan</h3><div class="kv">${kv}</div></div>
      <div class="card"><h3>${checklist ? 'Daftar Tugas' : 'Milestone'} <span class="muted tiny">${ms.filter(m => m.status === 'Selesai').length}/${ms.length}</span></h3>${msHtml}</div>
      ${contrib || reactCard}
      ${contrib ? reactCard : ''}
      ${extraDetailCards(g)}
      <div class="card span3 span2"><h3>Riwayat Progres <span class="muted tiny">${logs.length} catatan</span></h3>${logHtml}</div>
    </div>`;
}

// ============================================================
// HALAMAN: FINANSIAL
// ============================================================
function monthsBack(endYm, n) {
  const [y, m] = endYm.split('-').map(Number);
  const out = [];
  for (let i = n - 1; i >= 0; i--) { const d = new Date(y, m - 1 - i, 1); out.push(`${d.getFullYear()}-${pad(d.getMonth() + 1)}`); }
  return out;
}
function savingsSeries(months) {
  const ids = new Set(S.goals.filter(g => g.tipe_target === 'Finansial').map(g => g.goal_id));
  const logs = S.logs.filter(l => ids.has(l.goal_id));
  let cum = logs.filter(l => l.tanggal.slice(0, 7) < months[0]).reduce((s, l) => s + Number(l.nilai_tambah), 0);
  const monthly = months.map(ym => logs.filter(l => l.tanggal.slice(0, 7) === ym).reduce((s, l) => s + Number(l.nilai_tambah), 0));
  const cumulative = monthly.map(v => (cum += v));
  return { months, labels: months.map(ym => MONTHS[+ym.slice(5) - 1] + ' ' + ym.slice(2, 4)), monthly, cumulative };
}
// renderFinance ada di JS5 (keuangan)

// ============================================================
// HALAMAN: PERAYAAN
// ============================================================
function renderCelebrate() {
  const u = S.ui;
  let list = liveAch().sort((a, b) => String(b.tanggal).localeCompare(String(a.tanggal)));
  if (u.celebUser) list = list.filter(a => a.user_id === u.celebUser);
  const groups = [['25%', 'bi-flag', '#D5F0F7'], ['50%', 'bi-bullseye', '#E8D3F5'], ['75%', 'bi-rocket-takeoff', '#FBEBB5'], ['100%', 'bi-trophy', '#CFF2D6'], ['Milestone', 'bi-check2-circle', '#FFE1C7'], ['Streak', 'bi-fire', '#F8CFE0']];
  const badges = groups.map(([j, i, c]) => `<div class="badge-card tint" style="--c:${c}"><i class="bi ${i}"></i><b>${list.filter(a => j === 'Streak' ? /^Streak/.test(a.jenis) : a.jenis === j).length}</b><small>${j}</small></div>`).join('');
  const chips = `<button class="chip-btn ${!u.celebUser ? 'on' : ''}" data-action="celebUser" data-id="">Semua</button>` +
    S.users.map(x => `<button class="chip-btn ${u.celebUser === x.user_id ? 'on' : ''}" data-action="celebUser" data-id="${x.user_id}">${esc(x.avatar || '')} ${esc(x.nama)}</button>`).join('');
  const icon = j => j === '100%' ? 'bi-trophy' : j === 'Milestone' ? 'bi-check2-circle' : /^Streak/.test(j) ? 'bi-fire' : 'bi-stars';
  $('#page-celebrate').innerHTML = `
    <div class="page-head"><div><p class="eyebrow">${liveAch().length} momen tercatat</p><h1>Galeri Perayaan <span aria-hidden="true">🎉</span></h1></div></div>
    <div class="badges">${badges}</div>
    <div class="chips mt-3">${chips}</div>
    ${list.length ? `<div class="timeline">${list.map(a => {
      const g = goalById(a.goal_id) || {};
      return `<button class="tl-item tint w-100 text-start" style="--c:${esc(g.kategori_id ? goalColor(g) : '#CFF2D6')}" data-action="openGoal" data-id="${a.goal_id}">
        <div class="tl-head"><i class="bi ${icon(a.jenis)}"></i>${esc(a.jenis)} ${avatarHtml(userById(a.user_id), 'sm')}<span class="date">${fmtDate(a.tanggal)}</span></div>
        <p>${esc(a.pesan)}</p></button>`;
    }).join('')}</div>` : `<div class="card mt-3">${emptyHtml('bi-stars', 'Belum ada pencapaian. Setiap 25% progres akan dirayakan di sini!')}</div>`}`;
}

window.__GT_PARTS = (window.__GT_PARTS || []).concat('JS2');
