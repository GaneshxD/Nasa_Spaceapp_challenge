/* Orbit Ranger — Level 6: land on the Moon.
 * A second complete mission, with its own trade-offs:
 *   plan    choose a real Apollo landing site, the science kit and who flies the landing
 *   orbit   one pass around the back of the Moon: in contact with Earth, loss of signal, the deorbit burn
 *           done alone, and contact again. It shows what the radio link carries, and why and how it is lost.
 *           A mistimed burn is paid for in landing propellant
 *   sit     take your place at the lander's window
 *   fly     the last minute of the descent, from the window or from outside, with every instrument explained
 *   walk    set up the science in one-sixth gravity before the oxygen runs low
 *   report  a score out of 100 and what the numbers mean
 * The rules are in js/core/lunar.js and js/core/comm.js, the 3D scene in js/scene/moon.js.
 */
(function () {
  'use strict';
  var RG = window.RG, L = RG.Lunar, C = RG.Comm, M = RG.MoonScene, Stage = RG.Stage, A = RG.Audio, W = RG.Widgets, K = RG.LevelKit, Pg = RG.Progress;
  var say = K.say, bar = K.bar, hud = K.hud, controls = K.controls, set = K.set, keys = K.keys, num = W.num, esc = W.esc, rd = K.rd, note = K.note, term = W.term;
  var D2R = Math.PI / 180;
  RG.LevelDefs = RG.LevelDefs || {};

  function chip(text, key) { return key ? '<button type="button" class="chip" data-term="' + key + '">' + text + '</button>' : '<span class="chip">' + text + '</span>'; }
  function groundLevel(siteId) { var s = L.SITES[siteId], r = RG.MOON_SITES[siteId].rough; return s.relief >= 400 ? 3 : r > 12 ? 2 : 1; }
  function groundWord(siteId) { return ['', 'smooth', 'bumpy', 'mountains'][groundLevel(siteId)]; }
  function voice(key) { if (RG.Voice) RG.Voice.play(key); }
  function mmss(sec) { var s = Math.max(0, Math.round(Math.abs(sec))); return (sec < 0 ? '+' : '−') + Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); }

  // Who flies the landing. The names are the ones on the plan sheet; the letters are the Apollo computer programs they stand for.
  var MODES = [
    ['full', 'chip', 'Autopilot', 'watch and learn', 'The guidance computer flies the whole landing, as Apollo’s program 64 could. You watch the instruments and learn what each one does. It earns six tenths of the landing points.'], // @voice
    ['auto', 'hand', 'You steer', 'computer on the throttle', 'You pitch the lander; the computer works the throttle to hold the descent rate. This is how every Apollo commander flew the last minutes (program 66).'], // @voice
    ['manual', 'bolt', 'All yours', 'pitch and throttle', 'You pitch the lander and work the throttle. Nobody ever landed on the Moon this way: it is the hardest setting.'] // @voice
  ];
  // What each science job is called by the people who built it.
  var KIT_TERM = { flag: 'vacuum', rocks: 'sample', seismo: 'seismometer', mirror: 'retroreflector', drill: 'heatflow', oxygen: 'lifesupport' };

  /* ---------- the plan sheet is drawn, not written ---------- */
  /** Three small marks, n of them filled: peaks for how rough the ground is, stars for science. */
  function pips(n, kind) {
    var d = kind === 'star' ? 'M6 .8l1.5 3.3 3.6.4-2.7 2.4.8 3.5L6 8.6 2.8 10.4l.8-3.5L.9 4.5l3.6-.4z' : 'M6 1.5l5 9H1z', out = '';
    for (var i = 0; i < 3; i++) out += '<svg viewBox="0 0 12 12" class="mn-pip' + (i < n ? ' is-on' : '') + '" aria-hidden="true"><path d="' + d + '"/></svg>';
    return '<span class="mn-pipset is-' + kind + '">' + out + '</span>';
  }
  /** A ring gauge with its number in the middle. */
  function dial(frac, big, label, level, sub) {
    var c = 2 * Math.PI * 22, f = Math.max(0, Math.min(1, frac));
    return '<div class="mn-dial" data-level="' + level + '"><svg viewBox="0 0 56 56" aria-hidden="true"><circle cx="28" cy="28" r="22" class="md-track"/>' +
      '<circle cx="28" cy="28" r="22" class="md-fill" stroke-dasharray="' + (c * f).toFixed(1) + ' ' + c.toFixed(1) + '" transform="rotate(-90 28 28)"/></svg>' +
      '<b>' + big + '</b><span>' + label + '</span>' + (sub ? '<em>' + sub + '</em>' : '') + '</div>';
  }
  /** A small shaded map of a landing site, made from the same ground the level flies over. The ring is the target. */
  var thumbs = {};
  function siteThumb(id) {
    if (thumbs[id]) return thumbs[id];
    var T = L.terrain(id), n = 64, half = 760, c = document.createElement('canvas'), i, j;
    c.width = c.height = n;
    var g = c.getContext('2d'), img = g.createImageData(n, n), d = img.data, hs = new Float32Array((n + 1) * (n + 1)), gs = new Float32Array(n * n), sum = 0;
    for (j = 0; j <= n; j++) for (i = 0; i <= n; i++) hs[j * (n + 1) + i] = T.height((i / n * 2 - 1) * half, (j / n * 2 - 1) * half);
    for (j = 0; j < n; j++) for (i = 0; i < n; i++) { var h0 = hs[j * (n + 1) + i], v = -(hs[j * (n + 1) + i + 1] - h0) - (hs[(j + 1) * (n + 1) + i] - h0) * 0.6; gs[j * n + i] = v; sum += v * v; }
    var sd = Math.sqrt(sum / (n * n)) || 1;
    for (i = 0; i < n * n; i++) { var s = Math.max(0, Math.min(1, 0.52 + gs[i] / (sd * 3.2))), b = 58 + s * 172; d[i * 4] = b; d[i * 4 + 1] = b - 2; d[i * 4 + 2] = b - 7; d[i * 4 + 3] = 255; }
    g.putImageData(img, 0, 0);
    g.strokeStyle = '#ffc800'; g.lineWidth = 2; g.beginPath(); g.arc(n / 2, n / 2, 4.5, 0, 6.3); g.stroke();
    return (thumbs[id] = c.toDataURL('image/png'));
  }
  function art(inner) { return '<svg viewBox="0 0 48 48" class="mn-art" aria-hidden="true">' + inner + '</svg>'; }
  var KIT_ART = {
    flag: art('<path d="M13 4v40" stroke="#aeb7c4" stroke-width="3" stroke-linecap="round"/><path d="M15 35h21L21.2 20.2H36L15 7z" fill="#DC143C" stroke="#003893" stroke-width="2.4"/><circle cx="20.4" cy="15.4" r="2.2" fill="#fff"/><circle cx="20.4" cy="28.2" r="2.7" fill="#fff"/>'),
    rocks: art('<path d="M5 38l4-11 9-4 7 6 2 9z" fill="#8f8a82"/><path d="M9 27l9-4 2 7-7 3z" fill="#b7b1a7"/><path d="M24 39l5-15 9-3 6 9-2 9z" fill="#77726b"/><path d="M29 24l9-3 2 8-8 2z" fill="#a39d93"/><path d="M17 14l5-5 6 2 1 6-7 3z" fill="#c9c3b8"/>'),
    seismo: art('<path d="M10 40h28" stroke="#b9bec6" stroke-width="4" stroke-linecap="round"/><path d="M15 40V30a9 9 0 0118 0v10z" fill="#d7a836"/><path d="M4 16h8l3-9 5 18 4-13 3 7h17" fill="none" stroke="#e0483c" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"/>'),
    mirror: art('<path d="M8 22l22-6 8 18-22 6z" fill="#9db9d6" stroke="#5b7fa6" stroke-width="2"/><g fill="#eef7ff"><circle cx="17" cy="25" r="2"/><circle cx="24" cy="23" r="2"/><circle cx="31" cy="21" r="2"/><circle cx="20" cy="31" r="2"/><circle cx="27" cy="29" r="2"/><circle cx="33" cy="27" r="2"/></g><path d="M25 26L42 4" stroke="#33d6ff" stroke-width="2.6" stroke-linecap="round" stroke-dasharray="1 5"/>'),
    drill: art('<path d="M24 6v36" stroke="#d7a836" stroke-width="4" stroke-linecap="round"/><path d="M24 14L9 40M24 14l15 26" stroke="#aeb7c4" stroke-width="2.6" stroke-linecap="round"/><path d="M19 30h10M20 35h8" stroke="#8a6a1c" stroke-width="2.4" stroke-linecap="round"/><path d="M4 42h40" stroke="#8f8a82" stroke-width="3" stroke-linecap="round"/>'),
    oxygen: art('<rect x="15" y="10" width="18" height="32" rx="9" fill="#1cb0f6"/><rect x="20" y="4" width="8" height="8" rx="2" fill="#aeb7c4"/><text x="24" y="31" text-anchor="middle" font-size="12" font-weight="800" fill="#fff" font-family="sans-serif">O₂</text>')
  };

  RG.LevelDefs[6] = function () {
    var saved = Pg.data.moon || {};
    var plan = { site: L.SITES[saved.site] ? saved.site : 'apollo11', kit: (saved.kit || ['flag', 'rocks']).filter(function (k) { return L.KIT[k]; }), mode: L.MODES[saved.mode] ? saved.mode : 'auto' };
    var phase = 'plan', seed = 1 + Math.floor(Math.random() * 9999), players = (RG.App.state.players || []).slice();
    var sim = null, T = null, view = 'in', thr = 0.3, told = '', sitStep = 0, landing = null, rumbling = false;
    var walk = null, joy = { x: 0, y: 0 };
    // pass: the trip around the back of the Moon (core/comm.js); doi: how its burn went, once it is flown
    var pass = null, doi = null, passOn = false, flown = false, said = {}, lastKit = null, comm = 'ok', beep = -1, noteClock = 0;
    document.querySelector('.lv').classList.add('lv-moon');
    K.App.view('moon');
    showSite();
    renderPlan();
    say('Plan your Moon landing! Pick a landing site, pack your science kit, then press go. Every choice changes the others: that is a {tradeoff}.', 'happy', 'plan');

    function tell(key, text, mood, clip) { if (told !== key) { told = key; say(text, mood, clip); } }
    function once(key, text, mood, clip) { if (!said[key]) { said[key] = true; told = key; say(text, mood, clip); } }

    /* ================= plan ================= */
    function showSite() {
      T = M.setSite(plan.site);
      M.setBoulders(false);
      M.setTarget(0, true); // the ring goes back on the first target (a flight may have moved or hidden it)
      M.showLander(true);
      M.setLander({ x: 0, y: 0, pitch: 0, thr: 0, fuel: 0 }, true);
      Stage.cameraFn = null; Stage.rig.locked = false;
      Stage.look({ target: new THREE.Vector3(0, 8, 0), radius: 190, az: 2.3, el: 0.32, minR: 30, maxR: 1700, autoSpin: 0.07, speed: 3 }, true);
    }
    /** A ring gauge that explains itself when tapped. */
    function tdial(key, noteText, html) {
      return html.replace('<div class="mn-dial"', '<button type="button" data-term="' + key + '" data-note="' + esc(noteText) + '" class="mn-dial"').replace(/<\/div>$/, '</button>');
    }
    function renderPlan() {
      var p = L.plan(plan), side = document.getElementById('lv-side'), top = side ? side.scrollTop : 0, site = L.SITES[plan.site];
      var sites = L.SITE_ORDER.map(function (id) {
        var s = L.SITES[id], sci = s.science >= 1 ? 3 : s.science >= 0.85 ? 2 : 1, best = (Pg.data.moonBest || {})[id];
        return '<button type="button" class="mn-site" data-lv="site" data-key="' + id + '" aria-pressed="' + (plan.site === id) + '" aria-label="' + s.mission + ', ' + s.name +
          '. Ground: ' + groundWord(id) + '. Science ' + sci + ' of 3.' + (best ? ' Best score ' + best + '.' : '') + '">' +
          '<img src="' + siteThumb(id) + '" alt="" width="64" height="64"><b>' + s.mission.replace('Apollo ', '') + '</b>' + (best ? '<em>' + best + '</em>' : '') +
          '<span>' + s.short + '</span><span class="mn-pips">' + pips(groundLevel(id), 'peak') + pips(sci, 'star') + '</span></button>';
      }).join('');
      var kit = L.KIT_ORDER.map(function (id) {
        var k = L.KIT[id];
        return '<button type="button" class="mn-tile" data-lv="kit" data-key="' + id + '" aria-pressed="' + (plan.kit.indexOf(id) >= 0) + '" aria-label="' + k.name + ', ' + k.kg + ' kilograms' +
          (k.pts ? ', ' + k.pts + ' science points' : ', one more minute outside') + '">' + KIT_ART[id] + '<b>' + k.short + '</b><span class="mn-tags"><i>' + k.kg + ' kg</i>' +
          (k.pts ? '<i class="is-sci">★ ' + k.pts + '</i>' : '<i class="is-o2">+' + L.WALK.o2Extra + ' s</i>') + '</span></button>';
      }).join('');
      // what the last kit piece touched is, and what it costs
      var lk = lastKit && L.KIT[lastKit], kitNote = lk ? '<p class="mn-pick"><b>' + term(KIT_TERM[lastKit], esc(lk.name)) + '.</b> ' + esc(lk.blurb) + ' It adds ' + lk.kg + ' kg' +
        (lk.pts ? ', takes about ' + lk.secs + ' s to set up, and is worth ' + lk.pts + ' science points.' : ' and gives ' + L.WALK.o2Extra + ' more seconds outside.') + '</p>'
        : '<p class="mn-pick is-ask">Tap a piece of kit to see what it is for. Each one is mass the lander has to carry down.</p>';
      var split = '<button type="button" class="mn-split' + (p.over ? ' is-over' : '') + '" data-term="tradeoff" data-note="The lander can spare ' + p.spare + ' kg. You have packed ' + p.kitKg + ' kg of kit, so ' + Math.max(0, p.spare - p.kitKg) + ' kg is carried as extra propellant." aria-label="' +
        (p.over ? 'The kit is ' + (p.kitKg - p.spare) + ' kilograms too heavy' : 'Kit ' + p.kitKg + ' kilograms, extra propellant ' + (p.spare - p.kitKg) + ' kilograms') + '. Tap to learn about trade-offs.">' +
        '<span class="mn-split-bar"><i style="width:' + Math.min(100, p.kitKg / p.spare * 100).toFixed(0) + '%"></i></span>' +
        '<span class="mn-split-key"><span class="is-kit">Kit <b>' + p.kitKg + ' kg</b></span><span class="is-fuel">' + (p.over ? '<b>' + (p.kitKg - p.spare) + ' kg too heavy</b>' : 'Propellant <b>+' + (p.spare - p.kitKg) + ' kg</b>') + '</span></span></button>';
      var mPc = Math.round(p.margin * 100);
      var dials = tdial('margin', 'A clean landing at ' + site.name + ' with this kit burns ' + Math.round(p.used) + ' of ' + Math.round(p.fuel) + ' kg and leaves ' + mPc + '%. That is ' + Math.round(p.hover) + ' seconds of hover in all.',
          dial(p.margin / 0.45, p.over ? '—' : mPc + '%', 'Propellant margin', p.margin < L.MARGIN_THIN ? 'tight' : 'ok', 'left after landing')) +
        tdial('lifesupport', 'Your backpack gives ' + p.o2 + ' seconds outside. The jobs you packed need about ' + Math.round(p.need) + '.',
          dial(p.need / p.o2, p.o2 + ' s', 'Oxygen', p.need > p.o2 ? 'tight' : 'ok', 'jobs ' + Math.round(p.need) + ' s')) +
        tdial('sample', 'Science points: the kit you carry, times how much this site has to teach (' + site.science + ' here). The most a mission can score is 45.',
          dial(p.science / 45, String(Math.round(p.science)), 'Science', p.jobs.length ? 'ok' : 'tight', 'of 45'));
      var warn = p.checks.filter(function (c) { return c.level !== 'go'; });
      var lights = warn.length ? warn.map(function (c) {
        return '<li class="mn-check" data-level="' + c.level + '"><i aria-hidden="true">' + (c.level === 'nogo' ? '×' : '!') + '</i><span><b>' + c.title + '.</b> ' + c.text + '</span></li>';
      }).join('') : '<li class="mn-check" data-level="go"><i aria-hidden="true">✓</i><span><b>All systems go.</b> Kit, propellant, oxygen and ground all check out.</span></li>';
      var crew = players.length > 1 ? '<p class="mn-crew">' + esc(players[0]) + ' pitches the lander (A, D). ' + esc(players[1]) + (plan.mode === 'manual' ? ' works the throttle (↑, ↓).' : ' calls out altitude and propellant.') +
        (players[2] ? ' ' + esc(players[2]) + ' picks the kit.' : '') + (players[3] ? ' ' + esc(players[3]) + ' picks the site.' : '') + '</p>' : '';
      var mode = MODES.filter(function (m) { return m[0] === plan.mode; })[0];
      K.side('<h2>Moon landing</h2>' + crew +
        '<h3 class="mn-h"><i>1</i>Landing site</h3><div class="mn-sites">' + sites + '</div>' +
        '<p class="mn-pick"><b>' + site.mission + ', ' + site.name + '.</b> ' + esc(site.blurb) + '</p>' +
        '<p class="why-line"><i>Why it matters</i>' + (groundLevel(plan.site) === 1 ? 'Flat ' + term('mare', 'mare') + ' ground is the easiest to land on' : groundLevel(plan.site) === 2 ? 'Bumpy ground leaves fewer safe spots' : 'High ground on the way in costs propellant') +
        ', and science here counts ×' + site.science + '. ' + esc(site.real) + '</p>' +
        '<h3 class="mn-h"><i>2</i>Science kit</h3><div class="mn-kit">' + kit + '</div>' + kitNote + split + '<div class="mn-dials">' + dials + '</div>' +
        '<h3 class="mn-h"><i>3</i>Who flies the landing</h3><div class="mn-modes is-three" role="group" aria-label="Who flies the landing">' + MODES.map(function (m) {
          return '<button type="button" data-lv="mode" data-key="' + m[0] + '" aria-pressed="' + (plan.mode === m[0]) + '">' + W.icon(m[1]) + '<b>' + m[2] + '</b><span>' + m[3] + '</span></button>';
        }).join('') + '</div><p class="mn-pick">' + mode[4].replace('guidance computer', term('guidance')).replace('throttle to', term('throttle') + ' to').replace('pitch the lander;', term('pitch', 'pitch') + ' the lander;') + '</p>' +
        '<h3 class="mn-h"><i>4</i>' + term('gonogo', 'Go or no-go?') + '</h3><ul class="mn-checks">' + lights + '</ul>' +
        '<button type="button" class="btn primary big wide" data-lv="board"' + (p.ok ? '' : ' disabled') + '>' + (doi ? 'Go for landing' : 'Go for the Moon') + '</button>' +
        // the pass around the Moon is flown once for a mission; a crash and a new plan do not send you round again
        (doi ? '<p class="mn-pick">Your ' + term('deorbit', 'deorbit burn') + ' is already done' + (doi.cost ? ': it cost ' + doi.cost + ' kg of propellant' : ', at no cost') +
          '. <button type="button" class="link" data-lv="reorbit"' + (p.ok ? '' : ' disabled') + '>Fly the orbit pass again</button></p>' : ''));
      side = document.getElementById('lv-side'); if (side) side.scrollTop = top;
      bar(0.05);
    }
    function savePlan() { Pg.data.moon = { site: plan.site, kit: plan.kit.slice(), mode: plan.mode }; Pg.save(); }

    /* ================= orbit: around the back of the Moon ================= */
    // The picture is to scale: the Moon is 3,474 km across and the orbit is 110 km above it. Earth is far off the left
    // edge, so far that its radio beams arrive side by side; the Moon's "radio shadow" is the band behind it.
    var OR = { cx: 356, cy: 180, R: 128, W: 640, H: 360 };
    function oxy(phi, r) { var a = Math.PI - phi * D2R, k = OR.R / C.MOON_R * r; return [OR.cx + k * Math.cos(a), OR.cy - k * Math.sin(a)]; }
    function orbitPath() {
      var o = pass.orbit(), ra = C.MOON_R + o.apo, rp = C.MOON_R + o.peri, a = (ra + rp) / 2, e = (ra - rp) / (ra + rp), d = '';
      var peri = (pass.phiBurnAt != null ? pass.phiBurnAt : pass.phiBurn) + 180;
      for (var i = 0; i <= 72; i++) { var phi = i * 5, r = a * (1 - e * e) / (1 + e * Math.cos((phi - peri) * D2R)), q = oxy(phi, r); d += (i ? 'L' : 'M') + q[0].toFixed(1) + ' ' + q[1].toFixed(1); }
      return d + 'Z';
    }
    function orbitSvg() {
      var site = oxy(-L.SITES[plan.site].lon, C.MOON_R), burn = oxy(pass.phiBurn, C.MOON_R + C.PARK_ALT), low = oxy(pass.phiPdi, C.MOON_R + C.LOW_ALT);
      var rnd = Stage.seeded(12), stars = '', craters = '', i;
      for (i = 0; i < 60; i++) stars += '<circle cx="' + (rnd() * OR.W).toFixed(0) + '" cy="' + (rnd() * OR.H).toFixed(0) + '" r="' + (0.4 + rnd() * 0.9).toFixed(1) + '"/>';
      for (i = 0; i < 22; i++) { var ca = rnd() * 6.283, cd = Math.sqrt(rnd()) * (OR.R - 14), cr = 3 + rnd() * rnd() * 16; craters += '<circle cx="' + (OR.cx + Math.cos(ca) * cd).toFixed(0) + '" cy="' + (OR.cy + Math.sin(ca) * cd).toFixed(0) + '" r="' + cr.toFixed(0) + '"/>'; }
      function label(q, text, left, dy) { return '<text class="or-lab" x="' + (q[0] + (left ? -11 : 11)).toFixed(0) + '" y="' + (q[1] + (dy || 4)).toFixed(0) + '" text-anchor="' + (left ? 'end' : 'start') + '">' + text + '</text>'; }
      return '<svg class="or-svg" viewBox="0 0 ' + OR.W + ' ' + OR.H + '" role="img" aria-label="The Moon seen from above its pole, drawn to scale, with the lander’s orbit around it. Earth is off the left edge. Behind the Moon is a shaded band where no radio signal from Earth can reach.">' +
        '<defs><linearGradient id="or-sh" x1="0" x2="1"><stop offset="0" stop-color="#ff5a5a" stop-opacity=".34"/><stop offset="1" stop-color="#ff5a5a" stop-opacity=".06"/></linearGradient>' +
        '<radialGradient id="or-mg" cx=".32" cy=".4" r=".8"><stop offset="0" stop-color="#d9d6cf"/><stop offset="1" stop-color="#8b877f"/></radialGradient></defs>' +
        '<rect width="' + OR.W + '" height="' + OR.H + '" class="or-space"/><g class="or-stars">' + stars + '</g>' +
        '<rect x="' + OR.cx + '" y="' + (OR.cy - OR.R) + '" width="' + (OR.W - OR.cx) + '" height="' + OR.R * 2 + '" fill="url(#or-sh)"/>' +
        '<rect x="' + OR.W + '" y="' + (OR.cy - OR.R) + '" width="600" height="' + OR.R * 2 + '" fill="#ff5a5a" fill-opacity=".06"/>' +
        '<text class="or-shade" x="' + (OR.W - 10) + '" y="' + (OR.cy - OR.R + 16) + '" text-anchor="end">Radio shadow: no signal</text>' +
        // radio from Earth arrives as level, side-by-side rays: two graze the Moon and mark the edges of its shadow, two hit it
        '<g class="or-beams"><path d="M104 ' + (OR.cy - OR.R) + 'H' + (OR.W + 600) + 'M104 ' + (OR.cy + OR.R) + 'H' + (OR.W + 600) + 'M104 96H258M104 264H258"/></g>' +
        '<g class="or-earth"><circle cx="46" cy="180" r="26" fill="#2b62b8"/><path d="M34 166c6-6 14-5 18 0s-2 9-8 9-13-4-10-9zM50 186c5-2 11 1 10 6s-8 7-11 3-2-8 1-9z" fill="#3fa565"/><circle cx="46" cy="180" r="26" fill="none" stroke="#9fd0ff" stroke-width="2" opacity=".7"/>' +
        '<text x="46" y="224" text-anchor="middle">Earth</text><text x="46" y="239" text-anchor="middle" class="or-small">384,400 km away</text><path d="M82 180h22m-7-6 7 6-7 6" class="or-arrow"/></g>' +
        '<circle cx="' + OR.cx + '" cy="' + OR.cy + '" r="' + OR.R + '" fill="url(#or-mg)"/><g class="or-craters">' + craters + '</g>' +
        '<text class="or-face" x="' + (OR.cx - OR.R * 0.5) + '" y="' + (OR.cy - 4) + '" text-anchor="middle">Near side</text><text class="or-face or-small" x="' + (OR.cx - OR.R * 0.5) + '" y="' + (OR.cy + 12) + '" text-anchor="middle">always faces Earth</text>' +
        '<text class="or-face" x="' + (OR.cx + OR.R * 0.5) + '" y="' + (OR.cy - 4) + '" text-anchor="middle">Far side</text><text class="or-face or-small" x="' + (OR.cx + OR.R * 0.5) + '" y="' + (OR.cy + 12) + '" text-anchor="middle">never sees Earth</text>' +
        '<text id="or-count" class="or-count" x="' + OR.cx + '" y="' + (OR.cy + 34) + '" text-anchor="middle" aria-hidden="true"></text><path id="or-path" class="or-path" d=""/>' +
        '<circle class="or-site" cx="' + site[0].toFixed(1) + '" cy="' + site[1].toFixed(1) + '" r="5"/>' + label(site, 'Landing site', true) +
        '<circle class="or-burn" cx="' + burn[0].toFixed(1) + '" cy="' + burn[1].toFixed(1) + '" r="5"/>' + label(burn, 'Deorbit burn here', false) +
        '<circle class="or-low" cx="' + low[0].toFixed(1) + '" cy="' + low[1].toFixed(1) + '" r="4"/>' + label(low, 'Low point, 15 km', true, low[1] > OR.cy ? 16 : -8) +
        '<line id="or-ray" class="or-ray" x1="0" y1="0" x2="0" y2="0"/><g id="or-block" class="or-block" style="display:none"><path d="M-6 -6l12 12M6 -6l-12 12"/></g>' +
        '<g id="or-lm"><circle r="6.5" class="or-lm"/><circle r="11" class="or-halo"/></g>' +
        '<text class="or-scale" x="8" y="' + (OR.H - 8) + '">To scale: the orbit is 110 km above a Moon 3,474 km across. Earth is 221 Moon-widths away.</text></svg>';
    }
    function startOrbit() {
      phase = 'orbit'; told = ''; said = {}; beep = -1; passOn = false;
      pass = new C.Pass(L.SITES[plan.site].lon);
      K.side('');
      document.querySelector('.lv').classList.add('is-orbit');
      var rows = [['capcom', 'Voice', 'Mission Control talks you through it'], ['telemetry', 'Telemetry', 'Earth sees your propellant and systems'],
        ['tracking', 'Tracking', 'Earth measures where you are'], ['uplink', 'Commands', 'Earth sends up the burn numbers']];
      hud('<div class="mn-orbit" id="mn-orbit" data-up="true"><div class="or-pic">' + orbitSvg() + '</div><div class="or-panel">' +
        '<div class="or-link"><b id="or-link-t">In contact</b><span class="mn-bars" id="or-bars" aria-hidden="true"><i></i><i></i><i></i><i></i></span>' + term('delay', '1.3 s each way') + '</div>' +
        // the burn clock comes first: it is the one thing that must never be out of sight
        '<div class="or-clock"><span>Deorbit burn in</span><b id="or-clock"></b><em id="or-warp"></em></div>' +
        '<button type="button" class="or-pad" id="or-pad" data-term="deorbit" hidden><b>Burn card, sent up by Mission Control</b><span>Deorbit burn · point retrograde · ' + Math.round(pass.burnLen) + ' s of engine · slows you by ' + pass.doi.dv.toFixed(0) + ' m/s</span></button>' +
        '<ul class="or-rows">' + rows.map(function (r) { return '<li data-term="' + r[0] + '" tabindex="0" role="button"><i aria-hidden="true"></i><b>' + r[1] + '</b><span>' + r[2] + '</span></li>'; }).join('') + '</ul>' +
        '<div class="or-nums">' + rd('or-alt', 'altitude', 'Altitude', { unit: 'km' }) + rd('or-v', 'orbitalv', 'Velocity', { unit: 'km/h' }) +
        rd('or-ap', 'apoapsis', 'Apoapsis', { unit: 'km', value: '110' }) + rd('or-pe', 'periapsis', 'Periapsis', { unit: 'km', value: '110' }) + '</div></div></div>');
      // the clock waits until the player has had a look: nothing here is a race until the last ten seconds
      controls('<button type="button" class="btn primary big pulse" data-lv="startPass">Start the orbit</button>' + skipBtn());
      document.getElementById('or-path').setAttribute('d', orbitPath());
      Stage.look({ radius: 520, el: 0.5, autoSpin: 0.05 }, false);
      bar(0.08);
      say('You are in a {parking|parking orbit}, 110 km above the Moon. Earth is in view, so {missioncontrol|Mission Control} can talk to you, read your {telemetry}, {tracking|track} you and send commands. Tap any of the four.');
      paintOrbit(1);
    }
    function skipBtn() { return Pg.data.moonOrbit ? '<button type="button" class="btn ghost" data-lv="skipOrbit">Skip: let the computer do it</button>' : ''; }
    function startPass() {
      passOn = true;
      controls('<button type="button" class="btn warn big" data-lv="fire" id="or-fire" disabled>Fire the engine</button>' + skipBtn());
      // the figures of a 110 km orbit of the Moon (core/comm.js), written out so the line can be a recording
      say('Off you go, at 5,865 km/h. One lap takes 119 minutes, so the quiet parts are run fast. Watch the green radio line.', 'happy');
    }
    function paintOrbit(warp) {
      var up = pass.link().up, q = oxy(pass.phi, pass.r), box = document.getElementById('mn-orbit');
      if (!box) return;
      if (box.dataset.up !== String(up)) { box.dataset.up = String(up); set('or-link-t', up ? 'In contact' : 'No signal'); }
      var lm = document.getElementById('or-lm'), ray = document.getElementById('or-ray'), blk = document.getElementById('or-block');
      lm.setAttribute('transform', 'translate(' + q[0].toFixed(1) + ' ' + q[1].toFixed(1) + ')');
      // the radio line runs level, toward Earth; behind the Moon it stops at the Moon's edge
      var stop = up ? 112 : OR.cx + Math.sqrt(Math.max(0, OR.R * OR.R - (q[1] - OR.cy) * (q[1] - OR.cy)));
      ray.setAttribute('x1', q[0].toFixed(1)); ray.setAttribute('y1', q[1].toFixed(1)); ray.setAttribute('x2', stop.toFixed(1)); ray.setAttribute('y2', q[1].toFixed(1));
      blk.style.display = up ? 'none' : ''; if (!up) blk.setAttribute('transform', 'translate(' + stop.toFixed(1) + ' ' + q[1].toFixed(1) + ')');
      if (pass.status === 'burning' || pass.status === 'coast' && !said.path) { document.getElementById('or-path').setAttribute('d', orbitPath()); if (pass.status === 'coast') said.path = true; }
      var o = pass.orbit(), st = pass.status;
      // velocity: steady on the circle, falling through the burn, then whatever the new orbit gives at this height
      var v = st === 'contact' || st === 'dark' ? pass.park.v : st === 'burning' ? pass.park.v - pass.doi.dv / 1000 * (1 - pass.burnLeft / pass.burnLen) : Math.sqrt(C.MOON_MU * (2 / pass.r - 1 / pass.doi.a));
      set('or-alt', num(pass.altKm())); set('or-v', num(v * 3600)); set('or-ap', num(o.apo)); set('or-pe', num(o.peri));
      K.level('or-pe-box', o.peri < 100 ? 'ok' : '');
      note('or-alt', 'You are ' + num(pass.altKm()) + ' km above the Moon. That is close: the Moon is 3,474 km across.');
      note('or-v', num(v * 3600) + ' km/h. Around the Moon that is enough to stay up. Around Earth it would take 28,000.');
      note('or-pe', o.peri < 100 ? 'The burn lowered the low point of your orbit to ' + num(o.peri) + ' km. The final descent starts there.' : 'The low point of your orbit is still ' + num(o.peri) + ' km. The deorbit burn will lower it to 15 km.');
      var tb = pass.toBurn(), fire = document.getElementById('or-fire');
      set('or-clock', pass.fired != null ? (pass.status === 'burning' ? 'burning ' + Math.ceil(pass.burnLeft) + ' s' : 'done') : pass.padIn ? 'T' + mmss(tb) : 'not known yet');
      set('or-warp', pass.done ? '' : !passOn ? 'clock stopped' : warp > 1.5 ? 'time ×' + Math.round(warp) : 'real time');
      if (fire) { var armed = pass.armed(); if (fire.disabled === armed) { fire.disabled = !armed; fire.classList.toggle('pulse', armed); } }
      bar(0.08 + 0.12 * Math.min(1, pass.t / (pass.tBurn + 3600)));
    }
    function orbitEvent(e) {
      if (e === 'pad') {
        document.getElementById('or-pad').hidden = false; A.play('spotted');
        say('{missioncontrol|Mission Control} has worked out your {deorbit|deorbit burn} from its {tracking}, and sent the numbers up by {uplink}. You will need them: the burn happens behind the Moon, where nobody can remind you.');
      } else if (e === 'los') {
        A.play('warn');
        say('{los|Loss of signal}. The Moon is now between you and Earth: 3,474 km of rock. Radio cannot bend around it. No voice, no telemetry, no tracking, no commands. You are on your own.', 'worry');
      } else if (e === 'arm') {
        say('Ten seconds. Fire the engine when the clock reaches zero: press the button or the space bar.', 'wow');
      } else if (e === 'ignite') {
        var err = pass.fired - pass.tBurn; A.rumble(5.5); A.play('go');
        say(pass.byComputer ? 'You missed it, so the computer fired the engine itself[[, ' + C.BACKUP + ' seconds late]].'
          : Math.abs(err) <= 1 ? 'Ignition, right on time! The engine pushes against your motion: a {retrograde} burn.'
          : err > 0 ? 'Ignition, [[' + Math.abs(err).toFixed(1) + ' seconds ]]late. The engine pushes against your motion: a {retrograde} burn.'
          : 'Ignition, [[' + Math.abs(err).toFixed(1) + ' seconds ]]early. The engine pushes against your motion: a {retrograde} burn.', pass.byComputer ? 'worry' : 'cheer');
      } else if (e === 'cutoff') {
        A.stopRumble();
        say('Engine off. You slowed by only 22 m/s, and the far side of your orbit dropped from 110 km to 15 km: the {periapsis}. A small change in {velocity} moves an orbit a long way.');
      } else if (e === 'aos') {
        A.play('alert');
        say('{aos|Acquisition of signal}! Earth is back in view[[ after ' + Math.round(pass.result().darkMin) + ' minutes of silence]]. Fresh {telemetry} is flowing, and Mission Control is checking your new orbit. Every message takes 1.3 seconds to cross.', 'cheer');
      } else if (e === 'go') {
        doi = pass.result(); Pg.data.moonOrbit = true; Pg.save(); A.play('star');
        controls('<button type="button" class="btn primary big pulse" data-lv="descend">Start the powered descent</button>');
        say(doi.onTime ? 'Mission Control: your orbit is 110 by 15 km, right on target. You are {gonogo|go} for {pdi|powered descent}.'
          : doi.err > 0 ? 'Mission Control: your burn was [[' + Math.abs(doi.err).toFixed(1) + ' s ]]late, so your low point has moved[[ ' + Math.round(doi.shiftKm) + ' km]]. Only {tracking} from Earth could tell us. The fix costs landing propellant[[: ' + doi.cost + ' kg]]. You are {gonogo|go}.'
          : 'Mission Control: your burn was [[' + Math.abs(doi.err).toFixed(1) + ' s ]]early, so your low point has moved[[ ' + Math.round(doi.shiftKm) + ' km]]. Only {tracking} from Earth could tell us. The fix costs landing propellant[[: ' + doi.cost + ' kg]]. You are {gonogo|go}.',
          doi.onTime ? 'cheer' : 'worry');
        bar(0.2);
      }
    }
    function orbitFrame(dt) {
      if (!passOn) return;
      var st = pass.status, tb = pass.toBurn();
      // the quiet stretches are run fast; the last ten seconds before the burn are in real time
      var warp = st === 'contact' ? 40 : st === 'dark' ? (tb > C.ARM + 60 ? 100 : tb > C.ARM ? 1 + (tb - C.ARM) * 0.9 : 1) : st === 'burning' ? 6 : st === 'coast' ? 300 : 18;
      if (keys.jump && pass.armed()) pass.ignite(); // the space bar
      if (st === 'contact' && pass.tLos - pass.t < 190) once('los-soon', 'Coming up on the edge of the Moon. Radio travels in straight lines: it needs a clear {lineofsight|line of sight}. Watch the green line.', 'wow');
      // the last ten seconds are counted out loud, in big figures on the face of the Moon
      var count = pass.armed() && tb > 0 ? Math.ceil(tb) : 0, cn = document.getElementById('or-count');
      if (count && count !== beep) { beep = count; A.play('count'); }
      if (cn && cn.textContent !== (count ? String(count) : '')) cn.textContent = count ? String(count) : '';
      pass.advance(dt * warp);
      while (pass.events.length) orbitEvent(pass.events.shift());
      paintOrbit(warp);
    }

    /* ================= board: the orbit pass first, then the cabin ================= */
    function board() {
      savePlan();
      if (doi) toCabin(false); else startOrbit();
    }
    function endOrbit() { A.stopRumble(); passOn = false; document.querySelector('.lv').classList.remove('is-orbit'); }
    /** Let the computer fly the pass around the back of the Moon: the burn is on time, and costs nothing. */
    function skipOrbit() {
      pass = new C.Pass(L.SITES[plan.site].lon);
      for (var i = 0; i < 200000 && !pass.done; i++) { pass.advance(0.25); if (pass.armed() && pass.toBurn() <= 0) pass.ignite(true); }
      pass.events.length = 0;
      doi = pass.result(); doi.skipped = true;
      Pg.data.moonOrbit = true; Pg.save();
    }

    /* ================= sit: at the commander's window ================= */
    function sitCards() {
      return [
        ['There are no seats: Apollo crews flew standing up, held by straps, with their eyes close to the window. See the yellow ring on the ground? That is the landing target. The lines on the window show where the {guidance|computer} is aiming.', 'happy'], // @voice
        plan.mode === 'full' ? ['The {autopilot} flies this landing. Watch the instruments, and tap any of them: the flight waits while you read.', 'wow'] // @voice
          : plan.mode === 'auto' ? ['You {pitch} the lander, and the computer works the {throttle}. Pitch back (lean back) to slow down, pitch forward to move on. Follow the arrows.', 'wow', 'sit3a'] // @voice
          : ['You have the {pitch} and the {throttle}. Pitch back (lean back) to slow down, and keep the {vspeed|descent rate} small near the ground.', 'wow', 'sit3m'] // @voice
      ];
    }
    /** again: true after a crash, when the player has already read the cards at the window. */
    function toCabin(again) {
      var p = L.plan(plan), cost = doi ? doi.cost : 0;
      endOrbit();
      // a mistimed deorbit burn is paid for here: the descent starts with that much less propellant
      sim = new L.Descent({ terrain: T, dry: L.DRY + p.kitKg, fuel: p.fuel - cost, mode: plan.mode, seed: seed });
      thr = sim.s.thr;
      phase = 'sit'; sitStep = 0; view = 'in'; told = ''; said = {}; comm = 'ok'; noteClock = 0;
      K.side('');
      M.setBoulders(sim.ev.boulders);
      M.setTarget(0, true);
      M.setLander(sim.s);
      Stage.rig.locked = true;
      renderFlightHud();
      applyView();
      if (again) startDescent(); else sitCard();
    }
    function sitCard() {
      var c = sitCards()[sitStep];
      say(c[0], c[1], c[2]);
      bar(0.21 + sitStep * 0.02);
      controls('<button type="button" class="btn primary big" data-lv="sitNext">' + (sitStep < 1 ? 'Next' : 'Start the descent') + '</button>');
    }
    function applyView() {
      var inside = view === 'in';
      Stage.cameraFn = inside ? M.cockpitCam : M.chaseCam;
      M.showLander(!inside);
      var ck = document.getElementById('mn-cockpit'); if (ck) ck.hidden = !inside;
      var b = document.getElementById('mn-view'); if (b) b.textContent = inside ? 'Outside view' : 'Window view';
    }

    /* ================= fly ================= */
    // The pitch dial: a green wedge at the pitch the guidance wants, and a small lander at the pitch it has. Both are
    // turned by minus the angle, so that pressing ◀ (pitch back) tilts the little lander to the left.
    function pitchDial() {
      return '<button type="button" class="rd mn-pitch" id="mn-tilt-box" data-term="pitch"><svg viewBox="0 0 60 60" aria-hidden="true"><circle cx="30" cy="30" r="27" class="mp-ring"/>' +
        '<path d="M30 5v6M5 30h6M49 30h6" class="mp-tick"/><g id="mn-want"><path d="M30 30L25.3 3.4A27 27 0 0 1 34.7 3.4Z" class="mp-want"/></g>' +
        '<g id="mn-craft"><path d="M22 31l-6 11M38 31l6 11M13 42h6M41 42h6" class="mp-legs"/><path d="M23.5 22h13l3 9h-19z" class="mp-body"/><path d="M26 22v-6h8v6z" class="mp-cabin"/></g></svg>' +
        '<span class="rd-l">Pitch</span><span class="rd-n"><b id="mn-tilt">0°</b></span><em id="mn-tilt-t"></em></button>';
    }
    function renderFlightHud() {
      var ticks = '';
      for (var i = 0; i <= 6; i++) ticks += '<path d="M' + (486 + i * 3) + ' ' + (150 + i * 46) + 'h22"/><text x="' + (522 + i * 3) + '" y="' + (155 + i * 46) + '">' + (10 + i * 10) + '</text>';
      hud('<div class="mn-cockpit" id="mn-cockpit" aria-hidden="true"><svg viewBox="0 0 1000 620" preserveAspectRatio="none">' +
        '<defs><linearGradient id="ckg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#262a31"/><stop offset="1" stop-color="#121418"/></linearGradient></defs>' +
        '<path fill="url(#ckg)" fill-rule="evenodd" d="M0 0H1000V620H0Z M120 70 L880 50 L940 130 L650 480 L260 480 L70 210 Z"/>' +
        '<path class="ck-frame" d="M120 70 L880 50 L940 130 L650 480 L260 480 L70 210 Z"/><g class="ck-lpd">' + ticks + '</g>' +
        '<g class="ck-rivets">' + [[60, 40], [500, 28], [950, 40], [968, 330], [800, 520], [500, 540], [200, 520], [30, 330]].map(function (r) { return '<circle cx="' + r[0] + '" cy="' + r[1] + '" r="5"/>'; }).join('') + '</g></svg></div>' +
        // eight instruments; each one is a button that says what it measures, why it matters and what its number means now
        '<div class="mn-panel" role="group" aria-label="Flight instruments. Tap one to see what it measures.">' +
        rd('mn-alt', 'altitude', 'Altitude', { unit: 'm' }) +
        rd('mn-vs', 'vspeed', '↓ Vertical velocity', { unit: 'm/s', sub: 'mn-vs-t' }) +
        rd('mn-hs', 'hspeed', '→ Horizontal velocity', { unit: 'm/s', sub: 'mn-hs-t' }) +
        rd('mn-rng', 'range', 'Range to target', { unit: 'm' }) +
        pitchDial() +
        rd('mn-sec', 'hovertime', 'Propellant', { unit: 's of hover', bar: 'mn-fuel' }) +
        rd('mn-thr', 'throttle', 'Throttle', { unit: '%', sub: 'mn-thr-t' }) +
        '<button type="button" class="rd mn-link" id="mn-link-box" data-term="comms" data-state="up"><span class="rd-l">Earth link</span><span class="mn-bars" aria-hidden="true"><i></i><i></i><i></i><i></i></span><em id="mn-link-t">1.3 s each way</em></button>' +
        '</div><div class="mn-hint" id="mn-hint" role="status"></div><div class="mn-alarm" id="mn-alarm" hidden>PROGRAM ALARM 1202</div>');
      paintFlight(true);
    }
    function flightControls() {
      var steer = plan.mode !== 'full';
      controls((steer ? '<button type="button" class="btn big hold" id="mn-b-left" data-hold="left" aria-label="Pitch back, to slow down">◀ Pitch back</button>' : '<span class="mn-tip">The autopilot is flying. Tap any instrument to see what it does.</span>') +
        (plan.mode === 'manual' ? '<span class="mn-thrbtns" role="group" aria-label="Throttle"><button type="button" class="btn hold" id="mn-b-down" data-hold="down" aria-label="Less throttle">▼ Less</button>' +
          '<button type="button" class="btn hold" id="mn-b-up" data-hold="up" aria-label="More throttle">▲ More</button></span>' : '') +
        (steer ? '<button type="button" class="btn big hold" id="mn-b-right" data-hold="right" aria-label="Pitch forward, to move on">Pitch forward ▶</button>' : '') +
        '<button type="button" class="btn ghost" id="mn-view" data-lv="view6">Outside view</button>');
      applyView();
    }
    /** What each number means at this moment, for the pop-up of its instrument. */
    function flightNotes(t, frozen) {
      var hoverThr = Math.round(t.mass * L.G / L.THRUST * 100), secs = t.hs > 1 ? Math.round(t.range / t.hs) : 0, back = t.pitchDeg >= 0;
      note('mn-alt', 'You are ' + (t.alt < 100 ? t.alt.toFixed(1) : num(t.alt)) + ' m above the ground. ' + (t.alt < 30 ? 'This low, the engine blows dust off the surface.' : 'It is measured to the ground right under the lander, so it jumps as hills pass below.'));
      note('mn-vs', (t.vs >= 0 ? 'Coming down at ' + t.vs.toFixed(1) : 'Climbing at ' + (-t.vs).toFixed(1)) + ' m/s. The guidance wants ' + t.wantVs.toFixed(1) + ' now. The legs can take 3 m/s at touchdown.');
      note('mn-hs', 'Moving over the ground at ' + t.hs.toFixed(1) + ' m/s. The guidance wants ' + t.wantHs.toFixed(1) + ' now. It must be under 1.2 m/s at touchdown, or the lander tips over.');
      note('mn-rng', num(t.range) + ' m to the yellow ring, along the ground.' + (secs ? ' At this horizontal velocity that is about ' + secs + ' seconds away.' : ''));
      note('mn-tilt', 'Pitched ' + Math.abs(Math.round(t.pitchDeg)) + '° ' + (back ? 'back' : 'forward') + '. ' + (back ? 'Part of the thrust pushes against your motion, which brakes you.' : 'Part of the thrust pushes you along.') +
        ' The guidance wants ' + Math.round(t.wantPitchDeg) + '°: that is the green wedge.');
      note('mn-sec', Math.round(t.fuel) + ' kg of propellant left: enough to hover for ' + Math.round(t.hover) + ' seconds.' + (doi && doi.cost ? ' The mistimed deorbit burn cost ' + doi.cost + ' kg of it.' : ''));
      note('mn-thr', 'The engine is at ' + Math.round(t.thr * 100) + '% of its 45,040 newtons. Just hovering takes ' + hoverThr + '% now. ' + (plan.mode === 'manual' ? 'You work it.' : 'The computer works it.'));
      note('mn-link', frozen ? 'Your question takes 1.3 s to reach Earth, and the answer 1.3 s to come back. Mission Control can see inside the computer through telemetry. The crew cannot.'
        : 'Earth is in view, ' + Math.round(T.earthEl) + '° above the horizon here, so Mission Control hears you and reads your telemetry. Every signal takes 1.3 s each way.');
    }
    function paintFlight(force) {
      if (!sim) return;
      var t = sim.telemetry(), frozen = sim.alarmLeft > 0;
      if (!frozen) {
        set('mn-alt', t.alt < 100 ? t.alt.toFixed(1) : num(t.alt));
        set('mn-vs', t.vs.toFixed(1)); set('mn-hs', t.hs.toFixed(1));
        set('mn-rng', num(t.range));
        set('mn-tilt', Math.round(t.pitchDeg) + '°');
        set('mn-sec', String(Math.round(t.hover))); set('mn-thr', String(Math.round(t.thr * 100)));
        set('mn-vs-t', 'aim for ' + t.wantVs.toFixed(0)); set('mn-hs-t', 'aim for ' + t.wantHs.toFixed(0)); set('mn-tilt-t', 'aim for ' + Math.round(t.wantPitchDeg) + '°');
      }
      set('mn-thr-t', plan.mode === 'manual' ? 'yours' : 'computer');
      var cr = document.getElementById('mn-craft'), wn = document.getElementById('mn-want');
      if (cr) cr.setAttribute('transform', 'rotate(' + (-t.pitchDeg).toFixed(1) + ' 30 30)');
      if (wn) wn.setAttribute('transform', 'rotate(' + (-t.wantPitchDeg).toFixed(1) + ' 30 30)');
      var f = document.getElementById('mn-fuel'); if (f) f.style.width = (t.fuelFrac * 100).toFixed(1) + '%';
      K.level('mn-sec-box', t.hover < 30 ? 'over' : t.hover < 60 ? 'tight' : '');
      K.level('mn-vs-box', t.alt < 25 && t.vs > 3 ? 'over' : t.alt < 60 && t.vs > 6 ? 'tight' : '');
      K.level('mn-hs-box', t.alt < 25 && t.hs > 1.2 ? 'over' : Math.abs(t.hs - t.wantHs) > 7 ? 'tight' : '');
      K.level('mn-tilt-box', Math.abs(t.pitchDeg - t.wantPitchDeg) > 12 ? 'tight' : '');
      var al = document.getElementById('mn-alarm'); if (al) al.hidden = !frozen;
      var p = document.querySelector('.mn-panel'); if (p) p.classList.toggle('is-frozen', frozen);
      // while the alarm is up, the question is on its way to Earth and the answer on its way back
      var lk = document.getElementById('mn-link-box'), st = frozen ? 'ask' : 'up';
      if (lk && lk.dataset.state !== st) { lk.dataset.state = st; set('mn-link-t', frozen ? 'asking Mission Control' : '1.3 s each way'); }
      if (force || --noteClock <= 0) { noteClock = 12; flightNotes(t, frozen); }
    }
    function want(id, on) { var b = document.getElementById(id); if (b && b.classList.contains('is-want') !== on) b.classList.toggle('is-want', on); }
    function hint() {
      var el = document.getElementById('mn-hint');
      if (phase !== 'fly') { if (el) el.textContent = ''; return; }
      // the flight director: core/lunar.js works out what to do, and a pilot who follows it lands
      var a = sim.advice(), text, cls = '';
      if (plan.mode === 'full') { var t = sim.telemetry(); text = 'Autopilot: ' + (t.alt < 12 ? 'touching down' : t.hs > 6 ? 'braking' : t.range > 14 ? 'closing in' : 'coming straight down'); }
      else if (a.tilt > 0) { text = '◀ Pitch back'; cls = 'is-left'; }
      else if (a.tilt < 0) { text = 'Pitch forward ▶'; cls = 'is-right'; }
      else if (a.engine > 0) { text = '▲ More throttle'; cls = 'is-up'; }
      else if (a.engine < 0) { text = '▼ Less throttle'; cls = 'is-down'; }
      else text = sim.alt() < 40 ? 'Hold it steady' : 'On course';
      if (el && el.textContent !== text) { el.textContent = text; el.className = 'mn-hint ' + cls; }
      // the button to press lights up, as in level 3
      want('mn-b-left', a.tilt > 0); want('mn-b-right', a.tilt < 0); want('mn-b-up', a.engine > 0); want('mn-b-down', a.engine < 0);
    }
    function startDescent() {
      phase = 'fly'; told = ''; flown = true;
      flightControls();
      A.play('go');
      if (plan.mode === 'full') say('{pdi|Powered descent}. The {autopilot} has it. The lander is pitched back, so the engine pushes against its motion and the {hspeed|horizontal velocity} falls.', 'happy');
      else say(plan.mode === 'auto' ? '{pdi|Powered descent}! Follow the arrows: pitch back to slow down.' : '{pdi|Powered descent}! Watch the {vspeed|descent rate}, and follow the arrows.', 'happy', 'descent');
    }
    function flyFrame(dt) {
      var full = plan.mode === 'full';
      if (plan.mode === 'manual') thr = sim.throttleStep(thr, (keys.up ? 1 : 0) - (keys.down ? 1 : 0), dt);
      sim.step(dt, { tilt: full ? 0 : (keys.left ? 1 : 0) - (keys.right ? 1 : 0), thr: thr });
      M.setLander(sim.s);
      var burning = sim.s.thr > 0.05 && sim.s.fuel > 0;
      if (burning && !rumbling) { A.rumble(200); rumbling = true; }
      if (!burning && rumbling) { A.stopRumble(); rumbling = false; }
      var alt = sim.alt(), left = sim.hoverLeft(), rng = Math.abs(sim.dist());
      if (sim.event === 'alarm') {
        // Only Mission Control can tell whether the alarm matters, and its answer has to cross space twice
        sim.event = null; comm = 'ask'; A.play('alert');
        tell('alarm', '{alarm|Program alarm 1202}! [[The numbers have gone blank and the crew cannot tell why. Only {missioncontrol|Mission Control} can. ]]Asking Earth…', 'worry');
      } else if (comm === 'ask' && sim.alarmLeft <= 0) {
        comm = 'ok'; A.play('go');
        tell('alarm-go', 'Mission Control: “We are {gonogo|go} on that alarm.” The answer took 2.6 s to arrive: 1.3 s for the question to reach Earth, and 1.3 s for the reply.', 'cheer');
      } else if (sim.event === 'boulders') {
        sim.event = null; A.play('alert'); M.setTarget(sim.targetX, true);
        tell('boulders', 'Boulders on the target! Fly on to the new ring, 110 m ahead. Moving the target on the way down is a {redesignate|redesignation}. Neil Armstrong had to do it too.', 'wow', 'boulders');
      }
      else if (left < 30 && !sim.calls.c30) { sim.calls.c30 = true; A.play('alert'); tell('c30', 'Mission Control: “30 seconds!” That is all the {hovertime|hover time} left. Land now.', 'worry', 'fuel30'); }
      else if (left < 60 && !sim.calls.c60) { sim.calls.c60 = true; tell('c60', 'Mission Control: “60 seconds.” They read your propellant from {telemetry}, as they did for Apollo 11.', 'worry'); }
      else if (alt < 3 && !sim.calls.contact) { sim.calls.contact = true; tell('contact', '{contact|Contact light}!', 'wow', false); }
      else if (alt < 30 && !sim.calls.dust) { sim.calls.dust = true; tell('dust', 'Picking up some dust. In a {vacuum} it flies out in flat sheets, with no air to make clouds.', 'happy', 'dust'); }
      else if (comm === 'ok' && !full && sim.s.t > 7 && rng > 420) once('brake', 'Watch the {hspeed|horizontal velocity} fall. Pitched back, the engine pushes against your motion: that is braking.');
      else if (comm === 'ok' && rng < 400 && alt > 70) once('glide', 'This slanted way down is the {glidepath|glide path}: about 16°, as on Apollo, so the target stays in the window.');
      else if (comm === 'ok' && rng < 45 && alt < 70 && alt > 30) once('final', 'Nearly over the ring. Lose the last {hspeed|horizontal velocity}, then come straight down: the {gear|legs} take 3 m/s down but only 1.2 m/s sideways.', 'wow');
      bar(0.25 + 0.45 * (1 - Math.min(1, rng / L.APPROACH)));
      paintFlight(); hint();
      if (sim.status === 'landed') touchdown();
      else if (sim.status === 'crash') crashed();
    }
    function endFlight() {
      A.stopRumble(); rumbling = false;
      // A button held at touchdown is taken off the screen before the finger lifts, so its release never arrives:
      // let go of everything here, or the astronaut walks off by itself later.
      Object.keys(keys).forEach(function (k) { keys[k] = false; });
      Stage.shake = 0;
      var h = document.getElementById('mn-hint'); if (h) h.textContent = '';
      controls('');
    }
    /** The touchdown numbers beside what the landing gear was built for. Each one can be tapped. */
    function limits(r) {
      return chip('↓ ' + r.vs.toFixed(1) + ' m/s · legs take 3', 'vspeed') + chip('→ ' + r.hs.toFixed(1) + ' m/s · legs take 1.2', 'hspeed') +
        chip('pitch ' + Math.round(r.tilt) + '°', 'pitch') + chip('slope ' + Math.round(r.slope) + '° · legs take 12°', 'gear');
    }
    var CRASH = {
      fast: ['Too fast', 'The lander hit the ground at {vs} m/s. The {gear|legs} can take 3. Bring the {vspeed|descent rate} down well before the ground.'],
      fuel: ['Out of propellant', 'The tanks ran dry and the engine stopped. Fly straighter to the target, or pack less kit and carry more {propellant}: that spare is your {margin}.'],
      sideways: ['Sliding sideways', 'The lander touched down moving {hs} m/s over the ground and tipped over. The {gear|legs} take only 1.2 m/s of {hspeed|horizontal velocity}. Stop over the target first, then come straight down.'],
      tilt: ['Pitched too far', 'The lander was pitched {tilt}° at touchdown and fell over. Stand it up, with the {pitch} near 0°, before the last few metres.'],
      slope: ['A steep slope', 'The ground here slopes {slope}°. The {gear|legs} can stand on 12°. Look for flat ground, away from crater walls.'],
      boulder: ['Hit a boulder', 'The first target was covered in boulders. When the ring moves, fly on to the new one. That is a {redesignate|redesignation}.'],
      lost: ['Flew off course', 'The lander left the landing area. Keep the yellow ring in sight and follow the arrows. The {range|range to target} shows how far there is to go.']
    };
    function crashed() {
      phase = 'over'; endFlight();
      var r = sim.result, c = CRASH[r.cause] || CRASH.fast;
      var text = c[1].replace('{vs}', r.vs.toFixed(1)).replace('{hs}', r.hs.toFixed(1)).replace('{tilt}', Math.round(r.tilt)).replace('{slope}', Math.round(r.slope));
      view = 'out'; applyView();
      A.play('bad');
      say('Oh no. Let’s see what happened.', 'sad', 'crash');
      K.sheet('bad', '<div class="oops"><svg class="replay" viewBox="0 0 160 110" aria-hidden="true"><path d="M0 92 Q40 84 80 92 T160 90 V110 H0Z" fill="#8d8a84"/>' +
        '<g class="rp-tip" style="transform-origin:80px 88px"><path d="M66 70h28l-4-16H70z" fill="#c9a13c"/><path d="M70 54h20v-12H70z" fill="#d9dde2"/><path d="M66 70l-12 18M94 70l12 18" stroke="#d9dde2" stroke-width="3"/></g>' +
        '<text x="80" y="20" text-anchor="middle">' + c[0] + '</text></svg><div><h2>' + c[0] + '</h2><p>' + W.terms(text) + '</p>' +
        (r.cause === 'lost' ? '' : '<p class="mn-stats">' + limits(r) + '</p>') + '</div></div>' +
        '<div class="actions"><button type="button" class="btn danger big" data-lv="retry">Fly it again</button><button type="button" class="btn" data-lv="replan">Change the plan</button><button type="button" class="btn" data-lv="map">Map</button></div>');
    }
    function touchdown() {
      phase = 'landed'; endFlight();
      landing = sim.result;
      if (plan.mode === 'full') landing.byComputer = true; // the score gives six tenths of the landing points for it
      M.setLander(sim.s, true);
      M.setTarget(0, false);
      view = 'out'; applyView();
      Stage.cameraFn = null; Stage.rig.locked = false;
      Stage.look({ target: new THREE.Vector3(sim.s.x, T.profile(sim.s.x) + 3, 0), radius: 26, az: 2.6, el: 0.16, minR: 8, maxR: 200, autoSpin: 0.12, speed: 3 }, true);
      A.play('star');
      say('Touchdown! The engine is off. You are on the Moon.', 'cheer', 'touchdown');
      bar(0.72);
      var g = landing.grade, word = g === 'soft' ? 'A soft landing' : g === 'firm' ? 'A firm landing' : 'A hard landing';
      K.sheet('good', '<h2>' + word + ' at ' + L.SITES[plan.site].name + '</h2>' +
        '<p class="mn-stats">' + limits(landing) + chip(Math.round(landing.miss) + ' m from the target', 'range') +
        chip(Math.round(landing.fuel) + ' kg of propellant left', 'margin') + chip(Math.round(landing.time) + ' s of flight') + '</p>' +
        '<p>' + W.terms('The {gear|landing gear} is built for 3 m/s down, 1.2 m/s sideways and 12° of slope. ' +
          (g === 'soft' ? 'You were well inside all three.' : g === 'firm' ? 'You were inside them, with a bump.' : 'That was at the edge of them, and the legs took a knock.') +
          ' The sky is black even in daylight: in a {vacuum} there is no air to scatter the sunlight. Look for Earth above the hills. (From here it really hangs ' + Math.round(T.earthEl) +
          '° up; the game draws it lower and bigger so you can see it.)') + '</p>' +
        '<div class="actions"><button type="button" class="btn primary big" data-lv="egress">Open the hatch</button></div>');
    }

    /* ================= walk ================= */
    // the lesson of each job, with its technical word marked
    var KIT_MARK = { flag: ['no wind', '{vacuum|no wind}'], rocks: ['rock and soil', '{sample|rock and soil}'], seismo: ['seismometers', '{seismometer|seismometers}'],
      mirror: ['Apollo mirrors', '{retroreflector|Apollo mirrors}'], drill: ['Heat probes', '{heatflow|Heat probes}'] };
    function lesson(kit) { var m = KIT_MARK[kit], t = L.KIT[kit].lesson; return m ? t.replace(m[0], m[1]) : t; }
    function egress() {
      K.hideSheet();
      phase = 'walk'; told = '';
      var p = L.plan(plan), base = { x: sim.s.x, z: 0 }, tasks = L.tasks(plan.kit, seed, T);
      var props = M.setTasks(tasks, base);
      walk = { x: base.x + 4.5, z: 3.2, y: 0, vy: 0, vx: 0, vz: 0, heading: 0.6, air: false, o2: p.o2, o20: p.o2, base: base, props: props, tasks: tasks, done: {}, work: null,
        step: 0, left: true, first: true, eye: false, top: 0, jumped: false, kitDone: {}, clock: 0, noteAt: 0 };
      walk.y = T.height(walk.x, walk.z);
      M.setAstronaut(walk.x, walk.y, walk.z, walk.heading, true);
      Stage.rig.locked = false; Stage.cameraFn = null;
      // look level across the plain, toward Earth, with the astronaut a little to one side of it
      Stage.look({ target: new THREE.Vector3(walk.x, walk.y + 1.3, walk.z), radius: 9, az: 2.17, el: 0.07, minR: 3, maxR: 45, autoSpin: 0, speed: 6 }, true);
      props.forEach(function (pr) {
        var t = tasks.filter(function (x) { return x.id === pr.id; })[0];
        pr.label = Stage.addLabel(t.name, 'pin-task', { group: 'part', at: function () { return pr.done ? null : pr.pos || (pr.pos = new THREE.Vector3(pr.x, pr.y + 2.2, pr.z)); } });
      });
      renderWalkHud();
      // the stick sits outside the row of buttons, in the corner where a thumb rests
      var st = document.createElement('div'); st.className = 'mn-stick'; st.id = 'mn-stick'; st.setAttribute('aria-hidden', 'true'); st.innerHTML = '<i></i>';
      document.querySelector('.lv').appendChild(st);
      controls('<button type="button" class="btn big hold" data-hold="jump">Jump</button>' +
        '<button type="button" class="btn ghost" data-lv="eye" id="mn-eye">Helmet view</button>' +
        '<button type="button" class="btn warn" data-lv="ingress" id="mn-in">Climb back in</button>');
      bindStick(document.getElementById('mn-stick'));
      say(tasks.length ? 'One small step! Working outside is called an {eva}. Walk to the glowing rings: use the arrow keys, W A S D, or the stick.'
        : 'One small step! Working outside is called an {eva}. Have a look around, then climb back in.', 'cheer', 'egress');
    }
    function bindStick(el) {
      if (!el) return;
      var id = null, cx = 0, cy = 0, R = 44, knob = el.firstChild;
      function move(e) {
        if (e.pointerId !== id) return;
        var dx = (e.clientX - cx) / R, dy = (e.clientY - cy) / R, m = Math.hypot(dx, dy);
        if (m > 1) { dx /= m; dy /= m; }
        joy.x = dx; joy.y = -dy; knob.style.transform = 'translate(' + (dx * R).toFixed(0) + 'px,' + (dy * R).toFixed(0) + 'px)';
      }
      function up(e) { if (e.pointerId !== id) return; id = null; joy.x = joy.y = 0; knob.style.transform = ''; }
      el.addEventListener('pointerdown', function (e) {
        id = e.pointerId; try { el.setPointerCapture(id); } catch (err) { /* older browsers */ }
        var r = el.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2; move(e); e.preventDefault();
      });
      el.addEventListener('pointermove', move); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    }
    function renderWalkHud() {
      var w = walk, rows = '', seen = {};
      w.tasks.forEach(function (t) {
        if (seen[t.kit]) return; seen[t.kit] = true;
        var all = w.tasks.filter(function (x) { return x.kit === t.kit; }), n = all.filter(function (x) { return w.done[x.id]; }).length, ok = n === all.length;
        rows += '<li class="' + (ok ? 'is-done' : '') + '" data-term="' + KIT_TERM[t.kit] + '" tabindex="0" role="button"><i aria-hidden="true">' + (ok ? '✓' : '') + '</i><span>' + L.KIT[t.kit].verb + (all.length > 1 ? ' <b>' + n + '/' + all.length + '</b>' : '') + '</span></li>';
      });
      hud('<div class="mn-jobs plate-w"><button type="button" class="mn-o2" id="mn-o2-box" data-term="lifesupport"><span>Oxygen</span><span class="mn-bar"><i id="mn-o2"></i></span><b id="mn-o2s"></b></button>' +
        (rows ? '<ul>' + rows + '</ul>' : '<p>No jobs on this trip.</p>') + '<p class="mn-next" id="mn-next"></p></div>' +
        '<div class="mn-work" id="mn-work" hidden><span id="mn-work-t"></span><div class="mn-bar"><i id="mn-work-b"></i></div></div>');
      w.noteAt = 0;
    }
    function finishTask(pr) {
      var w = walk, t = w.tasks.filter(function (x) { return x.id === pr.id; })[0];
      w.done[pr.id] = true; M.taskDone(pr.id); A.play('pick');
      var all = w.tasks.filter(function (x) { return x.kit === t.kit; }), n = all.filter(function (x) { return w.done[x.id]; }).length;
      w.kitDone[t.kit] = n / all.length;
      renderWalkHud();
      if (n === all.length) { told = ''; say(lesson(t.kit), 'cheer', t.kit); }
      else say('{sample|Sample} ' + n + ' of ' + all.length + ' in the box.', 'happy', false);
      var total = w.tasks.length, got = Object.keys(w.done).length;
      bar(0.72 + 0.22 * (total ? got / total : 1));
      if (got === total) setTimeout(function () { if (phase === 'walk') tell('home', 'Every job is done. Walk back to the lander and climb in.', 'cheer', 'done'); }, 6500);
    }
    function walkFrame(dt) {
      var w = walk, az = Stage.rig.az;
      var ix = (keys.right ? 1 : 0) - (keys.left ? 1 : 0) + joy.x, iy = (keys.up ? 1 : 0) - (keys.down ? 1 : 0) + joy.y, m = Math.hypot(ix, iy);
      if (m > 1) { ix /= m; iy /= m; m = 1; }
      // forward is away from the camera; right is to the camera's right
      var fx = -Math.cos(az), fz = Math.sin(az), rx = -Math.sin(az), rz = -Math.cos(az);
      var tx = (fx * iy + rx * ix) * L.WALK.speed, tz = (fz * iy + rz * ix) * L.WALK.speed, k = 1 - Math.exp(-dt * (w.air ? 1.2 : 7));
      w.vx += (tx - w.vx) * k; w.vz += (tz - w.vz) * k;
      var nx = w.x + w.vx * dt, nz = w.z + w.vz * dt, far = Math.hypot(nx - w.base.x, nz - w.base.z);
      if (far > L.WALK.range) { nx = w.x; nz = w.z; w.vx = w.vz = 0; tell('far', 'That is far enough. Mission rules: stay close to the lander[[, within ' + L.WALK.range + ' m]], so your {lifesupport|life support} can always get you back.', 'worry'); }
      if (Math.hypot(nx - w.base.x, nz - w.base.z) < 3.4) { nx = w.x; nz = w.z; w.vx = w.vz = 0; } // the lander is in the way
      w.x = nx; w.z = nz;
      var gy = T.height(w.x, w.z), moving = m > 0.15;
      if (!w.air) {
        w.y = gy;
        if (keys.jump) { w.vy = L.WALK.jump; w.air = true; w.top = 0; w.jumped = true; A.play('tap'); }
        else if (moving) { w.step -= dt; if (w.step <= 0) { w.vy = 0.95; w.air = true; w.jumped = false; } } // the loping hop that Apollo crews found easiest
      } else {
        w.vy -= L.G * dt; w.y += w.vy * dt; w.top = Math.max(w.top, w.y - gy);
        if (w.y <= gy) {
          w.y = gy; w.air = false; w.vy = 0; w.step = 0.1; w.left = !w.left;
          M.footprint(w.x, w.z, w.heading, w.left);
          if (w.first) { w.first = false; }
          if (w.jumped && w.top > 0.8) {
            var first = !w.jumpSaid; w.jumpSaid = true;
            tell('jump' + Math.round(w.top * 10), 'What a jump[[: ' + w.top.toFixed(1) + ' m]]! On Earth the same push lifts you six times less[[, about ' + Math.round(w.top / 6.05 * 100) + ' cm]]. That is {moongravity}: a sixth of Earth’s.', 'wow', first ? undefined : false);
          }
        }
      }
      if (moving) { var wantH = Math.atan2(w.vx, w.vz), d = Math.atan2(Math.sin(wantH - w.heading), Math.cos(wantH - w.heading)); w.heading += d * Math.min(1, dt * 8); }
      M.setAstronaut(w.x, w.y, w.z, w.heading, !w.eye);
      Stage.rig.goal.target.set(w.x, w.y + 1.3, w.z); Stage.rig.target.copy(Stage.rig.goal.target);

      // jobs: stand in a ring to do the work
      var near = null, nd = 1e9;
      w.props.forEach(function (pr) { if (pr.done) return; var dd = Math.hypot(pr.x - w.x, pr.z - w.z); if (dd < nd) { nd = dd; near = pr; } });
      var wk = document.getElementById('mn-work');
      if (near && nd < 1.7 && !w.air) {
        var t = w.tasks.filter(function (x) { return x.id === near.id; })[0];
        if (!w.work || w.work.id !== near.id) w.work = { id: near.id, t: 0, secs: t.secs };
        w.work.t += dt;
        if (wk) { wk.hidden = false; set('mn-work-t', t.name + '…'); document.getElementById('mn-work-b').style.width = Math.min(100, w.work.t / w.work.secs * 100).toFixed(0) + '%'; }
        if (w.work.t >= w.work.secs) { w.work = null; if (wk) wk.hidden = true; finishTask(near); }
      } else { w.work = null; if (wk && !wk.hidden) wk.hidden = true; }
      set('mn-next', near ? 'Nearest job: ' + Math.round(nd) + ' m away' : 'Lander: ' + Math.round(Math.hypot(w.x - w.base.x, w.z - w.base.z)) + ' m away');

      w.o2 -= dt; w.clock += dt;
      if (!w.earthSaid && w.clock > 9 && !w.work) { w.earthSaid = true; told = ''; say('Look at the sky! That blue ball is Earth, our home. The helmet view lets you look up.', 'wow', 'earth'); }
      var o = document.getElementById('mn-o2'); if (o) { o.style.width = Math.max(0, w.o2 / w.o20 * 100).toFixed(1) + '%'; o.parentNode.dataset.level = w.o2 < 25 ? 'over' : w.o2 < 50 ? 'tight' : ''; }
      set('mn-o2s', Math.max(0, Math.ceil(w.o2)) + ' s');
      if (w.clock >= w.noteAt) { w.noteAt = w.clock + 1; note('mn-o2', Math.max(0, Math.ceil(w.o2)) + ' seconds of oxygen left in the backpack, of ' + w.o20 + '. When it runs low you go back in, whether the work is finished or not.'); }
      if (w.o2 < 40 && !w.warn) { w.warn = true; A.play('alert'); told = ''; say('Oxygen is getting low. Head back to the lander now.', 'worry', 'o2low'); }
      if (w.o2 <= 0) finish(false);
    }
    /** What the deorbit burn did to this mission, for the debrief. */
    function doiLine() {
      if (!doi) return '';
      if (doi.skipped) return 'The computer flew the deorbit burn behind the Moon, on time. Fly the orbit pass yourself next time: it is the part of the mission done with no help from Earth.';
      if (doi.byComputer) return 'You missed the deorbit burn, so the computer fired the engine ' + C.BACKUP + ' seconds late. Out of contact, nobody could remind you. It cost ' + doi.cost + ' kg of landing propellant.';
      if (doi.onTime) return 'Your deorbit burn was on time, behind the Moon and out of contact with Earth. It cost no extra propellant.';
      return 'Your deorbit burn was ' + Math.abs(doi.err).toFixed(1) + ' seconds ' + (doi.err > 0 ? 'late' : 'early') + ', which moved the low point of the orbit ' + Math.round(doi.shiftKm) + ' km. The fix cost ' + doi.cost + ' kg of landing propellant.';
    }
    function finish(back) {
      if (phase !== 'walk') return;
      phase = 'report';
      var w = walk, surface = { done: w.kitDone, back: back, o2Frac: Math.max(0, w.o2) / w.o20 };
      var sc = L.score(plan, landing, surface), site = L.SITES[plan.site];
      Stage.cameraFn = null; M.showAstronaut(false); controls(''); hud('');
      var stick = document.getElementById('mn-stick'); if (stick) stick.remove();
      Stage.clearLabels('part');
      Stage.look({ target: new THREE.Vector3(w.base.x, T.profile(w.base.x) + 3, 0), radius: 40, el: 0.22, autoSpin: 0.15 }, false);
      Pg.data.moonBest = Pg.data.moonBest || {}; Pg.data.moonSites = Pg.data.moonSites || {};
      if (sc.total > (Pg.data.moonBest[plan.site] || 0)) Pg.data.moonBest[plan.site] = sc.total;
      Pg.data.moonSites[plan.site] = true;
      var nSites = Object.keys(Pg.data.moonSites).length, jobs = L.plan(plan).jobs, allDone = jobs.length >= 3 && jobs.every(function (k) { return w.kitDone[k] === 1; });
      var badges = ['eagle', landing.vs <= 1 && 'feather', landing.fuelFrac < 0.06 && 'bingo', landing.miss <= 5 && 'bullseye', allDone && back && 'geologist',
        plan.mode === 'manual' && 'stick', nSites >= 3 && 'tourist', nSites >= 6 && 'sixpack', doi && doi.onTime && !doi.byComputer && !doi.skipped && 'ontime'];
      var rows = [['Landing', sc.parts.landing, 40], ['Science', sc.parts.science, 45], ['Safe return', sc.parts.safe, 15]].map(function (r) {
        return '<div class="mn-row"><span>' + r[0] + '</span><div class="mn-bar"><i style="width:' + (r[1] / r[2] * 100).toFixed(0) + '%"></i></div><b>' + r[1] + '<small> / ' + r[2] + '</small></b></div>';
      }).join('');
      var lines = (doiLine() ? [doiLine()] : []).concat(sc.lines);
      K.complete(6, sc.stars, sc.total + ' points at ' + site.name,
        '</p><div class="mn-score">' + rows + '</div><ul class="mn-debrief">' + lines.map(function (l) { return '<li>' + l + '</li>'; }).join('') + '</ul><p class="done-line">' +
        'Plan code <b>' + L.encode(plan) + '</b>: share it and a friend can fly the same plan. Try another site or a different kit, there is more than one good plan.', badges,
        { next: 0, again: false, extra: '<button type="button" class="btn primary big" data-lv="replan">New plan</button>',
          words: ['tradeoff', 'margin', 'parking', 'comms', 'telemetry', 'lineofsight', 'los', 'aos', 'delay', 'deorbit', 'retrograde', 'periapsis', 'pdi', 'pitch', 'throttle', 'vspeed', 'hspeed', 'hovertime', 'gear', 'eva', 'moongravity'] });
      RG.Designer.saveLog({ crew: players.join(', ') || 'Ranger', diff: 'Moon, ' + site.mission, stars: sc.stars, score: sc.total, code: L.encode(plan) });
      voice('report');
    }

    return {
      site: function (el) {
        if (phase !== 'plan' || plan.site === el.dataset.key) return;
        plan.site = el.dataset.key; A.play('pick'); showSite(); renderPlan();
        var st = L.SITES[plan.site];
        say(st.mission + ', ' + st.year + '. ' + st.real, 'happy', 's' + st.mission.replace('Apollo ', ''));
      },
      kit: function (el) {
        if (phase !== 'plan') return;
        var k = el.dataset.key, i = plan.kit.indexOf(k), added = i < 0;
        if (i >= 0) { plan.kit.splice(i, 1); A.play('drop'); } else { plan.kit.push(k); A.play('pick'); }
        plan.kit.sort(function (a, b) { return L.KIT_ORDER.indexOf(a) - L.KIT_ORDER.indexOf(b); });
        lastKit = k;
        renderPlan();
        var p = L.plan(plan);
        if (p.over) say('Too heavy! Leave something behind.[[ The lander can spare ' + p.spare + ' kg.]]', 'worry', 'heavy');
        else if (added) say(L.KIT[k].blurb, 'happy', 'k_' + k);
        else say('Lighter: more {propellant} for the landing.[[ ' + p.kitKg + ' kg of kit now, and a {margin} of ' + Math.round(p.margin * 100) + '%.]]', 'happy');
      },
      mode: function (el) {
        if (phase !== 'plan' || !L.MODES[el.dataset.key]) return;
        plan.mode = el.dataset.key; A.play('pick'); renderPlan();
        say(MODES.filter(function (m) { return m[0] === plan.mode; })[0][4]);
      },
      board: function () { if (phase === 'plan' && L.plan(plan).ok) { A.play('tap'); board(); } },
      reorbit: function () { if (phase === 'plan' && L.plan(plan).ok) { A.play('tap'); doi = null; savePlan(); startOrbit(); } },
      startPass: function () { if (phase === 'orbit' && !passOn) { A.play('go'); startPass(); } },
      fire: function () { if (phase === 'orbit' && pass) pass.ignite(); },
      skipOrbit: function () {
        if (phase !== 'orbit') return;
        A.play('tap'); skipOrbit(); toCabin(false);
      },
      descend: function () { if (phase === 'orbit' && doi) { A.play('tap'); toCabin(false); } },
      sitNext: function () { if (phase !== 'sit') return; A.play('tap'); sitStep++; if (sitStep >= 2) startDescent(); else sitCard(); },
      view6: function () { view = view === 'in' ? 'out' : 'in'; applyView(); },
      egress: function () { if (phase === 'landed') { A.play('tap'); egress(); } },
      eye: function () {
        if (phase !== 'walk') return;
        walk.eye = !walk.eye; Stage.cameraFn = walk.eye ? M.eyeCam : null;
        document.getElementById('mn-eye').textContent = walk.eye ? 'Outside view' : 'Helmet view';
      },
      ingress: function () {
        if (phase !== 'walk') return;
        var d = Math.hypot(walk.x - walk.base.x, walk.z - walk.base.z);
        if (d > 9) { told = ''; say('You are too far from the lander[[: ' + Math.round(d) + ' m]]. Walk back to it first.', 'worry'); return; }
        finish(true);
      },
      // after a crash: straight back to the start of the descent, with the same orbit behind you
      retry: function () { if (phase !== 'over') return; K.hideSheet(); seed++; toCabin(true); },
      replan: function () {
        if (phase === 'report') doi = null; // a new mission starts in orbit again
        K.hideSheet(); controls(''); hud(''); endOrbit(); M.clearSurface(); Stage.clearLabels('part');
        var stick = document.getElementById('mn-stick'); if (stick) stick.remove();
        phase = 'plan'; sim = null; walk = null; seed++; showSite(); renderPlan(); say('Change the plan and try again.');
      },
      frame: function (dt) {
        if (phase === 'orbit') orbitFrame(dt);
        else if (phase === 'fly') flyFrame(dt);
        else if (phase === 'walk') walkFrame(dt);
      },
      live: function () { return phase === 'orbit' && passOn && !pass.done || phase === 'fly' || phase === 'walk'; },
      resume: function () { rumbling = false; },
      /** For the browser checks in tools/browser. */
      peek: function () { return { phase: phase, plan: plan, sim: sim, pass: pass, doi: doi, walk: walk }; },
      cleanup: function () {
        A.stopRumble(); Stage.cameraFn = null; Stage.rig.locked = false;
        if (RG.Voice) RG.Voice.stop();
        M.clearSurface(); M.showLander(true);
      }
    };
  };
})();
