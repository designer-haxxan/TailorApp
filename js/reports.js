/* reports.js — Urdu reports with date filters, paging, print and CSV export */
(function (w) {
  'use strict';
  const Reports = { T: {} };
  const PAGE = 40;

  // ---------- paged table ----------
  Reports.tableHtml = function (o) {
    const key = o.key || ('t' + Math.random().toString(36).slice(2, 6));
    Reports.T[key] = o; o.page = 1;
    return '<div class="rt" data-key="' + key + '">' + Reports.tblInner(key) + '</div>';
  };
  Reports.tblInner = function (key) {
    const o = Reports.T[key], rows = o.rows, pages = Math.max(1, Math.ceil(rows.length / PAGE)), pg = Math.min(o.page, pages), al = o.aligns || [];
    const slice = rows.slice((pg - 1) * PAGE, pg * PAGE);
    if (!rows.length && !o.foot) return UI.empty('📄', 'اس مدت میں کوئی ریکارڈ نہیں');
    let h = '<div class="rt-wrap"><table class="table table-sm table-striped align-middle"><thead><tr>' + o.head.map((x, i) => '<th class="' + (al[i] || '') + '">' + U.esc(x) + '</th>').join('') + '</tr></thead><tbody>' +
      slice.map(r => '<tr' + (r._b ? ' class="fw-bold table-light"' : '') + '>' + r.map((c, i) => '<td class="' + (al[i] || '') + '">' + (o.html ? c : U.esc(c == null ? '' : c)) + '</td>').join('') + '</tr>').join('') + '</tbody>' +
      (o.foot && pg === pages ? '<tfoot><tr>' + o.foot.map((c, i) => '<th class="' + (al[i] || '') + '">' + U.esc(c) + '</th>').join('') + '</tr></tfoot>' : '') + '</table></div>';
    if (pages > 1) h += '<div class="d-flex justify-content-between align-items-center mt-2"><button class="btn btn-sm btn-outline-secondary" data-act="tblPage" data-key="' + key + '" data-p="' + (pg + 1) + '" ' + (pg >= pages ? 'disabled' : '') + '>« اگلا</button><span class="small text-muted">صفحہ ' + pg + ' از ' + pages + ' · ' + rows.length + ' قطاریں</span><button class="btn btn-sm btn-outline-secondary" data-act="tblPage" data-key="' + key + '" data-p="' + (pg - 1) + '" ' + (pg <= 1 ? 'disabled' : '') + '>پچھلا »</button></div>';
    return h;
  };
  App.act.tblPage = $b => { const k = $b.data('key'); Reports.T[k].page = +$b.data('p'); $('.rt[data-key=' + k + ']').html(Reports.tblInner(k)); };

  // ---------- helpers ----------
  const cn = id => Cust.name(id);
  const ordRows = list => list.map(o => [o.no, U.fd(o.date), cn(o.customerId), (DB.customers.get(o.customerId) || {}).mobile || '', Ord.active(o.id).map(g => g.typeName + '×' + U.num(g.qty)).join('، '), U.fd(o.dueDate), o.status, U.num(o.total), U.num(Math.max(0, Ord.balance(o)))]);
  const ordHead = ['آرڈر', 'تاریخ', 'گاہک', 'موبائل', 'گارمنٹس', 'ڈیلیوری', 'حالت', 'بل', 'بقایا'], ordAl = ['', '', '', '', '', '', '', 'n', 'n'];
  const ordRes = list => ({ head: ordHead, aligns: ordAl, rows: ordRows(list), foot: ['', '', 'کل ' + list.length, '', '', '', '', U.num(U.sum(list, o => o.total)), U.num(U.sum(list, o => Math.max(0, Ord.balance(o))))] });
  const byDate = (arr, f) => arr.slice().sort((a, b) => f(a) < f(b) ? -1 : 1);
  const kOpts = () => [['', 'تمام کاریگر']].concat(DB.karigars.all().map(k => [k.id, k.name]));
  const sOpts = () => [['', 'تمام سپلائر']].concat(DB.suppliers.all().map(s => [s.id, s.name]));

  function ledgerRes(entries, from, to, openLabel, d1, d2, balNeg) {
    // entries sorted with running 'bal'; compute opening before 'from'
    let open = 0; const inr = [];
    entries.forEach(e => { if (from && e.date < from) open = e.bal; else if (!to || e.date <= to) inr.push(e); });
    const out = [['', 'ابتدائی بیلنس', '', '', U.num(open)]]; out[0]._b = 1;
    inr.forEach(e => out.push([U.fd(e.date), e.desc, e[d1] ? U.num(e[d1]) : '', e[d2] ? U.num(e[d2]) : '', U.num(e.bal)]));
    const last = inr.length ? inr[inr.length - 1].bal : open;
    return { rows: out, foot: ['', 'اختتامی بیلنس', U.num(U.sum(inr, e => e[d1])), U.num(U.sum(inr, e => e[d2])), U.num(last)] };
  }

  const R = [
    // ---- orders
    { id: 'ord_today', g: 'آرڈر رپورٹس', t: 'آج کے آرڈر', p: [], run: () => ordRes(DB.orders.all().filter(o => o.date === U.today())) },
    { id: 'ord_date', g: 'آرڈر رپورٹس', t: 'تاریخ وار آرڈر', p: ['range'], run: p => ordRes(byDate(DB.orders.all().filter(o => U.inRange(o.date, p.from, p.to)), o => o.date)) },
    { id: 'ord_stitch', g: 'آرڈر رپورٹس', t: 'زیرِ سلائی آرڈر', p: [], run: () => ordRes(DB.orders.all().filter(o => o.status !== 'منسوخ' && Ord.active(o.id).some(g => ['کاریگر کو دیا', 'زیرِ سلائی', 'چیکنگ', 'آلٹریشن'].includes(g.status)))) },
    { id: 'ord_ready', g: 'آرڈر رپورٹس', t: 'تیار آرڈر', p: [], run: () => ordRes(DB.orders.all().filter(o => Ord.active(o.id).some(g => Garm.READY.includes(g.status)) && o.status !== 'ڈیلیور')) },
    { id: 'ord_deliv', g: 'آرڈر رپورٹس', t: 'ڈیلیور شدہ آرڈر', p: ['range'], run: p => ordRes(DB.orders.all().filter(o => o.status === 'ڈیلیور' && U.inRange(U.ymd(new Date(o.deliveredAt || o.createdAt)), p.from, p.to))) },
    { id: 'ord_late', g: 'آرڈر رپورٹس', t: 'تاخیر شدہ آرڈر', p: [], run: () => ordRes(byDate(DB.orders.all().filter(Ord.isLate), o => o.dueDate)) },
    { id: 'ord_cancel', g: 'آرڈر رپورٹس', t: 'منسوخ آرڈر', p: ['range'], run: p => ordRes(DB.orders.all().filter(o => o.status === 'منسوخ' && U.inRange(o.date, p.from, p.to))) },
    // ---- customers
    {
      id: 'cust_statement', g: 'گاہک', t: 'گاہک اسٹیٹمنٹ', p: ['cust', 'range'], run: p => {
        if (!p.cust) return { head: ['پیغام'], rows: [['براہِ کرم گاہک منتخب کریں']], aligns: [] }; const L = Cust.ledger(p.cust), r = ledgerRes(L, p.from, p.to, '', 'dr', 'cr');
        return { head: ['تاریخ', 'تفصیل', 'بل', 'وصولی', 'بیلنس'], aligns: ['', '', 'n', 'n', 'n'], rows: r.rows, foot: r.foot, meta: 'گاہک: ' + cn(p.cust) };
      }
    },
    {
      id: 'cust_due', g: 'گاہک', t: 'گاہکوں کا بقایا', p: [], run: () => {
        const rows = DB.customers.all().map(c => ({ c, s: Cust.summary(c.id) })).filter(x => x.s.bal > 0.004).sort((a, b) => b.s.bal - a.s.bal);
        return { head: ['گاہک', 'موبائل', 'کل بل', 'وصول شدہ', 'بقایا'], aligns: ['', '', 'n', 'n', 'n'], rows: rows.map(x => [x.c.name, x.c.mobile || '', U.num(x.s.bill), U.num(x.s.paid), U.num(x.s.bal)]), foot: ['کل ' + rows.length, '', U.num(U.sum(rows, x => x.s.bill)), U.num(U.sum(rows, x => x.s.paid)), U.num(U.sum(rows, x => x.s.bal))] };
      }
    },
    { id: 'cust_orders', g: 'گاہک', t: 'گاہک آرڈر ہسٹری', p: ['cust'], run: p => p.cust ? ordRes(DB.orders.of('customerId', p.cust).slice().sort((a, b) => a.createdAt - b.createdAt)) : { head: ['پیغام'], rows: [['براہِ کرم گاہک منتخب کریں']], aligns: [] } },
    // ---- karigar
    { id: 'kar_work', g: 'کاریگر', t: 'کاریگر کا کام', p: ['range', 'kar'], run: p => asgRes(DB.assignments.all().filter(a => U.inRange(a.givenDate, p.from, p.to) && (!p.kar || a.karigarId === p.kar))) },
    { id: 'kar_done', g: 'کاریگر', t: 'مکمل کام', p: ['range', 'kar'], run: p => asgRes(DB.assignments.all().filter(a => a.status === 'مکمل' && U.inRange(a.doneDate, p.from, p.to) && (!p.kar || a.karigarId === p.kar))) },
    { id: 'kar_open', g: 'کاریگر', t: 'زیرِ کام', p: ['kar'], run: p => asgRes(DB.assignments.all().filter(a => ['کام دیا گیا', 'زیرِ سلائی', 'دوبارہ کام'].includes(a.status) && (!p.kar || a.karigarId === p.kar))) },
    {
      id: 'kar_wages', g: 'کاریگر', t: 'اجرت کا خلاصہ', p: ['range'], run: p => {
        const rows = DB.karigars.all().map(k => { const as = DB.assignments.of('karigarId', k.id).filter(a => a.status !== 'منسوخ' && U.inRange(a.givenDate, p.from, p.to)); return [k.name, as.length, U.num(U.sum(as, a => a.qty)), U.num(U.sum(as, a => a.wage)), U.num(U.sum(as.filter(a => a.status === 'مکمل'), a => a.wage))]; });
        return { head: ['کاریگر', 'کام', 'پیس', 'کل اجرت', 'مکمل کام کی اجرت'], aligns: ['', 'n', 'n', 'n', 'n'], rows };
      }
    },
    {
      id: 'kar_pay', g: 'کاریگر', t: 'کاریگر ادائیگیاں', p: ['range', 'kar'], run: p => {
        const ps = DB.payments.all().filter(x => x.party === 'karigar' && !x.voided && U.inRange(x.date, p.from, p.to) && (!p.kar || x.partyId === p.kar)).sort((a, b) => a.date < b.date ? -1 : 1);
        return { head: ['تاریخ', 'رسید', 'کاریگر', 'ذریعہ', 'رقم'], aligns: ['', '', '', '', 'n'], rows: ps.map(x => [U.fd(x.date), x.no, Pay.partyName(x), Acc.name(x.account), U.num(x.dir === 'out' ? x.amount : -x.amount)]), foot: ['', '', 'کل', '', U.num(U.sum(ps, x => x.dir === 'out' ? x.amount : -x.amount))] };
      }
    },
    {
      id: 'kar_balance', g: 'کاریگر', t: 'کاریگر بقایا / اسٹیٹمنٹ', p: ['kar', 'range'], run: p => {
        if (p.kar) { const r = ledgerRes(Kar.ledger(p.kar).map(e => Object.assign({}, e)), p.from, p.to, '', 'dr', 'cr'); return { head: ['تاریخ', 'تفصیل', 'ادائیگی', 'اجرت', 'بقایا'], aligns: ['', '', 'n', 'n', 'n'], rows: r.rows, foot: r.foot, meta: 'کاریگر: ' + Kar.name(p.kar) }; }
        const rows = DB.karigars.all().map(k => ({ k, b: Kar.balance(k.id) })); return { head: ['کاریگر', 'مکمل کام کی اجرت', 'ادا شدہ', 'بقایا'], aligns: ['', 'n', 'n', 'n'], rows: rows.map(x => [x.k.name, U.num(x.b.earned), U.num(x.b.paid), U.num(x.b.balance)]), foot: ['کل', U.num(U.sum(rows, x => x.b.earned)), U.num(U.sum(rows, x => x.b.paid)), U.num(U.sum(rows, x => x.b.balance))] };
      }
    },
    // ---- suppliers
    {
      id: 'sup_statement', g: 'سپلائر', t: 'سپلائر اسٹیٹمنٹ', p: ['sup', 'range'], run: p => {
        if (!p.sup) return { head: ['پیغام'], rows: [['براہِ کرم سپلائر منتخب کریں']], aligns: [] }; const r = ledgerRes(Sup.ledger(p.sup), p.from, p.to, '', 'dr', 'cr');
        return { head: ['تاریخ', 'تفصیل', 'ادائیگی/واپسی', 'خریداری', 'بقایا'], aligns: ['', '', 'n', 'n', 'n'], rows: r.rows, foot: r.foot, meta: 'سپلائر: ' + Sup.name(p.sup) };
      }
    },
    { id: 'sup_balance', g: 'سپلائر', t: 'سپلائرز کا بقایا', p: [], run: () => { const rows = DB.suppliers.all().map(s => ({ s, m: Sup.summary(s.id) })); return { head: ['سپلائر', 'موبائل', 'خریداری', 'واپسی', 'ادا شدہ', 'بقایا'], aligns: ['', '', 'n', 'n', 'n', 'n'], rows: rows.map(x => [x.s.name, x.s.mobile || '', U.num(x.m.buy), U.num(x.m.ret), U.num(x.m.paid), U.num(x.m.bal)]), foot: ['کل', '', U.num(U.sum(rows, x => x.m.buy)), U.num(U.sum(rows, x => x.m.ret)), U.num(U.sum(rows, x => x.m.paid)), U.num(U.sum(rows, x => x.m.bal))] }; } },
    {
      id: 'sup_purchases', g: 'سپلائر', t: 'خریداری رپورٹ', p: ['range', 'sup'], run: p => {
        const ps = DB.purchases.all().filter(x => !x.voided && U.inRange(x.date, p.from, p.to) && (!p.sup || x.supplierId === p.sup)).sort((a, b) => a.date < b.date ? -1 : 1);
        return { head: ['تاریخ', 'نمبر', 'سپلائر', 'قسم', 'آئٹمز', 'رقم'], aligns: ['', '', '', '', '', 'n'], rows: ps.map(x => [U.fd(x.date), x.no, Sup.name(x.supplierId), x.type === 'return' ? 'واپسی' : 'خریداری', x.items.map(i => i.name + '×' + U.num(i.qty)).join('، '), U.num(x.total)]), foot: ['', '', '', '', 'کل خریداری − واپسی', U.num(U.sum(ps, x => x.type === 'return' ? -x.total : x.total))] };
      }
    },
    // ---- accounting
    { id: 'cashbook', g: 'اکاؤنٹنگ', t: 'کیش بک', p: ['range', 'acct:cash'], run: p => bookRes(p, 'cash') },
    { id: 'bankbook', g: 'اکاؤنٹنگ', t: 'بینک بک', p: ['range', 'acct:bank'], run: p => bookRes(p, 'bank') },
    {
      id: 'gl', g: 'اکاؤنٹنگ', t: 'جنرل لیجر', p: ['range', 'acct:cash'], run: p => {
        const L = Acc.ledger(p.acct, p.from, p.to);
        return { head: ['تاریخ', 'واؤچر', 'تفصیل', 'ڈیبٹ', 'کریڈٹ', 'بیلنس'], aligns: ['', '', '', 'n', 'n', 'n'], rows: [Object.assign(['', '', 'ابتدائی بیلنس', '', '', U.num(L.opening)], { _b: 1 })].concat(L.rows.map(r => [U.fd(r.t.date), r.t.no, r.t.desc + (r.t.voided ? ' (منسوخ)' : ''), r.d ? U.num(r.d) : '', r.c ? U.num(r.c) : '', U.num(r.bal)])), foot: ['', '', 'اختتامی بیلنس', U.num(U.sum(L.rows, r => r.d)), U.num(U.sum(L.rows, r => r.c)), U.num(L.closing)], meta: 'اکاؤنٹ: ' + L.account.name };
      }
    },
    {
      id: 'trial', g: 'اکاؤنٹنگ', t: 'ٹرائل بیلنس', p: ['asof'], run: p => {
        const tb = Acc.trial(p.to); return { head: ['کوڈ', 'اکاؤنٹ', 'قسم', 'ڈیبٹ', 'کریڈٹ'], aligns: ['', '', '', 'n', 'n'], rows: tb.map(r => [r.a.code, r.a.name, Acc.TYPES[r.a.type], r.debit ? U.num(r.debit) : '', r.credit ? U.num(r.credit) : '']), foot: ['', 'کل', '', U.num(U.sum(tb, r => r.debit)), U.num(U.sum(tb, r => r.credit))], meta: 'تاریخ تک: ' + U.fd(p.to) };
      }
    },
    {
      id: 'pnl', g: 'اکاؤنٹنگ', t: 'منافع و نقصان', p: ['range'], run: p => {
        const x = Acc.pnl(p.from, p.to), rows = [Object.assign(['آمدن', ''], { _b: 1 })].concat(x.inc.map(r => ['   ' + r.a.name, U.num(r.v)]), [Object.assign(['کل آمدن', U.num(x.totalInc)], { _b: 1 }), Object.assign(['اخراجات', ''], { _b: 1 })], x.exp.map(r => ['   ' + r.a.name, U.num(r.v)]), [Object.assign(['کل اخراجات', U.num(x.totalExp)], { _b: 1 })]);
        return { head: ['مد', 'رقم'], aligns: ['', 'n'], rows, foot: [x.net >= 0 ? 'خالص منافع' : 'خالص نقصان', U.num(Math.abs(x.net))], summary: [['کل آمدن', U.rs(x.totalInc)], ['کل اخراجات', U.rs(x.totalExp)], [x.net >= 0 ? 'خالص منافع' : 'خالص نقصان', U.rs(Math.abs(x.net))]] };
      }
    },
    {
      id: 'bs', g: 'اکاؤنٹنگ', t: 'بیلنس شیٹ', p: ['asof'], run: p => {
        const b = Acc.bs(p.to), sec = (t, l, tot) => [Object.assign([t, ''], { _b: 1 })].concat(l.map(r => ['   ' + r.a.name, U.num(r.v)]), [Object.assign(['کل ' + t, U.num(tot)], { _b: 1 })]);
        const rows = sec('اثاثے', b.assets, b.tA).concat(sec('واجبات', b.liab, b.tL), [Object.assign(['سرمایہ', ''], { _b: 1 })], b.eq.map(r => ['   ' + r.a.name, U.num(r.v)]), [['   منافع / نقصان (موجودہ)', U.num(b.profit)], Object.assign(['کل سرمایہ', U.num(b.tE)], { _b: 1 })]);
        return { head: ['مد', 'رقم'], aligns: ['', 'n'], rows, foot: ['واجبات + سرمایہ', U.num(b.tL + b.tE)], meta: 'تاریخ تک: ' + U.fd(p.to), summary: [['کل اثاثے', U.rs(b.tA)], ['واجبات + سرمایہ', U.rs(b.tL + b.tE)], [Math.abs(b.tA - b.tL - b.tE) < 0.01 ? 'توازن درست ✔' : 'فرق', U.rs(b.tA - b.tL - b.tE)]] };
      }
    },
    { id: 'income', g: 'اکاؤنٹنگ', t: 'آمدن', p: ['range'], run: p => { const x = Acc.pnl(p.from, p.to); return { head: ['آمدن کی مد', 'رقم'], aligns: ['', 'n'], rows: x.inc.map(r => [r.a.name, U.num(r.v)]), foot: ['کل', U.num(x.totalInc)] }; } },
    { id: 'expenses', g: 'اکاؤنٹنگ', t: 'اخراجات', p: ['range'], run: p => { const x = Acc.pnl(p.from, p.to); return { head: ['خرچ کی مد', 'رقم'], aligns: ['', 'n'], rows: x.exp.map(r => [r.a.name, U.num(r.v)]), foot: ['کل', U.num(x.totalExp)] }; } },
    {
      id: 'receipts', g: 'اکاؤنٹنگ', t: 'وصولیاں', p: ['range'], run: p => {
        const ps = DB.payments.all().filter(x => x.party === 'customer' && !x.voided && U.inRange(x.date, p.from, p.to)).sort((a, b) => a.date < b.date ? -1 : 1), sg = x => x.dir === 'in' ? x.amount : -x.amount;
        return { head: ['تاریخ', 'رسید', 'گاہک', 'آرڈر', 'ذریعہ', 'رقم'], aligns: ['', '', '', '', '', 'n'], rows: ps.map(x => [U.fd(x.date), x.no, Pay.partyName(x), x.orderId ? (DB.orders.get(x.orderId) || {}).no : '', Acc.name(x.account), U.num(sg(x))]), foot: ['', '', '', '', 'کل وصولی', U.num(U.sum(ps, sg))] };
      }
    },
    { id: 'liab', g: 'اکاؤنٹنگ', t: 'واجبات', p: ['asof'], run: p => { const l = DB.accounts.filter(a => a.type === 'liability').map(a => [a.name, U.num(Acc.bal(a.id, p.to))]); const tot = U.sum(DB.accounts.filter(a => a.type === 'liability'), a => Acc.bal(a.id, p.to)); return { head: ['واجب', 'رقم'], aligns: ['', 'n'], rows: l, foot: ['کل', U.num(tot)] }; } },
    // ---- stock
    { id: 'stk', g: 'اسٹاک', t: 'موجودہ اسٹاک', p: [], run: () => { const it = DB.inventory.all().slice().sort((a, b) => a.name < b.name ? -1 : 1); return { head: ['آئٹم', 'زمرہ', 'مقدار', 'یونٹ', 'اوسط لاگت', 'مالیت'], aligns: ['', '', 'n', '', 'n', 'n'], rows: it.map(i => [i.name + (Inv.isLow(i) ? ' ⚠' : ''), i.category, U.num(i.qty), i.unit, U.num(i.avgCost), U.num(i.qty * i.avgCost)]), foot: ['کل', '', '', '', '', U.num(Inv.value())] }; } },
    { id: 'stk_pur', g: 'اسٹاک', t: 'اسٹاک خریداری', p: ['range'], run: p => stockMoves(p, ['purchase', 'return', 'opening']) },
    { id: 'stk_use', g: 'اسٹاک', t: 'اسٹاک استعمال', p: ['range'], run: p => stockMoves(p, ['consume', 'adjust']) },
    { id: 'stk_low', g: 'اسٹاک', t: 'کم اسٹاک', p: [], run: () => { const it = DB.inventory.filter(Inv.isLow); return { head: ['آئٹم', 'موجود', 'یونٹ', 'کم از کم حد'], aligns: ['', 'n', '', 'n'], rows: it.map(i => [i.name, U.num(i.qty), i.unit, U.num(i.reorder)]) }; } }
  ];
  function asgRes(list) {
    list = list.slice().sort((a, b) => a.givenDate < b.givenDate ? -1 : 1);
    return { head: ['تاریخ', 'کاریگر', 'آرڈر / گارمنٹ', 'تعداد', 'اجرت', 'ادا', 'حالت'], aligns: ['', '', '', 'n', 'n', 'n', ''], rows: list.map(a => [U.fd(a.givenDate), Kar.name(a.karigarId), Kar.asgLabel(a), U.num(a.qty), U.num(a.wage), U.num(Kar.paidFor(a)), a.status]), foot: ['', 'کل ' + list.length, '', U.num(U.sum(list, a => a.qty)), U.num(U.sum(list, a => a.wage)), U.num(U.sum(list, a => Kar.paidFor(a))), ''] };
  }
  function stockMoves(p, types) {
    const mv = DB.stockMoves.all().filter(x => types.includes(x.type) && !x.voided && U.inRange(x.date, p.from, p.to)).sort((a, b) => a.date < b.date ? -1 : 1);
    return { head: ['تاریخ', 'آئٹم', 'قسم', 'مقدار', 'ریٹ', 'مالیت'], aligns: ['', '', '', 'n', 'n', 'n'], rows: mv.map(x => { const it = DB.inventory.get(x.itemId) || {}; return [U.fd(x.date), it.name, Inv.MT[x.type], U.num(x.qty) + ' ' + (it.unit || ''), U.num(x.rate), U.num(Math.abs(x.qty) * x.rate)]; }), foot: ['', '', 'کل مالیت', '', '', U.num(U.sum(mv, x => Math.abs(x.qty) * x.rate))] };
  }
  function bookRes(p, def) {
    const acct = p.acct || Acc.id(def), L = Acc.ledger(acct, p.from, p.to);
    return { head: ['تاریخ', 'تفصیل', 'وصولیاں', 'ادائیگیاں', 'بیلنس'], aligns: ['', '', 'n', 'n', 'n'], rows: [Object.assign(['', 'ابتدائی بیلنس', '', '', U.num(L.opening)], { _b: 1 })].concat(L.rows.map(r => [U.fd(r.t.date), r.t.desc + (r.t.voided ? ' (منسوخ)' : ''), r.d ? U.num(r.d) : '', r.c ? U.num(r.c) : '', U.num(r.bal)])), foot: ['', 'اختتامی بیلنس', U.num(U.sum(L.rows, r => r.d)), U.num(U.sum(L.rows, r => r.c)), U.num(L.closing)], meta: 'اکاؤنٹ: ' + L.account.name, summary: [['ابتدائی بیلنس', U.rs(L.opening)], ['وصولیاں', U.rs(U.sum(L.rows, r => r.d))], ['ادائیگیاں', U.rs(U.sum(L.rows, r => r.c))], ['اختتامی بیلنس', U.rs(L.closing)]] };
  }
  Reports.list = R;
  const find = id => R.find(r => r.id === id);

  // ---------- pages ----------
  function state(id) {
    const S = App.state.rep || (App.state.rep = {});
    if (!S[id]) { const r = find(id); S[id] = { from: U.monthStart(), to: U.today(), cust: '', kar: '', sup: '', acct: '' }; (r.p || []).forEach(x => { if (x.startsWith('acct:')) S[id].acct = Acc.id(x.slice(5)); }); }
    return S[id];
  }
  function paramHtml(r, s) {
    let h = '<div class="card-box mb-3"><div class="row g-2">';
    (r.p || []).forEach(x => {
      const k = x.split(':')[0];
      if (k === 'range') h += UI.field({ label: 'از تاریخ', type: 'raw', html: '<input type="date" class="form-control rp" data-k="from" value="' + s.from + '">', cls: 'col-6 col-md-3' }) + UI.field({ label: 'تا تاریخ', type: 'raw', html: '<input type="date" class="form-control rp" data-k="to" value="' + s.to + '">', cls: 'col-6 col-md-3' });
      else if (k === 'asof') h += UI.field({ label: 'تاریخ تک', type: 'raw', html: '<input type="date" class="form-control rp" data-k="to" value="' + s.to + '">', cls: 'col-6 col-md-3' });
      else if (k === 'cust') h += UI.field({ label: 'گاہک', type: 'raw', html: UI.picker('cust', 'customer', s.cust, { add: false }), cls: 'col-12 col-md-6' });
      else if (k === 'kar') h += UI.field({ label: 'کاریگر', type: 'raw', html: '<select class="form-select rp" data-k="kar">' + UI.opts(kOpts(), s.kar) + '</select>', cls: 'col-6 col-md-3' });
      else if (k === 'sup') h += UI.field({ label: 'سپلائر', type: 'raw', html: '<select class="form-select rp" data-k="sup">' + UI.opts(sOpts(), s.sup) + '</select>', cls: 'col-6 col-md-3' });
      else if (k === 'acct') h += UI.field({ label: 'اکاؤنٹ', type: 'raw', html: '<select class="form-select rp" data-k="acct">' + Acc.options(k === 'acct' && (r.id === 'cashbook' || r.id === 'bankbook') ? (a => a.cashLike) : null, s.acct) + '</select>', cls: 'col-12 col-md-4' });
    });
    return h + '</div><div class="d-flex flex-wrap gap-2 mt-2"><button class="btn btn-success" data-act="repPrint">🖨 پرنٹ</button><button class="btn btn-outline-success" data-act="repCsv">⬇ ایکسپورٹ (CSV)</button></div></div>';
  }
  let CUR = null;
  function show(args) {
    const id = args[0]; App.title('رپورٹس');
    if (!id) {
      const groups = {}; R.forEach(r => (groups[r.g] = groups[r.g] || []).push(r));
      return App.render(Object.keys(groups).map(g => '<div class="card-box mb-3"><div class="fw-bold text-brand mb-2">' + g + '</div><div class="d-flex flex-wrap gap-2">' + groups[g].map(r => '<a class="btn btn-outline-success" href="#/reports/' + r.id + '">' + r.t + '</a>').join('') + '</div></div>').join(''));
    }
    const r = find(id); if (!r) return App.render(UI.empty('❓', 'رپورٹ نہیں ملی'));
    const s = state(id); App.title(r.t);
    App.render('<a href="#/reports" class="btn btn-sm btn-light mb-2">« تمام رپورٹس</a>' + paramHtml(r, s) + '<div id="repOut">' + UI.loading() + '</div>');
    setTimeout(() => exec(r, s), 20);
  }
  function exec(r, s) {
    const p = Object.assign({}, s); if (!p.from) p.from = null; if (!p.to) p.to = null;
    try { CUR = { r, res: r.run(p), s }; } catch (e) { console.error(e); return $('#repOut').html(UI.empty('⚠️', 'رپورٹ بنانے میں خرابی: ' + U.esc(e.message))); }
    const res = CUR.res; let meta = [];
    if ((r.p || []).includes('range')) meta.push('مدت: ' + U.fd(s.from) + ' تا ' + U.fd(s.to));
    if (res.meta) meta.push(res.meta); CUR.meta = meta.join(' | ');
    $('#repOut').html((res.summary ? '<div class="row g-2 mb-3">' + res.summary.map(x => UI.stat(x[0], x[1], '', null, 'col-6 col-md-3')).join('') + '</div>' : '') + '<div class="card-box"><div class="fw-bold mb-1">' + r.t + '</div>' + (CUR.meta ? '<div class="small text-muted mb-2">' + U.esc(CUR.meta) + '</div>' : '') + Reports.tableHtml({ head: res.head, rows: res.rows, foot: res.foot, aligns: res.aligns, key: 'rep' }) + '</div>');
  }
  $(document).on('change', '.rp,#view [name=cust]', function () {
    if (!CUR && !App.current.startsWith('reports/')) return; const id = App.current.split('/')[1], r = find(id); if (!r) return; const s = state(id);
    if (this.name === 'cust') s.cust = this.value; else s[$(this).data('k')] = this.value; exec(r, s);
  });
  App.route('reports', show);
  Reports.open = function (id, preset) { const s = state(id); Object.assign(s, preset || {}); location.hash = '#/reports/' + id; if (App.current === 'reports/' + id) App.run(); };
  App.act.repPrint = () => { if (!CUR) return; const res = CUR.res; printReport(CUR.r.t, res.head, res.rows.map(x => Array.from(x)), res.foot, CUR.meta); };
  App.act.repCsv = () => { if (!CUR) return; const res = CUR.res; U.download(CUR.r.t + '-' + U.today() + '.csv', U.csv(res.head, res.rows.map(x => Array.from(x)).concat(res.foot ? [res.foot] : [])), 'text/csv;charset=utf-8'); };

  w.Reports = Reports;
})(window);
