/* GOAL TRACKERS — js/finance.js (5/5): Keuangan — template rencana, tanggal pelaksanaan, investasi (SBN/SR), pinjaman, start aplikasi */

const ASSET_TYPES = ['SBN', 'SR', 'ORI', 'ST', 'SBR', 'Deposito', 'Obligasi', 'Lainnya'];
const LOAN_METODE = ['Tanpa bunga', 'Flat', 'Anuitas'];
const JENJANG = ['TK', 'SD', 'SMP', 'SMA', 'Kuliah'];
const TPL = {
  liburan: { label: 'Rencana Liburan', emoji: '🏖️', cat: 'cat-liburan', judul: 'Rencana Liburan', hint: 'Target = total dana yang dibutuhkan. Tanggal pelaksanaan ditetapkan setelah dana terkumpul.' },
  darurat: { label: 'Dana Darurat', emoji: '🛟', cat: 'cat-darurat', judul: 'Dana Darurat Keluarga', hint: 'Idealnya 6–12 × pengeluaran bulanan rumah tangga.' },
  sekolah: { label: 'Tabungan Sekolah Anak', emoji: '🎓', cat: 'cat-pendidikan', judul: 'Dana Sekolah Anak', hint: 'Target sudah memperhitungkan kenaikan biaya pendidikan per tahun.' }
};

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
  const net = Math.round(Number(a.nominal) * Number(a.kupon_persen) / 100 / 12 * (1 - Number(a.pajak_persen || 0) / 100));
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
  return g.tipe_target === 'Finansial' && g.template !== 'darurat' && g.template !== 'sekolah';
}
function tplChipsHtml(cur) {
  return `<div class="field"><span>Mulai dari template <small>(opsional)</small></span><div class="chips chips-wrap">
    ${Object.keys(TPL).map(k => `<button type="button" class="chip-btn ${cur === k ? 'on' : ''}" data-action="tplPick" data-tpl="${k}">${TPL[k].emoji} ${TPL[k].label}</button>`).join('')}
    <button type="button" class="chip-btn ${!cur ? 'on' : ''}" data-action="tplPick" data-tpl="">✏️ Kustom</button></div></div>`;
}
function tplBoxHtml(tpl, m) {
  if (!TPL[tpl]) return '';
  const box = inner => `<div class="card mb-3" style="box-shadow:none;background:var(--soft)"><p class="tiny mb-2"><i class="bi bi-lightbulb"></i> ${esc(TPL[tpl].hint)}</p>${inner}</div>`;
  if (tpl === 'liburan') {
    return box(`<label class="field mb-0"><span>Tujuan / destinasi</span><input name="tpl_tujuan" maxlength="60" value="${esc(m.tujuan || '')}" placeholder="mis. Batu, Malang"></label>`);
  }
  if (tpl === 'darurat') {
    return box(`<div class="grid-2">
      <label class="field"><span>Pengeluaran per bulan (Rp)</span><input name="tpl_pengeluaran" inputmode="numeric" data-money data-input="tplCalc" value="${m.pengeluaran ? fmtN(m.pengeluaran) : ''}" placeholder="8.000.000"></label>
      <label class="field"><span>Berapa bulan?</span><select name="tpl_bulan" data-change="tplCalc">${[3, 6, 9, 12].map(b => `<option value="${b}" ${Number(m.bulan || 6) === b ? 'selected' : ''}>${b} bulan</option>`).join('')}</select></label>
    </div><p class="tiny mb-0 fw-bold" id="tplResult"></p>`);
  }
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
  if (!TPL[tpl]) return;
  const fin = f.querySelector('input[name=tipe_target][value=Finansial]');
  fin.checked = true;
  goalFormTipeChanged(f);
  const jb = f.querySelector('input[name=jenis][value=Bersama]');
  if (jb && !jb.disabled) { jb.checked = true; $('#visField').hidden = true; }
  if ([...f.kategori_id.options].some(o => o.value === TPL[tpl].cat)) f.kategori_id.value = TPL[tpl].cat;
  if (!f.judul.value || Object.keys(TPL).some(k => TPL[k].judul === f.judul.value)) f.judul.value = TPL[tpl].judul;
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
    if (dayDiff(t, i.maturity) >= 0 && dayDiff(t, i.maturity) <= 60) ev.push({ d: i.maturity, c: '#FBEBB5', head: '🏦 Jatuh tempo', body: a.nama + ' · pokok ' + fmtShort(a.nominal, 'Rp') + ' kembali', foot: 'Sisa ' + dayDiff(t, i.maturity) + ' hari', act: 'data-action="nav" data-page="finance" data-fintab="investasi"' });
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
  if (!act.length && !loans.length) return '';
  return `${act.length ? `<div class="fin-row tiny"><span class="muted">Investasi aktif</span><strong>${fmtShort(act.reduce((s, a) => s + Number(a.nominal), 0), 'Rp')} · kupon ${fmtShort(act.reduce((s, a) => s + assetInfo(a).net, 0), 'Rp')}/bln</strong></div>` : ''}
    ${loans.length ? `<div class="fin-row tiny"><span class="muted">Sisa cicilan</span><strong>${fmtShort(loans.reduce((s, l) => s + loanInfo(l).sisaBayar, 0), 'Rp')}</strong></div>` : ''}`;
}

// ============================================================
// HALAMAN: PUSAT FINANSIAL (Tabungan & Rencana | Investasi | Pinjaman)
// ============================================================
function renderFinance() {
  const tab = S.ui.finTab || 'tabungan';
  const f = finSummary();
  const act = S.assets.filter(a => a.status === 'Aktif');
  const invest = act.reduce((s, a) => s + Number(a.nominal), 0);
  const kupon = act.reduce((s, a) => s + assetInfo(a).net, 0);
  const runLoans = S.loans.filter(l => l.status !== 'Lunas' && !loanInfo(l).done);
  const sisaPinjam = runLoans.reduce((s, l) => s + loanInfo(l).sisaBayar, 0);
  const cicilan = runLoans.reduce((s, l) => s + loanInfo(l).c, 0);
  const tabs = [['tabungan', 'Tabungan & Rencana', f.count], ['investasi', 'Investasi', S.assets.length], ['pinjaman', 'Pinjaman', S.loans.length]]
    .map(([k, l, n]) => `<button role="tab" aria-selected="${tab === k}" class="${tab === k ? 'on' : ''}" data-action="finTab" data-tab="${k}">${l}<span class="n">${n}</span></button>`).join('');
  let body = '';
  if (tab === 'tabungan') body = finSavingsHtml(f);
  else if (tab === 'investasi') body = finAssetsHtml();
  else body = finLoansHtml();
  $('#page-finance').innerHTML = `
    <div class="page-head"><div><p class="eyebrow">Tabungan, investasi & cicilan keluarga</p><h1>Pusat Finansial <span aria-hidden="true">💰</span></h1></div></div>
    <div class="stats">
      <div class="stat tint" style="--c:#CFF2D6"><b>${fmtShort(f.saved, 'Rp')}</b><span>Tabungan terkumpul</span></div>
      <div class="stat tint" style="--c:#D5F0F7"><b>${fmtShort(invest, 'Rp')}</b><span>Investasi aktif · kupon ${fmtShort(kupon, 'Rp')}/bln</span></div>
      <div class="stat tint" style="--c:#E8D3F5"><b>${fmtShort(sisaPinjam, 'Rp')}</b><span>Sisa cicilan · ${fmtShort(cicilan, 'Rp')}/bln</span></div>
      <div class="stat dashed"><b>${fmtShort(f.month, 'Rp')}</b><span>Setoran bulan ini</span></div>
    </div>
    <div class="tabs mt-3 mb-3" role="tablist">${tabs}</div>
    ${body}`;
  if (tab === 'tabungan') withChart(() => drawTrend('chFin', savingsSeries(monthsBack(today().slice(0, 7), 12))));
}
function finSavingsHtml(f) {
  const list = sortGoals(f.goals, 'tenggat');
  const cards = list.map(g => {
    const done = goalState(g) === 'done';
    const m = parseMeta(g.meta);
    const tag = TPL[g.template] ? `<span class="chip tint" style="--c:${esc(goalColor(g))}">${TPL[g.template].emoji} ${TPL[g.template].label}</span>` : '';
    return `<div class="card">
      <div class="d-flex align-items-center gap-3">
        <div class="ring" style="--p:${goalPct(g)};--size:84px"><div><b>${pctInt(g)}%</b></div></div>
        <div class="flex-grow-1" style="min-width:0">
          ${tag}
          <button class="link-btn p-0 text-start d-block" style="min-height:0;color:var(--text);font-size:17px;font-weight:800" data-action="openGoal" data-id="${g.goal_id}">${esc(g.judul)}</button>
          <div class="tiny muted">${g.jenis === 'Bersama' ? 'Bersama' : esc(userById(g.pemilik_id).nama)}${m.tujuan ? ' · ' + esc(m.tujuan) : ''} · target ${fmtDate(g.tenggat)}</div>
          <div class="mt-1"><b>${fmtShort(g.nilai_saat_ini, 'Rp')}</b> <span class="muted tiny">/ ${fmtShort(g.nilai_target, 'Rp')}</span></div>
        </div>
      </div>
      <div class="kv mt-3">
        <div><small>Sisa</small><b>${fmtShort(Math.max(0, g.nilai_target - g.nilai_saat_ini), 'Rp')}</b></div>
        <div><small>${done ? (needsExecDate(g) ? 'Pelaksanaan' : 'Status') : 'Saran setoran'}</small><b>${done ? (needsExecDate(g) ? (g.tgl_pelaksanaan ? fmtDate(g.tgl_pelaksanaan) : 'Belum ditetapkan') : 'Tercapai 🎉') : fmtShort(Math.ceil(monthlyNeed(g)), 'Rp') + '/bln'}</b></div>
      </div>
      ${done && needsExecDate(g) && !g.tgl_pelaksanaan && canEdit(g) ? `<button class="btn btn-dark btn-sm w-100 mt-3" data-action="execDate" data-id="${g.goal_id}"><i class="bi bi-calendar-plus"></i> Tetapkan tanggal pelaksanaan</button>` : ''}
      ${canLog(g) && !done ? `<button class="btn btn-mint btn-sm w-100 mt-3" data-action="logProgress" data-id="${g.goal_id}"><i class="bi bi-plus-lg"></i> Setor</button>` : ''}
    </div>`;
  }).join('');
  return `<div class="chips mb-3">
      ${Object.keys(TPL).map(k => `<button class="chip-btn" data-action="newGoal" data-tpl="${k}">${TPL[k].emoji} ${TPL[k].label}</button>`).join('')}
      <button class="chip-btn" data-action="newGoal" data-tipe="Finansial"><i class="bi bi-plus-lg"></i> Target tabungan lain</button>
    </div>
    ${list.length ? `<div class="ggrid">${cards}</div>` : `<div class="card">${emptyHtml('bi-piggy-bank', 'Belum ada rencana tabungan. Pilih template di atas untuk mulai.')}</div>`}
    <div class="card mt-3"><h3>Tren Tabungan 12 Bulan <span class="muted tiny">batang = setoran per bulan · garis = total terkumpul</span></h3><div class="chart-box"><canvas id="chFin" aria-label="Grafik tren tabungan per bulan" role="img"></canvas></div></div>`;
}
function finAssetsHtml() {
  const list = S.assets.slice().sort((a, b) => (a.status === 'Aktif' ? 0 : 1) - (b.status === 'Aktif' ? 0 : 1) || a.tgl_mulai.localeCompare(b.tgl_mulai));
  const cards = list.map(a => {
    const i = assetInfo(a);
    const g = goalById(a.goal_tujuan_id);
    const st = a.status !== 'Aktif' ? `<span class="badge-s s-done">${esc(a.status)} 🎉</span>` : `<span class="badge-s s-active">Aktif</span>`;
    return `<div class="card">
      <div class="d-flex align-items-center gap-3">
        <div class="ring" style="--p:${i.pct};--size:88px"><div><b>${i.k}</b><small>dari ${i.n} bln</small></div></div>
        <div class="flex-grow-1" style="min-width:0">
          <div class="d-flex gap-2 align-items-center flex-wrap"><span class="chip tint" style="--c:#D5F0F7">${esc(a.jenis)}</span>${st}</div>
          <div style="font-size:18px;font-weight:800" class="mt-1">${esc(a.nama)}</div>
          <div class="tiny muted">${esc(ownerName(a.pemilik_id))} · kupon ${fmtN(a.kupon_persen)}%/thn · pajak ${fmtN(a.pajak_persen)}%</div>
          <div class="mt-1"><b>${fmtVal(a.nominal, 'Rp')}</b></div>
        </div>
      </div>
      <div class="kv mt-3">
        <div><small>Sudah berjalan</small><b>${i.k} bulan</b></div>
        <div><small>Sisa tenor</small><b>${i.left} bulan</b></div>
        <div><small>Kupon bersih</small><b>${fmtVal(i.net, 'Rp')}/bln</b></div>
        <div><small>Dana pokok kembali</small><b>${fmtDate(i.maturity)}</b></div>
      </div>
      <p class="tiny muted mt-3 mb-2"><i class="bi bi-arrow-return-right"></i> Kupon masuk ke: <b style="color:var(--text)">${g ? esc(g.judul) : 'tidak diarahkan ke tabungan'}</b>
        ${i.next && a.status === 'Aktif' ? ' · kupon berikutnya ' + fmtDate(i.next) : ''}<br>Total kupon sejak awal ±${fmtShort(i.received, 'Rp')}${i.posted ? ' · tercatat otomatis ' + fmtShort(i.posted, 'Rp') : ''}</p>
      <div class="d-flex gap-2"><button class="btn btn-soft btn-sm" data-action="editAsset" data-id="${a.aset_id}"><i class="bi bi-pencil"></i> Edit</button>
        <button class="btn btn-soft btn-sm" data-action="delAsset" data-id="${a.aset_id}"><i class="bi bi-trash3"></i> Hapus</button></div>
    </div>`;
  }).join('');
  return `<div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
      <p class="tiny muted mb-0" style="max-width:560px">Catat SBN, Sukuk Ritel, ORI, ST, deposito, dll. Kupon bersih tiap bulan otomatis masuk ke tabungan pilihan (diproses pukul 07.00 WITA pada tanggal kupon).</p>
      <button class="btn btn-dark btn-sm" data-action="newAsset"><i class="bi bi-plus-lg"></i> Tambah Investasi</button></div>
    ${list.length ? `<div class="ggrid">${cards}</div>` : `<div class="card">${emptyHtml('bi-bank', 'Belum ada investasi tercatat.', '<button class="btn btn-dark btn-sm" data-action="newAsset">Tambah investasi pertama</button>')}</div>`}`;
}
function finLoansHtml() {
  const list = S.loans.slice().sort((a, b) => (loanInfo(a).done ? 1 : 0) - (loanInfo(b).done ? 1 : 0));
  const cards = list.map(l => {
    const i = loanInfo(l);
    return `<div class="card">
      <div class="d-flex align-items-center gap-3">
        <div class="ring" style="--p:${i.pct};--size:88px"><div><b>${i.k}</b><small>dari ${i.n} bln</small></div></div>
        <div class="flex-grow-1" style="min-width:0">
          <div class="d-flex gap-2 align-items-center flex-wrap"><span class="chip tint" style="--c:#E8D3F5">${esc(l.pemberi)}</span>${i.done ? '<span class="badge-s s-done">Lunas 🎉</span>' : '<span class="badge-s s-active">Berjalan</span>'}</div>
          <div style="font-size:18px;font-weight:800" class="mt-1">${esc(l.nama)}</div>
          <div class="tiny muted">${esc(ownerName(l.pemilik_id))} · ${esc(l.metode)}${Number(l.bunga_persen) ? ' ' + fmtN(l.bunga_persen) + '%/thn' : ''} · potong tgl ${esc(l.tgl_potong)}</div>
          <div class="mt-1"><b>${fmtVal(l.pokok, 'Rp')}</b> <span class="muted tiny">pokok</span></div>
        </div>
      </div>
      <div class="kv mt-3">
        <div><small>Cicilan</small><b>${fmtVal(i.c, 'Rp')}/bln</b></div>
        <div><small>Sisa pokok</small><b>${fmtShort(i.sisaPokok, 'Rp')}</b></div>
        <div><small>Sisa bayar</small><b>${i.left} × = ${fmtShort(i.sisaBayar, 'Rp')}</b></div>
        <div><small>Lunas</small><b>${fmtDate(i.lunas)}</b></div>
      </div>
      <div class="d-flex gap-2 mt-3 flex-wrap"><button class="btn btn-soft btn-sm" data-action="editLoan" data-id="${l.pinjaman_id}"><i class="bi bi-pencil"></i> Edit</button>
        ${!i.done ? `<button class="btn btn-mint btn-sm" data-action="loanLunas" data-id="${l.pinjaman_id}"><i class="bi bi-check2-circle"></i> Tandai lunas</button>` : ''}
        <button class="btn btn-soft btn-sm" data-action="delLoan" data-id="${l.pinjaman_id}"><i class="bi bi-trash3"></i> Hapus</button></div>
    </div>`;
  }).join('');
  return `<div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
      <p class="tiny muted mb-0" style="max-width:560px">Cicilan yang dipotong otomatis dari gaji dihitung berdasarkan tanggal potong. Notifikasi muncul setiap kali cicilan terpotong.</p>
      <button class="btn btn-dark btn-sm" data-action="newLoan"><i class="bi bi-plus-lg"></i> Tambah Pinjaman</button></div>
    ${list.length ? `<div class="ggrid">${cards}</div>` : `<div class="card">${emptyHtml('bi-credit-card', 'Belum ada pinjaman tercatat.', '<button class="btn btn-dark btn-sm" data-action="newLoan">Tambah pinjaman</button>')}</div>`}`;
}

// ============================================================
// FORM: INVESTASI, PINJAMAN, TANGGAL PELAKSANAAN
// ============================================================
function ownerOptions(cur) {
  return `<option value="">Bersama</option>` + S.users.map(u => `<option value="${u.user_id}" ${cur === u.user_id ? 'selected' : ''}>${esc(u.nama)}</option>`).join('');
}
function openAssetForm(id) {
  const a = S.assets.find(x => x.aset_id === id) || { aset_id: uid(), nama: '', jenis: 'SR', pemilik_id: '', nominal: '', kupon_persen: '', pajak_persen: 10, tenor_bulan: 36, tgl_mulai: today(), tgl_kupon: 10, goal_tujuan_id: '', status: 'Aktif', catatan: '' };
  const goals = S.goals.filter(g => g.tipe_target === 'Finansial' && g.status !== 'Arsip');
  openSheet(id ? 'Edit Investasi' : 'Investasi Baru 🏦', `
  <form data-form="asset" novalidate>
    <input type="hidden" name="aset_id" value="${esc(a.aset_id)}">
    <div class="grid-2">
      <label class="field"><span>Jenis</span><select name="jenis">${ASSET_TYPES.map(t => `<option ${a.jenis === t ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
      <label class="field"><span>Seri / nama</span><input name="nama" maxlength="60" required value="${esc(a.nama)}" placeholder="mis. SR019"><em class="field-err"></em></label>
      <label class="field"><span>Nominal (Rp)</span><input name="nominal" inputmode="numeric" data-money data-input="assetCalc" value="${a.nominal ? fmtN(a.nominal) : ''}" placeholder="50.000.000"><em class="field-err"></em></label>
      <label class="field"><span>Kupon / bunga per tahun (%)</span><input name="kupon_persen" inputmode="decimal" data-input="assetCalc" value="${esc(a.kupon_persen)}" placeholder="5"><em class="field-err"></em></label>
      <label class="field"><span>Tenor (bulan)</span><input name="tenor_bulan" type="number" min="1" max="600" data-input="assetCalc" value="${esc(a.tenor_bulan)}"></label>
      <label class="field"><span>Pajak kupon (%)</span><input name="pajak_persen" inputmode="decimal" data-input="assetCalc" value="${esc(a.pajak_persen)}"></label>
      <label class="field"><span>Tanggal mulai (setelmen)</span><input type="date" name="tgl_mulai" data-change="assetCalc" value="${esc(a.tgl_mulai)}"></label>
      <label class="field"><span>Kupon dibayar tiap tanggal</span><input name="tgl_kupon" type="number" min="1" max="31" data-input="assetCalc" value="${esc(a.tgl_kupon)}"></label>
    </div>
    <label class="field"><span>Kupon bulanan masuk ke tabungan</span><select name="goal_tujuan_id"><option value="">— tidak diarahkan —</option>${goals.map(g => `<option value="${g.goal_id}" ${a.goal_tujuan_id === g.goal_id ? 'selected' : ''}>${esc(g.judul)}</option>`).join('')}</select>
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
    nominal: parseNum(f.nominal.value, true), kupon_persen: parseNum(f.kupon_persen.value), pajak_persen: parseNum(f.pajak_persen.value),
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
  el.textContent = `Kupon bersih ±${fmtVal(i.net, 'Rp')}/bln · sudah berjalan ${i.k} dari ${i.n} bulan · dana pokok kembali ${fmtDate(i.maturity)}`;
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
    return { 'Jenis': a.jenis, 'Seri': a.nama, 'Pemilik': ownerName(a.pemilik_id), 'Nominal (Rp)': Number(a.nominal), 'Kupon (%/thn)': Number(a.kupon_persen), 'Pajak (%)': Number(a.pajak_persen),
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
  tplPick: d => tplPick(d.tpl || ''),
  newAsset: () => openAssetForm(),
  editAsset: d => openAssetForm(d.id),
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
  tplCalc: el => recalcTpl(el.form),
  assetCalc: el => assetPreview(el.form),
  loanCalc: el => loanPreview(el.form)
});
Object.assign(Inputs, {
  tplCalc: debounce(el => recalcTpl(el.form), 150),
  assetCalc: debounce(el => assetPreview(el.form), 150),
  loanCalc: debounce(el => loanPreview(el.form), 150)
});
Object.assign(Forms, {
  asset: f => submitAsset(f),
  loan: f => submitLoan(f),
  execDate: f => { if (f.tgl.value) setExecDate(f.goal_id.value, f.tgl.value); }
});

// ── Mulai aplikasi (setelah semua modul dimuat) ──
window.GT = { S, Outbox, navigateTo, renderAll };
window.__GT_PARTS = (window.__GT_PARTS || []).concat('JS5');
try {
  boot();
  window.__GT_BOOTED = true;
} catch (e) {
  window.__gtFail && window.__gtFail(e);
}
