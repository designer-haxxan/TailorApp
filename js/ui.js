/* ui.js — reusable UI helpers: toast, confirm, modal, fields, lists, pager, pickers */
(function (w) {
  'use strict';
  const UI = { ls: {}, cfg: {}, pending: [], modals: [] };

  UI.toast = function (msg, type) {
    type = type || 'success';
    const $t = $('<div class="toast align-items-center text-bg-' + (type === 'danger' ? 'danger' : type === 'warning' ? 'warning' : 'success') + ' border-0 show" role="alert"><div class="d-flex"><div class="toast-body">' + U.esc(msg) + '</div><button type="button" class="btn-close btn-close-white m-auto ms-2" data-bs-dismiss="toast"></button></div></div>');
    $('#toasts').append($t);
    setTimeout(() => $t.fadeOut(300, () => $t.remove()), type === 'danger' ? 5000 : 2600);
  };

  UI.modal = function (o) {
    const depth = UI.modals.length;
    const id = 'm' + Date.now() + Math.random().toString(36).slice(2, 5);
    const inner = '<div class="modal-header"><h5 class="modal-title">' + U.esc(o.title || '') + '</h5><button type="button" class="btn-close ms-0 me-auto" data-bs-dismiss="modal"></button></div>' +
      '<div class="modal-body">' + (o.body || '') + '</div>' +
      (o.footer || o.ok ? '<div class="modal-footer">' + (o.footer || '') + (o.ok ? '<button type="submit" class="btn ' + (o.okClass || 'btn-success') + ' px-4">' + o.ok + '</button>' : '') + '<button type="button" class="btn btn-light" data-bs-dismiss="modal">' + (o.cancel || 'بند کریں') + '</button></div>' : '');
    const $el = $('<div class="modal fade" tabindex="-1" id="' + id + '"><div class="modal-dialog modal-dialog-scrollable ' + (o.size ? 'modal-' + o.size : '') + ' modal-fullscreen-sm-down"><div class="modal-content">' +
      (o.form ? '<form data-form="' + o.form + '" novalidate class="d-flex flex-column h-100 overflow-hidden">' + inner + '</form>' : inner) + '</div></div></div>');
    $('body').append($el);
    const bs = new bootstrap.Modal($el[0], { backdrop: o.static ? 'static' : true });
    const ctl = { $el, bs, close() { bs.hide(); }, body() { return $el.find('.modal-body'); } };
    $el.data('ctl', ctl);
    $el.on('show.bs.modal', () => { $el.css('z-index', 1055 + depth * 20); UI.modals.push(ctl); });
    $el.on('shown.bs.modal', () => {
      $('.modal-backdrop').last().css('z-index', 1050 + depth * 20);
      if (!o.noFocus) $el.find('input:not([type=hidden]):not([type=date]):not([readonly]),textarea').first().trigger('focus');
      if (o.onShown) o.onShown($el, ctl);
    });
    $el.on('hidden.bs.modal', () => { UI.modals = UI.modals.filter(x => x !== ctl); $el.remove(); if (UI.modals.length) $('body').addClass('modal-open'); if (o.onHidden) o.onHidden(); });
    UI.flush($el);
    bs.show();
    return ctl;
  };
  UI.closeAll = () => UI.modals.slice().forEach(m => m.close());

  UI.confirm = function (msg, o) {
    o = o || {};
    return new Promise(res => {
      let done = false;
      const ctl = UI.modal({
        title: o.title || 'تصدیق', size: 'sm', noFocus: true,
        body: '<div class="fs-6">' + (o.html ? msg : U.esc(msg)) + '</div>',
        footer: '<button type="button" class="btn ' + (o.danger ? 'btn-danger' : 'btn-success') + ' px-4" id="cfOk">' + (o.ok || 'ہاں') + '</button>',
        cancel: o.cancel || 'نہیں', onHidden: () => { if (!done) res(false); }
      });
      ctl.$el.on('click', '#cfOk', () => { done = true; res(true); ctl.close(); });
    });
  };

  // ---------- form helpers ----------
  UI.field = function (f) {
    const id = 'f' + Math.random().toString(36).slice(2, 7);
    const req = f.req ? ' required' : '';
    let inp;
    const v = f.value == null ? '' : f.value;
    const at = (f.attrs || '') + req + (f.ph ? ' placeholder="' + U.esc(f.ph) + '"' : '');
    switch (f.type) {
      case 'select': inp = '<select class="form-select" name="' + f.name + '" id="' + id + '" ' + at + '>' + (f.html != null ? f.html : UI.opts(f.opts, v)) + '</select>'; break;
      case 'textarea': inp = '<textarea class="form-control" name="' + f.name + '" id="' + id + '" rows="' + (f.rows || 3) + '" ' + at + '>' + U.esc(v) + '</textarea>'; break;
      case 'num': inp = '<input class="form-control" name="' + f.name + '" id="' + id + '" inputmode="decimal" autocomplete="off" value="' + U.esc(v) + '" ' + at + '>'; break;
      case 'date': inp = '<input type="date" class="form-control" name="' + f.name + '" id="' + id + '" value="' + U.esc(v) + '" ' + at + '>'; break;
      case 'tel': inp = '<input class="form-control" dir="ltr" style="text-align:right" name="' + f.name + '" id="' + id + '" inputmode="tel" autocomplete="off" value="' + U.esc(v) + '" ' + at + '>'; break;
      case 'check': return '<div class="' + (f.cls || 'col-12') + '"><label class="form-check"><input type="checkbox" class="form-check-input" name="' + f.name + '"' + (v ? ' checked' : '') + ' ' + (f.attrs || '') + '> <span class="form-check-label">' + f.label + '</span></label></div>';
      case 'raw': inp = f.html; break;
      default: inp = '<input class="form-control" name="' + f.name + '" id="' + id + '" autocomplete="off" value="' + U.esc(v) + '" ' + at + '>';
    }
    return '<div class="' + (f.cls || 'col-12') + '">' + (f.label ? '<label class="form-label mb-1" for="' + id + '">' + f.label + (f.req ? ' <span class="text-danger">*</span>' : '') + '</label>' : '') + inp + (f.help ? '<div class="form-text">' + f.help + '</div>' : '') + '</div>';
  };
  UI.opts = (opts, sel) => (opts || []).map(o => { const v = Array.isArray(o) ? o[0] : o, t = Array.isArray(o) ? o[1] : o; return '<option value="' + U.esc(v) + '"' + (String(v) === String(sel) ? ' selected' : '') + '>' + U.esc(t) + '</option>'; }).join('');
  UI.vals = function ($el) {
    const o = {};
    $el.find('[name]').each(function () {
      const t = this.type;
      if (t === 'checkbox') o[this.name] = this.checked;
      else if (t === 'radio') { if (this.checked) o[this.name] = this.value; }
      else o[this.name] = (this.value || '').trim();
    });
    return o;
  };

  UI.empty = (icon, text, action) => '<div class="empty text-center py-5 text-muted"><div class="display-4">' + icon + '</div><div class="mt-2">' + text + '</div>' + (action ? '<div class="mt-3">' + action + '</div>' : '') + '</div>';
  UI.loading = () => '<div class="text-center py-5"><div class="spinner-border text-success"></div><div class="mt-2 text-muted">لوڈ ہو رہا ہے…</div></div>';
  UI.badge = (t, c) => '<span class="badge bg-' + (c || 'secondary') + '">' + U.esc(t) + '</span>';
  UI.stat = (label, value, cls, href, size) => '<div class="' + (size || 'col-6 col-md-4 col-lg-3') + '">' + (href ? '<a href="' + href + '" class="text-decoration-none">' : '') + '<div class="stat-card ' + (cls || '') + '"><div class="stat-v">' + value + '</div><div class="stat-l">' + label + '</div></div>' + (href ? '</a>' : '') + '</div>';
  UI.tabs = (items, active, base) => '<ul class="nav nav-pills tabs-scroll mb-3">' + items.map(t => '<li class="nav-item"><a class="nav-link ' + (t[0] === active ? 'active' : '') + '" href="#/' + base + '/' + t[0] + '">' + t[1] + '</a></li>').join('') + '</ul>';
  UI.card = (title, body, extra) => '<div class="card-box mb-3">' + (title ? '<div class="d-flex justify-content-between align-items-center mb-2"><h6 class="fw-bold m-0">' + title + '</h6>' + (extra || '') + '</div>' : '') + body + '</div>';
  UI.kv = (k, v) => '<div class="d-flex justify-content-between py-1 border-bottom gap-3"><span class="text-muted">' + k + '</span><span class="fw-bold text-start">' + v + '</span></div>';

  UI.pager = function (key, total, page, size) {
    const pages = Math.max(1, Math.ceil(total / size));
    if (pages <= 1) return '<div class="small text-muted text-center mt-2">کل ' + U.num(total) + '</div>';
    return '<div class="d-flex justify-content-between align-items-center mt-3"><button class="btn btn-outline-secondary btn-sm" data-act="listPage" data-key="' + key + '" data-p="' + (page + 1) + '" ' + (page >= pages ? 'disabled' : '') + '>« اگلا</button>' +
      '<span class="small text-muted">صفحہ ' + page + ' از ' + pages + ' · کل ' + U.num(total) + '</span>' +
      '<button class="btn btn-outline-secondary btn-sm" data-act="listPage" data-key="' + key + '" data-p="' + (page - 1) + '" ' + (page <= 1 ? 'disabled' : '') + '>پچھلا »</button></div>';
  };

  // ---------- generic list (search + filters + pagination); only #L_key is re-rendered ----------
  UI.list = function (cfg) {
    const key = cfg.key;
    if (!UI.ls[key] || !cfg.keepState) UI.ls[key] = { q: '', page: 1, f: {} };
    const st = UI.ls[key];
    (cfg.filters || []).forEach(f => { if (st.f[f.name] == null) st.f[f.name] = f.def != null ? f.def : ''; });
    UI.cfg[key] = cfg; UI.pending.push(key);
    let h = '<div class="list-head d-flex flex-wrap gap-2 mb-2">';
    if (cfg.search !== false) h += '<input type="search" class="form-control flex-grow-1" style="min-width:60%;flex-basis:200px" placeholder="' + U.esc(cfg.placeholder || 'تلاش کریں…') + '" data-live-list="' + key + '" value="' + U.esc(st.q) + '">';
    (cfg.filters || []).forEach(f => { h += '<select class="form-select w-auto" data-list-filter="' + key + '" data-name="' + f.name + '">' + UI.opts(f.opts, st.f[f.name]) + '</select>'; });
    if (cfg.top) h += cfg.top;
    h += '</div><div id="L_' + key + '"></div>';
    return h;
  };
  UI.listRefresh = function (key, keepPage) {
    const cfg = UI.cfg[key], st = UI.ls[key], $b = $('#L_' + key);
    if (!cfg || !$b.length) return;
    if (!keepPage) st.page = 1;
    const items = cfg.items(st), size = cfg.size || 20;
    const pages = Math.max(1, Math.ceil(items.length / size)); if (st.page > pages) st.page = pages;
    const slice = items.slice((st.page - 1) * size, st.page * size);
    let h;
    if (!items.length) h = UI.empty(cfg.icon || '🔍', cfg.empty || 'کوئی ریکارڈ نہیں ملا');
    else h = cfg.renderPage ? cfg.renderPage(slice, items) : '<div class="vstack gap-2">' + slice.map(cfg.row).join('') + '</div>';
    $b.html(h + UI.pager(key, items.length, st.page, size));
    if (cfg.after) cfg.after($b, items);
  };
  UI.flush = function () { const p = UI.pending; UI.pending = []; p.forEach(k => UI.listRefresh(k, true)); };
  UI.match = (q, ...fields) => { if (!q) return true; const n = U.norm(q); return fields.some(f => U.norm(f).includes(n)); };
  UI.row = function (o) {
    return '<div class="item-card' + (o.cls ? ' ' + o.cls : '') + '"' + (o.href ? ' data-href="' + o.href + '"' : '') + '><div class="d-flex justify-content-between gap-2"><div class="min-w-0"><div class="fw-bold text-truncate">' + o.title + '</div>' +
      (o.sub ? '<div class="small text-muted">' + o.sub + '</div>' : '') + (o.extra ? '<div class="small mt-1">' + o.extra + '</div>' : '') + '</div>' +
      (o.right ? '<div class="text-end text-nowrap">' + o.right + '</div>' : '') + '</div>' + (o.actions ? '<div class="d-flex flex-wrap gap-1 mt-2">' + o.actions + '</div>' : '') + '</div>';
  };

  $(document).on('input', '[data-live-list]', U.debounce(function () { const k = $(this).data('liveList'); UI.ls[k].q = this.value; UI.listRefresh(k); }, 250));
  $(document).on('change', '[data-list-filter]', function () { const k = $(this).data('listFilter'); UI.ls[k].f[$(this).data('name')] = this.value; UI.listRefresh(k); });
  App.act.pick = $b => UI.openPicker($b.closest('.picker'));
  App.act.listPage = function ($b) { const k = $b.data('key'); UI.ls[k].page = +$b.data('p'); UI.listRefresh(k, true); const el = document.getElementById('L_' + k); if (el) el.scrollIntoView({ block: 'start', behavior: 'smooth' }); };

  // ---------- entity picker (customer / order) ----------
  UI.picker = function (name, kind, value, opts) {
    opts = opts || {};
    const label = value ? UI.pickLabel(kind, value) : '';
    return '<div class="picker" data-kind="' + kind + '" data-new="' + (opts.add === false ? 0 : 1) + '"><input type="hidden" name="' + name + '" value="' + (value || '') + '"><button type="button" class="form-control text-start picker-btn" data-act="pick">' + (label ? U.esc(label) : '<span class="text-muted">' + (opts.ph || (kind === 'order' ? 'آرڈر منتخب کریں…' : 'گاہک منتخب کریں…')) + '</span>') + '</button></div>';
  };
  UI.pickLabel = function (kind, id) {
    if (kind === 'customer') { const c = DB.customers.get(id); return c ? c.name + (c.mobile ? ' · ' + c.mobile : '') : ''; }
    if (kind === 'order') { const o = DB.orders.get(id), c = o && DB.customers.get(o.customerId); return o ? o.no + ' · ' + (c ? c.name : '') : ''; }
    return '';
  };
  UI.pickSet = function ($p, id) {
    $p.find('input').val(id || '').trigger('change');
    $p.find('.picker-btn').html(id ? U.esc(UI.pickLabel($p.data('kind'), id)) : '<span class="text-muted">منتخب کریں…</span>');
  };
  UI.openPicker = function ($p) {
    const kind = $p.data('kind'), key = 'pk' + Date.now();
    const cfg = {
      key, keepState: false, size: 8, placeholder: kind === 'order' ? 'آرڈر نمبر، نام یا موبائل' : 'نام، موبائل یا نمبر',
      icon: '👤', empty: 'کوئی نتیجہ نہیں',
      items: st => kind === 'customer' ? Cust.search(st.q) : Ord.search(st.q),
      row: it => kind === 'customer'
        ? '<div class="item-card" data-act="pickChoose" data-id="' + it.id + '"><div class="fw-bold">' + U.esc(it.name) + '</div><div class="small text-muted">' + U.phone(it.mobile) + ' ' + U.code(it.no) + '</div></div>'
        : '<div class="item-card" data-act="pickChoose" data-id="' + it.id + '"><div class="fw-bold">' + U.code(it.no) + ' ' + U.esc((DB.customers.get(it.customerId) || {}).name || '') + '</div><div class="small text-muted">' + U.fd(it.date) + ' · بقایا ' + U.num(Ord.balance(it)) + '</div></div>'
    };
    const ctl = UI.modal({
      title: kind === 'order' ? 'آرڈر منتخب کریں' : 'گاہک منتخب کریں',
      body: UI.list(cfg), footer: $p.data('new') && kind === 'customer' ? '<button type="button" class="btn btn-outline-success" id="pkNew">➕ نیا گاہک</button>' : '',
      noFocus: false
    });
    ctl.$el.on('click', '[data-act=pickChoose]', function (e) { e.stopPropagation(); UI.pickSet($p, $(this).data('id')); ctl.close(); });
    ctl.$el.on('click', '#pkNew', () => Cust.form(null, c => { UI.pickSet($p, c.id); ctl.close(); }));
    return ctl;
  };

  // generic clickable cards
  $(document).on('click', '[data-href]', function (e) { if ($(e.target).closest('a,button,input,select,label,[data-act]').length) return; location.hash = $(this).data('href'); });

  w.UI = UI;
})(window);
