/* inventory.js — tailoring consumables stock: items, movements (opening / purchase / consumption / adjustment) */
(function (w) {
  'use strict';
  const Inv = {};
  const CATS = ['دھاگہ', 'بٹن', 'زپ', 'استر', 'کالر', 'لیس', 'کینوس', 'ہکس', 'بکل', 'پیکنگ سامان', 'دیگر'];
  const UNITS = ['عدد', 'میٹر', 'گز', 'پیکٹ', 'ڈبی', 'کلو', 'درجن', 'رول'];
  const MT = { opening: 'ابتدائی اسٹاک', purchase: 'خریداری', return: 'خریداری واپسی', consume: 'استعمال', adjust: 'ایڈجسٹمنٹ', void: 'منسوخی' };
  Inv.CATS = CATS; Inv.UNITS = UNITS; Inv.MT = MT;

  Inv.isLow = it => it.reorder > 0 && it.qty <= it.reorder;
  Inv.value = () => U.round(DB.inventory.all().reduce((s, i) => s + i.qty * i.avgCost, 0));
  Inv.itemOptions = sel => DB.inventory.filter(i => i.active !== false).sort((a, b) => a.name < b.name ? -1 : 1).map(i => '<option value="' + i.id + '" data-unit="' + U.esc(i.unit) + '" data-cost="' + i.avgCost + '"' + (i.id === sel ? ' selected' : '') + '>' + U.esc(i.name) + ' (' + U.num(i.qty) + ' ' + U.esc(i.unit) + ')</option>').join('');

  // move stock; returns move record. rate = unit cost for increases
  Inv.move = function (itemId, type, qty, rate, o) {
    o = o || {}; const it = DB.inventory.get(itemId);
    if (qty > 0 && type !== 'adjust' || (type === 'adjust' && qty > 0)) {
      const nq = it.qty + qty; const cost = U.n(rate);
      if (nq > 0 && (type === 'purchase' || type === 'opening')) DB.inventory.update(itemId, { avgCost: U.round((Math.max(it.qty, 0) * it.avgCost + qty * cost) / (Math.max(it.qty, 0) + qty) * 10000) / 10000 });
    }
    DB.inventory.update(itemId, { qty: U.round(it.qty + qty) });
    return DB.stockMoves.add({ itemId, type, qty, rate: U.n(rate), date: o.date || U.today(), ref: o.ref || null, note: o.note || '', txnId: o.txnId || null, voided: false });
  };

  // ---------- item form ----------
  Inv.itemForm = function (id, cb) {
    const it = id ? DB.inventory.get(id) : { category: 'دھاگہ', unit: 'عدد', no: DB.peek('item') };
    const ctl = UI.modal({
      title: id ? 'آئٹم میں ترمیم' : 'نیا آئٹم', form: 'itemSave', size: 'sm',
      body: '<input type="hidden" name="id" value="' + (id || '') + '"><div class="row g-2">' + UI.field({ label: 'نام', name: 'name', value: it.name, req: 1, ph: 'مثلاً سفید دھاگہ' }) +
        UI.field({ label: 'زمرہ', name: 'category', type: 'select', html: UI.opts(CATS, it.category), cls: 'col-6' }) + UI.field({ label: 'یونٹ', name: 'unit', type: 'select', html: UI.opts(UNITS, it.unit), cls: 'col-6' }) +
        UI.field({ label: 'کم از کم اسٹاک (الرٹ)', name: 'reorder', type: 'num', value: it.reorder || '', cls: 'col-6' }) +
        (id ? UI.field({ type: 'check', label: 'فعال', name: 'active', value: it.active !== false, cls: 'col-6 align-self-end' }) : UI.field({ label: 'ابتدائی اسٹاک', name: 'openQty', type: 'num', cls: 'col-6' }) + UI.field({ label: 'ابتدائی ریٹ (فی یونٹ)', name: 'openCost', type: 'num' })) + '</div>', ok: 'محفوظ کریں'
    });
    ctl.$el.data('cb', cb);
  };
  App.forms.itemSave = ($f, m) => {
    const v = UI.vals($f); let it;
    if (v.id) it = DB.inventory.update(v.id, { name: v.name, category: v.category, unit: v.unit, reorder: U.n(v.reorder), active: v.active });
    else {
      it = DB.inventory.add({ no: DB.next('item'), name: v.name, category: v.category, unit: v.unit, reorder: U.n(v.reorder), qty: 0, avgCost: 0, active: true });
      const q = U.n(v.openQty), c = U.n(v.openCost);
      if (q > 0) {
        const mv = Inv.move(it.id, 'opening', q, c, { note: 'ابتدائی اسٹاک' });
        if (c > 0) { const t = Acc.post({ date: U.today(), type: 'stock', desc: 'ابتدائی اسٹاک: ' + it.name, lines: [{ a: 'stock', d: U.round(q * c) }, { a: 'capital', c: U.round(q * c) }], ref: { t: 'move', id: mv.id } }); DB.stockMoves.update(mv.id, { txnId: t.id }); }
      }
    }
    m.close(); UI.toast('آئٹم محفوظ ہو گیا'); const cb = m.$el.data('cb'); if (cb) cb(it); else App.refresh();
  };

  // ---------- consumption / adjustment ----------
  Inv.consumeModal = function (itemId, mode) {
    const adj = mode === 'adjust';
    if (!DB.inventory.count()) return UI.toast('پہلے اسٹاک آئٹم شامل کریں', 'warning');
    UI.modal({
      title: adj ? 'اسٹاک ایڈجسٹمنٹ' : 'اسٹاک کا استعمال', form: 'invMove', size: 'sm',
      body: '<input type="hidden" name="mode" value="' + (adj ? 'adjust' : 'consume') + '"><div class="row g-2">' + UI.field({ label: 'آئٹم', name: 'itemId', type: 'select', html: Inv.itemOptions(itemId), req: 1 }) +
        UI.field({ label: adj ? 'مقدار (کمی کے لیے منفی لکھیں)' : 'استعمال شدہ مقدار', name: 'qty', type: 'num', req: 1, cls: 'col-6' }) + UI.field({ label: 'تاریخ', name: 'date', type: 'date', value: U.today(), cls: 'col-6' }) +
        UI.field({ label: 'نوٹس / آرڈر', name: 'note', ph: adj ? 'وجہ' : 'مثلاً آرڈر نمبر' }) + '</div>', ok: 'محفوظ کریں'
    });
  };
  App.act.invConsume = $b => Inv.consumeModal($b.data('id'), 'consume');
  App.act.invAdjust = $b => Inv.consumeModal($b.data('id'), 'adjust');
  App.forms.invMove = ($f, m) => {
    const v = UI.vals($f), it = DB.inventory.get(v.itemId), q = U.n(v.qty), adj = v.mode === 'adjust';
    if (!q) return UI.toast('مقدار درج کریں', 'warning');
    const delta = adj ? q : -Math.abs(q);
    if (delta < 0 && it.qty + delta < -0.0001) return UI.toast('اسٹاک کافی نہیں (موجود ' + U.num(it.qty) + ' ' + it.unit + ')', 'danger');
    const val = U.round(Math.abs(delta) * it.avgCost), mv = Inv.move(it.id, v.mode, delta, it.avgCost, { date: v.date, note: v.note });
    if (val > 0) {
      const lines = delta < 0 ? [{ a: adj ? 'expOther' : 'expPurchase', d: val }, { a: 'stock', c: val }] : [{ a: 'stock', d: val }, { a: 'expOther', c: val }];
      const t = Acc.post({ date: v.date, type: 'stock', desc: (adj ? 'اسٹاک ایڈجسٹمنٹ: ' : 'اسٹاک استعمال: ') + it.name + (v.note ? ' (' + v.note + ')' : ''), lines, ref: { t: 'move', id: mv.id } });
      DB.stockMoves.update(mv.id, { txnId: t.id, value: val });
    }
    DB.log('stock', (adj ? 'ایڈجسٹمنٹ ' : 'استعمال ') + it.name + ' ' + U.num(delta), null);
    m.close(); UI.toast('اسٹاک اپ ڈیٹ ہو گیا'); App.refresh();
  };
  Inv.voidMove = function (id) {
    const mv = DB.stockMoves.get(id); if (!mv || mv.voided) return;
    Inv.move(mv.itemId, 'void', -mv.qty, mv.rate, { note: 'منسوخی', ref: { t: 'move', id } });
    if (mv.txnId) Acc.void(mv.txnId, 'اسٹاک حرکت منسوخ');
    DB.stockMoves.update(id, { voided: true });
  };

  // ---------- pages ----------
  function page(args) {
    const tab = args[0] || 'stock'; App.title('اسٹاک');
    let h = UI.tabs([['stock', 'موجودہ اسٹاک'], ['moves', 'حرکات']], tab, 'inventory');
    const low = DB.inventory.filter(Inv.isLow).length;
    if (tab === 'moves') {
      h += UI.list({
        key: 'moves', keepState: true, placeholder: 'آئٹم تلاش کریں', icon: '📦', empty: 'کوئی حرکت نہیں',
        filters: [{ name: 't', opts: [['', 'تمام']].concat(Object.keys(MT).map(k => [k, MT[k]])) }],
        items: st => DB.stockMoves.all().filter(x => (!st.f.t || x.type === st.f.t) && UI.match(st.q, (DB.inventory.get(x.itemId) || {}).name || '', x.note)).sort((a, b) => b.date < a.date ? -1 : b.date > a.date ? 1 : b.createdAt - a.createdAt),
        row: x => { const it = DB.inventory.get(x.itemId) || {}; return UI.row({ cls: x.voided ? 'mute' : '', title: U.esc(it.name) + ' ' + UI.badge(MT[x.type], x.qty > 0 ? 'success' : 'warning'), sub: U.fd(x.date) + (x.note ? ' · ' + U.esc(x.note) : ''), right: '<div class="fw-bold ' + (x.qty > 0 ? 'text-success' : 'text-danger') + '">' + (x.qty > 0 ? '+' : '') + U.num(x.qty) + ' ' + U.esc(it.unit) + '</div>' + (['consume', 'adjust'].includes(x.type) && !x.voided ? '<button class="btn btn-sm btn-outline-danger" data-act="invVoid" data-id="' + x.id + '">منسوخ</button>' : '') }); }
      });
    } else {
      h += '<div class="row g-2 mb-3">' + UI.stat('کل آئٹم', DB.inventory.count(), '', null, 'col-4') + UI.stat('کم اسٹاک', low, low ? 'bad' : '', null, 'col-4') + UI.stat('اسٹاک کی مالیت', U.rs(Inv.value()), 'gold', null, 'col-4') + '</div>' +
        '<div class="d-flex flex-wrap gap-2 mb-2"><button class="btn btn-success" data-act="invNew">➕ نیا آئٹم</button><button class="btn btn-outline-success" data-act="invConsume">➖ استعمال درج کریں</button><a class="btn btn-outline-success" href="#/purchases">🛒 خریداری</a></div>' + UI.list({
          key: 'inv', keepState: true, placeholder: 'آئٹم تلاش کریں', icon: '📦', empty: 'ابھی کوئی آئٹم نہیں۔ نیا آئٹم شامل کریں۔',
          filters: [{ name: 'c', opts: [['', 'تمام زمرے']].concat(CATS.map(c => [c, c])) }, { name: 'l', opts: [['', 'سب'], ['low', 'کم اسٹاک']] }],
          items: st => DB.inventory.all().filter(i => (!st.f.c || i.category === st.f.c) && (!st.f.l || Inv.isLow(i)) && UI.match(st.q, i.name, i.category, i.no)).sort((a, b) => a.name < b.name ? -1 : 1),
          row: i => UI.row({ cls: Inv.isLow(i) ? 'bad' : '', title: U.esc(i.name) + (Inv.isLow(i) ? ' <span class="badge bg-danger">کم اسٹاک</span>' : '') + (i.active === false ? ' ' + UI.badge('غیر فعال') : ''), sub: U.esc(i.category) + ' · ' + U.code(i.no), extra: 'اوسط لاگت ' + U.num(i.avgCost) + ' · مالیت ' + U.num(i.qty * i.avgCost), right: '<div class="fs-5 fw-bold">' + U.num(i.qty) + '</div><div class="small text-muted">' + U.esc(i.unit) + '</div>', actions: '<button class="btn btn-sm btn-outline-success" data-act="invConsume" data-id="' + i.id + '">استعمال</button><button class="btn btn-sm btn-outline-secondary" data-act="invAdjust" data-id="' + i.id + '">ایڈجسٹ</button><button class="btn btn-sm btn-outline-secondary" data-act="invEdit" data-id="' + i.id + '">✏️</button>' })
        });
    }
    App.render(h);
  }
  App.route('inventory', page);
  App.act.invNew = () => Inv.itemForm(); App.act.invEdit = $b => Inv.itemForm($b.data('id'));
  App.act.invVoid = $b => UI.confirm('یہ حرکت منسوخ کریں؟', { danger: true }).then(ok => { if (ok) { Inv.voidMove($b.data('id')); UI.toast('منسوخ ہو گیا'); App.refresh(); } });

  w.Inv = Inv;
})(window);
