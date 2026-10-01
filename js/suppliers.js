/* suppliers.js — supplier master, ledger, balance */
(function (w) {
  'use strict';
  const Sup = {};

  Sup.name = id => (DB.suppliers.get(id) || {}).name || '—';
  Sup.ledger = function (id) {
    const e = [];
    DB.purchases.of('supplierId', id).forEach(p => { if (p.voided) return; e.push({ date: p.date, ts: p.createdAt, desc: (p.type === 'return' ? 'خریداری واپسی ' : 'خریداری ') + p.no + (p.billNo ? ' (بل ' + p.billNo + ')' : ''), cr: p.type === 'return' ? 0 : p.total, dr: p.type === 'return' ? p.total : 0, ref: { t: 'purchase', id: p.id } }); });
    DB.payments.of('partyId', id).forEach(p => { if (p.party !== 'supplier' || p.voided) return; e.push({ date: p.date, ts: p.createdAt, desc: (p.dir === 'out' ? 'ادائیگی ' : 'وصولی ') + p.no, dr: p.dir === 'out' ? p.amount : 0, cr: p.dir === 'in' ? p.amount : 0, ref: { t: 'pay', id: p.id } }); });
    e.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : a.ts - b.ts); let bal = 0; e.forEach(x => { bal += x.cr - x.dr; x.bal = U.round(bal); }); return e;
  };
  Sup.summary = id => {
    const ps = DB.purchases.of('supplierId', id).filter(p => !p.voided);
    const buy = U.sum(ps.filter(p => p.type !== 'return'), p => p.total), ret = U.sum(ps.filter(p => p.type === 'return'), p => p.total);
    const paid = U.round(DB.payments.of('partyId', id).filter(p => p.party === 'supplier' && !p.voided).reduce((s, p) => s + (p.dir === 'out' ? p.amount : -p.amount), 0));
    return { buy, ret, paid, bal: U.round(buy - ret - paid) };
  };
  Sup.balance = id => Sup.summary(id).bal;
  Sup.totalPayable = () => U.round(DB.suppliers.all().reduce((s, x) => { const b = Sup.balance(x.id); return s + (b > 0 ? b : 0); }, 0));

  Sup.form = function (id, cb) {
    const s = id ? DB.suppliers.get(id) : { no: DB.peek('supplier') };
    const ctl = UI.modal({
      title: id ? 'سپلائر میں ترمیم' : 'نیا سپلائر', form: 'supSave',
      body: '<input type="hidden" name="id" value="' + (id || '') + '"><div class="row g-2">' + UI.field({ label: 'سپلائر نمبر', name: 'no', value: s.no, attrs: 'readonly', cls: 'col-5' }) + UI.field({ label: 'نام', name: 'name', value: s.name, req: 1, cls: 'col-7' }) +
        UI.field({ label: 'موبائل', name: 'mobile', type: 'tel', value: s.mobile, cls: 'col-6' }) + UI.field({ label: 'شہر', name: 'city', value: s.city, cls: 'col-6' }) + UI.field({ label: 'پتہ', name: 'address', value: s.address }) + UI.field({ label: 'نوٹس', name: 'notes', type: 'textarea', rows: 2, value: s.notes }) + '</div>', ok: 'محفوظ کریں'
    });
    ctl.$el.data('cb', cb);
  };
  App.forms.supSave = ($f, m) => {
    const v = UI.vals($f); let s; const d = { name: v.name, mobile: v.mobile, city: v.city, address: v.address, notes: v.notes };
    if (v.id) s = DB.suppliers.update(v.id, d); else { s = DB.suppliers.add(Object.assign({ no: DB.next('supplier'), active: true }, d)); DB.log('supplier', 'نیا سپلائر: ' + s.name); }
    m.close(); UI.toast('سپلائر محفوظ ہو گیا'); const cb = m.$el.data('cb'); if (cb) cb(s); else App.refresh();
  };
  App.act.supNew = () => Sup.form(); App.act.supEdit = $b => Sup.form($b.data('id'));

  function listPage() {
    App.title('سپلائر');
    App.render('<div class="d-flex justify-content-between mb-2"><h6 class="fw-bold m-0">سپلائرز</h6><button class="btn btn-success" data-act="supNew">➕ نیا سپلائر</button></div>' + UI.list({
      key: 'sup', keepState: true, placeholder: 'نام، موبائل یا نمبر', icon: '🏪', empty: 'ابھی کوئی سپلائر نہیں۔ نیا سپلائر شامل کریں۔',
      items: st => DB.suppliers.all().filter(s => UI.match(st.q, s.name, s.mobile, s.no, s.city)).sort((a, b) => a.name < b.name ? -1 : 1),
      row: s => { const b = Sup.balance(s.id); return UI.row({ title: U.esc(s.name), sub: U.phone(s.mobile) + ' ' + U.code(s.no) + (s.city ? ' · ' + U.esc(s.city) : ''), href: '#/supplier/' + s.id, right: '<div class="fw-bold ' + (b > 0 ? 'text-danger' : '') + '">' + U.num(b) + '</div><div class="small text-muted">بقایا</div>' }); }
    }));
  }
  App.route('suppliers', listPage);

  function profile(args) {
    const s = DB.suppliers.get(args[0]); if (!s) return App.render(UI.empty('❓', 'سپلائر نہیں ملا'));
    const tab = args[1] || 'ledger'; App.title(s.name); const sm = Sup.summary(s.id);
    let h = '<div class="card-box mb-3"><div class="d-flex justify-content-between"><div><div class="fs-4 fw-bold">' + U.esc(s.name) + '</div><div class="text-muted">' + U.code(s.no) + (s.city ? ' · ' + U.esc(s.city) : '') + '</div>' + (s.mobile ? '<div>📞 <a href="tel:' + U.esc(s.mobile) + '">' + U.phone(s.mobile) + '</a></div>' : '') + (s.address ? '<div class="small text-muted">' + U.esc(s.address) + '</div>' : '') + '</div><button class="btn btn-sm btn-light" data-act="supEdit" data-id="' + s.id + '">✏️</button></div>' +
      '<div class="d-flex flex-wrap gap-2 mt-3"><button class="btn btn-success" data-act="purNew" data-sid="' + s.id + '">🛒 نئی خریداری</button><button class="btn btn-outline-success" data-act="payPayout" data-party="supplier" data-id="' + s.id + '">💵 ادائیگی</button><button class="btn btn-outline-secondary" data-act="purReturn" data-sid="' + s.id + '">↩ خریداری واپسی</button><button class="btn btn-outline-secondary" data-act="supStatement" data-id="' + s.id + '">🖨 اسٹیٹمنٹ</button></div></div>' +
      '<div class="row g-2 mb-3">' + UI.stat('کل خریداری', U.rs(sm.buy), '', null, 'col-6 col-md-3') + UI.stat('واپسی', U.rs(sm.ret), 'blue', null, 'col-6 col-md-3') + UI.stat('ادا شدہ', U.rs(sm.paid), 'gold', null, 'col-6 col-md-3') + UI.stat('بقایا', U.rs(sm.bal), sm.bal > 0 ? 'bad' : '', null, 'col-6 col-md-3') + '</div>';
    h += UI.tabs([[s.id + '/ledger', 'لیجر'], [s.id + '/purchases', 'خریداریاں']], s.id + '/' + tab, 'supplier');
    if (tab === 'purchases') { const ps = DB.purchases.of('supplierId', s.id).slice().sort((a, b) => b.createdAt - a.createdAt); h += ps.length ? '<div class="vstack gap-2">' + ps.map(Purch.card).join('') + '</div>' : UI.empty('🛒', 'کوئی خریداری نہیں'); }
    else { const L = Sup.ledger(s.id); h += UI.card('سپلائر لیجر', Reports.tableHtml({ head: ['تاریخ', 'تفصیل', 'ادائیگی/واپسی', 'خریداری', 'بقایا'], aligns: ['', '', 'n', 'n', 'n'], rows: L.map(x => [U.fd(x.date), x.desc, x.dr ? U.num(x.dr) : '', x.cr ? U.num(x.cr) : '', U.num(x.bal)]), foot: ['', 'کل', U.num(sm.ret + sm.paid), U.num(sm.buy), U.num(sm.bal)], key: 'supledger' })); }
    App.render(h);
  }
  App.route('supplier', profile);
  App.act.supStatement = $b => Reports.open('sup_statement', { sup: $b.data('id') });

  w.Sup = Sup;
})(window);
