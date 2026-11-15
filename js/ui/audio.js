/* Orbit Ranger — sound.
 * Every sound is made on the spot with the Web Audio API, so there are no
 * audio files to load. Sound starts switched on and can be muted from the top bar.
 */
(function () {
  'use strict';
  var RG = window.RG;
  // mode: 'on' sound effects and the guide's voice · 'fx' sound effects only · 'off' silent
  var A = { on: true, voice: true, mode: 'on', ctx: null };
  var rumble = null;
  function setMode(m) { A.mode = m === 'off' || m === 'fx' ? m : 'on'; A.on = A.mode !== 'off'; A.voice = A.mode === 'on'; }

  try { setMode(localStorage.getItem('orbit-ranger.sound')); } catch (e) { /* private mode */ }

  function ctx() {
    if (!A.ctx) {
      var C = window.AudioContext || window.webkitAudioContext;
      if (!C) return null;
      A.ctx = new C();
    }
    if (A.ctx.state === 'suspended') A.ctx.resume();
    return A.ctx;
  }

  function tone(freq, start, len, type, gain, slideTo) {
    var c = ctx(); if (!c) return;
    var o = c.createOscillator(), g = c.createGain(), t = c.currentTime + start;
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + len);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain || 0.12, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(g); g.connect(c.destination);
    o.start(t); o.stop(t + len + 0.02);
  }

  var SOUNDS = {
    tap: function () { tone(520, 0, 0.06, 'triangle', 0.06); },
    pick: function () { tone(440, 0, 0.09, 'triangle', 0.1); tone(660, 0.07, 0.12, 'triangle', 0.1); },
    drop: function () { tone(420, 0, 0.1, 'triangle', 0.08, 300); },
    warn: function () { tone(220, 0, 0.16, 'square', 0.05); tone(196, 0.16, 0.2, 'square', 0.05); },
    go: function () { tone(523, 0, 0.1, 'sine', 0.12); tone(784, 0.1, 0.18, 'sine', 0.12); },
    count: function () { tone(440, 0, 0.14, 'sine', 0.14); },
    fire: function () { tone(180, 0, 0.18, 'sawtooth', 0.035, 120); },
    spotted: function () { tone(880, 0, 0.07, 'sine', 0.07); tone(1175, 0.07, 0.1, 'sine', 0.07); },
    alert: function () { tone(659, 0, 0.09, 'sine', 0.09); tone(880, 0.09, 0.09, 'sine', 0.09); tone(1319, 0.18, 0.2, 'sine', 0.09); },
    bad: function () { tone(300, 0, 0.25, 'sawtooth', 0.06, 110); },
    star: function () { tone(784, 0, 0.12, 'triangle', 0.12); tone(988, 0.1, 0.12, 'triangle', 0.12); tone(1319, 0.2, 0.3, 'triangle', 0.12); }
  };

  A.play = function (name) {
    if (!A.on || !SOUNDS[name]) return;
    try { SOUNDS[name](); } catch (e) { /* audio is a nice-to-have */ }
  };

  /** Rocket engines: filtered noise that swells and fades. */
  A.rumble = function (seconds) {
    if (!A.on) return;
    var c = ctx(); if (!c) return;
    A.stopRumble();
    var buf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate), d = buf.getChannelData(0);
    for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    var src = c.createBufferSource(); src.buffer = buf; src.loop = true;
    var lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 380;
    var g = c.createGain(), t = c.currentTime;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.5, t + 1.2);
    g.gain.exponentialRampToValueAtTime(0.0001, t + seconds);
    lp.frequency.exponentialRampToValueAtTime(140, t + seconds);
    src.connect(lp); lp.connect(g); g.connect(c.destination);
    src.start(t); src.stop(t + seconds + 0.1);
    rumble = src;
  };
  A.stopRumble = function () {
    if (rumble) { try { rumble.stop(); } catch (e) { /* already stopped */ } rumble = null; }
  };

  /** Step to the next setting: sound and voice → sound only → off → sound and voice. Returns the new mode. */
  A.toggle = function () {
    setMode(A.mode === 'on' ? 'fx' : A.mode === 'fx' ? 'off' : 'on');
    if (!A.on) A.stopRumble();
    try { localStorage.setItem('orbit-ranger.sound', A.mode); } catch (e) { /* private mode */ }
    return A.mode;
  };
  A.LABEL = { on: 'Sound and voice on', fx: 'Sound on, voice off', off: 'Sound off' };

  RG.Audio = A;
})();
