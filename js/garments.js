/* garments.js — garments (items of an order): editor, fabric info, status workflow, fabrics page */
(function (w) {
  'use strict';
  const Garm = {};
  const ST = ['نیا', 'پیمائش مکمل', 'کپڑا موصول', 'کاریگر کو دیا', 'زیرِ سلائی', 'چیکنگ', 'تیار', 'ڈیلیوری کے لیے تیار', 'ڈیلیور', 'آلٹریشن', 'منسوخ'];
  const RANK = { 'نیا': 0, 'پیمائش مکمل': 1, 'کپڑا موصول': 2, 'کاریگر کو دیا': 3, 'زیرِ سلائی': 4, 'آلٹریشن': 4.5, 'چیکنگ': 5, 'تیار': 6, 'ڈیلیوری کے لیے تیار': 7, 'ڈیلیور': 8 };
  const COLOR = { 'نیا': 'secondary', 'پیمائش مکمل': 'info', 'کپڑا موصول': 'info', 'کاریگر کو دیا': 'primary', 'زیرِ سلائی': 'primary', 'چیکنگ': 'warning', 'تیار': 'success', 'ڈیلیوری کے لیے تیار': 'success', 'ڈیلیور': 'dark', 'آلٹریشن': 'warning', 'منسوخ': 'danger' };
  const FAB = ['موصول', 'کٹنگ', 'سلائی کے لیے دیا گیا', 'زیرِ سلائی', 'تیار', 'واپس گاہک کو'];
  const FAB_OF = { 'کپڑا موصول': 'موصول', 'کاریگر کو دیا': 'سلائی کے لیے دیا گیا', 'زیرِ سلائی': 'زیرِ سلائی', 'تیار': 'تیار', 'ڈیلیوری کے لیے تیار': 'تیار', 'ڈیلیور': 'واپس گاہک کو' };
  Garm.ST = ST; Garm.RANK = RANK; Garm.FAB = FAB;
  Garm.badge = s => UI.badge(s, COLOR[s] || 'secondary');
  Garm.READY = ['تیار', 'ڈیلیوری کے لیے تیار'];

  Garm.blank = function (typeId, custGetter) {
    const t = DB.garmentTypes.get(typeId);
    return { typeId, qty: 1, rate: t && t.rate ? t.rate : '', fabric: { kind: '', color: '', design: '', owner: 'customer', qty: '', receivedDate: U.today(), ident: '', note: '', status: 'موصول' }, style: '', instructions: '', measure: Meas.newState(typeId), assign: { karigarId: '', rate: '', dueDate: '' } };
  };

  // ---------- editor modal ----------
  Garm.edit = function (draft, opts) {
    opts = opts || {};
    const f = draft.fabric, d = draft;
    const types = Meas.typeOptions(d.typeId);
    const kars = DB.karigars.filter(k => k.active !== false);
    const ctl = UI.modal({
      title: opts.title || (opts.isNew ? 'گارمنٹ شامل کریں' : 'گارمنٹ میں ترمیم'), form: 'garmSave', size: 'xl', static: true, noFocus: true,
      body: '<div class="vstack gap-3">' +
        '<div class="step-card"><div class="fw-bold mb-2">1) گارمنٹ</div><div class="row g-2">' +
        UI.field({ label: 'گارمنٹ کی قسم', name: 'typeId', type: 'select', html: types, cls: 'col-12 col-md-5' }) + UI.field({ label: 'تعداد', name: 'qty', type: 'num', value: d.qty, req: 1, cls: 'col-4 col-md-2' }) +
        UI.field({ label: 'سلائی ریٹ (فی پیس)', name: 'rate', type: 'num', value: d.rate, req: 1, cls: 'col-4 col-md-3' }) + '<div class="col-4 col-md-2"><label class="form-label mb-1">رقم</label><div class="form-control bg-light fw-bold" id="gAmt">0</div></div></div></div>' +
        '<div class="step-card"><div class="fw-bold mb-2">2) کپڑے کی معلومات</div><div class="row g-2">' +
        UI.field({ label: 'کپڑے کی قسم', name: 'fKind', value: f.kind, ph: 'مثلاً واش اینڈ ویئر، کاٹن', cls: 'col-6 col-md-3' }) + UI.field({ label: 'رنگ', name: 'fColor', value: f.color, cls: 'col-6 col-md-3' }) + UI.field({ label: 'ڈیزائن', name: 'fDesign', value: f.design, cls: 'col-6 col-md-3' }) +
        UI.field({ label: 'کپڑے کا مالک', name: 'fOwner', type: 'select', html: UI.opts([['customer', 'گاہک'], ['shop', 'دکان']], f.owner), cls: 'col-6 col-md-3' }) +
        UI.field({ label: 'کپڑے کی مقدار', name: 'fQty', value: f.qty, ph: 'مثلاً 3 میٹر', cls: 'col-6 col-md-3' }) + UI.field({ label: 'موصول ہونے کی تاریخ', name: 'fDate', type: 'date', value: f.receivedDate, cls: 'col-6 col-md-3' }) +
        UI.field({ label: 'کپڑے کی شناخت', name: 'fIdent', value: f.ident, ph: 'نشانی / ٹکڑا نمبر', cls: 'col-6 col-md-3' }) + UI.field({ label: 'کپڑے کی حالت', name: 'fStatus', type: 'select', html: UI.opts(FAB, f.status), cls: 'col-6 col-md-3' }) +
        UI.field({ label: 'کپڑے کے نوٹس', name: 'fNote', value: f.note }) + '</div></div>' +
        '<div class="step-card"><div class="fw-bold mb-2">3) ڈیزائن / ہدایات</div><div class="row g-2">' +
        UI.field({ label: 'ڈیزائن / اسٹائل', name: 'style', type: 'textarea', rows: 2, value: d.style, ph: 'مثلاً گول گلا، چاک، کف والی آستین', cls: 'col-12 col-md-6' }) + UI.field({ label: 'خصوصی ہدایات', name: 'instructions', type: 'textarea', rows: 2, value: d.instructions, cls: 'col-12 col-md-6' }) + '</div></div>' +
        '<div class="step-card"><div class="fw-bold mb-2">4) پیمائش</div><div id="gMeas">' + Meas.widget(d.measure, () => opts.customerId && opts.customerId()) + '</div></div>' +
        (opts.isNew ? '<div class="step-card"><div class="fw-bold mb-2">5) کاریگر (اختیاری)</div><div class="row g-2">' + UI.field({ label: 'کاریگر', name: 'aKar', type: 'select', html: '<option value="">— بعد میں دیں گے —</option>' + kars.map(k => '<option value="' + k.id + '" data-rate="' + (k.rate || '') + '"' + (d.assign.karigarId === k.id ? ' selected' : '') + '>' + U.esc(k.name) + '</option>').join(''), cls: 'col-12 col-md-5' }) + UI.field({ label: 'کاریگر کا ریٹ (فی پیس)', name: 'aRate', type: 'num', value: d.assign.rate, cls: 'col-6 col-md-3' }) + UI.field({ label: 'متوقع تکمیل', name: 'aDue', type: 'date', value: d.assign.dueDate, cls: 'col-6 col-md-4' }) + '</div></div>' : '') +
        '</div>', ok: 'محفوظ کریں'
    });
    const $m = ctl.$el;
    const calc = () => $m.find('#gAmt').text(U.num(U.n($m.find('[name=qty]').val()) * U.n($m.find('[name=rate]').val())));
    $m.on('input', '[name=qty],[name=rate]', calc); calc();
    $m.on('change', '[name=typeId]', function () {
      const oldT = DB.garmentTypes.get(d.typeId), t = DB.garmentTypes.get(this.value); Meas.sync($m);
      const old = {}; d.measure.fields.forEach(x => { if (x.v) old[x.n] = x.v; });
      d.typeId = this.value; d.measure = Meas.newState(d.typeId); d.measure.fields.forEach(x => { if (old[x.n]) x.v = old[x.n]; });
      const id = $m.find('.mwidget').data('mw'); Meas.W[id].m = d.measure; Meas.redraw(id);
      const $r = $m.find('[name=rate]'); if (t && t.rate && (!U.n($r.val()) || (oldT && U.n($r.val()) === oldT.rate))) { $r.val(t.rate); calc(); }
    });
    $m.on('change', '[name=aKar]', function () { const r = $(this).find(':selected').data('rate'); const $r = $m.find('[name=aRate]'); if (r && !U.n($r.val())) $r.val(r); });
    ctl.$el.data('draft', d); ctl.$el.data('opts', opts);
  };
  App.forms.garmSave = ($f, m) => {
    const v = UI.vals($f), d = m.$el.data('draft'), opts = m.$el.data('opts');
    if (U.n(v.qty) <= 0) return UI.toast('تعداد درست نہیں', 'warning');
    Meas.sync($f);
    const miss = d.measure.fields.filter(x => x.req && !String(x.v || '').trim());
    if (miss.length) return UI.toast('لازمی پیمائش درج کریں: ' + miss.map(x => x.n).join('، '), 'warning');
    d.typeId = v.typeId; d.qty = U.n(v.qty); d.rate = U.n(v.rate); d.style = v.style; d.instructions = v.instructions;
    d.fabric = { kind: v.fKind, color: v.fColor, design: v.fDesign, owner: v.fOwner, qty: v.fQty, receivedDate: v.fDate, ident: v.fIdent, note: v.fNote, status: v.fStatus };
    d.measure.typeId = v.typeId;
    if (opts.isNew) d.assign = { karigarId: v.aKar || '', rate: U.n(v.aRate), dueDate: v.aDue || '' };
    m.close(); if (opts.onSave) opts.onSave(d);
  };

  // ---------- persistence ----------
  Garm.initialStatus = d => Meas.hasValues(d.measure) ? (d.fabric.receivedDate && d.fabric.status ? 'کپڑا موصول' : 'پیمائش مکمل') : (d.fabric.receivedDate ? 'کپڑا موصول' : 'نیا');
  Garm.create = function (order, d) {
    const t = DB.garmentTypes.get(d.typeId);
    order.garmentSeq = (order.garmentSeq || 0) + 1;
    const meas = Meas.record(order.customerId, d.typeId, d.measure, { orderId: order.id });
    const st = Garm.initialStatus(d);
    const g = DB.garments.add({
      orderId: order.id, customerId: order.customerId, no: order.no + '/' + order.garmentSeq, tag: DB.next('tag'), typeId: d.typeId, typeName: Meas.typeLabel(t),
      qty: d.qty, rate: d.rate, amount: U.round(d.qty * d.rate), fabric: d.fabric, style: d.style, instructions: d.instructions,
      measure: { tplId: d.measure.tplId, fields: Meas.filled(d.measure.fields), notes: d.measure.notes || '' }, measurementId: meas ? meas.id : '',
      status: st, dueDate: order.dueDate, assignmentId: null, history: [{ at: Date.now(), s: st }]
    });
    if (meas && !meas.garmentId) DB.measurements.update(meas.id, { garmentId: g.id });
    return g;
  };
  Garm.update = function (g, d) {
    const t = DB.garmentTypes.get(d.typeId);
    const meas = Meas.record(g.customerId, d.typeId, d.measure, { orderId: g.orderId, garmentId: g.id });
    DB.garments.update(g.id, {
      typeId: d.typeId, typeName: Meas.typeLabel(t), qty: d.qty, rate: d.rate, amount: U.round(d.qty * d.rate), fabric: d.fabric, style: d.style, instructions: d.instructions,
      measure: { tplId: d.measure.tplId, fields: Meas.filled(d.measure.fields), notes: d.measure.notes || '' }, measurementId: meas ? meas.id : g.measurementId
    });
    DB.log('garment', 'گارمنٹ اپ ڈیٹ: ' + g.tag, { t: 'order', id: g.orderId });
  };
  Garm.toDraft = function (g) {
    return { id: g.id, typeId: g.typeId, qty: g.qty, rate: g.rate, fabric: Object.assign({}, g.fabric), style: g.style, instructions: g.instructions, assign: { karigarId: '', rate: '', dueDate: '' },
      measure: Object.assign(Meas.overlay(g.typeId, g.measure.tplId, g.measure.fields), { notes: g.measure.notes }) };
  };

  Garm.setStatus = function (id, status, o) {
    o = o || {}; const g = DB.garments.get(id); if (!g || g.status === status) return;
    if (g.status === 'ڈیلیور' && !o.force) return UI.toast('ڈیلیور شدہ گارمنٹ کی حالت نہیں بدل سکتی', 'warning');
    const hist = (g.history || []).concat([{ at: Date.now(), s: status, n: o.note || '' }]);
    const patch = { status, history: hist };
    if (FAB_OF[status] && g.fabric) patch.fabric = Object.assign({}, g.fabric, { status: FAB_OF[status] });
    if (status === 'ڈیلیور') patch.deliveredAt = Date.now();
    DB.garments.update(id, patch);
    DB.log(status === 'تیار' ? 'garment-done' : 'garment', 'گارمنٹ ' + g.tag + ' (' + g.typeName + '): ' + status, { t: 'order', id: g.orderId });
    if (!o.fromAssign) Kar.onGarmentStatus(g, status);
    Ord.refresh(g.orderId);
  };
  Garm.cancel = function (id) {
    const g = DB.garments.get(id);
    DB.assignments.of('garmentId', id).forEach(a => { if (a.status !== 'منسوخ') Kar.setStatus(a.id, 'منسوخ', { note: 'گارمنٹ منسوخ' }); });
    Garm.setStatus(id, 'منسوخ', { fromAssign: true }); Ord.recalc(g.orderId);
  };

  Garm.fabricLine = g => { const f = g.fabric || {}; return [f.kind, f.color, f.design].filter(Boolean).map(U.esc).join(' · ') + (f.qty ? ' · ' + U.esc(f.qty) : '') + ' · مالک: ' + (f.owner === 'shop' ? 'دکان' : 'گاہک'); };
  Garm.flow = function (g) {
    const cur = RANK[g.status]; if (g.status === 'منسوخ') return '';
    const steps = ['نیا', 'پیمائش مکمل', 'کپڑا موصول', 'کاریگر کو دیا', 'زیرِ سلائی', 'چیکنگ', 'تیار', 'ڈیلیور'];
    return '<div class="status-flow">' + steps.map(s => '<span class="sf ' + (RANK[s] < cur ? 'done' : s === g.status || (RANK[s] === Math.floor(cur) && g.status === 'آلٹریشن') ? 'cur' : '') + '">' + s + '</span>').join('') + '</div>';
  };
  Garm.card = function (g, o) {
    o = o || {};
    const a = g.assignmentId && DB.assignments.get(g.assignmentId), k = a && DB.karigars.get(a.karigarId), canceled = g.status === 'منسوخ', delivered = g.status === 'ڈیلیور';
    return '<div class="garment-card ' + (canceled ? 'opacity-50' : '') + '"><div class="d-flex justify-content-between gap-2"><div class="min-w-0"><div class="fw-bold fs-6">' + U.esc(g.typeName) + ' × ' + U.num(g.qty) + ' ' + Garm.badge(g.status) + '</div>' +
      '<div class="small text-muted">' + U.code(g.tag) + ' · ' + U.code(g.no) + '</div><div class="small">🧵 ' + Garm.fabricLine(g) + '</div>' +
      (k ? '<div class="small">🧑‍🏭 ' + U.esc(k.name) + ' · ' + U.esc(a.status) + '</div>' : '') + (g.style ? '<div class="small text-muted">✂️ ' + U.esc(g.style) + '</div>' : '') + (g.instructions ? '<div class="small text-danger">⚠ ' + U.esc(g.instructions) + '</div>' : '') + '</div>' +
      '<div class="text-end text-nowrap"><div class="fw-bold">' + U.num(g.amount) + '</div><div class="small text-muted">' + U.num(g.rate) + ' فی پیس</div></div></div>' +
      (o.actions === false || canceled ? '' : Garm.flow(g) + '<div class="d-flex flex-wrap gap-1 mt-2">' +
        (delivered ? '' : '<button class="btn btn-sm btn-outline-success" data-act="garmStatus" data-id="' + g.id + '">حالت بدلیں</button><button class="btn btn-sm btn-outline-success" data-act="garmNext" data-id="' + g.id + '">اگلا مرحلہ ▶</button><button class="btn btn-sm btn-outline-primary" data-act="karAssign" data-gid="' + g.id + '">🧑‍🏭 ' + (a && a.status !== 'منسوخ' ? 'کاریگر بدلیں' : 'کاریگر کو دیں') + '</button><button class="btn btn-sm btn-outline-secondary" data-act="garmEdit" data-id="' + g.id + '">✏️</button>') +
        '<button class="btn btn-sm btn-outline-secondary" data-act="garmMeas" data-id="' + g.id + '">📏</button><button class="btn btn-sm btn-outline-secondary" data-act="tagPrint" data-id="' + g.id + '">🏷 ٹیگ</button><button class="btn btn-sm btn-outline-secondary" data-act="slipPrint" data-id="' + g.id + '">📄 سلپ</button>' +
        (delivered ? '' : '<button class="btn btn-sm btn-outline-danger" data-act="garmCancel" data-id="' + g.id + '">منسوخ</button>') + '</div>') + '</div>';
  };
  App.act.garmEdit = $b => {
    const g = DB.garments.get($b.data('id'));
    Garm.edit(Garm.toDraft(g), { customerId: () => g.customerId, title: 'گارمنٹ میں ترمیم: ' + g.tag, onSave: d => { Garm.update(g, d); Ord.recalc(g.orderId); UI.toast('گارمنٹ اپ ڈیٹ ہو گیا'); App.refresh(); } });
  };
  App.act.garmMeas = $b => {
    const g = DB.garments.get($b.data('id'));
    UI.modal({ title: 'پیمائش: ' + g.typeName + ' (' + g.tag + ')', body: '<div class="meas-grid">' + g.measure.fields.map(f => '<div class="meas-cell"><label>' + U.esc(f.n) + '</label><div class="fw-bold border-bottom">' + (U.esc(f.v) || '—') + ' <small class="text-muted">' + (f.v ? U.esc(f.u) : '') + '</small></div></div>').join('') + '</div>' + (g.measure.notes ? '<div class="mt-2 text-muted">' + U.esc(g.measure.notes) + '</div>' : '') });
  };
  App.act.garmStatus = $b => {
    const g = DB.garments.get($b.data('id'));
    const ctl = UI.modal({ title: 'حالت بدلیں: ' + g.typeName, size: 'sm', body: '<div class="vstack gap-2">' + ST.filter(s => s !== 'ڈیلیور' && s !== 'منسوخ').map(s => '<button class="btn ' + (s === g.status ? 'btn-success' : 'btn-outline-secondary') + '" data-s="' + s + '">' + s + '</button>').join('') + '</div><div class="small text-muted mt-2">ڈیلیوری کے لیے ڈیلیوری صفحہ استعمال کریں۔</div>' });
    ctl.$el.on('click', '[data-s]', function () { Garm.setStatus(g.id, $(this).data('s')); ctl.close(); App.refresh(); });
  };
  App.act.garmNext = $b => {
    const g = DB.garments.get($b.data('id')), order = ['نیا', 'پیمائش مکمل', 'کپڑا موصول', 'کاریگر کو دیا', 'زیرِ سلائی', 'چیکنگ', 'تیار', 'ڈیلیوری کے لیے تیار'];
    const i = order.indexOf(g.status), nx = g.status === 'آلٹریشن' ? 'چیکنگ' : order[i + 1];
    if (!nx) return UI.toast('اب ڈیلیوری صفحے سے ڈیلیور کریں', 'warning');
    Garm.setStatus(g.id, nx); App.refresh();
  };
  App.act.garmCancel = $b => UI.confirm('یہ گارمنٹ منسوخ کریں؟ آرڈر کا کل بل کم ہو جائے گا۔', { danger: true }).then(ok => { if (ok) { Garm.cancel($b.data('id')); UI.toast('گارمنٹ منسوخ ہو گیا'); App.refresh(); } });

  // ---------- fabrics page ----------
  function fabricsPage() {
    App.title('کپڑے');
    App.render('<h6 class="fw-bold">زیرِ انتظام کپڑے</h6>' + UI.list({
      key: 'fab', keepState: true, placeholder: 'گاہک، رنگ، کپڑے کی قسم، ٹیگ یا آرڈر', icon: '🧵', empty: 'کوئی کپڑا ریکارڈ نہیں',
      filters: [{ name: 'st', opts: [['', 'تمام حالتیں']].concat(FAB.map(s => [s, s])) }, { name: 'ow', opts: [['', 'مالک: سب'], ['customer', 'گاہک کا'], ['shop', 'دکان کا']] }, { name: 'act', def: 'open', opts: [['open', 'زیرِ کام'], ['', 'تمام']] }],
      items: st => DB.garments.all().filter(g => g.status !== 'منسوخ' && (!st.f.act || g.status !== 'ڈیلیور') && (!st.f.st || (g.fabric || {}).status === st.f.st) && (!st.f.ow || (g.fabric || {}).owner === st.f.ow) &&
        UI.match(st.q, ((g.fabric || {}).kind || ''), ((g.fabric || {}).color || ''), ((g.fabric || {}).design || ''), ((g.fabric || {}).ident || ''), g.tag, g.no, Cust.name(g.customerId), g.typeName)).sort((a, b) => b.createdAt - a.createdAt),
      row: g => { const o = DB.orders.get(g.orderId) || {}; return '<div class="item-card"><div class="d-flex justify-content-between gap-2"><div class="min-w-0"><div class="fw-bold">' + Garm.fabricLine(g) + '</div><div class="small text-muted"><a href="#/order/' + g.orderId + '">' + U.code(o.no) + '</a> · ' + U.esc(Cust.name(g.customerId)) + ' · ' + U.esc(g.typeName) + ' · ' + U.code(g.tag) + '</div>' +
        '<div class="small">موصول: ' + U.fd((g.fabric || {}).receivedDate) + ((g.fabric || {}).ident ? ' · شناخت: ' + U.esc(g.fabric.ident) : '') + '</div></div><div>' + Garm.badge(g.status) + '</div></div>' +
        '<select class="form-select form-select-sm mt-2 fab-st" data-id="' + g.id + '">' + UI.opts(FAB, (g.fabric || {}).status) + '</select></div>'; }
    }));
  }
  App.route('fabrics', fabricsPage);
  $(document).on('change', '.fab-st', function () { const g = DB.garments.get($(this).data('id')); DB.garments.update(g.id, { fabric: Object.assign({}, g.fabric, { status: this.value }) }); UI.toast('کپڑے کی حالت اپ ڈیٹ ہو گئی'); });

  w.Garm = Garm;
})(window);
