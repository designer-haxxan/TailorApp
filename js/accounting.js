/* accounting.js — double-entry engine, chart of accounts, vouchers, journal, ledger, statements + حسابات pages */
(function (w) {
  'use strict';
  const Acc = {};
  const TYPES = { asset: 'اثاثے', liability: 'واجبات', income: 'آمدن', expense: 'اخراجات', equity: 'سرمایہ' };
  Acc.TYPES = TYPES;
  const CHART = [
    ['cash', '1001', 'کیش', 'asset', 1], ['bank', '1002', 'بینک', 'asset', 1], ['receivable', '1003', 'گاہکوں سے وصولی', 'asset'],
    ['stock', '1004', 'اسٹاک', 'asset'], ['otherAssets', '1005', 'دیگر اثاثے', 'asset'],
    ['payableSupplier', '2001', 'سپلائرز', 'liability'], ['payableKarigar', '2002', 'کاریگروں کی اجرت', 'liability'],
    ['customerAdvance', '2003', 'گاہکوں کی پیشگی', 'liability'], ['otherLiab', '2004', 'دیگر واجبات', 'liability'],
    ['capital', '3001', 'مالک کا سرمایہ', 'equity'], ['drawings', '3002', 'ذاتی نکاسی', 'equity'],
    ['incStitch', '4001', 'سلائی آمدن', 'income'], ['incAlter', '4002', 'آلٹریشن آمدن', 'income'], ['incOther', '4003', 'دیگر آمدن', 'income'],
    ['expRent', '5001', 'کرایہ', 'expense'], ['expElec', '5002', 'بجلی', 'expense'], ['expWater', '5003', 'پانی', 'expense'],
    ['expSalary', '5004', 'تنخواہیں', 'expense'], ['expKarigar', '5005', 'کاریگر اجرت', 'expense'], ['expPurchase', '5006', 'خریداری', 'expense'],
    ['expTransport', '5007', 'ٹرانسپورٹ / سفر', 'expense'], ['expTea', '5008', 'چائے / کھانا', 'expense'], ['expRepair', '5009', 'مرمت', 'expense'],
    ['expMarketing', '5010', 'مارکیٹنگ', 'expense'], ['expOther', '5011', 'دیگر اخراجات', 'expense']
  ];
  const SUBLEDGER = ['receivable', 'payableSupplier', 'payableKarigar', 'customerAdvance', 'stock'];

  DB.seeders.push(function () {
    CHART.forEach(c => DB.accounts.add({ id: 'acc_' + c[0], key: c[0], code: c[1], name: c[2], type: c[3], system: true, cashLike: !!c[4], active: true }));
  });

  Acc.id = function (x) {
    if (!x) return null;
    if (DB.accounts.get(x)) return x;
    const a = DB.accounts.of('key', x)[0]; return a ? a.id : null;
  };
  Acc.get = x => DB.accounts.get(Acc.id(x));
  Acc.name = id => { const a = DB.accounts.get(id); return a ? a.name : '—'; };
  Acc.cashAccounts = () => DB.accounts.filter(a => a.cashLike && a.active !== false);

  // ---------- posting ----------
  Acc.post = function (o) {
    const lines = (o.lines || []).map(l => ({ a: Acc.id(l.a), d: U.round(l.d || 0), c: U.round(l.c || 0) })).filter(l => l.d || l.c);
    if (!lines.length) return null;
    let d = 0, c = 0;
    lines.forEach(l => { if (!l.a) throw new Error('اکاؤنٹ نہیں ملا'); d += l.d; c += l.c; });
    if (Math.abs(d - c) > 0.005) throw new Error('انٹری متوازن نہیں ہے');
    return DB.transactions.add({
      no: DB.next('voucher'), date: o.date || U.today(), type: o.type || 'journal', desc: o.desc || '', lines,
      ref: o.ref || null, key: o.key || null, delta: o.delta == null ? null : o.delta, party: o.party || null, voided: false
    });
  };
  // keep an auto-posted amount in sync: dr/cr accounts used for positive delta (swapped when negative)
  Acc.postDelta = function (key, desired, o) {
    const delta = U.round(U.round(desired) - Acc.sumKey(key));
    if (!delta) return null;
    const amt = Math.abs(delta);
    return Acc.post({
      date: o.date, type: o.type, desc: (delta < 0 ? 'تصحیح: ' : '') + o.desc, ref: o.ref, key, delta, party: o.party,
      lines: delta > 0 ? [{ a: o.dr, d: amt }, { a: o.cr, c: amt }] : [{ a: o.cr, d: amt }, { a: o.dr, c: amt }]
    });
  };
  Acc.void = function (id, reason) {
    const t = DB.transactions.get(id);
    if (!t || t.voided || t.reversalOf) return null;
    const rev = DB.transactions.add({
      no: DB.next('voucher'), date: U.today(), type: 'reversal', desc: 'منسوخی: ' + t.desc + (reason ? ' (' + reason + ')' : ''),
      lines: t.lines.map(l => ({ a: l.a, d: l.c, c: l.d })), ref: t.ref, key: t.key, delta: t.delta == null ? null : -t.delta, party: t.party, voided: false, reversalOf: t.id
    });
    DB.transactions.update(id, { voided: true, reversedBy: rev.id });
    DB.log('void', 'انٹری منسوخ کی گئی: ' + t.no, { t: 'txn', id });
    return rev;
  };

  // ---------- indexes ----------
  let IX = { ver: -1 };
  function build() {
    if (IX.ver === DB.transactions.ver) return IX;
    const acc = new Map(), keys = new Map();
    const txs = DB.transactions.all().slice().sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : a.createdAt - b.createdAt);
    txs.forEach(t => {
      t.lines.forEach(l => { if (!acc.has(l.a)) acc.set(l.a, []); acc.get(l.a).push({ t, d: l.d, c: l.c }); });
      if (t.key && t.delta != null) keys.set(t.key, (keys.get(t.key) || 0) + t.delta);
    });
    IX = { ver: DB.transactions.ver, acc, keys, txs };
    return IX;
  }
  Acc.sumKey = k => U.round(build().keys.get(k) || 0);
  Acc.entries = id => build().acc.get(Acc.id(id)) || [];
  Acc.sign = a => (a.type === 'asset' || a.type === 'expense') ? 1 : -1;
  // natural balance of an account within [from,to]
  Acc.bal = function (id, to, from) {
    id = Acc.id(id); const a = DB.accounts.get(id); if (!a) return 0;
    let n = 0;
    Acc.entries(id).forEach(e => { if ((!to || e.t.date <= to) && (!from || e.t.date >= from)) n += e.d - e.c; });
    return U.round(n * Acc.sign(a));
  };
  Acc.partyBal = function (accKey, party) {
    const id = Acc.id(accKey), a = DB.accounts.get(id); let n = 0;
    Acc.entries(id).forEach(e => { if (e.t.party === party) n += e.d - e.c; });
    return U.round(n * Acc.sign(a));
  };
  Acc.ledger = function (id, from, to) {
    id = Acc.id(id); const a = DB.accounts.get(id), s = Acc.sign(a); let open = 0; const rows = [];
    Acc.entries(id).forEach(e => {
      if (from && e.t.date < from) { open += (e.d - e.c) * s; return; }
      if (to && e.t.date > to) return;
      rows.push(e);
    });
    let run = open; const out = rows.map(e => { run += (e.d - e.c) * s; return { t: e.t, d: e.d, c: e.c, bal: U.round(run) }; });
    return { opening: U.round(open), rows: out, closing: U.round(run), account: a };
  };
  Acc.trial = function (to) {
    return DB.accounts.all().map(a => {
      let net = 0; Acc.entries(a.id).forEach(e => { if (!to || e.t.date <= to) net += e.d - e.c; });
      net = U.round(net); return { a, debit: net > 0 ? net : 0, credit: net < 0 ? -net : 0 };
    }).filter(r => r.debit || r.credit).sort((x, y) => x.a.code < y.a.code ? -1 : 1);
  };
  Acc.pnl = function (from, to) {
    const part = type => DB.accounts.filter(a => a.type === type).map(a => ({ a, v: Acc.bal(a.id, to, from) })).filter(r => r.v);
    const inc = part('income'), exp = part('expense');
    const ti = U.sum(inc, r => r.v), te = U.sum(exp, r => r.v);
    return { inc, exp, totalInc: ti, totalExp: te, net: U.round(ti - te) };
  };
  Acc.bs = function (to) {
    const part = type => DB.accounts.filter(a => a.type === type).map(a => ({ a, v: Acc.bal(a.id, to) })).filter(r => r.v);
    const assets = part('asset'), liab = part('liability'), eq = part('equity');
    const p = Acc.pnl(null, to);
    return { assets, liab, eq, profit: p.net, tA: U.sum(assets, r => r.v), tL: U.sum(liab, r => r.v), tE: U.round(U.sum(eq, r => r.v) + p.net) };
  };
  Acc.cashTotal = () => U.round(Acc.cashAccounts().reduce((s, a) => s + Acc.bal(a.id), 0));

  // vouchers on cash/bank
  Acc.voucher = function (o) { // {kind: 'receipt'|'payment', date, cash, counter, amount, desc, ref}
    const amt = U.n(o.amount); if (amt <= 0) throw new Error('رقم درست نہیں');
    return Acc.post({
      date: o.date, type: 'voucher', desc: o.desc || (o.kind === 'receipt' ? 'وصولی واؤچر' : 'ادائیگی واؤچر'), ref: { t: 'voucher', note: o.ref || '' },
      lines: o.kind === 'receipt' ? [{ a: o.cash, d: amt }, { a: o.counter, c: amt }] : [{ a: o.counter, d: amt }, { a: o.cash, c: amt }]
    });
  };

  Acc.options = function (filter, sel, groupBy) {
    const accs = DB.accounts.filter(a => a.active !== false && (!filter || filter(a))).sort((x, y) => x.code < y.code ? -1 : 1);
    let h = '';
    Object.keys(TYPES).forEach(t => {
      const g = accs.filter(a => a.type === t); if (!g.length) return;
      h += '<optgroup label="' + TYPES[t] + '">' + g.map(a => '<option value="' + a.id + '"' + (a.id === sel ? ' selected' : '') + '>' + U.esc(a.name) + '</option>').join('') + '</optgroup>';
    });
    return h;
  };
  Acc.cashOptions = sel => Acc.cashAccounts().map(a => '<option value="' + a.id + '"' + (a.id === sel || (!sel && a.key === 'cash') ? ' selected' : '') + '>' + U.esc(a.name) + '</option>').join('');

  // ---------- UI ----------
  const TABS = [['summary', 'خلاصہ'], ['txns', 'انٹریاں'], ['ledger', 'جنرل لیجر'], ['chart', 'اکاؤنٹس چارٹ']];

  function page(args) {
    const tab = args[0] || 'summary';
    App.title('حسابات');
    let h = UI.tabs(TABS, tab, 'accounts');
    if (tab === 'summary') h += summary();
    else if (tab === 'txns') h += txns();
    else if (tab === 'ledger') h += ledgerTab();
    else if (tab === 'chart') h += chart();
    App.render(h);
    if (tab === 'ledger') Acc.runLedger();
  }
  function summary() {
    const cash = Acc.cashAccounts();
    const bs = Acc.bs(U.today());
    let h = '<div class="d-flex flex-wrap gap-2 mb-3">' +
      '<button class="btn btn-success" data-act="accVoucher" data-kind="receipt">➕ وصولی واؤچر</button>' +
      '<button class="btn btn-danger" data-act="accVoucher" data-kind="payment">➖ ادائیگی واؤچر</button>' +
      '<button class="btn btn-outline-secondary" data-act="accCapital" data-kind="capital">سرمایہ لگائیں</button>' +
      '<button class="btn btn-outline-secondary" data-act="accCapital" data-kind="drawings">ذاتی نکاسی</button>' +
      '<button class="btn btn-outline-primary" data-act="accJournal">جرنل انٹری</button></div>';
    h += '<div class="row g-2 mb-3">' + cash.map(a => UI.stat(a.name + ' بیلنس', U.rs(Acc.bal(a.id)), Acc.bal(a.id) < 0 ? 'neg' : 'pos')).join('') +
      UI.stat('گاہکوں سے وصولی', U.rs(Acc.bal('receivable'))) + UI.stat('سپلائرز کے واجبات', U.rs(Acc.bal('payableSupplier'))) +
      UI.stat('کاریگروں کے واجبات', U.rs(Acc.bal('payableKarigar'))) + UI.stat('گاہکوں کی پیشگی', U.rs(Acc.bal('customerAdvance'))) +
      UI.stat('اسٹاک کی مالیت', U.rs(Acc.bal('stock'))) + UI.stat('مالک کا سرمایہ', U.rs(bs.tE)) + '</div>';
    h += '<div class="card-box"><h6 class="fw-bold mb-2">حالیہ انٹریاں</h6>' + txnRows(DB.transactions.all().slice().sort((a, b) => b.createdAt - a.createdAt).slice(0, 12)) + '</div>';
    return h;
  }
  function txnRows(list) {
    if (!list.length) return UI.empty('📒', 'ابھی کوئی انٹری نہیں');
    return '<div class="list-group list-group-flush">' + list.map(t => {
      const amt = U.sum(t.lines, l => l.d);
      const canVoid = !t.voided && !t.reversalOf && ['voucher', 'journal', 'capital', 'drawings'].includes(t.type);
      return '<div class="list-group-item px-0"><div class="d-flex justify-content-between gap-2"><div class="min-w-0">' +
        '<div class="fw-bold ' + (t.voided ? 'text-decoration-line-through text-muted' : '') + '">' + U.esc(t.desc || 'انٹری') + '</div>' +
        '<div class="small text-muted">' + U.fd(t.date) + ' · ' + U.code(t.no) + (t.voided ? ' · <span class="badge bg-secondary">منسوخ</span>' : '') + (t.reversalOf ? ' · <span class="badge bg-warning text-dark">منسوخی انٹری</span>' : '') + '</div>' +
        '<div class="small">' + t.lines.map(l => (l.d ? 'ڈیبٹ ' : 'کریڈٹ ') + U.esc(Acc.name(l.a)) + ' ' + U.num(l.d || l.c)).join(' | ') + '</div></div>' +
        '<div class="text-nowrap"><div class="fw-bold">' + U.num(amt) + '</div>' + (canVoid ? '<button class="btn btn-sm btn-outline-danger mt-1" data-act="accVoid" data-id="' + t.id + '">منسوخ</button>' : '') + '</div></div></div>';
    }).join('') + '</div>';
  }
  function txns() {
    return '<div class="card-box">' + UI.list({
      key: 'acctxn', placeholder: 'تفصیل یا واؤچر نمبر تلاش کریں', size: 20,
      items: st => DB.transactions.all().filter(t => !st.q || U.norm(t.desc + ' ' + t.no).includes(U.norm(st.q))).sort((a, b) => b.date < a.date ? -1 : b.date > a.date ? 1 : b.createdAt - a.createdAt),
      renderPage: items => txnRows(items)
    }) + '</div>';
  }
  function ledgerTab() {
    const s = App.state.ledger || (App.state.ledger = { acc: Acc.id('cash'), from: U.monthStart(), to: U.today() });
    return '<div class="card-box mb-3"><div class="row g-2">' +
      '<div class="col-12"><label class="form-label">اکاؤنٹ</label><select class="form-select" id="lgAcc">' + Acc.options(null, s.acc) + '</select></div>' +
      '<div class="col-6"><label class="form-label">از تاریخ</label><input type="date" class="form-control" id="lgFrom" value="' + s.from + '"></div>' +
      '<div class="col-6"><label class="form-label">تا تاریخ</label><input type="date" class="form-control" id="lgTo" value="' + s.to + '"></div></div></div>' +
      '<div class="card-box" id="lgBox"></div>';
  }
  Acc.runLedger = function () {
    const s = App.state.ledger;
    s.acc = $('#lgAcc').val(); s.from = $('#lgFrom').val(); s.to = $('#lgTo').val();
    const L = Acc.ledger(s.acc, s.from, s.to);
    $('#lgBox').html(Reports.tableHtml({
      head: ['تاریخ', 'واؤچر', 'تفصیل', 'ڈیبٹ', 'کریڈٹ', 'بیلنس'], aligns: ['', '', '', 'n', 'n', 'n'],
      rows: [['', '', 'ابتدائی بیلنس', '', '', U.num(L.opening)]].concat(L.rows.map(r => [U.fd(r.t.date), r.t.no, r.t.desc + (r.t.voided ? ' (منسوخ)' : ''), r.d ? U.num(r.d) : '', r.c ? U.num(r.c) : '', U.num(r.bal)])),
      foot: ['', '', 'اختتامی بیلنس', U.num(U.sum(L.rows, r => r.d)), U.num(U.sum(L.rows, r => r.c)), U.num(L.closing)], key: 'lg'
    }));
  };
  function chart() {
    let h = '<div class="d-flex justify-content-between mb-2"><h6 class="fw-bold">اکاؤنٹس چارٹ</h6><button class="btn btn-sm btn-success" data-act="accNew">➕ نیا اکاؤنٹ</button></div>';
    Object.keys(TYPES).forEach(t => {
      const g = DB.accounts.filter(a => a.type === t).sort((x, y) => x.code < y.code ? -1 : 1);
      h += '<div class="card-box mb-2"><div class="fw-bold text-brand mb-1">' + TYPES[t] + '</div>' + g.map(a =>
        '<div class="d-flex justify-content-between align-items-center border-top py-2"><div>' + U.code(a.code) + ' ' + U.esc(a.name) + (a.cashLike ? ' <span class="badge bg-info text-dark">کیش/بینک</span>' : '') + (a.active === false ? ' <span class="badge bg-secondary">غیر فعال</span>' : '') + '</div>' +
        '<div class="text-nowrap"><b>' + U.num(Acc.bal(a.id)) + '</b> <button class="btn btn-sm btn-light" data-act="accEdit" data-id="' + a.id + '">✏️</button></div></div>').join('') + '</div>';
    });
    return h;
  }

  App.route('accounts', page);
  App.act.accVoid = $b => UI.confirm('یہ انٹری منسوخ کریں؟ الٹی انٹری خودکار بن جائے گی۔', { danger: true }).then(ok => { if (ok) { Acc.void($b.data('id')); UI.toast('انٹری منسوخ ہو گئی'); App.refresh(); } });
  App.act.accVoucher = $b => voucherModal($b.data('kind'));
  App.act.accCapital = $b => capitalModal($b.data('kind'));
  App.act.accJournal = () => journalModal();
  App.act.accNew = () => accModal();
  App.act.accEdit = $b => accModal($b.data('id'));
  $(document).on('change', '#lgAcc,#lgFrom,#lgTo', () => Acc.runLedger());
  Acc.voucherModal = voucherModal;

  function voucherModal(kind) {
    const rec = kind === 'receipt';
    UI.modal({
      title: rec ? 'وصولی واؤچر' : 'ادائیگی واؤچر', form: 'accVoucher',
      body: '<input type="hidden" name="kind" value="' + kind + '"><div class="row g-2">' +
        UI.field({ label: 'تاریخ', name: 'date', type: 'date', value: U.today(), req: 1, cls: 'col-6' }) +
        UI.field({ label: 'کیش / بینک', name: 'cash', type: 'select', html: Acc.cashOptions(), cls: 'col-6' }) +
        UI.field({ label: rec ? 'کس مد میں وصول ہوا' : 'کس مد میں ادا کیا', name: 'counter', type: 'select', req: 1, html: Acc.options(a => !SUBLEDGER.includes(a.key) && !a.cashLike), cls: 'col-12' }) +
        UI.field({ label: 'رقم', name: 'amount', type: 'num', req: 1, cls: 'col-6' }) +
        UI.field({ label: 'حوالہ', name: 'ref', cls: 'col-6' }) +
        UI.field({ label: 'تفصیل', name: 'desc', type: 'textarea', rows: 2, cls: 'col-12' }) + '</div>' +
        '<div class="form-text mt-2">گاہک، کاریگر یا سپلائر کی ادائیگی متعلقہ صفحے سے کریں تاکہ ان کا لیجر درست رہے۔</div>',
      ok: 'محفوظ کریں'
    });
  }
  function capitalModal(kind) {
    const cap = kind === 'capital';
    UI.modal({
      title: cap ? 'مالک کا سرمایہ' : 'ذاتی نکاسی', form: 'accCapital',
      body: '<input type="hidden" name="kind" value="' + kind + '"><div class="row g-2">' +
        UI.field({ label: 'تاریخ', name: 'date', type: 'date', value: U.today(), req: 1, cls: 'col-6' }) +
        UI.field({ label: 'کیش / بینک', name: 'cash', type: 'select', html: Acc.cashOptions(), cls: 'col-6' }) +
        UI.field({ label: 'رقم', name: 'amount', type: 'num', req: 1, cls: 'col-12' }) +
        UI.field({ label: 'تفصیل', name: 'desc', cls: 'col-12' }) + '</div>', ok: 'محفوظ کریں'
    });
  }
  App.forms.accVoucher = function ($f, m) {
    const v = UI.vals($f);
    try { Acc.voucher({ kind: v.kind, date: v.date, cash: v.cash, counter: v.counter, amount: v.amount, ref: v.ref, desc: v.desc }); }
    catch (e) { return UI.toast(e.message, 'danger'); }
    DB.log('voucher', (v.kind === 'receipt' ? 'وصولی' : 'ادائیگی') + ' واؤچر: ' + U.rs(v.amount));
    m.close(); UI.toast('واؤچر محفوظ ہو گیا'); App.refresh();
  };
  App.forms.accCapital = function ($f, m) {
    const v = UI.vals($f), amt = U.n(v.amount); if (amt <= 0) return UI.toast('رقم درست نہیں', 'danger');
    const cap = v.kind === 'capital';
    Acc.post({
      date: v.date, type: v.kind, desc: v.desc || (cap ? 'مالک کا سرمایہ' : 'ذاتی نکاسی'),
      lines: cap ? [{ a: v.cash, d: amt }, { a: 'capital', c: amt }] : [{ a: 'drawings', d: amt }, { a: v.cash, c: amt }]
    });
    DB.log(v.kind, (cap ? 'سرمایہ: ' : 'ذاتی نکاسی: ') + U.rs(amt)); m.close(); UI.toast('محفوظ ہو گیا'); App.refresh();
  };

  function journalModal() {
    const row = () => '<div class="row g-1 mb-1 jr"><div class="col-12 col-md-6"><select class="form-select form-select-sm j-a">' + Acc.options() + '</select></div>' +
      '<div class="col-6 col-md-3"><input class="form-control form-control-sm j-d" inputmode="decimal" placeholder="ڈیبٹ"></div>' +
      '<div class="col-6 col-md-3"><input class="form-control form-control-sm j-c" inputmode="decimal" placeholder="کریڈٹ"></div></div>';
    UI.modal({
      title: 'جرنل انٹری', form: 'accJournal', size: 'lg',
      body: '<div class="row g-2 mb-2">' + UI.field({ label: 'تاریخ', name: 'date', type: 'date', value: U.today(), req: 1, cls: 'col-5' }) + UI.field({ label: 'تفصیل', name: 'desc', req: 1, cls: 'col-7' }) + '</div>' +
        '<div id="jrows">' + row() + row() + '</div><button type="button" class="btn btn-sm btn-outline-secondary" id="jAdd">+ لائن</button>' +
        '<div class="mt-2 fw-bold" id="jDiff"></div>',
      ok: 'محفوظ کریں',
      onShown: $m => {
        $m.on('click', '#jAdd', () => $m.find('#jrows').append(row()));
        $m.on('input', '.j-d,.j-c', () => { let d = 0, c = 0; $m.find('.jr').each(function () { d += U.n($(this).find('.j-d').val()); c += U.n($(this).find('.j-c').val()); }); $m.find('#jDiff').text('ڈیبٹ ' + U.num(d) + ' | کریڈٹ ' + U.num(c) + (Math.abs(d - c) < 0.005 ? ' ✔ متوازن' : ' ✖ فرق ' + U.num(d - c))); });
      }
    });
  }
  App.forms.accJournal = function ($f, m) {
    const v = UI.vals($f), lines = [];
    $f.find('.jr').each(function () { const d = U.n($(this).find('.j-d').val()), c = U.n($(this).find('.j-c').val()); if (d || c) lines.push({ a: $(this).find('.j-a').val(), d, c }); });
    if (lines.length < 2) return UI.toast('کم از کم دو لائنیں درکار ہیں', 'danger');
    try { Acc.post({ date: v.date, type: 'journal', desc: v.desc, lines }); } catch (e) { return UI.toast(e.message, 'danger'); }
    DB.log('journal', 'جرنل انٹری: ' + v.desc); m.close(); UI.toast('جرنل انٹری محفوظ ہو گئی'); App.refresh();
  };
  function accModal(id) {
    const a = id ? DB.accounts.get(id) : { type: 'expense', active: true };
    UI.modal({
      title: id ? 'اکاؤنٹ میں ترمیم' : 'نیا اکاؤنٹ', form: 'accSave',
      body: '<input type="hidden" name="id" value="' + (id || '') + '"><div class="row g-2">' +
        UI.field({ label: 'اکاؤنٹ کا نام', name: 'name', value: a.name, req: 1, cls: 'col-12' }) +
        UI.field({ label: 'قسم', name: 'type', type: 'select', html: Object.keys(TYPES).map(t => '<option value="' + t + '"' + (a.type === t ? ' selected' : '') + '>' + TYPES[t] + '</option>').join(''), attrs: id ? 'disabled' : '', cls: 'col-6' }) +
        UI.field({ label: 'کوڈ', name: 'code', value: a.code || '', cls: 'col-6' }) +
        '<div class="col-12"><label class="form-check"><input type="checkbox" class="form-check-input" name="cashLike" ' + (a.cashLike ? 'checked' : '') + ' ' + (a.system ? 'disabled' : '') + '> <span class="form-check-label">کیش/بینک کی طرح استعمال کریں (صرف اثاثے)</span></label></div>' +
        '<div class="col-12"><label class="form-check"><input type="checkbox" class="form-check-input" name="active" ' + (a.active !== false ? 'checked' : '') + '> <span class="form-check-label">فعال</span></label></div></div>' +
        (id && !a.system && !Acc.entries(id).length ? '<button type="button" class="btn btn-outline-danger mt-3" data-act="accDel" data-id="' + id + '">اکاؤنٹ حذف کریں</button>' : ''),
      ok: 'محفوظ کریں'
    });
  }
  App.act.accDel = $b => UI.confirm('یہ اکاؤنٹ حذف کریں؟', { danger: true }).then(ok => { if (ok) { DB.accounts.remove($b.data('id')); UI.closeAll(); UI.toast('حذف ہو گیا'); App.refresh(); } });
  App.forms.accSave = function ($f, m) {
    const v = UI.vals($f);
    if (v.id) { DB.accounts.update(v.id, { name: v.name, code: v.code, active: !!v.active, cashLike: DB.accounts.get(v.id).system ? DB.accounts.get(v.id).cashLike : !!v.cashLike && DB.accounts.get(v.id).type === 'asset' }); }
    else {
      const t = v.type, base = { asset: 1100, liability: 2100, equity: 3100, income: 4100, expense: 5100 }[t];
      const code = v.code || String(base + DB.accounts.filter(a => a.type === t && !a.system).length + 1);
      DB.accounts.add({ name: v.name, type: t, code, system: false, cashLike: t === 'asset' && !!v.cashLike, active: true });
    }
    m.close(); UI.toast('اکاؤنٹ محفوظ ہو گیا'); App.refresh();
  };

  w.Acc = Acc;
})(window);
