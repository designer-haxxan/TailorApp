/* orders.js — order creation/editing, detail, status derivation, delivery */
(function (w) {
  'use strict';
  const Ord = { draft: null };

  Ord.garments = id => DB.garments.of('orderId', id);
  Ord.active = id => Ord.garments(id).filter(g => g.status !== 'منسوخ');
  Ord.paid = o => U.round(Pay.paidFor('orderId', typeof o === 'string' ? o : o.id));
  Ord.balance = o => { if (typeof o === 'string') o = DB.orders.get(o); return U.round(o.total - Ord.paid(o)); };
  Ord.isLate = o => o.dueDate && o.dueDate < U.today() && !['ڈیلیور', 'منسوخ'].includes(o.status);
  Ord.search = function (q) {
    const n = U.norm(q), all = DB.orders.all();
    let res;
    if (!n) res = all.slice();
    else {
      const ids = new Set();
      all.forEach(o => { if (U.norm(o.no + ' ' + o.invoiceNo).includes(n)) ids.add(o.id); });
      DB.garments.all().forEach(g => { if (U.norm(g.tag).includes(n)) ids.add(g.orderId); });
      DB.customers.all().forEach(c => { if (U.norm(c.name + ' ' + c.mobile + ' ' + c.mobile2 + ' ' + c.no).includes(n)) DB.orders.of('customerId', c.id).forEach(o => ids.add(o.id)); });
      res = all.filter(o => ids.has(o.id));
    }
    return res.sort((a, b) => b.createdAt - a.createdAt);
  };

  // ---------- status / totals ----------
  Ord.refresh = function (id) {
    const o = DB.orders.get(id); if (!o || o.status === 'منسوخ') return;
    const act = Ord.active(id); let st = o.status;
    if (!act.length) st = 'نیا';
    else if (act.every(g => g.status === 'ڈیلیور')) st = 'ڈیلیور';
    else { const open = act.filter(g => g.status !== 'ڈیلیور'); st = open.reduce((m, g) => Garm.RANK[g.status] < Garm.RANK[m.status] ? g : m, open[0]).status; }
    if (st !== o.status) { const patch = { status: st }; if (st === 'ڈیلیور') patch.deliveredAt = Date.now(); DB.orders.update(id, patch); }
  };
  Ord.recalc = function (id) {
    const o = DB.orders.get(id); if (!o) return;
    const gross = U.sum(Ord.active(id), g => g.amount), disc = Math.min(U.n(o.discount), gross);
    const total = o.status === 'منسوخ' ? 0 : U.round(gross - disc);
    DB.orders.update(id, { gross, total });
    Acc.postDelta('ord:' + id, total, { date: o.date, type: 'order', desc: 'آرڈر ' + o.no + ' سلائی آمدن', ref: { t: 'order', id }, dr: 'receivable', cr: 'incStitch', party: o.customerId });
    Pay.applyAdvance(o.customerId);
    Ord.refresh(id);
  };

  // ---------- save ----------
  Ord.save = function (dr) {
    let o;
    if (dr.id) {
      o = DB.orders.update(dr.id, { date: dr.date, dueDate: dr.dueDate, discount: U.n(dr.discount), note: dr.note });
      (dr.removed || []).forEach(gid => { const g = DB.garments.get(gid); if (g && g.status !== 'ڈیلیور') Garm.cancel(gid); });
      dr.garments.forEach(d => { if (d.id) Garm.update(DB.garments.get(d.id), d); else { const g = Garm.create(o, d); DB.orders.update(o.id, { garmentSeq: o.garmentSeq }); Ord.autoAssign(g, d); } });
      DB.garments.of('orderId', o.id).forEach(g => { if (g.dueDate !== o.dueDate && g.status !== 'ڈیلیور') DB.garments.update(g.id, { dueDate: o.dueDate }); });
      Ord.recalc(o.id);
      DB.log('order', 'آرڈر اپ ڈیٹ: ' + o.no, { t: 'order', id: o.id });
    } else {
      o = DB.orders.add({ no: DB.next('order'), invoiceNo: DB.next('invoice'), customerId: dr.customerId, date: dr.date, dueDate: dr.dueDate, discount: U.n(dr.discount), note: dr.note, status: 'نیا', garmentSeq: 0, total: 0, gross: 0 });
      dr.garments.forEach(d => { const g = Garm.create(o, d); DB.orders.update(o.id, { garmentSeq: o.garmentSeq }); Ord.autoAssign(g, d); });
      Ord.recalc(o.id);
      DB.log('order', 'نیا آرڈر: ' + o.no + ' — ' + Cust.name(o.customerId), { t: 'order', id: o.id });
      if (U.n(dr.advance) > 0) Pay.create({ party: 'customer', partyId: o.customerId, dir: 'in', amount: dr.advance, date: dr.date, account: dr.advAccount, ref: dr.advRef, orderId: o.id, kind: 'advance', note: 'پیشگی' });
    }
    return DB.orders.get(o.id);
  };
  Ord.autoAssign = function (g, d) {
    if (d.assign && d.assign.karigarId) Kar.assign(g.id, { karigarId: d.assign.karigarId, rate: d.assign.rate || (DB.karigars.get(d.assign.karigarId) || {}).rate || 0, dueDate: d.assign.dueDate || g.dueDate });
  };
  Ord.cancel = function (id) {
    const o = DB.orders.get(id), gs = Ord.garments(id);
    if (gs.some(g => g.status === 'ڈیلیور')) return UI.toast('جزوی ڈیلیور شدہ آرڈر منسوخ نہیں ہو سکتا', 'warning');
    UI.confirm('آرڈر ' + o.no + ' منسوخ کریں؟ تمام گارمنٹس اور کاریگر کے کام منسوخ ہو جائیں گے۔', { danger: true, ok: 'آرڈر منسوخ کریں' }).then(ok => {
      if (!ok) return;
      gs.forEach(g => { if (g.status !== 'منسوخ') Garm.cancel(g.id); });
      DB.orders.update(id, { status: 'منسوخ', cancelledAt: Date.now() }); Ord.recalc(id);
      DB.log('cancel', 'آرڈر منسوخ: ' + o.no, { t: 'order', id });
      UI.toast('آرڈر منسوخ ہو گیا'); App.refresh();
      const paid = Ord.paid(o); if (paid > 0) UI.confirm('اس آرڈر میں ' + U.rs(paid) + ' وصول شدہ ہیں۔ کیا ابھی گاہک کو واپس کریں؟').then(y => { if (y) Pay.refundModal(o.customerId, id); });
    });
  };

  // ---------- list ----------
  Ord.card = function (o) {
    const c = DB.customers.get(o.customerId) || {}, bal = Ord.balance(o), gs = Ord.active(o.id), late = Ord.isLate(o);
    const sum = gs.map(g => U.esc(g.typeName) + ' ×' + U.num(g.qty)).join('، ');
    return UI.row({
      cls: late ? 'bad' : o.status === 'ڈیلیور' ? 'mute' : '', href: '#/order/' + o.id,
      title: U.code(o.no) + ' · ' + U.esc(c.name || '—') + ' ' + Garm.badge(o.status) + (late ? ' <span class="badge bg-danger">تاخیر</span>' : ''),
      sub: 'تاریخ ' + U.fd(o.date) + ' · ڈیلیوری ' + U.fd(o.dueDate) + ' · انوائس ' + U.code(o.invoiceNo), extra: sum,
      right: '<div class="fw-bold">' + U.num(o.total) + '</div>' + (bal > 0.004 ? '<div class="small text-danger">بقایا ' + U.num(bal) + '</div>' : bal < -0.004 ? '<div class="small text-success">زائد ' + U.num(-bal) + '</div>' : '<div class="small text-success">ادا شدہ</div>')
    });
  };
  function listPage() {
    App.title('آرڈرز');
    const today = U.today();
    App.render('<div class="d-flex justify-content-between align-items-center mb-2"><h6 class="fw-bold m-0">آرڈرز</h6><a class="btn btn-success" href="#/order/new">➕ نیا آرڈر</a></div>' + UI.list({
      key: 'orders', keepState: true, placeholder: 'آرڈر نمبر، نام، موبائل یا ٹیگ', icon: '📋', empty: 'کوئی آرڈر نہیں ملا',
      filters: [{ name: 'st', opts: [['', 'تمام حالتیں'], ['open', 'زیرِ عمل'], ['late', 'تاخیر شدہ'], ['due', 'بقایا والے']].concat(Garm.ST.map(s => [s, s])) }, { name: 'd', opts: [['', 'کوئی بھی تاریخ'], ['today', 'آج'], ['week', 'پچھلے 7 دن'], ['month', 'اس مہینے']] }],
      items: st => Ord.search(st.q).filter(o => {
        const f = st.f.st; if (f === 'open' && ['ڈیلیور', 'منسوخ'].includes(o.status)) return false; if (f === 'late' && !Ord.isLate(o)) return false; if (f === 'due' && !(Ord.balance(o) > 0.004 && o.status !== 'منسوخ')) return false;
        if (f && !['open', 'late', 'due'].includes(f) && o.status !== f) return false;
        const d = st.f.d; if (d === 'today' && o.date !== today) return false; if (d === 'week' && o.date < U.addDays(today, -6)) return false; if (d === 'month' && o.date < U.monthStart()) return false; return true;
      }),
      row: Ord.card
    }));
  }
  App.route('orders', listPage);

  // ---------- order form ----------
  function newDraft(cid) {
    return { customerId: cid || '', date: U.today(), dueDate: U.addDays(U.today(), DB.settings.deliveryDays || 7), discount: '', note: '', garments: [], removed: [], advance: '', advAccount: Acc.id('cash'), advRef: '' };
  }
  function draftFromOrder(o) {
    return { id: o.id, customerId: o.customerId, date: o.date, dueDate: o.dueDate, discount: o.discount || '', note: o.note || '', garments: Ord.garments(o.id).filter(g => g.status !== 'منسوخ').map(Garm.toDraft), removed: [], advance: '', advAccount: Acc.id('cash'), advRef: '' };
  }
  function formPage(args) {
    let edit = null;
    if (args[0] === 'edit') { edit = DB.orders.get(args[1]); if (!edit) return App.render(UI.empty('❓', 'آرڈر نہیں ملا')); }
    if (edit && edit.status === 'ڈیلیور') { UI.toast('ڈیلیور شدہ آرڈر میں ترمیم ممکن نہیں', 'warning'); return App.go('#/order/' + edit.id); }
    if (edit) { if (!Ord.draft || Ord.draft.id !== edit.id) Ord.draft = draftFromOrder(edit); }
    else if (!Ord.draft || Ord.draft.id) Ord.draft = newDraft(args[1]);
    else if (args[1] && !Ord.draft.customerId) Ord.draft.customerId = args[1];
    const d = Ord.draft; App.title(edit ? 'آرڈر میں ترمیم: ' + edit.no : 'نیا آرڈر');
    let h = '<div class="card-box mb-3"><div class="fw-bold mb-2">1) گاہک اور تاریخیں</div><div class="row g-2">' +
      UI.field({ label: 'گاہک', type: 'raw', html: edit ? '<div class="form-control bg-light">' + U.esc(Cust.name(d.customerId)) + '</div>' : UI.picker('customerId', 'customer', d.customerId), req: 1, cls: 'col-12 col-md-6' }) +
      UI.field({ label: 'آرڈر کی تاریخ', name: 'date', type: 'date', value: d.date, cls: 'col-6 col-md-3' }) + UI.field({ label: 'ڈیلیوری کی تاریخ', name: 'dueDate', type: 'date', value: d.dueDate, cls: 'col-6 col-md-3' }) +
      UI.field({ label: 'آرڈر کے نوٹس', name: 'note', value: d.note }) + '</div></div>' +
      '<div class="card-box mb-3"><div class="d-flex justify-content-between align-items-center mb-2"><div class="fw-bold">2) گارمنٹس</div><button class="btn btn-success" data-act="ordAddGarm">➕ گارمنٹ شامل کریں</button></div><div id="ordGarms"></div></div>' +
      '<div class="card-box mb-3"><div class="fw-bold mb-2">3) حساب</div><div id="ordTotals"></div><div class="row g-2 mt-1">' +
      UI.field({ label: 'رعایت', name: 'discount', type: 'num', value: d.discount, cls: 'col-6' }) +
      (edit ? '' : UI.field({ label: 'پیشگی وصولی', name: 'advance', type: 'num', value: d.advance, cls: 'col-6' }) + UI.field({ label: 'پیشگی کس میں', name: 'advAccount', type: 'select', html: Acc.cashOptions(d.advAccount), cls: 'col-6' }) + UI.field({ label: 'حوالہ', name: 'advRef', value: d.advRef, cls: 'col-6' })) + '</div></div>' +
      '<div class="d-flex flex-wrap gap-2"><button class="btn btn-success btn-lg flex-grow-1" data-act="ordSave">💾 محفوظ کریں</button><button class="btn btn-outline-success btn-lg flex-grow-1" data-act="ordSavePrint">🏷 محفوظ کریں اور ٹیگ پرنٹ</button>' + (edit ? '' : '<button class="btn btn-light" data-act="ordClear">صاف کریں</button>') + '</div>';
    App.render('<div id="ordForm">' + h + '</div>'); drawGarms();
  }
  App.route('order', args => { if (args[0] === 'new' || args[0] === 'edit') return formPage(args); return detail(args); });

  function drawGarms() {
    const d = Ord.draft; if (!d) return;
    $('#ordGarms').html(d.garments.length ? '<div class="vstack gap-2">' + d.garments.map((g, i) => {
      const t = DB.garmentTypes.get(g.typeId), filled = g.measure.fields.filter(f => String(f.v || '').trim()).length, k = g.assign && g.assign.karigarId && DB.karigars.get(g.assign.karigarId);
      return '<div class="garment-card"><div class="d-flex justify-content-between gap-2"><div class="min-w-0"><div class="fw-bold">' + (i + 1) + '. ' + U.esc(Meas.typeLabel(t)) + ' × ' + U.num(g.qty) + '</div>' +
        '<div class="small">🧵 ' + ([g.fabric.kind, g.fabric.color, g.fabric.design].filter(Boolean).map(U.esc).join(' · ') || 'کپڑے کی تفصیل نہیں') + ' · ' + (g.fabric.owner === 'shop' ? 'دکان کا' : 'گاہک کا') + '</div>' +
        '<div class="small text-muted">📏 ' + filled + ' پیمائشیں' + (k ? ' · 🧑‍🏭 ' + U.esc(k.name) : '') + '</div></div><div class="text-end text-nowrap"><div class="fw-bold">' + U.num(g.qty * g.rate) + '</div><div class="small text-muted">' + U.num(g.rate) + ' فی پیس</div></div></div>' +
        '<div class="d-flex gap-1 mt-2"><button class="btn btn-sm btn-outline-success" data-act="ordEditGarm" data-i="' + i + '">✏️ ترمیم</button><button class="btn btn-sm btn-outline-secondary" data-act="ordDupGarm" data-i="' + i + '">نقل</button><button class="btn btn-sm btn-outline-danger" data-act="ordDelGarm" data-i="' + i + '">🗑 ہٹائیں</button></div></div>';
    }).join('') + '</div>' : UI.empty('✂️', 'ابھی کوئی گارمنٹ شامل نہیں'));
    totals();
  }
  function totals() {
    const d = Ord.draft; if (!d) return;
    const gross = U.sum(d.garments, g => g.qty * g.rate), disc = Math.min(U.n($('[name=discount]').val() || d.discount), gross), net = U.round(gross - disc), adv = U.n($('[name=advance]').val() || d.advance);
    const paidAlready = d.id ? Ord.paid(d.id) : 0;
    $('#ordTotals').html(UI.kv('کل سلائی', U.rs(gross)) + UI.kv('رعایت', U.rs(disc)) + UI.kv('کل بل', '<span class="fs-5">' + U.rs(net) + '</span>') + (d.id ? UI.kv('پہلے وصول شدہ', U.rs(paidAlready)) : UI.kv('پیشگی', U.rs(adv))) + UI.kv('بقایا', '<span class="text-danger">' + U.rs(net - paidAlready - adv) + '</span>'));
  }
  $(document).on('input', '#ordForm [name=discount],#ordForm [name=advance]', totals);
  $(document).on('change', '#ordForm [name=customerId]', function () { if (Ord.draft) Ord.draft.customerId = this.value; });
  function readHead() {
    const d = Ord.draft, $f = $('#ordForm'), v = UI.vals($f);
    if (!d.id) d.customerId = v.customerId || d.customerId;
    d.date = v.date; d.dueDate = v.dueDate; d.note = v.note; d.discount = v.discount;
    if (!d.id) { d.advance = v.advance; d.advAccount = v.advAccount; d.advRef = v.advRef; }
  }
  App.act.ordAddGarm = () => {
    readHead(); const d = Ord.draft;
    Garm.edit(Garm.blank((Meas.types()[0] || {}).id), { isNew: true, customerId: () => $('#ordForm [name=customerId]').val() || d.customerId, onSave: g => { d.garments.push(g); drawGarms(); } });
  };
  App.act.ordEditGarm = $b => {
    readHead(); const d = Ord.draft, i = +$b.data('i'), g = d.garments[i];
    Garm.edit(g, { isNew: !g.id, title: 'گارمنٹ میں ترمیم', customerId: () => d.customerId || $('#ordForm [name=customerId]').val(), onSave: x => { d.garments[i] = x; drawGarms(); } });
  };
  App.act.ordDupGarm = $b => { readHead(); const d = Ord.draft, g = U.clone(d.garments[+$b.data('i')]); delete g.id; d.garments.push(g); drawGarms(); };
  App.act.ordDelGarm = $b => UI.confirm('یہ گارمنٹ فہرست سے ہٹائیں؟', { danger: true }).then(ok => { if (ok) { const d = Ord.draft, g = d.garments.splice(+$b.data('i'), 1)[0]; if (g.id) d.removed.push(g.id); drawGarms(); } });
  App.act.ordClear = () => UI.confirm('نیا آرڈر صاف کریں؟').then(ok => { if (ok) { Ord.draft = null; App.refresh(); } });
  function doSave(print) {
    readHead(); const d = Ord.draft;
    if (!d.customerId) return UI.toast('پہلے گاہک منتخب کریں', 'warning');
    if (!d.garments.length) return UI.toast('کم از کم ایک گارمنٹ شامل کریں', 'warning');
    if (U.n(d.advance) < 0 || U.n(d.discount) < 0) return UI.toast('رقم درست نہیں', 'warning');
    const gross = U.sum(d.garments, g => g.qty * g.rate);
    if (U.n(d.discount) > gross) return UI.toast('رعایت کل رقم سے زیادہ نہیں ہو سکتی', 'warning');
    const wasNew = !d.id, o = Ord.save(d); Ord.draft = null;
    UI.toast(wasNew ? 'آرڈر ' + o.no + ' محفوظ ہو گیا' : 'آرڈر اپ ڈیٹ ہو گیا');
    location.hash = '#/order/' + o.id;
    if (print) setTimeout(() => printAllTags(o.id), 400);
  }
  App.act.ordSave = () => doSave(false);
  App.act.ordSavePrint = () => doSave(true);

  // ---------- detail ----------
  function detail(args) {
    const o = DB.orders.get(args[0]); if (!o) return App.render(UI.empty('❓', 'آرڈر نہیں ملا', '<a class="btn btn-success" href="#/orders">آرڈرز</a>'));
    App.title('آرڈر ' + o.no);
    const c = DB.customers.get(o.customerId) || {}, gs = Ord.garments(o.id).sort((a, b) => a.createdAt - b.createdAt), paid = Ord.paid(o), bal = U.round(o.total - paid), late = Ord.isLate(o);
    const readyN = gs.filter(g => Garm.READY.includes(g.status)).length, canEdit = !['ڈیلیور', 'منسوخ'].includes(o.status);
    let h = '<div class="card-box mb-3"><div class="d-flex justify-content-between gap-2"><div><div class="fs-5 fw-bold">' + U.code(o.no) + ' ' + Garm.badge(o.status) + (late ? ' <span class="badge bg-danger">تاخیر ' + U.daysBetween(o.dueDate, U.today()) + ' دن</span>' : '') + '</div>' +
      '<div class="text-muted small">انوائس ' + U.code(o.invoiceNo) + ' · تاریخ ' + U.fd(o.date) + '</div><div>ڈیلیوری: <b>' + U.fd(o.dueDate) + '</b></div>' +
      '<div class="mt-1">👤 <a href="#/customer/' + c.id + '">' + U.esc(c.name) + '</a> ' + (c.mobile ? '<a href="tel:' + U.esc(c.mobile) + '">' + U.phone(c.mobile) + '</a>' : '') + '</div>' + (o.note ? '<div class="small mt-1">📝 ' + U.esc(o.note) + '</div>' : '') + '</div>' +
      '<div class="text-nowrap">' + (canEdit ? '<a class="btn btn-sm btn-light" href="#/order/edit/' + o.id + '">✏️ ترمیم</a>' : '') + '</div></div>' + Garm.flow({ status: o.status }) + '</div>';
    h += '<div class="row g-2 mb-3">' + UI.stat('کل بل', U.rs(o.total), '', null, 'col-4') + UI.stat('وصول شدہ', U.rs(paid), 'gold', null, 'col-4') + UI.stat(bal < -0.004 ? 'زائد رقم' : 'بقایا', U.rs(Math.abs(bal)), bal > 0.004 ? 'bad' : '', null, 'col-4') + '</div>';
    h += '<div class="d-flex flex-wrap gap-2 mb-3">' +
      (o.status !== 'منسوخ' ? '<button class="btn btn-success" data-act="payReceive" data-cid="' + o.customerId + '" data-oid="' + o.id + '">💰 رقم وصول کریں</button>' : '') +
      (canEdit && gs.some(g => g.status !== 'منسوخ') ? '<button class="btn btn-success" data-act="ordDeliver" data-id="' + o.id + '">🚚 ڈیلیوری' + (readyN ? ' (' + readyN + ' تیار)' : '') + '</button>' : '') +
      (bal < -0.004 ? '<button class="btn btn-outline-danger" data-act="payRefund" data-cid="' + o.customerId + '" data-oid="' + o.id + '">زائد رقم واپس</button>' : '') +
      '<div class="dropdown"><button class="btn btn-outline-secondary dropdown-toggle" data-bs-toggle="dropdown">🖨 پرنٹ</button><ul class="dropdown-menu">' +
      '<li><a class="dropdown-item fw-bold" href="#" data-act="prt" data-fn="printInvoice" data-id="' + o.id + '">انوائس (ڈیفالٹ)</a></li><li><a class="dropdown-item" href="#" data-act="prt" data-fn="printInvoice58" data-id="' + o.id + '">انوائس 58mm</a></li><li><a class="dropdown-item" href="#" data-act="prt" data-fn="printInvoice80" data-id="' + o.id + '">انوائس 80mm</a></li><li><a class="dropdown-item" href="#" data-act="prt" data-fn="printInvoiceA4" data-id="' + o.id + '">انوائس A4</a></li>' +
      '<li><a class="dropdown-item" href="#" data-act="prt" data-fn="printOrderSlip" data-id="' + o.id + '">آرڈر سلپ</a></li><li><a class="dropdown-item" href="#" data-act="prt" data-fn="printAllTags" data-id="' + o.id + '">تمام ٹیگز</a></li></ul></div>' +
      ((c.whatsapp || c.mobile) ? '<a class="btn btn-outline-success" target="_blank" rel="noopener" href="' + U.waLink(c.whatsapp || c.mobile, waText(o, bal)) + '">💬 واٹس ایپ</a>' : '') +
      (canEdit ? '<button class="btn btn-outline-danger" data-act="ordCancel" data-id="' + o.id + '">منسوخ</button>' : '') + '</div>';
    h += '<h6 class="fw-bold">گارمنٹس (' + gs.length + ')</h6><div class="vstack gap-2 mb-3">' + gs.map(g => Garm.card(g)).join('') + '</div>';
    const pays = DB.payments.of('orderId', o.id).sort((a, b) => b.createdAt - a.createdAt);
    h += UI.card('ادائیگیاں', pays.length ? '<div class="vstack gap-2">' + pays.map(p => Pay.card(p)).join('') + '</div>' : '<div class="text-muted">ابھی کوئی ادائیگی نہیں</div>');
    const dels = DB.deliveries.of('orderId', o.id);
    if (dels.length) h += UI.card('ڈیلیوری ریکارڈ', dels.map(x => '<div class="border-bottom py-1">' + U.fdt(x.at) + ' — ' + x.garmentIds.length + ' گارمنٹ' + (x.note ? ' · ' + U.esc(x.note) : '') + (x.balanceAfter > 0 ? ' · بقایا ' + U.num(x.balanceAfter) : '') + '</div>').join(''));
    const ev = DB.activity.all().filter(a => a.ref && a.ref.t === 'order' && a.ref.id === o.id).sort((a, b) => b.at - a.at).slice(0, 25);
    if (ev.length) h += UI.card('سرگزشت', '<div class="timeline">' + ev.map(a => '<div class="ev"><div>' + U.esc(a.text) + '</div><div class="small text-muted">' + U.fdt(a.at) + '</div></div>').join('') + '</div>');
    App.render(h);
  }
  function waText(o, bal) {
    const st = o.status === 'تیار' || o.status === 'ڈیلیوری کے لیے تیار' ? 'آپ کا آرڈر تیار ہے، تشریف لے آئیں۔' : 'آپ کے آرڈر کی حالت: ' + o.status;
    return DB.settings.shopName + '\nآرڈر ' + o.no + '\n' + st + '\nڈیلیوری تاریخ: ' + U.fd(o.dueDate) + '\nبقایا رقم: ' + U.num(bal) + ' روپے';
  }
  App.act.ordCancel = $b => Ord.cancel($b.data('id'));
  App.act.prt = $b => { const f = w[$b.data('fn')]; if (f) f($b.data('id')); };
  App.act.ordDeliver = $b => Ord.deliverModal($b.data('id'));

  // ---------- delivery ----------
  Ord.deliverModal = function (id) {
    const o = DB.orders.get(id), gs = Ord.active(id).filter(g => g.status !== 'ڈیلیور'), bal = Ord.balance(o);
    const S = DB.settings;
    if (!gs.length) return UI.toast('ڈیلیوری کے لیے کوئی گارمنٹ باقی نہیں', 'warning');
    const ctl = UI.modal({
      title: 'ڈیلیوری: ' + o.no, form: 'ordDeliver', size: 'lg',
      body: '<input type="hidden" name="id" value="' + id + '"><div class="mb-2"><b>' + U.esc(Cust.name(o.customerId)) + '</b> ' + U.phone((DB.customers.get(o.customerId) || {}).mobile) + '</div>' +
        '<div class="row g-2 mb-2">' + UI.stat('کل رقم', U.rs(o.total), '', null, 'col-4') + UI.stat('وصول شدہ', U.rs(Ord.paid(o)), 'gold', null, 'col-4') + UI.stat('بقایا', U.rs(bal), bal > 0 ? 'bad' : '', null, 'col-4') + '</div>' +
        '<div class="fw-bold mb-1">ڈیلیور ہونے والی گارمنٹس</div><div class="vstack gap-1 mb-3">' + gs.map(g => { const ok = Garm.READY.includes(g.status); return '<label class="form-check d-flex align-items-center gap-2 border rounded p-2' + (ok ? '' : ' bg-light text-muted') + '"><input type="checkbox" class="form-check-input m-0 dg" name="g_' + g.id + '" ' + (ok ? 'checked' : 'disabled') + '><span class="flex-grow-1">' + U.esc(g.typeName) + ' × ' + U.num(g.qty) + ' ' + U.code(g.tag) + '</span>' + Garm.badge(g.status) + '</label>'; }).join('') + '</div>' +
        '<div class="row g-2">' + (bal > 0.004 ? UI.field({ label: 'ابھی وصول کریں', name: 'receive', type: 'num', value: S.allowDeliveryWithBalance ? '' : bal, cls: 'col-6', help: S.allowDeliveryWithBalance ? 'بقایا کے ساتھ ڈیلیوری کی اجازت ہے' : 'سیٹنگز کے مطابق مکمل بقایا وصول کرنا ضروری ہے' }) + UI.field({ label: 'کیش / بینک', name: 'account', type: 'select', html: Acc.cashOptions(), cls: 'col-6' }) : '') +
        UI.field({ label: 'ڈیلیوری کی تاریخ', name: 'date', type: 'date', value: U.today(), cls: 'col-6' }) + UI.field({ label: 'نوٹس', name: 'note', cls: 'col-6' }) + '</div>', ok: '🚚 ڈیلیور کریں'
    });
    if (bal > 0.004) ctl.$el.find('.modal-footer').prepend('<button type="button" class="btn btn-outline-success" id="dFull">پورا بقایا وصول</button>');
    ctl.$el.on('click', '#dFull', () => ctl.$el.find('[name=receive]').val(bal));
  };
  App.forms.ordDeliver = ($f, m) => {
    const v = UI.vals($f), o = DB.orders.get(v.id), S = DB.settings;
    const sel = Ord.active(o.id).filter(g => v['g_' + g.id]);
    if (!sel.length) return UI.toast('کم از کم ایک تیار گارمنٹ منتخب کریں', 'warning');
    const rec = U.n(v.receive), balAfter = U.round(Ord.balance(o) - rec);
    if (rec < 0) return UI.toast('رقم درست نہیں', 'warning');
    const go = () => {
      let p = null;
      if (rec > 0) p = Pay.create({ party: 'customer', partyId: o.customerId, dir: 'in', amount: rec, date: v.date, account: v.account, orderId: o.id, kind: 'payment', note: 'ڈیلیوری پر وصولی' });
      sel.forEach(g => Garm.setStatus(g.id, 'ڈیلیور'));
      DB.deliveries.add({ orderId: o.id, customerId: o.customerId, garmentIds: sel.map(g => g.id), at: Date.now(), date: v.date, note: v.note, received: rec, balanceAfter: Math.max(0, balAfter) });
      DB.log('delivery', 'ڈیلیوری: ' + o.no + ' — ' + sel.length + ' گارمنٹ', { t: 'order', id: o.id });
      Ord.refresh(o.id); m.close(); UI.toast('ڈیلیوری درج ہو گئی'); if (p) Pay.receiptPrompt(p); App.refresh();
    };
    if (balAfter > 0.004) {
      if (!S.allowDeliveryWithBalance) return UI.toast('پہلے مکمل بقایا (' + U.rs(balAfter) + ') وصول کریں', 'danger');
      if (S.requireDeliveryConfirm) return UI.confirm('اس آرڈر کا ' + U.rs(balAfter) + ' بقایا رہے گا۔ کیا پھر بھی ڈیلیور کریں؟').then(ok => { if (ok) go(); });
    }
    go();
  };

  function deliveryPage() {
    App.title('ڈیلیوری');
    App.render(UI.list({
      key: 'deliv', keepState: true, placeholder: 'آرڈر نمبر، موبائل، گاہک یا ٹیگ نمبر تلاش کریں', icon: '🚚', empty: 'کوئی آرڈر نہیں ملا',
      filters: [{ name: 'f', def: 'ready', opts: [['ready', 'تیار آرڈرز'], ['open', 'تمام کھلے آرڈرز'], ['done', 'ڈیلیور شدہ']] }],
      items: st => Ord.search(st.q).filter(o => { if (o.status === 'منسوخ') return false; if (st.f.f === 'done') return DB.deliveries.of('orderId', o.id).length > 0; if (o.status === 'ڈیلیور') return false; return st.f.f === 'open' || Ord.active(o.id).some(g => Garm.READY.includes(g.status)); }),
      row: o => {
        const gs = Ord.active(o.id), ready = gs.filter(g => Garm.READY.includes(g.status)).length, bal = Ord.balance(o);
        return '<div class="item-card"><div class="d-flex justify-content-between"><div><div class="fw-bold">' + U.code(o.no) + ' · ' + U.esc(Cust.name(o.customerId)) + ' ' + Garm.badge(o.status) + '</div><div class="small text-muted">تیار ' + ready + ' از ' + gs.length + ' گارمنٹ · ڈیلیوری ' + U.fd(o.dueDate) + '</div></div><div class="text-end"><div class="fw-bold">' + U.num(o.total) + '</div>' + (bal > 0.004 ? '<div class="small text-danger">بقایا ' + U.num(bal) + '</div>' : '<div class="small text-success">ادا شدہ</div>') + '</div></div>' +
          '<div class="d-flex gap-1 mt-2"><button class="btn btn-sm btn-success" data-act="ordDeliver" data-id="' + o.id + '">🚚 ڈیلیور کریں</button><a class="btn btn-sm btn-outline-secondary" href="#/order/' + o.id + '">تفصیل</a></div></div>';
      }
    }));
  }
  App.route('delivery', deliveryPage);

  w.Ord = Ord;
})(window);
