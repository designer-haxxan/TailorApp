/* service-worker.js — offline app shell (cache-first, refreshed in background) */
const VERSION = 'darzi-v1.1.1';
const CORE = [
  './', 'index.html', 'manifest.json',
  'css/app.css', 'css/responsive.css', 'css/rtl.css', 'css/print.css',
  'assets/vendor/bootstrap.rtl.min.css', 'assets/vendor/bootstrap.bundle.min.js', 'assets/vendor/jquery.min.js',
  'assets/icons/icon-192.png', 'assets/icons/icon-512.png', 'assets/icons/icon-maskable-512.png',
  'js/utils.js', 'js/storage.js', 'js/app.js', 'js/auth.js', 'js/ui.js', 'js/accounting.js', 'js/measurements.js', 'js/customers.js', 'js/payments.js', 'js/garments.js',
  'js/orders.js', 'js/karigars.js', 'js/suppliers.js', 'js/inventory.js', 'js/purchases.js', 'js/sales.js', 'js/expenses.js', 'js/alterations.js',
  'js/printing.js', 'js/reports.js', 'js/dashboard.js', 'js/settings.js', 'js/backup.js'
];
const FONT = 'assets/fonts/Jameel-Noori-Nastaleeq.ttf';

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(async c => {
    await c.addAll(CORE);
    try { await c.add(FONT); } catch (err) { /* font is cached later on first use if this fails */ }
  }).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  const isFont = req.url.endsWith('.ttf');
  e.respondWith(caches.match(req, { ignoreSearch: true }).then(hit => {
    const net = fetch(req).then(res => { if (res && res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); } return res; }).catch(() => null);
    if (hit) { if (!isFont) net.catch(() => { }); return hit; }
    return net.then(res => res || (req.mode === 'navigate' ? caches.match('index.html') : Response.error()));
  }));
});
