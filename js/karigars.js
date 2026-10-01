/* karigars.js — karigar master, work assignments (with history), wages ledger */
(function (w) {
  'use strict';
  const Kar = {};
  const AST = ['کام دیا گیا', 'زیرِ سلائی', 'مکمل', 'واپس آیا', 'دوبارہ کام', 'منسوخ'];
  const ACOL = { 'کام دیا گیا': 'secondary', 'زیرِ سلائی': 'primary', 'مکمل': 'success', 'واپس آیا': 'warning', 'دوبارہ کام': 'warning', 'منسوخ': 'danger' };
  const WORK = ['قمیض', 'شلوار', 'پینٹ', 'کوٹ', 'ویسٹ کوٹ', 'کُرتا', 'خواتین کے کپڑے', 'آلٹریشن', 'دیگر'];
  Kar.AST = AST;
  const abadge = s => UI.badge(s, ACOL[s] || 'secondary');

  Kar.name = id => (DB.karigars.get(id) || {}).name || '—';
  Kar.paidFor = a => U.round(Pay.paidFor('assignmentId', a.id));
  Kar.asgLabel = a => {
    if (a.alterationId) { const al = DB.alterations.get(a.alterationId); return 'آلٹریشن ' + (al ? al.no : ''); }
    const g = DB.garments.get(a.garmentId), o = DB.orders.get(a.orderId);
    return (o ? o.no : '') + ' · ' + (g ? g.typeName + ' (' + g.tag + ')' : '');
  };
  Kar.active = gid => { const g = DB.garments.get(gid); const a = g && g.assignmentId && DB.assignments.get(g.assignmentId); return a && a.status !== 'منسوخ' ? a : null; };

  Kar.syncWage = function (a) {
    const earned = (a.status === 'مکمل' || (a.status === 'دوبارہ کام' && a.completedOnce)) ? a.wage : 0;
    Acc.postDelta('asg:' + a.id, earned, { date: a.doneDate || U.today(), type: 'wage', desc: 'کاریگر اجرت: ' + Kar.name(a.karigarId) + ' — ' + Kar.asgLabel(a), ref: { t: 'asg', id: a.id }, dr: 'expKarigar', cr: 'payableKarigar', party: a.karigarId });
  };

  Kar.assign = function (gid, o) {
    const g = DB.garments.get(gid), prev = Kar.active(gid);
    if (prev) Kar.setStatus(prev.id, 'منسوخ', { note: 'دوسرے کاریگر کو دیا گیا', noGarment: true });
    const qty = o.qty || g.qty, rate = U.n(o.rate);
    const a = DB.assignments.add({
      no: DB.next('assignment'), karigarId: o.karigarId, orderId: g.orderId, garmentId: g.id, qty, rate, wage: U.round(o.wage != null ? o.wage : qty * rate),
      givenDate: o.givenDate || U.today(), dueDate: o.dueDate || g.dueDate || '', doneDate: '', status: 'کام دیا گیا', note: o.note || '', completedOnce: false,
      prevId: prev ? prev.id : null, history: [{ at: Date.now(), s: 'کام دیا گیا', n: prev ? 'دوبارہ تفویض' : '' }]
    });
    DB.garments.update(g.id, { assignmentId: a.id });
    if (Garm.RANK[g.status] < Garm.RANK['کاریگر کو دیا']) Garm.setStatus(g.id, 'کاریگر کو دیا', { fromAssign: true });
    DB.log(prev ? 'karigar-change' : 'assign', (prev ? 'کاریگر تبدیل: ' : 'کاریگر کو کام: ') + Kar.name(a.karigarId) + ' — ' + g.typeName + ' ' + g.tag, { t: 'order', id: g.orderId });
    return a;
  };
  Kar.setStatus = function (id, status, o) {
    o = o || {}; const a = DB.assignments.get(id); if (!a || a.status === status) return;
    const patch = { status, history: (a.history || []).concat([{ at: Date.now(), s: status, n: o.note || '' }]) };
    if (status === 'مکمل') { patch.doneDate = U.today(); patch.completedOnce = true; }
    DB.assignments.update(id, patch);
    Kar.syncWage(DB.assignments.get(id));
    const g = a.garmentId && DB.garments.get(a.garmentId);
    if (g && !o.noGarment) {
      const R = Garm.RANK[g.status];
      if (status === 'زیرِ سلائی' && R < 4) Garm.setStatus(g.id, 'زیرِ سلائی', { fromAssign: true });
      else if (status === 'مکمل' && R < 5) Garm.setStatus(g.id, 'چیکنگ', { fromAssign: true });
      else if (status === 'دوبارہ کام') Garm.setStatus(g.id, 'آلٹریشن', { fromAssign: true, force: true });
      else if (status === 'واپس آیا' && R >= 3 && R < 5) Garm.setStatus(g.id, 'کپڑا موصول', { fromAssign: true });
      else if (status === 'منسوخ' && g.assignmentId === id) DB.garments.update(g.id, { assignmentId: null });
    }
    if (status === 'منسوخ' && g && g.assignmentId === id) DB.garments.update(g.id, { assignmentId: null });
    DB.log(status === 'مکمل' ? 'garment-done' : 'assign', 'کاریگر ' + Kar.name(a.karigarId) + ' کا کام (' + Kar.asgLabel(a) + '): ' + status, { t: 'order', id: a.orderId });
  };
  Kar.onGarmentStatus = function (g, status) {
    const a = Kar.active(g.id); if (!a) return;
    const R = Garm.RANK[status];
    if (status === 'زیرِ سلائی' && a.status === 'کام دیا گیا') Kar.setStatus(a.id, 'زیرِ سلائی', { noGarment: true });
    else if (status === 'آلٹریشن') Kar.setStatus(a.id, 'دوبارہ کام', { noGarment: true });
    else if (R >= 5 && a.status !== 'مکمل') Kar.setStatus(a.id, 'مکمل', { noGarment: true });
  };
  Kar.balance = function (kid) {
    const as = DB.assignments.of('karigarId', kid).filter(a => a.status !== 'منسوخ');
    const earned = U.sum(as.filter(a => a.status === 'مکمل' || (a.status === 'دوبارہ کام' && a.completedOnce)), a => a.wage);
    const paid = U.round(DB.payments.of('partyId', kid).filter(p => p.party === 'karigar' && !p.voided).reduce((s, p) => s + (p.dir === 'out' ? p.amount : -p.amount), 0));
    return { jobs: as.length, pieces: U.sum(as, a => a.qty), wages: U.sum(as, a => a.wage), earned, paid, balance: U.round(earned - paid), done: as.filter(a => a.status === 'مکمل').length, open: as.filter(a => ['کام دیا گیا', 'زیرِ سلائی', 'دوبارہ کام'].includes(a.status)).length };
  };
  Kar.ledger = function (kid) {
    const e = [];
    DB.assignments.of('karigarId', kid).forEach(a => { if (a.status === 'منسوخ') return; if (a.status === 'مکمل' || (a.status === 'دوبارہ کام' && a.completedOnce)) e.push({ date: a.doneDate || a.givenDate, ts: a.createdAt, desc: 'اجرت: ' + Kar.asgLabel(a) + ' (' + U.num(a.qty) + ' × ' + U.num(a.rate) + ')', cr: a.wage, dr: 0 }); });
    DB.payments.of('partyId', kid).forEach(p => { if (p.party === 'karigar' && !p.voided) e.push({ date: p.date, ts: p.createdAt, desc: (p.dir === 'out' ? 'ادائیگی ' : 'واپسی ') + p.no + (p.assignmentId && DB.assignments.get(p.assignmentId) ? ' — ' + Kar.asgLabel(DB.assignments.get(p.assignmentId)) : ''), dr: p.dir === 'out' ? p.amount : 0, cr: p.dir === 'in' ? p.amount : 0 }); });
    e.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : a.ts - b.ts); let bal = 0; e.forEach(x => { bal += x.cr - x.dr; x.bal = U.round(bal); }); return e;
  };
  Kar.totalPayable = () => U.round(DB.karigars.all().reduce((s, k) => { const b = Kar.balance(k.id).balance; return s + (b > 0 ? b : 0); }, 0));

  // ---------- master form ----------
  Kar.form = function (id) {
    const k = id ? DB.karigars.get(id) : { no: DB.peek('karigar'), workTypes: [], active: true };
    UI.modal({
      title: id ? 'کاریگر میں ترمیم' : 'نیا کاریگر', form: 'karSave',
      body: '<input type="hidden" name="id" value="' + (id || '') + '"><div class="row g-2">' + UI.field({ label: 'کاریگر نمبر', name: 'no', value: k.no, attrs: 'readonly', cls: 'col-5' }) + UI.field({ label: 'نام', name: 'name', value: k.name, req: 1, cls: 'col-7' }) +
        UI.field({ label: 'موبائل', name: 'mobile', type: 'tel', value: k.mobile, cls: 'col-6' }) + UI.field({ label: 'مہارت', name: 'skill', value: k.skill, ph: 'مثلاً ماسٹر، کٹر', cls: 'col-6' }) +
        UI.field({ label: 'پتہ', name: 'address', value: k.address }) +
        '<div class="col-12"><label class="form-label mb-1">کام کی قسم</label><div class="d-flex flex-wrap gap-2">' + WORK.map(x => '<label class="form-check m-0 border rounded px-2"><input type="checkbox" class="form-check-input wt" value="' + x + '" ' + ((k.workTypes || []).includes(x) ? 'checked' : '') + '> <span class="form-check-label">' + x + '</span></label>').join('') + '</div></div>' +
        UI.field({ label: 'عام ریٹ (فی پیس)', name: 'rate', type: 'num', value: k.rate || '', cls: 'col-6' }) + UI.field({ type: 'check', label: 'فعال', name: 'active', value: k.active !== false, cls: 'col-6 align-self-end' }) +
        UI.field({ label: 'نوٹس', name: 'notes', type: 'textarea', rows: 2, value: k.notes }) + '</div>', ok: 'محفوظ کریں'
    });
  };
  App.forms.karSave = ($f, m) => {
    const v = UI.vals($f), wt = $f.find('.wt:checked').map((i, e) => e.value).get();
    const data = { name: v.name, mobile: v.mobile, address: v.address, skill: v.skill, workTypes: wt, rate: U.n(v.rate), notes: v.notes, active: v.active };
    if (v.id) DB.karigars.update(v.id, data); else { const k = DB.karigars.add(Object.assign({ no: DB.next('karigar') }, data)); DB.log('karigar', 'نیا کاریگر: ' + k.name); }
    m.close(); UI.toast('کاریگر محفوظ ہو گیا'); App.refresh();
  };
  App.act.karNew = () => Kar.form(); App.act.karEdit = $b => Kar.form($b.data('id'));

  // ---------- assign modal ----------
  Kar.assignModal = function (gid) {
    const g = DB.garments.get(gid), prev = Kar.active(gid), ks = DB.karigars.filter(k => k.active !== false);
    if (!ks.length) return UI.toast('پہلے کاریگر شامل کریں', 'warning');
    const ctl = UI.modal({
      title: (prev ? 'کاریگر تبدیل کریں' : 'کاریگر کو کام دیں') + ': ' + g.typeName, form: 'karAssign',
      body: '<input type="hidden" name="gid" value="' + gid + '">' + (prev ? '<div class="alert alert-warning py-1 small">اس وقت کاریگر <b>' + U.esc(Kar.name(prev.karigarId)) + '</b> کے پاس ہے۔ تبدیلی پر پرانا کام «منسوخ» درج ہو گا، تاریخ محفوظ رہے گی۔</div>' : '') +
        '<div class="small text-muted mb-2">' + U.code(g.tag) + ' · ' + U.esc(Cust.name(g.customerId)) + ' · ڈیلیوری ' + U.fd(g.dueDate) + '</div><div class="row g-2">' +
        UI.field({ label: 'کاریگر', name: 'karigarId', type: 'select', req: 1, html: ks.map(k => '<option value="' + k.id + '" data-rate="' + (k.rate || '') + '"' + (prev && prev.karigarId === k.id ? ' selected' : '') + '>' + U.esc(k.name) + (k.skill ? ' — ' + U.esc(k.skill) : '') + '</option>').join(''), cls: 'col-12' }) +
        UI.field({ label: 'تعداد', name: 'qty', type: 'num', value: g.qty, cls: 'col-4' }) + UI.field({ label: 'ریٹ (فی پیس)', name: 'rate', type: 'num', value: prev ? prev.rate : '', cls: 'col-4' }) + '<div class="col-4"><label class="form-label mb-1">کل اجرت</label><div class="form-control bg-light fw-bold" id="kaW">0</div></div>' +
        UI.field({ label: 'کام دینے کی تاریخ', name: 'givenDate', type: 'date', value: U.today(), cls: 'col-6' }) + UI.field({ label: 'متوقع تکمیل', name: 'dueDate', type: 'date', value: g.dueDate, cls: 'col-6' }) + UI.field({ label: 'نوٹس', name: 'note' }) + '</div>', ok: 'کام دیں',
      footer: ''
    });
    const $m = ctl.$el, calc = () => $m.find('#kaW').text(U.num(U.n($m.find('[name=qty]').val()) * U.n($m.find('[name=rate]').val())));
    $m.on('input', '[name=qty],[name=rate]', calc);
    $m.on('change', '[name=karigarId]', function () { const r = $(this).find(':selected').data('rate'); if (r) { $m.find('[name=rate]').val(r); calc(); } });
    if (!prev) { const r = $m.find('[name=karigarId] :selected').data('rate'); if (r) $m.find('[name=rate]').val(r); } calc();
  };
  App.act.karAssign = $b => Kar.assignModal($b.data('gid'));
  App.forms.karAssign = ($f, m) => {
    const v = UI.vals($f); if (U.n(v.qty) <= 0) return UI.toast('تعداد درست نہیں', 'warning');
    Kar.assign(v.gid, { karigarId: v.karigarId, qty: U.n(v.qty), rate: U.n(v.rate), givenDate: v.givenDate, dueDate: v.dueDate, note: v.note });
    m.close(); UI.toast('کام کاریگر کو دے دیا گیا'); const g = DB.garments.get(v.gid);
    UI.confirm('کاریگر کی ورک سلپ پرنٹ کریں؟', { ok: 'پرنٹ کریں', cancel: 'نہیں' }).then(ok => { if (ok) printKarigarSlip(g.assignmentId); }); App.refresh();
  };
  Kar.pickGarment = function () {
    const gs = DB.garments.filter(g => !['ڈیلیور', 'منسوخ', 'تیار', 'ڈیلیوری کے لیے تیار'].includes(g.status) && !Kar.active(g.id)).sort((a, b) => (a.dueDate || '') < (b.dueDate || '') ? -1 : 1);
    if (!gs.length) return UI.toast('کوئی بغیر کاریگر گارمنٹ موجود نہیں', 'warning');
    const ctl = UI.modal({ title: 'کون سی گارمنٹ دینی ہے؟', body: '<div class="vstack gap-2">' + gs.slice(0, 60).map(g => '<div class="item-card" data-id="' + g.id + '"><div class="fw-bold">' + U.esc(g.typeName) + ' × ' + U.num(g.qty) + ' ' + U.code(g.tag) + '</div><div class="small text-muted">' + U.esc(Cust.name(g.customerId)) + ' · ڈیلیوری ' + U.fd(g.dueDate) + '</div></div>').join('') + '</div>' });
    ctl.$el.on('click', '.item-card', function () { const id = $(this).data('id'); ctl.close(); setTimeout(() => Kar.assignModal(id), 350); });
  };
  App.act.karPick = () => Kar.pickGarment();

  // ---------- assignment actions ----------
  Kar.asgCard = function (a, o) {
    const k = DB.karigars.get(a.karigarId) || {}, paid = Kar.paidFor(a), late = a.dueDate && a.dueDate < U.today() && ['کام دیا گیا', 'زیرِ سلائی', 'دوبارہ کام'].includes(a.status);
    return UI.row({
      cls: a.status === 'منسوخ' ? 'mute' : late ? 'bad' : '', title: U.esc(k.name) + ' ' + abadge(a.status) + (late ? ' <span class="badge bg-danger">تاخیر</span>' : ''), sub: U.esc(Kar.asgLabel(a)) + ' · ' + U.code(a.no),
      extra: 'تعداد ' + U.num(a.qty) + ' × ' + U.num(a.rate) + ' = <b>' + U.num(a.wage) + '</b> · ادا ' + U.num(paid) + ' · دیا ' + U.fd(a.givenDate) + (a.dueDate ? ' · متوقع ' + U.fd(a.dueDate) : '') + (a.doneDate ? ' · مکمل ' + U.fd(a.doneDate) : '') + (a.note ? '<br>' + U.esc(a.note) : ''),
      actions: a.status === 'منسوخ' ? '' : '<button class="btn btn-sm btn-outline-success" data-act="karAsgStatus" data-id="' + a.id + '">حالت</button><button class="btn btn-sm btn-outline-secondary" data-act="karAsgEdit" data-id="' + a.id + '">✏️ اجرت</button><button class="btn btn-sm btn-outline-secondary" data-act="slipPrintA" data-id="' + a.id + '">📄 ورک سلپ</button><button class="btn btn-sm btn-outline-primary" data-act="payPayout" data-party="karigar" data-id="' + a.karigarId + '" data-aid="' + a.id + '">💵 ادائیگی</button>' + (a.garmentId ? '<button class="btn btn-sm btn-outline-primary" data-act="karAssign" data-gid="' + a.garmentId + '">بدلیں</button>' : '')
    });
  };
  App.act.slipPrintA = $b => printKarigarSlip($b.data('id'));
  App.act.slipPrint = $b => { const g = DB.garments.get($b.data('id')); const a = Kar.active(g.id); if (!a) return UI.toast('اس گارمنٹ کا کوئی کاریگر مقرر نہیں', 'warning'); printKarigarSlip(a.id); };
  App.act.karAsgStatus = $b => {
    const a = DB.assignments.get($b.data('id'));
    const ctl = UI.modal({ title: 'کام کی حالت', size: 'sm', body: '<div class="vstack gap-2">' + AST.filter(s => s !== 'منسوخ').map(s => '<button class="btn ' + (s === a.status ? 'btn-success' : 'btn-outline-secondary') + '" data-s="' + s + '">' + s + '</button>').join('') + '<button class="btn btn-outline-danger" data-s="منسوخ">منسوخ</button></div>' });
    ctl.$el.on('click', '[data-s]', function () { Kar.setStatus(a.id, $(this).data('s')); ctl.close(); App.refresh(); });
  };
  App.act.karAsgEdit = $b => {
    const a = DB.assignments.get($b.data('id'));
    UI.modal({
      title: 'کام میں ترمیم', form: 'karAsgEdit', size: 'sm', body: '<input type="hidden" name="id" value="' + a.id + '"><div class="row g-2">' + UI.field({ label: 'تعداد', name: 'qty', type: 'num', value: a.qty, cls: 'col-6' }) + UI.field({ label: 'ریٹ', name: 'rate', type: 'num', value: a.rate, cls: 'col-6' }) +
        UI.field({ label: 'کل اجرت', name: 'wage', type: 'num', value: a.wage, help: 'خود تبدیل کر سکتے ہیں' }) + UI.field({ label: 'متوقع تکمیل', name: 'dueDate', type: 'date', value: a.dueDate }) + UI.field({ label: 'نوٹس', name: 'note', value: a.note }) + '</div>', ok: 'محفوظ کریں'
    });
  };
  $(document).on('input', 'form[data-form=karAsgEdit] [name=qty],form[data-form=karAsgEdit] [name=rate]', function () { const $f = $(this).closest('form'); $f.find('[name=wage]').val(U.round(U.n($f.find('[name=qty]').val()) * U.n($f.find('[name=rate]').val()))); });
  App.forms.karAsgEdit = ($f, m) => { const v = UI.vals($f); DB.assignments.update(v.id, { qty: U.n(v.qty), rate: U.n(v.rate), wage: U.round(U.n(v.wage)), dueDate: v.dueDate, note: v.note }); Kar.syncWage(DB.assignments.get(v.id)); m.close(); UI.toast('محفوظ ہو گیا'); App.refresh(); };

  // ---------- pages ----------
  function page(args) {
    const tab = args[0] || 'list'; App.title('کاریگر');
    let h = UI.tabs([['list', 'کاریگر'], ['work', 'کام کی تقسیم']], tab, 'karigars');
    if (tab === 'work') {
      h += '<div class="d-flex justify-content-between mb-2"><h6 class="fw-bold m-0">تمام کام</h6><button class="btn btn-success" data-act="karPick">🧑‍🏭 کاریگر کو کام دیں</button></div>' + UI.list({
        key: 'asg', keepState: true, placeholder: 'کاریگر، آرڈر یا ٹیگ تلاش کریں', icon: '🧑‍🏭', empty: 'کوئی کام نہیں ملا',
        filters: [{ name: 's', def: 'open', opts: [['open', 'جاری کام'], ['', 'تمام']].concat(AST.map(s => [s, s])) }, { name: 'k', opts: [['', 'تمام کاریگر']].concat(DB.karigars.all().map(k => [k.id, k.name])) }],
        items: st => DB.assignments.all().filter(a => (!st.f.k || a.karigarId === st.f.k) && (st.f.s === 'open' ? ['کام دیا گیا', 'زیرِ سلائی', 'دوبارہ کام'].includes(a.status) : (!st.f.s || a.status === st.f.s)) && UI.match(st.q, Kar.name(a.karigarId), Kar.asgLabel(a), a.no)).sort((a, b) => b.createdAt - a.createdAt),
        row: Kar.asgCard
      });
    } else {
      h += '<div class="d-flex justify-content-between mb-2"><h6 class="fw-bold m-0">کاریگر / ماسٹر</h6><button class="btn btn-success" data-act="karNew">➕ نیا کاریگر</button></div>' + UI.list({
        key: 'kar', keepState: true, placeholder: 'نام، موبائل یا نمبر', icon: '🧑‍🏭', empty: 'ابھی کوئی کاریگر شامل نہیں۔ نیا کاریگر شامل کریں۔',
        filters: [{ name: 'a', def: 'a', opts: [['a', 'فعال'], ['', 'تمام'], ['i', 'غیر فعال']] }],
        items: st => DB.karigars.all().filter(k => (st.f.a === '' || (st.f.a === 'a' ? k.active !== false : k.active === false)) && UI.match(st.q, k.name, k.mobile, k.no, k.skill)),
        row: k => { const b = Kar.balance(k.id); return UI.row({ title: U.esc(k.name) + (k.active === false ? ' ' + UI.badge('غیر فعال') : ''), sub: U.phone(k.mobile) + ' ' + U.code(k.no) + (k.skill ? ' · ' + U.esc(k.skill) : ''), extra: (k.workTypes || []).map(x => '<span class="chip">' + x + '</span>').join('') + ' <span class="chip">جاری: ' + b.open + '</span>', href: '#/karigar/' + k.id, right: '<div class="fw-bold ' + (b.balance > 0 ? 'text-danger' : '') + '">' + U.num(b.balance) + '</div><div class="small text-muted">بقایا</div>' }); }
      });
    }
    App.render(h);
  }
  App.route('karigars', page);

  function profile(args) {
    const k = DB.karigars.get(args[0]); if (!k) return App.render(UI.empty('❓', 'کاریگر نہیں ملا'));
    const tab = args[1] || 'work'; App.title(k.name); const b = Kar.balance(k.id);
    let h = '<div class="card-box mb-3"><div class="d-flex justify-content-between"><div><div class="fs-4 fw-bold">' + U.esc(k.name) + '</div><div class="text-muted">' + U.code(k.no) + (k.skill ? ' · ' + U.esc(k.skill) : '') + '</div>' + (k.mobile ? '<div>📞 <a href="tel:' + U.esc(k.mobile) + '">' + U.phone(k.mobile) + '</a></div>' : '') + (k.address ? '<div class="small text-muted">' + U.esc(k.address) + '</div>' : '') + '<div>' + (k.workTypes || []).map(x => '<span class="chip">' + x + '</span>').join('') + '</div></div><div><button class="btn btn-sm btn-light" data-act="karEdit" data-id="' + k.id + '">✏️</button></div></div>' +
      '<div class="d-flex flex-wrap gap-2 mt-3"><button class="btn btn-success" data-act="payPayout" data-party="karigar" data-id="' + k.id + '">💵 ادائیگی کریں</button><button class="btn btn-outline-success" data-act="karPick">کام دیں</button><button class="btn btn-outline-secondary" data-act="karStatement" data-id="' + k.id + '">🖨 اسٹیٹمنٹ</button></div></div>';
    h += '<div class="row g-2 mb-3">' + UI.stat('کل کام', b.jobs + ' (مکمل ' + b.done + ')', '', null, 'col-6 col-md-3') + UI.stat('کل پیس', U.num(b.pieces), 'blue', null, 'col-6 col-md-3') + UI.stat('کل اجرت', U.rs(b.wages), 'gold', null, 'col-6 col-md-3') + UI.stat('مکمل کام کی اجرت', U.rs(b.earned), '', null, 'col-6 col-md-3') + UI.stat('ادا شدہ', U.rs(b.paid), '', null, 'col-6 col-md-3') + UI.stat('بقایا', U.rs(b.balance), b.balance > 0 ? 'bad' : '', null, 'col-6 col-md-3') + '</div>';
    h += UI.tabs([[k.id + '/work', 'آرڈر وار کام'], [k.id + '/ledger', 'لیجر']], k.id + '/' + tab, 'karigar');
    if (tab === 'ledger') { const L = Kar.ledger(k.id); h += UI.card('کاریگر لیجر', Reports.tableHtml({ head: ['تاریخ', 'تفصیل', 'ادائیگی', 'اجرت', 'بقایا'], aligns: ['', '', 'n', 'n', 'n'], rows: L.map(x => [U.fd(x.date), x.desc, x.dr ? U.num(x.dr) : '', x.cr ? U.num(x.cr) : '', U.num(x.bal)]), foot: ['', 'کل', U.num(b.paid), U.num(b.earned), U.num(b.balance)], key: 'karledger' })); }
    else { const as = DB.assignments.of('karigarId', k.id).slice().sort((a, b2) => b2.createdAt - a.createdAt); h += as.length ? '<div class="vstack gap-2">' + as.map(Kar.asgCard).join('') + '</div>' : UI.empty('🧑‍🏭', 'ابھی کوئی کام نہیں دیا گیا'); }
    App.render(h);
  }
  App.route('karigar', profile);
  App.act.karStatement = $b => Reports.open('kar_balance', { kar: $b.data('id') });

  w.Kar = Kar;
})(window);
