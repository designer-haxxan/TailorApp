/* alterations.js — alteration workflow */
(function (w) {
  'use strict';
  const Alt = {};
  const ST = ['موصول', 'کاریگر کو دیا', 'کام جاری', 'تیار', 'ڈیلیور'];
  const COL = { 'موصول': 'secondary', 'کاریگر کو دیا': 'primary', 'کام جاری': 'primary', 'تیار': 'success', 'ڈیلیور': 'dark', 'منسوخ': 'danger' };
  Alt.ST = ST;
  const badge = s => UI.badge(s, COL[s]);
  Alt.paid = a => U.round(Pay.paidFor('alterationId', a.id));
  Alt.balance = a => U.round((a.status === 'منسوخ' ? 0 : a.charge) - Alt.paid(a));

  Alt.sync = function (a) {
    Acc.postDelta('alt:' + a.id, a.status === 'منسوخ' ? 0 : a.charge, { date: a.date, type: 'alteration', desc: 'آلٹریشن ' + a.no + ' آمدن', ref: { t: 'alt', id: a.id }, dr: 'receivable', cr: 'incAlter', party: a.customerId });
    Pay.applyAdvance(a.customerId);
  };
  // karigar assignment for an alteration (no garment)
  Alt.assignKarigar = function (a) {
    const cur = a.assignmentId && DB.assignments.get(a.assignmentId);
    if (cur && cur.status !== 'منسوخ') { if (cur.karigarId === a.karigarId) { DB.assignments.update(cur.id, { wage: a.wage, rate: a.wage, qty: 1 }); Kar.syncWage(DB.assignments.get(cur.id)); return; } Kar.setStatus(cur.id, 'منسوخ', { note: 'کاریگر تبدیل', noGarment: true }); }
    if (!a.karigarId) return DB.alterations.update(a.id, { assignmentId: null });
    const asg = DB.assignments.add({ no: DB.next('assignment'), karigarId: a.karigarId, orderId: null, garmentId: null, alterationId: a.id, qty: 1, rate: a.wage, wage: a.wage, givenDate: U.today(), dueDate: a.dueDate, doneDate: '', status: 'کام دیا گیا', note: '', completedOnce: false, history: [{ at: Date.now(), s: 'کام دیا گیا' }] });
    DB.alterations.update(a.id, { assignmentId: asg.id });
  };
  Alt.setStatus = function (id, status) {
    const a = DB.alterations.get(id); if (!a || a.status === status) return;
    DB.alterations.update(id, { status, history: (a.history || []).concat([{ at: Date.now(), s: status }]) });
    const asg = a.assignmentId && DB.assignments.get(a.assignmentId);
    if (asg && asg.status !== 'منسوخ') { if (status === 'کام جاری') Kar.setStatus(asg.id, 'زیرِ سلائی', { noGarment: true }); else if (status === 'تیار' || status === 'ڈیلیور') Kar.setStatus(asg.id, 'مکمل', { noGarment: true }); }
    if (status === 'منسوخ') { if (asg) Kar.setStatus(asg.id, 'منسوخ', { noGarment: true }); Alt.sync(DB.alterations.get(id)); }
    DB.log(status === 'ڈیلیور' ? 'delivery' : 'alteration', 'آلٹریشن ' + a.no + ': ' + status);
  };

  Alt.form = function (id) {
    const a = id ? DB.alterations.get(id) : { date: U.today(), dueDate: U.addDays(U.today(), 3), status: 'موصول', charge: '', wage: '' };
    const ks = DB.karigars.filter(k => k.active !== false);
    UI.modal({
      title: id ? 'آلٹریشن میں ترمیم' : 'نئی آلٹریشن', form: 'altSave', size: 'lg', static: true, noFocus: true,
      body: '<input type="hidden" name="id" value="' + (id || '') + '"><div class="row g-2">' + UI.field({ label: 'گاہک', type: 'raw', html: UI.picker('customerId', 'customer', a.customerId), req: 1, cls: 'col-12 col-md-6' }) +
        UI.field({ label: 'گارمنٹ', name: 'garment', value: a.garment, ph: 'مثلاً کالی پینٹ', req: 1, cls: 'col-12 col-md-6' }) + UI.field({ label: 'مسئلہ', name: 'problem', type: 'textarea', rows: 2, value: a.problem, cls: 'col-12 col-md-6' }) + UI.field({ label: 'مطلوبہ تبدیلی', name: 'change', type: 'textarea', rows: 2, value: a.change, cls: 'col-12 col-md-6' }) +
        UI.field({ label: 'کاریگر', name: 'karigarId', type: 'select', html: '<option value="">— بعد میں —</option>' + ks.map(k => '<option value="' + k.id + '"' + (a.karigarId === k.id ? ' selected' : '') + '>' + U.esc(k.name) + '</option>').join(''), cls: 'col-12 col-md-4' }) +
        UI.field({ label: 'کاریگر کی اجرت', name: 'wage', type: 'num', value: a.wage, cls: 'col-6 col-md-4' }) + UI.field({ label: 'گاہک سے چارج', name: 'charge', type: 'num', value: a.charge, req: 1, cls: 'col-6 col-md-4' }) +
        UI.field({ label: 'تاریخ', name: 'date', type: 'date', value: a.date, cls: 'col-6' }) + UI.field({ label: 'ڈیلیوری', name: 'dueDate', type: 'date', value: a.dueDate, cls: 'col-6' }) +
        (id ? '' : UI.field({ label: 'پیشگی وصولی', name: 'advance', type: 'num', cls: 'col-6' }) + UI.field({ label: 'کیش / بینک', name: 'account', type: 'select', html: Acc.cashOptions(), cls: 'col-6' })) + '</div>', ok: 'محفوظ کریں'
    });
  };
  App.forms.altSave = ($f, m) => {
    const v = UI.vals($f); if (!v.customerId) return UI.toast('گاہک منتخب کریں', 'warning');
    const d = { customerId: v.customerId, garment: v.garment, problem: v.problem, change: v.change, karigarId: v.karigarId, wage: U.n(v.wage), charge: U.n(v.charge), date: v.date, dueDate: v.dueDate };
    let a;
    if (v.id) { a = DB.alterations.update(v.id, d); }
    else { a = DB.alterations.add(Object.assign({ no: DB.next('alteration'), status: 'موصول', history: [{ at: Date.now(), s: 'موصول' }] }, d)); DB.log('alteration', 'نئی آلٹریشن ' + a.no + ' — ' + Cust.name(a.customerId)); }
    Alt.sync(a);
    if (v.karigarId) { Alt.assignKarigar(a); if (!v.id && a.status === 'موصول') Alt.setStatus(a.id, 'کاریگر کو دیا'); } else if (a.assignmentId) { Alt.assignKarigar(a); }
    if (!v.id && U.n(v.advance) > 0) Pay.create({ party: 'customer', partyId: a.customerId, dir: 'in', amount: v.advance, date: v.date, account: v.account, alterationId: a.id, kind: 'advance', note: 'آلٹریشن پیشگی' });
    m.close(); UI.toast('آلٹریشن محفوظ ہو گئی'); App.refresh();
  };
  App.act.altNew = () => Alt.form(); App.act.altEdit = $b => Alt.form($b.data('id'));
  App.act.altStatus = $b => {
    const a = DB.alterations.get($b.data('id'));
    const ctl = UI.modal({ title: 'آلٹریشن کی حالت', size: 'sm', body: '<div class="vstack gap-2">' + ST.filter(s => s !== 'ڈیلیور').map(s => '<button class="btn ' + (s === a.status ? 'btn-success' : 'btn-outline-secondary') + '" data-s="' + s + '">' + s + '</button>').join('') + '<button class="btn btn-success" data-s="ڈیلیور">🚚 ڈیلیور</button><button class="btn btn-outline-danger" data-s="منسوخ">منسوخ</button></div>' });
    ctl.$el.on('click', '[data-s]', function () {
      const s = $(this).data('s'); ctl.close();
      if (s === 'ڈیلیور') return setTimeout(() => deliverModal(a.id), 300);
      if (s === 'کاریگر کو دیا' && !a.karigarId) { UI.toast('پہلے ترمیم میں کاریگر منتخب کریں', 'warning'); return; }
      if (s === 'منسوخ') return UI.confirm('آلٹریشن منسوخ کریں؟', { danger: true }).then(ok => { if (ok) { Alt.setStatus(a.id, s); App.refresh(); } });
      Alt.setStatus(a.id, s); App.refresh();
    });
  };
  function deliverModal(id) {
    const a = DB.alterations.get(id), bal = Alt.balance(a);
    UI.modal({
      title: 'آلٹریشن ڈیلیوری: ' + a.no, form: 'altDeliver', size: 'sm',
      body: '<input type="hidden" name="id" value="' + id + '"><div class="mb-2"><b>' + U.esc(Cust.name(a.customerId)) + '</b> — ' + U.esc(a.garment) + '</div>' + UI.kv('چارج', U.rs(a.charge)) + UI.kv('وصول شدہ', U.rs(Alt.paid(a))) + UI.kv('بقایا', U.rs(bal)) +
        (bal > 0.004 ? '<div class="row g-2 mt-1">' + UI.field({ label: 'ابھی وصول کریں', name: 'receive', type: 'num', value: bal }) + UI.field({ label: 'کیش / بینک', name: 'account', type: 'select', html: Acc.cashOptions() }) + '</div>' : ''), ok: 'ڈیلیور کریں'
    });
  }
  App.forms.altDeliver = ($f, m) => {
    const v = UI.vals($f), a = DB.alterations.get(v.id), rec = U.n(v.receive), after = U.round(Alt.balance(a) - rec), S = DB.settings;
    const go = () => { if (rec > 0) Pay.create({ party: 'customer', partyId: a.customerId, dir: 'in', amount: rec, account: v.account, alterationId: a.id, kind: 'payment', note: 'آلٹریشن ڈیلیوری' }); Alt.setStatus(a.id, 'ڈیلیور'); m.close(); UI.toast('ڈیلیوری درج ہو گئی'); App.refresh(); };
    if (after > 0.004) { if (!S.allowDeliveryWithBalance) return UI.toast('پہلے مکمل بقایا وصول کریں', 'danger'); if (S.requireDeliveryConfirm) return UI.confirm('بقایا ' + U.rs(after) + ' رہے گا۔ پھر بھی ڈیلیور کریں؟').then(ok => { if (ok) go(); }); }
    go();
  };

  function page() {
    App.title('آلٹریشن');
    App.render('<div class="d-flex justify-content-between mb-2"><h6 class="fw-bold m-0">آلٹریشن</h6><button class="btn btn-success" data-act="altNew">➕ نئی آلٹریشن</button></div>' + UI.list({
      key: 'alt', keepState: true, placeholder: 'گاہک، گارمنٹ یا نمبر', icon: '🪡', empty: 'کوئی آلٹریشن نہیں',
      filters: [{ name: 's', def: 'open', opts: [['open', 'زیرِ عمل'], ['', 'تمام']].concat(ST.concat(['منسوخ']).map(s => [s, s])) }],
      items: st => DB.alterations.all().filter(a => (st.f.s === 'open' ? !['ڈیلیور', 'منسوخ'].includes(a.status) : (!st.f.s || a.status === st.f.s)) && UI.match(st.q, Cust.name(a.customerId), a.garment, a.no, a.problem)).sort((a, b) => b.createdAt - a.createdAt),
      row: a => { const bal = Alt.balance(a), late = a.dueDate && a.dueDate < U.today() && !['ڈیلیور', 'منسوخ'].includes(a.status); return UI.row({ cls: late ? 'bad' : '', title: U.code(a.no) + ' · ' + U.esc(Cust.name(a.customerId)) + ' ' + badge(a.status), sub: U.esc(a.garment) + ' · ڈیلیوری ' + U.fd(a.dueDate), extra: (a.problem ? 'مسئلہ: ' + U.esc(a.problem) : '') + (a.change ? '<br>تبدیلی: ' + U.esc(a.change) : '') + (a.karigarId ? '<br>🧑‍🏭 ' + U.esc(Kar.name(a.karigarId)) : ''), right: '<div class="fw-bold">' + U.num(a.charge) + '</div>' + (bal > 0.004 ? '<div class="small text-danger">بقایا ' + U.num(bal) + '</div>' : ''), actions: a.status === 'ڈیلیور' || a.status === 'منسوخ' ? '' : '<button class="btn btn-sm btn-outline-success" data-act="altStatus" data-id="' + a.id + '">حالت / ڈیلیوری</button><button class="btn btn-sm btn-outline-secondary" data-act="altEdit" data-id="' + a.id + '">✏️</button><button class="btn btn-sm btn-outline-primary" data-act="payReceive" data-cid="' + a.customerId + '">💰 وصولی</button><button class="btn btn-sm btn-outline-secondary" data-act="altPrint" data-id="' + a.id + '">🖨 سلپ</button>' }); }
    }));
  }
  App.route('alterations', page);
  App.act.altPrint = $b => printAlterationSlip($b.data('id'));

  w.Alt = Alt;
})(window);
