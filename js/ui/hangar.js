/* Orbit Ranger — the NASA 3D hangar.
 * Every model the game ships from NASA 3D Resources, sorted into collections.
 * Pick one to stand it on a turntable and read what it is; or play "Name that
 * spacecraft". The models load one at a time, only when opened.
 */
(function () {
  'use strict';
  var RG = window.RG, Stage = RG.Stage, Md = RG.Models, W = RG.Widgets, K = RG.LevelKit, Pg = RG.Progress, A = RG.Audio, esc = W.esc, num = W.num;
  var H = { cat: 'all', q: '', id: null, quiz: null, token: 0 };
  // where a model also turns up in play
  var PLAY = { 'apollo-lunar-module': [6, 'Fly it in level 6'], 'astronaut': [6, 'Walk as one in level 6'], 'terra': [5, 'Its fires are in level 5'], 'aqua-b': [5, 'Its fires are in level 5'] };
  var EASY = ['hubble-space-telescope-b', 'james-webb-space-telescope-a', 'international-space-station-iss', 'saturn-v', 'apollo-lunar-module', 'space-shuttle-a', 'mars-2020-perseverance-rover', 'ingenuity-mars-helicopter',
    'voyager-probe-b', 'cassini-huygens-a', 'juno-a', 'terra', 'landsat-8', 'crawler', 'vehicle-assembly-building-vab', 'deep-space-network-34-meter', 'parker-solar-probe', 'kepler-a', 'chandra-x-ray-observatory', 'skylab',
    'gemini', 'viking-lander', 'lunar-reconnaissance-orbiter-b', 'extravehicular-mobility-unit', 'robonaut-2', 'dawn', 'galileo', 'osiris-rex', 'stardust', 'mir', 'pioneer-10', 'magellan', 'insight-cruise-lander-panels-deployed',
    'tracking-and-data-relay-satellites-tdrs-c', 'global-hawk', 'x-57', 'gateway-core', 'space-exploration-vehicle', 'curiosity-rover', 'dart', 'space-launch-system-block-1', 'nancy-grace-roman-space-telescope-a'];

  function seenCount() { return Object.keys(Pg.data.seen || {}).length; }
  function cats() { return RG.NASA3D.cats; }
  function catName(id) { var c = cats().filter(function (x) { return x[0] === id; })[0]; return c ? c[1] : ''; }
  function shown() {
    var q = H.q.trim().toLowerCase();
    return Md.all().filter(function (m) {
      return (H.cat === 'all' || m.cat === H.cat) && (!q || m.name.toLowerCase().indexOf(q) >= 0 || m.blurb.toLowerCase().indexOf(q) >= 0);
    });
  }
  function plain(name) { return name.replace(/\s*\([A-E]\)/g, '').replace(/\s*\((left|right) antenna\)/, '').trim(); }

  function gridHtml() {
    var list = shown(), seen = Pg.data.seen || {};
    if (!list.length) return '<li class="hg-none">Nothing matches “' + esc(H.q) + '”. Try a shorter word, or pick All.</li>';
    return list.map(function (m) {
      return '<li><button type="button" class="hg-item' + (seen[m.id] ? ' is-seen' : '') + '" data-lv="hgOpen" data-id="' + m.id + '">' +
        '<img src="' + Md.thumb(m.id) + '" alt="" loading="lazy" width="176" height="176"><b>' + esc(m.name) + '</b></button></li>';
    }).join('');
  }
  function noteHtml() {
    var c = cats().filter(function (x) { return x[0] === H.cat; })[0], n = shown().length;
    return (c ? c[2] + ' ' : 'Real models from NASA 3D Resources, made small enough for a phone. ') + '<b>' + n + (n === 1 ? ' model' : ' models') + '</b>';
  }

  H.open = function () {
    RG.Levels.stop();
    RG.App.closeDialog();
    RG.Showroom.show(false);
    Stage.hidden = true; H.id = null; H.quiz = null; H.token++;
    K.App.setScreen('hangar');
    var chips = [['all', 'All']].concat(cats()).map(function (c) {
      return '<button type="button" data-lv="hgCat" data-key="' + c[0] + '" aria-pressed="' + (H.cat === c[0]) + '">' + c[1] + '</button>';
    }).join('');
    K.root.innerHTML = '<div class="hangar"><header class="hg-head">' +
      '<button type="button" class="lv-x" data-lv="hgClose" aria-label="Back to the map">×</button>' +
      '<div class="hg-title"><h1>NASA 3D hangar</h1><p><b id="hg-seen">' + seenCount() + '</b> of ' + Md.all().length + ' opened</p></div>' +
      '<button type="button" class="btn warn" data-lv="hgQuiz">Name that spacecraft</button></header>' +
      '<div class="hg-tools"><label class="sr" for="hg-q">Search the hangar</label><input id="hg-q" type="search" autocomplete="off" placeholder="Search: Hubble, rover, Saturn" value="' + esc(H.q) + '">' +
      '<div class="hg-cats" role="group" aria-label="Collections">' + chips + '</div></div>' +
      '<p class="hg-note" id="hg-note">' + noteHtml() + '</p><ul class="hg-grid" id="hg-grid">' + gridHtml() + '</ul>' +
      '<p class="hg-foot">Models: NASA 3D Resources, science.nasa.gov/3d-resources. Free to use; NASA does not endorse this game.' +
      (RG.PWA && RG.PWA.canSave() ? ' <button type="button" class="link" data-lv="hgSave">Save every model for offline use</button>' : '') + '</p></div>';
    var q = document.getElementById('hg-q');
    q.addEventListener('input', function () { H.q = q.value; refresh(); });
  };
  function refresh() {
    document.getElementById('hg-grid').innerHTML = gridHtml();
    document.getElementById('hg-note').innerHTML = noteHtml();
  }

  /** Stand one model on the turntable. */
  H.view = function (id) {
    var m = Md.info(id);
    if (!m) return;
    RG.Levels.stop();
    RG.App.closeDialog();
    H.id = id; H.quiz = null;
    var list = shown(), at = list.map(function (x) { return x.id; }).indexOf(id);
    if (at < 0) { H.cat = m.cat; H.q = ''; list = shown(); at = list.map(function (x) { return x.id; }).indexOf(id); }
    Stage.hidden = false;
    K.App.setScreen('hangar');
    K.App.view('hangar');
    var play = PLAY[id], cut = m.trisNasa > m.tris * 1.2;
    K.root.innerHTML = '<div class="hangar is-view"><div class="hg-bar">' +
      '<button type="button" class="btn" data-lv="hangar">All models</button>' +
      '<span class="hg-pos">' + (at + 1) + ' of ' + list.length + ' in ' + (H.cat === 'all' ? 'the hangar' : catName(H.cat).toLowerCase()) + '</span>' +
      '<button type="button" class="btn" data-lv="hgStep" data-d="-1" aria-label="Previous model">‹</button><button type="button" class="btn" data-lv="hgStep" data-d="1" aria-label="Next model">›</button></div>' +
      '<aside class="lv-side hg-card"><p class="hg-kind">' + catName(m.cat) + '</p><h2>' + esc(m.name) + '</h2><p class="hg-blurb">' + W.autoTerms(m.blurb) + '</p>' +
      (play && Pg.isOpen(play[0]) ? '<button type="button" class="btn primary" data-lv="go" data-id="' + play[0] + '">' + play[1] + '</button>' : '') +
      '<dl class="hg-facts">' + (m.kind === 'globe' ? '<div><dt>What you see</dt><dd>A NASA map wrapped on a globe</dd></div>'
        : '<div><dt>Shown here</dt><dd>' + num(m.tris) + ' triangles</dd></div>' + (cut ? '<div><dt>NASA’s file</dt><dd>' + num(m.trisNasa) + ' triangles</dd></div>' : '')) +
      '<div><dt>Download</dt><dd>' + num(m.kb) + ' kB</dd></div></dl>' +
      '<p class="hg-src">' + (cut ? 'Simplified for phones from NASA’s original. ' : '') + '<a href="' + Md.source(m) + '" target="_blank" rel="noopener">NASA’s files for this model</a></p></aside>' +
      '<p class="hg-loading" id="hg-loading" role="status">Loading the model…</p></div>';
    K.App.layout();
    load(id, function () {
      Pg.data.seen = Pg.data.seen || {};
      if (!Pg.data.seen[id]) { Pg.data.seen[id] = true; Pg.save(); RG.Rewards.forHangar(seenCount(), 0); }
    });
  };
  function load(id, done) {
    var token = ++H.token, m = Md.info(id);
    RG.Showroom.clear();
    Stage.look({ target: new THREE.Vector3(0, 1.1, 0), radius: 6.4, az: 0.9, el: 0.26, minR: 1.3, maxR: 16, autoSpin: 0.28, speed: 3 }, true);
    Md.load(id, function (model) {
      var note = document.getElementById('hg-loading');
      if (token !== H.token) { Md.dispose(model); return; } // the player has already moved on
      if (!model) { if (note) note.textContent = 'This model could not be loaded. Check the connection and try again.'; return; }
      if (note) note.remove();
      RG.Showroom.set(model, m);
      Stage.look({ target: new THREE.Vector3(0, Math.max(0.6, RG.Showroom.height / 2), 0) }, false);
      if (done) done();
    });
  }

  /* ---------- Name that spacecraft ---------- */
  function startQuiz() {
    var pool = EASY.filter(function (id) { return Md.info(id); }), rnd = Math.random, picks = [];
    while (picks.length < 5 && pool.length) picks.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]);
    H.quiz = { picks: picks, at: 0, right: 0, answered: false };
    H.id = null;
    RG.Levels.stop(); RG.App.closeDialog();
    Stage.hidden = false; K.App.setScreen('hangar'); K.App.view('hangar');
    question();
  }
  function question() {
    var qz = H.quiz, id = qz.picks[qz.at], m = Md.info(id), names = [plain(m.name)];
    var others = EASY.filter(function (x) { return x !== id && Md.info(x) && Md.info(x).cat === m.cat; }).concat(EASY.filter(function (x) { return x !== id && Md.info(x); }));
    for (var i = 0; i < others.length && names.length < 3; i++) { var n = plain(Md.info(others[(i * 7 + qz.at * 3) % others.length]).name); if (names.indexOf(n) < 0) names.push(n); }
    names.sort(function () { return Math.random() - 0.5; });
    qz.answered = false; qz.answer = plain(m.name);
    K.root.innerHTML = '<div class="hangar is-view"><div class="hg-bar"><button type="button" class="btn" data-lv="hangar">Leave the game</button>' +
      '<span class="hg-pos">Question ' + (qz.at + 1) + ' of ' + qz.picks.length + '</span></div>' +
      '<aside class="lv-side hg-card"><h2>What is this?</h2><p class="hg-blurb">Drag to turn it around, then choose.</p><div class="hg-choices">' +
      names.map(function (n) { return '<button type="button" class="btn wide" data-lv="hgAnswer" data-name="' + esc(n) + '">' + esc(n) + '</button>'; }).join('') +
      '</div><div id="hg-reveal" role="status"></div></aside><p class="hg-loading" id="hg-loading" role="status">Loading the model…</p></div>';
    K.App.layout();
    load(id);
  }
  function answer(el) {
    var qz = H.quiz;
    if (!qz || qz.answered) return;
    qz.answered = true;
    var ok = el.dataset.name === qz.answer, m = Md.info(qz.picks[qz.at]);
    if (ok) qz.right++;
    A.play(ok ? 'good' : 'bad');
    document.querySelectorAll('[data-lv="hgAnswer"]').forEach(function (b) { b.disabled = true; b.classList.add(b.dataset.name === qz.answer ? 'is-right' : b === el ? 'is-wrong' : 'is-dim'); });
    Pg.data.seen = Pg.data.seen || {}; Pg.data.seen[m.id] = true; Pg.save();
    var last = qz.at === qz.picks.length - 1;
    document.getElementById('hg-reveal').innerHTML = '<p class="fact"><b>' + (ok ? 'Yes. ' : 'It is ' + esc(qz.answer) + '. ') + '</b>' + m.blurb + '</p>' +
      '<button type="button" class="btn primary wide" data-lv="hgNextQ">' + (last ? 'See my score' : 'Next') + '</button>';
    K.App.say(ok ? 'Correct.' : 'Not quite. It is ' + qz.answer + '.');
  }
  function nextQ() {
    var qz = H.quiz;
    if (!qz) return;
    if (qz.at < qz.picks.length - 1) { qz.at++; question(); return; }
    RG.Showroom.clear();
    RG.Rewards.forHangar(seenCount(), qz.right);
    K.root.innerHTML = '<div class="hangar is-view"><aside class="lv-side hg-card hg-end"><h2>' + qz.right + ' out of ' + qz.picks.length + '</h2>' +
      '<p class="hg-blurb">' + (qz.right === qz.picks.length ? 'A perfect round. You know your spacecraft.' : qz.right >= 3 ? 'Good spotting. Open a few more models and try again.' : 'These are hard to tell apart. Browse the hangar, then have another go.') + '</p>' +
      '<div class="actions"><button type="button" class="btn primary" data-lv="hgQuiz">Play again</button><button type="button" class="btn" data-lv="hangar">Back to the hangar</button></div></aside></div>';
    K.App.layout();
  }

  var act = RG.Levels.actions;
  act.hangar = function () { A.play('tap'); H.open(); };
  act.hgClose = function () { RG.Showroom.show(false); RG.Levels.showMap(); };
  act.hgOpen = function (el) { A.play('tap'); H.view(el.dataset.id); };
  act.hgCat = function (el) {
    H.cat = el.dataset.key;
    document.querySelectorAll('.hg-cats button').forEach(function (b) { b.setAttribute('aria-pressed', b === el); });
    refresh();
  };
  act.hgStep = function (el) {
    var list = shown(), at = list.map(function (x) { return x.id; }).indexOf(H.id);
    if (!list.length) return;
    H.view(list[(at + (+el.dataset.d) + list.length) % list.length].id);
  };
  act.hgQuiz = function () { A.play('tap'); startQuiz(); };
  act.hgAnswer = answer;
  act.hgNextQ = nextQ;
  act.hgSave = function (el) { RG.PWA.saveModels(el); };
  document.addEventListener('keydown', function (e) {
    if (RG.App.state.screen !== 'hangar' || !H.id || e.target.tagName === 'INPUT') return;
    if (e.key === 'ArrowRight' && e.shiftKey) act.hgStep({ dataset: { d: 1 } });
    else if (e.key === 'ArrowLeft' && e.shiftKey) act.hgStep({ dataset: { d: -1 } });
    else if (e.key === 'Escape') H.open();
  });

  RG.Hangar = H;
})();
