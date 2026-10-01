/* backup.js — complete JSON backup / validated restore / statistics */
(function (w) {
  'use strict';
  const Backup = {};
  const LABEL = { customers: 'گاہک', orders: 'آرڈرز', garments: 'گارمنٹس (کپڑا اور ٹیگ سمیت)', measurements: 'پیمائشیں', karigars: 'کاریگر', assignments: 'کام کی تقسیم', suppliers: 'سپلائر', purchases: 'خریداری', sales: 'فروخت', payments: 'ادائیگیاں', expenses: 'اخراجات', inventory: 'اسٹاک آئٹمز', stockMoves: 'اسٹاک حرکات', accounts: 'اکاؤنٹس', transactions: 'جرنل انٹریاں / لیجرز', templates: 'پیمائش ٹیمپلیٹس', garmentTypes: 'گارمنٹ اقسام', alterations: 'آلٹریشن', deliveries: 'ڈیلیوریاں', activity: 'سرگرمی کی تاریخ' };
  Backup.LABEL = LABEL;
  let pending = null;

  Backup.make = function () {
    const snap = DB.snapshot(), counts = {}; DB.COLS.forEach(c => counts[c] = snap.collections[c].length);
    return { app: 'darzi-tailor-pwa', schemaVersion: DB.SCHEMA, createdAt: new Date().toISOString(), counts, settings: snap.settings, meta: snap.meta, collections: snap.collections };
  };
  Backup.download = function (silent) {
    const b = Backup.make(), txt = JSON.stringify(b), d = new Date(), name = 'darzi-backup-' + U.ymd(d) + '-' + String(d.getHours()).padStart(2, '0') + String(d.getMinutes()).padStart(2, '0') + '.json';
    U.download(name, txt, 'application/json');
    DB.meta.lastBackup = { at: Date.now(), size: txt.length, counts: b.counts, name }; DB.saveMeta();
    if (!silent) { UI.toast('بیک اپ ڈاؤن لوڈ ہو گیا'); DB.log('backup', 'مکمل بیک اپ ڈاؤن لوڈ کیا گیا'); }
    return name;
  };

  Backup.validate = function (obj) {
    const err = m => { throw new Error(m); };
    if (!obj || typeof obj !== 'object') err('فائل درست JSON نہیں ہے');
    if (obj.app !== 'darzi-tailor-pwa') err('یہ فائل اس ایپ کے بیک اپ کی نہیں ہے');
    if (typeof obj.schemaVersion !== 'number') err('بیک اپ میں ورژن موجود نہیں');
    if (obj.schemaVersion > DB.SCHEMA) err('یہ بیک اپ ایپ کے نئے ورژن کا ہے، پہلے ایپ اپ ڈیٹ کریں');
    if (!obj.collections || typeof obj.collections !== 'object') err('بیک اپ میں ڈیٹا موجود نہیں');
    const cols = {};
    DB.COLS.forEach(c => {
      const a = obj.collections[c]; if (a == null) { cols[c] = []; return; }
      if (!Array.isArray(a)) err('ڈیٹا خراب ہے: ' + (LABEL[c] || c));
      const seen = new Set(); a.forEach(x => { if (!x || typeof x !== 'object' || typeof x.id !== 'string') err('ڈیٹا خراب ہے: ' + (LABEL[c] || c)); if (seen.has(x.id)) err('ڈپلیکیٹ آئی ڈی ملی: ' + (LABEL[c] || c)); seen.add(x.id); });
      cols[c] = a;
    });
    // referential sanity: transactions must balance
    cols.transactions.forEach(t => { if (!Array.isArray(t.lines)) err('جرنل انٹری خراب ہے'); const d = t.lines.reduce((s, l) => s + (l.d || 0), 0), c = t.lines.reduce((s, l) => s + (l.c || 0), 0); if (Math.abs(d - c) > 0.01) err('غیر متوازن انٹری ملی: ' + (t.no || t.id)); });
    const meta = obj.meta && typeof obj.meta === 'object' ? obj.meta : { seq: {}, createdAt: Date.now() };
    meta.seq = meta.seq || {};
    let schema = obj.schemaVersion; while (schema < DB.SCHEMA) { if (DB.migrations[schema]) DB.migrations[schema](); schema++; }
    meta.schema = DB.SCHEMA; meta.seeded = true;
    return { collections: cols, settings: DB.mergeSettings(obj.settings), meta };
  };

  Backup.pick = function (file) {
    const rd = new FileReader();
    rd.onload = () => {
      let snap, obj;
      try { obj = JSON.parse(rd.result); snap = Backup.validate(obj); } catch (e) { return UI.toast('بحالی ناممکن: ' + e.message, 'danger'); }
      pending = { snap, obj };
      const counts = DB.COLS.map(c => '<tr><td>' + LABEL[c] + '</td><td class="n">' + snap.collections[c].length + '</td><td class="n text-muted">' + DB[c].count() + '</td></tr>').join('');
      const ctl = UI.modal({
        title: 'بیک اپ کی تصدیق', size: 'lg',
        body: '<div class="alert alert-info py-2">بیک اپ کی تاریخ: <b>' + U.fdt(Date.parse(obj.createdAt)) + '</b> · ورژن ' + obj.schemaVersion + '</div><div class="rt-wrap"><table class="table table-sm"><thead><tr><th>ڈیٹا</th><th class="n">بیک اپ میں</th><th class="n">موجودہ ایپ میں</th></tr></thead><tbody>' + counts + '</tbody></table></div>' +
          '<div class="alert alert-warning mb-0">⚠️ بحالی کے بعد موجودہ تمام ڈیٹا بیک اپ والے ڈیٹا سے بدل جائے گا۔ بحالی سے پہلے موجودہ ڈیٹا کا حفاظتی بیک اپ خودکار ڈاؤن لوڈ ہو گا۔</div>',
        footer: '<button class="btn btn-danger" id="rsGo">بحال کریں</button>', cancel: 'منسوخ'
      });
      ctl.$el.on('click', '#rsGo', () => { ctl.close(); Backup.restore(); });
    };
    rd.onerror = () => UI.toast('فائل پڑھی نہیں جا سکی', 'danger');
    rd.readAsText(file);
  };
  Backup.restore = function () {
    if (!pending) return;
    const snap = pending.snap; pending = null;
    UI.confirm('آخری تصدیق: کیا واقعی موجودہ ڈیٹا کو بیک اپ سے بدل دیا جائے؟', { danger: true, ok: 'ہاں، بحال کریں' }).then(ok => {
      if (!ok) return;
      DB.flush();
      if (DB.orders.count() + DB.customers.count() + DB.transactions.count() > 0) Backup.download(true);
      snap.collections.activity.push({ id: 'act' + Date.now().toString(36) + 'r', type: 'restore', text: 'بیک اپ سے ڈیٹا بحال کیا گیا', at: Date.now(), createdAt: Date.now() });
      snap.meta.lastRestore = Date.now();
      try { DB.replaceAll(snap); } catch (e) { return UI.toast('بحالی ناکام، پرانا ڈیٹا محفوظ ہے: ' + e.message, 'danger'); }
      UI.toast('ڈیٹا بحال ہو گیا، ایپ دوبارہ لوڈ ہو رہی ہے…'); setTimeout(() => location.reload(), 900);
    });
  };

  Backup.usage = function () { let n = 0; Object.keys(localStorage).forEach(k => { if (k.startsWith(DB.PFX)) n += (localStorage.getItem(k) || '').length * 2; }); return n; };
  Backup.html = function () {
    const lb = DB.meta.lastBackup, st = DB.stats(), use = Backup.usage(), mb = (use / 1048576);
    let h = '<div class="card-box mb-3"><h6 class="fw-bold">بیک اپ / بحالی</h6><div class="d-flex flex-wrap gap-2 mb-3"><button class="btn btn-success btn-lg" data-act="bkDownload">⬇ مکمل بیک اپ ڈاؤن لوڈ کریں</button><label class="btn btn-outline-success btn-lg m-0">⬆ بیک اپ بحال کریں<input type="file" accept=".json,application/json" hidden id="bkFile"></label></div>' +
      UI.kv('آخری بیک اپ', lb ? U.fdt(lb.at) + ' (' + Math.round(lb.size / 1024) + ' KB)' : 'ابھی تک نہیں لیا گیا') + UI.kv('آخری بحالی', DB.meta.lastRestore ? U.fdt(DB.meta.lastRestore) : '—') + UI.kv('ڈیٹا ورژن', DB.meta.schema) +
      UI.kv('استعمال شدہ اسٹوریج', mb.toFixed(2) + ' MB (تقریباً 5 MB تک)') + '<div class="progress mt-2" style="height:8px"><div class="progress-bar ' + (mb > 3.5 ? 'bg-danger' : 'bg-success') + '" style="width:' + Math.min(100, mb / 5 * 100) + '%"></div></div>' + (mb > 3.5 ? '<div class="text-danger small mt-1">اسٹوریج بھرنے کے قریب ہے، بیک اپ لیں۔</div>' : '') + '</div>';
    h += '<div class="card-box mb-3"><h6 class="fw-bold">ڈیٹا کے اعداد و شمار</h6><div class="rt-wrap"><table class="table table-sm">' + DB.COLS.map(c => '<tr><td>' + LABEL[c] + '</td><td class="n">' + st[c] + '</td></tr>').join('') + '</table></div></div>';
    h += '<div class="card-box"><h6 class="fw-bold text-danger">خطرناک حصہ</h6><p class="small text-muted">تمام ڈیٹا صاف کرنے سے پہلے بیک اپ خودکار ڈاؤن لوڈ ہو گا۔</p><button class="btn btn-outline-danger" data-act="bkWipe">🗑 تمام ڈیٹا صاف کریں</button></div>';
    return h;
  };
  App.act.bkDownload = () => { Backup.download(); App.refresh(); };
  $(document).on('change', '#bkFile', function () { if (this.files[0]) Backup.pick(this.files[0]); this.value = ''; });
  App.act.bkWipe = () => {
    const ctl = UI.modal({ title: 'تمام ڈیٹا صاف کریں', form: 'bkWipe', size: 'sm', body: '<div class="alert alert-danger">یہ عمل واپس نہیں ہو سکتا! تصدیق کے لیے نیچے لفظ <b>صاف</b> لکھیں۔</div><input class="form-control" name="word" autocomplete="off">', ok: 'ڈیٹا صاف کریں', okClass: 'btn-danger' });
  };
  App.forms.bkWipe = ($f, m) => {
    if (UI.vals($f).word !== 'صاف') return UI.toast('درست لفظ نہیں لکھا', 'danger');
    DB.flush(); Backup.download(true); DB.wipe(); UI.toast('ڈیٹا صاف ہو گیا'); setTimeout(() => location.reload(), 900);
  };

  w.Backup = Backup;
})(window);
