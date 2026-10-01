/* purchases.js — purchase & purchase-return documents (stock + supplier payable + accounting) */
(function (w) {
  'use strict';
  const Purch = {};

  Purch.card = function (p) {
    const s = DB.suppliers.get(p.supplierId) || {}, ret = p.type === 'return', paid = U.round(DB.payments.of('purchaseId', p.id).filter(x => !x.voided).reduce((a, x) => a + (x.dir === 'out' ? x.amount : -x.amount), 0));
    return UI.row({
      cls: p.voided ? 'mute' : ret ? 'warn' : '', title: U.code(p.no) + ' · ' + U.esc(s.name) + ' ' + UI.badge(ret ? 'واپسی' : 'خریداری', ret ? 'warning' : 'success') + (p.voided ? ' ' + UI.badge('منسوخ') : ''),
      sub: U.fd(p.date) + (p.billNo ? ' · بل ' + U.esc(p.billNo) : ''), extra: p.items.map(i => U.esc(i.name) + ' ×' + U.num(i.qty)).join('، '),
      right: '<div class="fw-bold">' + U.num(p.total) + '</div>' + (!ret ? '<div class="small ' + (p.total - paid > 0.004 ? 'text-danger' : 'text-success') + '">' + (p.total - paid > 0.004 ? 'بقایا ' + U.num(p.total - paid) : 'ادا شدہ') + '</div>' : ''),
      actions: p.voided ? '' : '<button class="btn btn-sm btn-outline-danger" data-act="purVoid" data-id="' + p.id + '">منسوخ</button>'
    });
  };

  // ---------- form ----------
  function lineRow(it) {
    it = it || {};
    return '<div class="draggable-row pl"><div class="row g-1 align-items-center"><div class="col-12 col-md-5"><select class="form-select form-select-sm pl-item">' + '<option value="">— آئٹم منتخب کریں —</option>' + Inv.itemOptions(it.itemId) + '</select></div>' +
      '<div class="col-4 col-md-2"><input class="form-control form-control-sm pl-qty" inputmode="decimal" placeholder="مقدار" value="' + (it.qty || '') + '"></div><div class="col-4 col-md-2"><input class="form-control form-control-sm pl-rate" inputmode="decimal" placeholder="ریٹ" value="' + (it.rate || '') + '"></div>' +
      '<div class="col-3 col-md-2 fw-bold pl-amt text-center">0</div><div class="col-1"><button type="button" class="btn btn-sm btn-outline-danger" data-act="plDel">×</button></div></div></div>';
  }
  Purch.form = function (kind, sid) {
    const ret = kind === 'return';
    if (!DB.suppliers.count()) return UI.toast('پہلے سپلائر شامل کریں', 'warning');
    if (!DB.inventory.count()) return UI.toast('پہلے اسٹاک میں آئٹم شامل کریں', 'warning');
    const ctl = UI.modal({
      title: ret ? 'خریداری واپسی' : 'نئی خریداری', form: 'purSave', size: 'xl', static: true, noFocus: true,
      body: '<input type="hidden" name="kind" value="' + kind + '"><div class="row g-2 mb-2">' + UI.field({ label: 'سپلائر', name: 'supplierId', type: 'select', req: 1, html: DB.suppliers.all().map(s => '<option value="' + s.id + '"' + (s.id === sid ? ' selected' : '') + '>' + U.esc(s.name) + '</option>').join(''), cls: 'col-12 col-md-4' }) +
        UI.field({ label: 'تاریخ', name: 'date', type: 'date', value: U.today(), cls: 'col-6 col-md-3' }) + UI.field({ label: 'بل نمبر', name: 'billNo', cls: 'col-6 col-md-3' }) + '<div class="col-12 col-md-2 align-self-end"><button type="button" class="btn btn-outline-success w-100" data-act="invNewFromPur">➕ آئٹم</button></div></div>' +
        '<div id="plines">' + lineRow() + '</div><button type="button" class="btn btn-outline-secondary btn-sm mt-1" data-act="plAdd">➕ لائن شامل کریں</button>' +
        '<div class="row g-2 mt-2">' + UI.field({ label: 'رعایت', name: 'discount', type: 'num', cls: 'col-6 col-md-3' }) + '<div class="col-6 col-md-3"><label class="form-label mb-1">کل</label><div class="form-control bg-light fw-bold" id="pTotal">0</div></div>' +
        UI.field({ label: ret ? 'نقد واپس ملا' : 'ادا شدہ', name: 'paid', type: 'num', cls: 'col-6 col-md-3' }) + UI.field({ label: 'کیش / بینک', name: 'account', type: 'select', html: Acc.cashOptions(), cls: 'col-6 col-md-3' }) + UI.field({ label: 'نوٹس', name: 'note' }) + '</div>' +
        '<div class="mt-2 fw-bold" id="pBal"></div>', ok: 'محفوظ کریں'
    });
    const $m = ctl.$el;
    const calc = () => {
      let sub = 0; $m.find('.pl').each(function () { const a = U.n($(this).find('.pl-qty').val()) * U.n($(this).find('.pl-rate').val()); $(this).find('.pl-amt').text(U.num(a)); sub += a; });
      const tot = U.round(sub - Math.min(U.n($m.find('[name=discount]').val()), sub)); $m.find('#pTotal').text(U.num(tot)); $m.find('#pBal').text((ret ? 'سپلائر کے واجبات میں کمی: ' : 'بقایا: ') + U.num(tot - U.n($m.find('[name=paid]').val())));
    };
    $m.on('input', '.pl-qty,.pl-rate,[name=discount],[name=paid]', calc);
    $m.on('change', '.pl-item', function () { const c = $(this).find(':selected').data('cost'); const $r = $(this).closest('.pl').find('.pl-rate'); if (c && !U.n($r.val())) $r.val(c); calc(); });
    $m.on('click', '[data-act=plAdd]', () => $m.find('#plines').append(lineRow()));
    $m.on('click', '[data-act=plDel]', function () { if ($m.find('.pl').length > 1) { $(this).closest('.pl').remove(); calc(); } });
    $m.on('click', '[data-act=invNewFromPur]', () => Inv.itemForm(null, it => { $m.find('.pl-item').each(function () { $(this).html('<option value="">— آئٹم منتخب کریں —</option>' + Inv.itemOptions($(this).val())); }); $m.find('.pl-item').last().val(it.id).trigger('change'); }));
  };
  App.act.purNew = $b => Purch.form('purchase', $b && $b.data('sid'));
  App.act.purReturn = $b => Purch.form('return', $b && $b.data('sid'));
  // these actions are registered as direct handlers in the modal too; stop the global handler from also firing
  App.act.plAdd = App.act.plDel = App.act.invNewFromPur = () => { };

  App.forms.purSave = ($f, m) => {
    const v = UI.vals($f), ret = v.kind === 'return', items = [];
    $f.find('.pl').each(function () { const id = $(this).find('.pl-item').val(), q = U.n($(this).find('.pl-qty').val()), r = U.n($(this).find('.pl-rate').val()); if (id && q > 0) { const it = DB.inventory.get(id); items.push({ itemId: id, name: it.name, qty: q, rate: r, amount: U.round(q * r) }); } });
    if (!items.length) return UI.toast('کم از کم ایک آئٹم درج کریں', 'warning');
    const sub = U.sum(items, i => i.amount), disc = Math.min(U.n(v.discount), sub), total = U.round(sub - disc), paid = U.n(v.paid), f = sub ? (total / sub) : 1;
    if (paid > total + 0.004) return UI.toast('ادا شدہ رقم کل سے زیادہ نہیں ہو سکتی', 'warning');
    if (ret) { const bad = items.find(i => DB.inventory.get(i.itemId).qty < i.qty - 0.0001); if (bad) return UI.toast('اسٹاک کافی نہیں: ' + bad.name, 'danger'); }
    const p = DB.purchases.add({ no: DB.next('purchase'), type: ret ? 'return' : 'purchase', supplierId: v.supplierId, date: v.date, billNo: v.billNo, items, subtotal: sub, discount: disc, total, note: v.note, voided: false, moveIds: [] });
    let stockVal = 0;
    items.forEach(i => {
      const netRate = i.qty ? U.round(i.amount * f / i.qty * 10000) / 10000 : 0;
      if (ret) { const it = DB.inventory.get(i.itemId); stockVal += U.round(i.qty * it.avgCost); p.moveIds.push(Inv.move(i.itemId, 'return', -i.qty, it.avgCost, { date: v.date, ref: { t: 'purchase', id: p.id } }).id); }
      else { stockVal += U.round(i.qty * netRate); p.moveIds.push(Inv.move(i.itemId, 'purchase', i.qty, netRate, { date: v.date, ref: { t: 'purchase', id: p.id } }).id); }
    });
    stockVal = U.round(stockVal);
    let lines;
    if (!ret) lines = [{ a: 'stock', d: total }, { a: 'payableSupplier', c: total }];
    else { lines = [{ a: 'payableSupplier', d: total }, { a: 'stock', c: stockVal }]; const diff = U.round(total - stockVal); if (diff > 0) lines.push({ a: 'expPurchase', c: diff }); else if (diff < 0) lines.push({ a: 'expPurchase', d: -diff }); }
    // for normal purchase stock value equals total (rounding differences go to purchases)
    if (!ret && Math.abs(stockVal - total) > 0.005) { lines = [{ a: 'stock', d: stockVal }, { a: 'payableSupplier', c: total }]; const diff = U.round(total - stockVal); lines.push({ a: 'expPurchase', d: diff }); }
    const t = Acc.post({ date: v.date, type: 'purchase', desc: (ret ? 'خریداری واپسی ' : 'خریداری ') + p.no + ' — ' + Sup.name(v.supplierId), lines, ref: { t: 'purchase', id: p.id }, party: v.supplierId });
    DB.purchases.update(p.id, { txnId: t.id });
    if (paid > 0) Pay.create({ party: 'supplier', partyId: v.supplierId, dir: ret ? 'in' : 'out', amount: paid, date: v.date, account: v.account, purchaseId: p.id, note: ret ? 'واپسی پر نقد وصولی' : 'خریداری پر ادائیگی' });
    DB.log('purchase', (ret ? 'خریداری واپسی ' : 'خریداری ') + p.no + ': ' + U.rs(total));
    m.close(); UI.toast('محفوظ ہو گیا'); App.refresh();
  };
  Purch.void = function (id) {
    const p = DB.purchases.get(id); if (!p || p.voided) return;
    (p.moveIds || []).forEach(mid => { const mv = DB.stockMoves.get(mid); if (mv && !mv.voided) { Inv.move(mv.itemId, 'void', -mv.qty, mv.rate, { note: 'خریداری منسوخ ' + p.no }); DB.stockMoves.update(mid, { voided: true }); } });
    DB.payments.of('purchaseId', id).forEach(x => { if (!x.voided) Pay.void(x.id); });
    if (p.txnId) Acc.void(p.txnId, 'خریداری منسوخ');
    DB.purchases.update(id, { voided: true }); DB.log('void', 'خریداری منسوخ: ' + p.no);
  };
  App.act.purVoid = $b => UI.confirm('یہ دستاویز منسوخ کریں؟ اسٹاک، ادائیگی اور حسابات میں الٹی انٹریاں بنیں گی۔', { danger: true }).then(ok => { if (ok) { Purch.void($b.data('id')); UI.toast('منسوخ ہو گیا'); App.refresh(); } });

  function page() {
    App.title('خریداری');
    App.render('<div class="d-flex flex-wrap gap-2 mb-3"><button class="btn btn-success" data-act="purNew">🛒 نئی خریداری</button><button class="btn btn-outline-secondary" data-act="purReturn">↩ خریداری واپسی</button></div>' + UI.list({
      key: 'pur', keepState: true, placeholder: 'سپلائر، بل نمبر یا آئٹم', icon: '🛒', empty: 'ابھی کوئی خریداری نہیں',
      filters: [{ name: 't', opts: [['', 'تمام'], ['purchase', 'خریداری'], ['return', 'واپسی']] }],
      items: st => DB.purchases.all().filter(p => (!st.f.t || p.type === st.f.t) && UI.match(st.q, Sup.name(p.supplierId), p.billNo, p.no, p.items.map(i => i.name).join(' '))).sort((a, b) => b.date < a.date ? -1 : b.date > a.date ? 1 : b.createdAt - a.createdAt),
      row: Purch.card
    }));
  }
  App.route('purchases', page);

  w.Purch = Purch;
})(window);
