/* موضوعات إبداع ٢٠٢٧ — واجهة الطالبة
 * لا تحتوي أي بيانات عن الطالبات أو الموضوعات؛ كل شيء يأتي من الخادم بعد التحقق. */
(function () {
  'use strict';

  var CFG = window.IBDAA_CONFIG || {};
  var API = String(CFG.apiUrl || '').trim();

  var state = { token: '', first: '', areas: [], area: null, topics: [], pick: null, round2Open: true };

  // ─── أدوات صغيرة ───
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function ar(n) { return String(n).replace(/\d/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'[d]; }); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function asciiDigits(s) {
    return String(s || '')
      .replace(/[٠-٩]/g, function (d) { return d.charCodeAt(0) - 0x0660; })
      .replace(/[۰-۹]/g, function (d) { return d.charCodeAt(0) - 0x06F0; });
  }
  function normPhone(v) {
    var d = asciiDigits(v).replace(/\D/g, '');
    if (d.indexOf('00966') === 0) d = d.slice(5);
    else if (d.indexOf('966') === 0 && d.length === 12) d = d.slice(3);
    if (d.length === 9 && d.charAt(0) === '5') d = '0' + d;
    return /^05\d{8}$/.test(d) ? d : '';
  }
  function nameParts(s) {
    return String(s || '').replace(/[()،,.]/g, ' ').split(/\s+/).filter(function (w) {
      return w && w !== 'بن' && w !== 'بنت';
    });
  }
  function countLabel(n) {
    if (n === 1) return 'موضوع واحد';
    if (n === 2) return 'موضوعان';
    return ar(n) + (n <= 10 ? ' موضوعات' : ' موضوعاً');
  }
  function weeksLabel(n) {
    if (n === 1) return '≈ أسبوع';
    if (n === 2) return '≈ أسبوعان';
    return '≈ ' + ar(n) + (n <= 10 ? ' أسابيع' : ' أسبوعاً');
  }

  // ─── الرسائل ───
  var INLINE = {
    lookup_not_found: 'لم نجد طالبة بهذا الرقم. تأكدي من الرقم، وإن كتبتِ اسمك فتأكدي من كتابته أو اتركيه فارغاً. وإن استمرت المشكلة فراجعي منسقة المشروع.',
    verify_not_found: 'لم نجد اسمك في القائمة. اكتبيه كما في الهوية: اسمك، واسم أبيك، واسم العائلة. وإن استمرت المشكلة فراجعي منسقة المشروع.',
    bad_phone: 'اكتبي رقم جوال صحيحاً يبدأ بـ 05 ويتكوّن من عشرة أرقام.',
    bad_name: 'اكتبي اسمك الأول.',
    too_many: 'محاولات كثيرة على هذا الرقم. انتظري عشر دقائق ثم أعيدي المحاولة.',
    name_too_short: 'اكتبي اسمك الثلاثي على الأقل: اسمك، واسم أبيك، واسم العائلة.',
    no_class: 'اختاري صفك.',
    ambiguous: 'وجدنا أكثر من طالبة بهذا الاسم. أضيفي اسم الجد، وتأكدي من اختيار صفك.',
    phone_taken: 'هذا الرقم مسجّل لطالبة أخرى. اكتبي رقم جوالك أنتِ.',
    network: 'تعذّر الاتصال. تأكدي من الإنترنت ثم أعيدي المحاولة.',
    server_error: 'حدث خطأ مؤقت. أعيدي المحاولة بعد قليل.'
  };

  var PAGE = {
    closed_lookup: { title: 'الدخول غير متاح الآن', text: 'ستُبلغك منسقة المشروع حين يُفتح. شكراً لصبرك.' },
    closed_round2: { title: 'الاختيار غير متاح الآن', text: 'ستُبلغك منسقة المشروع حين يُفتح اختيار الموضوعات.' },
    no_topic_yet: { title: 'أهلاً يا {first}', text: 'لم يُسنَد لكِ موضوع بعد. ستُبلغك منسقة المشروع قريباً.' },
    use_lookup: { title: 'أهلاً يا {first}', text: 'أنتِ ممن أجبن عن نموذج الميول، وموضوعك محفوظ لكِ. ادخلي برقم الجوال الذي كتبتِه في النموذج.', action: ['الدخول برقم الجوال', 'lookup'] },
    already_has_topic: { title: 'أهلاً يا {first}', text: 'سبق أن اخترتِ موضوعك. ادخلي برقم جوالك واسمك الأول لتريه.', action: ['الدخول برقم الجوال', 'lookup'] },
    session_expired: { title: 'انتهت مدة الجلسة', text: 'مرّت ثلاثون دقيقة. ابدئي من جديد باسمك، والموضوعات التي لم تُختر ما زالت متاحة.', action: ['البدء من جديد', 'verify'] },
    not_found_claim: { title: 'تعذّر إتمام الاختيار', text: 'لم نستطع ربط الاختيار باسمك. ابدئي من جديد، وإن تكرر ذلك فراجعي منسقة المشروع.', action: ['البدء من جديد', 'verify'] },
    not_configured: { title: 'الصفحة قيد الإعداد', text: 'ستعمل قريباً. راجعي منسقة المشروع.' }
  };

  // ─── التنقل بين الصفحات ───
  function show(view, noHistory) {
    $$('.view').forEach(function (v) { v.hidden = v.getAttribute('data-view') !== view; });
    document.body.classList.toggle('is-home', view === 'home');
    document.body.classList.toggle('is-proposal', view === 'proposal');
    try { document.dispatchEvent(new Event('ibdaa:view')); } catch (e) {}
    if (!noHistory) history.pushState({ view: view }, '', view === 'home' ? location.pathname : '#' + view);
    window.scrollTo(0, 0);
    var h = $('.view[data-view="' + view + '"] [tabindex="-1"]');
    if (h) setTimeout(function () { try { h.focus({ preventScroll: true }); } catch (e) { h.focus(); } }, 40);
  }

  window.addEventListener('popstate', function (e) {
    var v = (e.state && e.state.view) || 'home';
    if ((v === 'areas' || v === 'proposal') && !state.token) v = 'home';
    if (v === 'areas' && state.pick) { releaseProposal(); }
    if (v === 'result' || v === 'message') v = 'home';
    closeDialog();
    show(v, true);
  });

  function message(key, first, extra) {
    var m = PAGE[key] || { title: 'تنبيه', text: extra || INLINE.server_error };
    $('#msg-title').textContent = m.title.replace('{first}', first || '');
    $('#msg-text').textContent = m.text;
    var act = $('#msg-action');
    if (m.action) {
      act.hidden = false; act.textContent = m.action[0];
      act.onclick = function () { go(m.action[1]); };
    } else {
      act.hidden = true; act.onclick = null;
    }
    show('message');
  }

  function go(view) {
    // إن بدت الجولة الثانية مغلقة، نسأل الخادم من جديد: ربما فُتحت بعد تحميل الصفحة
    if (view === 'verify' && !state.round2Open) {
      document.body.style.cursor = 'progress';
      return api('status').then(function (res) {
        if (res && res.ok) { state.round2Open = !!res.round2Open; updateRound2(); }
      }).catch(function () {}).then(function () {
        document.body.style.cursor = '';
        if (state.round2Open) return go('verify');
        message('closed_round2');
      });
    }
    if (view === 'areas') { renderAreas(); }
    // نموذج نظيف في كل دخول، حتى لا تظهر بيانات طالبة سابقة على جوال مشترك
    if (view === 'lookup' || view === 'verify') {
      var f = $(view === 'lookup' ? '#form-lookup' : '#form-verify');
      f.reset(); formError(f, '');
      if (view === 'verify') hideSuggest();
    }
    show(view);
  }

  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-go]');
    if (!el) return;
    e.preventDefault();
    go(el.getAttribute('data-go'));
  });

  // ─── الاتصال بالخادم ───
  function api(action, payload) {
    if (!API) return Promise.reject({ code: 'not_configured' });
    var ctrl = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 30000);
    var body = JSON.stringify(Object.assign({ action: action }, payload || {}));
    return fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: body,
      cache: 'no-store',
      redirect: 'follow',
      signal: ctrl ? ctrl.signal : undefined
    }).then(function (res) {
      if (!res.ok) throw { code: 'network' };
      return res.json();
    }).catch(function (err) {
      throw (err && err.code) ? err : { code: 'network' };
    }).finally(function () { clearTimeout(timer); });
  }

  function busy(btn, on, label) {
    if (on) {
      btn.setAttribute('data-label', btn.innerHTML);
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner" aria-hidden="true"></span>' + esc(label || 'لحظة من فضلك');
    } else {
      btn.disabled = false;
      if (btn.hasAttribute('data-label')) btn.innerHTML = btn.getAttribute('data-label');
    }
  }

  function formError(form, text, input) {
    var p = $('.error', form);
    p.textContent = text || '';
    p.hidden = !text;
    $$('input,select', form).forEach(function (i) { i.removeAttribute('aria-invalid'); });
    if (input && text) { input.setAttribute('aria-invalid', 'true'); input.focus(); }
  }

  // ─── الدخول برقم الجوال ───
  $('#form-lookup').addEventListener('submit', function (e) {
    e.preventDefault();
    var form = e.target, btn = $('button[type="submit"]', form);
    var phoneIn = $('#lk-phone'), firstIn = $('#lk-first');
    var phone = normPhone(phoneIn.value);
    var first = nameParts(firstIn.value)[0] || '';
    if (!phone) return formError(form, INLINE.bad_phone, phoneIn);
    formError(form, '');
    busy(btn, true, 'نبحث عن موضوعك');
    api('lookup', { phone: phone, firstName: first }).then(function (res) {
      busy(btn, false);
      if (res.ok) {
        form.reset();
        setTrial(!!res.tester, res.token);
        renderResult(res.topic, res.tester ? res.firstName : (first || res.firstName));
        return show('result');
      }
      switch (res.code) {
        case 'not_found': return formError(form, INLINE.lookup_not_found, phoneIn);
        case 'bad_phone': return formError(form, INLINE.bad_phone, phoneIn);
        case 'bad_name': return formError(form, INLINE.bad_name, firstIn);
        case 'too_many': return formError(form, INLINE.too_many);
        case 'closed': return message('closed_lookup');
        case 'no_topic_yet': return message('no_topic_yet', first || res.firstName);
        default: return formError(form, INLINE.server_error);
      }
    }).catch(function (err) {
      busy(btn, false);
      if (err.code === 'not_configured') return message('not_configured');
      formError(form, INLINE.network);
    });
  });

  // ─── التحقق من الاسم ───
  $('#form-verify').addEventListener('submit', function (e) {
    e.preventDefault();
    var form = e.target, btn = $('button[type="submit"]', form);
    var nameIn = $('#vf-name'), clsIn = $('#vf-class');
    var name = nameIn.value.trim();
    var typedFirst = nameParts(name)[0] || '';
    if (nameParts(name).length < 3) return formError(form, INLINE.name_too_short, nameIn);
    if (!clsIn.value) return formError(form, INLINE.no_class, clsIn);
    formError(form, '');
    hideSuggest();
    busy(btn, true, 'نتحقق من اسمك');
    api('verify', { fullName: name, cls: clsIn.value }).then(function (res) {
      busy(btn, false);
      if (res.ok) return verified(res, typedFirst);
      switch (res.code) {
        case 'suggest': return showSuggest(res, name);
        case 'not_found': return formError(form, INLINE.verify_not_found, nameIn);
        case 'name_too_short': return formError(form, INLINE.name_too_short, nameIn);
        case 'ambiguous': return formError(form, INLINE.ambiguous, nameIn);
        case 'use_lookup': return message('use_lookup', typedFirst);
        case 'already_has_topic': return message('already_has_topic', typedFirst);
        case 'closed': state.round2Open = false; updateRound2(); return message('closed_round2');
        default: return formError(form, INLINE.server_error);
      }
    }).catch(function (err) {
      busy(btn, false);
      if (err.code === 'not_configured') return message('not_configured');
      formError(form, INLINE.network);
    });
  });

  function verified(res, first) {
    var form = $('#form-verify');
    setTrial(false);
    hideSuggest();
    state.token = res.token; state.first = first; state.areas = res.areas || [];
    form.reset();
    setFirst(first);
    go('areas');
  }

  // ─── «هل تقصدين…؟»: اسم قريب من صفها نفسه، وتؤكده هي ───
  var suggestTicket = '', suggestTyped = '';
  function showSuggest(res, typed) {
    suggestTicket = res.ticket; suggestTyped = typed;
    $('#vf-suggest-name').textContent = res.suggestion;
    $('#vf-suggest').hidden = false;
    $('#vf-submit').hidden = true;
    setTimeout(function () { $('#vf-yes').focus(); }, 40);
  }
  function hideSuggest() {
    suggestTicket = '';
    $('#vf-suggest').hidden = true;
    $('#vf-submit').hidden = false;
  }
  $('#vf-name').addEventListener('input', hideSuggest);
  $('#vf-class').addEventListener('change', hideSuggest);
  $('#vf-no').addEventListener('click', function () {
    hideSuggest();
    formError($('#form-verify'), INLINE.verify_not_found, $('#vf-name'));
  });
  $('#vf-yes').addEventListener('click', function () {
    if (!suggestTicket) return;
    var btn = this, form = $('#form-verify');
    busy(btn, true, 'لحظة');
    api('confirmName', { ticket: suggestTicket, typed: suggestTyped }).then(function (res) {
      busy(btn, false);
      if (res.ok) return verified(res, res.firstName);
      hideSuggest();
      switch (res.code) {
        case 'use_lookup': return message('use_lookup', res.firstName);
        case 'already_has_topic': return message('already_has_topic', res.firstName);
        case 'closed': state.round2Open = false; updateRound2(); return message('closed_round2');
        case 'session_expired': return formError(form, 'انتهت مدة الاقتراح. اضغطي «متابعة» مرة أخرى.');
        default: return formError(form, INLINE.server_error);
      }
    }).catch(function (err) {
      busy(btn, false);
      if (err.code === 'not_configured') return message('not_configured');
      formError(form, INLINE.network);
    });
  });

  // ─── المجالات ───
  var ICONS = {
    health: '<path d="M20.8 8.6a4.8 4.8 0 0 0-8.8-2.7 4.8 4.8 0 0 0-8.8 2.7c0 5 8.8 10.4 8.8 10.4s8.8-5.4 8.8-10.4Z"/><path d="M7 11.2h2.4l1.6-2.6 2 5 1.5-2.4H17"/>',
    env: '<path d="M5 19c8.5 0 14-6 14-14-8.5 0-14 5.5-14 14Z"/><path d="M5 19l8-8"/>',
    chem: '<path d="M9.5 3h5M10.5 3v5.5L5.2 18a2 2 0 0 0 1.8 3h10a2 2 0 0 0 1.8-3l-5.3-9.5V3"/><path d="M7.4 15h9.2"/>',
    physics: '<path d="M13 2.5 5 13.5h6l-1 8 8-11h-6z"/>',
    math: '<path d="M4 20V11M10 20V4M16 20v-7M21.5 20h-19"/>',
    people: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5"/><path d="M16 5.2a3 3 0 0 1 0 5.6M18 14.8c1.8.6 3 2.4 3 4.7"/>'
  };

  function renderAreas(flash) {
    var box = $('#areas');
    var f = $('.view[data-view="areas"] .flash');
    f.textContent = flash || ''; f.hidden = !flash;
    if (!state.areas.length) {
      box.innerHTML = '<div class="card empty"><strong>انتهت الموضوعات المتاحة الآن.</strong>' +
        '<p class="muted" style="margin:4px 0 0">إن كانت لديك فكرة مشروع خاصة، فتواصلي مع منسقة المشروع.</p></div>';
      return;
    }
    box.innerHTML = state.areas.map(function (a) {
      return '<button type="button" class="area" data-area="' + esc(a.key) + '">' +
        '<span class="area-icon" aria-hidden="true"><svg viewBox="0 0 24 24">' + (ICONS[a.key] || ICONS.env) + '</svg></span>' +
        '<span class="area-label">' + esc(a.label) + '</span>' +
        '<span class="area-count">' + countLabel(a.count) + '</span></button>';
    }).join('');
  }

  // ─── اقتراح موضوع من المجال ───
  function areaBusy(btn) {
    $$('.area').forEach(function (x) { x.disabled = true; });
    btn.querySelector('.area-count').innerHTML = '<span class="spinner" style="border-color:rgba(140,106,15,.3);border-top-color:#8C6A0F"></span>';
  }

  $('#areas').addEventListener('click', function (e) {
    var b = e.target.closest('.area');
    if (!b || b.disabled) return;
    var key = b.getAttribute('data-area');
    state.area = state.areas.filter(function (a) { return a.key === key; })[0];
    areaBusy(b);
    api('propose', { token: state.token, area: key }).then(handleProposal).catch(function () {
      renderAreas(INLINE.network);
    });
  });

  function handleProposal(res, flash) {
    if (res.ok) {
      state.pick = res.topic;
      renderProposal(res, typeof flash === 'string' ? flash : '');
      return show('proposal');
    }
    if (res.code === 'no_more_in_area') {
      state.pick = null;
      state.areas = res.areas || [];
      renderAreas('لم يبقَ في هذا المجال موضوع آخر متاح لكِ. اختاري مجالاً آخر.');
      return show('areas');
    }
    handleSessionError(res);
  }

  function renderProposal(res, flash) {
    var t = res.topic;
    $('#pr-kicker').textContent = 'الخطوة ٢ من ٢ · ' + (t.area || (state.area && state.area.label) || '');
    var f = $('.view[data-view="proposal"] .flash');
    f.textContent = flash || ''; f.hidden = !flash;
    $('#proposal').innerHTML = '<header class="sheet-head"><div class="chips">' + chipsHtml(t) + '</div>' +
      '<h2 class="sheet-title">' + esc(t.title) + '</h2></header>' + overviewHtml(t) +
      '<p class="muted small">التفاصيل الكاملة وخطواتك الأولى تظهر بعد قبول الموضوع.</p>';
    setWatermark('مقترح لـ ' + (state.first || '') + ' · غير مُسند');
    $('#pr-remaining').textContent = res.remaining > 0
      ? 'في هذا المجال ' + countLabel(res.remaining) + ' غيره إن أردتِ اقتراحاً آخر.'
      : 'هذا آخر موضوع متاح لكِ في هذا المجال.';
    $('#btn-decline').textContent = res.remaining > 0 ? 'لا، اقترحي عليّ موضوعاً آخر' : 'لا، أريد مجالاً آخر';
  }

  // «لا»: يعود الموضوع للجميع، ويُقترح التالي في المجال نفسه
  $('#btn-decline').addEventListener('click', function () {
    if (!state.pick) return;
    var btn = this;
    busy(btn, true, 'نعيده للقائمة ونبحث عن غيره');
    $('#btn-accept').disabled = true;
    api('decline', { token: state.token, topicId: state.pick.id, area: state.area ? state.area.key : '' }).then(function (res) {
      busy(btn, false); $('#btn-accept').disabled = false;
      handleProposal(res, 'هذا اقتراح آخر في المجال نفسه.');
    }).catch(function () {
      busy(btn, false); $('#btn-accept').disabled = false;
      var f = $('.view[data-view="proposal"] .flash'); f.textContent = INLINE.network; f.hidden = false;
    });
  });

  // «نعم»: تأكيد برقم الجوال
  $('#btn-accept').addEventListener('click', function () { if (state.pick) openDialog(); });

  // الرجوع إلى المجالات يترك الموضوع دون أن يُحسب رفضاً
  function releaseProposal() {
    if (!state.pick || !state.token) return;
    var id = state.pick.id;
    state.pick = null;
    api('decline', { token: state.token, topicId: id, releaseOnly: true }).then(function (res) {
      if (res.ok && res.areas) { state.areas = res.areas; renderAreas(); }
    }).catch(function () {});
  }
  $('#btn-back-areas').addEventListener('click', function () {
    releaseProposal();
    renderAreas();
    show('areas');
  });

  function refreshAreas(flash) {
    return api('areas', { token: state.token }).then(function (res) {
      if (res.ok) { state.areas = res.areas || []; renderAreas(flash); return show('areas'); }
      handleSessionError(res);
    }).catch(function () { renderAreas(INLINE.network); show('areas'); });
  }

  function handleSessionError(res) {
    if (res.code === 'session_expired') { state.token = ''; return message('session_expired'); }
    if (res.code === 'closed') { state.round2Open = false; updateRound2(); return message('closed_round2'); }
    if (res.code === 'already_has_topic') return message('already_has_topic', state.first);
    renderAreas(INLINE.server_error);
    show('areas');
  }

  function reqChip(req) {
    var cls = req.indexOf('مختبر المدرسة') >= 0 ? 'lab' : (req.indexOf('جامعية') >= 0 ? 'uni' : '');
    return '<span class="chip ' + cls + '">' + esc(req) + '</span>';
  }

  // ─── نافذة التأكيد ───
  var dlg = $('#confirm');
  function openDialog() {
    $('#cf-topic').textContent = state.pick ? state.pick.title : '';
    formError($('#form-claim'), '');
    if (typeof dlg.showModal === 'function') dlg.showModal();
    else dlg.setAttribute('open', '');
    setTimeout(function () { $('#cf-phone').focus(); }, 60);
  }
  function closeDialog() {
    if (dlg.open) { if (typeof dlg.close === 'function') dlg.close(); else dlg.removeAttribute('open'); }
  }
  $('#cf-cancel').addEventListener('click', closeDialog);

  $('#form-claim').addEventListener('submit', function (e) {
    e.preventDefault();
    var form = e.target, btn = $('button[type="submit"]', form), phoneIn = $('#cf-phone');
    var phone = normPhone(phoneIn.value);
    if (!phone) return formError(form, INLINE.bad_phone, phoneIn);
    if (!state.pick) return closeDialog();
    formError(form, '');
    busy(btn, true, 'نسجّل قبولك');
    $('#cf-cancel').disabled = true;
    api('claim', { token: state.token, topicId: state.pick.id, phone: phone }).then(function (res) {
      busy(btn, false); $('#cf-cancel').disabled = false;
      if (res.ok) {
        closeDialog(); form.reset();
        if (!state.tester) state.token = '';      // جلسة التجربة تبقى لتجربة أخرى
        state.pick = null;
        renderResult(res.topic, state.first || res.firstName);
        return show('result');
      }
      switch (res.code) {
        case 'bad_phone': return formError(form, INLINE.bad_phone, phoneIn);
        case 'phone_taken': return formError(form, INLINE.phone_taken, phoneIn);
        case 'topic_taken':
          closeDialog();
          state.pick = null;
          state.areas = res.areas || state.areas;
          renderAreas('انتهت مدة الحجز، وسبقتك زميلة إلى هذا الموضوع. اختاري مجالاً وسنقترح عليكِ غيره.');
          return show('areas');
        case 'already_has_topic': closeDialog(); return message('already_has_topic', state.first);
        case 'not_found': closeDialog(); return message('not_found_claim');
        default: closeDialog(); return handleSessionError(res);
      }
    }).catch(function () {
      busy(btn, false); $('#cf-cancel').disabled = false;
      formError(form, INLINE.network);
    });
  });

  // ─── ورقة الموضوع ───
  function setFirst(first) { $$('[data-first]').forEach(function (s) { s.textContent = first || ''; }); }

  // ─── حماية الاقتراح: علامة مائية باسمها، ومنع النسخ والطباعة قبل القبول ───
  function setWatermark(text) {
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="260" height="150">' +
      '<text x="130" y="80" text-anchor="middle" font-family="Tajawal, Tahoma, sans-serif" font-size="17" font-weight="700" ' +
      'fill="#0F5C56" transform="rotate(-24 130 75)" direction="rtl">' + esc(text) + '</text></svg>';
    $('#watermark').style.backgroundImage = 'url("data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg) + '")';
  }
  function inProposal() { return document.body.classList.contains('is-proposal'); }
  ['copy', 'cut', 'contextmenu', 'selectstart', 'dragstart'].forEach(function (ev) {
    document.addEventListener(ev, function (e) {
      if (inProposal() && e.target.closest && e.target.closest('.view[data-view="proposal"]') && !e.target.closest('dialog')) {
        e.preventDefault();
      }
    });
  });
  document.addEventListener('keydown', function (e) {
    if (!inProposal() || !(e.ctrlKey || e.metaKey)) return;
    if (e.target.closest && e.target.closest('input, textarea, dialog')) return;
    var k = String(e.key || '').toLowerCase();
    if (k === 'c' || k === 'a' || k === 'p' || k === 's' || k === 'x') e.preventDefault();
  });

  // ─── بناء ورقة الموضوع: الشرح المبسّط أولاً، ثم تفاصيل الدليل ───
  function chipsHtml(t) {
    return '<span class="chip code">' + esc(t.id) + '</span>' +
      '<span class="chip">مجال موهبة: ' + esc(t.field) + '</span>' + reqChip(t.req) +
      '<span class="chip">' + weeksLabel(t.weeks) + '</span>' +
      (t.fast ? '<span class="chip gold">مسار سريع</span>' : '');
  }

  function overviewHtml(t) {
    if (!t.idea) return '';
    var how = (t.how || []).map(function (h, i) {
      return '<li><span class="jn">' + ar(i + 1) + '</span><span class="jt">' + esc(h) + '</span></li>';
    }).join('');
    return '<div class="overview">' +
      '<section class="ov"><h3><span class="ov-icon" aria-hidden="true">💡</span>فكرة الموضوع</h3><p>' + esc(t.idea) + '</p></section>' +
      (t.problem ? '<section class="ov"><h3><span class="ov-icon" aria-hidden="true">❓</span>المشكلة التي يعالجها</h3><p>' + esc(t.problem) + '</p></section>' : '') +
      (how ? '<section class="ov"><h3><span class="ov-icon" aria-hidden="true">🧭</span>كيف ستعملين</h3><ol class="journey">' + how + '</ol></section>' : '') +
      (t.product ? '<section class="ov product"><h3><span class="ov-icon" aria-hidden="true">🏆</span>ماذا ستقدّمين في النهاية</h3><p>' + esc(t.product) + '</p></section>' : '') +
      '</div>';
  }

  function guideHtml(t, full, open) {
    var rows = [['ماذا ستنفذين؟', t.what], ['عن ماذا يدور؟', t.why], ['هل فيه تجارب؟', t.exp], ['المتطلبات', t.needs]];
    if (full) rows.push(['ما يجب تضمينه', t.include], ['مصدر البيانات المفتوح', t.data]);
    var secs = rows.filter(function (r) { return r[1]; }).map(function (r) {
      return '<section class="sec"><h3>' + r[0] + '</h3><p>' + esc(r[1]) + '</p></section>';
    }).join('');
    if (!t.idea) return secs;                       // لا شرح مبسّط: تُعرض التفاصيل مباشرة كما كانت
    return '<details class="guide"' + (open ? ' open' : '') + '><summary>التفاصيل كما في دليل المسابقة</summary>' + secs + '</details>';
  }

  function renderResult(t, first) {
    state.first = first || '';
    setFirst(first);
    var steps = (t.steps || []).map(function (s, i) {
      return '<li><span class="n">' + ar(i + 1) + '</span><span class="t">' + esc(s) + '</span></li>';
    }).join('');
    $('#sheet').innerHTML =
      '<header class="sheet-head"><div class="chips">' + chipsHtml(t) + '</div>' +
      '<h2 class="sheet-title">' + esc(t.title) + '</h2></header>' +
      overviewHtml(t) +
      (steps ? '<h3 class="steps-title">خطواتك الأولى هذا الأسبوع</h3><ol class="ladder">' + steps + '</ol>' : '') +
      guideHtml(t, true, false);
    state.resultTitle = t.title;
  }

  var baseTitle = document.title;
  function stampPrint() {
    var d = new Date();
    var when;
    try { when = d.toLocaleDateString('ar-SA-u-ca-gregory-nu-arab', { day: 'numeric', month: 'long', year: 'numeric' }); }
    catch (e) { when = ar(d.getDate() + '/' + (d.getMonth() + 1) + '/' + d.getFullYear()); }
    $('#print-stamp').textContent = 'موضوع «إبداع» ٢٠٢٧ للطالبة ' + (state.first || '') + ' · حُفظ في ' + when;
    document.title = 'موضوع إبداع ٢٠٢٧ - ' + (state.first || '');
  }
  function openGuideForPrint() { $$('#sheet details.guide').forEach(function (d) { d.open = true; }); }
  window.addEventListener('beforeprint', function () { stampPrint(); openGuideForPrint(); });
  window.addEventListener('afterprint', function () { document.title = baseTitle; });
  $('#btn-print').addEventListener('click', function () { stampPrint(); openGuideForPrint(); window.print(); });

  // ─── وضع التجربة للمنسقة: رقم وهمي من ورقة الإعدادات، والخادم لا يحفظ فيه شيئاً ───
  function setTrial(on, token) {
    state.tester = on;
    if (on) state.token = token || '';
    document.body.classList.toggle('is-trial', on);
  }
  $('#btn-trial-round2').addEventListener('click', function () {
    if (!state.tester || !state.token) return;
    var btn = this;
    busy(btn, true, 'لحظة');
    refreshAreas().then(function () { busy(btn, false); });
  });

  $('#btn-exit').addEventListener('click', function () {
    setTrial(false);
    state = { token: '', first: '', areas: [], area: null, topics: [], pick: null, round2Open: state.round2Open };
    $('#sheet').innerHTML = '';
    setFirst('');
    show('home');
  });

  // ─── حجم الخط ───
  var SIZES = [0.92, 1, 1.12, 1.25];
  var sizeIdx = 1;
  try { var saved = Number(localStorage.getItem('ibdaa-fs')); if (saved >= 0 && saved < SIZES.length) sizeIdx = saved; } catch (e) {}
  function applySize() {
    document.documentElement.style.setProperty('--fs', SIZES[sizeIdx]);
    try { localStorage.setItem('ibdaa-fs', String(sizeIdx)); } catch (e) {}
  }
  $$('.size-ctl button').forEach(function (b) {
    b.addEventListener('click', function () {
      sizeIdx = Math.max(0, Math.min(SIZES.length - 1, sizeIdx + Number(b.getAttribute('data-size'))));
      applySize();
    });
  });
  applySize();

  // ─── البدء ───
  function updateRound2() {
    var c = $('#choice-round2');
    $('#round2-badge').hidden = state.round2Open;
    if (state.round2Open) c.removeAttribute('aria-disabled'); else c.setAttribute('aria-disabled', 'true');
  }

  history.replaceState({ view: 'home' }, '', location.pathname);
  show('home', true);
  if (!API) { message('not_configured'); return; }
  api('status').then(function (res) {
    if (!res.ok) return;
    state.round2Open = !!res.round2Open;
    updateRound2();
  }).catch(function () { /* الخادم سيجيب لاحقاً عند كل خطوة */ });
})();
