/* sales.js — sales of services / ready-made goods / quick sale */
(function (w) {
  'use strict';
  const Sales = {};
  const TYPES = ['سلائی', 'آلٹریشن', 'ریڈی میڈ کپڑے', 'بٹن', 'زپ', 'دیگر'];
  const INC = { 'سلائی': 'incStitch', 'آلٹریشن': 'incAlter' };

  Sales.card = function (s) {
    const c = s.customerId ? DB.customers.get(s.customerId) : null, bal = U.round(s.total - s.paid);
    return UI.row({
      cls: s.voided ? 'mute' : '', title: U.code(s.no) + ' · ' + U.esc(c ? c.name : 'عام گاہک') + (s.voided ? ' ' + UI.badge('منسوخ') : ''), sub: U.fd(s.date), extra: s.lines.map(l => U.esc(l.desc || l.type) + ' ×' + U.num(l.qty)).join('، '),
      right: '<div class="fw-bold">' + U.num(s.total) + '</div>' + (bal > 0.004 ? '<div class="small text-danger">بقایا ' + U.num(bal) + '</div>' : '<div class="small text-success">ادا شدہ</div>'),
      actions: s.voided ? '' : '<div class="btn-group btn-group-sm"><button class="btn btn-outline-success" data-act="salePrint" data-id="' + s.id + '" data-w="58">رسید 58</button><button class="btn btn-outline-success" data-act="salePrint" data-id="' + s.id + '" data-w="80">رسید 80</button></div><button class="btn btn-sm btn-outline-danger" data-act="saleVoid" data-id="' + s.id + '">منسوخ</button>'
    });
  };
  App.act.salePrint = $b => printSaleReceipt($b.data('id'), String($b.data('w')));

  function lineRow(l) {
    l = l || {};
    return '<div class="draggable-row sl"><div class="row g-1 align-items-center"><div class="col-6 col-md-3"><select class="form-select form-select-sm sl-type">' + UI.opts(TYPES, l.type) + '</select></div><div class="col-6 col-md-4"><input class="form-control form-control-sm sl-desc" placeholder="تفصیل" value="' + U.esc(l.desc || '') + '"></div>' +
      '<div class="col-3 col-md-1"><input class="form-control form-control-sm sl-qty" inputmode="decimal" placeholder="تعداد" value="' + (l.qty || 1) + '"></div><div class="col-4 col-md-2"><input class="form-control form-control-sm sl-rate" inputmode="decimal" placeholder="ریٹ" value="' + (l.rate || '') + '"></div>' +
      '<div class="col-3 col-md-1 text-center fw-bold sl-amt">0</div><div class="col-2 col-md-1"><button type="button" class="btn btn-sm btn-outline-danger" data-act="slDel">×</button></div></div></div>';
  }
  Sales.form = function () {
    const ctl = UI.modal({
      title: 'نئی فروخت', form: 'saleSave', size: 'xl', static: true, noFocus: true,
      body: '<div class="row g-2 mb-2">' + UI.field({ label: 'گاہک (اختیاری)', type: 'raw', html: UI.picker('customerId', 'customer', ''), cls: 'col-12 col-md-6' }) + UI.field({ label: 'تاریخ', name: 'date', type: 'date', value: U.today(), cls: 'col-12 col-md-6' }) + '</div><div id="slines">' + lineRow() + '</div>' +
        '<button type="button" class="btn btn-outline-secondary btn-sm mt-1" data-act="slAdd">➕ لائن</button><div class="row g-2 mt-2">' + UI.field({ label: 'رعایت', name: 'discount', type: 'num', cls: 'col-6 col-md-3' }) + '<div class="col-6 col-md-3"><label class="form-label mb-1">کل</label><div class="form-control bg-light fw-bold" id="sTotal">0</div></div>' +
        UI.field({ label: 'وصول شدہ', name: 'paid', type: 'num', cls: 'col-6 col-md-3' }) + UI.field({ label: 'کیش / بینک', name: 'account', type: 'select', html: Acc.cashOptions(), cls: 'col-6 col-md-3' }) + UI.field({ label: 'نوٹس', name: 'note' }) + '</div><div class="mt-2 fw-bold" id="sBal"></div>', ok: 'محفوظ کریں'
    });
    const $m = ctl.$el;
    const calc = () => { let sub = 0; $m.find('.sl').each(function () { const a = U.n($(this).find('.sl-qty').val()) * U.n($(this).find('.sl-rate').val()); $(this).find('.sl-amt').text(U.num(a)); sub += a; }); const t = U.round(sub - Math.min(U.n($m.find('[name=discount]').val()), sub)); $m.find('#sTotal').text(U.num(t)); $m.find('#sBal').text('بقایا: ' + U.num(t - U.n($m.find('[name=paid]').val()))); };
    $m.on('input', '.sl-qty,.sl-rate,[name=discount],[name=paid]', calc);
    $m.on('click', '[data-act=slAdd]', () => $m.find('#slines').append(lineRow()));
    $m.on('click', '[data-act=slDel]', function () { if ($m.find('.sl').length > 1) { $(this).closest('.sl').remove(); calc(); } });
  };
  App.act.slAdd = App.act.slDel = () => { };
  App.act.saleNew = () => Sales.form();
  App.act.saleQuick = () => {
    UI.modal({
      title: 'فوری فروخت', form: 'saleQuick', size: 'sm',
      body: '<div class="row g-2">' + UI.field({ label: 'قسم', name: 'type', type: 'select', html: UI.opts(TYPES) }) + UI.field({ label: 'تفصیل', name: 'desc', ph: 'مثلاً زپ، بٹن' }) + UI.field({ label: 'رقم', name: 'amount', type: 'num', req: 1, cls: 'col-6' }) + UI.field({ label: 'کیش / بینک', name: 'account', type: 'select', html: Acc.cashOptions(), cls: 'col-6' }) + '</div><div class="form-text">پوری رقم نقد وصول شدہ شمار ہو گی۔</div>', ok: 'فروخت کریں'
    });
  };
  Sales.create = function (o) {
    const lines = o.lines, sub = U.sum(lines, l => l.amount), disc = Math.min(U.n(o.discount), sub), total = U.round(sub - disc), paid = Math.min(U.round(U.n(o.paid)), total);
    if (total <= 0) throw new Error('رقم درست نہیں');
    if (!o.customerId && paid < total - 0.004) throw new Error('عام گاہک کی فروخت میں پوری رقم وصول کرنا ضروری ہے (ادھار کے لیے گاہک منتخب کریں)');
    const s = DB.sales.add({ no: DB.next('sale'), date: o.date, customerId: o.customerId || null, lines, subtotal: sub, discount: disc, total, paid, account: o.account, note: o.note || '', voided: false });
    // income split by account, scaled for discount
    const by = {}; lines.forEach(l => { const k = INC[l.type] || 'incOther'; by[k] = (by[k] || 0) + l.amount; });
    const keys = Object.keys(by); let rem = total; const cr = keys.map((k, i) => { const v = i === keys.length - 1 ? rem : U.round(by[k] * total / sub); rem = U.round(rem - v); return { a: k, c: v }; });
    const dr = o.customerId ? [{ a: 'receivable', d: total }] : [{ a: o.account, d: total }];
    const t = Acc.post({ date: o.date, type: 'sale', desc: 'فروخت ' + s.no, lines: dr.concat(cr), ref: { t: 'sale', id: s.id }, party: o.customerId || null });
    DB.sales.update(s.id, { txnId: t.id });
    if (o.customerId) { if (paid > 0) Pay.create({ party: 'customer', partyId: o.customerId, dir: 'in', amount: paid, date: o.date, account: o.account, saleId: s.id, kind: 'payment', note: 'فروخت ' + s.no }); Pay.applyAdvance(o.customerId); }
    DB.log('sale', 'فروخت ' + s.no + ': ' + U.rs(total));
    return s;
  };
  App.forms.saleSave = ($f, m) => {
    const v = UI.vals($f), lines = [];
    $f.find('.sl').each(function () { const q = U.n($(this).find('.sl-qty').val()), r = U.n($(this).find('.sl-rate').val()), t = $(this).find('.sl-type').val(); if (q > 0 && r > 0) lines.push({ type: t, desc: $(this).find('.sl-desc').val().trim() || t, qty: q, rate: r, amount: U.round(q * r) }); });
    if (!lines.length) return UI.toast('کم از کم ایک لائن مکمل کریں', 'warning');
    let s; try { s = Sales.create({ customerId: v.customerId, date: v.date, lines, discount: v.discount, paid: v.paid, account: v.account, note: v.note }); } catch (e) { return UI.toast(e.message, 'danger'); }
    m.close(); UI.toast('فروخت محفوظ ہو گئی'); salePrompt(s); App.refresh();
  };
  App.forms.saleQuick = ($f, m) => {
    const v = UI.vals($f), a = U.n(v.amount); let s;
    try { s = Sales.create({ customerId: '', date: U.today(), lines: [{ type: v.type, desc: v.desc || v.type, qty: 1, rate: a, amount: a }], discount: 0, paid: a, account: v.account }); } catch (e) { return UI.toast(e.message, 'danger'); }
    m.close(); UI.toast('فروخت درج ہو گئی'); salePrompt(s); App.refresh();
  };
  function salePrompt(s) {
    UI.modal({ title: 'فروخت محفوظ', size: 'sm', body: '<div class="text-center"><div class="display-5">✅</div><div class="fs-5 fw-bold">' + U.rs(s.total) + '</div></div>', footer: '<button class="btn btn-success" data-act="salePrint" data-id="' + s.id + '" data-w="58">رسید 58mm</button><button class="btn btn-success" data-act="salePrint" data-id="' + s.id + '" data-w="80">رسید 80mm</button>' });
  }
  App.act.saleVoid = $b => UI.confirm('یہ فروخت منسوخ کریں؟', { danger: true }).then(ok => {
    if (!ok) return; const s = DB.sales.get($b.data('id'));
    DB.payments.of('saleId', s.id).forEach(p => { if (!p.voided) Pay.void(p.id); }); if (s.txnId) Acc.void(s.txnId, 'فروخت منسوخ'); DB.sales.update(s.id, { voided: true }); DB.log('void', 'فروخت منسوخ: ' + s.no); UI.toast('منسوخ ہو گئی'); App.refresh();
  });

  function page() {
    App.title('فروخت');
    App.render('<div class="d-flex flex-wrap gap-2 mb-3"><button class="btn btn-success" data-act="saleQuick">⚡ فوری فروخت</button><button class="btn btn-outline-success" data-act="saleNew">🛍️ نئی فروخت</button></div>' + UI.list({
      key: 'sales', keepState: true, placeholder: 'نمبر، گاہک یا تفصیل', icon: '🛍️', empty: 'ابھی کوئی فروخت درج نہیں',
      items: st => DB.sales.all().filter(s => UI.match(st.q, s.no, s.customerId ? Cust.name(s.customerId) : 'عام گاہک', s.lines.map(l => l.desc).join(' '))).sort((a, b) => b.date < a.date ? -1 : b.date > a.date ? 1 : b.createdAt - a.createdAt),
      row: Sales.card
    }));
  }
  App.route('sales', page);

  w.Sales = Sales;
})(window);
