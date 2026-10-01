/* storage.js — centralised LocalStorage database layer (collections, settings, sequences, migrations) */
(function (w) {
  'use strict';
  const PFX = 'darzi:';
  const SCHEMA = 1;
  const COLS = ['customers', 'orders', 'garments', 'measurements', 'karigars', 'assignments', 'suppliers', 'purchases', 'sales',
    'payments', 'expenses', 'inventory', 'stockMoves', 'accounts', 'transactions', 'templates', 'garmentTypes', 'alterations', 'deliveries', 'activity'];

  const DEFAULT_SETTINGS = {
    shopName: 'ٹیلر شاپ', logo: '', address: '', phone: '', whatsapp: '', currency: 'PKR',
    prefix: { customer: 'C-', order: 'O-', invoice: 'INV-', karigar: 'K-', supplier: 'S-', purchase: 'P-', sale: 'SL-', payment: 'R-', expense: 'E-', voucher: 'V-', tag: 'T-', alteration: 'A-', item: 'I-', assignment: 'W-' },
    start: { customer: 1, order: 1, invoice: 1, karigar: 1, supplier: 1, purchase: 1, sale: 1, payment: 1, expense: 1, voucher: 1, tag: 1, alteration: 1, item: 1, assignment: 1 },
    deliveryDays: 7,
    printerWidth: '80',        // 58 | 80
    invoiceFormat: 'thermal',  // thermal | a4
    invoiceNote: 'آپ کے اعتماد کا شکریہ',
    allowDeliveryWithBalance: true, requireDeliveryConfirm: true,
    allowDestructive: false,   // allow hard delete of records without history
    tag: { width: 50, height: 35, showKarigar: true, showBarcode: true, showMobile: true, fontSize: 9, perPiece: true },
    printer: { name: '' }
  };


  // ---------- LZW string compression (keeps LocalStorage usage small; 15-bit codes mapped to BMP chars) ----------
  const LZ = (function () {
    const OFF = 0x400, MAX = 32768, enc = new TextEncoder(), dec = new TextDecoder();
    function compress(str) {
      const b = enc.encode(str); if (!b.length) return '';
      const out = []; let dict = new Map(), next = 257, w = b[0];
      for (let i = 1; i < b.length; i++) {
        const c = b[i], k = w * 256 + c, v = dict.get(k);
        if (v !== undefined) w = v;
        else { out.push(w); if (next < MAX) dict.set(k, next++); else { out.push(256); dict.clear(); next = 257; } w = c; }
      }
      out.push(w);
      let s = ''; for (let i = 0; i < out.length; i += 8000) s += String.fromCharCode.apply(null, out.slice(i, i + 8000).map(x => x + OFF));
      return s;
    }
    function decompress(s) {
      const n = s.length; if (!n) return '';
      let out = new Uint8Array(Math.max(1024, n * 4)), pos = 0;
      const pre = new Int32Array(MAX), suf = new Uint8Array(MAX), len = new Int32Array(MAX);
      let next = 257, prev = -1;
      const ln = c => c < 256 ? 1 : len[c], first = c => { while (c >= 257) c = pre[c]; return c; };
      const ensure = l => { if (pos + l > out.length) { const o = new Uint8Array(Math.max(out.length * 2, pos + l)); o.set(out.subarray(0, pos)); out = o; } };
      const write = (c, at) => { let x = c, p = at + ln(c) - 1; while (x >= 257) { out[p--] = suf[x]; x = pre[x]; } out[p] = x; };
      for (let i = 0; i < n; i++) {
        const c = s.charCodeAt(i) - OFF;
        if (c === 256) { next = 257; prev = -1; continue; }
        let L, fb;
        if (c < next) { L = ln(c); ensure(L); write(c, pos); fb = out[pos]; }
        else { if (prev < 0) throw new Error('lz'); L = ln(prev) + 1; ensure(L); write(prev, pos); fb = out[pos]; out[pos + L - 1] = fb; }
        if (prev >= 0 && next < MAX) { pre[next] = prev; suf[next] = fb; len[next] = ln(prev) + 1; next++; }
        pos += L; prev = c;
      }
      return dec.decode(out.subarray(0, pos));
    }
    return { compress, decompress };
  })();
  const ser = v => { const j = JSON.stringify(v); if (j.length < 2000) return j; try { return '~' + LZ.compress(j); } catch (e) { return j; } };
  const de = raw => (raw && raw.charCodeAt(0) === 126) ? JSON.parse(LZ.decompress(raw.slice(1))) : JSON.parse(raw);

  class Coll {
    constructor(name) { this.name = name; this.arr = []; this.map = new Map(); this.ver = 0; this._idx = {}; this.dirty = false; }
    load() {
      let raw = null, a = [];
      try { raw = localStorage.getItem(PFX + this.name); a = raw ? de(raw) : []; if (!Array.isArray(a)) throw 0; }
      catch (e) { try { localStorage.setItem(PFX + 'corrupt:' + this.name, raw || ''); } catch (_) { } a = []; DB.corrupt.push(this.name); }
      this.set(a); this.dirty = false;
    }
    set(a) { this.arr = a; this.map = new Map(); a.forEach(x => this.map.set(x.id, x)); this._idx = {}; this.ver++; }
    all() { return this.arr; }
    get(id) { return id == null ? undefined : this.map.get(id); }
    newId() { let id; do { id = this.name.slice(0, 3) + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); } while (this.map.has(id)); return id; }
    add(o) {
      if (!o.id || this.map.has(o.id)) o.id = this.newId();
      if (!o.createdAt) o.createdAt = Date.now();
      this.arr.push(o); this.map.set(o.id, o); this.touch(); return o;
    }
    update(id, patch) { const o = this.map.get(id); if (!o) return null; Object.assign(o, patch); o.updatedAt = Date.now(); this.touch(); return o; }
    remove(id) { const o = this.map.get(id); if (!o) return false; this.arr.splice(this.arr.indexOf(o), 1); this.map.delete(id); this.touch(); return true; }
    touch() { this.ver++; this._idx = {}; this.dirty = true; DB.schedule(); }
    // cached index: field -> array of records
    by(field) {
      if (this._idx[field]) return this._idx[field];
      const m = new Map();
      this.arr.forEach(x => { const k = x[field]; if (k == null) return; if (!m.has(k)) m.set(k, []); m.get(k).push(x); });
      return (this._idx[field] = m);
    }
    of(field, val) { return this.by(field).get(val) || []; }
    count() { return this.arr.length; }
    find(fn) { return this.arr.find(fn); }
    filter(fn) { return this.arr.filter(fn); }
  }

  const DB = {
    SCHEMA, COLS, PFX, corrupt: [], seeders: [], migrations: {}, meta: null, settings: null, _t: null, error: null
  };
  COLS.forEach(c => { DB[c] = new Coll(c); });

  DB.init = function () {
    COLS.forEach(c => DB[c].load());
    let meta = null, st = null;
    try { meta = de(localStorage.getItem(PFX + 'meta')); } catch (e) { }
    try { st = de(localStorage.getItem(PFX + 'settings')); } catch (e) { }
    DB.meta = meta || { schema: SCHEMA, seq: {}, createdAt: Date.now(), seeded: false, lastBackup: null, lastRestore: null };
    DB.settings = DB.mergeSettings(st);
    // migrations
    while (DB.meta.schema < SCHEMA) { const m = DB.migrations[DB.meta.schema]; if (m) m(); DB.meta.schema++; }
    if (!DB.meta.seeded) { DB.seeders.forEach(f => f()); DB.meta.seeded = true; }
    DB.metaDirty = true; DB.settingsDirty = true; DB.flush();
  };
  DB.mergeSettings = function (st) {
    const d = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
    (function merge(t, s) { if (!s) return; Object.keys(s).forEach(k => { if (t[k] && typeof t[k] === 'object' && !Array.isArray(t[k]) && typeof s[k] === 'object') merge(t[k], s[k]); else t[k] = s[k]; }); })(d, st);
    return d;
  };
  DB.saveSettings = function () { DB.settingsDirty = true; DB.schedule(); };
  DB.saveMeta = function () { DB.metaDirty = true; DB.schedule(); };
  DB.schedule = function () { clearTimeout(DB._t); DB._t = setTimeout(DB.flush, 350); };
  DB.LZ = LZ;
  DB.freeze = function () { clearTimeout(DB._t); DB.frozen = true; COLS.forEach(c => { DB[c].dirty = false; }); DB.metaDirty = false; DB.settingsDirty = false; };
  DB.flush = function () {
    clearTimeout(DB._t); if (DB.frozen) return;
    const put = (k, v) => {
      try { localStorage.setItem(PFX + k, ser(v)); }
      catch (e) { DB.error = e; if (w.UI && UI.toast) UI.toast('اسٹوریج بھر گیا ہے! فوراً مکمل بیک اپ ڈاؤن لوڈ کریں۔', 'danger'); }
    };
    COLS.forEach(c => { if (DB[c].dirty) { put(c, DB[c].arr); DB[c].dirty = false; } });
    if (DB.metaDirty) { put('meta', DB.meta); DB.metaDirty = false; }
    if (DB.settingsDirty) { put('settings', DB.settings); DB.settingsDirty = false; }
  };
  w.addEventListener('pagehide', () => DB.flush());
  document.addEventListener('visibilitychange', () => { if (document.hidden) DB.flush(); });

  // sequences: returns formatted number (prefix + padded counter)
  DB.next = function (kind) {
    const seq = DB.meta.seq, start = (DB.settings.start[kind] || 1);
    let n = Math.max(seq[kind] || 0, start - 1) + 1;
    seq[kind] = n; DB.saveMeta();
    return (DB.settings.prefix[kind] || '') + U.pad(n, 4);
  };
  DB.peek = function (kind) { const n = Math.max(DB.meta.seq[kind] || 0, (DB.settings.start[kind] || 1) - 1) + 1; return (DB.settings.prefix[kind] || '') + U.pad(n, 4); };

  DB.stats = function () { const o = {}; COLS.forEach(c => o[c] = DB[c].count()); return o; };

  // full snapshot / replace (used by backup)
  DB.snapshot = function () {
    const data = {};
    COLS.forEach(c => data[c] = DB[c].arr);
    return { collections: data, settings: DB.settings, meta: DB.meta };
  };
  DB.replaceAll = function (snap) {
    // atomic-ish: stage everything then write; roll back on failure
    DB.freeze();
    const old = {};
    const keys = COLS.concat(['meta', 'settings']);
    keys.forEach(k => old[k] = localStorage.getItem(PFX + k));
    try {
      COLS.forEach(c => localStorage.setItem(PFX + c, ser(snap.collections[c] || [])));
      localStorage.setItem(PFX + 'meta', ser(snap.meta));
      localStorage.setItem(PFX + 'settings', ser(snap.settings));
    } catch (e) {
      DB.frozen = false;
      keys.forEach(k => { try { if (old[k] == null) localStorage.removeItem(PFX + k); else localStorage.setItem(PFX + k, old[k]); } catch (_) { } });
      throw e;
    }
  };
  DB.wipe = function () {
    DB.freeze();
    Object.keys(localStorage).filter(k => k.startsWith(PFX)).forEach(k => localStorage.removeItem(k));
  };
  DB.log = function (type, text, ref) {
    DB.activity.add({ type, text, ref: ref || null, at: Date.now() });
    if (DB.activity.arr.length > 2500) { DB.activity.arr.splice(0, DB.activity.arr.length - 2000); DB.activity.set(DB.activity.arr); DB.activity.dirty = true; }
  };

  w.DB = DB;
})(window);
