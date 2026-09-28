/* شريط شبكة عصبية عمودي على يسار الصفحة الأولى، ولعبة خفيفة:
 * عُقد خضراء تتحرك بحرية داخل الشريط وتتصل بخيوط، وإشارات ذهبية تسري بينها.
 * حين تلمس الطالبة الشريط أو الوجه المبتسم تضيء العقدة الأقرب وتنطلق منها إشارات،
 * وكل عقدة تصلها إشاراتها تُحسب في الفقاعة. إن أضاءت الشبكة كلها احتفل الشريط.
 * يتوقف خارج الصفحة الأولى وحين يُخفى التبويب، ويبقى ساكناً لمن فعّل «تقليل الحركة». */
(function () {
  'use strict';
  var rail = document.getElementById('net-rail');
  var c = document.getElementById('net');
  if (!rail || !c || !c.getContext) return;
  var ctx = c.getContext('2d');
  var hint = document.getElementById('net-hint');
  var buddy = document.getElementById('net-buddy');
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var GREEN = '15,92,86', GOLD = '201,162,39';
  var W = 0, H = 0, LINK = 60, dpr = 1, PAD = 6;
  var nodes = [], pulses = [], pointer = null;
  var raf = 0, running = false, lastSpawn = 0;
  var playing = false, litCount = 0, celebrate = 0, resetTimer = 0;

  function toAr(n) { return String(n).replace(/\d/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'[d]; }); }
  function say(t, isPlaying) {
    if (!hint) return;
    hint.textContent = t;
    hint.classList.toggle('playing', !!isPlaying);
  }
  function face(f) { if (buddy) buddy.textContent = f; }

  function layout() {
    var w = c.clientWidth, h = c.clientHeight;
    if (w < 10 || h < 10) return false;
    if (Math.abs(w - W) < 1 && Math.abs(h - H) < 1 && nodes.length) return false;
    W = w; H = h;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    c.width = Math.round(W * dpr); c.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var count = Math.round(Math.max(16, Math.min(44, (W * H) / (W < 120 ? 2700 : 4200))));
    LINK = Math.max(62, Math.min(118, W * 0.95));
    nodes = [];
    for (var i = 0; i < count; i++) {
      nodes.push({
        x: PAD + Math.random() * (W - PAD * 2), y: 60 + Math.random() * (H - 90),
        vx: (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.45,
        r: 2 + Math.random() * 1.8, glow: 0, lit: false
      });
    }
    pulses = []; litCount = 0; playing = false;
    return true;
  }

  function near(a, b) { var dx = a.x - b.x, dy = a.y - b.y; return dx * dx + dy * dy < LINK * LINK; }

  function fire(from, hops, user) {
    var ns = [];
    for (var i = 0; i < nodes.length; i++) if (nodes[i] !== from && near(from, nodes[i])) ns.push(nodes[i]);
    if (!ns.length || pulses.length > 36) return;
    var to = ns[(Math.random() * ns.length) | 0];
    pulses.push({ a: from, b: to, t: 0, speed: 0.018 + Math.random() * 0.018, hops: hops, user: user });
  }

  function light(n) {
    n.glow = 1;
    if (!playing || n.lit) return;
    n.lit = true; litCount++;
    if (litCount >= nodes.length) {
      celebrate = 1;
      nodes.forEach(function (m) { m.glow = 1; });
      face('🤩');
      say('أحسنتِ! أضأتِ الشبكة كلها 🌟', true);
      clearTimeout(resetTimer);
      resetTimer = setTimeout(function () {
        playing = false; litCount = 0;
        nodes.forEach(function (m) { m.lit = false; });
        face('😊'); say('المسيني مرة أخرى ✨', false);
      }, 3500);
    } else {
      face(litCount > nodes.length / 2 ? '😄' : '😊');
      say('أضأتِ ' + toAr(litCount) + ' من ' + toAr(nodes.length) + ' ✨', true);
    }
  }

  function start() {
    if (playing) return;
    playing = true; litCount = 0; celebrate = 0;
    nodes.forEach(function (m) { m.lit = false; });
  }

  function tapAt(x, y) {
    start();
    var best = null, bd = 1e12;
    for (var i = 0; i < nodes.length; i++) {
      var dx = nodes[i].x - x, dy = nodes[i].y - y, d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = nodes[i]; }
    }
    if (!best) return;
    light(best);
    for (var k = 0; k < 3; k++) fire(best, 3, true);
    if (!running) draw();
  }

  function move() {
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      n.x += n.vx; n.y += n.vy;
      if (n.x < PAD) { n.x = PAD; n.vx = Math.abs(n.vx); } else if (n.x > W - PAD) { n.x = W - PAD; n.vx = -Math.abs(n.vx); }
      if (n.y < 50) { n.y = 50; n.vy = Math.abs(n.vy); } else if (n.y > H - 24) { n.y = H - 24; n.vy = -Math.abs(n.vy); }
      if (n.glow > 0) n.glow = Math.max(n.lit ? 0.25 : 0, n.glow - 0.014);
    }
    for (var p = pulses.length - 1; p >= 0; p--) {
      var q = pulses[p];
      q.t += q.speed;
      if (q.t >= 1) {
        pulses.splice(p, 1);
        if (q.user) light(q.b); else q.b.glow = Math.max(q.b.glow, 0.8);
        if (q.hops > 0 && Math.random() < 0.85) fire(q.b, q.hops - 1, q.user);
      }
    }
    if (celebrate > 0) celebrate = Math.max(0, celebrate - 0.006);
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.lineWidth = 1;
    for (var i = 0; i < nodes.length; i++) {
      var a = nodes[i];
      for (var j = i + 1; j < nodes.length; j++) {
        var b = nodes[j], dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy;
        if (d2 > LINK * LINK) continue;
        var alpha = (1 - Math.sqrt(d2) / LINK) * 0.5;
        var gold = (a.lit && b.lit) || celebrate > 0;
        ctx.strokeStyle = 'rgba(' + (gold ? GOLD : GREEN) + ',' + alpha.toFixed(3) + ')';
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
      if (pointer) {
        var px = a.x - pointer.x, py = a.y - pointer.y, pd = Math.sqrt(px * px + py * py);
        if (pd < LINK) {
          ctx.strokeStyle = 'rgba(' + GOLD + ',' + ((1 - pd / LINK) * 0.65).toFixed(3) + ')';
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(pointer.x, pointer.y); ctx.stroke();
        }
      }
    }
    for (var p = 0; p < pulses.length; p++) {
      var q = pulses[p], x = q.a.x + (q.b.x - q.a.x) * q.t, y = q.a.y + (q.b.y - q.a.y) * q.t;
      ctx.strokeStyle = 'rgba(' + GOLD + ',0.8)'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(q.a.x, q.a.y); ctx.lineTo(x, y); ctx.stroke(); ctx.lineWidth = 1;
      var g = ctx.createRadialGradient(x, y, 0, x, y, 7);
      g.addColorStop(0, 'rgba(' + GOLD + ',1)'); g.addColorStop(1, 'rgba(' + GOLD + ',0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.fill();
    }
    for (var k = 0; k < nodes.length; k++) {
      var n = nodes[k];
      if (n.glow > 0) {
        var gr = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, 12 * n.glow + 3);
        gr.addColorStop(0, 'rgba(' + GOLD + ',' + (0.75 * n.glow).toFixed(3) + ')');
        gr.addColorStop(1, 'rgba(' + GOLD + ',0)');
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(n.x, n.y, 12 * n.glow + 3, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = (n.lit || n.glow > 0.3) ? 'rgba(' + GOLD + ',0.95)' : 'rgba(' + GREEN + ',0.7)';
      ctx.beginPath(); ctx.arc(n.x, n.y, n.r + n.glow, 0, Math.PI * 2); ctx.fill();
    }
  }

  function frame(ts) {
    if (!running) return;
    if (ts - lastSpawn > 650) { var n = nodes[(Math.random() * nodes.length) | 0]; if (n) fire(n, 2, false); lastSpawn = ts; }
    move(); draw();
    raf = requestAnimationFrame(frame);
  }

  function isHome() { return document.body.classList.contains('is-home'); }
  function sync() {
    if (isHome()) { layout(); if (!running) draw(); }
    var want = !reduce && !document.hidden && isHome() && W > 10;
    if (want && !running) { running = true; raf = requestAnimationFrame(frame); }
    else if (!want && running) { running = false; cancelAnimationFrame(raf); }
  }

  function local(e) { var b = c.getBoundingClientRect(); return { x: e.clientX - b.left, y: e.clientY - b.top }; }
  c.addEventListener('pointermove', function (e) { pointer = local(e); }, { passive: true });
  c.addEventListener('pointerleave', function () { pointer = null; });
  c.addEventListener('pointerdown', function (e) { var p = local(e); pointer = p; tapAt(p.x, p.y); });
  c.addEventListener('pointerup', function (e) { if (e.pointerType !== 'mouse') pointer = null; });
  if (buddy) buddy.addEventListener('click', function () {
    tapAt(W / 2, 70 + Math.random() * Math.min(260, H - 100));
  });

  if (window.ResizeObserver) new ResizeObserver(function () { if (isHome() && layout() && !running) draw(); }).observe(rail);
  window.addEventListener('resize', function () { if (isHome() && layout() && !running) draw(); });
  document.addEventListener('visibilitychange', sync);
  document.addEventListener('ibdaa:view', sync);
  sync();
})();
