/* Orbit Ranger — what every level shares.
 * The level frame (progress bar, Pip's speech bubble, side card, HUD, controls,
 * result sheet), the finish and failure screens, and the gauges of levels 3 and 4.
 * A level is a function that returns { frame, cleanup, ...button handlers }.
 */
(function () {
  'use strict';
  var RG = window.RG, A = RG.Audio, W = RG.Widgets, Pg = RG.Progress;
  var K = {
    root: null, countEl: null, App: null, // set by RG.Levels.init
    cur: null,                            // the level being played
    keys: { left: false, right: false, burn: false },
    DEFAULT_BUILD: { tank: 'M', engines: 'E3', boosters: 'none' },
    DEFAULT_SAT: RG.Model.decode('OR-11111121100')
  };

  function icon(svg) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + svg + '</svg>';
  }
  function starRow(n, cls) {
    var out = '';
    for (var i = 1; i <= 3; i++) out += '<svg viewBox="0 0 24 24" class="star' + (i <= n ? ' is-on' : '') + '" aria-hidden="true"><path d="M12 2.6l2.9 6 6.5.9-4.7 4.6 1.1 6.5L12 17.5l-5.8 3.1 1.1-6.5L2.6 9.5l6.5-.9z"/></svg>';
    return '<span class="stars ' + (cls || '') + '" role="img" aria-label="' + n + ' of 3 stars">' + out + '</span>';
  }
  /** Pip says a line and pulls a face: happy, cheer, wow, worry or sad. */
  function say(text, mood) {
    var el = document.getElementById('lv-say'), pip = document.getElementById('lv-pip');
    if (pip && pip.dataset.mood !== (mood || 'happy')) { pip.dataset.mood = mood || 'happy'; pip.innerHTML = W.pip(mood); }
    if (el && el.textContent !== text) { el.textContent = text; K.App.say(text); }
  }
  function bar(frac) {
    var el = document.getElementById('lv-bar');
    if (el) el.style.width = Math.max(4, Math.min(100, frac * 100)).toFixed(0) + '%';
  }
  function side(html) { var el = document.getElementById('lv-side'); var was = el.hidden; el.innerHTML = html; el.hidden = !html; if (was !== el.hidden) K.App.layout(); }
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

  function shell(id) {
    K.App.setScreen('level');
    K.root.innerHTML = '<div class="lv">' +
      '<div class="lv-top"><button type="button" class="lv-x" data-lv="quit" aria-label="Leave the level">×</button>' +
      '<div class="lv-progress" role="progressbar" aria-label="Level progress"><i id="lv-bar"></i></div><span class="lv-tag">Level ' + id + '</span></div>' +
      '<div class="lv-coach"><span id="lv-pip" data-mood="happy">' + W.pip() + '</span><p id="lv-say"></p></div>' +
      '<div class="lv-hud" id="lv-hud"></div><div class="lv-side" id="lv-side" hidden></div>' +
      '<div class="lv-controls" id="lv-controls"></div><div class="lv-sheet" id="lv-sheet" hidden></div></div>';
    bar(0);
  }

  function complete(id, stars, title, line, badges) {
    Pg.award(id, stars);
    var won = Pg.earn(badges || [], RG.Rewards.LEVEL_CARD[id]);
    say('You did it!', 'cheer');
    A.play('star');
    var next = id < 5 ? id + 1 : 0, conf = '';
    for (var i = 0; i < 18; i++) conf += '<i style="--x:' + (Math.random() * 100).toFixed(0) + '%;--d:' + (Math.random() * 0.6).toFixed(2) + 's;--h:' + Math.floor(Math.random() * 360) + '"></i>';
    document.getElementById('lv-controls').innerHTML = '';
    sheet('done', '<div class="confetti" aria-hidden="true">' + conf + '</div>' + starRow(stars, 'is-big') + '<h2>' + title + '</h2>' +
      (line ? '<p class="done-line">' + line + '</p>' : '') + RG.Rewards.html(won) +
      '<div class="actions">' + (next ? '<button type="button" class="btn primary big" data-lv="go" data-id="' + next + '">Next level</button>' : '') +
      '<button type="button" class="btn" data-lv="go" data-id="' + id + '">Again</button><button type="button" class="btn" data-lv="map">Map</button></div>');
    K.App.say(title + '. ' + stars + ' of 3 stars.');
  }
  /** A level did not work out: show a little cartoon of what went wrong and one clear thing to try. */
  function failed(id, title, text, replay, tryBtn) {
    A.play('bad');
    A.stopRumble();
    say('Oops. Look what happened.', 'sad');
    sheet('bad', '<div class="oops">' + W.replay(replay) + '<div><h2>' + title + '</h2><p>' + text + '</p></div></div>' +
      '<div class="actions">' + (tryBtn || '<button type="button" class="btn danger big" data-lv="go" data-id="' + id + '">Try again</button>') +
      '<button type="button" class="btn" data-lv="map">Map</button></div>');
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

  K.icon = icon; K.starRow = starRow; K.say = say; K.bar = bar; K.side = side; K.hud = hud; K.controls = controls;
  K.sheet = sheet; K.hideSheet = hideSheet; K.set = set; K.height = height; K.shell = shell;
  K.complete = complete; K.failed = failed; K.tankHtml = tankHtml; K.gyroHtml = gyroHtml; K.gyro = gyro; K.clock = clock;
  RG.LevelKit = K;
})();
