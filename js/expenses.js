/* expenses.js — shop expenses (posted to the chosen expense account) */
(function (w) {
  'use strict';
  const Exp = {};

  Exp.card = function (e) {
    return UI.row({
      cls: e.voided ? 'mute' : '', title: '<span class="' + (e.voided ? 'text-decoration-line-through' : '') + '">' + U.esc(Acc.name(e.accountId)) + '</span>' + (e.voided ? ' ' + UI.badge('منسوخ') : ''),
      sub: U.fd(e.date) + ' · ' + U.code(e.no) + ' · ' + U.esc(Acc.name(e.payAccount)) + (e.payee ? ' · ' + U.esc(e.payee) : ''), extra: U.esc(e.note || ''),
      right: '<div class="fw-bold text-danger">' + U.num(e.amount) + '</div>',
      actions: e.voided ? '' : '<div class="btn-group btn-group-sm"><button class="btn btn-outline-success" data-act="expPrint" data-id="' + e.id + '" data-w="58">رسید 58</button><button class="btn btn-outline-success" data-act="expPrint" data-id="' + e.id + '" data-w="80">رسید 80</button></div><button class="btn btn-sm btn-outline-danger" data-act="expVoid" data-id="' + e.id + '">منسوخ</button>'
    });
  };
  App.act.expPrint = $b => printExpenseReceipt($b.data('id'), String($b.data('w')));
  Exp.form = function () {
    UI.modal({
      title: 'خرچ درج کریں', form: 'expSave',
      body: '<div class="row g-2">' + UI.field({ label: 'مد', name: 'accountId', type: 'select', req: 1, html: Acc.options(a => a.type === 'expense'), cls: 'col-12' }) + UI.field({ label: 'رقم', name: 'amount', type: 'num', req: 1, cls: 'col-6' }) + UI.field({ label: 'تاریخ', name: 'date', type: 'date', value: U.today(), cls: 'col-6' }) +
        UI.field({ label: 'کیش / بینک', name: 'payAccount', type: 'select', html: Acc.cashOptions(), cls: 'col-6' }) + UI.field({ label: 'وصول کنندہ', name: 'payee', cls: 'col-6' }) + UI.field({ label: 'تفصیل', name: 'note' }) + '</div>', ok: 'محفوظ کریں'
    });
  };
  App.act.expNew = () => Exp.form();
  App.forms.expSave = ($f, m) => {
    const v = UI.vals($f), amt = U.n(v.amount); if (amt <= 0) return UI.toast('رقم درست نہیں', 'warning');
    const e = DB.expenses.add({ no: DB.next('expense'), date: v.date, accountId: v.accountId, amount: amt, payAccount: v.payAccount, payee: v.payee, note: v.note, voided: false });
    const t = Acc.post({ date: v.date, type: 'expense', desc: 'خرچ: ' + Acc.name(v.accountId) + (v.note ? ' — ' + v.note : ''), lines: [{ a: v.accountId, d: amt }, { a: v.payAccount, c: amt }], ref: { t: 'expense', id: e.id } });
    DB.expenses.update(e.id, { txnId: t.id }); DB.log('expense', 'خرچ ' + Acc.name(v.accountId) + ': ' + U.rs(amt));
    m.close(); UI.toast('خرچ درج ہو گیا'); App.refresh();
  };
  App.act.expVoid = $b => UI.confirm('یہ خرچ منسوخ کریں؟ حسابات میں الٹی انٹری بنے گی۔', { danger: true }).then(ok => { if (ok) { const e = DB.expenses.get($b.data('id')); if (e.txnId) Acc.void(e.txnId, 'خرچ منسوخ'); DB.expenses.update(e.id, { voided: true }); DB.log('void', 'خرچ منسوخ: ' + e.no); UI.toast('منسوخ ہو گیا'); App.refresh(); } });

  function page() {
    App.title('اخراجات');
    const range = f => { const t = U.today(); return f === 'today' ? [t, t] : f === 'week' ? [U.addDays(t, -6), t] : f === 'month' ? [U.monthStart(), t] : [null, null]; };
    App.render('<div class="d-flex justify-content-between mb-2"><h6 class="fw-bold m-0">اخراجات</h6><button class="btn btn-success" data-act="expNew">➕ خرچ درج کریں</button></div>' + UI.list({
      key: 'exp', keepState: true, placeholder: 'مد، وصول کنندہ یا تفصیل', icon: '💸', empty: 'کوئی خرچ درج نہیں',
      filters: [{ name: 'd', def: 'month', opts: [['month', 'اس مہینے'], ['today', 'آج'], ['week', 'پچھلے 7 دن'], ['', 'تمام']] }, { name: 'c', opts: [['', 'تمام مدیں']].concat(DB.accounts.filter(a => a.type === 'expense').map(a => [a.id, a.name])) }],
      items: st => { const r = range(st.f.d); return DB.expenses.all().filter(e => U.inRange(e.date, r[0], r[1]) && (!st.f.c || e.accountId === st.f.c) && UI.match(st.q, Acc.name(e.accountId), e.payee, e.note, e.no)).sort((a, b) => b.date < a.date ? -1 : b.date > a.date ? 1 : b.createdAt - a.createdAt); },
      renderPage: (slice, all) => '<div class="card-box mb-2 d-flex justify-content-between"><span>کل خرچ (فلٹر کے مطابق)</span><b class="text-danger">' + U.rs(U.sum(all.filter(e => !e.voided), e => e.amount)) + '</b></div><div class="vstack gap-2">' + slice.map(Exp.card).join('') + '</div>'
    }));
  }
  App.route('expenses', page);

  w.Exp = Exp;
})(window);
