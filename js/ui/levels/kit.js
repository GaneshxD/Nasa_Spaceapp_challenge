/* Orbit Ranger — what every level shares.
 * The level frame (progress bar, Pip's speech bubble, side card, HUD, controls, result sheet), the finish and
 * failure screens, the instrument read-outs, and the gauges of the flying levels.
 * A level is a function that returns { frame, cleanup, ...button handlers }. It may also offer:
 *   live()        true while something is moving that should wait when the player stops to read (see K.pause)
 *   onKey(e, on)  to take the keyboard itself; return true if the key was used
 */
(function () {
  'use strict';
  var RG = window.RG, A = RG.Audio, W = RG.Widgets, Pg = RG.Progress, Terms = RG.Terms;
  var K = {
    root: null, countEl: null, App: null, // set by RG.Levels.init
    cur: null,                            // the level being played
    paused: false, said: '', saidClip: null,
    keys: { left: false, right: false, up: false, down: false, burn: false, jump: false },
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
  /**
   * Pip says a line and pulls a face: happy, cheer, wow, worry or sad.
   * The line may mark technical words with {key} or {key|shown words}: they become words the player can tap.
   * voice: a recorded clip to play (assets/voice), a list of clips to play one after another, or false to stay silent
   * for this line (quick status lines).
   * Otherwise the line's own recording is played, if it has one and the Sound button allows it. Words inside
   * [[double brackets]] are shown but not spoken: put live numbers there.
   */
  function say(text, mood, voice) {
    var el = document.getElementById('lv-say'), pip = document.getElementById('lv-pip');
    if (pip && pip.dataset.mood !== (mood || 'happy')) { pip.dataset.mood = mood || 'happy'; pip.innerHTML = W.pip(mood); }
    if (!el || K.said === text) return;
    // [[...]] holds live numbers: they are shown but not spoken, so the spoken words of a line never change and
    // can be a recording (tools/voice/lines.js finds every line and names its file)
    var shown = text.replace(/\[\[|\]\]/g, ''), spoken = Terms.plain(text.replace(/\[\[[\s\S]*?\]\]/g, '')).replace(/\s+/g, ' ').trim();
    K.said = text; K.saidSpoken = spoken; K.saidClip = typeof voice === 'string' || Array.isArray(voice) ? voice : null;
    el.innerHTML = W.terms(shown);
    var hear = document.getElementById('lv-hear'), can = voice !== false && !!spoken && !!RG.Voice && RG.Voice.canSay(spoken, K.saidClip);
    if (hear) hear.hidden = !can; // the speaker button is there only when there is something to hear
    K.App.say(Terms.plain(shown));
    if (can && !K.paused) RG.Voice.say(spoken, K.saidClip);
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
    var b = el.querySelector('.actions button') || el.querySelector('button');
    if (b) b.focus({ preventScroll: true });
  }
  function hideSheet() { var el = document.getElementById('lv-sheet'); if (el) el.hidden = true; }
  function set(id, text) { var el = document.getElementById(id); if (el && el.textContent !== text) el.textContent = text; }
  function height(id, frac) { var el = document.getElementById(id); if (el) el.style.height = Math.max(0, Math.min(100, frac * 100)).toFixed(1) + '%'; }
  function level(id, lv) { var el = document.getElementById(id); if (el && el.dataset.level !== (lv || '')) el.dataset.level = lv || ''; }

  /**
   * Stop the clock while the player reads an explanation, and start it again after.
   * Only a level that says it is live() is paused. Returns true if something was actually paused.
   */
  K.pause = function (on, who) {
    if (on) {
      if (K.paused || !K.cur || !K.cur.live || !K.cur.live()) return false;
      K.paused = who || true;
      A.stopRumble();
      Object.keys(K.keys).forEach(function (k) { K.keys[k] = false; });
      document.body.classList.add('is-paused');
      return true;
    }
    if (K.paused && (!who || K.paused === who)) { K.paused = false; document.body.classList.remove('is-paused'); if (K.cur && K.cur.resume) K.cur.resume(); }
    return false;
  };

  var TAGS = {}; // the label in the corner of the level frame, for levels that are not on the numbered path
  K.tag = function (id, text) { TAGS[id] = text; };
  function shell(id) {
    K.App.setScreen('level');
    K.paused = false; K.said = ''; K.saidSpoken = ''; K.saidClip = null; document.body.classList.remove('is-paused');
    if (RG.Explain) RG.Explain.close();
    K.root.innerHTML = '<div class="lv">' +
      '<div class="lv-top"><button type="button" class="lv-x" data-lv="quit" aria-label="Leave the level">×</button>' +
      '<div class="lv-progress" role="progressbar" aria-label="Level progress"><i id="lv-bar"></i></div><span class="lv-tag">' + (TAGS[id] || 'Level ' + id) + '</span></div>' +
      '<div class="lv-coach"><span id="lv-pip" data-mood="happy">' + W.pip() + '</span><p id="lv-say"></p>' +
      '<button type="button" class="lv-hear" id="lv-hear" data-lv="hear" aria-label="Hear that again" hidden>' + RG.Explain.EAR + '</button></div>' +
      '<div class="lv-hud" id="lv-hud"></div><div class="lv-side" id="lv-side" hidden></div>' +
      '<div class="lv-controls" id="lv-controls"></div><div class="lv-sheet" id="lv-sheet" hidden></div></div>';
    bar(0);
  }

  /** The words a level taught, as a row the player can tap through once more. */
  function learned(keys) {
    keys = (keys || []).filter(function (k) { return RG.TERMS[k]; });
    if (!keys.length) return '';
    return '<div class="learned"><b>Words you used</b><span>' + keys.map(function (k) { return W.term(k, W.esc(RG.TERMS[k].t)); }).join('') + '</span></div>';
  }

  /**
   * A level is finished. o: { next: the level to offer next (0 for none), words: [term keys to recap],
   * again: label of the replay button (false for no replay button), extra: buttons to put first,
   * save: false to keep stars off the numbered path }
   */
  function complete(id, stars, title, line, badges, o) {
    o = o || {};
    if (o.save !== false) Pg.award(id, stars);
    var won = Pg.earn(badges || [], o.save !== false ? RG.Rewards.cardFor(id) : null);
    say('You did it!', 'cheer', false);
    A.play('star');
    var next = o.next != null ? o.next : id < 6 ? id + 1 : 0, conf = '';
    for (var i = 0; i < 18; i++) conf += '<i style="--x:' + (Math.random() * 100).toFixed(0) + '%;--d:' + (Math.random() * 0.6).toFixed(2) + 's;--h:' + Math.floor(Math.random() * 360) + '"></i>';
    document.getElementById('lv-controls').innerHTML = '';
    sheet('done', '<div class="confetti" aria-hidden="true">' + conf + '</div>' + starRow(stars, 'is-big') + '<h2>' + title + '</h2>' +
      (line ? '<p class="done-line">' + line + '</p>' : '') + learned(o.words) + RG.Rewards.html(won) +
      '<div class="actions">' + (o.extra || '') + (next ? '<button type="button" class="btn primary big" data-lv="go" data-id="' + next + '">Next level</button>' : '') +
      (o.again === false ? '' : '<button type="button" class="btn" data-lv="go" data-id="' + id + '">' + (o.again || 'Again') + '</button>') + '<button type="button" class="btn" data-lv="map">Map</button></div>');
    K.App.say(title + '. ' + stars + ' of 3 stars.');
  }
  /** A level did not work out: show a little cartoon of what went wrong, why, and one clear thing to try. */
  function failed(id, title, text, replay, tryBtn) {
    A.play('bad');
    A.stopRumble();
    say('Oops. Look what happened.', 'sad', false);
    sheet('bad', '<div class="oops">' + W.replay(replay) + '<div><h2>' + title + '</h2><p>' + W.terms(text) + '</p></div></div>' +
      '<div class="actions">' + (tryBtn || '<button type="button" class="btn danger big" data-lv="go" data-id="' + id + '">Try again</button>') +
      '<button type="button" class="btn" data-lv="map">Map</button></div>');
  }

  /* ====================================================================
   * Instrument read-outs: one tile per number, each of which explains itself when tapped
   * ==================================================================== */
  /**
   * One instrument. id: the element that holds the number. term: the word it explains itself with.
   * o: { unit, sub: id of a small second line, cls, bar: id of a bar under the number, note }
   */
  function rd(id, term, label, o) {
    o = o || {};
    return '<button type="button" class="rd ' + (o.cls || '') + '" id="' + id + '-box" data-term="' + term + '"' + (o.note ? ' data-note="' + W.esc(o.note) + '"' : '') + '>' +
      '<span class="rd-l">' + label + '</span><span class="rd-n"><b id="' + id + '">' + (o.value || '0') + '</b>' + (o.unit ? '<i>' + o.unit + '</i>' : '') + '</span>' +
      (o.bar ? '<span class="rd-bar"><i id="' + o.bar + '"></i></span>' : '') + (o.sub ? '<em id="' + o.sub + '"></em>' : '') + '</button>';
  }
  /** Tell an instrument's pop-up what its number means at this moment. */
  function note(id, text) { var el = document.getElementById(id + '-box'); if (el && el.dataset.note !== text) el.dataset.note = text; }

  /* ====================================================================
   * Gauges shared by the flying levels
   * ==================================================================== */
  function tankHtml(id, cls, name, term) {
    return '<button type="button" class="tank ' + cls + '" data-term="' + (term || 'propellant') + '"><div class="tank-tube"><i id="' + id + '"></i></div><b>' + name + '</b><span id="' + id + '-t"></span></button>';
  }
  function gyroHtml(label) {
    return '<div class="gyro plate-w"><button type="button" class="gyro-dial" data-term="pitch" aria-label="Pitch gauge. Tap to learn what pitch is."><svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="54" class="gy-ring"/>' +
      '<g id="gy-target"><path d="M60 60L50.6 6.8A54 54 0 0 1 69.4 6.8Z" class="gy-green"/></g>' +
      '<g id="gy-needle"><path d="M60 64V12" class="gy-needle"/><path d="M60 6l-6 10h12z" class="gy-tip"/></g><circle cx="60" cy="60" r="6" class="gy-hub"/>' +
      '<text x="60" y="112" text-anchor="middle" class="gy-lab">' + (label || 'GYRO') + '</text></svg></button>' +
      '<dl><div data-term="pitch" tabindex="0" role="button"><dt>Pitch</dt><dd id="gy-p">0°</dd></div><div data-term="yaw" tabindex="0" role="button"><dt>Yaw</dt><dd id="gy-y">0°</dd></div><div data-term="roll" tabindex="0" role="button"><dt>Roll</dt><dd id="gy-r">0°</dd></div></dl></div>';
  }
  function gyro(pitchDeg, targetDeg, yaw, roll) {
    var n = document.getElementById('gy-needle'), t = document.getElementById('gy-target');
    if (n) n.setAttribute('transform', 'rotate(' + pitchDeg.toFixed(1) + ' 60 60)');
    if (t) t.setAttribute('transform', 'rotate(' + targetDeg.toFixed(1) + ' 60 60)');
    set('gy-p', Math.round(pitchDeg) + '°'); set('gy-y', Math.round(yaw) + '°'); set('gy-r', Math.round(roll) + '°');
  }
  function clock(t) { var s = Math.floor(t); return 'T+' + Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); }

  K.icon = icon; K.starRow = starRow; K.say = say; K.bar = bar; K.side = side; K.hud = hud; K.controls = controls;
  K.sheet = sheet; K.hideSheet = hideSheet; K.set = set; K.height = height; K.level = level; K.shell = shell; K.learned = learned;
  K.complete = complete; K.failed = failed; K.rd = rd; K.note = note; K.tankHtml = tankHtml; K.gyroHtml = gyroHtml; K.gyro = gyro; K.clock = clock;
  RG.LevelKit = K;
})();
