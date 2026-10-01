/* utils.js — shared helpers (formatting, dates, text) */
(function (w) {
  'use strict';
  const U = {};
  const MONTHS = ['جنوری', 'فروری', 'مارچ', 'اپریل', 'مئی', 'جون', 'جولائی', 'اگست', 'ستمبر', 'اکتوبر', 'نومبر', 'دسمبر'];
  const DAYS = ['اتوار', 'پیر', 'منگل', 'بدھ', 'جمعرات', 'جمعہ', 'ہفتہ'];

  U.esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  U.digits = s => String(s == null ? '' : s).replace(/[٠-٩]/g, d => d.charCodeAt(0) - 0x660).replace(/[۰-۹]/g, d => d.charCodeAt(0) - 0x6F0);
  U.n = v => {
    if (typeof v === 'number') return isFinite(v) ? v : 0;
    const x = parseFloat(U.digits(v || '').replace(/[,٬\s]/g, '').replace(/٫/g, '.'));
    return isFinite(x) ? x : 0;
  };
  U.round = n => Math.round((n + Number.EPSILON) * 100) / 100;
  U.num = n => U.round(U.n(n)).toLocaleString('en-US', { maximumFractionDigits: 2 });
  U.rs = n => U.num(n) + ' روپے';
  U.sum = (arr, f) => U.round(arr.reduce((s, x) => s + U.n(f ? f(x) : x), 0));

  U.ymd = d => { d = d || new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  U.today = () => U.ymd();
  U.addDays = (iso, n) => { const d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() + n); return U.ymd(d); };
  U.monthStart = iso => (iso || U.today()).slice(0, 8) + '01';
  U.monthEnd = iso => { const d = new Date((iso || U.today()).slice(0, 8) + '01T00:00:00'); d.setMonth(d.getMonth() + 1); d.setDate(0); return U.ymd(d); };
  U.fd = iso => iso ? '⁦' + String(iso).slice(0, 10).split('-').reverse().join('/') + '⁩' : '';
  U.ft = ts => { const d = new Date(ts); let h = d.getHours(); const m = String(d.getMinutes()).padStart(2, '0'); const pm = h >= 12; h = h % 12 || 12; return h + ':' + m + (pm ? ' شام' : ' صبح'); };
  U.fdt = ts => ts ? U.fd(U.ymd(new Date(ts))) + ' ' + U.ft(ts) : '';
  U.dateLong = (iso) => { const d = new Date((iso || U.today()) + 'T00:00:00'); return DAYS[d.getDay()] + '، ' + d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear(); };
  U.monthName = iso => { const d = new Date(iso + 'T00:00:00'); return MONTHS[d.getMonth()] + ' ' + d.getFullYear(); };
  U.daysBetween = (a, b) => Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000);

  U.debounce = (fn, ms) => { let t; return function () { const a = arguments, c = this; clearTimeout(t); t = setTimeout(() => fn.apply(c, a), ms || 250); }; };
  // normalise Urdu/Arabic letter variants for searching
  U.norm = s => U.digits(String(s == null ? '' : s)).toLowerCase()
    .replace(/[ً-ٰٟ]/g, '').replace(/ي|ى|ے|ې/g, 'ی').replace(/ك/g, 'ک').replace(/ه|ھ|ہ|ۃ/g, 'ہ')
    .replace(/[\s\-]+/g, ' ').trim();
  U.code = c => c ? '<bdi dir="ltr" class="code">' + U.esc(c) + '</bdi>' : '';
  U.phone = p => p ? '<bdi dir="ltr">' + U.esc(p) + '</bdi>' : '';
  U.inRange = (d, from, to) => (!from || d >= from) && (!to || d <= to);
  U.clone = o => JSON.parse(JSON.stringify(o));
  U.pad = (n, l) => String(n).padStart(l || 4, '0');
  U.waLink = (num, text) => { let n = U.digits(num || '').replace(/\D/g, ''); if (n.startsWith('0')) n = '92' + n.slice(1); return 'https://wa.me/' + n + (text ? '?text=' + encodeURIComponent(text) : ''); };

  U.download = (name, text, mime) => {
    const blob = new Blob([text], { type: mime || 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  };
  U.csv = (head, rows) => '﻿' + [head].concat(rows).map(r => r.map(c => '"' + String(c == null ? '' : c).replace(/[⁦⁩]/g, '').replace(/"/g, '""') + '"').join(',')).join('\r\n');

  w.U = U;
})(window);
