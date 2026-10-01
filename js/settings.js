/* settings.js — shop, numbering, printing/printer, rules, garment types */
(function (w) {
  'use strict';
  const NUMS = [['customer', 'گاہک'], ['order', 'آرڈر'], ['invoice', 'انوائس'], ['karigar', 'کاریگر'], ['supplier', 'سپلائر'], ['payment', 'رسید / ادائیگی'], ['purchase', 'خریداری'], ['sale', 'فروخت'], ['expense', 'اخراجات'], ['voucher', 'واؤچر / انٹری'], ['tag', 'ٹیگ'], ['alteration', 'آلٹریشن'], ['item', 'اسٹاک آئٹم'], ['assignment', 'ورک سلپ']];
  const TABS = [['shop', 'دکان'], ['numbers', 'نمبرنگ'], ['print', 'پرنٹنگ'], ['rules', 'اصول'], ['garments', 'گارمنٹ / اکاؤنٹس'], ['backup', 'بیک اپ']];
  let logoTmp = null;

  App.canDestroy = function () { if (DB.settings.allowDestructive) return true; UI.toast('حذف کی اجازت بند ہے۔ سیٹنگز ← اصول میں اجازت دیں۔', 'warning'); return false; };

  function page(args) {
    const tab = args[0] || 'shop', S = DB.settings; App.title('سیٹنگز'); logoTmp = null;
    let h = UI.tabs(TABS, tab, 'settings');
    if (tab === 'shop') {
      h += '<form data-form="setShop" class="card-box"><div class="row g-2">' + UI.field({ label: 'دکان کا نام', name: 'shopName', value: S.shopName, req: 1 }) +
        UI.field({ label: 'پتہ', name: 'address', value: S.address }) + UI.field({ label: 'فون', name: 'phone', type: 'tel', value: S.phone, cls: 'col-6' }) + UI.field({ label: 'واٹس ایپ', name: 'whatsapp', type: 'tel', value: S.whatsapp, cls: 'col-6' }) +
        UI.field({ label: 'کرنسی', name: 'currency', value: 'PKR — پاکستانی روپیہ', attrs: 'readonly', cls: 'col-6' }) + UI.field({ label: 'انوائس کے آخر میں جملہ', name: 'invoiceNote', value: S.invoiceNote, cls: 'col-12' }) +
        '<div class="col-12"><label class="form-label mb-1">لوگو</label><div class="d-flex align-items-center gap-2"><img id="logoPrev" src="' + U.esc(S.logo) + '" style="width:64px;height:64px;object-fit:contain;border:1px solid #ddd;border-radius:10px;background:#fff;' + (S.logo ? '' : 'display:none') + '"><label class="btn btn-outline-secondary m-0">لوگو منتخب کریں<input type="file" accept="image/*" hidden id="logoFile"></label><button type="button" class="btn btn-outline-danger" data-act="logoRemove">ہٹائیں</button></div></div></div>' +
        '<button class="btn btn-success btn-lg mt-3">💾 محفوظ کریں</button></form>';
    } else if (tab === 'numbers') {
      h += '<form data-form="setNums" class="card-box"><div class="small text-muted mb-2">پریفکس نئے بننے والے نمبروں پر لاگو ہو گا۔ آغاز نمبر صرف اسی وقت اثر کرتا ہے جب وہ موجودہ نمبر سے بڑا ہو۔</div><div class="row g-2 fw-bold border-bottom pb-1"><div class="col-4">قسم</div><div class="col-4">پریفکس</div><div class="col-4">آغاز نمبر</div></div>' +
        NUMS.map(n => '<div class="row g-2 align-items-center py-1"><div class="col-4">' + n[1] + '<div class="small text-muted">اگلا: ' + U.code(DB.peek(n[0])) + '</div></div><div class="col-4"><input class="form-control" dir="ltr" name="p_' + n[0] + '" value="' + U.esc(S.prefix[n[0]]) + '"></div><div class="col-4"><input class="form-control" inputmode="decimal" name="s_' + n[0] + '" value="' + (S.start[n[0]] || 1) + '"></div></div>').join('') + '<button class="btn btn-success btn-lg mt-3">💾 محفوظ کریں</button></form>';
    } else if (tab === 'print') {
      const T = S.tag, sup = Print.btSupported(), conn = Print.btConnected();
      h += '<form data-form="setPrint" class="card-box mb-3"><h6 class="fw-bold">پرنٹ کی ترتیبات</h6><div class="row g-2">' +
        UI.field({ label: 'تھرمل پرنٹر کی چوڑائی', name: 'printerWidth', type: 'select', html: UI.opts([['58', '58 ملی میٹر'], ['80', '80 ملی میٹر']], S.printerWidth), cls: 'col-6' }) +
        UI.field({ label: 'انوائس فارمیٹ', name: 'invoiceFormat', type: 'select', html: UI.opts([['thermal', 'تھرمل رسید'], ['a4', 'A4 صفحہ']], S.invoiceFormat), cls: 'col-6' }) +
        UI.field({ label: 'پرنٹ کا طریقہ', name: 'via', type: 'select', html: UI.opts([['browser', 'براؤزر پرنٹ (ہر ڈیوائس پر)'], ['bluetooth', 'بلوٹوتھ تھرمل پرنٹر']], S.printer.via || 'browser'), cls: 'col-12' }) +
        UI.field({ label: 'بلوٹوتھ رفتار', name: 'chunk', type: 'select', html: UI.opts([['20', 'محفوظ (سست، ہر پرنٹر پر)'], ['100', 'درمیانی'], ['180', 'تیز']], String(S.printer.chunk || 20)), cls: 'col-12' }) +
        UI.field({ type: 'check', label: 'پرنٹ سے پہلے پیش منظر دکھائیں', name: 'previewBeforePrint', value: S.previewBeforePrint }) +
        '<div class="col-12 fw-bold mt-2">ٹیگ کی ترتیب</div>' + UI.field({ label: 'چوڑائی (ملی میٹر)', name: 'tw', type: 'num', value: T.width, cls: 'col-4' }) + UI.field({ label: 'اونچائی (ملی میٹر)', name: 'th', type: 'num', value: T.height, cls: 'col-4' }) + UI.field({ label: 'فونٹ سائز', name: 'tf', type: 'num', value: T.fontSize, cls: 'col-4' }) +
        UI.field({ type: 'check', label: 'بارکوڈ دکھائیں', name: 'tb', value: T.showBarcode, cls: 'col-6' }) + UI.field({ type: 'check', label: 'کاریگر کا نام', name: 'tk', value: T.showKarigar, cls: 'col-6' }) + UI.field({ type: 'check', label: 'موبائل نمبر', name: 'tm', value: T.showMobile, cls: 'col-6' }) + UI.field({ type: 'check', label: 'ہر پیس کا الگ ٹیگ', name: 'tp', value: T.perPiece, cls: 'col-6' }) +
        '</div><button class="btn btn-success btn-lg mt-3">💾 محفوظ کریں</button></form>';
      h += '<div class="card-box mb-3"><h6 class="fw-bold">بلوٹوتھ پرنٹر</h6>' +
        (sup ? '<div class="mb-2">حالت: <b class="' + (conn ? 'text-success' : 'text-muted') + '">' + (conn ? 'منسلک: ' + U.esc(Print.bt.dev.name || 'پرنٹر') : 'منسلک نہیں') + '</b>' + (!conn && S.printer.name ? ' <span class="small text-muted">(آخری: ' + U.esc(S.printer.name) + ')</span>' : '') + '</div>' +
          '<div class="d-flex flex-wrap gap-2"><button class="btn btn-success" data-act="btConnect">📶 پرنٹر منتخب کریں / کنیکٹ</button><button class="btn btn-outline-success" data-act="btReconnect">🔄 پچھلا پرنٹر دوبارہ جوڑیں</button><button class="btn btn-outline-danger" data-act="btDisconnect" ' + (conn ? '' : 'disabled') + '>منقطع کریں</button></div><div class="small text-muted mt-2">یہ سہولت صرف BLE (بلوٹوتھ لو انرجی) تھرمل پرنٹرز کے ساتھ کام کرتی ہے۔ اردو متن تصویر کی شکل میں پرنٹ ہوتا ہے تاکہ نستعلیق درست آئے۔ اگر پرنٹر کنیکٹ نہ ہو تو براؤزر پرنٹ استعمال کریں۔</div>'
          : '<div class="alert alert-warning mb-2">⚠️ اس براؤزر یا ڈیوائس پر ویب بلوٹوتھ دستیاب نہیں (یا ایپ HTTPS پر نہیں کھلی)۔ براہِ کرم اینڈرائیڈ پر Google Chrome میں HTTPS کے ساتھ ایپ کھولیں۔ کلاسک بلوٹوتھ (SPP) پرنٹرز براؤزر سے براہِ راست سپورٹ نہیں ہوتے؛ ایسی صورت میں «براؤزر پرنٹ» استعمال کریں: پرنٹر کی اینڈرائیڈ پرنٹ سروس/ایپ انسٹال کر کے پرنٹ مینو سے پرنٹ کریں۔</div>') + '</div>';
      h += '<div class="card-box"><h6 class="fw-bold">ٹیسٹ پرنٹ</h6><div class="d-flex flex-wrap gap-2"><button class="btn btn-outline-success" data-act="prTest" data-w="58">ٹیسٹ 58mm</button><button class="btn btn-outline-success" data-act="prTest" data-w="80">ٹیسٹ 80mm</button><button class="btn btn-outline-secondary" data-act="prLastInv">آخری انوائس</button><button class="btn btn-outline-secondary" data-act="prLastRec">آخری رسید</button><button class="btn btn-outline-secondary" data-act="prLastTag">نمونہ ٹیگ</button></div></div>';
    } else if (tab === 'rules') {
      h += '<form data-form="setRules" class="card-box"><div class="row g-2">' + UI.field({ label: 'ڈیفالٹ ڈیلیوری دن', name: 'deliveryDays', type: 'num', value: S.deliveryDays, cls: 'col-6' }) +
        UI.field({ type: 'check', label: 'بقایا کے ساتھ ڈیلیوری کی اجازت', name: 'allowDeliveryWithBalance', value: S.allowDeliveryWithBalance }) + UI.field({ type: 'check', label: 'بقایا ہو تو ڈیلیوری سے پہلے تصدیق مانگیں', name: 'requireDeliveryConfirm', value: S.requireDeliveryConfirm }) +
        UI.field({ type: 'check', label: 'مالک موڈ: بغیر لین دین والے ریکارڈ (مثلاً پیمائش) مستقل حذف کرنے کی اجازت', name: 'allowDestructive', value: S.allowDestructive }) + '</div><div class="form-text">مالی ریکارڈ کبھی خاموشی سے حذف نہیں ہوتے؛ انہیں «منسوخ» کیا جاتا ہے اور الٹی انٹری خودکار بنتی ہے۔</div><button class="btn btn-success btn-lg mt-3">💾 محفوظ کریں</button></form>';
    } else if (tab === 'garments') {
      h += '<div class="d-flex flex-wrap gap-2 mb-3"><button class="btn btn-success" data-act="typeNew">➕ نئی گارمنٹ قسم</button><a class="btn btn-outline-success" href="#/measurements/templates">📐 پیمائش ٹیمپلیٹس</a><a class="btn btn-outline-success" href="#/accounts/chart">📒 اکاؤنٹس چارٹ</a></div>';
      h += UI.card('گارمنٹ اقسام', DB.garmentTypes.all().slice().sort((a, b) => a.gender < b.gender ? 1 : -1).map(t => '<div class="d-flex justify-content-between align-items-center border-bottom py-1"><span>' + U.esc(Meas.typeLabel(t)) + (t.custom ? ' ' + UI.badge('اپنی', 'info') : '') + (t.active === false ? ' ' + UI.badge('غیر فعال') : '') + (t.rate ? ' <small class="text-muted">· ریٹ ' + U.num(t.rate) + '</small>' : '') + '</span><button class="btn btn-sm btn-light" data-act="typeEdit" data-id="' + t.id + '">✏️</button></div>').join(''));
    } else if (tab === 'backup') h += Backup.html();
    App.render(h);
  }
  App.route('settings', page);

  App.forms.setShop = $f => {
    const v = UI.vals($f), S = DB.settings; Object.assign(S, { shopName: v.shopName, address: v.address, phone: v.phone, whatsapp: v.whatsapp, invoiceNote: v.invoiceNote });
    if (logoTmp !== null) S.logo = logoTmp; DB.saveSettings(); App.buildMenu(); UI.toast('دکان کی معلومات محفوظ ہو گئیں');
  };
  App.forms.setNums = $f => {
    const v = UI.vals($f), S = DB.settings; NUMS.forEach(n => { S.prefix[n[0]] = v['p_' + n[0]]; S.start[n[0]] = Math.max(1, Math.floor(U.n(v['s_' + n[0]])) || 1); }); DB.saveSettings(); UI.toast('نمبرنگ محفوظ ہو گئی'); App.refresh();
  };
  App.forms.setPrint = $f => {
    const v = UI.vals($f), S = DB.settings;
    S.printerWidth = v.printerWidth; S.invoiceFormat = v.invoiceFormat; S.printer.via = v.via; S.printer.chunk = +v.chunk || 20; S.previewBeforePrint = v.previewBeforePrint;
    Object.assign(S.tag, { width: Math.max(20, U.n(v.tw)), height: Math.max(15, U.n(v.th)), fontSize: Math.max(6, U.n(v.tf)), showBarcode: v.tb, showKarigar: v.tk, showMobile: v.tm, perPiece: v.tp });
    DB.saveSettings(); UI.toast('پرنٹ کی ترتیبات محفوظ ہو گئیں');
  };
  App.forms.setRules = $f => { const v = UI.vals($f), S = DB.settings; Object.assign(S, { deliveryDays: Math.max(0, Math.floor(U.n(v.deliveryDays))), allowDeliveryWithBalance: v.allowDeliveryWithBalance, requireDeliveryConfirm: v.requireDeliveryConfirm, allowDestructive: v.allowDestructive }); DB.saveSettings(); UI.toast('اصول محفوظ ہو گئے'); };

  // logo: downscale to keep storage small
  $(document).on('change', '#logoFile', function () {
    const f = this.files[0]; if (!f) return; const img = new Image(), url = URL.createObjectURL(f);
    img.onload = () => { const k = Math.min(1, 240 / Math.max(img.width, img.height)), c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height); logoTmp = c.toDataURL('image/png'); $('#logoPrev').attr('src', logoTmp).show(); URL.revokeObjectURL(url); };
    img.src = url;
  });
  App.act.logoRemove = () => { logoTmp = ''; $('#logoPrev').hide(); };

  App.act.btConnect = async () => {
    try { const d = await Print.btConnect(); UI.toast('پرنٹر منسلک: ' + (d.name || '')); App.refresh(); }
    catch (e) { if (e.name === 'NotFoundError') return; UI.toast(e.name === 'SecurityError' ? 'اجازت نہیں ملی (HTTPS درکار ہے)' : e.name === 'NetworkError' ? 'پرنٹر رینج میں نہیں یا بند ہے' : e.message === 'nochar' ? 'اس ڈیوائس میں پرنٹنگ کی سہولت نہیں ملی' : e.message === 'unsupported' ? 'یہ براؤزر بلوٹوتھ سپورٹ نہیں کرتا' : 'کنیکٹ نہیں ہو سکا: ' + e.message, 'danger'); }
  };
  App.act.btReconnect = async () => { UI.toast((await Print.btReconnect()) ? 'پرنٹر دوبارہ منسلک ہو گیا' : 'خودکار کنیکشن ممکن نہیں، «پرنٹر منتخب کریں» استعمال کریں', 'warning'); App.refresh(); };
  App.act.btDisconnect = () => { Print.btDisconnect(); UI.toast('پرنٹر منقطع'); App.refresh(); };
  App.act.prTest = $b => Print.out([Print.Doc.test()], String($b.data('w')));
  App.act.prLastInv = () => { const o = DB.orders.all().slice(-1)[0]; if (!o) return UI.toast('ابھی کوئی آرڈر نہیں', 'warning'); (DB.settings.printerWidth === '58' ? printInvoice58 : printInvoice80)(o.id); };
  App.act.prLastRec = () => { const p = DB.payments.all().filter(x => !x.voided).slice(-1)[0]; if (!p) return UI.toast('ابھی کوئی رسید نہیں', 'warning'); (DB.settings.printerWidth === '58' ? printReceipt58 : printReceipt80)(p.id); };
  App.act.prLastTag = () => { const g = DB.garments.all().slice(-1)[0]; if (!g) return UI.toast('ابھی کوئی گارمنٹ نہیں', 'warning'); printGarmentTag(g.id); };
})(window);
