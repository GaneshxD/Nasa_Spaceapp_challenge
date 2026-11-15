/* Orbit Ranger — mission designer: launch and the three-year mission.
 * The countdown, the simulation run with its events and surprises, the live
 * HUD, and the hand-over to the report.
 */
(function () {
  'use strict';
  var RG = window.RG, X = RG.Designer, D = RG.DATA, M = RG.Model, W = RG.Widgets;
  var V = RG.Views, Stage = RG.Stage, A = RG.Audio, Sim = RG.Sim, Score = RG.Score;
  var state = X.state, esc = W.esc, $ = X.$, evalNow = X.evalNow, say = X.say;
  var fmtDate = X.fmtDate, openDialog = X.openDialog, okButton = X.okButton;
  var setBar = X.setBar, setText = X.setText;

  /* ---------- launch ---------- */
  /** seed: the mission number. In an online room the server chooses it, so every player sees the same mission. */
  function launch(seed) {
    state.seed = seed || 1 + Math.floor(Math.random() * 9000);
    A.play('go');
    X.cut(function () {
      state.screen = 'launch';
      document.body.dataset.screen = 'launch';
      X.render();
      Stage.setOffset(0, 0, true);
      V.launch({ onCount: onCount, onDone: launchDone });
      say('Countdown started.');
    });
  }
  function onCount(n) {
    if (state.screen !== 'launch') return;
    $('count').textContent = n > 0 ? n : 'Lift-off!';
    $('count').className = n > 0 ? 'is-on' : 'is-on is-word';
    if (n > 0) A.play('count');
    if (n === 1) A.rumble(11);
    if (n === 0) setTimeout(function () { $('count').className = ''; }, 1500);
  }
  function launchDone() {
    if (state.screen !== 'launch') return;
    state.screen = 'launch-done';
    X.cut(startMission);
  }

  /* ---------- mission ---------- */
  function startMission() {
    A.stopRumble();
    $('count').className = '';
    state.log = []; state.skipping = false;
    state.sim = new Sim(state.design, { seed: state.seed, onEvent: simEvent });
    state.screen = 'mission';
    document.body.dataset.screen = 'mission';
    X.render();
    Stage.setOffset(0, 0, true);
    V.startMission(state.sim, { onChapterEnd: chapterEnd });
    state.sim.startChapter(0);
    V.missionChapter();
    renderHud();
    var o = D.ORBITS[state.design.orbit];
    openDialog('<h2 id="dialog-title">' + D.MISSION.satellite + ' is in orbit</h2>' +
      '<p>It is ' + W.num(o.alt) + ' km up. Watch one day from each of its three years: orange dots are fires, yellow means spotted, green means firefighters know.</p>' +
      okButton('Start year 1'), function () { if (V.mission) V.mission.paused = false; });
  }

  function addLog(kind, text) {
    state.log.unshift({ kind: kind, text: text });
    if (state.log.length > 7) state.log.pop();
  }
  function simEvent(type, data) {
    if (state.skipping) return;
    var quiet = V.mission && V.mission.speed > 2;
    if (type === 'fire') {
      addLog('fire', 'A ' + data.size + ' fire starts in ' + data.place + '. Real fire: MODIS saw it on ' + fmtDate(data.seenOn) + ' at ' + Math.round(data.frp) + ' MW.');
      if (!quiet) A.play('fire');
    }
    else if (type === 'spotted') { addLog('spotted', 'Spotted the fire in ' + data.place + '.'); if (!quiet) A.play('spotted'); }
    else if (type === 'alert') {
      addLog('alert', 'Warning sent for ' + data.place + ' after ' + M.fmtHours(data.delayH) + (data.grade === 'late' ? ' (late).' : '.'));
      if (!quiet) A.play('alert');
    }
    else if (type === 'deleted') addLog('bad', 'Memory full. The picture of ' + data.place + ' was deleted.');
    else if (type === 'memory-full') { addLog('bad', 'The memory is full. Old pictures are being deleted.'); A.play('warn'); }
    else if (type === 'brownout') { addLog('bad', 'The battery is empty. Instruments switch off.'); A.play('bad'); }
    else if (type === 'power-back') addLog('', 'Power is back. Instruments switch on.');
    else if (type === 'cloud') addLog('', 'Clouds over ' + data.name + ' block the laser.');
  }

  function renderHud() {
    var sim = state.sim;
    var years = [0, 1, 2].map(function (i) {
      return '<span class="year' + (i === sim.chapter ? ' is-on' : i < sim.chapter ? ' is-done' : '') + '">Year ' + (i + 1) + '</span>';
    }).join('');
    function tele(id, name) {
      return '<div class="plate tele" id="t-' + id + '"><div class="tele-name"><span>' + name + '</span><b id="h-' + id + '"></b></div>' +
        '<div class="bar"><i id="h-' + id + '-bar"></i></div><div class="tele-note" id="h-' + id + '-note"></div></div>';
    }
    var speed = V.mission ? V.mission.speed : 1;
    $('hud').innerHTML =
      '<div class="hud-top plate"><div class="years">' + years + '</div><div class="clock"><span id="h-clock">Hour 0 of 24</span><div class="bar"><i id="h-day"></i></div></div></div>' +
      '<div class="hud-left">' + tele('batt', 'Battery') + tele('mem', 'Memory') +
      '<div class="plate tele" id="t-link"><div class="tele-name"><span>Radio</span><b id="h-link"></b></div><div class="tele-note" id="h-link-note"></div></div>' +
      '<div class="plate tele" id="t-eye"><div class="tele-name"><span>Fire sensor</span><b id="h-eye"></b></div><div class="tele-note" id="h-eye-note"></div></div></div>' +
      '<div class="hud-right"><div class="plate"><div class="tally">' +
      '<div class="t-burn"><b id="h-burn">0</b><span>burning</span></div><div class="t-spot"><b id="h-spot">0</b><span>spotted</span></div>' +
      '<div class="t-ok"><b id="h-ok">0</b><span>warned</span></div><div><b id="h-late">0</b><span>late</span></div></div>' +
      '<div class="legend" style="margin-top:8px"><span><i style="background:#ff5a1f"></i>burning</span><span><i style="background:#ffd23d"></i>spotted</span><span><i style="background:#3dffa0"></i>firefighters warned</span></div></div>' +
      '<div class="plate"><ul class="log" id="h-log" aria-label="Mission log"></ul></div></div>' +
      '<div class="hud-bottom plate"><div class="seg" role="group" aria-label="Speed">' + [1, 2, 4].map(function (k) {
        return '<button type="button" data-act="speed" data-x="' + k + '" aria-pressed="' + (speed === k) + '">' + k + '×</button>';
      }).join('') + '</div><button type="button" class="btn ghost" data-act="skip">Skip to the report</button></div>';
    updateHud();
  }

  var lastLog = '';
  function updateHud() {
    var sim = state.sim, c = sim && sim.c;
    if (!c || state.screen !== 'mission') return;
    setText('h-clock', 'Hour ' + Math.min(24, Math.floor(c.t / 60)) + ' of 24');
    setBar('h-day', c.t / Sim.DAY);
    var cap = sim.battery.wh * sim.battFactor, b = cap ? c.batt / cap : 0;
    setText('h-batt', Math.round(b * 100) + '%');
    setBar('h-batt-bar', b, c.brownout ? 'over' : b < 0.35 ? 'tight' : '');
    setText('h-batt-note', c.brownout ? 'Empty. Instruments are off.' : c.dark ? 'In Earth’s shadow, on battery' : 'In sunlight, charging');
    $('t-batt').dataset.alarm = c.brownout;
    var stored = Math.max(0, c.gen - c.head), full = stored / sim.storage;
    setText('h-mem', (stored < 10 ? stored.toFixed(1) : Math.round(stored)) + ' of ' + sim.storage + ' GB');
    setBar('h-mem-bar', full, full > 0.98 ? 'over' : full > 0.75 ? 'tight' : '');
    setText('h-mem-note', sim.stats.dataLost > 0.5 ? 'Deleted so far: ' + Math.round(sim.stats.dataLost) + ' GB' : 'Pictures waiting to be sent');
    $('t-mem').dataset.alarm = full > 0.98;
    setText('h-link', c.link && c.on ? 'Sending' : 'Waiting');
    setText('h-link-note', c.link ? 'Talking to ' + c.link.name : 'No ground station in view');
    setText('h-eye', c.on ? 'On' : 'Off');
    setText('h-eye-note', c.offline ? 'Computer is restarting' : c.on ? M.fmtPixel(sim.pixelNow()) + ' pixels' : 'No power');
    $('t-eye').dataset.alarm = !c.on;
    var n = { burning: 0, spotted: 0, ok: 0, late: 0 };
    c.fires.forEach(function (f) {
      if (f.state === 'burning') n.burning++;
      else if (f.state === 'spotted') n.spotted++;
      else if (f.state === 'alerted') { if (f.grade === 'late') n.late++; else n.ok++; }
    });
    setText('h-burn', String(n.burning)); setText('h-spot', String(n.spotted));
    setText('h-ok', String(n.ok)); setText('h-late', String(n.late));
    var html = state.log.map(function (l) { return '<li data-kind="' + l.kind + '">' + esc(l.text) + '</li>'; }).join('');
    if (html !== lastLog) { lastLog = html; var ul = $('h-log'); if (ul) ul.innerHTML = html; }
  }

  function chapterEnd() {
    var sim = state.sim, i = sim.chapter;
    V.mission.paused = true;
    updateHud();
    var warned = sim.c.fires.filter(function (f) { return f.grade === 'fast' || f.grade === 'onTime'; }).length;
    var summary = '<p>Year ' + (i + 1) + ': firefighters were warned in time for <b>' + warned + ' of ' + sim.c.fires.length + '</b> fires.</p>';
    if (i >= Sim.CHAPTERS - 1) {
      openDialog('<h2 id="dialog-title">Three years in orbit</h2>' + summary + '<p>The mission is complete. Time to see how ' + D.MISSION.satellite + ' did.</p>' + okButton('Read the report'), finishMission);
      return;
    }
    var card = sim.surprise(i + 1);
    A.play(card.ok ? 'go' : 'bad');
    openDialog('<h2 id="dialog-title">Year ' + card.year + ' surprise: ' + esc(card.title) + '</h2>' + summary +
      '<p>' + esc(card.story) + '</p>' +
      '<div class="outcome" data-ok="' + card.ok + '"><b>' + (card.ok ? 'You were ready.' : 'This one hurts.') + '</b>' + esc(card.text) + '</div>' +
      '<p class="lesson">' + esc(card.lesson) + '</p>' +
      (card.aging ? '<p>Also, after two years in space the battery now holds 20% less.</p>' : '') +
      okButton('Start year ' + card.year), function () {
        sim.startChapter(i + 1);
        V.missionChapter();
        renderHud();
        V.mission.paused = false;
      });
  }

  function skipMission() {
    var sim = state.sim;
    if (!sim || !V.mission) return;
    state.skipping = true;
    V.mission.paused = true; V.mission.ended = true;
    while (!sim.isOver()) {
      sim.finishChapter();
      if (sim.chapter < Sim.CHAPTERS - 1) { sim.surprise(sim.chapter + 1); sim.startChapter(sim.chapter + 1); }
    }
    finishMission();
  }

  function finishMission() {
    var res = state.sim.results();
    state.result = res;
    state.score = Score.compute(state.design, state.diff, res);
    state.debrief = Score.debrief(state.design, state.diff, res, state.score);
    RG.Progress.award(5, Math.max(1, state.score.stars)); // finishing the mission always completes level 5
    state.rewards = RG.Rewards.forMission(state.design, state.score, res, evalNow().cost);
    X.saveLog({
      crew: state.players.join(', '), diff: D.DIFFICULTY[state.diff].name,
      score: state.score.total, stars: state.score.stars, code: M.encode(state.design)
    });
    X.cut(function () {
      $('hud').innerHTML = '';
      X.go('report');
      A.play(state.score.stars >= 2 ? 'star' : 'go');
      say(state.score.verdict + '. ' + state.score.total + ' points.');
    });
  }

  X.launch = launch;
  X.launchDone = launchDone;
  X.skipMission = skipMission;
  X.renderHud = renderHud;
  X.updateHud = updateHud;
})();
