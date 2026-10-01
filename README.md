# درزی شاپ منیجمنٹ (Darzi Shop PWA)

Offline-first Urdu (RTL) tailor-shop management app. Pure HTML/CSS/JS + Bootstrap 5 + jQuery, data in LocalStorage.

## Run
Serve this folder over HTTPS (or `http://localhost`) — service worker, install prompt and Web Bluetooth need a secure context:

    python -m http.server 8765      # then open http://localhost:8765

Open once while online so the service worker caches everything (including the 13 MB Jameel Noori Nastaleeq font); afterwards it works fully offline and can be installed from Chrome's menu.

## Layout
- `js/storage.js` central DB (collections, settings, sequences, migrations)
- `js/accounting.js` double-entry engine + حسابات pages; `js/payments.js` all receipts/payouts
- `js/orders.js`, `garments.js`, `measurements.js`, `karigars.js`, … one file per module
- `js/printing.js` document model → HTML print (58/80/A4/tag) and canvas → ESC/POS (Web Bluetooth)
- `js/backup.js` JSON backup / validated restore

Bump `VERSION` in `service-worker.js` whenever files change so clients refresh their cache.
