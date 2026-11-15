/* Orbit Ranger — the controller of the mission designer (level 5).
 * Screens, in order:
 *   title → crew → brief → step (seven design steps) → review (Go / No-go)
 *   → launch → mission (three years) → report
 * Each screen draws itself (ui/designer/*.js). This file moves between them,
 * draws the chrome around them (step rail, gauges, drop slots, captions),
 * handles every button, and starts the game.
 */
(function () {
  'use strict';
  var RG = window.RG, D = RG.DATA, M = RG.Model, W = RG.Widgets;
  var V = RG.Views, Stage = RG.Stage, A = RG.Audio, X = RG.Designer, Room = RG.Room;
  var state = X.state, $ = X.$, small = X.small, STEP_VIEWS = X.STEP_VIEWS, VIEW_NAMES = X.VIEW_NAMES, CAPTIONS = X.CAPTIONS;
  var evalNow = X.evalNow, step = X.step, say = X.say, recentWeek = X.recentWeek, openDialog = X.openDialog, okButton = X.okButton;
  var setBar = X.setBar, setText = X.setText;
  var panel, gauges, rail, caption, viewtabs, dialog, fade, dock;
  var HOME_DROP = 0.32; // how far below the middle of the screen the home planet's centre sits, as a share of the height

  /** Fade to black, change the scene, fade back in. */
  function cut(fn) {
    fade.classList.add('is-on');
    setTimeout(function () {
      fn();
      setTimeout(function () { fade.classList.remove('is-on'); }, 90);
    }, 240);
  }

  function setView(name, opts) {
    var hard = V.name && V.family(V.name) !== V.family(name);
    if (hard) cut(function () { V.set(name, opts); }); else V.set(name, opts);
  }

  /** Keep the 3D subject clear of the panels. */
  function layout() {
    var w = window.innerWidth, h = window.innerHeight, s = state.screen;
    var sheet = panel.querySelector('.sheet') || document.querySelector('.lv-side:not([hidden])');
    if (s === 'map') Stage.setOffset(small.matches ? 0 : -w * 0.22, 0);
    else if (s === 'title') Stage.setOffset(0, -h * (w < h ? HOME_DROP - 0.01 : HOME_DROP)); // the planet sits low, rising from the bottom edge
    else if (!sheet) Stage.setOffset(0, 0);
    else if (sheet.offsetWidth > w * 0.8) Stage.setOffset(0, sheet.offsetHeight / 2); // sheet along the bottom (upright phone)
    else Stage.setOffset(sheet.offsetWidth / 2, s === 'step' ? 34 : 0);               // sheet down the side
  }

  function go(screen) {
    Stage.hidden = false;
    state.screen = screen;
    document.body.dataset.screen = screen;
    if (screen === 'title' || screen === 'crew') setView('title', { home: screen === 'title' });
    else if (screen === 'brief') setView('brief');
    else if (screen === 'step') enterStep();
    else if (screen === 'review') setView('bay', { focus: 'all' });
    else if (screen === 'report') setView('report');
    render();
    var h = panel.querySelector('h1');
    if (h && screen !== 'title') h.focus({ preventScroll: true });
  }

  function enterStep() {
    var id = step().id, views = STEP_VIEWS[id];
    state.view = views[0];
    applyStepView();
  }
  function applyStepView() {
    var id = step().id;
    if (state.view === 'bay') setView('bay', { focus: id });
    else setView(state.view);
  }

  /* ---------- rendering ---------- */
  function render() {
    var s = state.screen;
    if (X.screens[s]) X.screens[s]();
    else panel.innerHTML = '';
    if (s !== 'map' && s !== 'level' && s !== 'hangar') document.getElementById('levels').innerHTML = '';
    renderRail();
    renderChrome();
    layout();
  }

  function renderChrome() {
    var s = state.screen, tabs = '', cap = '';
    if (s === 'step') {
      var id = step().id, views = STEP_VIEWS[id], ready = M.stepDone(state.design, step());
      if (views.length > 1) {
        tabs = views.map(function (v) {
          return '<button type="button" data-act="view" data-view="' + v + '" aria-pressed="' + (state.view === v) + '"' +
            (v !== 'bay' && !ready ? ' disabled title="Make your picks first"' : '') + '>' + VIEW_NAMES[v] + '</button>';
        }).join('');
      }
      if (state.view === 'orbit') {
        var o = state.design.orbit;
        cap = !o ? 'Three ways to circle the Earth. Pick one to test it.'
          : o === 'geo' ? 'The far orbit, drawn to scale. The satellite turns with the Earth, so it always sees the same side.'
          : 'One day in fast-forward. The blue paint shows the ground your sensor has seen.';
      } else if (state.view === 'pad') {
        cap = state.design.rocket ? 'Your rocket on the launch pad. Drag to look around.' : 'The launch pad is empty. Pick a rocket.';
      } else cap = CAPTIONS[state.view] || '';
    } else if (s === 'brief') cap = 'Small specks: real fires NASA satellites saw from ' + recentWeek() + '. Named dots: the 14 fire zones in your mission.';
    else if (s === 'title') cap = small.matches ? '' : 'Each orange speck is a real fire seen by NASA’s MODIS instruments, ' + recentWeek() + '.';
    else if (s === 'review') cap = CAPTIONS.bay;
    viewtabs.innerHTML = tabs;
    document.body.classList.toggle('has-tabs', !!tabs);
    caption.textContent = cap;
    gauges.innerHTML = s === 'step' ? W.gauges(evalNow(), state.design) : '';
    dock.innerHTML = s === 'step' ? W.dock(step().groups.map(function (g) {
      var d = state.design, keys = g.pick === 'any' ? d.extras : d[g.key] ? [d[g.key]] : [], all = Object.keys(D[g.from]);
      return {
        key: g.key, label: g.label, multi: g.pick === 'any', icon: D[g.from][all[0]].icon || all[0],
        items: keys.map(function (k) {
          return { icon: D[g.from][k].icon || k, name: D[g.from][k].name, attrs: 'data-act="pick" data-group="' + g.key + '" data-key="' + k + '"' };
        })
      };
    })) : '';
  }

  function renderRail() {
    var s = state.screen;
    if (s !== 'step' && s !== 'review') { rail.innerHTML = ''; return; }
    var d = state.design, open = D.STEPS.length;
    for (var i = 0; i < D.STEPS.length; i++) if (!M.stepDone(d, D.STEPS[i])) { open = i; break; }
    var html = D.STEPS.map(function (st, i) {
      var cur = s === 'step' && i === state.step, done = M.stepDone(d, st);
      return '<li><button type="button" class="rail-btn' + (done ? ' is-done' : '') + '" data-act="goto" data-step="' + st.id + '"' +
        (cur ? ' aria-current="step"' : '') + (i > open ? ' disabled' : '') + '><b>' + (i + 1) + '</b><span>' + st.nav + '</span></button></li>';
    }).join('');
    html += '<li><button type="button" class="rail-btn" data-act="review"' + (s === 'review' ? ' aria-current="step"' : '') +
      (M.isComplete(d) ? '' : ' disabled') + '><b>' + (D.STEPS.length + 1) + '</b><span>Check</span></button></li>';
    rail.innerHTML = '<ol>' + html + '</ol>';
  }

  /** Re-draw the step after a pick without losing the scroll position or keyboard focus. */
  function rerenderStep(group, key) {
    var sc = panel.querySelector('.sheet-scroll'), top = sc ? sc.scrollTop : 0;
    render();
    sc = panel.querySelector('.sheet-scroll');
    if (sc) sc.scrollTop = top;
    if (group) {
      var el = panel.querySelector('.card[data-group="' + group + '"][data-key="' + key + '"]');
      if (el) { el.focus({ preventScroll: true }); el.classList.add('just'); }
    }
  }

  /* ---------- live widgets (10 times a second) ---------- */
  function poll() {
    if (state.screen === 'mission') { X.updateHud(); return; }
    var p = V.preview;
    if (state.screen !== 'step' || !p || !$('lab-bar')) return;
    if (p.mode === 'shadow') {
      setBar('lab-bar', p.battFrac, p.brown ? 'over' : p.battFrac < 0.35 ? 'tight' : '');
      $('lab-bar').firstChild.style.width = Math.round(p.battFrac * 100) + '%';
      setText('lab-num', Math.round(p.battFrac * 100) + '%');
      setText('lab-state', p.brown ? 'Battery empty. Instruments off.' : p.dark ? 'In Earth’s shadow, on battery' : 'In sunlight, charging');
      setText('lab-note', p.brown ? 'The wings or the battery are too small. Try a bigger one and watch again.' : 'Hour ' + Math.floor(p.hours) + ' of 72. If the bar ever hits zero, the instruments switch off.');
    } else if (p.mode === 'stations') {
      var f = p.storage ? p.stored / p.storage : 0;
      $('lab-bar').firstChild.style.width = Math.round(Math.min(1, f) * 100) + '%';
      $('lab-bar').dataset.level = f > 0.98 ? 'over' : f > 0.75 ? 'tight' : '';
      setText('lab-num', (p.stored < 10 ? p.stored.toFixed(1) : Math.round(p.stored)) + ' of ' + p.storage + ' GB');
      setText('lab-state', p.station ? 'Sending to ' + p.station : 'No station in view');
      setText('lab-note', p.lost > 0.5 ? 'Memory overflowed: ' + Math.round(p.lost) + ' GB of pictures deleted so far. Try a faster radio or more stations.' : 'Hour ' + Math.floor(p.hours) + ' of 72. Nothing has been deleted.');
    }
  }

  /* ---------- actions ---------- */
  var SLOTS = { sensor: 'sensor', extras: 'extras', bus: 'bus', panels: 'panels', battery: 'battery', computer: 'computer', pointing: 'pointing', radio: 'radio' };

  function pick(group, key) {
    var d = state.design, st = step();
    var g = st.groups.filter(function (x) { return x.key === group; })[0];
    if (!g) return;
    if (Room.active) { // the server owns the shared design; the new state comes back to everyone
      if (Room.mine(st.role)) Room.pick(group, key); else X.toast(X.owner(st.role) + ' chooses here.');
      return;
    }
    var name = D[g.from][key].name;
    if (g.pick === 'any') {
      var i = d.extras.indexOf(key);
      if (i >= 0) { d.extras.splice(i, 1); A.play('drop'); say(name + ' removed.'); }
      else { d.extras.push(key); A.play('pick'); say(name + ' added.'); }
    } else {
      if (d[group] === key) return;
      d[group] = key;
      A.play('pick');
      say(name + ' picked.');
    }
    state.votes = {};
    V.setDesign(d, SLOTS[group] || null);
    rerenderStep(group, key);
    glideToLab(st);
  }

  /** Once a step with a live test is complete, glide over to the test. */
  function glideToLab(st) {
    var d = state.design, views = STEP_VIEWS[st.id];
    if (views.length > 1 && state.view === 'bay' && M.stepDone(d, st) && !state.autoLab[st.id]) {
      state.autoLab[st.id] = true;
      setTimeout(function () {
        if (state.screen === 'step' && step() === st && state.view === 'bay') { state.view = views[1]; applyStepView(); setTimeout(function () { rerenderStep(); }, 260); }
      }, 1200);
    }
  }

  /* ---------- team play on separate devices (js/net/room.js) ---------- */
  function wireRoom() {
    Room.on.state = function (rs) {
      var before = state.design, changed = null;
      Object.keys(rs.design).forEach(function (k) { if (JSON.stringify(rs.design[k]) !== JSON.stringify(before[k])) changed = k; });
      state.players = rs.players.map(function (p) { return p.name; });
      state.diff = rs.diff;
      state.design = JSON.parse(JSON.stringify(rs.design));
      state.votes = rs.votes;
      var s = state.screen;
      if (changed) {
        V.setDesign(state.design, s === 'step' ? SLOTS[changed] || null : null);
        A.play('pick');
      }
      if (s === 'step' || s === 'review' || s === 'crew' || s === 'brief') rerenderStep();
      if (s === 'title') go('crew');
      if (changed && s === 'step' && step().groups.some(function (g) { return g.key === changed; })) glideToLab(step());
    };
    Room.on.launch = function (seed) {
      var s = state.screen;
      if (s !== 'launch' && s !== 'launch-done' && s !== 'mission') X.launch(seed);
    };
    Room.on.error = function (text) {
      var el = $('room-err');
      if (el && !Room.active) el.textContent = text; else X.toast(text);
    };
    Room.on.closed = function (text) {
      X.toast(text);
      if (state.screen === 'crew' || state.screen === 'step' || state.screen === 'review') rerenderStep();
    };
  }

  function gotoStep(id) {
    for (var i = 0; i < D.STEPS.length; i++) if (D.STEPS[i].id === id) { state.step = i; go('step'); return; }
  }

  var actions = {
    home: function () { if (state.screen === 'mission' || state.screen === 'launch') return; go('title'); },
    start: function () { A.play('tap'); go('crew'); },
    play: function () { A.play('tap'); RG.Levels.showMap(); },
    map: function () { RG.Levels.showMap(); },
    crew: function () { go('crew'); },
    brief: function () { A.play('tap'); go('brief'); },
    design: function () {
      A.play('tap');
      var d = state.design, open = 0;
      for (var i = 0; i < D.STEPS.length; i++) { if (!M.stepDone(d, D.STEPS[i])) break; open = Math.min(i + 1, D.STEPS.length - 1); }
      state.step = M.isComplete(d) ? 0 : open;
      V.setDesign(d, null);
      go('step');
    },
    players: function (el) {
      var n = +el.dataset.n;
      while (state.players.length < n) state.players.push('Player ' + (state.players.length + 1));
      state.players.length = n;
      if (n > 1 && state.players[0] === 'Ranger') state.players[0] = 'Player 1';
      if (n === 1 && /^Player \d$/.test(state.players[0])) state.players[0] = 'Ranger';
      render();
    },
    diff: function (el) { state.diff = el.dataset.key; A.play('pick'); render(); },
    pick: function (el, e) {
      var g = el.dataset.group, k = el.dataset.key, inDock = !!el.closest('.dock');
      if (el.classList.contains('is-locked')) { X.toast(X.owner(step().role) + ' chooses here.'); return; } // another player's console
      if (g === 'extras' && !inDock && state.design.extras.indexOf(k) >= 0) return; // already on board; the × in its slot takes it off
      pick(g, k);
    },
    ask: function () { state.asked[step().id] = true; rerenderStep(); },
    view: function (el) { state.view = el.dataset.view; applyStepView(); setTimeout(function () { rerenderStep(); }, 260); },
    goto: function (el) { A.play('tap'); gotoStep(el.dataset.step); },
    review: function () { go('review'); },
    back: function () {
      if (state.screen === 'review') { state.step = D.STEPS.length - 1; go('step'); }
      else if (state.step === 0) go('brief');
      else { state.step--; go('step'); }
    },
    next: function () {
      A.play('tap');
      if (state.step === D.STEPS.length - 1) go('review');
      else { state.step++; go('step'); }
    },
    'room-create': function () { Room.create(state.players[0], state.diff); },
    'room-join': function () {
      var code = ($('room-code').value || '').trim().toUpperCase();
      if (!/^[A-Z]{4}$/.test(code)) { $('room-err').textContent = 'A room code is four letters.'; return; }
      Room.join(code, state.players[0]);
    },
    'room-leave': function () { Room.leave(); },
    vote: function (el) {
      var r = el.dataset.role;
      if (Room.active) { Room.vote(r, !state.votes[r]); return; }
      state.votes[r] = !state.votes[r];
      A.play(state.votes[r] ? 'go' : 'drop');
      rerenderStep();
      var b = panel.querySelector('.vote[data-role="' + r + '"]');
      if (b) b.focus({ preventScroll: true });
    },
    launch: function () { if (Room.active) Room.launch(); else X.launch(); },
    'skip-launch': function () { if (state.screen === 'launch') { A.stopRumble(); X.launchDone(); } },
    speed: function (el) { if (V.mission) { V.mission.speed = +el.dataset.x; X.renderHud(); } },
    skip: function () { X.skipMission(); },
    improve: function () { state.step = 0; state.votes = {}; V.setDesign(state.design, null); go('step'); },
    copy: function (el) {
      var code = M.encode(state.design);
      function done() { el.textContent = 'Copied'; say('Mission code copied.'); }
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(code).then(done, function () { window.prompt('Copy this mission code:', code); });
      else window.prompt('Copy this mission code:', code);
    },
    term: function (el) {
      var g = D.GLOSSARY[el.dataset.term];
      openDialog('<h2 id="dialog-title">' + W.esc(g[0]) + '</h2><p>' + W.esc(g[1]) + '</p>' + okButton('Got it'));
    },
    help: function () { X.dialogs.help(); },
    sources: function () { X.dialogs.sources(); },
    code: function () { X.dialogs.code(); },
    log: function () { X.dialogs.log(); },
    'load-code': function () {
      var moon = RG.Lunar.decode($('code-in').value);
      if (moon) { // a Moon landing plan from level 6
        RG.Progress.data.moon = moon; RG.Progress.save();
        dialog.close();
        RG.Levels.showMap();
        if (RG.Progress.isOpen(6)) RG.Levels.start(6); else X.toast('Moon plan saved. Reach orbit in level 4 to open the Moon, or tap level 6 to skip ahead.');
        return;
      }
      var d = M.decode(($('code-in').value || '').toUpperCase());
      if (!d) { $('code-err').textContent = 'That code does not look right. A code looks like OR-11111111120, or MN-1-03-A for a Moon plan.'; return; }
      state.design = d; state.votes = {};
      V.setDesign(d, null);
      dialog.close();
      go('crew');
      say('Design loaded.');
    },
    close: function () { dialog.close(); },
    sound: function (el) {
      var mode = A.toggle(); // sound and voice → sound only → off
      if (RG.Voice && mode !== 'on') RG.Voice.stop();
      setSound(el);
      if (A.on) A.play('tap');
      X.toast(A.LABEL[mode] + '.');
    },
    words: function () { RG.Explain.glossary(); }
  };

  function setSound(el) {
    el.textContent = A.mode === 'on' ? 'Voice on' : A.mode === 'fx' ? 'Voice off' : 'Sound off';
    el.setAttribute('aria-label', A.LABEL[A.mode] + '. Press to change.');
    el.setAttribute('aria-pressed', A.on);
  }

  // the screen files call back into the controller through the shared context
  X.go = go; X.render = render; X.cut = cut; X.rerenderStep = rerenderStep; X.layout = layout; X.gotoStep = gotoStep;

  /* ---------- start-up ---------- */
  function init() {
    panel = $('panel'); gauges = $('gauges'); rail = $('rail'); caption = $('caption');
    viewtabs = $('viewtabs'); dialog = $('dialog'); fade = $('fade');

    dock = document.createElement('div');
    dock.id = 'dock';
    document.body.appendChild(dock);
    W.initDrag();
    wireRoom();

    var skip = document.createElement('button');
    skip.type = 'button'; skip.id = 'skip-launch'; skip.className = 'btn ghost';
    skip.dataset.act = 'skip-launch'; skip.textContent = 'Skip the launch';
    document.body.appendChild(skip);

    var sb = $('sound-btn');
    setSound(sb);

    if (!window.THREE || !Stage.init($('stage'))) {
      panel.innerHTML = '<div class="hero"><h1><span>Orbit</span><span>Ranger</span></h1><p class="lede">This game needs 3D graphics (WebGL), and this browser could not start it. Try a recent version of Chrome, Edge, Firefox or Safari.</p></div>';
      return;
    }
    V.init();
    // the level path (js/ui/levels.js) drives the same stage and dialogs
    RG.App = {
      state: state,
      setScreen: function (name) { state.screen = name; document.body.dataset.screen = name; render(); },
      view: setView,
      layout: layout,
      say: say,
      openDialog: openDialog,
      closeDialog: function () { if (dialog.open) dialog.close(); },
      startDesigner: function () { go('brief'); }
    };
    RG.Levels.init(RG.App);

    document.addEventListener('click', function (e) {
      var el = e.target.closest('[data-act]');
      if (!el || el.disabled) return;
      var fn = actions[el.dataset.act];
      if (fn) fn(el, e);
    });
    document.addEventListener('input', function (e) {
      var i = e.target.dataset && e.target.dataset.name;
      if (i != null) state.players[+i] = e.target.value.trim() || 'Player ' + (+i + 1);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && e.target.id === 'code-in') actions['load-code']();
      if (e.key === 'Enter' && e.target.id === 'room-code') actions['room-join']();
    });
    dialog.addEventListener('close', X.dialogClosed);
    window.addEventListener('resize', layout);
    small.addEventListener('change', layout);
    setInterval(poll, 100);

    go('title');
    Stage.setOffset(0, -window.innerHeight * HOME_DROP, true);
    // a link shared by a crew (…/?crew=ABCD) opens straight at the crew's door
    if (/[?&]crew=[A-Za-z]{4}\b/.test(window.location.search)) RG.Levels.start('crew4');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
