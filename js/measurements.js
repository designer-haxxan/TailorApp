/* measurements.js — garment types, measurement templates (builder), measurement widget, records & history */
(function (w) {
  'use strict';
  const Meas = { W: {} };
  let wseq = 0;

  // field spec: 'نام' (inch) or 'نام~' (free-text, no unit)
  const T = {
    sq: 'قمیض لمبائی,سینہ,کمر,ہپ,کندھا,آستین لمبائی,بازو,کلائی,کف~,گلا,دامن,چاک~,کالر~,فرنٹ~,بیک~,جیب~,پٹی~,بٹن~,شلوار لمبائی,ران,گھٹنا,پائنچہ,موہری,بیلٹ~,ازار بند~,شلوار جیب~,دیگر~',
    q: 'قمیض لمبائی,سینہ,کمر,ہپ,کندھا,آستین لمبائی,بازو,کلائی,کف~,گلا,دامن,چاک~,کالر~,فرنٹ~,بیک~,جیب~,پٹی~,بٹن~,دیگر~',
    s: 'شلوار لمبائی,کمر,ہپ,ران,گھٹنا,پائنچہ,موہری,بیلٹ~,ازار بند~,جیب~',
    kurta: 'لمبائی,سینہ,کمر,ہپ,کندھا,آستین,بازو,کف~,گلا,دامن,چاک~,کالر~',
    pant: 'لمبائی,کمر,ہپ,ران,گھٹنا,پائنچہ,موہری,فرنٹ رائز,بیک رائز,جیب~,بیلٹ~,پلیٹ~',
    wc: 'لمبائی,سینہ,کمر,ہپ,کندھا,آرم ہول,گلا,جیب~,بٹن~',
    coat: 'لمبائی,سینہ,کمر,ہپ,کندھا,آستین,بازو,کلائی,گلا,آرم ہول,بیک,فرنٹ,جیب~,کالر~,بٹن~,ٹراؤزر لمبائی,ٹراؤزر کمر,ٹراؤزر ہپ,ٹراؤزر ران,ٹراؤزر پائنچہ',
    sher: 'لمبائی,سینہ,کمر,ہپ,کندھا,آستین,بازو,کلائی,گلا,آرم ہول,کالر~,بٹن~,جیب~,شلوار لمبائی,پائنچہ',
    lq: 'لمبائی,سینہ,کمر,ہپ,شولڈر,آستین,بازو,گلا,دامن,چاک~,گھیر,جیب~,دیگر~',
    ls: 'لمبائی,کمر,ہپ,ران,گھٹنا,پائنچہ,گھیر,جیب~',
    frock: 'لمبائی,سینہ,کمر,ہپ,شولڈر,آستین,بازو,گلا,دامن,چاک~,گھیر',
    maxi: 'لمبائی,سینہ,کمر,ہپ,شولڈر,آستین,بازو,گلا,گھیر,چاک~',
    lehnga: 'لمبائی,کمر,ہپ,گھیر,جیب~,دیگر~',
    blouse: 'لمبائی,سینہ,کمر,شولڈر,آستین,بازو,گلا,آرم ہول,فرنٹ~,بیک~',
    dup: 'لمبائی,چوڑائی,کنارہ~',
    other: 'لمبائی,سینہ,کمر,ہپ,دیگر~'
  };
  const TYPES = [
    ['m_sq', 'شلوار قمیض', 'M', 'sq'], ['m_q', 'قمیض', 'M', 'q'], ['m_s', 'شلوار', 'M', 's'], ['m_kurta', 'کُرتا', 'M', 'kurta'], ['m_paj', 'پاجامہ', 'M', 's'],
    ['m_pant', 'پینٹ', 'M', 'pant'], ['m_trs', 'ٹراؤزر', 'M', 'pant'], ['m_wc', 'ویسٹ کوٹ', 'M', 'wc'], ['m_coat', 'کوٹ', 'M', 'coat'], ['m_sher', 'شیروانی', 'M', 'sher'],
    ['m_pc', 'پینٹ کوٹ', 'M', 'coat'], ['m_suit', 'سوٹ', 'M', 'coat'], ['m_qs', 'قمیض شلوار', 'M', 'sq'],
    ['l_q', 'قمیض', 'L', 'lq'], ['l_s', 'شلوار', 'L', 'ls'], ['l_paj', 'پاجامہ', 'L', 'ls'], ['l_trs', 'ٹراؤزر', 'L', 'ls'], ['l_frock', 'فراک', 'L', 'frock'],
    ['l_maxi', 'میکسی', 'L', 'maxi'], ['l_lehnga', 'لہنگا', 'L', 'lehnga'], ['l_shirt', 'شرٹ', 'L', 'lq'], ['l_blouse', 'بلاؤز', 'L', 'blouse'],
    ['l_dup', 'دوپٹہ', 'L', 'dup'], ['l_other', 'دیگر', 'L', 'other']
  ];
  const rid = () => Math.random().toString(36).slice(2, 8);
  const spec2fields = s => s.split(',').map(x => { const txt = x.endsWith('~'); return { id: rid(), n: txt ? x.slice(0, -1) : x, u: txt ? '' : 'انچ', req: false, def: '', note: '' }; });

  DB.seeders.push(function () {
    TYPES.forEach(t => {
      DB.garmentTypes.add({ id: 'gt_' + t[0], name: t[1], gender: t[2], rate: 0, custom: false, active: true });
      DB.templates.add({ id: 'tpl_' + t[0], typeId: 'gt_' + t[0], name: 'معیاری', fields: spec2fields(T[t[3]]), isDefault: true });
    });
  });

  Meas.typeLabel = t => t ? t.name + (t.gender === 'L' ? ' (زنانہ)' : '') : '—';
  Meas.types = () => DB.garmentTypes.filter(t => t.active !== false);
  Meas.typeOptions = function (sel) {
    const g = { M: 'مردانہ', L: 'زنانہ', O: 'دیگر' }; let h = '';
    ['M', 'L', 'O'].forEach(k => {
      const list = Meas.types().filter(t => t.gender === k); if (!list.length) return;
      h += '<optgroup label="' + g[k] + '">' + list.map(t => '<option value="' + t.id + '"' + (t.id === sel ? ' selected' : '') + '>' + U.esc(t.name) + '</option>').join('') + '</optgroup>';
    });
    return h;
  };
  Meas.templatesFor = typeId => DB.templates.of('typeId', typeId);
  Meas.defaultTemplate = typeId => { const l = Meas.templatesFor(typeId); return l.find(t => t.isDefault) || l[0] || null; };
  Meas.fieldsOf = tpl => tpl ? tpl.fields.map(f => ({ n: f.n, u: f.u, v: f.def || '', req: !!f.req, note: f.note || '' })) : [{ n: 'لمبائی', u: 'انچ', v: '', req: false, note: '' }];
  Meas.newState = function (typeId, tplId) {
    const tpl = (tplId && DB.templates.get(tplId)) || Meas.defaultTemplate(typeId);
    return { typeId, tplId: tpl ? tpl.id : '', fields: Meas.fieldsOf(tpl), notes: '', fromId: '' };
  };
  // template fields + values taken from saved (filled-only) fields; unknown saved fields are appended
  Meas.overlay = function (typeId, tplId, saved) {
    const st = Meas.newState(typeId, tplId), by = {}; (saved || []).forEach(f => { by[f.n] = f; });
    const used = {};
    st.fields.forEach(f => { if (by[f.n]) { f.v = by[f.n].v; used[f.n] = 1; } else f.v = ''; });
    (saved || []).forEach(f => { if (!used[f.n]) st.fields.push({ n: f.n, u: f.u, v: f.v, req: false, note: '' }); });
    return st;
  };
  Meas.filled = fields => fields.filter(f => String(f.v || '').trim()).map(f => ({ n: f.n, u: f.u, v: f.v }));
  Meas.history = (cid, typeId) => DB.measurements.of('customerId', cid).filter(m => !typeId || m.typeId === typeId).sort((a, b) => b.createdAt - a.createdAt);
  Meas.latest = (cid, typeId) => Meas.history(cid, typeId)[0];
  Meas.hasValues = m => m.fields.some(f => String(f.v || '').trim()) || (m.notes || '').trim();
  Meas.sig = m => JSON.stringify(Meas.filled(m.fields).map(f => [f.n, f.v])) + '|' + (m.notes || '');
  // store a measurement record (history is never overwritten; identical to latest -> reuse)
  Meas.record = function (cid, typeId, m, extra) {
    if (!cid || !Meas.hasValues(m)) return null;
    const last = Meas.latest(cid, typeId);
    if (last && Meas.sig(last) === Meas.sig(m)) return last;
    const t = DB.garmentTypes.get(typeId);
    return DB.measurements.add(Object.assign({
      customerId: cid, typeId, typeName: Meas.typeLabel(t), templateId: m.tplId || '', date: U.today(),
      fields: Meas.filled(m.fields), notes: m.notes || ''
    }, extra || {}));
  };

  // ---------- field editor (shared by template builder and garment widget) ----------
  function feRow(f, i, mode) {
    return '<div class="draggable-row fe-row" data-orig="' + (f._o != null ? f._o : i) + '" data-v="' + U.esc(f.v || '') + '"><div class="row g-1 align-items-center">' +
      '<div class="col-7"><input class="form-control form-control-sm fe-n" placeholder="پیمائش کا نام" value="' + U.esc(f.n) + '"></div>' +
      '<div class="col-5"><input class="form-control form-control-sm fe-u" placeholder="یونٹ" value="' + U.esc(f.u) + '"></div>' +
      (mode === 'tpl' ? '<div class="col-6"><input class="form-control form-control-sm fe-d" placeholder="ڈیفالٹ قدر" value="' + U.esc(f.def || '') + '"></div>' : '') +
      '<div class="col-' + (mode === 'tpl' ? 6 : 12) + '"><input class="form-control form-control-sm fe-note" placeholder="نوٹ" value="' + U.esc(f.note || '') + '"></div>' +
      '<div class="col-6"><label class="form-check m-0"><input type="checkbox" class="form-check-input fe-req" ' + (f.req ? 'checked' : '') + '> <span class="form-check-label small">لازمی</span></label></div>' +
      '<div class="col-6 text-start"><button type="button" class="btn btn-sm btn-light" data-act="feUp">▲</button> <button type="button" class="btn btn-sm btn-light" data-act="feDown">▼</button> <button type="button" class="btn btn-sm btn-outline-danger" data-act="feDel">🗑</button></div>' +
      '</div></div>';
  }
  Meas.feHtml = (fields, mode) => '<div class="fe" data-mode="' + mode + '">' + fields.map((f, i) => feRow(f, i, mode)).join('') + '</div><button type="button" class="btn btn-outline-success btn-sm mt-1" data-act="feAdd">➕ نئی پیمائش شامل کریں</button>';
  Meas.feRead = function ($root) {
    const out = [];
    $root.find('.fe-row').each(function () {
      const $r = $(this), n = $r.find('.fe-n').val().trim(); if (!n) return;
      out.push({ n, u: $r.find('.fe-u').val().trim(), def: ($r.find('.fe-d').val() || '').trim(), note: $r.find('.fe-note').val().trim(), req: $r.find('.fe-req').is(':checked'), v: $r.attr('data-v') || '', _o: +$r.attr('data-orig') });
    });
    return out;
  };
  App.act.feUp = $b => { const r = $b.closest('.fe-row'); r.prev('.fe-row').before(r); };
  App.act.feDown = $b => { const r = $b.closest('.fe-row'); r.next('.fe-row').after(r); };
  App.act.feDel = $b => $b.closest('.fe-row').remove();
  App.act.feAdd = $b => { const $fe = $b.closest('.modal-body').find('.fe'); $fe.append(feRow({ n: '', u: 'انچ', req: false, def: '', note: '', _o: -1 }, -1, $fe.data('mode'))); $fe.find('.fe-n').last().trigger('focus'); };

  // ---------- measurement widget ----------
  function inner(id) {
    const W = Meas.W[id], m = W.m, tpls = Meas.templatesFor(m.typeId);
    let h = '<div class="d-flex flex-wrap gap-2 align-items-center mb-2">' +
      '<select class="form-select form-select-sm w-auto mw-tpl" ' + (tpls.length ? '' : 'disabled') + '>' + (tpls.length ? tpls.map(t => '<option value="' + t.id + '"' + (t.id === m.tplId ? ' selected' : '') + '>' + U.esc(t.name) + '</option>').join('') : '<option>ٹیمپلیٹ نہیں</option>') + '</select>' +
      '<button type="button" class="btn btn-sm btn-outline-primary" data-act="mwPrev">🕘 پچھلی پیمائش استعمال کریں</button></div>';
    h += '<div class="meas-grid">' + m.fields.map((f, i) => '<div class="meas-cell"><label>' + U.esc(f.n) + (f.req ? ' <span class="text-danger">*</span>' : '') + (f.u ? ' <small class="text-muted">(' + U.esc(f.u) + ')</small>' : '') + '</label>' +
      '<input class="form-control mv" data-i="' + i + '" autocomplete="off" value="' + U.esc(f.v || '') + '"' + (f.note ? ' placeholder="' + U.esc(f.note) + '"' : '') + '></div>').join('') + '</div>';
    h += '<textarea class="form-control mt-2 mw-notes" rows="2" placeholder="پیمائش کے نوٹس">' + U.esc(m.notes || '') + '</textarea>';
    h += '<div class="d-flex flex-wrap gap-2 mt-2"><button type="button" class="btn btn-sm btn-outline-success" data-act="mwAdd">➕ فیلڈ شامل کریں</button>' +
      '<button type="button" class="btn btn-sm btn-outline-secondary" data-act="mwEdit">✏️ نام / ترتیب / حذف</button>' +
      '<button type="button" class="btn btn-sm btn-outline-secondary" data-act="mwSave">💾 ٹیمپلیٹ محفوظ کریں</button></div>';
    if (m.fromId) { const r = DB.measurements.get(m.fromId); if (r) h += '<div class="small text-success mt-1">پچھلی پیمائش (' + U.fd(r.date) + ') لوڈ کی گئی۔ محفوظ کرنے پر نیا ریکارڈ بنے گا، پرانا برقرار رہے گا۔</div>'; }
    return h;
  }
  Meas.widget = function (m, getCust) { const id = 'mw' + (++wseq); Meas.W[id] = { m, getCust }; return '<div class="mwidget" data-mw="' + id + '">' + inner(id) + '</div>'; };
  Meas.sync = function ($root) {
    ($root.hasClass('mwidget') ? $root : $root.find('.mwidget')).each(function () {
      const id = $(this).data('mw'), W = Meas.W[id]; if (!W) return;
      $(this).find('.mv').each(function () { const f = W.m.fields[+$(this).data('i')]; if (f) f.v = this.value.trim(); });
      W.m.notes = $(this).find('.mw-notes').val() || '';
    });
  };
  const wid = $e => $e.closest('.mwidget').data('mw');
  const redraw = id => $('[data-mw=' + id + ']').html(inner(id));
  Meas.redraw = redraw;
  $(document).on('change', '.mw-tpl', function () {
    const id = wid($(this)), W = Meas.W[id]; Meas.sync($(this).closest('.mwidget'));
    const old = {}; W.m.fields.forEach(f => { if (f.v) old[f.n] = f.v; });
    const tpl = DB.templates.get(this.value); W.m.tplId = this.value; W.m.fields = Meas.fieldsOf(tpl);
    W.m.fields.forEach(f => { if (old[f.n]) f.v = old[f.n]; }); redraw(id);
  });
  App.act.mwPrev = $b => {
    const id = wid($b), W = Meas.W[id], cid = W.getCust && W.getCust();
    if (!cid) return UI.toast('پہلے گاہک منتخب کریں', 'warning');
    const hist = Meas.history(cid, W.m.typeId);
    if (!hist.length) return UI.toast('اس گاہک کی اس گارمنٹ کی کوئی پچھلی پیمائش نہیں ملی', 'warning');
    const apply = r => {
      Meas.sync($b.closest('.mwidget'));
      W.m.fields = Meas.overlay(W.m.typeId, W.m.tplId, r.fields).fields; W.m.notes = r.notes || ''; W.m.fromId = r.id; redraw(id);
      UI.toast('پچھلی پیمائش لگا دی گئی');
    };
    const ctl = UI.modal({
      title: 'پچھلی پیمائش منتخب کریں', body: '<div class="vstack gap-2">' + hist.map(r => '<div class="item-card" data-act="mwPick" data-id="' + r.id + '"><div class="fw-bold">' + U.fd(r.date) + ' · ' + U.esc(r.typeName) + '</div><div class="small text-muted">' + r.fields.filter(f => f.v).slice(0, 6).map(f => U.esc(f.n) + ': ' + U.esc(f.v)).join(' | ') + '</div></div>').join('') + '</div>'
    });
    ctl.$el.on('click', '[data-act=mwPick]', function () { apply(DB.measurements.get($(this).data('id'))); ctl.close(); });
  };
  App.act.mwAdd = $b => {
    const id = wid($b), W = Meas.W[id];
    const ctl = UI.modal({
      title: 'نئی پیمائش کا فیلڈ', form: 'mwAdd', size: 'sm', body: '<div class="row g-2">' + UI.field({ label: 'پیمائش کا نام', name: 'n', req: 1, ph: 'مثلاً بغل، گھیر، موہری' }) + UI.field({ label: 'یونٹ', name: 'u', value: 'انچ', help: 'اسٹائل/متن کے لیے خالی چھوڑیں' }) + UI.field({ type: 'check', label: 'لازمی', name: 'req' }) + '</div>', ok: 'شامل کریں'
    });
    ctl.$el.data('wid', id);
  };
  App.forms.mwAdd = ($f, m) => {
    const id = m.$el.data('wid'), W = Meas.W[id], v = UI.vals($f); Meas.sync($('[data-mw=' + id + ']'));
    W.m.fields.push({ n: v.n, u: v.u, v: '', req: v.req, note: '' }); redraw(id); m.close();
  };
  App.act.mwEdit = $b => {
    const id = wid($b), W = Meas.W[id]; Meas.sync($b.closest('.mwidget'));
    const ctl = UI.modal({
      title: 'پیمائش کے فیلڈز', form: 'mwEdit', size: 'lg', body: '<div class="small text-muted mb-2">نام بدلیں، ▲▼ سے ترتیب بدلیں یا اختیاری فیلڈ حذف کریں۔ لازمی فیلڈ حذف نہیں ہو سکتا۔</div>' + Meas.feHtml(W.m.fields.map((f, i) => Object.assign({ _o: i }, f)), 'garment'), ok: 'محفوظ کریں'
    });
    ctl.$el.data('wid', id);
    ctl.$el.on('shown.bs.modal', () => { /* hide delete for required rows */ ctl.$el.find('.fe-row').each(function () { if ($(this).find('.fe-req').is(':checked')) $(this).find('[data-act=feDel]').prop('disabled', true); }); });
    ctl.$el.on('change', '.fe-req', function () { $(this).closest('.fe-row').find('[data-act=feDel]').prop('disabled', this.checked); });
  };
  App.forms.mwEdit = ($f, m) => {
    const id = m.$el.data('wid'), W = Meas.W[id], list = Meas.feRead($f), old = W.m.fields;
    W.m.fields = list.map(f => ({ n: f.n, u: f.u, req: f.req, note: f.note, v: f._o >= 0 && old[f._o] ? old[f._o].v : '' }));
    redraw(id); m.close();
  };
  App.act.mwSave = $b => {
    const id = wid($b), W = Meas.W[id]; Meas.sync($b.closest('.mwidget'));
    const tpls = Meas.templatesFor(W.m.typeId);
    const ctl = UI.modal({
      title: 'ٹیمپلیٹ محفوظ کریں', form: 'mwSave', size: 'sm',
      body: '<div class="row g-2">' + UI.field({ label: 'ٹیمپلیٹ کا نام', name: 'name', req: 1, value: 'میرا ٹیمپلیٹ' }) +
        UI.field({ label: 'محفوظ کرنے کا طریقہ', name: 'mode', type: 'select', html: '<option value="new">نیا ٹیمپلیٹ بنائیں</option>' + tpls.map(t => '<option value="' + t.id + '">موجودہ «' + U.esc(t.name) + '» اپ ڈیٹ کریں</option>').join('') }) + '</div>', ok: 'محفوظ کریں'
    });
    ctl.$el.data('wid', id);
  };
  App.forms.mwSave = ($f, m) => {
    const id = m.$el.data('wid'), W = Meas.W[id], v = UI.vals($f);
    const fields = W.m.fields.map(f => ({ id: rid(), n: f.n, u: f.u, req: f.req, def: '', note: f.note || '' }));
    if (v.mode === 'new') { const t = DB.templates.add({ typeId: W.m.typeId, name: v.name, fields, isDefault: false }); W.m.tplId = t.id; }
    else { DB.templates.update(v.mode, { fields, name: v.name }); W.m.tplId = v.mode; }
    redraw(id); m.close(); UI.toast('ٹیمپلیٹ محفوظ ہو گیا');
  };

  // ---------- measurement records page ----------
  function page(args) {
    const tab = args[0] || 'records';
    App.title('پیمائش');
    let h = UI.tabs([['records', 'پیمائشیں'], ['templates', 'ٹیمپلیٹ بنائیں / ترمیم']], tab, 'measurements');
    if (tab === 'templates') { App.render(h + templatesPage()); return; }
    h += '<div class="d-flex justify-content-between mb-2"><h6 class="fw-bold m-0">گاہکوں کی پیمائشیں</h6><button class="btn btn-success" data-act="measNew">➕ نئی پیمائش</button></div>';
    h += UI.list({
      key: 'meas', keepState: true, placeholder: 'گاہک یا گارمنٹ تلاش کریں', icon: '📏', empty: 'ابھی کوئی پیمائش درج نہیں',
      items: st => DB.measurements.all().filter(m => UI.match(st.q, ((DB.customers.get(m.customerId) || {}).name || ''), m.typeName, ((DB.customers.get(m.customerId) || {}).mobile || ''))).sort((a, b) => b.createdAt - a.createdAt),
      row: m => { const c = DB.customers.get(m.customerId) || {}; return UI.row({ title: U.esc(c.name || '—') + ' · ' + U.esc(m.typeName), sub: U.fd(m.date), extra: m.fields.filter(f => f.v).slice(0, 5).map(f => U.esc(f.n) + ': ' + U.esc(f.v)).join(' | '), right: '<button class="btn btn-sm btn-outline-success" data-act="measView" data-id="' + m.id + '">دیکھیں</button>' }); }
    });
    App.render(h);
  }
  App.route('measurements', page);
  App.act.measNew = $b => Meas.entry($b && $b.data('cid'));
  App.act.measView = $b => {
    const m = DB.measurements.get($b.data('id')), c = DB.customers.get(m.customerId) || {};
    const ctl = UI.modal({
      title: 'پیمائش: ' + U.esc(m.typeName), body: '<div class="mb-2"><b>' + U.esc(c.name) + '</b> · ' + U.fd(m.date) + '</div><div class="meas-grid">' + m.fields.map(f => '<div class="meas-cell"><label>' + U.esc(f.n) + '</label><div class="fw-bold border-bottom">' + (U.esc(f.v) || '—') + ' ' + (f.v ? '<small class="text-muted">' + U.esc(f.u) + '</small>' : '') + '</div></div>').join('') + '</div>' + (m.notes ? '<div class="mt-2 text-muted">' + U.esc(m.notes) + '</div>' : ''),
      footer: '<button class="btn btn-outline-success" data-act="measEdit" data-id="' + m.id + '">✏️ ترمیم (نیا ریکارڈ)</button>' + (DB.settings.allowDestructive ? '<button class="btn btn-outline-danger" data-act="measDel" data-id="' + m.id + '">حذف</button>' : '')
    });
  };
  App.act.measEdit = $b => { const m = DB.measurements.get($b.data('id')); UI.closeAll(); Meas.entry(m.customerId, m); };
  App.act.measDel = $b => UI.confirm('یہ پیمائش ہمیشہ کے لیے حذف کریں؟', { danger: true }).then(ok => { if (ok) { DB.measurements.remove($b.data('id')); UI.closeAll(); App.refresh(); } });

  // new measurement entry (standalone)
  Meas.entry = function (cid, from, done) {
    const typeId = from ? from.typeId : (Meas.types()[0] || {}).id;
    let m = Meas.newState(typeId); if (from) { m = Meas.overlay(typeId, from.templateId, from.fields); m.notes = from.notes || ''; m.fromId = from.id; }
    const holder = { m };
    const ctl = UI.modal({
      title: 'نئی پیمائش', form: 'measSave', size: 'lg', noFocus: true,
      body: '<div class="row g-2 mb-2">' + UI.field({ label: 'گاہک', type: 'raw', html: UI.picker('customerId', 'customer', cid), req: 1, cls: 'col-12 col-md-5' }) +
        UI.field({ label: 'گارمنٹ', name: 'typeId', type: 'select', html: Meas.typeOptions(typeId), cls: 'col-7 col-md-4' }) + UI.field({ label: 'تاریخ', name: 'date', type: 'date', value: U.today(), cls: 'col-5 col-md-3' }) + '</div><div id="mEntry">' + Meas.widget(m, () => ctl.$el.find('[name=customerId]').val()) + '</div>', ok: 'محفوظ کریں'
    });
    ctl.$el.data('m', m); ctl.$el.data('done', done);
    ctl.$el.on('change', '[name=typeId]', function () {
      const ns = Meas.newState(this.value); Object.assign(m, ns);
      const id = ctl.$el.find('.mwidget').data('mw'); Meas.W[id].m = m; Meas.redraw(id);
    });
  };
  App.forms.measSave = ($f, m) => {
    const v = UI.vals($f), st = m.$el.data('m');
    if (!v.customerId) return UI.toast('گاہک منتخب کریں', 'warning');
    Meas.sync($f);
    if (!Meas.hasValues(st)) return UI.toast('کم از کم ایک پیمائش درج کریں', 'warning');
    const r = Meas.record(v.customerId, v.typeId, st, { date: v.date });
    DB.log('measurement', 'پیمائش محفوظ: ' + (DB.customers.get(v.customerId) || {}).name);
    m.close(); UI.toast('پیمائش محفوظ ہو گئی'); const d = m.$el.data('done'); if (d) d(r); App.refresh();
  };

  // ---------- template builder ----------
  function templatesPage() {
    const st = App.state.tplType || (App.state.tplType = (Meas.types()[0] || {}).id);
    let h = '<div class="card-box mb-3"><div class="row g-2 align-items-end"><div class="col-8">' + '<label class="form-label">گارمنٹ</label><select class="form-select" id="tplType">' + Meas.typeOptions(st) + '</select></div>' +
      '<div class="col-4"><button class="btn btn-success w-100" data-act="tplNew">➕ نئی پیمائش</button></div>' +
      '<div class="col-12"><button class="btn btn-outline-secondary btn-sm" data-act="typeNew">➕ نئی گارمنٹ قسم بنائیں</button></div></div></div>';
    const list = Meas.templatesFor(st);
    h += '<div class="vstack gap-2">' + (list.length ? list.map(t => UI.row({
      title: U.esc(t.name) + (t.isDefault ? ' ' + UI.badge('ڈیفالٹ', 'success') : ''), sub: t.fields.length + ' پیمائشیں', extra: t.fields.slice(0, 8).map(f => '<span class="chip">' + U.esc(f.n) + '</span>').join(''),
      actions: '<button class="btn btn-sm btn-success" data-act="tplEdit" data-id="' + t.id + '">✏️ ترمیم</button><button class="btn btn-sm btn-outline-secondary" data-act="tplDefault" data-id="' + t.id + '">ڈیفالٹ بنائیں</button><button class="btn btn-sm btn-outline-secondary" data-act="tplCopy" data-id="' + t.id + '">کاپی</button><button class="btn btn-sm btn-outline-danger" data-act="tplDel" data-id="' + t.id + '">حذف</button>'
    })).join('') : UI.empty('📐', 'اس گارمنٹ کا کوئی ٹیمپلیٹ نہیں')) + '</div>';
    return h;
  }
  $(document).on('change', '#tplType', function () { App.state.tplType = this.value; App.refresh(); });
  App.act.tplNew = () => tplModal(null);
  App.act.tplEdit = $b => tplModal($b.data('id'));
  App.act.tplDefault = $b => { const t = DB.templates.get($b.data('id')); Meas.templatesFor(t.typeId).forEach(x => DB.templates.update(x.id, { isDefault: x.id === t.id })); App.refresh(); };
  App.act.tplCopy = $b => { const t = DB.templates.get($b.data('id')); DB.templates.add({ typeId: t.typeId, name: t.name + ' (کاپی)', fields: U.clone(t.fields), isDefault: false }); UI.toast('کاپی بن گئی'); App.refresh(); };
  App.act.tplDel = $b => {
    const t = DB.templates.get($b.data('id'));
    if (Meas.templatesFor(t.typeId).length < 2) return UI.toast('آخری ٹیمپلیٹ حذف نہیں ہو سکتا', 'warning');
    UI.confirm('ٹیمپلیٹ «' + t.name + '» حذف کریں؟ پرانی پیمائشیں محفوظ رہیں گی۔', { danger: true }).then(ok => { if (ok) { DB.templates.remove(t.id); if (t.isDefault) { const f = Meas.templatesFor(t.typeId)[0]; DB.templates.update(f.id, { isDefault: true }); } App.refresh(); } });
  };
  function tplModal(id) {
    const t = id ? DB.templates.get(id) : { typeId: App.state.tplType, name: '', fields: [{ id: rid(), n: '', u: 'انچ', req: false, def: '', note: '' }] };
    const ctl = UI.modal({
      title: id ? 'ٹیمپلیٹ میں ترمیم' : 'نئی پیمائش (ٹیمپلیٹ)', form: 'tplSave', size: 'lg',
      body: '<input type="hidden" name="id" value="' + (id || '') + '"><div class="row g-2 mb-2">' + UI.field({ label: 'نام', name: 'name', value: t.name, req: 1, cls: 'col-6' }) + UI.field({ label: 'گارمنٹ', name: 'typeId', type: 'select', html: Meas.typeOptions(t.typeId), cls: 'col-6' }) + '</div>' + Meas.feHtml(t.fields, 'tpl'), ok: 'محفوظ کریں'
    });
  }
  App.forms.tplSave = ($f, m) => {
    const v = UI.vals($f), fields = Meas.feRead($f).map(f => ({ id: rid(), n: f.n, u: f.u, req: f.req, def: f.def, note: f.note }));
    if (!fields.length) return UI.toast('کم از کم ایک پیمائش درکار ہے', 'warning');
    if (v.id) DB.templates.update(v.id, { name: v.name, typeId: v.typeId, fields });
    else DB.templates.add({ typeId: v.typeId, name: v.name, fields, isDefault: !Meas.templatesFor(v.typeId).length });
    App.state.tplType = v.typeId; m.close(); UI.toast('ٹیمپلیٹ محفوظ ہو گیا'); App.refresh();
  };

  // ---------- garment types ----------
  Meas.typeModal = function (id) {
    const t = id ? DB.garmentTypes.get(id) : { name: '', gender: 'M', rate: '' };
    UI.modal({
      title: id ? 'گارمنٹ قسم' : 'نئی گارمنٹ قسم', form: 'typeSave', size: 'sm',
      body: '<input type="hidden" name="id" value="' + (id || '') + '"><div class="row g-2">' + UI.field({ label: 'نام', name: 'name', value: t.name, req: 1 }) +
        UI.field({ label: 'زمرہ', name: 'gender', type: 'select', html: '<option value="M"' + (t.gender === 'M' ? ' selected' : '') + '>مردانہ</option><option value="L"' + (t.gender === 'L' ? ' selected' : '') + '>زنانہ</option><option value="O"' + (t.gender === 'O' ? ' selected' : '') + '>دیگر</option>' }) +
        UI.field({ label: 'عام سلائی ریٹ (فی پیس)', name: 'rate', type: 'num', value: t.rate || '' }) +
        (id ? UI.field({ type: 'check', label: 'فعال', name: 'active', value: t.active !== false }) : UI.field({ label: 'پیمائش کا ٹیمپلیٹ کاپی کریں از', name: 'base', type: 'select', html: Meas.typeOptions('gt_m_sq') })) + '</div>', ok: 'محفوظ کریں'
    });
  };
  App.act.typeNew = () => Meas.typeModal();
  App.act.typeEdit = $b => Meas.typeModal($b.data('id'));
  App.forms.typeSave = ($f, m) => {
    const v = UI.vals($f);
    if (v.id) DB.garmentTypes.update(v.id, { name: v.name, gender: v.gender, rate: U.n(v.rate), active: v.active });
    else {
      const t = DB.garmentTypes.add({ name: v.name, gender: v.gender, rate: U.n(v.rate), custom: true, active: true });
      const b = Meas.defaultTemplate(v.base);
      DB.templates.add({ typeId: t.id, name: 'معیاری', fields: b ? U.clone(b.fields) : [{ id: rid(), n: 'لمبائی', u: 'انچ', req: false, def: '', note: '' }], isDefault: true });
      App.state.tplType = t.id;
    }
    m.close(); UI.toast('محفوظ ہو گیا'); App.refresh();
  };

  w.Meas = Meas;
})(window);
