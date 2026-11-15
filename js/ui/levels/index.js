/* Orbit Ranger — the level path.
 * Six levels, played in order like a lesson path, and a separate two-player mission:
 *   1  Meet the rocket     x-ray each part, then a short quiz        (levels/level1.js)
 *   2  Build the rocket    pick tanks, engines, boosters; test it    (levels/level2.js)
 *   3  Lift-off            steer the climb to space                  (levels/level3.js)
 *   4  Reach orbit         burn sideways until the path closes       (levels/level4.js)
 *   5  Mission designer    the full satellite design game            (ui/app.js)
 *   6  Moon landing        plan, deorbit, land and walk              (levels/level6.js)
 *   coop1  Launch crew     two players, two jobs, one rocket         (levels/coop.js)
 * This file starts and stops levels, routes buttons and keys to the level being played, and drives its frame loop.
 */
(function () {
  'use strict';
  var RG = window.RG, Stage = RG.Stage, R = RG.Rocket, A = RG.Audio, K = RG.LevelKit, Pg = RG.Progress;
  var keys = K.keys;
  var L = {};

  function showMap() { stop(); RG.LevelMap.show(); }
  L.showMap = showMap;

  function stop() {
    if (K.cur && K.cur.cleanup) K.cur.cleanup();
    K.cur = null; K.paused = false;
    document.body.classList.remove('is-paused');
    if (RG.Explain) RG.Explain.close();
    if (RG.Voice) RG.Voice.stop();
    Object.keys(keys).forEach(function (k) { keys[k] = false; });
    Stage.cameraFn = null;
    Stage.clearLabels('part');
    Stage.shake = 0;
    A.stopRumble();
    if (K.countEl) K.countEl.className = '';
  }
  function start(id) {
    stop();
    Stage.hidden = false;
    if (id === 5) { K.root.innerHTML = ''; K.App.startDesigner(); return; }
    if (!RG.LevelDefs[id]) { showMap(); return; }
    K.shell(id);
    K.cur = RG.LevelDefs[id]();
    K.cur.id = id;
  }
  L.start = start;

  /* ---------- buttons, keys and the frame loop ---------- */
  L.stop = stop;
  function levelId(el) { var id = el.dataset.id; return /^\d+$/.test(id) ? +id : id; }
  var actions = L.actions = {
    go: function (el) { A.play('tap'); start(levelId(el)); },
    // A locked level: say which level to play first and why, and let the player skip ahead if they would rather.
    locked: function (el) {
      var id = levelId(el), lv = RG.LevelMap.LEVELS.filter(function (l) { return l.id === id; })[0], first = RG.LevelMap.next();
      if (!lv) return;
      A.play('tap');
      K.App.openDialog('<h2 id="dialog-title">Level ' + id + ' is still locked</h2><p>The levels build on each other, like lessons.</p><p class="lock-why"><b>' + lv.title + '.</b> ' + lv.need + '</p>' +
        '<div class="actions">' + (first ? '<button type="button" class="btn primary" data-lv="lockGo" data-id="' + first.id + '" autofocus>Play level ' + first.id + ' first</button>' : '') +
        '<button type="button" class="btn" data-lv="lockGo" data-id="' + id + '">Skip ahead</button><button type="button" class="btn" data-act="close">Stay on the map</button></div>');
    },
    lockGo: function (el) { K.App.closeDialog(); A.play('tap'); start(levelId(el)); },
    map: function () { showMap(); },
    quit: function () { showMap(); },
    unlock: function () { Pg.data.all = !Pg.data.all; Pg.save(); showMap(); },
    reset: function () { Pg.reset(); showMap(); },
    album: function () { RG.Rewards.album(); },
    hear: function () { if (RG.Voice && K.saidSpoken && !RG.Voice.say(K.saidSpoken, K.saidClip) && RG.Designer) RG.Designer.toast(RG.Voice.why()); }
  };

  L.init = function (app) {
    K.App = app;
    K.root = document.getElementById('levels');
    K.countEl = document.getElementById('count');
    Pg.load();
    document.addEventListener('click', function (e) {
      var el = e.target.closest('[data-lv]');
      if (!el || el.disabled) return;
      var name = el.dataset.lv, fn = actions[name] || (K.cur && K.cur[name]);
      if (typeof fn === 'function') fn(el, e);
    });
    function hold(e, on) {
      var el = e.target.closest && e.target.closest('[data-hold]');
      if (!el) return;
      if (on && (K.paused || el.disabled)) return;
      keys[el.dataset.hold] = on;
      el.classList.toggle('is-held', on);
      if (on) e.preventDefault();
    }
    document.addEventListener('pointerdown', function (e) { hold(e, true); });
    ['pointerup', 'pointercancel', 'pointerout'].forEach(function (n) { document.addEventListener(n, function (e) { hold(e, false); }); });
    // Arrow keys everywhere; in level 6 also W A S D, so two players can share the keyboard:
    // one leans the lander with A and D, the other works the engine with the up and down arrows.
    var KEYS = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', a: 'left', d: 'right', w: 'up', s: 'down' };
    function key(e, on) {
      if (!K.cur || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.ctrlKey || e.metaKey || e.altKey) return;
      if (K.paused) { if (!on) Object.keys(keys).forEach(function (k) { keys[k] = false; }); return; }
      if (K.cur.onKey) { if (K.cur.onKey(e, on)) e.preventDefault(); return; } // a level with its own keys (the two-player mission)
      var moon = K.cur.id === 6, name = KEYS[e.key.length === 1 ? e.key.toLowerCase() : e.key];
      if (name && (moon || e.key === 'ArrowLeft' || e.key === 'ArrowRight')) keys[name] = on;
      else if (e.key === ' ' && (K.cur.id === 4 || moon) && e.target.tagName !== 'BUTTON') keys[moon ? 'jump' : 'burn'] = on;
      else return;
      e.preventDefault();
    }
    document.addEventListener('keydown', function (e) { key(e, true); });
    document.addEventListener('keyup', function (e) { key(e, false); });
    // a key held when the window loses focus never gets its key-up; let go of everything
    window.addEventListener('blur', function () { Object.keys(keys).forEach(function (k) { keys[k] = false; }); });
    Stage.onFrame(function (dt) {
      R.tick(dt);
      if (K.cur && K.cur.frame && !K.paused) K.cur.frame(dt);
    });
  };

  RG.Levels = L;
})();
