/* dashboard.js — home screen: key figures, quick actions, alerts */
(function (w) {
  'use strict';
  const Dash = {};

  Dash.figures = function () {
    const today = U.today(), ms = U.monthStart(), orders = DB.orders.all(), live = orders.filter(o => o.status !== 'منسوخ');
    const garms = DB.garments.all().filter(g => g.status !== 'منسوخ');
    const stitchOrders = new Set(garms.filter(g => ['کاریگر کو دیا', 'زیرِ سلائی', 'چیکنگ', 'آلٹریشن'].includes(g.status)).map(g => g.orderId));
    const readyOrders = live.filter(o => o.status !== 'ڈیلیور' && Ord.active(o.id).some(g => Garm.READY.includes(g.status)));
    const dueToday = live.filter(o => o.status !== 'ڈیلیور' && o.dueDate === today);
    const late = live.filter(Ord.isLate);
    const pays = DB.payments.all().filter(p => p.party === 'customer' && !p.voided && p.date === today);
    const pnl = Acc.pnl(ms, today);
    const exps = DB.expenses.all().filter(e => !e.voided && e.date === today);
    return {
      newToday: orders.filter(o => o.date === today).length, stitching: stitchOrders.size, ready: readyOrders.length, dueToday, late,
      collectToday: U.sum(pays, p => p.dir === 'in' ? p.amount : -p.amount), expToday: U.sum(exps, e => e.amount),
      custDue: Cust.totalOutstanding(), karDue: Kar.totalPayable(), supDue: Sup.totalPayable(), cash: Acc.bal('cash'), bank: Acc.bal('bank'),
      income: pnl.totalInc, expense: pnl.totalExp, profit: pnl.net
    };
  };

  function page() {
    App.title('ڈیش بورڈ');
    const f = Dash.figures(), S = DB.settings;
    let h = '<div class="d-flex align-items-center gap-3 mb-3">' + (S.logo ? '<img src="' + U.esc(S.logo) + '" style="width:54px;height:54px;object-fit:contain;border-radius:12px;background:#fff" alt="">' : '') + '<div><div class="fs-4 fw-bold text-brand">' + U.esc(S.shopName) + '</div><div class="text-muted">' + U.dateLong() + '</div></div></div>';
    const lb = DB.meta.lastBackup, hasData = DB.orders.count() + DB.customers.count() > 0;
    if (hasData && (!lb || Date.now() - lb.at > 7 * 86400000)) h += '<div class="alert alert-warning d-flex justify-content-between align-items-center gap-2"><span>⚠️ ' + (lb ? 'آخری بیک اپ ' + Math.floor((Date.now() - lb.at) / 86400000) + ' دن پہلے لیا گیا تھا۔' : 'ابھی تک کوئی بیک اپ نہیں لیا گیا۔') + '</span><a class="btn btn-sm btn-warning" href="#/settings/backup">بیک اپ لیں</a></div>';
    const q = [['order/new', '✂️', 'نیا آرڈر', 'href'], ['custNew', '👤', 'نیا گاہک'], ['measNew', '📏', 'نئی پیمائش'], ['karPick', '🧑‍🏭', 'کاریگر کو کام دیں'], ['payReceive', '💰', 'رقم وصول کریں'], ['expNew', '💸', 'خرچ درج کریں'], ['print/tags', '🏷', 'ٹیگ پرنٹ کریں', 'href'], ['print/receipts', '🧾', 'رسید پرنٹ کریں', 'href']];
    h += '<div class="row g-2 mb-3">' + q.map(x => '<div class="col-3 col-md-3">' + (x[3] ? '<a class="quick-btn" href="#/' + x[0] + '">' : '<button class="quick-btn" data-act="' + x[0] + '">') + '<span class="qi">' + x[1] + '</span><span>' + x[2] + '</span>' + (x[3] ? '</a>' : '</button>') + '</div>').join('') + '</div>';
    h += '<h6 class="fw-bold text-brand">آرڈرز</h6><div class="row g-2 mb-3">' +
      UI.stat('آج کے نئے آرڈر', f.newToday, '', '#/orders') + UI.stat('زیرِ سلائی آرڈر', f.stitching, 'blue', '#/reports/ord_stitch') + UI.stat('تیار آرڈر', f.ready, '', '#/delivery') + UI.stat('آج ڈیلیوری والے', f.dueToday.length, 'gold', '#/reports/ord_today') + UI.stat('تاخیر شدہ آرڈر', f.late.length, f.late.length ? 'bad' : '', '#/reports/ord_late') + '</div>';
    h += '<h6 class="fw-bold text-brand">مالیات</h6><div class="row g-2 mb-3">' +
      UI.stat('آج کی وصولی', U.rs(f.collectToday), 'gold') + UI.stat('آج کے اخراجات', U.rs(f.expToday), 'bad') + UI.stat('کل بقایا (گاہک)', U.rs(f.custDue), f.custDue ? 'bad' : '', '#/reports/cust_due') + UI.stat('کاریگروں کا بقایا', U.rs(f.karDue), '', '#/reports/kar_balance') + UI.stat('سپلائرز کا بقایا', U.rs(f.supDue), '', '#/reports/sup_balance') +
      UI.stat('موجودہ کیش', U.rs(f.cash), f.cash < 0 ? 'bad' : '', '#/reports/cashbook') + UI.stat('بینک بیلنس', U.rs(f.bank), '', '#/reports/bankbook') + UI.stat('ماہانہ آمدن', U.rs(f.income), '', '#/reports/pnl') + UI.stat('ماہانہ خرچ', U.rs(f.expense), 'bad', '#/reports/pnl') + UI.stat(f.profit >= 0 ? 'منافع (ماہانہ)' : 'نقصان (ماہانہ)', U.rs(Math.abs(f.profit)), f.profit >= 0 ? '' : 'bad', '#/reports/pnl') + '</div>';
    if (f.dueToday.length) h += UI.card('آج ڈیلیوری والے آرڈر', '<div class="vstack gap-2">' + f.dueToday.slice(0, 5).map(Ord.card).join('') + '</div>');
    if (f.late.length) h += UI.card('⏰ تاخیر شدہ آرڈر', '<div class="vstack gap-2">' + f.late.sort((a, b) => a.dueDate < b.dueDate ? -1 : 1).slice(0, 5).map(Ord.card).join('') + '</div>', f.late.length > 5 ? '<a href="#/reports/ord_late">سب دیکھیں</a>' : '');
    const low = DB.inventory.filter(Inv.isLow);
    if (low.length) h += UI.card('📦 کم اسٹاک', low.slice(0, 6).map(i => '<div class="d-flex justify-content-between border-bottom py-1"><span>' + U.esc(i.name) + '</span><b class="text-danger">' + U.num(i.qty) + ' ' + U.esc(i.unit) + '</b></div>').join(''), '<a href="#/inventory">اسٹاک</a>');
    if (!DB.orders.count() && !DB.customers.count()) h += '<div class="card-box text-center"><div class="display-4">✂️</div><div class="fs-5 mt-2">خوش آمدید! شروع کرنے کے لیے پہلے <a href="#/settings/shop">دکان کی معلومات</a> درج کریں، پھر نیا آرڈر بنائیں۔</div></div>';
    App.render(h);
  }
  App.route('dashboard', page);
  App.route('', page);

  // ---------- activity history ----------
  const ICON = { order: '📋', payment: '💰', assign: '🧑‍🏭', 'karigar-change': '🔁', 'garment-done': '✅', garment: '🧵', delivery: '🚚', cancel: '⛔', restore: '♻️', backup: '💾', void: '↩️', customer: '👤', measurement: '📏', expense: '💸', purchase: '🛒', sale: '🛍️', stock: '📦', alteration: '🪡', voucher: '📒', journal: '📒', karigar: '🧑‍🏭', supplier: '🏪' };
  App.route('activity', () => {
    App.title('سرگرمی');
    App.render(UI.list({
      key: 'act', keepState: true, placeholder: 'سرگرمی میں تلاش کریں', icon: '🕘', empty: 'ابھی کوئی سرگرمی درج نہیں', size: 30,
      filters: [{ name: 't', opts: [['', 'تمام'], ['order', 'آرڈر'], ['payment', 'ادائیگی'], ['assign', 'کاریگر'], ['garment-done', 'گارمنٹ مکمل'], ['delivery', 'ڈیلیوری'], ['cancel', 'منسوخی'], ['void', 'منسوخ انٹری'], ['restore', 'بحالی'], ['backup', 'بیک اپ']] }],
      items: st => DB.activity.all().filter(a => (!st.f.t || a.type === st.f.t) && UI.match(st.q, a.text)).sort((a, b) => b.at - a.at),
      row: a => '<div class="item-card"' + (a.ref && a.ref.t === 'order' ? ' data-href="#/order/' + a.ref.id + '"' : '') + '><div class="d-flex gap-2"><span class="fs-5">' + (ICON[a.type] || '•') + '</span><div class="flex-grow-1"><div>' + U.esc(a.text) + '</div><div class="small text-muted">' + U.fdt(a.at) + '</div></div></div></div>'
    }));
  });

  w.Dash = Dash;
})(window);
