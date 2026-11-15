/* Orbit Ranger — explanations.
 * Every technical word and every instrument in the game can be tapped (or pointed at with a mouse) to see what it
 * means, why it matters right now, and a real number. The words are in js/core/terms.js. Anything on the page that
 * carries data-term="<key>" gets this for free; teaching text marks words with {key} and W.terms() does the rest.
 *
 *   point at it with a mouse   a small card appears, and goes when the pointer leaves
 *   tap or click it            the card stays ("pinned"), its recording is played, and a flight in progress is paused, so
 *                              a player is never punished for stopping to read
 *   Escape, a tap elsewhere    closes it, and the flight carries on
 *
 * The "Space words" button in the top bar lists every word, grouped and searchable.
 */
(function () {
  'use strict';
  var RG = window.RG, W = RG.Widgets, T = RG.TERMS, Terms = RG.Terms;
  var X = { open: null, pinned: false, el: null };
  var hoverTimer = 0, leaveTimer = 0;

  var EAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9z" fill="currentColor"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  X.EAR = EAR;

  /** A word the player can tap. shown: the words to print (already safe HTML); default: the word as it reads in a sentence. */
  W.term = function (key, shown) {
    if (!T[key]) return shown != null ? shown : W.esc(key);
    return '<button type="button" class="term" data-term="' + key + '">' + (shown != null ? shown : W.esc(Terms.inline(key))) + '</button>';
  };
  /** Turn {key} and {key|shown words} markers in teaching text into words the player can tap. The text is escaped first. */
  W.terms = function (text) {
    return W.esc(text).replace(/\{([a-z0-9]+)(?:\|([^}]*))?\}/gi, function (m, key, shown) { return W.term(key, shown); });
  };
  /**
   * Pick the technical words out of plain text that has no markers (a hangar note), and make up to `max` of them
   * tappable: the first time each one appears. Text that already holds HTML is left as it is.
   */
  var autoRe = null;
  W.autoTerms = function (text, max) {
    if (!text || /[<&]/.test(text)) return text;
    if (!autoRe) {
      autoRe = new RegExp('\\b(' + Object.keys(Terms.AUTO).sort(function (a, b) { return b.length - a.length; }).map(function (p) { return p.replace(/[-.]/g, '\\$&'); }).join('|') + ')\\b', 'gi');
    }
    var used = {}, n = 0;
    return text.replace(autoRe, function (m) {
      var key = Terms.AUTO[m.toLowerCase()];
      if (!key || !T[key] || used[key] || n >= (max || 3)) return m;
      used[key] = true; n++;
      return W.term(key, m);
    });
  };
  /** The small round "what is this?" mark that sits on an instrument. */
  W.help = function (key) { return T[key] ? '<span class="what" aria-hidden="true">?</span>' : ''; };

  function body(key, note) {
    var e = T[key];
    return '<div class="ex-head"><b id="ex-title">' + W.esc(e.t) + '</b>' +
      (RG.Voice && RG.Voice.canSay(Terms.spoken(key), 'w_' + key) ? '<button type="button" class="ex-say" data-ex="say" aria-label="Hear it">' + EAR + '</button>' : '') +
      '<button type="button" class="ex-x" data-ex="close" aria-label="Close">×</button></div>' +
      '<p class="ex-s">' + W.esc(e.s) + '</p>' +
      (note ? '<p class="ex-now"><i>Right now</i>' + W.esc(note) + '</p>' : '') +
      '<p class="ex-w"><i>Why it matters</i>' + W.esc(e.w) + '</p>' +
      (e.f ? '<p class="ex-f"><i>Real life</i>' + W.esc(e.f) + '</p>' : '') +
      '<p class="ex-pause" hidden>Paused while you read. Close this to carry on.</p>';
  }

  function ensure(parent) {
    if (!X.el) {
      X.el = document.createElement('div');
      X.el.id = 'explain'; X.el.className = 'ex'; X.el.setAttribute('role', 'dialog'); X.el.setAttribute('aria-labelledby', 'ex-title');
      X.el.addEventListener('mouseenter', function () { clearTimeout(leaveTimer); });
      X.el.addEventListener('mouseleave', function () { if (!X.pinned) close(); });
    }
    if (X.el.parentNode !== parent) parent.appendChild(X.el); // inside an open dialog, or it would sit under it
    return X.el;
  }
  /** Put the card beside the thing it explains, inside the screen: above it if there is room, below it otherwise. */
  function place(anchor) {
    var el = X.el, a = anchor.getBoundingClientRect(), vw = window.innerWidth, vh = window.innerHeight, m = 10;
    el.style.left = '0px'; el.style.top = '0px';
    var w = el.offsetWidth, h = el.offsetHeight;
    var x = Math.max(m, Math.min(vw - w - m, a.left + a.width / 2 - w / 2));
    var above = a.top - h - 12, below = a.bottom + 12;
    var y = above >= m + 50 ? above : below + h <= vh - m ? below : Math.max(m, Math.min(vh - h - m, a.top > vh / 2 ? above : below));
    // a card that would cover its own anchor (a tall card on a short screen) moves to the side instead
    if (y < a.bottom && y + h > a.top) { var side = a.left > vw - a.right ? a.left - w - 12 : a.right + 12; if (side >= m && side + w <= vw - m) { x = side; y = Math.max(m, Math.min(vh - h - m, a.top + a.height / 2 - h / 2)); } }
    el.style.left = Math.round(x) + 'px'; el.style.top = Math.round(y) + 'px';
    el.dataset.side = y + h <= a.top ? 'above' : 'below';
  }

  function open(anchor, pin) {
    var key = anchor.dataset.term;
    if (!T[key]) return;
    clearTimeout(hoverTimer); clearTimeout(leaveTimer);
    var el = ensure(anchor.closest('dialog[open]') || document.body);
    el.innerHTML = body(key, anchor.dataset.note || '');
    el.classList.add('is-on'); el.classList.toggle('is-pinned', !!pin);
    if (X.anchor && X.anchor !== anchor) X.anchor.classList.remove('is-explained');
    X.open = key; X.anchor = anchor; anchor.classList.add('is-explained');
    place(anchor);
    if (pin && !X.pinned) {
      X.pinned = true;
      // a flight in progress waits while the player reads
      var K = RG.LevelKit;
      if (K && K.pause && K.pause(true, 'explain')) el.querySelector('.ex-pause').hidden = false;
      if (RG.Voice && RG.Voice.enabled()) RG.Voice.say(Terms.spoken(key), 'w_' + key);
    } else if (pin) {
      var K2 = RG.LevelKit;
      if (K2 && K2.paused) el.querySelector('.ex-pause').hidden = false;
      if (RG.Voice && RG.Voice.enabled()) RG.Voice.say(Terms.spoken(key), 'w_' + key);
    }
  }
  function close() {
    clearTimeout(hoverTimer); clearTimeout(leaveTimer);
    if (!X.open) return;
    if (X.el) X.el.classList.remove('is-on', 'is-pinned');
    if (X.anchor) X.anchor.classList.remove('is-explained');
    var wasPinned = X.pinned;
    X.open = null; X.anchor = null; X.pinned = false;
    if (wasPinned) {
      if (RG.Voice) RG.Voice.stop();
      if (RG.LevelKit && RG.LevelKit.pause) RG.LevelKit.pause(false, 'explain');
    }
  }
  X.close = close;
  X.show = function (anchor) { open(anchor, true); };

  /* ---------- wiring: one set of listeners for the whole page ---------- */
  document.addEventListener('click', function (e) {
    var inCard = e.target.closest && e.target.closest('#explain');
    if (inCard) {
      var b = e.target.closest('[data-ex]');
      if (b && b.dataset.ex === 'close') close();
      else if (b && b.dataset.ex === 'say' && RG.Voice) { if (!RG.Voice.say(Terms.spoken(X.open), 'w_' + X.open) && RG.Designer) RG.Designer.toast(RG.Voice.why()); }
      return;
    }
    var el = e.target.closest && e.target.closest('[data-term]');
    if (el && T[el.dataset.term]) {
      if (X.pinned && X.anchor === el) close(); else open(el, true);
      e.stopPropagation(); // the word is not also a button for whatever it sits on
      return;
    }
    if (X.open) close();
  }, true);
  // a mouse pointing at a word shows the card without pinning it; touch and pen wait for the tap
  document.addEventListener('pointerover', function (e) {
    if (e.pointerType !== 'mouse' || X.pinned) return;
    var el = e.target.closest && e.target.closest('[data-term]');
    if (!el || !T[el.dataset.term] || el === X.anchor) return;
    clearTimeout(hoverTimer); clearTimeout(leaveTimer);
    hoverTimer = setTimeout(function () { if (document.body.contains(el)) open(el, false); }, 320);
  });
  document.addEventListener('pointerout', function (e) {
    if (e.pointerType !== 'mouse' || X.pinned) return;
    var el = e.target.closest && e.target.closest('[data-term]');
    if (!el) return;
    clearTimeout(hoverTimer);
    leaveTimer = setTimeout(function () { if (!X.pinned) close(); }, 180);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && X.open) { var a = X.anchor; close(); if (a && a.focus) a.focus({ preventScroll: true }); e.stopPropagation(); return; }
    // things that are not real buttons (an instrument tile drawn as a div) still open with Enter or Space
    if ((e.key === 'Enter' || e.key === ' ') && e.target.dataset && e.target.dataset.term && e.target.tagName !== 'BUTTON') { e.preventDefault(); open(e.target, true); }
  }, true);
  window.addEventListener('resize', function () { if (X.open && X.anchor && document.body.contains(X.anchor)) place(X.anchor); else close(); });

  /* ---------- the whole list ---------- */
  function entry(key) {
    var e = T[key];
    return '<details class="gl-item" data-key="' + key + '" data-find="' + W.esc((e.t + ' ' + Terms.inline(key) + ' ' + e.s).toLowerCase()) + '"><summary><b>' + W.esc(e.t) + '</b><span>' + W.esc(e.s) + '</span></summary>' +
      '<p><i>Why it matters</i>' + W.esc(e.w) + '</p>' + (e.f ? '<p><i>Real life</i>' + W.esc(e.f) + '</p>' : '') +
      (RG.Voice && RG.Voice.canSay(Terms.spoken(key), 'w_' + key) ? '<button type="button" class="link gl-say" data-gl-say="' + key + '">Hear it</button>' : '') + '</details>';
  }
  X.glossary = function () {
    var keys = Object.keys(T);
    var html = Terms.groups.map(function (g) {
      var mine = keys.filter(function (k) { return T[k].g === g[0]; });
      return '<section class="gl-group"><h3>' + g[1] + ' <small>' + mine.length + '</small></h3>' + mine.map(entry).join('') + '</section>';
    }).join('');
    RG.App.openDialog('<h2 id="dialog-title">Space words</h2><p>Every technical word in the game: what it means, why it matters, and a real number. ' +
      'In the game, tap any word with a dotted line, or any instrument, to see the same thing.</p>' +
      '<p><label class="vh" for="gl-q">Search the words</label><input id="gl-q" class="code-box gl-q" type="search" placeholder="Search ' + keys.length + ' words: orbit, thrust, signal" autocomplete="off"></p>' +
      '<p class="gl-none" id="gl-none" hidden>No word matches. Try a shorter one.</p><div class="gl-list" id="gl-list">' + html + '</div>' +
      '<div class="actions"><button type="button" class="btn primary" data-act="close">Close</button></div>', function () { if (RG.Voice) RG.Voice.stop(); document.getElementById('dialog').classList.remove('is-words'); });
    document.getElementById('dialog').classList.add('is-words');
    var q = document.getElementById('gl-q');
    q.addEventListener('input', function () {
      var s = q.value.trim().toLowerCase(), any = false;
      Array.prototype.forEach.call(document.querySelectorAll('.gl-item'), function (d) { var hit = !s || d.dataset.find.indexOf(s) >= 0; d.hidden = !hit; if (hit) any = true; });
      Array.prototype.forEach.call(document.querySelectorAll('.gl-group'), function (g) { g.hidden = !g.querySelector('.gl-item:not([hidden])'); });
      document.getElementById('gl-none').hidden = any;
    });
    document.getElementById('gl-list').addEventListener('click', function (e) {
      var b = e.target.closest('[data-gl-say]');
      if (b && RG.Voice && !RG.Voice.say(Terms.spoken(b.dataset.glSay), 'w_' + b.dataset.glSay) && RG.Designer) RG.Designer.toast(RG.Voice.why());
    });
  };

  RG.Explain = X;
})();
