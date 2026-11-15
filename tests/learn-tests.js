/* Orbit Ranger — tests for the teaching layer and the things added with it:
 * the word list (js/core/terms.js), the Moon–Earth radio link and the deorbit burn (js/core/comm.js),
 * a Moon landing flown by someone who reacts late (js/core/lunar.js), the droppable fairing (js/core/flight.js),
 * the deorbit burn priced into the descent, and the two-player launch flown by scripted crews (js/core/crew.js).
 * Run: node tests/learn-tests.js
 */
'use strict';
const fs = require('fs'), path = require('path'), root = path.join(__dirname, '..');
['assets/moon-sites.js', 'js/core/terms.js', 'js/core/lunar.js', 'js/core/comm.js', 'js/core/flight.js', 'js/core/crew.js'].forEach((f) => require(path.join(root, f)));
const RG = globalThis.RG, L = RG.Lunar, C = RG.Comm, F = RG.Flight, T = RG.TERMS, Crew = RG.Crew;
let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log('  ok  ' + name); } catch (e) { failed++; console.log('  FAIL ' + name + '\n       ' + e.message); } }
function ok(c, msg) { if (!c) throw new Error(msg || 'expected true'); }
function near(a, b, tol, msg) { if (Math.abs(a - b) > tol) throw new Error((msg || '') + ' got ' + a + ', wanted ' + b + ' ± ' + tol); }
function walk(dir) { return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => d.isDirectory() ? walk(path.join(dir, d.name)) : d.name.endsWith('.js') ? [path.join(dir, d.name)] : []); }
function rng(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

console.log('Space words');
test('every word has a meaning, a reason and a group', () => {
  const groups = RG.Terms.groups.map((g) => g[0]), keys = Object.keys(T);
  ok(keys.length >= 100, 'only ' + keys.length + ' words');
  keys.forEach((k) => { const e = T[k]; ok(e.t && e.s && e.w, k + ' is missing its title, meaning or reason'); ok(groups.includes(e.g), k + ' has no group'); ok(/[.!?]$/.test(e.s) && /[.!?]$/.test(e.w), k + ' should end its sentences'); });
});
test('every word marked in the game is in the list', () => {
  const PLACEHOLDER = new Set(['h', 'vs', 'hs', 'tilt', 'slope', 'key']); // filled in with numbers, or written in a comment; not words
  const missing = new Set(), used = new Set();
  walk(path.join(root, 'js')).forEach((f) => {
    const src = fs.readFileSync(f, 'utf8'), rel = path.relative(root, f);
    if (rel === path.join('js', 'core', 'terms.js') || rel === path.join('js', 'ui', 'explain.js')) return;
    const res = [/\{([a-z0-9]+)(?:\|[^}'"`]*)?\}/g, /data-term="([a-z0-9]+)"/g, /\bterm\('([a-z0-9]+)'/g, /\brd\('[^']+', '([a-z0-9]+)'/g, /tankHtml\('[^']+', '[^']+', '[^']+', '([a-z0-9]+)'\)/g];
    res.forEach((re, i) => { let m; while ((m = re.exec(src)) !== null) { if (i === 0 && (PLACEHOLDER.has(m[1]) || !/[a-z]/.test(m[1]))) continue; used.add(m[1]); if (!T[m[1]]) missing.add(m[1] + ' (' + rel + ')'); } });
  });
  ok(!missing.size, 'not in js/core/terms.js: ' + [...missing].join(', '));
  ok(used.size >= 30, 'only ' + used.size + ' words are used in the levels');
});
test('markers turn back into plain words for speaking aloud', () => {
  ok(RG.Terms.plain('Drop the {booster|boosters} at the {karman}.') === 'Drop the boosters at the Kármán line.');
  ok(RG.Terms.spoken('thrust').startsWith('Thrust. The push'));
});

console.log('Talking to Earth, and the deorbit burn');
test('a radio signal takes about 1.3 seconds to cross from the Moon to Earth', () => { near(C.delay(), 1.28, 0.01); });
test('a 110 km orbit of the Moon takes about two hours at about 5,900 km/h', () => { const o = C.circ(110); near(o.period / 60, 118.8, 0.5); near(o.v * 3600, 5865, 20); });
test('about 46 minutes of each lap are spent hidden behind the Moon', () => { const s = C.shadow(110); near(s.seconds / 60, 46.3, 1); near(s.half, 70.1, 0.5); });
test('the Moon hides a lander only on the far side, inside its radio shadow', () => {
  const r = C.MOON_R + 110;
  ok(!C.hidden(0, r) && !C.hidden(90, r) && !C.hidden(270, r), 'in view on the near side and over the edges');
  ok(C.hidden(180, r) && C.hidden(120, r) && C.hidden(240, r), 'hidden behind');
  ok(!C.hidden(105, r) && !C.hidden(255, r), 'in view just before and after the shadow');
});
test('the deorbit burn is about 22 m/s and half a minute of engine, as on Apollo 11', () => {
  const d = C.doi(110, 15); near(d.dv, 21.6, 0.5); near(C.burnTime(d.dv, 15100), 29.4, 2); near(d.period / 60, 114.2, 0.5);
});
test('at every landing site the burn happens out of contact, and the low point is back in view', () => {
  L.SITE_ORDER.forEach((s) => {
    const p = new C.Pass(L.SITES[s].lon);
    ok(C.hidden(p.phiBurn, C.MOON_R + 110), s + ': burn at ' + p.phiBurn.toFixed(0) + '° is not behind the Moon');
    ok(!C.hidden(p.phiPdi, C.MOON_R + 15), s + ': the low point is hidden');
    ok(p.tBurn > p.tLos + 60, s + ': the burn comes after loss of signal');
  });
});
test('a pass runs in order: numbers sent up, loss of signal, burn, signal back, go', () => {
  const p = new C.Pass(L.SITES.apollo11.lon); let was = true;
  for (let i = 0; i < 400000 && !p.done; i++) { p.advance(0.5); if (p.armed() && p.toBurn() <= 0) p.ignite(); if (p.status === 'burning') was = was && !p.link().up; }
  ok(p.events.join(',') === 'pad,los,arm,ignite,cutoff,aos,go', p.events.join(','));
  ok(was, 'the burn was out of contact'); const r = p.result(); ok(r.onTime && r.cost === 0, 'on time costs nothing'); near(r.darkMin, 48, 2); near(p.orbit().peri, 15, 0.01);
});
test('a late burn costs landing propellant; a missed one is fired by the computer, later still', () => {
  near(C.cost(0.5), 0, 0); near(C.cost(-0.9), 0, 0); near(C.cost(5), 12, 0); near(C.cost(-5), 12, 0); near(C.cost(60), 18, 0);
  const p = new C.Pass(L.SITES.apollo15.lon);
  for (let i = 0; i < 400000 && !p.done; i++) p.advance(0.5);
  const r = p.result(); ok(r.byComputer && !r.onTime, 'the computer fired it'); near(r.err, C.BACKUP, 0.6); ok(r.cost === 18, 'cost ' + r.cost); near(r.shiftKm, C.BACKUP * 1.63, 1.5);
  const q = new C.Pass(0); ok(!q.ignite(), 'the engine cannot be fired in contact, long before the burn');
});

console.log('Landing on the Moon, with a late pair of hands');
/** A player who does what the arrows say, `delay` seconds after they change, and misses a share of the cues. */
function human(site, mode, seed, delay, kit) {
  const p = L.plan({ site, kit: kit || ['flag', 'rocks', 'mirror'], mode });
  const d = new L.Descent({ terrain: L.terrain(site), dry: L.DRY + p.kitKg, fuel: p.fuel, mode, seed });
  const r = rng(seed * 7 + 1); let thr = d.s.thr, queue = [], tilt = 0, eng = 0;
  for (let i = 0; i < 60 * 600 && d.status === 'fly'; i++) {
    if (i % 6 === 0) { const a = d.advice(); queue.push({ at: i + Math.round((delay + (r() - 0.5) * delay * 0.5) * 60), tilt: a.tilt, eng: a.engine }); }
    while (queue.length && queue[0].at <= i) { const q = queue.shift(); if (r() > 0.08) { tilt = q.tilt; eng = q.eng; } }
    thr = d.throttleStep(thr, eng, 1 / 60);
    d.step(1 / 60, { tilt, thr });
  }
  return d.result || { grade: 'crash', cause: 'timeout' };
}
function crashes(mode, delay, kit) {
  const bad = [];
  L.SITE_ORDER.forEach((s) => { for (let seed = 1; seed <= 6; seed++) { const r = human(s, mode, seed, delay, kit); if (r.grade === 'crash') bad.push(s + '#' + seed + ' ' + r.cause); } });
  return bad;
}
test('with the computer on the throttle, a player half a second late lands at every site', () => { const b = crashes('auto', 0.45); ok(!b.length, b.join(', ')); });
test('…and so does one nearly a second late, even carrying the heaviest kit', () => { const b = crashes('auto', 0.8, ['seismo', 'mirror', 'drill', 'flag']); ok(!b.length, b.join(', ')); });
test('with a hand on the throttle too, a player half a second late still lands at every site', () => { const b = crashes('manual', 0.45); ok(!b.length, b.join(', ')); });
test('the engine is lit and steering from the first second of the descent', () => {
  const d = new L.Descent({ terrain: L.terrain('apollo11'), dry: L.DRY, fuel: 500, mode: 'auto', seed: 3 });
  for (let i = 0; i < 60; i++) d.step(1 / 60, { tilt: 0 });
  ok(d.s.thr >= L.THR_MIN, 'throttle ' + d.s.thr.toFixed(2)); ok(d.s.vx < 45, 'it is already braking');
});
test('the plan reports a real propellant margin, thinnest at the mountain site with the heaviest kit', () => {
  const a = L.plan({ site: 'apollo11', kit: ['flag', 'rocks'], mode: 'auto' }), b = L.plan({ site: 'apollo17', kit: ['seismo', 'mirror', 'drill', 'flag'], mode: 'auto' });
  ok(a.margin > 0.3 && a.ok, 'easy plan margin ' + a.margin.toFixed(2)); ok(b.margin < a.margin && b.margin >= L.MARGIN_MIN, 'hard plan margin ' + b.margin.toFixed(2));
  ok(b.checks.some((c) => c.id === 'fuel' && c.level === 'watch'), 'the thin margin is flagged'); ok(a.checks.some((c) => c.id === 'fuel' && c.level === 'go'));
});
test('the autopilot setting lands by itself, and earns six tenths of the landing points', () => {
  const p = { site: 'apollo14', kit: ['flag', 'rocks'], mode: 'full' }, pl = L.plan(p);
  const d = new L.Descent({ terrain: L.terrain(p.site), dry: L.DRY + pl.kitKg, fuel: pl.fuel, mode: 'full', seed: 4 });
  for (let i = 0; i < 60 * 400 && d.status === 'fly'; i++) d.step(1 / 60, {});
  ok(d.status === 'landed', 'it ' + d.status);
  const mine = L.score(p, d.result, { done: {}, back: true, o2Frac: 1 }).parts.landing, auto = L.score(p, Object.assign({ byComputer: true }, d.result), { done: {}, back: true, o2Frac: 1 }).parts.landing;
  near(auto, mine * 0.6, 1);
  ok(L.encode(p) === 'MN-3-03-F' && L.decode('MN-3-03-F').mode === 'full', 'plan code keeps the setting');
});

console.log('The nose cone');
test('the fairing can only be dropped in space, and makes the rocket 2.5 t lighter', () => {
  const a = new F.Ascent({ tank: 'M', engines: 'E3', boosters: 'none' }); a.launch();
  ok(!a.dropFairing(), 'refused on the pad');
  for (let i = 0; i < 4000 && a.status === 'flying' && a.altKm() < 101; i++) a.step(0.5, 1, 0, true);
  ok(a.altKm() >= 100, 'reached ' + a.altKm().toFixed(0) + ' km');
  const m0 = a.mass(); ok(a.dropFairing(), 'accepted above 100 km'); near(m0 - a.mass(), 2500, 1); ok(!a.dropFairing(), 'only once');
  ok(a.events.includes('fairing-dropped'));
});

test('the words picked out of the hangar notes are all in the list', () => {
  const auto = RG.Terms.AUTO; ok(Object.keys(auto).length >= 30, 'only ' + Object.keys(auto).length);
  Object.keys(auto).forEach((p) => { ok(T[auto[p]], p + ' points at a word that is not in the list: ' + auto[p]); ok(p === p.toLowerCase(), p + ' should be written in small letters'); });
});

console.log('The orbit pass and the plan');
test('a mistimed deorbit burn is paid for in the descent: less propellant at the start, and still a landing at every site', () => {
  const late = new C.Pass(L.SITES.apollo11.lon);
  for (let i = 0; i < 400000 && !late.done; i++) { late.advance(0.25); if (late.armed() && late.toBurn() <= -5) late.ignite(); }
  const r = late.result(); near(r.err, 5, 0.3); ok(r.cost === 12 && !r.onTime && !r.byComputer, 'five seconds late costs 12 kg, got ' + r.cost);
  const worst = C.cost(C.BACKUP); ok(worst === 18, 'a missed burn costs ' + worst);
  L.SITE_ORDER.forEach((s) => {
    const kit = ['seismo', 'mirror', 'drill', 'flag'], p = L.plan({ site: s, kit, mode: 'full' }); // the heaviest kit that fits
    const land = (fuel) => { const d = new L.Descent({ terrain: L.terrain(s), dry: L.DRY + p.kitKg, fuel, mode: 'full', seed: 2 }); d.ev = { alarm: 0, boulders: false }; for (let i = 0; i < 60 * 400 && d.status === 'fly'; i++) d.step(1 / 60, {}); return d; };
    const a = land(p.fuel), b = land(p.fuel - worst);
    ok(a.status === 'landed' && b.status === 'landed', s + ': ' + a.status + ' / ' + b.status);
    near(b.fuel0, a.fuel0 - worst, 0.001); ok(b.result.fuel < a.result.fuel - 10, s + ': the cost shows at touchdown, ' + a.result.fuel.toFixed(0) + ' against ' + b.result.fuel.toFixed(0) + ' kg');
    ok(b.result.fuel > 0, s + ': still propellant left after the worst burn');
  });
});
test('a plan whose clean landing leaves under 5% of the propellant is a no-go, even though the kit fits', () => {
  // no shipped site is this hard, so make one: the Apollo 17 valley with its mountains five times taller
  RG.MOON_SITES.steep = RG.MOON_SITES.apollo17; L.SITES.steep = Object.assign({}, L.SITES.apollo17, { relief: 2600 });
  try {
    const p = L.plan({ site: 'steep', kit: ['seismo', 'mirror', 'drill', 'flag'], mode: 'auto' });
    ok(!p.over, 'the kit fits'); ok(p.margin < L.MARGIN_MIN, 'margin ' + p.margin.toFixed(3)); ok(!p.ok, 'the plan is refused');
    const c = p.checks.filter((x) => x.id === 'fuel')[0]; ok(c && c.level === 'nogo' && /at least 5%/.test(c.text), 'the reason is written out: ' + (c && c.text));
    const easy = L.plan({ site: 'apollo17', kit: ['seismo', 'mirror', 'drill', 'flag'], mode: 'auto' }); ok(easy.ok && easy.margin >= L.MARGIN_MIN, 'the real valley is a go, with ' + easy.margin.toFixed(2));
  } finally { delete L.SITES.steep; delete RG.MOON_SITES.steep; }
});

console.log('The launch crew: two players, two jobs');
/** A scripted crew. lag: how late the pilot reacts, s. sep: how long the engineer waits to drop the empty boosters, s. fair: how long after 100 km to drop the fairing (null: never). */
function crewFly(seed, o) {
  const c = new Crew.Launch(o.build, seed), s = c.sim, hist = [], said = [];
  c.liftoff();
  for (let i = 0; i < 60 * 200 && s.status === 'flying'; i++) {
    hist.push(s.err); const e = hist[Math.max(0, hist.length - 1 - Math.round(o.lag * 60))];
    c.step(1 / 60, Math.max(-1, Math.min(1, -e / 6)));
    if (s.boostersEmpty && s.boostersOn && s.dropWait >= o.sep) said.push('boosters ' + c.dropBoosters());
    if (o.fair != null && c.spaceAt != null && !s.fairingGone && s.play - c.spaceAt >= o.fair) { const r = c.dropFairing(); if (said[said.length - 1] !== 'fairing ' + r) said.push('fairing ' + r); }
  }
  return { crew: c, score: c.score(), said };
}
test('a crew that does both jobs well earns three stars at every wind', () => {
  [1, 2, 3, 4, 5, 6].forEach((seed) => {
    const sc = crewFly(seed, { lag: 0.25, sep: 0.5, fair: 1 }).score;
    ok(sc.ok && sc.stars === 3 && sc.pilot.stars === 3 && sc.engineer.stars === 3, 'seed ' + seed + ': ' + sc.stars + ' stars, pilot ' + sc.pilot.stars + ', engineer ' + sc.engineer.stars);
    ok(sc.engineer.sep === 'sharp' && sc.engineer.fairing === 'sharp' && sc.engineer.fairingKm >= F.FAIRING_MIN, 'both switches on time');
  });
});
test('the stars are for the two seats together: a slow engineer or a late pilot costs the crew one', () => {
  const slow = crewFly(3, { lag: 0.25, sep: 2, fair: 4 }).score;
  ok(slow.pilot.stars === 3 && slow.engineer.stars === 2 && slow.stars === 2, 'slow engineer: ' + slow.stars); ok(slow.engineer.sep === 'ok' && slow.engineer.fairing === 'ok');
  const idle = crewFly(3, { lag: 0.25, sep: 99, fair: null }), is = idle.score;
  ok(idle.crew.sim.dropLate && is.engineer.sep === 'late' && is.engineer.fairing === 'never' && is.engineer.stars === 1, 'an engineer who does nothing: the computer drops the boosters late, and the fairing stays on');
  ok(is.ok && is.stars < 3, 'the rocket still reaches space, with ' + is.stars + ' stars'); ok(/never dropped/.test(is.engineer.line) && /four seconds late/.test(is.engineer.line), is.engineer.line);
  const late = crewFly(2, { lag: 0.9, sep: 0.5, fair: 1 }).score;
  ok(late.engineer.stars === 3 && late.pilot.stars < 3 && late.stars < 3, 'late pilot: pilot ' + late.pilot.stars + ', crew ' + late.stars);
});
test('each seat needs the other: the boosters kick the nose, and the fairing waits for a steady rocket', () => {
  const c = new Crew.Launch(null, 5), s = c.sim; c.liftoff();
  ok(c.dropBoosters() === 'burning', 'a burning booster cannot be let go'); ok(c.dropFairing() === 'low', 'the fairing is refused in the air');
  while (s.status === 'flying' && !s.boostersEmpty) c.step(1 / 60, Math.max(-1, Math.min(1, -s.err / 6)));
  const before = s.err; ok(c.dropBoosters() === 'ok'); c.step(1 / 60, 0);
  near(Math.abs(s.err - before), Crew.KICK, 1.5, 'the kick'); ok(c.kickAt != null && c.dropBoosters() === 'gone');
  while (s.status === 'flying' && !s.reachedSpace) c.step(1 / 60, Math.max(-1, Math.min(1, -s.err / 6)));
  ok(s.altKm() >= F.FAIRING_MIN, 'in space');
  s.err = 15; ok(!c.steady() && c.dropFairing() === 'unsteady' && !s.fairingGone, 'refused while the needle is out of the green'); ok(c.tries.unsteady === 1 && c.tries.low === 1 && c.tries.burning === 1);
  s.err = 2; ok(c.steady() && c.dropFairing() === 'ok' && s.fairingGone, 'accepted once the pilot has it steady'); ok(c.dropFairing() === 'gone');
  c.step(1 / 60, 0); ok(c.events.includes('fairing-dropped') && c.events.includes('boosters-dropped') && c.events.includes('space'), c.events.join(','));
});
test('the crew flies the rocket built in level 2 with boosters added, unless that would leave the engineer no time', () => {
  ok(JSON.stringify(Crew.build(null)) === JSON.stringify(Crew.DEFAULT), 'no saved rocket: the standard one');
  const small = Crew.build({ tank: 'S', engines: 'E2', boosters: 'none' }); ok(small.tank === 'S' && small.engines === 'E2' && small.boosters === 'two', 'boosters are added');
  ok(Crew.rehearse(small).window >= Crew.WINDOW_MIN, 'with time between space and engine cut-off');
  const big = { tank: 'L', engines: 'E3', boosters: 'two' }; ok(Crew.rehearse(big).window < Crew.WINDOW_MIN, 'this one reaches space seconds before cut-off');
  ok(JSON.stringify(Crew.build(big)) === JSON.stringify(Crew.DEFAULT), 'so the standard rocket is flown instead');
  ok(JSON.stringify(Crew.build({ tank: 'S', engines: 'E4', boosters: 'none' })) === JSON.stringify(Crew.DEFAULT), 'and one that cannot reach space is replaced too');
});

console.log('The crew mission: four seats, one rocket, all the way to orbit');
/** Four scripted seats. o: lag (pilot, s), sep, fair, core (s after the cue; null or 99: never), nav: burn below this climb rate (0: never), dep (s; null: never). */
function fly4(seed, o) {
  const m = new Crew.Mission(o.build, seed), s = m.launch.sim, hist = []; m.liftoff();
  for (let i = 0; i < 60 * 400 && m.phase !== 'done' && m.phase !== 'fail'; i++) {
    hist.push(s.err); const e = hist[Math.max(0, hist.length - 1 - Math.round(o.lag * 60))];
    m.steer = e > 2.5 ? -1 : e < -2.5 ? 1 : 0;                       // a player holds a button: left, right or nothing
    if (m.phase === 'climb') { if (s.boostersEmpty && s.boostersOn && s.dropWait >= o.sep) m.act('boosters'); if (o.fair != null && m.launch.spaceAt != null && !s.fairingGone && s.play - m.launch.spaceAt >= o.fair) m.act('fairing'); }
    if (m.phase === 'staging' && m.coreWait >= o.core) m.act('separate');
    if (m.phase === 'coast' || m.phase === 'orbit') m.burn = !!o.nav && !m.ins.inOrbit && m.ins.s.vr < o.nav;
    if (m.phase === 'orbit' && o.dep != null && m.play - m.orbitAt >= o.dep) m.act('deploy');
    m.step(1 / 60);
  }
  return m;
}
const SHARP = { lag: 0.25, sep: 0.5, fair: 1, core: 0.8, nav: 80, dep: 1 };
test('a crew that does all four jobs reaches orbit with three stars', () => {
  [1, 2, 3, 4].forEach((seed) => {
    const m = fly4(seed, SHARP), sc = m.score();
    ok(m.phase === 'done' && sc.ok && sc.stars === 3, 'seed ' + seed + ': ' + m.phase + ' ' + m.why + ', ' + sc.stars + ' stars');
    Crew.SEATS.forEach((k) => ok(sc.seats[k].stars === 3 && sc.seats[k].line, k + ' ' + sc.seats[k].stars));
    ok(sc.orbit.periKm >= F.ORBIT_MIN && sc.orbit.apoKm - sc.orbit.periKm <= 120, 'a round orbit: ' + sc.orbit.periKm + ' by ' + sc.orbit.apoKm);
    ok(m.events.join(',') === 'liftoff,maxq,boosters-empty,boosters-dropped,space,fairing-dropped,meco,core-separated,burn-start,orbit,deployed', m.events.join(','));
  });
});
test('every seat matters: the computer covers an idle engineer or payload officer, late; nothing covers the navigator', () => {
  const idle = fly4(2, Object.assign({}, SHARP, { core: 99, dep: null, fair: null })), is = idle.score();
  ok(idle.phase === 'done' && idle.coreLate && idle.deployLate, 'the computer let the core stage go and released the satellite');
  near(idle.coreDelay, Crew.CORE_AUTO, 0.1); near(idle.deployDelay, Crew.DEPLOY_AUTO, 0.1);
  ok(is.seats.engineer.stars === 2 && is.seats.payload.stars === 1 && is.seats.pilot.stars === 3 && is.stars === 2, JSON.stringify(Crew.SEATS.map((k) => is.seats[k].stars)) + ' crew ' + is.stars);
  const noNav = fly4(2, Object.assign({}, SHARP, { nav: 0 })); ok(noNav.phase === 'fail' && noNav.why === 'fell' && noNav.score().stars === 0, 'no burn: ' + noNav.phase + ' ' + noNav.why);
  const early = fly4(2, Object.assign({}, SHARP, { nav: 900 })), es = early.score();
  ok(early.phase === 'done' && es.seats.navigator.stars === 1 && es.orbit.apoKm - es.orbit.periKm > 300, 'burning far from the top of the arc gives a lopsided orbit: ' + JSON.stringify(es.orbit));
});
test('the switches refuse what is not safe yet, and the upper stage cannot burn until the core stage is gone', () => {
  const m = new Crew.Mission(null, 3), s = m.launch.sim;
  ok(m.act('boosters') === 'pad' && m.act('separate') === 'burning' && m.act('deploy') === 'early', 'nothing works on the pad');
  m.liftoff(); ok(m.act('boosters') === 'burning' && m.act('fairing') === 'low' && m.act('nonsense') === 'unknown');
  while (m.phase === 'climb') { m.steer = s.err > 2.5 ? -1 : s.err < -2.5 ? 1 : 0; if (s.boostersEmpty && s.boostersOn) m.act('boosters'); m.step(1 / 60); }
  ok(m.phase === 'staging' && m.ins, 'main engine cut-off: ' + m.phase);
  m.burn = true; const prop = m.ins.prop; for (let i = 0; i < 30; i++) m.step(1 / 60);
  ok(!m.burning() && m.ins.prop === prop, 'holding the burn does nothing while the core stage is still on');
  ok(m.act('separate') === 'ok' && m.phase === 'coast' && m.act('separate') === 'gone');
  m.step(1 / 60); ok(m.burning() && m.ins.prop < prop, 'now it burns');
  const st = m.state(); ok(st.o && st.o.burning && st.c.st === 'meco' && JSON.stringify(st).length < 700, 'the picture sent to the players is small: ' + JSON.stringify(st).length + ' bytes');
});

console.log('\n' + passed + ' tests passed' + (failed ? ', ' + failed + ' FAILED' : ''));
process.exit(failed ? 1 : 0);
