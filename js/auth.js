/* auth.js — login against the licence API (one device per account); session kept in LocalStorage */
(function (w) {
  'use strict';
  const API = 'https://eposwala.com/api/login';
  const KEY_DEV = 'minipos.deviceId', KEY_SES = 'minipos.session', PHONE = '0302-8863131';
  const MSG = {
    missing_fields: 'یوزر نیم اور پاس ورڈ درج کریں۔',
    invalid_credentials: 'یوزر نیم یا پاس ورڈ غلط ہے۔',
    device_mismatch: 'یہ اکاؤنٹ پہلے ہی کسی دوسرے فون پر فعال ہے۔ مدد کے لیے کال کریں: ' + PHONE,
    account_disabled: 'یہ اکاؤنٹ بند کر دیا گیا ہے۔ مدد کے لیے کال کریں: ' + PHONE
  };
  const Auth = {};

  Auth.deviceId = function () {
    let id = null; try { id = localStorage.getItem(KEY_DEV); } catch (e) { }
    if (!id) {
      id = (w.crypto && crypto.randomUUID) ? crypto.randomUUID() : Date.now().toString(36) + '-' + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
      try { localStorage.setItem(KEY_DEV, id); } catch (e) { }
    }
    return id;
  };
  Auth.session = function () { try { return JSON.parse(localStorage.getItem(KEY_SES)); } catch (e) { return null; } };
  Auth.valid = function () { const s = Auth.session(); return !!(s && s.token && Number(s.expiresAt) > Date.now()); };

  Auth.login = async function (username, password) {
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 20000);
    let res, data = {};
    try {
      res = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password, deviceId: Auth.deviceId() }), signal: ctl.signal });
    } catch (e) { throw new Error('انٹرنیٹ سے رابطہ نہیں ہو سکا۔ لاگ اِن کے لیے انٹرنیٹ ضروری ہے۔'); }
    finally { clearTimeout(t); }
    try { data = await res.json(); } catch (e) { }
    if (!res.ok) throw new Error(MSG[data && data.error] || 'لاگ اِن ناکام۔ دوبارہ کوشش کریں۔');
    if (!data.token || !Number(data.expiresAt)) throw new Error('لاگ اِن ناکام۔ دوبارہ کوشش کریں۔');
    localStorage.setItem(KEY_SES, JSON.stringify({ token: data.token, expiresAt: data.expiresAt, username: data.username || username }));
  };
  Auth.logout = function () { try { localStorage.removeItem(KEY_SES); } catch (e) { } };

  Auth.show = function (note) {
    $('#splash').hide();
    if ($('#loginBox').length) return;
    $('body').append('<div id="loginBox" style="position:fixed;inset:0;z-index:4000;background:linear-gradient(135deg,#0f6b3f,#0a4d2d);overflow:auto;display:flex;align-items:center;justify-content:center;padding:16px">' +
      '<form id="loginForm" class="card-box" style="width:100%;max-width:380px" novalidate><div class="text-center mb-3"><img src="assets/icons/icon-192.png" width="84" height="84" alt="" style="border-radius:18px"><div class="fs-4 fw-bold text-brand mt-2">درزی شاپ منیجمنٹ</div><div class="text-muted">لاگ اِن کریں</div></div>' +
      (note ? '<div class="alert alert-warning py-1">' + U.esc(note) + '</div>' : '') +
      '<div class="mb-2"><label class="form-label mb-1">یوزر نیم</label><input class="form-control" name="u" dir="ltr" style="text-align:right" autocomplete="username" autocapitalize="none"></div>' +
      '<div class="mb-3"><label class="form-label mb-1">پاس ورڈ</label><input class="form-control" type="password" name="p" dir="ltr" style="text-align:right" autocomplete="current-password"></div>' +
      '<div id="loginErr" class="text-danger mb-2" style="min-height:1.5em"></div><button class="btn btn-success btn-lg w-100" id="loginBtn">لاگ اِن</button>' +
      '<div class="text-center small text-muted mt-3">مدد کے لیے: <bdi dir="ltr">' + PHONE + '</bdi></div></form></div>');
    $('#loginForm [name=u]').trigger('focus');
  };
  $(document).on('submit', '#loginForm', async function (e) {
    e.preventDefault();
    const u = this.u.value.trim(), p = this.p.value;
    if (!u || !p) return $('#loginErr').text(MSG.missing_fields);
    const $b = $('#loginBtn').prop('disabled', true).text('انتظار کریں…'); $('#loginErr').text('');
    try { await Auth.login(u, p); $('#loginBox').remove(); App.buildMenu(); App.run(); }
    catch (err) { $('#loginErr').text(err.message); $b.prop('disabled', false).text('لاگ اِن'); }
  });
  App.act.logout = () => UI.confirm('لاگ آؤٹ کریں؟ آپ کا ڈیٹا اس فون میں محفوظ رہے گا۔').then(ok => { if (ok) { Auth.logout(); location.hash = '#/dashboard'; location.reload(); } });

  // re-check expiry when the app returns to the foreground
  document.addEventListener('visibilitychange', () => { if (!document.hidden && !Auth.valid() && !$('#loginBox').length) Auth.show('آپ کا سیشن ختم ہو گیا ہے، دوبارہ لاگ اِن کریں۔'); });

  w.Auth = Auth;
})(window);
