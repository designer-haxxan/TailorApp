/* app.js — application core: router, navigation, delegated events, global search, startup */
(function (w) {
  'use strict';
  const App = { act: {}, forms: {}, routes: {}, state: {}, current: null, deferredInstall: null };

  App.route = (name, fn) => { App.routes[name] = fn; };
  App.title = t => { App.pageTitle = t; $('#pageTitle').text(t); document.title = t + ' - ' + DB.settings.shopName; };
  App.render = function (html) { $('#view').html(html); UI.flush(); };
  App.go = h => { if (location.hash === h) App.run(); else location.hash = h; };
  App.refresh = function () { const y = window.scrollY; App.run(true); window.scrollTo(0, y); };

  App.run = function (silent) {
    const hash = location.hash.replace(/^#\/?/, '') || 'dashboard';
    const parts = hash.split('/').map(decodeURIComponent), name = parts[0], args = parts.slice(1);
    const fn = App.routes[name];
    App.current = hash;
    $('.nav-link-app').removeClass('active').filter((i, el) => ($(el).data('route') || '') === name).addClass('active');
    $('.bn-item').removeClass('active').filter((i, el) => $(el).data('route') === name).addClass('active');
    if (!silent) { bootstrap.Offcanvas.getInstance(document.getElementById('menu'))?.hide(); window.scrollTo(0, 0); }
    if (!fn) { App.title('نہیں ملا'); return App.render(UI.empty('🧭', 'یہ صفحہ موجود نہیں', '<a class="btn btn-success" href="#/dashboard">ڈیش بورڈ پر جائیں</a>')); }
    try { fn(args); }
    catch (e) { console.error(e); App.render(UI.empty('⚠️', 'صفحہ کھولنے میں خرابی: ' + U.esc(e.message), '<a class="btn btn-success" href="#/dashboard">ڈیش بورڈ</a>')); }
  };

  const MENU = [
    ['dashboard', '🏠', 'ڈیش بورڈ'], ['order/new', '✂️', 'نیا آرڈر', 'order'], ['orders', '📋', 'آرڈرز'], ['customers', '👥', 'گاہک'], ['measurements', '📏', 'پیمائش'],
    ['fabrics', '🧵', 'کپڑے'], ['karigars', '🧑‍🏭', 'کاریگر'], ['delivery', '🚚', 'ڈیلیوری'], ['alterations', '🪡', 'آلٹریشن'],
    ['sales', '🛍️', 'فروخت'], ['payments', '💰', 'ادائیگی'], ['expenses', '💸', 'اخراجات'],
    ['suppliers', '🏪', 'سپلائر'], ['purchases', '🛒', 'خریداری'], ['inventory', '📦', 'اسٹاک'],
    ['accounts', '📒', 'حسابات'], ['reports', '📊', 'رپورٹس'], ['print', '🖨️', 'پرنٹ / ٹیگ'], ['activity', '🕘', 'سرگرمی'], ['settings', '⚙️', 'سیٹنگز']
  ];
  App.buildMenu = function () {
    $('#menuList').html(MENU.map(m => '<a class="nav-link-app" data-route="' + (m[3] || m[0]) + '" href="#/' + m[0] + '"><span class="ic">' + m[1] + '</span>' + m[2] + '</a>').join('') +
      '<a class="nav-link-app" href="#" data-act="logout"><span class="ic">🚪</span>لاگ آؤٹ' + (w.Auth && Auth.session() ? ' <small class="text-muted">(' + U.esc(Auth.session().username || '') + ')</small>' : '') + '</a>' +
      '<a class="nav-link-app d-none" id="installBtn" href="#" data-act="install"><span class="ic">📲</span>ایپ انسٹال کریں</a>');
    $('#shopNameTop').text(DB.settings.shopName);
    const logo = DB.settings.logo; $('#brandLogo').toggle(!!logo).attr('src', logo || '');
  };

  // ---------- delegated events ----------
  $(document).on('click', '[data-act]', function (e) {
    const f = App.act[$(this).data('act')];
    if (f) { if (this.tagName === 'A') e.preventDefault(); try { f.call(this, $(this), e); } catch (err) { console.error(err); UI.toast('خرابی: ' + err.message, 'danger'); } }
  });
  $(document).on('submit', 'form[data-form]', function (e) {
    e.preventDefault();
    if (!this.checkValidity()) { $(this).addClass('was-validated'); UI.toast('براہِ کرم تمام ضروری خانے پُر کریں', 'warning'); return; }
    const f = App.forms[$(this).data('form')], m = $(this).closest('.modal').data('ctl');
    if (f) { try { f($(this), m); } catch (err) { console.error(err); UI.toast('خرابی: ' + err.message, 'danger'); } }
  });
  // Eastern-Arabic digits typed in numeric fields are normalised on blur
  $(document).on('blur', 'input[inputmode=decimal],input[inputmode=tel]', function () { const v = U.digits(this.value); if (v !== this.value) this.value = v; });
  // select-all on focus for numeric fields
  $(document).on('focus', 'input[inputmode=decimal]', function () { this.select(); });

  App.act.install = function () {
    if (App.deferredInstall) { App.deferredInstall.prompt(); App.deferredInstall = null; $('#installBtn').addClass('d-none'); }
  };
  w.addEventListener('beforeinstallprompt', e => { e.preventDefault(); App.deferredInstall = e; $('#installBtn').removeClass('d-none'); });

  // ---------- global search ----------
  const Search = {
    run(q) {
      const n = U.norm(q); if (!n) return null;
      const lim = 8, res = {};
      const take = (arr, f) => { const o = []; for (let i = 0; i < arr.length && o.length < lim; i++) if (f(arr[i])) o.push(arr[i]); return o; };
      res.customers = take(DB.customers.all(), c => U.norm(c.name + ' ' + c.mobile + ' ' + c.mobile2 + ' ' + c.whatsapp + ' ' + c.no).includes(n));
      res.orders = take(DB.orders.all(), o => U.norm(o.no + ' ' + o.invoiceNo).includes(n));
      res.tags = take(DB.garments.all(), g => U.norm(g.tag + ' ' + g.no).includes(n));
      res.garments = take(DB.garments.all(), g => U.norm(g.typeName + ' ' + ((g.fabric || {}).color || '') + ' ' + ((g.fabric || {}).kind || '')).includes(n));
      res.karigars = take(DB.karigars.all(), k => U.norm(k.name + ' ' + k.mobile + ' ' + k.no).includes(n));
      res.suppliers = take(DB.suppliers.all(), s => U.norm(s.name + ' ' + s.mobile + ' ' + s.no).includes(n));
      return res;
    },
    html(q) {
      const r = Search.run(q); if (!r) return '<div class="text-muted text-center py-4">تلاش کے لیے لکھیں</div>';
      const sec = (title, arr, f) => arr.length ? '<div class="fw-bold text-brand mt-2 mb-1">' + title + '</div>' + arr.map(f).join('') : '';
      const cname = id => (DB.customers.get(id) || {}).name || '';
      let h = sec('گاہک', r.customers, c => '<a class="srch" href="#/customer/' + c.id + '">' + U.esc(c.name) + ' <small class="text-muted">' + U.phone(c.mobile) + ' ' + U.code(c.no) + '</small></a>') +
        sec('آرڈر / انوائس', r.orders, o => '<a class="srch" href="#/order/' + o.id + '">' + U.code(o.no) + ' · ' + U.code(o.invoiceNo) + ' ' + U.esc(cname(o.customerId)) + '</a>') +
        sec('ٹیگ', r.tags, g => '<a class="srch" href="#/order/' + g.orderId + '">' + U.code(g.tag) + ' ' + U.esc(g.typeName) + ' · ' + U.esc(cname(g.customerId)) + '</a>') +
        sec('گارمنٹ', r.garments.filter(g => !r.tags.includes(g)), g => '<a class="srch" href="#/order/' + g.orderId + '">' + U.esc(g.typeName) + ' · ' + U.esc(cname(g.customerId)) + ' ' + U.code(g.tag) + '</a>') +
        sec('کاریگر', r.karigars, k => '<a class="srch" href="#/karigar/' + k.id + '">' + U.esc(k.name) + ' ' + U.phone(k.mobile) + '</a>') +
        sec('سپلائر', r.suppliers, s => '<a class="srch" href="#/supplier/' + s.id + '">' + U.esc(s.name) + ' ' + U.phone(s.mobile) + '</a>');
      return h || '<div class="text-muted text-center py-4">کوئی نتیجہ نہیں ملا</div>';
    }
  };
  w.Search = Search;
  App.act.search = function () {
    const ctl = UI.modal({ title: 'تلاش', body: '<input type="search" class="form-control form-control-lg mb-2" id="gsq" placeholder="گاہک، موبائل، آرڈر، ٹیگ، گارمنٹ، کاریگر، سپلائر…"><div id="gsr"></div>', size: 'lg' });
    ctl.$el.on('input', '#gsq', U.debounce(function () { $('#gsr').html(Search.html(this.value)); }, 200));
    ctl.$el.on('click', 'a.srch', () => ctl.close());
  };

  // ---------- startup ----------
  App.start = function () {
    DB.init();
    App.buildMenu();
    if (DB.corrupt.length) UI.toast('کچھ ڈیٹا خراب ملا اور محفوظ کر دیا گیا: ' + DB.corrupt.join('، '), 'danger');
    $(w).on('hashchange', () => { if (Auth.valid()) App.run(); });
    if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('service-worker.js').catch(() => { });
    if (Auth.valid()) { App.run(); $('#splash').fadeOut(250); } else Auth.show();
  };
  $(function () { App.start(); });

  w.App = App;
})(window);
