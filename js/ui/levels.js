/* Orbit Ranger — the level path.
 * Five levels, played in order like a lesson path:
 *   1  Meet the rocket     tap each part to learn it, then a short quiz
 *   2  Build the rocket    pick tanks, engines and boosters; test it on the computer
 *   3  Lift-off            steer the climb to space (altitude, fuel and gyro gauges)
 *   4  Reach orbit         burn sideways until the path closes, then release the satellite
 *   5  Mission designer    the full satellite design game (js/ui/app.js)
 * Stars are saved in the browser, and each level unlocks the next.
 */
(function () {
  'use strict';
  var RG = window.RG, THREE = window.THREE;
  var F = RG.Flight, Stage = RG.Stage, R = RG.Rocket, E = RG.Earth, P = RG.Physics, A = RG.Audio, D = RG.DATA, M = RG.Model, W = RG.Widgets;
  var esc = W.esc, num = W.num;
  var root, countEl, App;
  var L = { cur: null };
  var KEY = 'orbit-ranger.progress';
  var prog = { stars: {}, build: null, meco: null, all: false };
  var DEFAULT_BUILD = { tank: 'M', engines: 'E3', boosters: 'none' };
  var SHORT = { S: 'Small', M: 'Medium', L: 'Large', E2: '2', E3: '3', E4: '4', none: 'None', two: 'Two' }; // labels on the level 2 tiles
  var DEFAULT_SAT = M.decode('OR-11111121100');
  var keys = { left: false, right: false, burn: false };
  var D2R = Math.PI / 180;

  // x and y place each level on the map, in percent from the left and from the bottom.
  var LEVELS = [
    { id: 1, title: 'Meet the rocket', x: 30, y: 9, color: '#58cc02', icon: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21"/>' },
    { id: 2, title: 'Build it', x: 68, y: 26, color: '#1cb0f6', icon: '<path d="M12 2c3 2.5 4.5 6 4.5 10v5h-9v-5C7.5 8 9 4.5 12 2z"/><path d="M7.5 14L4 18h3.5M16.5 14l3.5 4h-3.5"/>' },
    { id: 3, title: 'Lift-off', x: 32, y: 44, color: '#ff9600', icon: '<path d="M12 21V5M5.5 11.5L12 5l6.5 6.5"/>' },
    { id: 4, title: 'Reach orbit', x: 66, y: 62, color: '#ce82ff', icon: '<circle cx="12" cy="12" r="4"/><ellipse cx="12" cy="12" rx="10" ry="4.6" transform="rotate(-25 12 12)"/>' },
    { id: 5, title: 'Fire watch', x: 36, y: 80, color: '#ff4b4b', icon: '<rect x="9" y="8" width="6" height="8" rx="1"/><path d="M2 9h6v6H2zM16 9h6v6h-6zM12 8V4M10 4h4"/>' }
  ];

  /* ---------- saved progress ---------- */
  function load() {
    try { var p = JSON.parse(localStorage.getItem(KEY) || 'null'); if (p && p.stars) prog = p; } catch (e) { /* storage may be off */ }
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(prog)); } catch (e) { /* storage may be off */ } }
  function open(id) { return id === 1 || prog.all || (prog.stars[id - 1] || 0) >= 1; }
  L.award = function (id, stars) {
    if (stars > (prog.stars[id] || 0)) prog.stars[id] = stars;
    save();
  };
  function totalStars() { return LEVELS.reduce(function (n, l) { return n + (prog.stars[l.id] || 0); }, 0); }

  /* ---------- small pieces of UI ---------- */
  function icon(svg) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + svg + '</svg>';
  }
  function starRow(n, cls) {
    var out = '';
    for (var i = 1; i <= 3; i++) out += '<svg viewBox="0 0 24 24" class="star' + (i <= n ? ' is-on' : '') + '" aria-hidden="true"><path d="M12 2.6l2.9 6 6.5.9-4.7 4.6 1.1 6.5L12 17.5l-5.8 3.1 1.1-6.5L2.6 9.5l6.5-.9z"/></svg>';
    return '<span class="stars ' + (cls || '') + '" role="img" aria-label="' + n + ' of 3 stars">' + out + '</span>';
  }
  // Pip, the guide: a small round satellite with solar-wing ears.
  var MASCOT = '<svg class="pip" viewBox="0 0 64 64" aria-hidden="true"><rect x="2" y="24" width="14" height="16" rx="3" fill="#1cb0f6"/><rect x="48" y="24" width="14" height="16" rx="3" fill="#1cb0f6"/>' +
    '<path d="M32 6v8" stroke="#ffc800" stroke-width="4" stroke-linecap="round"/><circle cx="32" cy="5" r="4" fill="#ff4b4b"/>' +
    '<circle cx="32" cy="34" r="20" fill="#ffc800"/><circle cx="32" cy="34" r="20" fill="none" stroke="#e6a800" stroke-width="3"/>' +
    '<circle cx="25" cy="31" r="5.5" fill="#fff"/><circle cx="39" cy="31" r="5.5" fill="#fff"/><circle cx="26" cy="32" r="2.6" fill="#3c3c3c"/><circle cx="40" cy="32" r="2.6" fill="#3c3c3c"/>' +
    '<path d="M25 43q7 6 14 0" fill="none" stroke="#3c3c3c" stroke-width="3" stroke-linecap="round"/></svg>';

  function say(text) {
    var el = document.getElementById('lv-say');
    if (el && el.textContent !== text) { el.textContent = text; App.say(text); }
  }
  function bar(frac) {
    var el = document.getElementById('lv-bar');
    if (el) el.style.width = Math.max(4, Math.min(100, frac * 100)).toFixed(0) + '%';
  }
  function side(html) { var el = document.getElementById('lv-side'); var was = el.hidden; el.innerHTML = html; el.hidden = !html; if (was !== el.hidden) App.layout(); }
  function hud(html) { document.getElementById('lv-hud').innerHTML = html; }
  function controls(html) { document.getElementById('lv-controls').innerHTML = html; }
  function sheet(kind, html) {
    var el = document.getElementById('lv-sheet');
    el.className = 'lv-sheet is-' + kind;
    el.innerHTML = html;
    el.hidden = false;
    var b = el.querySelector('button');
    if (b) b.focus({ preventScroll: true });
  }
  function hideSheet() { var el = document.getElementById('lv-sheet'); if (el) el.hidden = true; }
  function set(id, text) { var el = document.getElementById(id); if (el && el.textContent !== text) el.textContent = text; }
  function height(id, frac) { var el = document.getElementById(id); if (el) el.style.height = Math.max(0, Math.min(100, frac * 100)).toFixed(1) + '%'; }

  /* ---------- the map: a journey from the grass, through the clouds, into space ---------- */
  function scenery() {
    var rnd = Stage.seeded(5), stars = '', i;
    for (i = 0; i < 70; i++) stars += '<circle cx="' + (rnd() * 100).toFixed(1) + '" cy="' + (rnd() * 36).toFixed(1) + '" r="' + (0.12 + rnd() * 0.28).toFixed(2) + '"' + (i % 4 === 0 ? ' class="tw"' : '') + '/>';
    var clouds = '';
    [[8, 40, 1], [62, 47, 0.8], [30, 56, 1.2], [78, 60, 0.9], [-6, 66, 0.7]].forEach(function (c, k) {
      clouds += '<i class="w-cloud" style="left:' + c[0] + '%;bottom:' + c[1] + '%;--s:' + c[2] + ';--t:' + (50 + k * 14) + 's"></i>';
    });
    return '<div class="w-sky"></div>' +
      '<svg class="w-stars" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">' + stars + '</svg>' +
      '<svg class="w-moon" viewBox="0 0 60 60" aria-hidden="true"><circle cx="30" cy="30" r="22" fill="#f4f1de"/><circle cx="22" cy="24" r="5" fill="#dedbc6"/><circle cx="38" cy="36" r="7" fill="#dedbc6"/><circle cx="36" cy="18" r="3" fill="#dedbc6"/></svg>' +
      clouds +
      '<svg class="w-hills" viewBox="0 0 1200 300" preserveAspectRatio="none" aria-hidden="true">' +
      '<defs><linearGradient id="hg1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8fd866"/><stop offset="1" stop-color="#6cc04a"/></linearGradient>' +
      '<linearGradient id="hg2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6fca4b"/><stop offset="1" stop-color="#4fa836"/></linearGradient>' +
      '<linearGradient id="hg3" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#58b63a"/><stop offset="1" stop-color="#3f8f2a"/></linearGradient></defs>' +
      '<path d="M0 150 Q150 60 320 120 T640 100 T960 130 T1200 90 V300 H0Z" fill="url(#hg1)"/>' +
      '<path d="M0 200 Q200 120 420 180 T820 160 T1200 190 V300 H0Z" fill="url(#hg2)"/>' +
      '<path d="M0 250 Q250 190 520 235 T1000 225 T1200 240 V300 H0Z" fill="url(#hg3)"/>' +
      '<g fill="#2f7d24">' + [90, 240, 300, 760, 905, 1090].map(function (x, k) {
        var y = 205 + (k % 3) * 12;
        return '<ellipse cx="' + (x + 6) + '" cy="' + (y + 34) + '" rx="22" ry="5" fill="rgba(0,0,0,0.18)"/><rect x="' + (x - 3) + '" y="' + y + '" width="6" height="32" fill="#7a5230"/><circle cx="' + x + '" cy="' + (y - 4) + '" r="20"/><circle cx="' + (x - 14) + '" cy="' + (y + 6) + '" r="13"/><circle cx="' + (x + 14) + '" cy="' + (y + 7) + '" r="13"/>';
      }).join('') + '</g></svg>';
  }

  L.showMap = function () {
    stop();
    Stage.hidden = true; // the map covers the 3D view, so there is no need to draw it
    App.setScreen('map');
    var next = LEVELS.filter(function (l) { return open(l.id) && !(prog.stars[l.id] >= 1); })[0];
    var nodes = LEVELS.map(function (l) {
      var st = prog.stars[l.id] || 0, isOpen = open(l.id), cls = st ? 'is-done' : isOpen ? 'is-open' : 'is-locked';
      var here = next && next.id === l.id;
      return '<div class="w-stop' + (l.x > 50 ? ' is-right' : '') + '" style="left:' + l.x + '%;bottom:' + l.y + '%">' +
        (here ? '<span class="w-pip">' + MASCOT + '</span>' : '') +
        '<button type="button" class="node ' + cls + '" style="--c:' + l.color + '" data-lv="go" data-id="' + l.id + '"' + (isOpen ? '' : ' disabled') +
        ' aria-label="Level ' + l.id + ', ' + l.title + (isOpen ? ', ' + st + ' of 3 stars' : ', locked') + '">' +
        (isOpen ? icon(l.icon) : icon('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>')) + '</button>' +
        '<span class="w-label"><b>' + l.title + '</b>' + (isOpen ? starRow(st) : '') + '</span></div>';
    }).join('');
    var pts = LEVELS.map(function (l) { return [l.x, 100 - l.y - 4]; }), d = 'M' + pts[0][0] + ' ' + pts[0][1];
    for (var i = 1; i < pts.length; i++) {
      var a = pts[i - 1], b = pts[i], bend = i % 2 ? 16 : -16;
      d += ' C' + (a[0] + bend) + ' ' + (a[1] - 5) + ',' + (b[0] + bend) + ' ' + (b[1] + 9) + ',' + b[0] + ' ' + b[1];
    }
    root.innerHTML = '<div class="world">' + scenery() +
      '<div class="w-board"><svg class="w-path" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">' +
      '<path d="' + d + '" class="w-road"/><path d="' + d + '" class="w-dash"/></svg>' + nodes + '</div>' +
      '<span class="star-pill">' + starRow(1) + '<b>' + totalStars() + '</b> / 15</span>' +
      '<p class="map-foot"><button type="button" class="link" data-lv="unlock">' + (prog.all ? 'Lock levels' : 'Unlock all') + '</button>' +
      '<button type="button" class="link" data-lv="reset">Start over</button></p></div>';
  };

  /* ---------- running a level ---------- */
  function shell(id) {
    App.setScreen('level');
    root.innerHTML = '<div class="lv">' +
      '<div class="lv-top"><button type="button" class="lv-x" data-lv="quit" aria-label="Leave the level">×</button>' +
      '<div class="lv-progress" role="progressbar" aria-label="Level progress"><i id="lv-bar"></i></div><span class="lv-tag">Level ' + id + '</span></div>' +
      '<div class="lv-coach">' + MASCOT + '<p id="lv-say"></p></div>' +
      '<div class="lv-hud" id="lv-hud"></div><div class="lv-side" id="lv-side" hidden></div>' +
      '<div class="lv-controls" id="lv-controls"></div><div class="lv-sheet" id="lv-sheet" hidden></div></div>';
    bar(0);
  }
  function stop() {
    if (L.cur && L.cur.cleanup) L.cur.cleanup();
    L.cur = null;
    keys.left = keys.right = keys.burn = false;
    Stage.clearLabels('part');
    Stage.shake = 0;
    A.stopRumble();
    if (countEl) countEl.className = '';
  }
  function start(id) {
    stop();
    Stage.hidden = false;
    if (id === 5) { root.innerHTML = ''; App.startDesigner(); return; }
    shell(id);
    L.cur = [null, level1, level2, level3, level4][id]();
    L.cur.id = id;
  }

  function complete(id, stars, title, line) {
    L.award(id, stars);
    A.play('star');
    var next = id < 5 ? id + 1 : 0, conf = '';
    for (var i = 0; i < 18; i++) conf += '<i style="--x:' + (Math.random() * 100).toFixed(0) + '%;--d:' + (Math.random() * 0.6).toFixed(2) + 's;--h:' + Math.floor(Math.random() * 360) + '"></i>';
    document.getElementById('lv-controls').innerHTML = '';
    sheet('done', '<div class="confetti" aria-hidden="true">' + conf + '</div>' + starRow(stars, 'is-big') + '<h2>' + title + '</h2>' +
      (line ? '<p class="done-line">' + line + '</p>' : '') +
      '<div class="actions">' + (next ? '<button type="button" class="btn primary big" data-lv="go" data-id="' + next + '">Next level</button>' : '') +
      '<button type="button" class="btn" data-lv="go" data-id="' + id + '">Again</button><button type="button" class="btn" data-lv="map">Map</button></div>');
    App.say(title + '. ' + stars + ' of 3 stars.');
  }
  function failed(id, title, text) {
    A.play('bad');
    A.stopRumble();
    sheet('bad', '<h2>' + title + '</h2><p>' + text + '</p><div class="actions"><button type="button" class="btn danger big" data-lv="go" data-id="' + id + '">Try again</button>' +
      '<button type="button" class="btn" data-lv="map">Map</button></div>');
  }

  /* ====================================================================
   * Level 1: meet the rocket
   * ==================================================================== */
  var PARTS = [
    { key: 'satellite', name: 'Satellite', text: 'The passenger. It rides in the nose cone, and the rocket exists to carry it up.', fact: 'NASA calls it the payload.' },
    { key: 'lox', name: 'Oxygen tank', text: 'Liquid oxygen at −183 °C. Fire needs oxygen, and space has no air.', fact: '6 kg of oxygen burns with each 1 kg of hydrogen.' },
    { key: 'gyro', name: 'Gyro', text: 'Feels which way the rocket is tipping, so the computer can steer.', fact: 'Pitch is up and down, yaw is left and right, roll is spin.' },
    { key: 'lh2', name: 'Hydrogen tank', text: 'Liquid hydrogen fuel at −253 °C. It is so light it needs the biggest tank.', fact: 'The orange foam keeps it cold, as on NASA’s SLS.' },
    { key: 'engines', name: 'Engines', text: 'They burn hydrogen with oxygen. What comes out is steam!', fact: 'NASA’s RS-25 engine first flew on the Space Shuttle.' },
    { key: 'boosters', name: 'Boosters', text: 'A giant extra push for two minutes. Then they drop away.', fact: 'They give most of the push at lift-off.' }
  ];
  var QUIZ = [
    { q: 'Which tank is the biggest?', a: ['Hydrogen', 'Oxygen', 'Same size'], ok: 0, why: 'Hydrogen is light and fluffy, so it needs lots of room.' },
    { q: 'Why carry oxygen?', a: ['To cool the satellite', 'Space has no air for the fire', 'To be lighter'], ok: 1, why: 'Fire needs oxygen, and space has none.' },
    { q: 'What do boosters do?', a: ['Extra push, then drop away', 'Steer the rocket', 'Carry the satellite'], ok: 0, why: 'They burn for two minutes and are dropped when empty.' }
  ];

  function level1() {
    var seen = {}, pins = {}, qi = -1, right = 0, answered = false, timer = 0;
    R.setBuild({ tank: 'M', engines: 'E3', boosters: 'two', top: true, satellite: DEFAULT_SAT });
    App.view('rk-parts');
    PARTS.forEach(function (p) {
      pins[p.key] = Stage.addLabel(p.name, 'pin-part', { group: 'part', at: function () { return R.partPos(p.key); }, onClick: function () { select(p.key); } });
    });
    say('Tap the labels on the rocket.');
    Stage.look({ radius: R.height * 1.45 + 30, az: -Math.PI / 2 + 0.25, el: 0.12 });

    function count() { return Object.keys(seen).length; }
    function dots() { return '<span class="dots" aria-label="' + count() + ' of ' + PARTS.length + ' found">' + PARTS.map(function (x) { return '<i class="' + (seen[x.key] ? 'on' : '') + '"></i>'; }).join('') + '</span>'; }
    function select(key) {
      var p = PARTS.filter(function (x) { return x.key === key; })[0];
      seen[key] = true;
      A.play('pick');
      R.setPeek(key === 'satellite');
      pins[key].el.classList.add('is-seen');
      var pos = R.partPos(key);
      Stage.look({ target: new THREE.Vector3(0, pos.y, 0), radius: key === 'satellite' ? 44 : 62 });
      side('<div class="info"><h3>' + p.name + dots() + '</h3><p>' + p.text + '</p><p class="nasa-fact">' + p.fact + '</p></div>' +
        (count() === PARTS.length ? '<button type="button" class="btn primary big wide" data-lv="quiz">Quiz time</button>' : ''));
      bar(count() / PARTS.length * 0.5);
      say(count() === PARTS.length ? 'You found them all!' : (PARTS.length - count()) + ' more to find.');
    }
    function ask() {
      qi++; answered = false;
      if (qi >= QUIZ.length) {
        if (right) complete(1, right, 'You know your rocket!', right + ' of ' + QUIZ.length + ' right');
        else failed(1, 'Have another look', 'Tap the parts again, then retry the quiz.');
        return;
      }
      var q = QUIZ[qi];
      say('Question ' + (qi + 1) + ' of ' + QUIZ.length);
      side('<h2>' + q.q + '</h2><div class="answers">' + q.a.map(function (t, i) {
        return '<button type="button" class="answer" data-lv="answer" data-i="' + i + '">' + t + '</button>';
      }).join('') + '</div>');
      bar(0.5 + (qi / QUIZ.length) * 0.5);
    }
    return {
      quiz: function () { Stage.clearLabels('part'); R.setPeek(false); Stage.look({ target: new THREE.Vector3(0, R.height * 0.5, 0), radius: R.height * 1.7 + 36 }); ask(); },
      answer: function (el) {
        if (answered) return;
        answered = true;
        var q = QUIZ[qi], good = +el.dataset.i === q.ok, all = document.querySelectorAll('.answer');
        if (good) right++;
        A.play(good ? 'go' : 'bad');
        el.classList.add(good ? 'is-right' : 'is-wrong');
        all[q.ok].classList.add('is-right');
        Array.prototype.forEach.call(all, function (b) { b.disabled = true; });
        say((good ? 'Yes! ' : 'Not quite. ') + q.why);
        timer = setTimeout(ask, good ? 1300 : 2600); // moves on by itself
      },
      cleanup: function () { clearTimeout(timer); R.setPeek(false); }
    };
  }

  /* ====================================================================
   * Level 2: build the rocket
   * ==================================================================== */
  function level2() {
    var b = { tank: null, engines: null, boosters: null };
    var GROUPS = [['tank', 'Fuel tanks', F.TANKS, 'lh2'], ['engines', 'Engines', F.ENGINES, 'engines'], ['boosters', 'Boosters', F.BOOSTERS, 'boosters']];
    R.setBuild({ satellite: DEFAULT_SAT });
    App.view('rk-build');
    say('Pick fuel tanks to start.');
    draw();

    function full() { return b.tank && b.engines && b.boosters; }
    function draw() {
      var ev = b.tank && b.engines ? F.evaluate(b) : null, html = '';
      GROUPS.forEach(function (g, gi) {
        var locked = gi > 0 && !b[GROUPS[gi - 1][0]];
        html += '<fieldset class="tiles"' + (locked ? ' disabled' : '') + '><legend>' + g[1] + '</legend>' +
          Object.keys(g[2]).map(function (k) {
            return '<button type="button" class="tile" data-lv="pick" data-group="' + g[0] + '" data-key="' + k + '" aria-pressed="' + (b[g[0]] === k) + '">' +
              '<b>' + SHORT[k] + '</b><span class="coin">' + g[2][k].cost + '</span></button>';
          }).join('') + '</fieldset>';
      });
      var cost = (b.tank ? F.TANKS[b.tank].cost : 0) + (b.engines ? F.ENGINES[b.engines].cost : 0) + (b.boosters ? F.BOOSTERS[b.boosters].cost : 0) + F.UPPER.cost;
      var tw = ev ? ev.tw : 0, lift = !ev ? 'idle' : tw < 1 ? 'over' : tw < 1.2 ? 'tight' : 'ok';
      var meters = '<div class="build-meters">' +
        '<div class="bm" data-level="' + lift + '"><span>Lift-off power</span><b>' + (ev ? (tw < 1 ? 'Too weak' : tw < 1.2 ? 'Just enough' : 'Strong') : 'Pick tanks and engines') + '</b>' +
        '<div class="bm-bar"><i style="width:' + Math.min(100, tw / 2 * 100).toFixed(0) + '%"></i><em style="left:50%"></em></div><small>' + (ev ? 'Push ' + num(ev.thrust0 / 9806.65) + ' t, weight ' + num(ev.mass0) + ' t' : 'The push must beat the weight') + '</small></div>' +
        '<div class="bm" data-level="' + (b.tank ? 'ok' : 'idle') + '"><span>Fuel on board</span><b>' + (ev ? num(ev.lox) + ' t oxygen, ' + num(ev.lh2) + ' t hydrogen' : b.tank ? num(F.TANKS[b.tank].prop) + ' t' : 'No tanks yet') + '</b>' +
        '<div class="bm-bar two"><i class="ox" style="width:' + (b.tank ? 86 * F.TANKS[b.tank].prop / 700 : 0).toFixed(0) + '%"></i><i class="h2" style="width:' + (b.tank ? 14 * F.TANKS[b.tank].prop / 700 : 0).toFixed(0) + '%"></i></div><small>6 parts oxygen to 1 part hydrogen, by weight</small></div>' +
        '<div class="bm" data-level="' + (cost > F.BUDGET ? 'over' : 'ok') + '"><span>Coins</span><b>' + cost + ' of ' + F.BUDGET + '</b>' +
        '<div class="bm-bar"><i style="width:' + Math.min(100, cost / F.BUDGET * 100).toFixed(0) + '%"></i></div><small>Includes ' + F.UPPER.cost + ' for the upper stage and nose cone</small></div></div>';
      side(meters + html + '<button type="button" class="btn primary big wide" data-lv="test"' + (full() ? '' : ' disabled') + '>Test flight</button>');
      bar((b.tank ? 0.25 : 0) + (b.engines ? 0.25 : 0) + (b.boosters ? 0.25 : 0));
    }
    return {
      pick: function (el) {
        var g = el.dataset.group, top = document.getElementById('lv-side').scrollTop;
        b[g] = el.dataset.key;
        A.play('pick');
        R.setBuild({ tank: b.tank, engines: b.engines, boosters: b.boosters, top: !!full(), satellite: DEFAULT_SAT },
          g === 'tank' ? 'lh2' : g === 'engines' ? 'engines' : b.boosters === 'two' ? 'boosters' : 'nose');
        Stage.look({ target: new THREE.Vector3(0, R.height * 0.5, 0), radius: R.height * 2.1 + 44 });
        say(!b.engines ? 'Now add engines. Heavy rockets need more push.' : !b.boosters ? 'Boosters or not? Watch the power meter.' : 'Ready. Try a test flight!');
        draw();
        document.getElementById('lv-side').scrollTop = top;
        var again = document.querySelector('.tile[data-group="' + g + '"][data-key="' + b[g] + '"]');
        if (again) again.focus({ preventScroll: true });
      },
      test: function () {
        var ev = F.evaluate(b), res = F.testFlight(b), inBudget = ev.cost <= F.BUDGET, why = '';
        if (ev.tw < 1) why = 'Too heavy: ' + num(ev.thrust0 / 9806.65) + ' t of push cannot lift ' + num(ev.mass0) + ' t. Add push or use smaller tanks.';
        else if (!res.ok) why = 'Too slow to stay up: it ran out of fuel. Try bigger tanks or boosters.';
        function row(ok, text) { return '<li class="' + (ok ? 'ok' : 'no') + '">' + (ok ? '✓' : '✕') + ' ' + text + '</li>'; }
        var rows = '<ul class="test-rows">' + row(ev.tw >= 1, 'Lifts off') + row(res.ok, 'Reaches orbit') + row(inBudget, ev.cost + ' of ' + F.BUDGET + ' coins') + '</ul>';
        if (!res.ok) { A.play('bad'); sheet('bad', rows + '<p>' + why + '</p><div class="actions"><button type="button" class="btn danger big" data-lv="closesheet">Change it</button></div>'); return; }
        var stars = !inBudget ? 1 : F.BUDGET - ev.cost >= 20 ? 3 : 2;
        prog.build = { tank: b.tank, engines: b.engines, boosters: b.boosters }; prog.meco = null; save();
        bar(1);
        complete(2, stars, 'It flies!', inBudget ? (stars < 3 ? 'Spend 100 coins or less for 3 stars' : ev.cost + ' coins. Nice and cheap!') : 'It works, but it went over budget');
      },
      closesheet: hideSheet,
      cleanup: function () {}
    };
  }

  /* ====================================================================
   * Gauges shared by levels 3 and 4
   * ==================================================================== */
  function tankHtml(id, cls, name) {
    return '<div class="tank ' + cls + '"><div class="tank-tube"><i id="' + id + '"></i></div><b>' + name + '</b><span id="' + id + '-t"></span></div>';
  }
  function gyroHtml() {
    return '<div class="gyro plate-w"><svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="54" class="gy-ring"/>' +
      '<g id="gy-target"><path d="M60 60L50.6 6.8A54 54 0 0 1 69.4 6.8Z" class="gy-green"/></g>' +
      '<g id="gy-needle"><path d="M60 64V12" class="gy-needle"/><path d="M60 6l-6 10h12z" class="gy-tip"/></g><circle cx="60" cy="60" r="6" class="gy-hub"/>' +
      '<text x="60" y="112" text-anchor="middle" class="gy-lab">GYRO</text></svg>' +
      '<dl><div><dt>Pitch</dt><dd id="gy-p">0°</dd></div><div><dt>Yaw</dt><dd id="gy-y">0°</dd></div><div><dt>Roll</dt><dd id="gy-r">0°</dd></div></dl></div>';
  }
  function gyro(pitchDeg, targetDeg, yaw, roll) {
    var n = document.getElementById('gy-needle'), t = document.getElementById('gy-target');
    if (n) n.setAttribute('transform', 'rotate(' + pitchDeg.toFixed(1) + ' 60 60)');
    if (t) t.setAttribute('transform', 'rotate(' + targetDeg.toFixed(1) + ' 60 60)');
    set('gy-p', Math.round(pitchDeg) + '°'); set('gy-y', Math.round(yaw) + '°'); set('gy-r', Math.round(roll) + '°');
  }
  function clock(t) { var s = Math.floor(t); return 'T+' + Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); }

  /* ====================================================================
   * Level 3: lift-off
   * ==================================================================== */
  function level3() {
    var build = prog.build || DEFAULT_BUILD, ev = F.evaluate(build), hasBoost = ev.boost.thrust > 0;
    var sim = new F.Ascent(build, 1 + Math.floor(Math.random() * 40));
    var seenEvents = 0, counting = false, ended = false, wobble = 0;
    R.setBuild({ tank: build.tank, engines: build.engines, boosters: build.boosters, top: true, satellite: DEFAULT_SAT });
    App.view('ascent');
    hud('<div class="alt plate-w"><b id="al-n">0 km</b><span>Altitude</span><div class="alt-bar"><i id="al-f"></i>' +
      '<em style="bottom:' + (10 / 220 * 100) + '%">Clouds</em><em style="bottom:' + (100 / 220 * 100) + '%">Space 100 km</em><em class="goal" style="bottom:' + (200 / 220 * 100) + '%">Goal 200 km</em></div></div>' +
      '<div class="hud-r"><div class="tanks plate-w">' + tankHtml('tk-o', 'ox', 'Oxygen') + tankHtml('tk-h', 'h2', 'Hydrogen') + (hasBoost ? tankHtml('tk-b', 'srb', 'Boosters') : '') + '</div>' +
      gyroHtml() + '<div class="data plate-w"><div><span>Speed</span><b id="da-v">0 km/h</b></div><div><span>Push</span><b id="da-g">0 g</b></div><div><span>Clock</span><b id="da-t">T−3</b></div></div></div>');
    drawControls('launch');
    say('Keep the needle in the green. Ready?');
    paint(0);

    function drawControls(mode) {
      controls('<button type="button" class="round" data-hold="left" aria-label="Tip left">◀</button>' +
        (mode === 'launch' ? '<button type="button" class="btn primary big" data-lv="launch">Launch</button>'
          : mode === 'drop' ? '<button type="button" class="btn warn big pulse" data-lv="drop">Drop boosters</button>'
          : '') +
        '<button type="button" class="round" data-hold="right" aria-label="Tip right">▶</button>');
    }
    function paint(dt) {
      var alt = sim.altKm(), frac = sim.coreProp / (ev.tank.prop * 1000);
      set('al-n', (alt < 10 ? alt.toFixed(1) : num(alt)) + ' km'); height('al-f', alt / 220);
      height('tk-o', frac); height('tk-h', frac);
      set('tk-o-t', num(ev.lox * frac) + ' t'); set('tk-h-t', num(ev.lh2 * frac) + ' t');
      if (hasBoost) { var bf = sim.boostersOn ? sim.boostProp / (ev.boost.prop * 1000) : 0; height('tk-b', bf); set('tk-b-t', sim.boostersOn ? Math.round(bf * 100) + '%' : 'gone'); }
      wobble += dt;
      var noisy = sim.status === 'flying' ? 1 : 0;
      gyro(sim.pitch / D2R, sim.target / D2R, noisy * 1.5 * Math.sin(wobble * 1.7), noisy * 2 * Math.sin(wobble * 0.9 + 1));
      var g = document.querySelector('.gyro');
      if (g) g.dataset.off = Math.abs(sim.err) > 12 ? 'far' : Math.abs(sim.err) > 6 ? 'near' : '';
      set('da-v', num(sim.speed() * 3.6) + ' km/h'); set('da-g', sim.g.toFixed(1) + ' g');
      if (sim.status !== 'pad') set('da-t', clock(sim.t));
      bar(Math.min(1, Math.max(alt, 0) / 200));
    }
    function finish() {
      if (ended) return;
      ended = true;
      A.stopRumble(); Stage.shake = 0;
      var res = sim.result();
      if (res.ok) {
        var stars = res.accuracy >= 0.85 && !res.dropLate ? 3 : res.accuracy >= 0.65 ? 2 : 1;
        prog.meco = { state: res.state, build: build }; save();
        complete(3, stars, 'You reached space!', 'On course ' + Math.round(res.accuracy * 100) + '% of the way' + (res.dropLate ? ', boosters dropped late' : ''));
      } else if (res.failWhy === 'tipped') failed(3, 'It tipped over', 'Use small, early taps to stay in the green.');
      else if (res.failWhy === 'fell') failed(3, 'It fell back', 'Build a stronger rocket in level 2.');
      else failed(3, 'Too slow', 'Stay closer to the green to waste less fuel.');
    }
    return {
      launch: function () {
        if (counting || sim.status !== 'pad') return;
        counting = true;
        drawControls('fly');
        [3, 2, 1].forEach(function (n, i) {
          setTimeout(function () { if (L.cur && L.cur.id === 3 && !ended) { countEl.textContent = n; countEl.className = 'is-on'; A.play('count'); } }, i * 800);
        });
        setTimeout(function () {
          if (!L.cur || L.cur.id !== 3 || ended) return;
          countEl.textContent = 'Lift-off!'; countEl.className = 'is-on is-word';
          setTimeout(function () { countEl.className = ''; }, 1100);
          sim.launch(); A.rumble(45);
        }, 2400);
      },
      drop: function () { sim.dropBoosters(); },
      frame: function (dt) {
        if (ended) return;
        if (sim.status === 'flying') sim.step(dt, 8, (keys.right ? 1 : 0) - (keys.left ? 1 : 0));
        while (seenEvents < sim.events.length) {
          var e = sim.events[seenEvents++];
          if (e === 'liftoff') say('Lift-off!');
          else if (e === 'maxq') say('Max Q: the air pushes hardest now. Hold steady!');
          else if (e === 'boosters-empty') { drawControls('drop'); say('Boosters empty. Drop them!'); A.play('warn'); }
          else if (e === 'boosters-dropped') { drawControls('fly'); say(sim.dropLate ? 'Boosters dropped (a bit late).' : 'Boosters away!'); A.play('go'); }
          else if (e === 'space') { say('100 km. This is space!'); A.play('star'); }
        }
        var alt = Math.max(0, sim.altKm()), sky = Stage.smooth((alt - 8) / 75);
        R.flightUpdate({ alt: alt * 1000, pitch: sim.pitch, burn: sim.status === 'flying' && sim.coreProp > 0 ? sim.throttle : 0,
          boost: !hasBoost ? 'none' : !sim.boostersOn ? 'gone' : sim.boostersEmpty ? 'empty' : sim.status === 'flying' ? 'on' : 'empty', sky: sky }, dt);
        var y = R.vehicle.position.y + R.height * 0.45 * Math.cos(sim.pitch), x = R.height * 0.45 * Math.sin(sim.pitch);
        var radius = R.height * 1.7 + 40 + Math.min(80, alt * 0.8), el = alt < 1 ? 0.06 : 0.06 + 0.22 * Stage.smooth(alt / 60);
        Stage.look({ radius: radius, el: Math.max(el, Math.asin(Math.max(-1, Math.min(1, (3 - y) / radius)))), speed: 5 });
        Stage.rig.goal.target.set(x, y, 0); Stage.rig.target.set(x, y, 0);
        paint(dt);
        if (sim.status === 'meco' || sim.status === 'fail') finish();
      },
      cleanup: function () {}
    };
  }

  /* ====================================================================
   * Level 4: reach orbit
   * ==================================================================== */
  function level4() {
    var build = prog.build || DEFAULT_BUILD, st = prog.meco && prog.meco.state;
    if (!st) { var tf = F.testFlight(build); if (!tf.ok) { build = DEFAULT_BUILD; tf = F.testFlight(build); } st = tf.state; }
    var sim = new F.Insertion(st), orb = { inc: F.SITE.lat, raanDeg: -60 };
    var apex = P.orbitPos(orb, Math.PI / 2), alpha = Math.atan2(-apex[2], apex[0]);
    var theta0 = alpha - F.SITE.lon * D2R; // the launch site sits under the start of the flight path
    var trail = [], trailClock = 0, told = '', orbitAt = -1, canDeploy = false, done = false, ended = false, wasBurning = false;
    App.view('insert', { az: alpha + st.u - 0.25, el: 0.85 });
    E.addPin('Kennedy Space Center', F.SITE.lat, F.SITE.lon);
    E.setSatModel(stageModel());
    hud('<div class="alt plate-w"><b id="al-n">0 km</b><span>Altitude</span><div class="alt-bar"><i id="al-f"></i>' +
      '<em style="bottom:' + (100 / 400 * 100) + '%">Space 100 km</em><em class="goal" style="bottom:' + (F.ORBIT_MIN / 400 * 100) + '%">Safe orbit</em></div></div>' +
      '<div class="hud-r"><div class="tanks plate-w">' + tankHtml('tk-o', 'ox', 'Oxygen') + tankHtml('tk-h', 'h2', 'Hydrogen') + '</div>' + gyroHtml() +
      '<div class="data plate-w"><div><span>Speed</span><b id="da-v"></b></div><div><span>Lowest point</span><b id="da-p"></b></div><div><span>Highest point</span><b id="da-a"></b></div><div><span>One lap</span><b id="da-l"></b></div></div></div>');
    controls('<button type="button" class="btn primary big hold" data-hold="burn">Hold to burn</button>');
    say('Coasting up… get ready to burn.');

    function pos(u, r) { var v = P.orbitPos(orb, Math.PI / 2 + u), k = r / F.RE; return [v[0] * k, v[1] * k, v[2] * k]; }
    function paint() {
      var el = F.elements(sim.s), frac = sim.prop / (F.UPPER.prop * 1000), ox = F.UPPER.prop * F.MIX / (F.MIX + 1), h2 = F.UPPER.prop / (F.MIX + 1);
      var alt = sim.altKm();
      set('al-n', num(alt) + ' km'); height('al-f', alt / 400);
      height('tk-o', frac); height('tk-h', frac);
      set('tk-o-t', (ox * frac * 1000).toFixed(0) + ' kg'); set('tk-h-t', (h2 * frac * 1000).toFixed(0) + ' kg');
      gyro(90 - Math.atan2(sim.s.vr, sim.s.vt) / D2R, 90, 0, 0);
      set('da-v', num(sim.speed() * 3.6) + ' km/h');
      set('da-p', el.periKm < 0 ? 'underground' : num(el.periKm) + ' km');
      set('da-a', isFinite(el.apoKm) ? num(el.apoKm) + ' km' : 'escaping');
      set('da-l', sim.inOrbit ? el.periodMin.toFixed(0) + ' min' : 'not yet');
      var d = document.querySelector('.data');
      if (d) d.dataset.orbit = sim.inOrbit;
      bar(Math.min(1, Math.max(0, (el.periKm + 6300) / (F.ORBIT_MIN + 6300))) * (done ? 1 : 0.92));
      // the path ahead: where the rocket will go if the engine stays off
      var pts = [], N = 160;
      for (var i = 0; i <= N; i++) {
        var nu = (i / N) * 2 * Math.PI, den = 1 + el.e * Math.cos(nu);
        if (den < 0.08) continue;
        var p = pos(sim.s.u + (nu - el.nu), el.p / den);
        pts.push(p[0], p[1], p[2]);
      }
      E.setRibbon('ahead', pts, 0.014, sim.inOrbit ? 0x58cc02 : 0xffc800);
      if (trail.length >= 6) E.setRibbon('trail', trail, 0.008, 0xffffff);
    }
    function tell(key, text) { if (told !== key) { told = key; say(text); } }
    function fires(altKm) {
      // count the real fires (NASA FIRMS, this week) that pass under the satellite in three laps
      var rec = RG.NASA_FIRES.recent.points, n = rec.length / 2, seen = new Uint8Array(n), vec = [], i;
      for (i = 0; i < n; i++) vec.push(P.latLonToVec(rec[i * 2], rec[i * 2 + 1]));
      var lap = P.periodMin(altKm), rate = 2 * Math.PI / lap, cosS = Math.cos(P.swathHalfAngle(altKm, D.SENSORS.wide.scanHalfDeg)), total = 0;
      for (var t = 0; t < lap * 3; t += 0.5) {
        var sub = P.toEarthFixed(P.orbitPos(orb, rate * t), P.EARTH_RATE * t);
        for (i = 0; i < n; i++) if (!seen[i] && P.dot(sub, vec[i]) >= cosS) { seen[i] = 1; total++; }
      }
      return total;
    }
    function fail(why) {
      if (ended) return;
      ended = true;
      controls('');
      if (why === 'fuel') failed(4, 'Out of fuel', 'Burn nearer the top of the arc.');
      else failed(4, 'It fell back', 'Burn sooner, and hold until the path is green.');
    }
    return {
      deploy: function () {
        if (!canDeploy || done) return;
        done = true;
        controls('');
        A.play('alert');
        E.setSatModel(RG.SatModel.flightCopy(DEFAULT_SAT));
        var r = sim.result(), mid = (r.apoKm + r.periKm) / 2, seenFires = fires(mid);
        var stars = r.round <= 120 && r.fuelLeft >= 0.2 ? 3 : r.round <= 300 ? 2 : 1;
        bar(1);
        setTimeout(function () {
          if (!L.cur || L.cur.id !== 4) return;
          complete(4, stars, 'You are in orbit!', 'One lap takes ' + r.periodMin.toFixed(0) + ' minutes. Ranger-1 already flew over <b>' + num(seenFires) + '</b> real fires NASA saw this week.');
        }, 1400);
      },
      frame: function (dt) {
        if (ended) return;
        var burning = keys.burn && sim.prop > 0 && !done;
        if (burning && !wasBurning) A.rumble(30);
        if (!burning && wasBurning) A.stopRumble();
        wasBurning = burning;
        sim.step(dt * (burning ? 4 : done || sim.inOrbit ? 12 : 26), burning);
        if (sim.status === 'fail') { fail(sim.prop <= 0 ? 'fuel' : 'fell'); return; }
        if (!done) {
          if (sim.inOrbit && orbitAt < 0) { orbitAt = 0; A.play('star'); }
          if (sim.inOrbit && !burning) {
            if (!canDeploy) { canDeploy = true; controls('<button type="button" class="btn primary big pulse" data-lv="deploy">Release the satellite</button>'); }
            tell('orbit', 'Orbit! Release the satellite.');
          } else if (sim.inOrbit) tell('letgo', 'Green path. Let go!');
          else if (burning) tell('burn', 'Keep holding until the path turns green.');
          else if (sim.prop <= 0) tell('dry', 'The tanks are empty…');
          else if (sim.s.vr < 80) tell('now', 'Now! Hold the button.');
        }
        var p = pos(sim.s.u, sim.s.r);
        trailClock += dt;
        if (trailClock > 0.08) { trailClock = 0; trail.push(p[0], p[1], p[2]); if (trail.length > 900) trail.splice(0, 3); }
        E.setTheta(theta0 + P.EARTH_RATE * (sim.t / 60));
        var len = sim.s.r / F.RE;
        E.setSat([p[0] / len, p[1] / len, p[2] / len], sim.altKm(), { lam: done ? P.swathHalfAngle(sim.altKm(), D.SENSORS.wide.scanHalfDeg) : 0 });
        paint();
      },
      cleanup: function () { E.clearRibbons(); }
    };
  }

  /** The little upper stage with the satellite on its nose, for the globe view. */
  function stageModel() {
    var g = new THREE.Group();
    var white = new THREE.MeshStandardMaterial({ color: 0xf4f6f8, roughness: 0.4 }), dark = new THREE.MeshStandardMaterial({ color: 0x3a4048, roughness: 0.4, metalness: 0.8 });
    var body = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.5, 24), white); body.rotation.z = Math.PI / 2;
    var bell = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.13, 0.2, 20, 1, true), dark); bell.rotation.z = Math.PI / 2; bell.position.x = -0.34;
    var sat = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), new THREE.MeshStandardMaterial({ color: 0xe6ad3e, roughness: 0.35, metalness: 0.9 })); sat.position.x = 0.36;
    g.add(body, bell, sat);
    return g;
  }

  /* ---------- buttons, keys and the frame loop ---------- */
  var actions = {
    go: function (el) { A.play('tap'); start(+el.dataset.id); },
    map: function () { L.showMap(); },
    quit: function () { L.showMap(); },
    unlock: function () { prog.all = !prog.all; save(); L.showMap(); },
    reset: function () { prog = { stars: {}, build: null, meco: null, all: false }; save(); L.showMap(); }
  };

  L.init = function (app) {
    App = app;
    root = document.getElementById('levels');
    countEl = document.getElementById('count');
    load();
    document.addEventListener('click', function (e) {
      var el = e.target.closest('[data-lv]');
      if (!el || el.disabled) return;
      var name = el.dataset.lv, fn = actions[name] || (L.cur && L.cur[name]);
      if (typeof fn === 'function') fn(el);
    });
    function hold(e, on) {
      var el = e.target.closest && e.target.closest('[data-hold]');
      if (!el) return;
      keys[el.dataset.hold] = on;
      el.classList.toggle('is-held', on);
      if (on) e.preventDefault();
    }
    document.addEventListener('pointerdown', function (e) { hold(e, true); });
    ['pointerup', 'pointercancel', 'pointerout'].forEach(function (n) { document.addEventListener(n, function (e) { hold(e, false); }); });
    function key(e, on) {
      if (!L.cur) return;
      if (e.key === 'ArrowLeft') keys.left = on;
      else if (e.key === 'ArrowRight') keys.right = on;
      else if (e.key === ' ' && L.cur.id === 4 && e.target.tagName !== 'BUTTON') keys.burn = on;
      else return;
      e.preventDefault();
    }
    document.addEventListener('keydown', function (e) { key(e, true); });
    document.addEventListener('keyup', function (e) { key(e, false); });
    Stage.onFrame(function (dt) {
      R.tick(dt);
      if (L.cur && L.cur.frame) L.cur.frame(dt);
    });
  };
  L.progress = function () { return prog; };

  RG.Levels = L;
})();
