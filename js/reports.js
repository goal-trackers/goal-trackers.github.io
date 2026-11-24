/* GOAL TRACKERS — js/reports.js (3/4): Halaman: laporan + grafik + ekspor, pengaturan, notifikasi, modal & toast */
// ============================================================
// HALAMAN: LAPORAN
// ============================================================
function periodRange() {
  const u = S.ui;
  if (u.reportMode === 'tahun') return { start: `${u.reportYear}-01-01`, end: `${u.reportYear}-12-31`, label: `Tahun ${u.reportYear}`, file: u.reportYear };
  const [y, m] = u.reportMonth.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  return { start: `${u.reportMonth}-01`, end: `${u.reportMonth}-${pad(last)}`, label: `${MONTHS_LONG[m - 1]} ${y}`, file: `${y}-${pad(m)}` };
}
function periodLogs() {
  const { start, end } = periodRange();
  return S.logs.filter(l => l.tanggal >= start && l.tanggal <= end).sort((a, b) => (b.tanggal + b.dibuat_pada).localeCompare(a.tanggal + a.dibuat_pada));
}
function reportMonths() {
  return S.ui.reportMode === 'tahun' ? Array.from({ length: 12 }, (_, i) => `${S.ui.reportYear}-${pad(i + 1)}`) : monthsBack(S.ui.reportMonth, 12);
}
function renderReports() {
  const u = S.ui;
  const { label } = periodRange();
  const logs = periodLogs();
  const finIds = new Set(S.goals.filter(g => g.tipe_target === 'Finansial').map(g => g.goal_id));
  const saved = logs.filter(l => finIds.has(l.goal_id)).reduce((s, l) => s + Number(l.nilai_tambah), 0);
  const { start, end } = periodRange();
  const ach = liveAch().filter(a => String(a.tanggal).slice(0, 10) >= start && String(a.tanggal).slice(0, 10) <= end).length;
  const years = Array.from(new Set([today().slice(0, 4)].concat(S.logs.map(l => l.tanggal.slice(0, 4))))).sort().reverse();
  $('#page-reports').innerHTML = `
    <div class="page-head"><div><p class="eyebrow">Rekap ${esc(label)}</p><h1>Laporan <span class="h-ic" style="--c:#CFF2D6" aria-hidden="true"><i class="bi bi-bar-chart-line"></i></span></h1></div>
      <div class="d-flex gap-2 flex-wrap align-items-center justify-content-end rep-tools">
        <div class="seg" style="min-width:200px">
          <label><input type="radio" name="rmode" value="bulan" data-change="reportMode" ${u.reportMode === 'bulan' ? 'checked' : ''}><span>Bulanan</span></label>
          <label><input type="radio" name="rmode" value="tahun" data-change="reportMode" ${u.reportMode === 'tahun' ? 'checked' : ''}><span>Tahunan</span></label>
        </div>
        ${u.reportMode === 'bulan'
      ? `<input class="input" style="max-width:190px;min-height:44px" type="month" value="${u.reportMonth}" max="${today().slice(0, 7)}" data-change="reportMonth" aria-label="Pilih bulan">`
      : `<select class="input" style="max-width:130px;min-height:44px" data-change="reportYear" aria-label="Pilih tahun">${years.map(y => `<option ${y === u.reportYear ? 'selected' : ''}>${y}</option>`).join('')}</select>`}
        <button class="btn btn-soft btn-sm" data-action="exportXlsx"><i class="bi bi-file-earmark-excel"></i> Excel</button>
        <button class="btn btn-dark btn-sm" data-action="exportPdf"><i class="bi bi-file-earmark-pdf"></i> PDF</button>
      </div></div>
    <div class="stats mb-3">
      <div class="stat tint" style="--c:#D5F0F7"><b>${logs.length}</b><span>Catatan progres</span></div>
      <div class="stat tint" style="--c:#FFE1C7"><b>${fmtShort(saved, 'Rp')}</b><span>Tabungan periode ini</span></div>
      <div class="stat tint" style="--c:#CFF2D6"><b>${ach}</b><span>Pencapaian</span></div>
      <div class="stat dashed"><b>${Math.round(avg(S.goals.filter(g => g.status !== 'Arsip').map(goalPct)))}%</b><span>Rata-rata progres</span></div>
    </div>
    <div class="report-grid">
      <div class="card"><h3>Progres per Kategori</h3><div class="chart-box"><canvas id="chCat" role="img" aria-label="Grafik progres per kategori"></canvas></div></div>
      <div class="card rg-wide"><h3>Tren Tabungan per Bulan</h3><div class="chart-box"><canvas id="chTrend" role="img" aria-label="Grafik tren tabungan"></canvas></div></div>
      <div class="card span2 span3">
        <h3>Riwayat Progres <span class="muted tiny">${esc(label)}</span></h3>
        <div class="toolbar rpt-bar">
          <div class="chips rpt-who"><button class="chip-btn ${!u.tblUser ? 'on' : ''}" data-action="tblUser" data-id="">Semua orang</button>${S.users.map(x => `<button class="chip-btn ${u.tblUser === x.user_id ? 'on' : ''}" data-action="tblUser" data-id="${x.user_id}">${avatarHtml(x, 'xs')} ${esc(x.nama)}</button>`).join('')}</div>
          <div class="toolbar-row rpt-filter">
            <label class="search-pill" style="max-width:280px"><i class="bi bi-search"></i><input id="tblSearch" type="search" placeholder="Cari goal / catatan…" value="${esc(u.tblQuery)}" data-input="tblSearch" aria-label="Cari riwayat"></label>
            ${(() => { const cats = S.categories.filter(c => c.aktif !== false);
              window._rfOpts = { rjenis: [['', 'Semua jenis'], ['Pribadi', 'Pribadi'], ['Bersama', 'Bersama']].map(([v, l]) => [v, l, null, (u.tblJenis || '') === v]),
                rcat: [['', 'Semua kategori']].concat(cats.map(c => [c.kategori_id, c.nama])).map(([v, l]) => [v, l, null, (u.tblCat || '') === v]) };
              const lj = u.tblJenis || 'Semua jenis', lc = u.tblCat ? ((catById(u.tblCat) || {}).nama || 'Kategori') : 'Semua kategori';
              return `<button type="button" class="dd-btn ${u.tblJenis ? 'on' : ''}" data-action="hfOpen" data-kind="rjenis" aria-haspopup="menu">${esc(lj)} <i class="bi bi-chevron-down"></i></button>
            <button type="button" class="dd-btn ${u.tblCat ? 'on' : ''}" data-action="hfOpen" data-kind="rcat" aria-haspopup="menu">${esc(lc)} <i class="bi bi-chevron-down"></i></button>`; })()}
          </div>
        </div>
        <div id="rptTable"></div>
      </div>
    </div>`;
  renderReportTable();
  withChart(drawReportCharts);
}
const avg = arr => arr.length ? arr.reduce((s, x) => s + x, 0) / arr.length : 0;
function tableRows() {
  const u = S.ui, q = u.tblQuery.trim().toLowerCase();
  return periodLogs().filter(l => {
    const g = goalById(l.goal_id);
    if (!g) return false;
    if (u.tblUser && l.user_id !== u.tblUser) return false;
    if (u.tblJenis && g.jenis !== u.tblJenis) return false;
    if (u.tblCat && g.kategori_id !== u.tblCat) return false;
    if (q && !(g.judul + ' ' + l.catatan).toLowerCase().includes(q)) return false;
    return true;
  });
}
function renderReportTable() {
  const box = $('#rptTable');
  if (!box) return;
  const rows = tableRows(), per = 20, pages = Math.max(1, Math.ceil(rows.length / per));
  S.ui.tblPage = Math.min(Math.max(1, S.ui.tblPage), pages);
  const slice = rows.slice((S.ui.tblPage - 1) * per, S.ui.tblPage * per);
  if (!rows.length) { box.innerHTML = emptyHtml('bi-table', 'Tidak ada catatan progres pada periode/filter ini.'); return; }
  box.innerHTML = `<div class="table-wrap"><table class="tbl"><thead><tr><th>Tanggal</th><th>Goal</th><th>Kategori</th><th>Jenis</th><th>Oleh</th><th style="text-align:right">Nilai</th><th>Catatan</th></tr></thead><tbody>
    ${slice.map(l => { const g = goalById(l.goal_id); return `<tr><td>${fmtDate(l.tanggal)}</td><td><button class="link-btn p-0 text-start" style="min-height:0;color:var(--text)" data-action="openGoal" data-id="${g.goal_id}">${esc(g.judul)}</button></td><td>${esc(catById(g.kategori_id).nama)}</td><td>${esc(g.jenis)}</td><td>${esc(userById(l.user_id).nama)}</td><td class="num">${Number(l.nilai_tambah) > 0 ? '+' : ''}${fmtVal(l.nilai_tambah, g.satuan)}</td><td>${esc(l.catatan || '-')}</td></tr>`; }).join('')}
    </tbody></table></div>
    <div class="pager"><span>${rows.length} catatan · halaman ${S.ui.tblPage}/${pages}</span><span class="d-flex gap-2">
      <button class="icon-btn sm" data-action="tblPage" data-dir="-1" ${S.ui.tblPage <= 1 ? 'disabled' : ''} aria-label="Sebelumnya"><i class="bi bi-chevron-left"></i></button>
      <button class="icon-btn sm" data-action="tblPage" data-dir="1" ${S.ui.tblPage >= pages ? 'disabled' : ''} aria-label="Berikutnya"><i class="bi bi-chevron-right"></i></button></span></div>`;
}

// ── Grafik (Chart.js dimuat malas & di-prefetch saat idle) ──
const CH = {};
function withChart(fn) {
  if (window.Chart) { fn(); return; }
  loadScript(LIB.chart).then(fn).catch(e => toast(e.message, 'error'));
}
function chartTheme() {
  const cs = getComputedStyle(document.documentElement);
  const v = n => cs.getPropertyValue(n).trim();
  return { text: v('--muted'), line: v('--line'), ink: v('--text'), green: v('--green'), card: v('--card') };
}
function mkChart(id, cfg) {
  if (CH[id]) { CH[id].destroy(); delete CH[id]; }
  const el = document.getElementById(id);
  if (!el || !window.Chart) return;
  const t = chartTheme();
  Chart.defaults.font.family = "'Plus Jakarta Sans', system-ui, sans-serif";
  Chart.defaults.color = t.text;
  Chart.defaults.borderColor = t.line;
  CH[id] = new Chart(el, cfg);
}
function drawTrend(id, s) {
  const t = chartTheme();
  mkChart(id, {
    data: {
      labels: s.labels,
      datasets: [
        { type: 'bar', label: 'Setoran', data: s.monthly, backgroundColor: '#FFC99A', borderRadius: 8, maxBarThickness: 28, order: 2 },
        { type: 'line', label: 'Total terkumpul', data: s.cumulative, borderColor: t.green, backgroundColor: t.green, tension: .35, pointRadius: 3, borderWidth: 3, yAxisID: 'y1', order: 1 }
      ]
    },
    options: {
      maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
      plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8 } }, tooltip: { callbacks: { label: c => `${c.dataset.label}: ${fmtVal(c.raw, 'Rp')}` } } },
      scales: {
        x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true, autoSkipPadding: 8 } },
        y: { beginAtZero: true, ticks: { callback: v => fmtShort(v, 'Rp') }, grid: { color: t.line } },
        y1: { position: 'right', beginAtZero: true, grid: { display: false }, ticks: { callback: v => fmtShort(v, 'Rp') } }
      }
    }
  });
}
function drawReportCharts() {
  const t = chartTheme();
  const live = S.goals.filter(g => g.status !== 'Arsip');
  const cats = activeCats().filter(c => live.some(g => g.kategori_id === c.kategori_id));
  mkChart('chCat', {
    type: 'bar',
    data: { labels: cats.map(c => c.nama), datasets: [{ label: 'Rata-rata progres', data: cats.map(c => Math.round(avg(live.filter(g => g.kategori_id === c.kategori_id).map(goalPct)))), backgroundColor: cats.map(c => c.warna), borderColor: t.ink, borderWidth: 1, borderRadius: 10, maxBarThickness: 26 }] },
    options: { indexAxis: 'y', maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ` ${c.raw}% rata-rata progres` } } }, scales: { x: { min: 0, max: 100, ticks: { callback: v => v + '%' }, grid: { color: t.line } }, y: { grid: { display: false } } } }
  });
  drawTrend('chTrend', savingsSeries(reportMonths()));
}

// ── Ekspor Excel & PDF (diproses di browser: instan, hemat kuota GAS) ──
const plain = s => String(s === undefined || s === null ? '' : s).replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}\u{2B50}]/gu, '').trim();
function goalRowsExport() {
  return S.goals.map(g => ({
    'Judul': g.judul, 'Kategori': catById(g.kategori_id).nama, 'Jenis': g.jenis,
    'Pemilik': g.jenis === 'Bersama' ? 'Bersama' : userById(g.pemilik_id).nama, 'Tipe': g.tipe_target,
    'Target': g.nilai_target, 'Tercapai': g.nilai_saat_ini, 'Satuan': g.satuan, 'Progres (%)': Math.round(goalPct(g) * 10) / 10,
    'Status': STATE_LABEL[goalState(g)][2], 'Mulai': g.tgl_mulai, 'Tenggat': g.tenggat
  }));
}
function logRowsExport() {
  return periodLogs().map(l => {
    const g = goalById(l.goal_id) || {};
    return { 'Tanggal': l.tanggal, 'Goal': g.judul, 'Kategori': catById(g.kategori_id).nama, 'Jenis': g.jenis, 'Oleh': userById(l.user_id).nama, 'Nilai': Number(l.nilai_tambah), 'Satuan': g.satuan, 'Catatan': plain(l.catatan) };
  });
}
async function exportXlsx(btn) {
  setBusy(btn, true);
  try {
    await loadScript(LIB.xlsx);
    const p = periodRange();
    const s = savingsSeries(reportMonths());
    const wb = XLSX.utils.book_new();
    const add = (rows, name, empty) => XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows.length ? rows : [{ Info: empty }]), name);
    add(goalRowsExport(), 'Ringkasan Goal', 'Belum ada goal');
    add(logRowsExport(), 'Riwayat Progres', 'Tidak ada catatan pada periode ini');
    add(s.months.map((m, i) => ({ 'Bulan': s.labels[i], 'Setoran (Rp)': s.monthly[i], 'Total Terkumpul (Rp)': s.cumulative[i] })), 'Tabungan Bulanan', '-');
    add(assetRowsExport(), 'Investasi', 'Belum ada investasi');
    add(loanRowsExport(), 'Pinjaman', 'Belum ada pinjaman');
    add(hartaRowsExport(), 'Harta', 'Belum ada harta');
    add(liveAch().filter(a => String(a.tanggal).slice(0, 10) >= p.start && String(a.tanggal).slice(0, 10) <= p.end)
      .map(a => ({ 'Tanggal': String(a.tanggal).slice(0, 10), 'Jenis': a.jenis, 'Pencapaian': plain(a.pesan), 'Oleh': userById(a.user_id).nama })), 'Pencapaian', 'Belum ada pencapaian');
    XLSX.writeFile(wb, `Rekap_GoalTrackers_${p.file}.xlsx`);
    toast('File Excel diunduh ✅');
  } catch (e) { toast(e.message || 'Gagal membuat Excel.', 'error'); }
  setBusy(btn, false);
}
async function exportPdf(btn) {
  setBusy(btn, true);
  try {
    await loadScript(LIB.jspdf);
    await loadScript(LIB.autotable);
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const W = doc.internal.pageSize.getWidth();
    const p = periodRange();
    const live = S.goals.filter(g => g.status !== 'Arsip');
    const finIds = new Set(S.goals.filter(g => g.tipe_target === 'Finansial').map(g => g.goal_id));
    const logs = periodLogs();
    doc.setFillColor(17, 17, 17); doc.rect(0, 0, W, 84, 'F');
    doc.setTextColor(255); doc.setFont('helvetica', 'bold'); doc.setFontSize(20);
    doc.text(`Goal Trackers - Rekap ${S.ui.reportMode === 'tahun' ? 'Tahunan' : 'Bulanan'}`, 40, 44);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(11);
    doc.text(`${p.label}  |  Dibuat ${fmtDate(today())} oleh ${plain(S.me.nama)}`, 40, 66);
    doc.setTextColor(26);
    const sum = [
      ['Total goal aktif', String(live.length)],
      ['Goal selesai', String(live.filter(g => goalState(g) === 'done').length)],
      ['Rata-rata progres', Math.round(avg(live.map(goalPct))) + '%'],
      ['Catatan progres periode ini', String(logs.length)],
      ['Tabungan periode ini', fmtVal(logs.filter(l => finIds.has(l.goal_id)).reduce((s, l) => s + Number(l.nilai_tambah), 0), 'Rp')],
      ['Pencapaian periode ini', String(liveAch().filter(a => String(a.tanggal).slice(0, 10) >= p.start && String(a.tanggal).slice(0, 10) <= p.end).length)]
    ];
    doc.autoTable({ startY: 104, head: [['Ringkasan', '']], body: sum, theme: 'plain', headStyles: { fillColor: [207, 242, 214], textColor: 17 }, styles: { fontSize: 10.5 }, columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } }, margin: { left: 40, right: 40 } });
    const goalRows = goalRowsExport().map(r => [plain(r.Judul), r.Kategori, r.Jenis, r.Pemilik, r.Tipe === 'Finansial' ? fmtVal(r.Tercapai, 'Rp') : `${fmtN(r.Tercapai)} ${r.Satuan}`, r.Tipe === 'Finansial' ? fmtVal(r.Target, 'Rp') : `${fmtN(r.Target)} ${r.Satuan}`, r['Progres (%)'] + '%', r.Status, fmtDate(r.Tenggat)]);
    doc.autoTable({ startY: doc.lastAutoTable.finalY + 18, head: [['Goal', 'Kategori', 'Jenis', 'Pemilik', 'Tercapai', 'Target', '%', 'Status', 'Tenggat']], body: goalRows, headStyles: { fillColor: [17, 17, 17] }, alternateRowStyles: { fillColor: [244, 244, 242] }, styles: { fontSize: 8.5, cellPadding: 5 }, margin: { left: 40, right: 40 } });
    let y = doc.lastAutoTable.finalY + 20;
    if (CH.chTrend) {
      if (y + 220 > doc.internal.pageSize.getHeight() - 40) { doc.addPage(); y = 50; }
      doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.text('Tren Tabungan per Bulan', 40, y);
      doc.addImage(CH.chTrend.toBase64Image('image/png', 1), 'PNG', 40, y + 10, W - 80, 200);
      y += 230;
    }
    doc.autoTable({ startY: y, head: [['Tanggal', 'Goal', 'Oleh', 'Nilai', 'Catatan']], body: logRowsExport().map(r => [fmtDate(r.Tanggal), plain(r.Goal), r.Oleh, (r.Nilai > 0 ? '+' : '') + fmtVal(r.Nilai, r.Satuan), r.Catatan]), headStyles: { fillColor: [17, 17, 17] }, alternateRowStyles: { fillColor: [244, 244, 242] }, styles: { fontSize: 8.5, cellPadding: 5 }, margin: { left: 40, right: 40 } });
    const pages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pages; i++) { doc.setPage(i); doc.setFontSize(8); doc.setTextColor(120); doc.text(`Goal Trackers  |  Halaman ${i}/${pages}`, W - 40, doc.internal.pageSize.getHeight() - 20, { align: 'right' }); }
    doc.save(`Rekap_GoalTrackers_${p.file}.pdf`);
    toast('File PDF diunduh ✅');
  } catch (e) { toast(e.message || 'Gagal membuat PDF.', 'error'); }
  setBusy(btn, false);
}

// ============================================================
// HALAMAN: PENGATURAN
// ============================================================
function renderSettings() {
  const me = S.me;
  const theme = document.documentElement.getAttribute('data-theme');
  const cats = activeCats().map(c => `<div class="cat-item"><span class="ic tint" style="--c:${esc(c.warna)}"><i class="bi ${esc(c.ikon)}"></i></span><b>${esc(c.nama)}</b>
    <span class="d-flex gap-1"><button class="icon-btn sm" data-action="catEdit" data-id="${c.kategori_id}" aria-label="Edit ${esc(c.nama)}"><i class="bi bi-pencil"></i></button>
    <button class="icon-btn sm" data-action="catDelete" data-id="${c.kategori_id}" aria-label="Hapus ${esc(c.nama)}"><i class="bi bi-trash3"></i></button></span></div>`).join('');
  const admin = isAdmin() ? `<div class="card"><h3>Admin <span class="chip">Khusus Admin</span></h3>
      <form data-form="adminSettings"><label class="field"><span>Pengingat tenggat (hari sebelum)</span><input name="pengingat_hari" value="${esc(S.settings.pengingat_hari || '7,1')}" placeholder="7,1"><small>Pisahkan dengan koma. Notifikasi in-app dikirim pukul 07.00 WITA.</small></label>
      <button class="btn btn-soft btn-sm" type="submit">Simpan pengingat</button></form>
      <h3 class="mt-4">Pengguna</h3>
      ${S.users.map(u => `<div class="cat-item">${avatarHtml(u)}<div><b>${esc(u.nama)}</b><div class="tiny muted">${esc(u.email)} · ${esc(u.peran)}</div></div><span class="d-flex gap-1 flex-wrap justify-content-end">${u.user_id === me.user_id ? '<span class="tiny muted align-self-center me-1">Anda</span>' : ''}<button class="btn btn-soft btn-sm" data-action="editMember" data-id="${u.user_id}"><i class="bi bi-pencil"></i> Edit</button>${u.user_id !== me.user_id ? `<button class="btn btn-soft btn-sm" data-action="resetPin" data-id="${u.user_id}">Reset PIN</button>` : ''}</span></div>`).join('')}
      ${(() => { const em = S.users.map(u => String(u.email).toLowerCase()); return em.some((e, i) => em.indexOf(e) !== i) ? '<div class="verdict bad mt-2"><i class="bi bi-exclamation-triangle"></i><span>Ada anggota dengan email yang sama, sehingga salah satunya tidak bisa login. Tekan <b>Edit</b> dan ganti emailnya.</span></div>' : ''; })()}
      <button class="btn btn-dark btn-sm w-100 mt-3" data-action="backup"><i class="bi bi-cloud-download"></i> Cadangkan data sekarang</button>
    </div>` : '';
  const nTpl = typeof TPL !== 'undefined' ? Object.keys(TPL).length : 0;
  const SECS = [
    ['profil', 'Profil Saya', 'Nama, foto, avatar & warna profil', '#E8D3F5', 'bi-person-circle', `<div class="d-flex align-items-center gap-2 mt-3">${avatarHtml(me)}<div style="min-width:0"><b class="d-block text-truncate">${esc(me.nama)}</b><small class="muted text-truncate d-block">${esc(me.email)}</small></div></div>`],
    ['keamanan', 'Keamanan', 'Ganti PIN 6 digit untuk masuk', '#FFE1C7', 'bi-shield-lock', ''],
    ['tampilan', 'Tampilan', 'Tema terang/gelap & tampilan bawaan Goals', '#D5F0F7', 'bi-palette', `<div class="tiny mt-3"><span class="chip">${theme === 'dark' ? '🌙 Gelap' : '☀️ Terang'}</span></div>`],
    ['kategori', 'Kategori', `${activeCats().length} kategori goal`, '#CFF2D6', 'bi-tags', `<div class="set-ics mt-3">${activeCats().slice(0, 8).map(c => `<span class="ic tint" style="--c:${esc(c.warna)}"><i class="bi ${esc(c.ikon)}"></i></span>`).join('')}</div>`],
    ['template', 'Template Goal', `${nTpl} template untuk goal baru`, '#FBEBB5', 'bi-bookmark-star', ''],
    ['satuan', 'Satuan Kustom', `${units().length} satuan`, '#F8CFE0', 'bi-rulers', `<div class="mt-3 d-flex flex-wrap gap-1">${units().slice(0, 6).map(x => `<span class="chip">${esc(x)}</span>`).join('')}</div>`],
    ...(isAdmin() ? [['admin', 'Admin', 'Pengingat tenggat, anggota & cadangan data', '#E6E8EE', 'bi-person-gear', `<div class="d-flex mt-3 set-avs">${S.users.map(u => avatarHtml(u)).join('')}</div>`]] : []),
    ['aplikasi', 'Aplikasi', 'Muat ulang data & keluar', '#ECECEA', 'bi-phone', '']
  ];
  const body = {
    profil: `<div class="card">
        <form data-form="profile">
          <div class="d-flex align-items-center gap-3 mb-3 flex-wrap">${avatarHtml(me, 'lg')}<div class="flex-grow-1"><b>${esc(me.nama)}</b><div class="tiny muted">${esc(me.email)} · ${esc(me.peran)}</div>
            <div class="d-flex gap-2 mt-2 flex-wrap">
              <label class="btn btn-soft btn-sm mb-0" style="cursor:pointer"><i class="bi bi-camera"></i> ${me.foto ? 'Ganti foto' : 'Unggah foto'}<input type="file" accept="image/*" class="visually-hidden" data-change="profilePhoto"></label>
              ${me.foto ? '<button type="button" class="btn btn-soft btn-sm text-danger" data-action="removeProfilePhoto"><i class="bi bi-trash3"></i> Hapus foto</button>' : ''}
            </div></div></div>
          <label class="field"><span>Nama</span><input name="nama" value="${esc(me.nama)}" maxlength="40" required></label>
          <div class="field"><span>Avatar ${me.foto ? '<small>(dipakai jika foto dihapus)</small>' : ''}</span><div class="emoji-pick av-pick">${AVATARS.map(a => `<label title="${AV_IC[a][1]}"><input type="radio" name="avatar" value="${a}" ${avKey(me.avatar) === a ? 'checked' : ''}><span class="av-opt" style="--c:${esc(me.warna_profil || '#CFF2D6')}"><i class="bi ${AV_IC[a][0]}"></i></span></label>`).join('')}</div></div>
          <div class="field"><span>Warna profil</span><div class="swatches">${PASTELS.map(c => `<label class="swatch" style="--c:${c}"><input type="radio" name="warna_profil" value="${c}" ${me.warna_profil === c ? 'checked' : ''} aria-label="Warna ${c}"></label>`).join('')}</div></div>
          <button class="btn btn-dark btn-sm" type="submit">Simpan profil</button>
        </form></div>`,
    keamanan: `<div class="card">
        <form data-form="pin" autocomplete="off">
          <label class="field"><span>PIN lama</span><input name="old" type="password" inputmode="numeric" maxlength="6" required></label>
          <label class="field"><span>PIN baru (6 digit)</span><input name="new1" type="password" inputmode="numeric" maxlength="6" required></label>
          <label class="field"><span>Ulangi PIN baru</span><input name="new2" type="password" inputmode="numeric" maxlength="6" required></label>
          <p class="form-error" id="pinError"></p>
          <button class="btn btn-dark btn-sm" type="submit"><span class="btn-label">Ganti PIN</span></button>
        </form>
        </div>`,
    tampilan: `<div class="card">
        <div class="seg mb-3">
          <label><input type="radio" name="theme" value="light" data-change="themeSel" ${theme === 'light' ? 'checked' : ''}><span><i class="bi bi-sun"></i> Terang</span></label>
          <label><input type="radio" name="theme" value="dark" data-change="themeSel" ${theme === 'dark' ? 'checked' : ''}><span><i class="bi bi-moon-stars"></i> Gelap</span></label>
        </div>
        <div class="seg">
          ${[['journey', 'Peta'], ['list', 'Daftar'], ['grid', 'Kartu']].map(([k, l]) => `<label><input type="radio" name="dview" value="${k}" data-change="viewSel" ${S.ui.goalView === k ? 'checked' : ''}><span>${l}</span></label>`).join('')}
        </div>
        <p class="tiny muted mt-2 mb-0">Tampilan bawaan halaman Goals.</p></div>`,
    kategori: `<div class="card"><div class="d-flex justify-content-end mb-2"><button class="btn btn-dark btn-sm" data-action="catEdit" data-id=""><i class="bi bi-plus-lg"></i> Kategori baru</button></div>${cats}</div>`,
    template: typeof tplSettingsCard === 'function' ? tplSettingsCard() : '',
    satuan: `<div class="card">
        <div class="unit-tags">${units().map(x => `<span class="chip">${esc(x)}<button data-action="unitDel" data-unit="${esc(x)}" aria-label="Hapus satuan ${esc(x)}"><i class="bi bi-x"></i></button></span>`).join('')}</div>
        <form data-form="unit" class="d-flex gap-2"><input class="input" name="unit" maxlength="20" placeholder="mis. liter, sesi" aria-label="Satuan baru"><button class="btn btn-dark btn-sm" type="submit">Tambah</button></form></div>`,
    admin: admin,
    aplikasi: `<div class="card">
        <p class="tiny muted">Goal Trackers v1.0 · data tersimpan di Google Sheets milik Admin. Perubahan tersimpan otomatis di latar belakang (ikon awan di atas).</p>
        <div class="d-grid gap-2">
          <button class="btn btn-soft btn-sm" data-action="reload"><i class="bi bi-arrow-repeat"></i> Muat ulang data</button>
          <button class="btn btn-danger btn-sm" data-action="logout"><i class="bi bi-box-arrow-right"></i> Keluar</button>
        </div></div>`
  };
  const sec = SECS.find(x => x[0] === S.ui.setSec);
  $('#page-settings').innerHTML = sec ? `
    <div class="page-head"><div><button class="link-btn set-back" data-action="setSec" data-sec=""><i class="bi bi-arrow-left"></i> Pengaturan</button>
      <h1 class="d-flex align-items-center gap-3"><span class="set-h-ic" style="--c:${sec[3]}"><i class="bi ${sec[4]}"></i></span>${sec[1]}</h1><p class="muted mb-0">${sec[2]}</p></div></div>
    <div class="set-detail">${body[sec[0]]}</div>`
  : `
    <div class="page-head"><div><p class="eyebrow">Atur sesuai kebutuhan kalian</p><h1>Pengaturan <span class="h-ic" style="--c:#E6E8EE" aria-hidden="true"><i class="bi bi-gear"></i></span></h1></div></div>
    <div class="set-tiles">${SECS.map(([k, t, d, c, ic, extra]) => `<button class="set-tile" style="--c:${c}" data-action="setSec" data-sec="${k}">
        <span class="set-tile-ic"><i class="bi ${ic}"></i></span><b>${t}</b><small>${d}</small>${extra}<i class="bi bi-arrow-up-right set-go"></i></button>`).join('')}</div>`;
}

// ============================================================
// HALAMAN: NOTIFIKASI
// ============================================================
const NOTIF_ICON = {
  pencapaian: ['bi-trophy', '#FBEBB5'], progres: ['bi-graph-up-arrow', '#CFF2D6'], reaksi: ['bi-heart', '#F8CFE0'],
  tenggat: ['bi-alarm', '#FFE1C7'], sepi: ['bi-hourglass-split', '#D5F0F7'], goal_baru: ['bi-people', '#E8D3F5'], info: ['bi-info-circle', '#D5F0F7'],
  kupon: ['bi-cash-coin', '#CFF2D6'], jatuh_tempo: ['bi-bank', '#FBEBB5'], cicilan: ['bi-credit-card', '#E8D3F5'], harta: ['bi-gem', '#FBEBB5']
};
function renderNotifications() {
  const list = S.notifications.slice().sort((a, b) => String(b.dibuat_pada).localeCompare(String(a.dibuat_pada)));
  const unread = list.filter(n => n.dibaca !== 'Ya').length;
  $('#page-notifications').innerHTML = `
    <div class="page-head"><div><p class="eyebrow">${unread} belum dibaca</p><h1>Notifikasi <span class="h-ic" style="--c:#FBEBB5" aria-hidden="true"><i class="bi bi-bell"></i></span></h1></div>
      ${unread ? '<button class="btn btn-soft btn-sm" data-action="readAll"><i class="bi bi-check2-all"></i> Tandai semua dibaca</button>' : ''}</div>
    <div style="max-width:760px">${list.length ? list.map(n => {
      const [ic, c] = NOTIF_ICON[n.jenis] || NOTIF_ICON.info;
      return `<button class="notif ${n.dibaca === 'Ya' ? 'read' : ''}" data-action="notifOpen" data-id="${n.notif_id}">
        <span class="ic tint" style="--c:${c}"><i class="bi ${ic}"></i></span>
        <span><p>${esc(n.pesan)}</p><small>${timeAgo(n.dibuat_pada)}</small></span>
        ${n.dibaca === 'Ya' ? '<span></span>' : '<span class="unread" aria-label="Belum dibaca"></span>'}</button>`;
    }).join('') : `<div class="card">${emptyHtml('bi-bell', 'Belum ada notifikasi.')}</div>`}</div>`;
}

// ============================================================
// SHEET / MODAL, TOAST, PERAYAAN
// ============================================================
let _lastFocus = null;
function openSheet(title, body) {
  _lastFocus = document.activeElement;
  const s = $('#sheet');
  s.innerHTML = `<div class="sheet-handle"></div><div class="sheet-head"><h2 id="sheetTitle">${title}</h2><button class="icon-btn" data-action="closeSheet" aria-label="Tutup"><i class="bi bi-x-lg"></i></button></div><div class="sheet-body">${body}</div>`;
  document.body.classList.add('sheet-open');
  s.scrollTop = 0;
  setTimeout(() => { const f = s.querySelector('input:not([type=hidden]):not([type=radio]):not([type=file]), select, textarea, button.btn'); if (f && mqWide.matches) f.focus(); }, 60);
}
function closeSheet() {
  if (!document.body.classList.contains('sheet-open')) return;
  document.body.classList.remove('sheet-open');
  S.ui.pendingPhoto = null;
  if (_lastFocus && _lastFocus.focus && document.contains(_lastFocus)) _lastFocus.focus();
}
function toast(msg, type = 'info', ms = 2600) {
  const t = document.createElement('div');
  t.className = 'toast' + (type === 'error' ? ' error' : '');
  t.setAttribute('role', type === 'error' ? 'alert' : 'status');
  t.innerHTML = `<i class="bi ${type === 'error' ? 'bi-exclamation-circle' : 'bi-check-circle'}"></i><span>${esc(msg)}</span>`;
  $('#toasts').appendChild(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 250); }, ms);
}
function confirmBox(o, cb) {
  S.ui.confirmCb = cb;
  openSheet(esc(o.title), `<p class="muted">${esc(o.text)}</p><div class="sheet-foot"><button class="btn btn-soft" data-action="closeSheet">Batal</button><button class="btn ${o.danger ? 'btn-danger' : 'btn-dark'}" data-action="confirmOk">${esc(o.ok || 'Ya')}</button></div>`);
}
function setBusy(btn, busy) {
  if (!btn) return;
  btn.disabled = busy;
  if (busy) { btn.dataset.html = btn.innerHTML; btn.innerHTML = '<span class="spinner dark"></span>'; }
  else if (btn.dataset.html) btn.innerHTML = btn.dataset.html;
}
function showCelebration(a) {
  const el = $('#celebration');
  el.innerHTML = `<div class="cele-card" role="alertdialog" aria-labelledby="celeT"><div class="big">${a.emoji}</div><h2 id="celeT">${esc(a.title)}</h2><p>${esc(a.text)}</p><button class="btn btn-dark w-100" data-action="closeCelebration">Yeay! 🎉</button></div>`;
  el.hidden = false;
  confetti();
  clearTimeout(S.ui.celeT);
  S.ui.celeT = setTimeout(() => { el.hidden = true; }, 6000);
}
function confetti() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const c = $('#confetti'), ctx = c.getContext('2d');
  c.width = innerWidth; c.height = innerHeight; c.style.display = 'block';
  const colors = ['#CFF2D6', '#E8D3F5', '#D5F0F7', '#FBEBB5', '#F8CFE0', '#FFE1C7', '#4CAF6A', '#111111'];
  const parts = Array.from({ length: 150 }, () => ({
    x: innerWidth / 2 + (Math.random() - .5) * 120, y: innerHeight * .38, vx: (Math.random() - .5) * 16, vy: -Math.random() * 13 - 5,
    s: Math.random() * 8 + 5, r: Math.random() * 6, vr: (Math.random() - .5) * .35, c: colors[(Math.random() * colors.length) | 0]
  }));
  let f = 0;
  (function tick() {
    ctx.clearRect(0, 0, c.width, c.height);
    parts.forEach(p => { p.vy += .32; p.x += p.vx; p.y += p.vy; p.vx *= .99; p.r += p.vr; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); ctx.restore(); });
    if (++f < 170) requestAnimationFrame(tick); else { ctx.clearRect(0, 0, c.width, c.height); c.style.display = 'none'; }
  })();
}

window.__GT_PARTS = (window.__GT_PARTS || []).concat('JS3');
