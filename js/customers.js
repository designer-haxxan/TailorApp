/* customers.js — customer master, profile, ledger */
(function (w) {
  'use strict';
  const Cust = {};
  let BM = { key: '' };

  Cust.name = id => { const c = DB.customers.get(id); return c ? c.name : '—'; };
  Cust.search = function (q) {
    const n = U.norm(q), all = DB.customers.all();
    let res;
    if (!n) res = all.slice();
    else {
      const ids = new Set(all.filter(c => U.norm(c.name + ' ' + c.mobile + ' ' + c.mobile2 + ' ' + c.whatsapp + ' ' + c.no).includes(n)).map(c => c.id));
      DB.orders.all().forEach(o => { if (U.norm(o.no + ' ' + o.invoiceNo).includes(n)) ids.add(o.customerId); });
      res = all.filter(c => ids.has(c.id));
    }
    return res.sort((a, b) => n ? (a.name < b.name ? -1 : 1) : b.createdAt - a.createdAt);
  };

  // customer sub-ledger entries (bills + payments)
  Cust.ledger = function (id) {
    const e = [];
    DB.orders.of('customerId', id).forEach(o => { if (o.status !== 'منسوخ') e.push({ date: o.date, ts: o.createdAt, desc: 'آرڈر ' + o.no + ' (انوائس ' + o.invoiceNo + ')', dr: o.total, cr: 0, ref: { t: 'order', id: o.id } }); });
    DB.alterations.of('customerId', id).forEach(a => { if (a.status !== 'منسوخ') e.push({ date: a.date, ts: a.createdAt, desc: 'آلٹریشن ' + a.no, dr: a.charge, cr: 0, ref: { t: 'alt', id: a.id } }); });
    DB.sales.of('customerId', id).forEach(s => { if (!s.voided) e.push({ date: s.date, ts: s.createdAt, desc: 'فروخت ' + s.no, dr: s.total, cr: 0, ref: { t: 'sale', id: s.id } }); });
    DB.payments.of('partyId', id).forEach(p => {
      if (p.party !== 'customer' || p.voided) return;
      const tx = p.dir === 'in' ? { dr: 0, cr: p.amount } : { dr: p.amount, cr: 0 };
      e.push(Object.assign({ date: p.date, ts: p.createdAt, desc: (p.dir === 'in' ? (p.kind === 'advance' ? 'پیشگی وصولی ' : 'وصولی ') : 'واپسی ') + p.no + (p.orderId ? ' (آرڈر ' + ((DB.orders.get(p.orderId) || {}).no || '') + ')' : ''), ref: { t: 'pay', id: p.id } }, tx));
    });
    e.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : a.ts - b.ts);
    let bal = 0; e.forEach(x => { bal += x.dr - x.cr; x.bal = U.round(bal); });
    return e;
  };
  Cust.balances = function () {
    const key = [DB.orders.ver, DB.payments.ver, DB.sales.ver, DB.alterations.ver].join('.');
    if (BM.key === key) return BM.map;
    const m = new Map(), g = id => { if (!m.has(id)) m.set(id, { bill: 0, paid: 0 }); return m.get(id); };
    DB.orders.all().forEach(o => { if (o.status !== 'منسوخ') g(o.customerId).bill += o.total; });
    DB.alterations.all().forEach(a => { if (a.status !== 'منسوخ') g(a.customerId).bill += a.charge; });
    DB.sales.all().forEach(s => { if (!s.voided && s.customerId) g(s.customerId).bill += s.total; });
    DB.payments.all().forEach(p => { if (p.party === 'customer' && !p.voided && p.partyId) g(p.partyId).paid += p.dir === 'in' ? p.amount : -p.amount; });
    BM = { key, map: m }; return m;
  };
  Cust.balance = id => { const x = Cust.balances().get(id); return x ? U.round(x.bill - x.paid) : 0; };
  Cust.summary = id => { const x = Cust.balances().get(id) || { bill: 0, paid: 0 }; return { bill: U.round(x.bill), paid: U.round(x.paid), bal: U.round(x.bill - x.paid) }; };
  Cust.totalOutstanding = () => { let t = 0; Cust.balances().forEach(x => { const b = x.bill - x.paid; if (b > 0) t += b; }); return U.round(t); };

  // ---------- form ----------
  Cust.form = function (id, cb) {
    const c = id ? DB.customers.get(id) : { no: DB.peek('customer') };
    const ctl = UI.modal({
      title: id ? 'گاہک میں ترمیم' : 'نیا گاہک', form: 'custSave',
      body: '<input type="hidden" name="id" value="' + (id || '') + '"><div class="row g-2">' +
        UI.field({ label: 'گاہک نمبر', name: 'no', value: c.no, attrs: 'readonly', cls: 'col-5' }) + UI.field({ label: 'نام', name: 'name', value: c.name, req: 1, cls: 'col-7' }) +
        UI.field({ label: 'موبائل نمبر', name: 'mobile', type: 'tel', value: c.mobile, cls: 'col-6' }) + UI.field({ label: 'دوسرا نمبر', name: 'mobile2', type: 'tel', value: c.mobile2, cls: 'col-6' }) +
        UI.field({ label: 'واٹس ایپ نمبر', name: 'whatsapp', type: 'tel', value: c.whatsapp, cls: 'col-6' }) + UI.field({ label: 'شہر', name: 'city', value: c.city, cls: 'col-6' }) +
        UI.field({ label: 'پتہ', name: 'address', value: c.address }) + UI.field({ label: 'نوٹس', name: 'notes', type: 'textarea', rows: 2, value: c.notes }) + '</div>', ok: 'محفوظ کریں'
    });
    ctl.$el.data('cb', cb);
  };
  App.forms.custSave = ($f, m) => {
    const v = UI.vals($f); let c;
    const dup = v.mobile && DB.customers.all().find(x => x.mobile === v.mobile && x.id !== v.id);
    const go = () => {
      if (v.id) { c = DB.customers.update(v.id, { name: v.name, mobile: v.mobile, mobile2: v.mobile2, whatsapp: v.whatsapp, city: v.city, address: v.address, notes: v.notes }); DB.log('customer', 'گاہک اپ ڈیٹ: ' + v.name, { t: 'customer', id: v.id }); }
      else { c = DB.customers.add({ no: DB.next('customer'), name: v.name, mobile: v.mobile, mobile2: v.mobile2, whatsapp: v.whatsapp, city: v.city, address: v.address, notes: v.notes, active: true }); DB.log('customer', 'نیا گاہک: ' + v.name, { t: 'customer', id: c.id }); }
      m.close(); UI.toast('گاہک محفوظ ہو گیا'); const cb = m.$el.data('cb'); if (cb) cb(c); else App.refresh();
    };
    if (dup) UI.confirm('یہ موبائل نمبر «' + dup.name + '» کے نام پہلے سے موجود ہے۔ پھر بھی محفوظ کریں؟').then(ok => { if (ok) go(); }); else go();
  };

  // ---------- pages ----------
  function listPage() {
    App.title('گاہک');
    const h = '<div class="d-flex justify-content-between align-items-center mb-2"><h6 class="fw-bold m-0">گاہک</h6><button class="btn btn-success" data-act="custNew">➕ نیا گاہک</button></div>' +
      UI.list({
        key: 'cust', keepState: true, placeholder: 'نام، موبائل، گاہک نمبر یا آرڈر نمبر', icon: '👥', empty: 'کوئی گاہک نہیں ملا۔ نیا گاہک شامل کریں۔',
        filters: [{ name: 'f', opts: [['', 'تمام'], ['due', 'بقایا والے'], ['adv', 'پیشگی والے']] }],
        items: st => Cust.search(st.q).filter(c => { const b = Cust.balance(c.id); return st.f.f === 'due' ? b > 0 : st.f.f === 'adv' ? b < 0 : true; }),
        row: c => { const b = Cust.balance(c.id); return UI.row({ title: U.esc(c.name), sub: U.phone(c.mobile) + ' · ' + U.code(c.no) + (c.city ? ' · ' + U.esc(c.city) : ''), href: '#/customer/' + c.id, right: b ? '<div class="fw-bold ' + (b > 0 ? 'text-danger' : 'text-success') + '">' + U.num(Math.abs(b)) + '</div><div class="small text-muted">' + (b > 0 ? 'بقایا' : 'پیشگی') + '</div>' : '<span class="small text-muted">حساب صاف</span>' }); }
      });
    App.render(h);
  }
  App.route('customers', listPage);
  App.act.custNew = () => Cust.form();
  App.act.custEdit = $b => Cust.form($b.data('id'));
  App.act.custDel = $b => {
    const id = $b.data('id');
    if (DB.orders.of('customerId', id).length || DB.payments.of('partyId', id).length || DB.sales.of('customerId', id).length || DB.alterations.of('customerId', id).length) return UI.toast('اس گاہک کا لین دین موجود ہے، حذف نہیں ہو سکتا', 'warning');
    UI.confirm('گاہک حذف کریں؟ اس کی پیمائشیں بھی حذف ہوں گی۔', { danger: true }).then(ok => { if (ok) { DB.measurements.of('customerId', id).slice().forEach(m => DB.measurements.remove(m.id)); DB.customers.remove(id); DB.log('customer', 'گاہک حذف'); location.hash = '#/customers'; } });
  };

  const PTABS = [['orders', 'آرڈرز'], ['measures', 'پیمائشیں'], ['payments', 'ادائیگیاں'], ['ledger', 'لیجر']];
  function profile(args) {
    const c = DB.customers.get(args[0]); if (!c) return App.render(UI.empty('❓', 'گاہک نہیں ملا'));
    const tab = args[1] || 'orders'; App.title(c.name);
    const s = Cust.summary(c.id), orders = DB.orders.of('customerId', c.id).slice().sort((a, b) => b.createdAt - a.createdAt);
    const active = orders.filter(o => !['ڈیلیور', 'منسوخ'].includes(o.status)).length, done = orders.filter(o => o.status === 'ڈیلیور').length, canc = orders.filter(o => o.status === 'منسوخ').length;
    let h = '<div class="card-box mb-3"><div class="d-flex justify-content-between gap-2"><div><div class="fs-4 fw-bold">' + U.esc(c.name) + '</div><div class="text-muted">' + U.code(c.no) + (c.city ? ' · ' + U.esc(c.city) : '') + '</div>' +
      (c.mobile ? '<div>📞 <a href="tel:' + U.esc(c.mobile) + '">' + U.phone(c.mobile) + '</a></div>' : '') + (c.mobile2 ? '<div>📞 ' + U.phone(c.mobile2) + '</div>' : '') +
      ((c.whatsapp || c.mobile) ? '<div>💬 <a target="_blank" rel="noopener" href="' + U.waLink(c.whatsapp || c.mobile) + '">واٹس ایپ پر پیغام</a></div>' : '') + (c.address ? '<div class="small text-muted">' + U.esc(c.address) + '</div>' : '') + (c.notes ? '<div class="small mt-1">📝 ' + U.esc(c.notes) + '</div>' : '') + '</div>' +
      '<div class="text-nowrap"><button class="btn btn-sm btn-light" data-act="custEdit" data-id="' + c.id + '">✏️</button> <button class="btn btn-sm btn-light" data-act="custDel" data-id="' + c.id + '">🗑</button></div></div>' +
      '<div class="d-flex flex-wrap gap-2 mt-3"><a class="btn btn-success" href="#/order/new/' + c.id + '">✂️ نیا آرڈر</a><button class="btn btn-outline-success" data-act="measNew" data-cid="' + c.id + '">📏 نئی پیمائش</button><button class="btn btn-outline-success" data-act="payReceive" data-cid="' + c.id + '">💰 رقم وصول کریں</button><button class="btn btn-outline-secondary" data-act="custStatement" data-id="' + c.id + '">🖨 اسٹیٹمنٹ</button></div></div>';
    h += '<div class="row g-2 mb-3">' + UI.stat('کل بل', U.rs(s.bill), '', null, 'col-6 col-md-3') + UI.stat('کل وصول شدہ', U.rs(s.paid), 'gold', null, 'col-6 col-md-3') + UI.stat(s.bal < 0 ? 'پیشگی' : 'بقایا', U.rs(Math.abs(s.bal)), s.bal > 0 ? 'bad' : '', null, 'col-6 col-md-3') +
      UI.stat('آرڈرز', 'موجودہ ' + active + ' · مکمل ' + done + (canc ? ' · منسوخ ' + canc : ''), 'blue', null, 'col-6 col-md-3').replace('stat-v', 'stat-v fs-6') + '</div>';
    h += UI.tabs(PTABS.map(t => [c.id + '/' + t[0], t[1]]), c.id + '/' + tab, 'customer');
    if (tab === 'orders') h += orders.length ? '<div class="vstack gap-2">' + orders.map(o => Ord.card(o)).join('') + '</div>' : UI.empty('📋', 'ابھی کوئی آرڈر نہیں');
    else if (tab === 'measures') {
      const ms = DB.measurements.of('customerId', c.id).slice().sort((a, b) => b.createdAt - a.createdAt);
      h += ms.length ? '<div class="vstack gap-2">' + ms.map(m => UI.row({ title: U.esc(m.typeName), sub: U.fd(m.date), extra: m.fields.filter(f => f.v).slice(0, 6).map(f => U.esc(f.n) + ': ' + U.esc(f.v)).join(' | '), right: '<button class="btn btn-sm btn-outline-success" data-act="measView" data-id="' + m.id + '">دیکھیں</button>' })).join('') + '</div>' : UI.empty('📏', 'کوئی پیمائش محفوظ نہیں');
    } else if (tab === 'payments') {
      const ps = DB.payments.of('partyId', c.id).filter(p => p.party === 'customer').sort((a, b) => b.createdAt - a.createdAt);
      h += ps.length ? '<div class="vstack gap-2">' + ps.map(p => Pay.card(p)).join('') + '</div>' : UI.empty('💰', 'کوئی ادائیگی نہیں');
    } else {
      const L = Cust.ledger(c.id);
      h += UI.card('گاہک لیجر', Reports.tableHtml({ head: ['تاریخ', 'تفصیل', 'بل', 'وصولی', 'بیلنس'], aligns: ['', '', 'n', 'n', 'n'], rows: L.map(x => [U.fd(x.date), x.desc, x.dr ? U.num(x.dr) : '', x.cr ? U.num(x.cr) : '', U.num(x.bal)]), foot: ['', 'کل', U.num(s.bill), U.num(s.paid), U.num(s.bal)], key: 'custledger' }));
    }
    App.render(h);
  }
  App.route('customer', profile);
  App.act.custStatement = $b => Reports.open('cust_statement', { cust: $b.data('id') });

  w.Cust = Cust;
})(window);
