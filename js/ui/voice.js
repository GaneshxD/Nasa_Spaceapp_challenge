/* Orbit Ranger — the guide's voice.
 * Every line the guide says, and the explanation of every word in the "Space words" list, is a recording made with
 * Higgsfield's speech model (assets/voice, one MP3 each; tools/voice/README.md says how). A line's recording is
 * filed under a short code made from its spoken words (V.key), so the game finds it without a table of names:
 *   say(text, key)   plays the recording of exactly those words; failing that, the recording named `key`
 *                    (the 36 older clips); `key` may also be a list of recordings to play one after another
 *   w_<word>         the recording of a word's explanation (assets/voice/words, fetched when first asked for)
 * The words are always on screen as well, so nothing depends on hearing them. One line plays at a time. The Sound
 * button has three settings (sound and voice, sound only, off); the voice follows it. A line with no recording is
 * not spoken, unless RG.VOICE_FALLBACK is switched on in assets/voice/index.js: then the browser's own speech
 * reads it.
 */
(function () {
  'use strict';
  var RG = window.RG, V = { cur: null, voice: null };
  var synth = 'speechSynthesis' in window ? window.speechSynthesis : null;

  var LINES = {}, WORDS = {};
  (RG.VOICE_LINES || []).forEach(function (k) { LINES[k] = true; });
  (RG.VOICE_WORDS || []).forEach(function (k) { WORDS[k] = true; });
  function one(key) { return !!key && (!!(RG.VOICE_CLIPS && RG.VOICE_CLIPS[key]) || !!LINES[key] || (key.slice(0, 2) === 'w_' && !!WORDS[key.slice(2)])); }
  function src(key) { return key.slice(0, 2) === 'w_' ? 'assets/voice/words/' + key.slice(2) + '.mp3' : 'assets/voice/' + key + '.mp3'; }
  /** The name of the recording of a spoken line: 'g' and seven letters or digits made from its words. tools/voice/lines.js uses the same sum. */
  V.key = function (text) {
    var t = String(text).replace(/\s+/g, ' ').trim(), h = 2166136261;
    for (var i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); }
    return 'g' + ('000000' + (h >>> 0).toString(36)).slice(-7);
  };
  /** Is there a recording for this key? For a list of keys: for every one of them. */
  V.has = function (key) { return Array.isArray(key) ? key.length > 0 && key.every(one) : one(key); };
  V.can = function () { return !!synth; };
  V.enabled = function () { return RG.Audio.on && RG.Audio.voice; };
  V.stop = function () {
    if (V.cur) { try { V.cur.pause(); } catch (e) { /* already stopped */ } V.cur = null; }
    if (synth) { try { synth.cancel(); } catch (e) { /* some browsers throw before the first utterance */ } }
  };

  /**
   * Play a recorded line, or a list of them one after another. A new line cuts off the one before it.
   * Returns false if there is no such clip.
   */
  V.play = function (key) {
    if (!V.enabled() || !V.has(key)) return false;
    V.stop();
    var list = Array.isArray(key) ? key : [key];
    (function next(i) {
      var a = new Audio(src(list[i]));
      V.cur = a;
      if (i + 1 < list.length) a.addEventListener('ended', function () { if (V.cur === a) next(i + 1); });
      var p = a.play();
      if (p && p.catch) p.catch(function () { /* the browser wants a tap first; the words are on screen anyway */ });
    })(0);
    return true;
  };

  /* ---------- the browser's voice ---------- */
  var WANT = [/Google UK English Female/i, /Samantha/i, /Microsoft (Aria|Jenny|Sonia|Libby|Zira)/i, /Karen|Moira|Tessa|Serena|Fiona/i, /female/i, /Google US English/i];
  function pick() {
    if (!synth) return null;
    var all = synth.getVoices().filter(function (v) { return /^en/i.test(v.lang); });
    for (var i = 0; i < WANT.length; i++) for (var j = 0; j < all.length; j++) if (WANT[i].test(all[j].name)) return all[j];
    return all[0] || null;
  }
  if (synth && synth.addEventListener) synth.addEventListener('voiceschanged', function () { V.voice = pick(); });
  // Units and signs a speech engine stumbles over, written out the way a person would say them.
  var SAY = [[/−|–(?=\d)/g, ' minus '], [/(\d)\s*°C/g, '$1 degrees Celsius'], [/(\d)°/g, '$1 degrees'], [/km\/h/g, 'kilometres per hour'], [/km\/s/g, 'kilometres per second'],
    [/m\/s²/g, 'metres per second squared'], [/m\/s/g, 'metres per second'], [/(\d)\s*km\b/g, '$1 kilometres'], [/(\d)\s*kg\b/g, '$1 kilograms'], [/(\d)\s*kPa\b/g, '$1 kilopascals'],
    [/(\d)\s*m\b/g, '$1 metres'], [/(\d)\s*s\b/g, '$1 seconds'], [/(\d)\s*t\b/g, '$1 tonnes'], [/(\d)\s*g\b/g, '$1 g'], [/Δv/g, 'delta v'], [/T−(\d)/g, 'T minus $1'], [/[◀▶▲▼✓×]/g, ''],
    [/\bLOX\b/g, 'locks'], [/\bLH2\b/g, 'L H 2'], [/\bDOI\b/g, 'D O I'], [/\bLOS\b/g, 'L O S'], [/\bAOS\b/g, 'A O S'], [/\bTWR\b/g, 'T W R'], [/\bEVA\b/g, 'E V A'], [/\bMECO\b/g, 'mee-co']];
  function sayable(text) { var t = String(text); SAY.forEach(function (r) { t = t.replace(r[0], r[1]); }); return t.replace(/\s+/g, ' ').trim(); }

  /** Say any text with the browser's voice. */
  V.speak = function (text) {
    if (!V.enabled() || !synth || !text) return false;
    V.stop();
    try {
      var u = new SpeechSynthesisUtterance(sayable(text));
      V.voice = V.voice || pick();
      if (V.voice) { u.voice = V.voice; u.lang = V.voice.lang; } else u.lang = 'en-US';
      u.rate = 0.96; u.pitch = 1.08; u.volume = 1;
      synth.speak(u);
    } catch (e) { return false; }
    return true;
  };

  function best(text, key) { // which recording says this: a named list, the line's own, or the named one
    if (Array.isArray(key)) return V.has(key) ? key : null;
    var own = text ? V.key(text) : null;
    return own && LINES[own] ? own : V.has(key) ? key : null;
  }
  /** Is there anything to hear for this line? */
  V.canSay = function (text, key) { return !!best(text, key) || (!!RG.VOICE_FALLBACK && !!synth && !!text); };
  /** Say a line: its own recording, or the one named `key`. Returns false if nothing was played. */
  V.say = function (text, key) { return V.play(best(text, key)) || (!!RG.VOICE_FALLBACK && V.speak(text)); };
  /** Why nothing was heard, in words for the player. */
  V.why = function () { return V.enabled() ? 'There is no recording of this line.' : 'Voice is off. Use the Sound button to turn it on.'; };

  RG.Voice = V;
})();
