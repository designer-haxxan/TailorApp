/* payments.js — all money received / paid against customers, karigars and suppliers (+ automatic accounting) */
(function (w) {
  'use strict';
  const Pay = {};
  const PARTY = { customer: 'گاہک', karigar: 'کاریگر', supplier: 'سپلائر' };

  Pay.partyName = p => p.party === 'customer' ? Cust.name(p.partyId) : p.party === 'karigar' ? ((DB.karigars.get(p.partyId) || {}).name || '—') : ((DB.suppliers.get(p.partyId) || {}).name || '—');

  Pay.create = function (o) {
    const amt = U.round(U.n(o.amount)); if (amt <= 0) throw new Error('رقم درست نہیں');
    if (!o.account) o.account = Acc.id('cash');
    const dir = o.dir || (o.party === 'customer' ? 'in' : 'out');
    const p = DB.payments.add({
      no: DB.next('payment'), date: o.date || U.today(), party: o.party, partyId: o.partyId || null, dir, amount: amt, account: o.account, ref: o.ref || '', note: o.note || '',
      orderId: o.orderId || null, alterationId: o.alterationId || null, saleId: o.saleId || null, purchaseId: o.purchaseId || null, assignmentId: o.assignmentId || null,
      kind: o.kind || (dir === 'out' && o.party === 'customer' ? 'refund' : 'payment'), voided: false
    });
    let lines;
    const cash = o.account;
    if (o.party === 'customer') {
      const credAcc = (dir === 'in' && !o.orderId && !o.alterationId && !o.saleId && p.kind === 'advance') ? 'customerAdvance' : 'receivable';
      lines = dir === 'in' ? [{ a: cash, d: amt }, { a: credAcc, c: amt }] : [{ a: 'receivable', d: amt }, { a: cash, c: amt }];
    } else {
      const liab = o.party === 'karigar' ? 'payableKarigar' : 'payableSupplier';
      lines = dir === 'out' ? [{ a: liab, d: amt }, { a: cash, c: amt }] : [{ a: cash, d: amt }, { a: liab, c: amt }];
    }
    const t = Acc.post({ date: p.date, type: 'payment', desc: Pay.describe(p), lines, ref: { t: 'payment', id: p.id }, party: p.partyId });
    DB.payments.update(p.id, { txnId: t.id });
    DB.log('payment', Pay.describe(p) + ': ' + U.rs(amt), { t: 'payment', id: p.id });
    return p;
  };
  Pay.describe = p => {
    const who = Pay.partyName(p);
    if (p.party === 'customer') return (p.dir === 'in' ? 'وصولی از ' : 'واپسی/ریفنڈ به ') + who;
    return (p.dir === 'out' ? 'ادائیگی به ' : 'وصولی از ') + (p.party === 'karigar' ? 'کاریگر ' : 'سپلائر ') + who;
  };
  Pay.void = function (id) {
    const p = DB.payments.get(id); if (!p || p.voided) return;
    if (p.txnId) Acc.void(p.txnId, 'ادائیگی منسوخ');
    DB.payments.update(id, { voided: true });
    DB.log('payment', 'ادائیگی منسوخ: ' + p.no + ' ' + U.rs(p.amount), { t: 'payment', id });
  };
  // move unapplied customer advance against what the customer owes
  Pay.applyAdvance = function (cid) {
    if (!cid) return;
    const adv = Acc.partyBal('customerAdvance', cid), owed = Acc.partyBal('receivable', cid), t = Math.min(adv, owed);
    if (t > 0.005) Acc.post({ date: U.today(), type: 'advance-adjust', desc: 'پیشگی کی ایڈجسٹمنٹ: ' + Cust.name(cid), party: cid, lines: [{ a: 'customerAdvance', d: t }, { a: 'receivable', c: t }] });
  };
  Pay.paidFor = (field, id) => DB.payments.of(field, id).filter(p => !p.voided).reduce((s, p) => s + (p.dir === 'in' ? p.amount : -p.amount), 0);

  Pay.card = function (p) {
    const acc = Acc.name(p.account), inn = p.dir === 'in' && p.party === 'customer' || p.dir === 'in';
    return UI.row({
      cls: p.voided ? 'mute' : '', title: '<span class="' + (p.voided ? 'text-decoration-line-through' : '') + '">' + U.esc(Pay.describe(p)) + '</span>',
      sub: U.fd(p.date) + ' · ' + U.code(p.no) + ' · ' + U.esc(acc) + (p.orderId ? ' · آرڈر ' + U.code((DB.orders.get(p.orderId) || {}).no) : '') + (p.kind === 'advance' ? ' · پیشگی' : ''),
      extra: (p.note ? U.esc(p.note) : '') + (p.voided ? ' ' + UI.badge('منسوخ') : ''),
      right: '<div class="fw-bold ' + (inn ? 'text-success' : 'text-danger') + '">' + (inn ? '+' : '−') + U.num(p.amount) + '</div>',
      actions: (p.voided ? '' : '<div class="btn-group btn-group-sm"><button class="btn btn-outline-success" data-act="payPrint" data-id="' + p.id + '" data-w="58">رسید 58</button><button class="btn btn-outline-success" data-act="payPrint" data-id="' + p.id + '" data-w="80">رسید 80</button></div><button class="btn btn-sm btn-outline-danger" data-act="payVoid" data-id="' + p.id + '">منسوخ</button>')
    });
  };
  App.act.payPrint = $b => ($b.data('w') === 58 ? printReceipt58 : printReceipt80)($b.data('id'));
  App.act.payVoid = $b => UI.confirm('یہ ادائیگی منسوخ کریں؟ حسابات میں الٹی انٹری خودکار بنے گی۔', { danger: true }).then(ok => { if (ok) { Pay.void($b.data('id')); UI.toast('ادائیگی منسوخ ہو گئی'); App.refresh(); } });

  // ---------- customer receipt ----------
  Pay.orderOptions = function (cid, sel) {
    const os = DB.orders.of('customerId', cid).filter(o => o.status !== 'منسوخ' && Ord.balance(o) > 0.004);
    return '<option value="">— کسی آرڈر سے منسلک نہیں (عمومی پیشگی) —</option>' + os.map(o => '<option value="' + o.id + '" data-bal="' + Ord.balance(o) + '"' + (o.id === sel ? ' selected' : '') + '>' + U.esc(o.no) + ' · بقایا ' + U.num(Ord.balance(o)) + '</option>').join('');
  };
  Pay.receiveModal = function (cid, orderId, opts) {
    opts = opts || {};
    const ctl = UI.modal({
      title: 'رقم وصول کریں', form: 'payReceive',
      body: '<div class="row g-2">' + UI.field({ label: 'گاہک', type: 'raw', html: UI.picker('partyId', 'customer', cid), req: 1 }) +
        '<div class="col-12 small" id="prBal"></div>' +
        UI.field({ label: 'آرڈر', name: 'orderId', type: 'select', html: Pay.orderOptions(cid, orderId), cls: 'col-12' }) +
        UI.field({ label: 'رقم', name: 'amount', type: 'num', req: 1, cls: 'col-6' }) + UI.field({ label: 'تاریخ', name: 'date', type: 'date', value: U.today(), cls: 'col-6' }) +
        UI.field({ label: 'کیش / بینک', name: 'account', type: 'select', html: Acc.cashOptions(), cls: 'col-6' }) + UI.field({ label: 'حوالہ', name: 'ref', cls: 'col-6' }) +
        UI.field({ label: 'تفصیل', name: 'note', cls: 'col-12' }) + '</div>', ok: 'وصول کریں'
    });
    const $m = ctl.$el;
    const upd = () => {
      const id = $m.find('[name=partyId]').val(); if (!id) return $m.find('#prBal').text('');
      const b = Cust.balance(id); $m.find('#prBal').html('کل بقایا: <b class="' + (b > 0 ? 'text-danger' : 'text-success') + '">' + U.rs(Math.abs(b)) + (b < 0 ? ' (پیشگی)' : '') + '</b>');
      const cur = $m.find('[name=orderId]').val(); $m.find('[name=orderId]').html(Pay.orderOptions(id, cur));
    };
    $m.on('change', '[name=partyId]', () => { $m.find('[name=orderId]').val(''); upd(); });
    $m.on('change', '[name=orderId]', function () { const bal = $(this).find(':selected').data('bal'); if (bal) $m.find('[name=amount]').val(bal); });
    upd(); if (orderId) { const bal = Ord.balance(DB.orders.get(orderId)); $m.find('[name=amount]').val(bal > 0 ? bal : ''); }
  };
  App.act.payReceive = $b => Pay.receiveModal($b.data('cid'), $b.data('oid'));
  App.forms.payReceive = ($f, m) => {
    const v = UI.vals($f); if (!v.partyId) return UI.toast('گاہک منتخب کریں', 'warning');
    const order = v.orderId ? DB.orders.get(v.orderId) : null;
    const kind = order ? (order.status === 'ڈیلیور' || Ord.balance(order) <= U.n(v.amount) + 0.004 ? 'payment' : (Ord.paid(order) === 0 ? 'advance' : 'payment')) : 'advance';
    const p = Pay.create({ party: 'customer', partyId: v.partyId, dir: 'in', amount: v.amount, date: v.date, account: v.account, ref: v.ref, note: v.note, orderId: v.orderId, kind });
    m.close(); UI.toast('رقم وصول ہو گئی'); receiptPrompt(p); App.refresh();
  };
  function receiptPrompt(p) {
    UI.modal({
      title: 'رقم وصول ہو گئی', size: 'sm', body: '<div class="text-center"><div class="display-5">✅</div><div class="fs-5 fw-bold">' + U.rs(p.amount) + '</div><div class="text-muted">' + U.esc(Pay.describe(p)) + '</div></div>',
      footer: '<button class="btn btn-success" data-act="payPrint" data-id="' + p.id + '" data-w="58">رسید 58mm</button><button class="btn btn-success" data-act="payPrint" data-id="' + p.id + '" data-w="80">رسید 80mm</button>'
    });
  }
  Pay.receiptPrompt = receiptPrompt;

  // ---------- refund (customer) ----------
  Pay.refundModal = function (cid, orderId) {
    UI.modal({
      title: 'گاہک کو رقم واپس (ریفنڈ)', form: 'payRefund', size: 'sm',
      body: '<input type="hidden" name="partyId" value="' + cid + '"><input type="hidden" name="orderId" value="' + (orderId || '') + '"><div class="row g-2"><div class="col-12">گاہک: <b>' + U.esc(Cust.name(cid)) + '</b></div>' +
        UI.field({ label: 'رقم', name: 'amount', type: 'num', req: 1 }) + UI.field({ label: 'تاریخ', name: 'date', type: 'date', value: U.today() }) + UI.field({ label: 'کیش / بینک', name: 'account', type: 'select', html: Acc.cashOptions() }) + UI.field({ label: 'وجہ', name: 'note' }) + '</div>', ok: 'ریفنڈ کریں', okClass: 'btn-danger'
    });
  };
  App.act.payRefund = $b => Pay.refundModal($b.data('cid'), $b.data('oid'));
  App.forms.payRefund = ($f, m) => { const v = UI.vals($f); Pay.create({ party: 'customer', partyId: v.partyId, dir: 'out', amount: v.amount, date: v.date, account: v.account, note: v.note, orderId: v.orderId, kind: 'refund' }); m.close(); UI.toast('ریفنڈ درج ہو گیا'); App.refresh(); };

  // ---------- payout to karigar / supplier ----------
  Pay.payoutModal = function (party, partyId, assignmentId, purchaseId) {
    const isK = party === 'karigar', rec = isK ? DB.karigars.get(partyId) : DB.suppliers.get(partyId);
    const bal = isK ? Kar.balance(partyId).balance : Sup.balance(partyId);
    let asgOpts = '';
    if (isK) asgOpts = '<option value="">— عمومی ادائیگی —</option>' + DB.assignments.of('karigarId', partyId).filter(a => a.status !== 'منسوخ').map(a => { const left = a.wage - Kar.paidFor(a); return '<option value="' + a.id + '" data-bal="' + left + '"' + (a.id === assignmentId ? ' selected' : '') + '>' + U.esc(Kar.asgLabel(a)) + ' · باقی ' + U.num(left) + '</option>'; }).join('');
    const ctl = UI.modal({
      title: (isK ? 'کاریگر کو ادائیگی' : 'سپلائر کو ادائیگی') + ': ' + U.esc(rec.name), form: 'payPayout', size: 'sm',
      body: '<input type="hidden" name="party" value="' + party + '"><input type="hidden" name="partyId" value="' + partyId + '"><div class="mb-2">موجودہ بقایا: <b class="text-danger">' + U.rs(bal) + '</b></div><div class="row g-2">' +
        (isK ? UI.field({ label: 'کام کے مطابق (اختیاری)', name: 'assignmentId', type: 'select', html: asgOpts }) : '') +
        UI.field({ label: 'رقم', name: 'amount', type: 'num', req: 1, value: assignmentId ? '' : (bal > 0 ? bal : '') }) + UI.field({ label: 'تاریخ', name: 'date', type: 'date', value: U.today() }) +
        UI.field({ label: 'کیش / بینک', name: 'account', type: 'select', html: Acc.cashOptions() }) + UI.field({ label: 'تفصیل', name: 'note' }) + '</div>', ok: 'ادا کریں'
    });
    ctl.$el.on('change', '[name=assignmentId]', function () { const b = $(this).find(':selected').data('bal'); if (b) ctl.$el.find('[name=amount]').val(b); });
    if (assignmentId) { const a = DB.assignments.get(assignmentId); ctl.$el.find('[name=amount]').val(Math.max(0, a.wage - Kar.paidFor(a))); }
  };
  App.act.payPayout = $b => Pay.payoutModal($b.data('party'), $b.data('id'), $b.data('aid'));
  App.forms.payPayout = ($f, m) => {
    const v = UI.vals($f);
    Pay.create({ party: v.party, partyId: v.partyId, dir: 'out', amount: v.amount, date: v.date, account: v.account, note: v.note, assignmentId: v.assignmentId });
    m.close(); UI.toast('ادائیگی درج ہو گئی'); App.refresh();
  };

  // ---------- page ----------
  function page() {
    App.title('ادائیگی');
    const h = '<div class="d-flex flex-wrap gap-2 mb-3"><button class="btn btn-success" data-act="payReceive">💰 رقم وصول کریں</button><button class="btn btn-outline-success" data-act="payPick" data-p="karigar">کاریگر کو ادائیگی</button><button class="btn btn-outline-success" data-act="payPick" data-p="supplier">سپلائر کو ادائیگی</button></div>' +
      UI.list({
        key: 'pays', keepState: true, placeholder: 'نام، رسید نمبر یا حوالہ', icon: '💰', empty: 'ابھی کوئی ادائیگی درج نہیں',
        filters: [{ name: 'party', opts: [['', 'تمام'], ['customer', 'گاہک'], ['karigar', 'کاریگر'], ['supplier', 'سپلائر']] }, { name: 'dir', opts: [['', 'وصولی + ادائیگی'], ['in', 'وصولی'], ['out', 'ادائیگی']] }],
        items: st => DB.payments.all().filter(p => (!st.f.party || p.party === st.f.party) && (!st.f.dir || p.dir === st.f.dir) && UI.match(st.q, Pay.partyName(p), p.no, p.ref, p.note)).sort((a, b) => b.date < a.date ? -1 : b.date > a.date ? 1 : b.createdAt - a.createdAt),
        row: p => Pay.card(p)
      });
    App.render(h);
  }
  App.route('payments', page);
  App.act.payPick = $b => {
    const party = $b.data('p'), list = party === 'karigar' ? DB.karigars.all() : DB.suppliers.all();
    if (!list.length) return UI.toast(party === 'karigar' ? 'پہلے کاریگر شامل کریں' : 'پہلے سپلائر شامل کریں', 'warning');
    const ctl = UI.modal({ title: party === 'karigar' ? 'کاریگر منتخب کریں' : 'سپلائر منتخب کریں', body: '<div class="vstack gap-2">' + list.map(x => '<div class="item-card" data-id="' + x.id + '">' + U.esc(x.name) + ' <small class="text-muted">' + U.phone(x.mobile) + '</small></div>').join('') + '</div>' });
    ctl.$el.on('click', '.item-card', function () { const id = $(this).data('id'); ctl.close(); setTimeout(() => Pay.payoutModal(party, id), 350); });
  };

  w.Pay = Pay;
})(window);
