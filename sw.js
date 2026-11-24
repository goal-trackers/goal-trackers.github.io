/* Goal Trackers — service worker: membuat aplikasi bisa di-install & tampilan dasar tetap terbuka saat offline.
   Data (API Google Apps Script) TIDAK di-cache di sini; aplikasi sudah menyimpan snapshot data sendiri. */
const CACHE = 'gt-shell-v1.10.164';
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;   // API GAS & CDN: langsung ke jaringan
  // Halaman & penanda versi selalu diambil segar (lewati cache browser) supaya pembaruan langsung terasa
  const fresh = req.mode === 'navigate' || /\/(index\.html|version\.json)?$/.test(url.pathname) || url.pathname.endsWith('.html') || url.pathname.endsWith('version.json');
  e.respondWith(fetch(req, fresh ? { cache: 'no-store' } : undefined).then(res => {                                 // utamakan versi terbaru
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req).then(r => r || caches.match('index.html'))));
});
