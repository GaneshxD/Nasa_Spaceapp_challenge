#!/usr/bin/env node
/* Orbit Ranger — every line the guide can say, and every word explanation, with the name of its recording.
 *   node tools/voice/lines.js            list the lines that still have no recording (and any line that cannot have one)
 *   node tools/voice/lines.js --json     write tools/voice/lines.json: [{ id, file, text, say }] for all of them
 *   node tools/voice/lines.js --index    rewrite assets/voice/index.js from the MP3 files that are there
 *
 * Where the lines come from:
 *   - the fixed words inside say(), tell() and once() calls in js/ui/levels/*.js. Live numbers must sit inside
 *     [[double brackets]] (shown, not spoken), so that what is spoken never changes;
 *   - source lines marked // @voice (cards kept in arrays), and the part and quiz lines of level 1;
 *   - the Moon sites, kit pieces and job lessons in js/core/lunar.js;
 *   - the 111 words in js/core/terms.js (id w_<key>, kept in assets/voice/words/).
 * `say` is the text sent to the speech model: the same words with units and abbreviations written out.
 * The id of a guide line is made from its spoken words by the same sum as RG.Voice.key in js/ui/voice.js.
 */
'use strict';
const fs = require('fs'), path = require('path'), root = path.join(__dirname, '..', '..');
['assets/moon-sites.js', 'js/core/terms.js', 'js/core/lunar.js'].forEach((f) => require(path.join(root, f)));
const RG = globalThis.RG, T = RG.TERMS, Terms = RG.Terms, L = RG.Lunar;
const LEVELS = ['kit.js', 'level1.js', 'level2.js', 'level3.js', 'level4.js', 'level6.js', 'coop.js', 'crewnet.js'].map((f) => 'js/ui/levels/' + f);
const VOICE = path.join(root, 'assets', 'voice');

function key(text) { const t = String(text).replace(/\s+/g, ' ').trim(); let h = 2166136261; for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); } return 'g' + ('000000' + (h >>> 0).toString(36)).slice(-7); }
function spoken(text) { return Terms.plain(text.replace(/\[\[[\s\S]*?\]\]/g, '')).replace(/\s+/g, ' ').trim(); }

// Units and abbreviations, written the way a person says them.
const SAY = [[/\s*\((N|kg|t|W|Wh|GB|Mbps|MW)\)/g, ''], [/\s*\(LOX\)/g, ', or lox'], [/\s*\(LH2\)/g, ', or L H 2'], [/\(program (\d+)\)/g, ', program $1'],
  [/−(?=\d)/g, 'minus '], [/(\d)\s*°C/g, '$1 degrees Celsius'], [/(\d)°/g, '$1 degrees'],
  [/km\/h/g, 'kilometres per hour'], [/km\/s/g, 'kilometres per second'], [/m\/s²/g, 'metres per second squared'], [/m\/s/g, 'metres per second'],
  [/(\d)\s*km\b/g, '$1 kilometres'], [/(\d)\s*kg\b/g, '$1 kilograms'], [/(\d)\s*kPa\b/g, '$1 kilopascals'], [/(\d)\s*cm\b/g, '$1 centimetres'],
  [/(\d)\s*MW\b/g, '$1 megawatts'], [/(\d)\s*GB\b/g, '$1 gigabytes'], [/(\d)\s*Mbps\b/g, '$1 megabits per second'], [/(\d)\s*Wh\b/g, '$1 watt-hours'], [/(\d)\s*W\b/g, '$1 watts'],
  [/(\d)\s*m\b/g, '$1 metres'], [/(\d)\s*s\b/g, '$1 seconds'], [/(\d)\s*t\b/g, '$1 tonnes'],
  [/\b1 (kilometre|kilogram|metre|second|tonne|watt)s\b/g, '1 $1'],
  [/\b1202\b/g, 'twelve oh two'], [/×/g, ' times '], [/Δv/g, 'delta v'], [/[◀▶▲▼✓]/g, ''], [/[“”"]/g, ''], [/…/g, '...'],
  [/written GB\b/g, 'written G B'], [/written Mbps\b/g, 'written M b p s'], [/written Wh\b/g, 'written W h'],
  [/\bLH2\b/g, 'L H 2'], [/\bDOI\b/g, 'D O I'], [/\bLOS\b/g, 'L O S'], [/\bAOS\b/g, 'A O S'], [/\bTWR\b/g, 'T W R'], [/\bEVA\b/g, 'E V A'], [/\bPLSS\b/g, 'P L S S'], [/\bthe LM\b/g, 'the LEM'],
  [/\bRS-25\b/g, 'R S 25'], [/\bRL10\b/g, 'R L 10'], [/\bSLS\b/g, 'S L S'], [/\bVIIRS\b/g, 'veers'], [/\bFIRMS\b/g, 'Firms'], [/\bMODIS\b/g, 'Moe-diss'], [/\bCAPCOM\b/g, 'Cap-com'], [/\bMECO\b/g, 'Mee-ko'], [/\bPAD\b/g, 'pad'],
  [/\bGB\b/g, 'G B'], [/\bMbps\b/g, 'megabits per second'], [/\bW\b(?=[.,])/g, 'W']];
function sayable(text) { let t = String(text); SAY.forEach((r) => { t = t.replace(r[0], r[1]); }); return t.replace(/\s+/g, ' ').replace(/\s+([.,!?:])/g, '$1').trim(); }

/* ---------- reading the level files ---------- */
function scan(file, add, bad) {
  const s = fs.readFileSync(path.join(root, file), 'utf8'), re = /(^|[^\w.$])(say|tell|once)\(/g; let m;
  const lineOf = (i) => s.slice(0, i).split('\n').length;
  while ((m = re.exec(s)) !== null) {
    if (/function\s+$/.test(s.slice(Math.max(0, m.index - 12), m.index + m[1].length))) continue; // the definition itself
    let i = m.index + m[0].length, depth = 0; const toks = [];
    for (; i < s.length; i++) {
      const c = s[i];
      if (c === "'" || c === '"') { let j = i + 1, v = ''; while (j < s.length && s[j] !== c) { if (s[j] === '\\') { v += s[j + 1]; j += 2; } else v += s[j++]; } toks.push({ t: 'str', v, d: depth }); i = j; continue; }
      if (c === '(' || c === '[' || c === '{') { depth++; toks.push({ t: 'dyn', v: c, d: depth }); continue; }
      if (c === ')' || c === ']' || c === '}') { if (depth === 0) break; depth--; continue; }
      if (/\s/.test(c)) continue;
      if (depth === 0 && (c === ',' || c === '?' || c === ':')) toks.push({ t: c });
      else if (c === '+') toks.push({ t: '+', d: depth });
      else { const l = toks[toks.length - 1]; if (l && l.t === 'dyn' && l.d === depth && !/[([{]/.test(l.v)) l.v += c; else toks.push({ t: 'dyn', v: c, d: depth }); }
    }
    const args = [[]]; toks.forEach((t) => { if (t.t === ',') args.push([]); else args[args.length - 1].push(t); });
    const last = args[args.length - 1];
    if (last.length === 1 && last[0].t === 'dyn' && last[0].v === 'false') continue; // a line that is never spoken
    args.forEach((arg) => {
      const segs = [[]]; arg.forEach((t) => { if (t.t === '?' || t.t === ':') segs.push([]); else segs[segs.length - 1].push(t); });
      segs.forEach((seg) => {
        let text = '', loose = false;
        seg.forEach((t) => {
          if (t.t === 'str' && t.d === 0) text += t.v;
          else if (t.t === 'dyn' || (t.t === 'str' && t.d > 0)) { const open = (text.match(/\[\[/g) || []).length - (text.match(/\]\]/g) || []).length; if (open <= 0 && text) loose = true; if (t.t === 'str' && /\s/.test(t.v) && t.v.length > 14 && open <= 0) loose = true; }
        });
        if (!/\s/.test(text) || text.replace(/\[\[[\s\S]*?\]\]/g, '').length < 8) return;
        if (loose) bad.push(file + ':' + lineOf(m.index) + '  ' + text.slice(0, 90)); else add(text, file);
      });
    });
  }
  // cards kept in arrays: every long piece of text on a line marked @voice
  s.split('\n').forEach((line) => { if (line.includes('// @voice')) (line.match(/'((?:[^'\\]|\\.)*)'/g) || []).forEach((q) => { const v = q.slice(1, -1); if (v.length >= (/crewnet/.test(file) ? 20 : 40) && /\s/.test(v)) add(v, file); }); });
}
function collect() {
  const lines = new Map(), bad = [];
  const add = (text, from) => { const sp = spoken(text); if (!sp) return; const id = key(sp); if (lines.has(id) && lines.get(id).text !== sp) throw new Error('two lines share the id ' + id); if (!lines.has(id)) lines.set(id, { id, file: id + '.mp3', text: sp, say: sayable(sp), from }); };
  LEVELS.forEach((f) => scan(f, add, bad));
  // level 1: what the guide says about each part, each quiz question, and why its answer is right
  const l1 = fs.readFileSync(path.join(root, 'js/ui/levels/level1.js'), 'utf8'), quiz = l1.slice(l1.indexOf('var QUIZ = ['), l1.indexOf('];', l1.indexOf('var QUIZ = [')));
  (l1.match(/\bsay: '((?:[^'\\]|\\.)*)'/g) || []).forEach((q) => add(q.slice(6, -1), 'level1.js parts'));
  (quiz.match(/\b(q|why): '((?:[^'\\]|\\.)*)'/g) || []).forEach((q) => add(q.replace(/^\w+: '/, '').slice(0, -1), 'level1.js quiz'));
  // level 6: lines made from the rules
  L.SITE_ORDER.forEach((id) => { const st = L.SITES[id]; add(st.mission + ', ' + st.year + '. ' + st.real, 'lunar.js sites'); });
  L.KIT_ORDER.forEach((id) => { const k = L.KIT[id]; add(k.blurb, 'lunar.js kit'); if (k.lesson) add(k.lesson, 'lunar.js lessons'); });
  const words = Object.keys(T).map((k) => ({ id: 'w_' + k, file: 'words/' + k + '.mp3', text: Terms.spoken(k), say: sayable(Terms.spoken(k)), from: 'terms.js' }));
  // two short clips played in front of a quiz answer
  const named = [{ id: 'yes', file: 'yes.mp3', text: 'Yes!', say: 'Yes!', from: 'level1.js' }, { id: 'notquite', file: 'notquite.mp3', text: 'Not quite.', say: 'Not quite.', from: 'level1.js' }];
  return { guide: [...lines.values()].concat(named), words, bad };
}
const have = (f) => fs.existsSync(path.join(VOICE, f));

if (require.main === module) {
  const all = collect(), arg = process.argv[2];
  if (arg === '--json') {
    fs.writeFileSync(path.join(__dirname, 'lines.json'), JSON.stringify(all.guide.concat(all.words), null, 1) + '\n');
    console.log('tools/voice/lines.json: ' + all.guide.length + ' guide lines, ' + all.words.length + ' words');
  } else if (arg === '--index') {
    require(path.join(VOICE, 'index.js'));
    const clips = Object.assign({}, RG.VOICE_CLIPS, { yes: 'Yes!', notquite: 'Not quite.' });
    Object.keys(clips).forEach((k) => { if (!have(k + '.mp3')) delete clips[k]; });
    const gl = all.guide.filter((x) => /^g/.test(x.id) && x.id.length === 8 && have(x.file)).map((x) => x.id), wl = all.words.filter((x) => have(x.file)).map((x) => x.id.slice(2));
    const fallback = process.argv.includes('--fallback');
    fs.writeFileSync(path.join(VOICE, 'index.js'), '/* Orbit Ranger — the guide\'s recordings. Written by tools/voice/lines.js --index; the words of every line are in\n * tools/voice/lines.json and tools/voice/README.md says how the recordings are made.\n * Voice: Higgsfield preset "Nadine", model Seed Audio 1.0. */\n(function (root) {\n  var RG = (root.RG = root.RG || {});\n' +
      '  // recordings with a name: the first clips of level 6, and two short ones used in front of a quiz answer\n  RG.VOICE_CLIPS = ' + JSON.stringify(clips, null, 4).replace(/\n/g, '\n  ') + ';\n' +
      '  // recordings of the guide\'s lines, named from their words (RG.Voice.key): assets/voice/<name>.mp3\n  RG.VOICE_LINES = \'' + gl.join(' ') + '\'.split(\' \');\n' +
      '  // recordings of word explanations: assets/voice/words/<word>.mp3, fetched when first asked for\n  RG.VOICE_WORDS = \'' + wl.join(' ') + '\'.split(\' \');\n' +
      '  // true: a line with no recording is read by the browser\'s own voice instead of staying silent\n  RG.VOICE_FALLBACK = ' + fallback + ';\n})(typeof window !== "undefined" ? window : globalThis);\n');
    console.log('assets/voice/index.js: ' + Object.keys(clips).length + ' named clips, ' + gl.length + ' of ' + (all.guide.length - 2) + ' guide lines, ' + wl.length + ' of ' + all.words.length + ' words, fallback ' + fallback);
  } else {
    const todo = all.guide.concat(all.words).filter((x) => !have(x.file));
    console.log(all.guide.length + ' guide lines and ' + all.words.length + ' words; ' + todo.length + ' have no recording yet');
    todo.forEach((x) => console.log('  ' + x.id + '  ' + x.text.slice(0, 96)));
    if (all.bad.length) { console.log('\nThese have live numbers outside [[ ]], so they cannot be recorded:'); all.bad.forEach((b) => console.log('  ' + b)); process.exitCode = 1; }
  }
}
module.exports = { collect, key, spoken, sayable };
