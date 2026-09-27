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
    lookup_not_found: 'لم نجد طالبة بهذا الرقم وهذا الاسم. تأكدي من الرقم ومن كتابة اسمك الأول، وإن استمرت المشكلة فراجعي منسقة المشروع.',
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
    if (!noHistory) history.pushState({ view: view }, '', view === 'home' ? location.pathname : '#' + view);
    window.scrollTo(0, 0);
    var h = $('.view[data-view="' + view + '"] [tabindex="-1"]');
    if (h) setTimeout(function () { try { h.focus({ preventScroll: true }); } catch (e) { h.focus(); } }, 40);
  }

  window.addEventListener('popstate', function (e) {
    var v = (e.state && e.state.view) || 'home';
    if ((v === 'areas' || v === 'topics') && !state.token) v = 'home';
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
    if (view === 'verify' && !state.round2Open) return message('closed_round2');
    if (view === 'areas') { renderAreas(); }
    // نموذج نظيف في كل دخول، حتى لا تظهر بيانات طالبة سابقة على جوال مشترك
    if (view === 'lookup' || view === 'verify') {
      var f = $(view === 'lookup' ? '#form-lookup' : '#form-verify');
      f.reset(); formError(f, '');
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
    if (!first) return formError(form, INLINE.bad_name, firstIn);
    formError(form, '');
    busy(btn, true, 'نبحث عن موضوعك');
    api('lookup', { phone: phone, firstName: first }).then(function (res) {
      busy(btn, false);
      if (res.ok) {
        form.reset();
        renderResult(res.topic, first);
        return show('result');
      }
      switch (res.code) {
        case 'not_found': return formError(form, INLINE.lookup_not_found, phoneIn);
        case 'bad_phone': return formError(form, INLINE.bad_phone, phoneIn);
        case 'bad_name': return formError(form, INLINE.bad_name, firstIn);
        case 'too_many': return formError(form, INLINE.too_many);
        case 'closed': return message('closed_lookup');
        case 'no_topic_yet': return message('no_topic_yet', first);
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
    busy(btn, true, 'نتحقق من اسمك');
    api('verify', { fullName: name, cls: clsIn.value }).then(function (res) {
      busy(btn, false);
      if (res.ok) {
        state.token = res.token; state.first = typedFirst; state.areas = res.areas || [];
        form.reset();
        setFirst(typedFirst);
        return go('areas');
      }
      switch (res.code) {
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

  $('#areas').addEventListener('click', function (e) {
    var b = e.target.closest('.area');
    if (!b || b.disabled) return;
    var key = b.getAttribute('data-area');
    var area = state.areas.filter(function (a) { return a.key === key; })[0];
    $$('.area').forEach(function (x) { x.disabled = true; });
    b.querySelector('.area-count').innerHTML = '<span class="spinner" style="border-color:rgba(140,106,15,.3);border-top-color:#8C6A0F"></span>';
    api('topics', { token: state.token, area: key }).then(function (res) {
      if (res.ok) {
        state.area = area; state.topics = res.topics || [];
        if (!state.topics.length) return refreshAreas('نفدت موضوعات هذا المجال قبل لحظات. اختاري مجالاً آخر.');
        renderTopics();
        return show('topics');
      }
      handleSessionError(res);
    }).catch(function () {
      renderAreas(INLINE.network);
    });
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
    renderAreas(INLINE.server_error);
    show('areas');
  }

  // ─── الموضوعات ───
  function reqChip(req) {
    var cls = req.indexOf('مختبر المدرسة') >= 0 ? 'lab' : (req.indexOf('جامعية') >= 0 ? 'uni' : '');
    return '<span class="chip ' + cls + '">' + esc(req) + '</span>';
  }

  function renderTopics() {
    $('#topics-title').textContent = state.area ? state.area.label : '';
    $('#topics').innerHTML = state.topics.map(function (t) {
      return '<article class="topic">' +
        '<div class="chips"><span class="chip code">' + esc(t.id) + '</span>' + reqChip(t.req) +
        '<span class="chip">' + weeksLabel(t.weeks) + '</span>' +
        (t.fast ? '<span class="chip gold">مسار سريع</span>' : '') + '</div>' +
        '<h2>' + esc(t.title) + '</h2>' +
        '<p>' + esc(t.what) + '</p>' +
        '<p class="muted small">مجال موهبة: ' + esc(t.field) + '</p>' +
        '<button type="button" class="primary" data-pick="' + esc(t.id) + '">أختار هذا الموضوع</button>' +
        '</article>';
    }).join('');
  }

  $('#topics').addEventListener('click', function (e) {
    var b = e.target.closest('[data-pick]');
    if (!b) return;
    var id = b.getAttribute('data-pick');
    state.pick = state.topics.filter(function (t) { return t.id === id; })[0];
    openDialog();
  });

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
    busy(btn, true, 'نسجّل اختيارك');
    $('#cf-cancel').disabled = true;
    api('claim', { token: state.token, topicId: state.pick.id, phone: phone }).then(function (res) {
      busy(btn, false); $('#cf-cancel').disabled = false;
      if (res.ok) {
        closeDialog(); form.reset();
        state.token = '';
        renderResult(res.topic, state.first || res.firstName);
        return show('result');
      }
      switch (res.code) {
        case 'bad_phone': return formError(form, INLINE.bad_phone, phoneIn);
        case 'phone_taken': return formError(form, INLINE.phone_taken, phoneIn);
        case 'topic_taken':
          closeDialog();
          state.areas = res.areas || state.areas;
          renderAreas('سبقتك زميلة إلى هذا الموضوع قبل لحظات. اختاري موضوعاً آخر.');
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

  function renderResult(t, first) {
    state.first = first || '';
    setFirst(first);
    var chips = '<span class="chip code">' + esc(t.id) + '</span>' +
      '<span class="chip">مجال موهبة: ' + esc(t.field) + '</span>' + reqChip(t.req) +
      '<span class="chip">' + weeksLabel(t.weeks) + '</span>' +
      (t.fast ? '<span class="chip gold">مسار سريع</span>' : '');
    var secs = [
      ['ماذا ستنفذين؟', t.what], ['عن ماذا يدور؟', t.why], ['هل فيه تجارب؟', t.exp],
      ['المتطلبات', t.needs], ['ما يجب تضمينه', t.include], ['مصدر البيانات المفتوح', t.data]
    ].filter(function (s) { return s[1]; }).map(function (s) {
      return '<section class="sec"><h3>' + s[0] + '</h3><p>' + esc(s[1]) + '</p></section>';
    }).join('');
    var steps = (t.steps || []).map(function (s, i) {
      return '<li><span class="n">' + ar(i + 1) + '</span><span class="t">' + esc(s) + '</span></li>';
    }).join('');
    $('#sheet').innerHTML =
      '<header class="sheet-head"><div class="chips">' + chips + '</div>' +
      '<h2 class="sheet-title">' + esc(t.title) + '</h2></header>' + secs +
      (steps ? '<h3 class="steps-title">خطواتك الأولى هذا الأسبوع</h3><ol class="ladder">' + steps + '</ol>' : '');
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
  window.addEventListener('beforeprint', stampPrint);
  window.addEventListener('afterprint', function () { document.title = baseTitle; });
  $('#btn-print').addEventListener('click', function () { stampPrint(); window.print(); });

  $('#btn-exit').addEventListener('click', function () {
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
