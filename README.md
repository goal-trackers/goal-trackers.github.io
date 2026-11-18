# Goal Trackers 🎯

Aplikasi untuk merencanakan target pribadi & bersama pasangan: progres goal, tabungan & rencana (liburan, dana darurat, sekolah anak), investasi SBN/SR, dan cicilan pinjaman — lengkap dengan perayaan setiap pencapaian.

## Arsitektur

| Bagian | Tempat | Isi |
|---|---|---|
| Frontend (tampilan) | GitHub Pages (repo ini) | `index.html`, `css/style.css`, `js/*.js` |
| Backend (REST API) | Google Apps Script | `Kode.gs`, `Setup.gs`, `Keuangan.gs` (tidak disimpan di repo ini) |
| Database | Google Sheets & Drive milik Admin | dibuat otomatis oleh `setupAppEnvironment()` |

Frontend memanggil backend lewat `fetch()` (POST, `Content-Type: text/plain`) ke URL `/exec` yang tercantum di `js/config.js`. Semua data dilindungi login email + PIN; repo ini tidak menyimpan data atau rahasia apa pun.

## Struktur

```
index.html
css/style.css
js/config.js     ← URL backend (GAS_URL)
js/core.js       ← state, sinkronisasi offline (outbox), router, helper
js/pages.js      ← beranda, goals, detail, perayaan
js/reports.js    ← laporan, grafik, ekspor Excel/PDF, pengaturan, notifikasi
js/actions.js    ← form & aksi
js/finance.js    ← keuangan: template rencana, investasi, pinjaman + start aplikasi
```

## Memperbarui

Ubah berkas → commit ke branch `main` → GitHub Pages memperbarui situs dalam 1–2 menit. Naikkan angka `?v=` di `index.html` agar browser tidak memakai cache lama.
