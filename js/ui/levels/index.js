/* Orbit Ranger — the level path.
 * Five levels, played in order like a lesson path:
 *   1  Meet the rocket     x-ray each part, then a short quiz        (levels/level1.js)
 *   2  Build the rocket    drag on tanks, engines, boosters; test it (levels/level2.js)
 *   3  Lift-off            steer the climb to space                  (levels/level3.js)
 *   4  Reach orbit         burn sideways until the path closes       (levels/level4.js)
 *   5  Mission designer    the full satellite design game            (ui/app.js)
 * This file starts and stops levels, routes buttons and keys to the level
 * being played, and drives its frame loop.
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
    K.cur = null;
    keys.left = keys.right = keys.burn = false;
    Stage.clearLabels('part');
    Stage.shake = 0;
    A.stopRumble();
    if (K.countEl) K.countEl.className = '';
  }
  function start(id) {
    stop();
    Stage.hidden = false;
    if (id === 5) { K.root.innerHTML = ''; K.App.startDesigner(); return; }
    K.shell(id);
    K.cur = RG.LevelDefs[id]();
    K.cur.id = id;
  }

  /* ---------- buttons, keys and the frame loop ---------- */
  var actions = {
    go: function (el) { A.play('tap'); start(+el.dataset.id); },
    map: function () { showMap(); },
    quit: function () { showMap(); },
    unlock: function () { Pg.data.all = !Pg.data.all; Pg.save(); showMap(); },
    reset: function () { Pg.reset(); showMap(); },
    album: function () { RG.Rewards.album(); }
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
      keys[el.dataset.hold] = on;
      el.classList.toggle('is-held', on);
      if (on) e.preventDefault();
    }
    document.addEventListener('pointerdown', function (e) { hold(e, true); });
    ['pointerup', 'pointercancel', 'pointerout'].forEach(function (n) { document.addEventListener(n, function (e) { hold(e, false); }); });
    function key(e, on) {
      if (!K.cur) return;
      if (e.key === 'ArrowLeft') keys.left = on;
      else if (e.key === 'ArrowRight') keys.right = on;
      else if (e.key === ' ' && K.cur.id === 4 && e.target.tagName !== 'BUTTON') keys.burn = on;
      else return;
      e.preventDefault();
    }
    document.addEventListener('keydown', function (e) { key(e, true); });
    document.addEventListener('keyup', function (e) { key(e, false); });
    Stage.onFrame(function (dt) {
      R.tick(dt);
      if (K.cur && K.cur.frame) K.cur.frame(dt);
    });
  };

  RG.Levels = L;
})();
