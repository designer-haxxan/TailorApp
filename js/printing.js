/* printing.js — document model (invoice, receipt, slips, tags), HTML/canvas renderers, browser print, Bluetooth ESC/POS */
(function (w) {
  'use strict';
  const Print = { sel: new Set(), bt: { dev: null, ch: null } };

  // ===================== Code 128 (subset B) =====================
  const C128 = '212222 222122 222221 121223 121322 131222 122213 122312 132212 221213 221312 231212 112232 122132 122231 113222 123122 123221 223211 221132 221231 213212 223112 312131 311222 321122 321221 312212 322112 322211 212123 212321 232121 111323 131123 131321 112313 132113 132311 211313 231113 231311 112133 112331 132131 113123 113321 133121 313121 211331 231131 213113 213311 213131 311123 311321 331121 312113 312311 332111 314111 221411 431111 111224 111422 121124 121421 141122 141221 112214 112412 122114 122411 142112 142211 241211 221114 413111 241112 134111 111242 121142 121241 114212 124112 124211 411212 421112 421211 212141 214121 412121 111143 111341 131141 114113 114311 411113 411311 113141 114131 311141 411131 211412 211214 211232 2331112'.split(' ');
  Print.code128 = function (text) {
    const codes = [104]; let sum = 104;
    String(text).split('').forEach((ch, i) => { let v = ch.charCodeAt(0) - 32; if (v < 0 || v > 95) v = 0; codes.push(v); sum += v * (i + 1); });
    codes.push(sum % 103); codes.push(106);
    let mods = []; // array of run lengths starting with a bar
    codes.forEach(c => C128[c].split('').forEach(d => mods.push(+d)));
    return mods; // alternating bar/space widths
  };
  function barcodeSvg(text, h) {
    const m = Print.code128(text), total = m.reduce((a, b) => a + b, 0) + 20; let x = 10, bars = '';
    m.forEach((wd, i) => { if (i % 2 === 0) bars += '<rect x="' + x + '" y="0" width="' + wd + '" height="1"/>'; x += wd; });
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + total + ' 1" preserveAspectRatio="none" style="width:100%;height:' + (h || 9) + 'mm;display:block" shape-rendering="crispEdges">' + bars + '</svg>';
  }

  // ===================== Doc model =====================
  const Doc = {
    shopHead(d, small) {
      const S = DB.settings;
      if (S.logo && !small) d.push({ t: 'logo' });
      d.push({ t: 'title', x: S.shopName });
      if (S.address && !small) d.push({ t: 'sub', x: S.address });
      if ((S.phone || S.whatsapp) && !small) d.push({ t: 'sub', x: 'فون: ' + [S.phone, S.whatsapp && S.whatsapp !== S.phone ? 'واٹس ایپ: ' + S.whatsapp : ''].filter(Boolean).join(' | ') });
    },
    kv: (k, v, o) => Object.assign({ t: 'kv', k, v: String(v == null ? '' : v) }, o || {}),
    garmLine: g => g.typeName + ((g.fabric || {}).color ? ' - ' + g.fabric.color : '')
  };

  Doc.invoice = function (o, a4) {
    const c = DB.customers.get(o.customerId) || {}, gs = Ord.active(o.id), paid = Ord.paid(o);
    const adv = U.round(DB.payments.of('orderId', o.id).filter(p => !p.voided && p.kind === 'advance').reduce((s, p) => s + (p.dir === 'in' ? p.amount : -p.amount), 0));
    const d = []; Doc.shopHead(d);
    d.push({ t: 'hr' }, { t: 'title', x: 'انوائس / رسید' });
    d.push(Doc.kv('انوائس نمبر', o.invoiceNo), Doc.kv('آرڈر نمبر', o.no), Doc.kv('تاریخ', U.fd(o.date)), Doc.kv('گاہک', c.name), c.mobile ? Doc.kv('موبائل', c.mobile) : null, Doc.kv('ڈیلیوری تاریخ', U.fd(o.dueDate)), { t: 'hr' });
    d.push(a4 ? { t: 'table', head: ['#', 'گارمنٹ', 'تفصیل', 'تعداد', 'ریٹ', 'رقم'], w: [.06, .22, .32, .1, .14, .16], al: ['', '', '', 'n', 'n', 'n'], rows: gs.map((g, i) => [i + 1, g.typeName, [(g.fabric || {}).kind, (g.fabric || {}).color, (g.fabric || {}).design].filter(Boolean).join(' / '), U.num(g.qty), U.num(g.rate), U.num(g.amount)]) }
      : { t: 'table', head: ['گارمنٹ', 'تعداد', 'ریٹ', 'رقم'], w: [.4, .14, .22, .24], al: ['', 'n', 'n', 'n'], rows: gs.map(g => [Doc.garmLine(g), U.num(g.qty), U.num(g.rate), U.num(g.amount)]) });
    d.push({ t: 'hr' });
    if (U.n(o.discount) > 0) d.push(Doc.kv('کل رقم', U.num(o.gross)), Doc.kv('رعایت', U.num(Math.min(o.discount, o.gross))));
    d.push(Doc.kv('کل بل', U.num(o.total), { big: 1 }));
    if (adv > 0) d.push(Doc.kv('پیشگی', U.num(adv)));
    if (paid - adv > 0.004) d.push(Doc.kv('دیگر وصولی', U.num(paid - adv)));
    d.push(Doc.kv('کل وصول شدہ', U.num(paid)), Doc.kv('بقایا', U.num(o.total - paid), { big: 1 }));
    if (o.note) d.push({ t: 'hr' }, { t: 'text', x: 'نوٹس: ' + o.note });
    d.push({ t: 'hr' }, { t: 'bc', x: o.no }, { t: 'sub', x: DB.settings.invoiceNote || '' });
    return d.filter(Boolean);
  };
  Doc.receipt = function (p) {
    const d = []; Doc.shopHead(d, false);
    const isCust = p.party === 'customer', o = p.orderId && DB.orders.get(p.orderId);
    d.push({ t: 'hr' }, { t: 'title', x: p.dir === 'in' ? 'ادائیگی کی رسید' : 'ادائیگی واؤچر' });
    d.push(Doc.kv('رسید نمبر', p.no), Doc.kv('تاریخ', U.fd(p.date)), Doc.kv(isCust ? 'گاہک' : p.party === 'karigar' ? 'کاریگر' : 'سپلائر', Pay.partyName(p)));
    if (o) d.push(Doc.kv('آرڈر نمبر', o.no));
    d.push(Doc.kv('ذریعہ', Acc.name(p.account)));
    if (p.ref) d.push(Doc.kv('حوالہ', p.ref));
    d.push({ t: 'hr' }, Doc.kv(p.dir === 'in' ? 'وصول شدہ رقم' : 'ادا شدہ رقم', U.num(p.amount), { big: 1 }));
    if (o) d.push(Doc.kv('کل بل', U.num(o.total)), Doc.kv('کل وصول شدہ', U.num(Ord.paid(o))), Doc.kv('بقایا', U.num(Ord.balance(o)), { big: 1 }));
    else if (isCust && p.partyId) d.push(Doc.kv('کل بقایا', U.num(Cust.balance(p.partyId)), { big: 1 }));
    if (p.note) d.push({ t: 'text', x: p.note });
    d.push({ t: 'hr' }, { t: 'sub', x: 'شکریہ' });
    return d;
  };
  Doc.orderSlip = function (o) {
    const c = DB.customers.get(o.customerId) || {}, gs = Ord.active(o.id), d = [];
    Doc.shopHead(d, true); d.push({ t: 'title', x: 'آرڈر سلپ' }, { t: 'hr' });
    d.push(Doc.kv('آرڈر نمبر', o.no), Doc.kv('گاہک', c.name), c.mobile ? Doc.kv('موبائل', c.mobile) : null, Doc.kv('تاریخ', U.fd(o.date)), Doc.kv('ڈیلیوری', U.fd(o.dueDate)), { t: 'hr' });
    gs.forEach((g, i) => {
      const f = g.fabric || {};
      d.push({ t: 'text', x: (i + 1) + '. ' + g.typeName + ' × ' + U.num(g.qty), b: 1 }, { t: 'text', x: 'ٹیگ: ' + g.tag });
      const fl = [f.kind, f.color, f.design].filter(Boolean).join(' / '); if (fl) d.push({ t: 'text', x: 'کپڑا: ' + fl + ' (' + (f.owner === 'shop' ? 'دکان' : 'گاہک') + ')' });
      if (g.style) d.push({ t: 'text', x: 'ڈیزائن: ' + g.style }); if (g.instructions) d.push({ t: 'text', x: 'ہدایات: ' + g.instructions });
      d.push({ t: 'hr' });
    });
    d.push(Doc.kv('کل بل', U.num(o.total)), Doc.kv('وصول شدہ', U.num(Ord.paid(o))), Doc.kv('بقایا', U.num(Ord.balance(o)), { big: 1 }), { t: 'bc', x: o.no });
    return d.filter(Boolean);
  };
  Doc.karigarSlip = function (a) {
    const k = DB.karigars.get(a.karigarId) || {}, g = a.garmentId && DB.garments.get(a.garmentId), o = a.orderId && DB.orders.get(a.orderId), al = a.alterationId && DB.alterations.get(a.alterationId);
    const d = []; Doc.shopHead(d, true); d.push({ t: 'title', x: 'کاریگر ورک سلپ' }, { t: 'hr' });
    d.push(Doc.kv('سلپ نمبر', a.no), Doc.kv('کاریگر', k.name), Doc.kv('کام دینے کی تاریخ', U.fd(a.givenDate)));
    if (o) d.push(Doc.kv('آرڈر نمبر', o.no), Doc.kv('گاہک', Cust.name(o.customerId)));
    if (al) d.push(Doc.kv('آلٹریشن', al.no), Doc.kv('گاہک', Cust.name(al.customerId)));
    if (g) {
      const f = g.fabric || {};
      d.push(Doc.kv('گارمنٹ', g.typeName), Doc.kv('ٹیگ نمبر', g.tag), Doc.kv('مقدار', U.num(a.qty)), Doc.kv('کپڑا', [f.kind, f.color, f.design].filter(Boolean).join(' / ')));
      d.push({ t: 'hr' }, { t: 'text', x: 'پیمائش', b: 1 });
      const fl = g.measure.fields.filter(x => String(x.v || '').trim());
      for (let i = 0; i < fl.length; i += 2) d.push({ t: 'cols', c: fl.slice(i, i + 2).map(x => x.n + ': ' + x.v + (x.u ? ' ' + x.u : '')) });
      if (g.measure.notes) d.push({ t: 'text', x: 'نوٹ: ' + g.measure.notes });
      if (g.style) d.push({ t: 'hr' }, { t: 'text', x: 'ڈیزائن ہدایات: ' + g.style });
      if (g.instructions) d.push({ t: 'text', x: 'خصوصی ہدایات: ' + g.instructions, b: 1 });
    } else if (al) { d.push(Doc.kv('گارمنٹ', al.garment), { t: 'text', x: 'مسئلہ: ' + (al.problem || '') }, { t: 'text', x: 'مطلوبہ تبدیلی: ' + (al.change || ''), b: 1 }); }
    d.push({ t: 'hr' }, Doc.kv('ڈیلیوری تاریخ', U.fd(a.dueDate)), Doc.kv('ریٹ', U.num(a.rate)), Doc.kv('کل اجرت', U.num(a.wage), { big: 1 }));
    if (a.note) d.push({ t: 'text', x: a.note });
    d.push({ t: 'bc', x: g ? g.tag : a.no });
    return d.filter(Boolean);
  };
  Doc.tag = function (g, i, n) {
    const T = DB.settings.tag, o = DB.orders.get(g.orderId) || {}, c = DB.customers.get(g.customerId) || {}, a = g.assignmentId && DB.assignments.get(g.assignmentId), f = g.fabric || {};
    const d = [], ltr = x => '⁦' + x + '⁩';
    d.push({ t: 'cols', c: [DB.settings.shopName, g.tag + (n > 1 ? '  (' + (i + 1) + '/' + n + ')' : '')], b: 1 });
    if (T.showBarcode) d.push({ t: 'bc', x: g.tag, h: 6 });
    d.push({ t: 'cols', c: ['آرڈر: ' + o.no, 'گارمنٹ: ' + (g.no || '').split('/').pop()] });
    d.push({ t: 'text', x: c.name + (T.showMobile && c.mobile ? ' ' + ltr(c.mobile) : ''), b: 1 });
    d.push({ t: 'text', x: g.typeName + ' × ' + U.num(g.qty) + (f.color ? ' — ' + f.color : ''), b: 1 });
    d.push({ t: 'cols', c: ['ڈیلیوری: ' + U.fd(g.dueDate), T.showKarigar && a && a.status !== 'منسوخ' ? 'کاریگر: ' + Kar.name(a.karigarId) : ''] });
    return d;
  };
  Doc.expense = function (e) {
    const d = []; Doc.shopHead(d, false); d.push({ t: 'hr' }, { t: 'title', x: 'اخراجات کی رسید' }, Doc.kv('نمبر', e.no), Doc.kv('تاریخ', U.fd(e.date)), Doc.kv('مد', Acc.name(e.accountId)));
    if (e.payee) d.push(Doc.kv('وصول کنندہ', e.payee)); d.push(Doc.kv('ذریعہ', Acc.name(e.payAccount)), { t: 'hr' }, Doc.kv('رقم', U.num(e.amount), { big: 1 })); if (e.note) d.push({ t: 'text', x: e.note }); d.push({ t: 'hr' }); return d;
  };
  Doc.sale = function (s) {
    const d = []; Doc.shopHead(d, false); d.push({ t: 'hr' }, { t: 'title', x: 'فروخت کی رسید' }, Doc.kv('نمبر', s.no), Doc.kv('تاریخ', U.fd(s.date)), Doc.kv('گاہک', s.customerId ? Cust.name(s.customerId) : 'عام گاہک'), { t: 'hr' });
    d.push({ t: 'table', head: ['تفصیل', 'تعداد', 'ریٹ', 'رقم'], w: [.4, .14, .22, .24], al: ['', 'n', 'n', 'n'], rows: s.lines.map(l => [l.desc, U.num(l.qty), U.num(l.rate), U.num(l.amount)]) }, { t: 'hr' });
    if (s.discount > 0) d.push(Doc.kv('رعایت', U.num(s.discount))); d.push(Doc.kv('کل', U.num(s.total), { big: 1 }), Doc.kv('وصول شدہ', U.num(s.paid)), Doc.kv('بقایا', U.num(s.total - s.paid)), { t: 'hr' }, { t: 'sub', x: DB.settings.invoiceNote || '' }); return d;
  };
  Doc.alteration = function (a) {
    const d = []; Doc.shopHead(d, true); d.push({ t: 'title', x: 'آلٹریشن سلپ' }, { t: 'hr' }, Doc.kv('نمبر', a.no), Doc.kv('گاہک', Cust.name(a.customerId)), Doc.kv('گارمنٹ', a.garment), Doc.kv('ڈیلیوری', U.fd(a.dueDate)), { t: 'text', x: 'مسئلہ: ' + (a.problem || '') }, { t: 'text', x: 'مطلوبہ تبدیلی: ' + (a.change || ''), b: 1 });
    if (a.karigarId) d.push(Doc.kv('کاریگر', Kar.name(a.karigarId))); d.push({ t: 'hr' }, Doc.kv('چارج', U.num(a.charge), { big: 1 }), Doc.kv('بقایا', U.num(Alt.balance(a))), { t: 'bc', x: a.no }); return d;
  };
  Doc.test = function () {
    const d = []; Doc.shopHead(d, false); d.push({ t: 'hr' }, { t: 'title', x: 'ٹیسٹ پرنٹ' }, { t: 'text', x: 'اردو نستعلیق پرنٹ کا ٹیسٹ — پرنٹر درست کام کر رہا ہے۔' }, Doc.kv('رقم', '12,345'), Doc.kv('تاریخ', U.fd(U.today())), { t: 'table', head: ['گارمنٹ', 'تعداد', 'رقم'], w: [.5, .2, .3], al: ['', 'n', 'n'], rows: [['شلوار قمیض', '2', '3,000'], ['پینٹ', '1', '1,500']] }, { t: 'bc', x: 'TEST-0001' }, { t: 'sub', x: 'شکریہ' }); return d;
  };
  Doc.table = function (title, head, rows, foot, meta) {
    const d = []; Doc.shopHead(d, false); d.push({ t: 'hr' }, { t: 'title', x: title }); if (meta) d.push({ t: 'sub', x: meta });
    const n = head.length; d.push({ t: 'table', head, rows, w: head.map(() => 1 / n), al: head.map((h, i) => rows.length && /^[\d,.\-\s]+$/.test(String(rows[0][i] == null ? '' : rows[0][i])) && rows[0][i] !== '' ? 'n' : ''), foot }); d.push({ t: 'sub', x: 'تاریخِ پرنٹ: ' + U.fdt(Date.now()) }); return d;
  };

  // ===================== HTML renderer =====================
  Print.html = function (doc, cls, style) {
    const e = U.esc; let h = '<div class="doc ' + cls + '"' + (style ? ' style="' + style + '"' : '') + '>';
    doc.forEach(b => {
      switch (b.t) {
        case 'logo': h += '<img class="d-logo" src="' + e(DB.settings.logo) + '" alt="">'; break;
        case 'title': h += '<div class="d-title">' + e(b.x) + '</div>'; break;
        case 'sub': h += b.x ? '<div class="d-sub">' + e(b.x) + '</div>' : ''; break;
        case 'text': h += '<div' + (b.b ? ' class="b"' : '') + '>' + e(b.x) + '</div>'; break;
        case 'kv': h += '<div class="d-kv' + (b.big ? ' big' : '') + '"><span>' + e(b.k) + '</span><span class="v">' + e(b.v) + '</span></div>'; break;
        case 'hr': h += '<div class="d-hr' + (b.solid ? ' solid' : '') + '"></div>'; break;
        case 'sp': h += '<div class="d-sp"></div>'; break;
        case 'bc': h += '<div class="d-bc">' + barcodeSvg(b.x, b.h) + '<div class="t">' + e(b.x) + '</div></div>'; break;
        case 'cols': h += '<div class="d-cols' + (b.b ? ' b' : '') + '">' + b.c.map((x, i) => '<div' + (i === b.c.length - 1 && b.c.length > 1 ? ' style="text-align:left"' : '') + '>' + e(x) + '</div>').join('') + '</div>'; break;
        case 'table':
          h += '<table class="d-t"><colgroup>' + b.w.map(x => '<col style="width:' + (x * 100) + '%">').join('') + '</colgroup><thead><tr>' + b.head.map((x, i) => '<th class="' + (b.al[i] || '') + '">' + e(x) + '</th>').join('') + '</tr></thead><tbody>' +
            b.rows.map(r => '<tr>' + r.map((x, i) => '<td class="' + (b.al[i] || '') + '">' + e(x) + '</td>').join('') + '</tr>').join('') + '</tbody>' + (b.foot ? '<tfoot><tr>' + b.foot.map((x, i) => '<th class="' + (b.al[i] || '') + '">' + e(x) + '</th>').join('') + '</tr></tfoot>' : '') + '</table>'; break;
      }
    });
    return h + '</div>';
  };

  // ===================== canvas renderer (for ESC/POS raster printing) =====================
  Print.canvas = function (doc, W, base) {
    base = base || (W >= 560 ? 26 : 22); const M = 6, LH = base * 1.75, F = 'JameelNoori, serif';
    const tmp = document.createElement('canvas').getContext('2d');
    const fontOf = (sz, bold) => (bold ? 'bold ' : '') + sz + 'px ' + F;
    function wrap(ctx, text, maxW) {
      const words = String(text).split(/\s+/), lines = []; let cur = '';
      words.forEach(wd => { const t = cur ? cur + ' ' + wd : wd; if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = wd; } else cur = t; });
      if (cur !== '' || !lines.length) lines.push(cur); return lines;
    }
    function run(ctx, draw) {
      let y = 4; const R = W - M, L = M, CW = W - 2 * M;
      const txt = (s, x, align, sz, bold) => { if (draw) { ctx.font = fontOf(sz, bold); ctx.textAlign = align; ctx.direction = 'rtl'; ctx.fillText(s, x, y + sz * 1.25); } };
      doc.forEach(b => {
        ctx.font = fontOf(base, b.b);
        switch (b.t) {
          case 'logo': break;
          case 'title': { ctx.font = fontOf(base * 1.35, true); wrap(ctx, b.x, CW).forEach(l => { txt(l, W / 2, 'center', base * 1.35, true); y += base * 1.35 * 1.7; }); break; }
          case 'sub': case 'text': { if (!b.x) break; const al = b.t === 'sub' ? 'center' : 'right', x = b.t === 'sub' ? W / 2 : R; wrap(ctx, b.x, CW).forEach(l => { txt(l, x, al, base, b.b); y += LH; }); break; }
          case 'kv': {
            const sz = b.big ? base * 1.15 : base; ctx.font = fontOf(sz, b.big);
            const kw = ctx.measureText(b.k).width, vl = wrap(ctx, b.v, Math.max(40, CW - kw - 10));
            txt(b.k, R, 'right', sz, b.big); vl.forEach((l, i) => { if (draw) { ctx.font = fontOf(sz, true); ctx.textAlign = 'left'; ctx.fillText(l, L, y + sz * 1.25 + i * LH); } }); y += LH * Math.max(1, vl.length) * (b.big ? 1.1 : 1); break;
          }
          case 'hr': { if (draw) { ctx.fillRect(L, y + 4, CW, 1.5); } y += 10; break; }
          case 'sp': y += 8; break;
          case 'cols': { const n = b.c.length, cw = CW / n; let mh = 1; b.c.forEach((x, i) => { ctx.font = fontOf(base, b.b); const ls = wrap(ctx, x, cw - 6); mh = Math.max(mh, ls.length); ls.forEach((l, j) => { if (draw) { const al = i === n - 1 && n > 1 ? 'left' : 'right', xx = i === n - 1 && n > 1 ? L : R - i * cw; ctx.font = fontOf(base, b.b); ctx.textAlign = al; ctx.direction = 'rtl'; ctx.fillText(l, xx, y + base * 1.25 + j * LH); } }); }); y += LH * mh; break; }
          case 'bc': {
            const m = Print.code128(b.x), tot = m.reduce((a, c) => a + c, 0) + 20, mw = Math.max(1, Math.floor(CW / tot)), bw = tot * mw, bh = (b.h ? b.h * 6 : 54); let x = Math.floor((W - bw) / 2) + 10 * mw;
            if (draw) m.forEach((wd, i) => { if (i % 2 === 0) ctx.fillRect(x, y, wd * mw, bh); x += wd * mw; }); y += bh + 2;
            if (draw) { ctx.font = '16px Arial'; ctx.textAlign = 'center'; ctx.direction = 'ltr'; ctx.fillText(b.x, W / 2, y + 14); } y += 20; break;
          }
          case 'table': {
            const n = b.head.length, cws = b.w.map(x => x * CW), rows = [b.head].concat(b.rows).concat(b.foot ? [b.foot] : []);
            if (draw) ctx.fillRect(L, y, CW, 1.5); y += 2;
            rows.forEach((r, ri) => {
              const hd = ri === 0 || (b.foot && ri === rows.length - 1); ctx.font = fontOf(base * .95, hd); let mh = 1, x = R; const cells = [];
              r.forEach((c, i) => { const ls = wrap(ctx, String(c == null ? '' : c), cws[i] - 6); mh = Math.max(mh, ls.length); cells.push({ ls, x, w: cws[i], num: b.al[i] === 'n' }); x -= cws[i]; });
              cells.forEach(c => c.ls.forEach((l, j) => { if (draw) { ctx.font = fontOf(base * .95, hd); ctx.textAlign = c.num ? 'left' : 'right'; ctx.direction = 'rtl'; ctx.fillText(l, c.num ? c.x - c.w + 3 : c.x - 3, y + base * 1.2 + j * LH * .9); } }));
              y += LH * .9 * mh; if (draw && ri === 0) ctx.fillRect(L, y, CW, 1.5); if (ri === 0) y += 2;
            });
            if (draw) ctx.fillRect(L, y + 1, CW, 1.5); y += 6; break;
          }
        }
      });
      return Math.ceil(y + 10);
    }
    tmp.canvas.width = W; const H = run(tmp, false);
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const ctx = cv.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H); ctx.fillStyle = '#000'; run(ctx, true); return cv;
  };
  function escpos(cv) {
    const W = cv.width, H = cv.height, bpr = Math.ceil(W / 8), img = cv.getContext('2d').getImageData(0, 0, W, H).data, out = [0x1B, 0x40];
    for (let y0 = 0; y0 < H; y0 += 200) {
      const h = Math.min(200, H - y0); out.push(0x1D, 0x76, 0x30, 0, bpr & 255, bpr >> 8, h & 255, h >> 8);
      for (let y = y0; y < y0 + h; y++) for (let bx = 0; bx < bpr; bx++) { let byte = 0; for (let b = 0; b < 8; b++) { const x = bx * 8 + b; let on = 0; if (x < W) { const i = (y * W + x) * 4; on = (img[i] * .3 + img[i + 1] * .59 + img[i + 2] * .11) < 150 ? 1 : 0; } byte = (byte << 1) | on; } out.push(byte); }
    }
    out.push(0x0A, 0x0A, 0x0A, 0x1D, 0x56, 0x42, 0x00); return new Uint8Array(out);
  }

  // ===================== Bluetooth =====================
  const SVC = ['000018f0-0000-1000-8000-00805f9b34fb', '0000ffe0-0000-1000-8000-00805f9b34fb', '0000fee7-0000-1000-8000-00805f9b34fb', 'e7810a71-73ae-499d-8c15-faa9aef0c3f2', '49535343-fe7d-4ae5-8fa9-9fafd205e455', '0000ff00-0000-1000-8000-00805f9b34fb'];
  Print.btSupported = () => !!(navigator.bluetooth && w.isSecureContext);
  Print.btConnected = () => !!(Print.bt.dev && Print.bt.dev.gatt && Print.bt.dev.gatt.connected && Print.bt.ch);
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  async function attach(dev) {
    let srv = null, last;
    for (let i = 0; i < 3 && !srv; i++) { try { srv = await dev.gatt.connect(); } catch (e) { last = e; await sleep(600); } }
    if (!srv) throw last || new Error('connect');
    let ch = null;
    for (const sv of await srv.getPrimaryServices()) { const cs = await sv.getCharacteristics(); ch = cs.find(c => c.properties.writeWithoutResponse || c.properties.write); if (ch) break; }
    if (!ch) { dev.gatt.disconnect(); throw new Error('nochar'); }
    if (!dev._darziBound) { dev._darziBound = true; dev.addEventListener('gattserverdisconnected', () => { Print.bt.ch = null; if (App.current && App.current.startsWith('settings')) App.refresh(); }); }
    Print.bt = { dev, ch };
    DB.settings.printer.name = dev.name || ''; DB.settings.printer.id = dev.id || ''; DB.saveSettings();
    return dev;
  }
  // must be called from a user tap (shows the browser device picker)
  Print.btConnect = async function () {
    if (!Print.btSupported()) throw new Error('unsupported');
    return attach(await navigator.bluetooth.requestDevice({ acceptAllDevices: true, optionalServices: SVC }));
  };
  // silent reconnect to the previously granted printer (no picker); returns false if not possible
  Print.btReconnect = async function () {
    if (Print.btConnected()) return true;
    if (!Print.btSupported() || !navigator.bluetooth.getDevices || !DB.settings.printer.id) return false;
    try { const dev = (await navigator.bluetooth.getDevices()).find(d => d.id === DB.settings.printer.id); if (!dev) return false; await attach(dev); return true; } catch (e) { return false; }
  };
  Print.btDisconnect = () => { if (Print.bt.dev && Print.bt.dev.gatt.connected) Print.bt.dev.gatt.disconnect(); Print.bt.ch = null; };
  Print.btSend = async function (bytes) {
    const ch = Print.bt.ch; if (!ch) throw new Error('پرنٹر منسلک نہیں');
    const size = Math.max(20, Math.min(512, +DB.settings.printer.chunk || 20));
    for (let i = 0; i < bytes.length; i += size) {
      const part = bytes.slice(i, i + size);
      if (ch.writeValueWithResponse) await ch.writeValueWithResponse(part); else if (ch.properties.writeWithoutResponse) await ch.writeValueWithoutResponse(part); else await ch.writeValue(part);
      await sleep(15);
    }
  };

  // ===================== output =====================
  const KIND = { 58: { cls: 'th w58', px: 384, page: '58mm auto' }, 80: { cls: 'th w80', px: 576, page: '80mm auto' }, a4: { cls: 'a4', px: 0, page: 'A4' } };
  function tagSpec() { const T = DB.settings.tag; return { cls: 'tag', style: 'width:' + T.width + 'mm;height:' + T.height + 'mm;font-size:' + T.fontSize + 'pt', px: Math.round(T.width * 8 / 8) * 8, page: T.width + 'mm ' + T.height + 'mm' }; }
  function spec(kind) { return kind === 'tag' ? tagSpec() : KIND[kind]; }

  Print.browser = function (docs, kind) {
    const sp = spec(kind); let h = docs.map(d => '<div class="doc-page">' + Print.html(d, sp.cls, sp.style) + '</div>').join('');
    $('#printArea').html(h);
    $('#pgStyle').remove(); $('head').append('<style id="pgStyle">@page{size:' + sp.page + ';margin:' + (kind === 'a4' ? '8mm' : '0') + '}</style>');
    const go = () => setTimeout(() => { w.print(); }, 250);
    if (document.fonts && document.fonts.ready) document.fonts.load('20px JameelNoori').then(go, go); else go();
  };
  Print.bluetooth = async function (docs, kind) {
    const sp = spec(kind), W = kind === 'a4' ? 576 : sp.px;
    try { await document.fonts.load('20px JameelNoori'); for (const d of docs) await Print.btSend(escpos(Print.canvas(d, W, kind === 'tag' ? 18 : 0))); UI.toast('پرنٹر کو بھیج دیا گیا'); }
    catch (e) { console.error(e); UI.toast('بلوٹوتھ پرنٹ ناکام: ' + e.message + ' — براؤزر پرنٹ استعمال کریں', 'danger'); }
  };
  Print.out = function (docs, kind) {
    docs = docs.filter(Boolean); if (!docs.length) return;
    const via = DB.settings.printer.via || 'browser';
    if (DB.settings.previewBeforePrint) return Print.preview(docs, kind);
    if (via === 'bluetooth') {
      if (Print.btConnected()) return Print.bluetooth(docs, kind);
      return Print.btReconnect().then(ok => { if (ok) return Print.bluetooth(docs, kind); UI.toast('بلوٹوتھ پرنٹر منسلک نہیں، براؤزر پرنٹ استعمال ہو رہا ہے', 'warning'); Print.browser(docs, kind); });
    }
    Print.browser(docs, kind);
  };
  Print.preview = function (docs, kind) {
    const sp = spec(kind), ctl = UI.modal({
      title: 'پرنٹ پیش منظر', size: 'lg', body: '<div class="doc-preview">' + docs.map(d => Print.html(d, sp.cls, sp.style)).join('') + '</div>',
      footer: '<button class="btn btn-success" id="pvB">🖨 براؤزر پرنٹ</button>' + (Print.btSupported() ? '<button class="btn btn-outline-success" id="pvT">📶 بلوٹوتھ پرنٹر</button>' : '')
    });
    ctl.$el.on('click', '#pvB', () => { ctl.close(); Print.browser(docs, kind); });
    ctl.$el.on('click', '#pvT', () => { if (!Print.btConnected()) return UI.toast('پہلے سیٹنگز → پرنٹر میں پرنٹر کنیکٹ کریں', 'warning'); ctl.close(); Print.bluetooth(docs, kind); });
  };
  w.addEventListener('afterprint', () => { $('#printArea').empty(); });

  // ===================== public print functions =====================
  const need = (store, id) => { const r = store.get(id); if (!r) UI.toast('ریکارڈ نہیں ملا', 'danger'); return r; };
  w.printInvoice58 = id => { const o = need(DB.orders, id); if (o) Print.out([Doc.invoice(o)], 58); };
  w.printInvoice80 = id => { const o = need(DB.orders, id); if (o) Print.out([Doc.invoice(o)], 80); };
  w.printInvoiceA4 = id => { const o = need(DB.orders, id); if (o) Print.out([Doc.invoice(o, true)], 'a4'); };
  w.printInvoice = id => (DB.settings.invoiceFormat === 'a4' ? w.printInvoiceA4 : DB.settings.printerWidth === '58' ? w.printInvoice58 : w.printInvoice80)(id);
  w.printReceipt58 = id => { const p = need(DB.payments, id); if (p) Print.out([Doc.receipt(p)], 58); };
  w.printReceipt80 = id => { const p = need(DB.payments, id); if (p) Print.out([Doc.receipt(p)], 80); };
  w.printOrderSlip = id => { const o = need(DB.orders, id); if (o) Print.out([Doc.orderSlip(o)], DB.settings.printerWidth); };
  w.printKarigarSlip = id => { const a = need(DB.assignments, id); if (a) Print.out([Doc.karigarSlip(a)], DB.settings.printerWidth); };
  w.printAlterationSlip = id => { const a = need(DB.alterations, id); if (a) Print.out([Doc.alteration(a)], DB.settings.printerWidth); };
  w.printExpenseReceipt = (id, wd) => { const e = need(DB.expenses, id); if (e) Print.out([Doc.expense(e)], wd || DB.settings.printerWidth); };
  w.printSaleReceipt = (id, wd) => { const s = need(DB.sales, id); if (s) Print.out([Doc.sale(s)], wd || DB.settings.printerWidth); };
  w.printGarmentTag = (id, opts) => {
    const g = need(DB.garments, id); if (!g) return; const n = DB.settings.tag.perPiece ? Math.max(1, Math.min(50, Math.round(g.qty))) : 1; const docs = []; for (let i = 0; i < n; i++) docs.push(Doc.tag(g, i, n)); Print.out(docs, 'tag');
  };
  w.printTags = ids => { const docs = []; ids.forEach(id => { const g = DB.garments.get(id); if (!g) return; const n = DB.settings.tag.perPiece ? Math.max(1, Math.min(50, Math.round(g.qty))) : 1; for (let i = 0; i < n; i++) docs.push(Doc.tag(g, i, n)); }); Print.out(docs, 'tag'); };
  w.printAllTags = orderId => w.printTags(Ord.active(orderId).map(g => g.id));
  w.reprintTag = w.printGarmentTag;
  w.printReport = (title, head, rows, foot, meta) => Print.out([Doc.table(title, head, rows, foot, meta)], 'a4');

  App.act.tagPrint = $b => printGarmentTag($b.data('id'));

  // ===================== print centre =====================
  function page(args) {
    const tab = args[0] || 'tags'; App.title('پرنٹ / ٹیگ');
    let h = UI.tabs([['tags', 'ٹیگ پرنٹ'], ['orders', 'آرڈر / انوائس'], ['receipts', 'رسیدیں']], tab, 'print');
    if (tab === 'tags') {
      h += '<div class="card-box mb-2 d-flex flex-wrap gap-2 align-items-center"><button class="btn btn-success" data-act="tagPrintSel">🏷 منتخب ٹیگز پرنٹ کریں (<span id="selN">' + Print.sel.size + '</span>)</button><button class="btn btn-outline-secondary" data-act="tagSelAll">سب منتخب کریں</button><button class="btn btn-outline-secondary" data-act="tagSelNone">منتخب ختم</button></div>' + UI.list({
        key: 'tags', keepState: true, placeholder: 'ٹیگ، آرڈر، گاہک یا گارمنٹ', icon: '🏷', empty: 'کوئی گارمنٹ نہیں ملی',
        filters: [{ name: 'a', def: 'open', opts: [['open', 'زیرِ عمل'], ['', 'تمام']] }],
        items: st => DB.garments.all().filter(g => g.status !== 'منسوخ' && (!st.f.a || g.status !== 'ڈیلیور') && UI.match(st.q, g.tag, g.no, Cust.name(g.customerId), g.typeName)).sort((a, b) => b.createdAt - a.createdAt),
        row: g => '<div class="item-card d-flex align-items-center gap-2"><input type="checkbox" class="form-check-input tag-sel m-0" data-id="' + g.id + '" ' + (Print.sel.has(g.id) ? 'checked' : '') + ' style="width:22px;height:22px"><div class="flex-grow-1"><div class="fw-bold">' + U.esc(g.typeName) + ' × ' + U.num(g.qty) + ' ' + U.code(g.tag) + '</div><div class="small text-muted">' + U.esc(Cust.name(g.customerId)) + ' · ' + U.code(g.no) + ' · ' + Garm.badge(g.status) + '</div></div><button class="btn btn-sm btn-outline-success" data-act="tagPrint" data-id="' + g.id + '">🏷</button></div>'
      });
    } else if (tab === 'orders') {
      h += UI.list({
        key: 'prord', keepState: true, placeholder: 'آرڈر نمبر، گاہک، موبائل یا ٹیگ', icon: '🖨', empty: 'کوئی آرڈر نہیں',
        items: st => Ord.search(st.q), row: o => UI.row({ title: U.code(o.no) + ' · ' + U.esc(Cust.name(o.customerId)), sub: U.fd(o.date) + ' · بل ' + U.num(o.total), actions: '<button class="btn btn-sm btn-outline-success" data-act="prt" data-fn="printInvoice58" data-id="' + o.id + '">انوائس 58</button><button class="btn btn-sm btn-outline-success" data-act="prt" data-fn="printInvoice80" data-id="' + o.id + '">انوائس 80</button><button class="btn btn-sm btn-outline-success" data-act="prt" data-fn="printInvoiceA4" data-id="' + o.id + '">A4</button><button class="btn btn-sm btn-outline-secondary" data-act="prt" data-fn="printOrderSlip" data-id="' + o.id + '">سلپ</button><button class="btn btn-sm btn-outline-secondary" data-act="prt" data-fn="printAllTags" data-id="' + o.id + '">ٹیگز</button>' })
      });
    } else {
      h += UI.list({
        key: 'prrec', keepState: true, placeholder: 'نام یا رسید نمبر', icon: '🧾', empty: 'کوئی رسید نہیں',
        items: st => DB.payments.all().filter(p => !p.voided && UI.match(st.q, Pay.partyName(p), p.no)).sort((a, b) => b.createdAt - a.createdAt), row: Pay.card
      });
    }
    App.render(h);
  }
  App.route('print', page);
  $(document).on('change', '.tag-sel', function () { this.checked ? Print.sel.add($(this).data('id')) : Print.sel.delete($(this).data('id')); $('#selN').text(Print.sel.size); });
  App.act.tagPrintSel = () => { if (!Print.sel.size) return UI.toast('پہلے ٹیگ منتخب کریں', 'warning'); printTags([...Print.sel]); };
  App.act.tagSelAll = () => { UI.cfg.tags.items(UI.ls.tags).forEach(g => Print.sel.add(g.id)); UI.listRefresh('tags', true); $('#selN').text(Print.sel.size); };
  App.act.tagSelNone = () => { Print.sel.clear(); UI.listRefresh('tags', true); $('#selN').text(0); };

  Print.Doc = Doc;
  w.Print = Print;
})(window);
