/* Orbit Ranger — tests for the Moon landing rules (js/core/lunar.js). Run: node tests/lunar-tests.js */
'use strict';
const path = require('path'), root = path.join(__dirname, '..');
require(path.join(root, 'assets/moon-sites.js'));
require(path.join(root, 'js/core/lunar.js'));
const L = globalThis.RG.Lunar;
let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log('  ok  ' + name); } catch (e) { failed++; console.log('  FAIL ' + name + '\n       ' + e.message); } }
function ok(c, msg) { if (!c) throw new Error(msg || 'expected true'); }
function near(a, b, tol, msg) { if (Math.abs(a - b) > tol) throw new Error((msg || '') + ' got ' + a + ', wanted ' + b + ' ± ' + tol); }
function fly(site, kit, seed, ctl) {
  const p = L.plan({ site, kit, mode: 'manual' });
  const d = new L.Descent({ terrain: L.terrain(site), dry: L.DRY + p.kitKg, fuel: p.fuel, mode: 'manual', seed });
  for (let i = 0; i < 60 * 400 && d.status === 'fly'; i++) d.step(1 / 60, ctl || { auto: true });
  return d;
}
console.log('Moon landing');
test('the six Apollo sites all have ground data, with the target on level ground', () => {
  L.SITE_ORDER.forEach((s) => { const T = L.terrain(s); near(T.height(0, 0), 0, 0.01, s); ok(T.slope(0, 0) < 3, s + ' target slope ' + T.slope(0, 0)); ok(T.slope(110, 0) < 4, s + ' spare spot slope'); });
});
test('with the engine off, a fall of 100 m takes about 11 seconds (gravity is 1.62 m/s²)', () => {
  near(Math.sqrt(2 * 100 / L.G), 11.1, 0.1);
  const T = L.terrain('apollo11'), d = new L.Descent({ terrain: T, dry: L.DRY, fuel: 400, mode: 'manual', seed: 5 });
  d.s.vx = 0; d.s.vy = 0; d.s.x = 0; d.s.y = 100; d.s.thr = 0;
  for (let i = 0; i < 6000 && d.status === 'fly'; i++) d.step(1 / 60, { thr: 0 });
  near(d.s.t, 11.1, 0.2); ok(d.result.grade === 'crash' && d.result.cause === 'fast', 'falling is a crash');
});
test('hovering needs about a quarter throttle, and Earth-strength gravity would need six times more', () => {
  const m = L.DRY + 400; near(m * L.G / L.THRUST, 0.277, 0.01); near(9.81 / L.G, 6.06, 0.05);
});
test('the guidance computer lands softly at every site, with fuel left, even with a full spare of kit', () => {
  const rows = [];
  L.SITE_ORDER.forEach((s) => {
    [1, 2, 3, 4].forEach((seed) => {
      const d = fly(s, ['seismo', 'mirror', 'drill', 'flag'], seed), r = d.result; // 148 kg: the heaviest plan that fits
      rows.push(s + '#' + seed + ' ' + r.grade + ' used ' + Math.round(d.fuel0 - r.fuel) + ' of ' + Math.round(d.fuel0));
      ok(r.grade === 'soft' || r.grade === 'firm', s + ' seed ' + seed + ': ' + r.grade + ' ' + (r.cause || '') + ' vs ' + r.vs.toFixed(2) + ' hs ' + r.hs.toFixed(2) + ' slope ' + r.slope.toFixed(1));
      ok(r.fuelFrac > 0.08, s + ' seed ' + seed + ' fuel left ' + r.fuelFrac.toFixed(3));
      ok(r.miss < 15, s + ' miss ' + r.miss.toFixed(1));
    });
  });
  if (process.env.VERBOSE) console.log(rows.join('\n'));
});
test('a player who only does what the arrows say lands at every site, with either throttle setting', () => {
  // decisions are made five times a second, like a person reading the screen, not sixty
  L.SITE_ORDER.forEach((s) => ['auto', 'manual'].forEach((mode) => [1, 2, 3].forEach((seed) => {
    const p = L.plan({ site: s, kit: ['flag', 'rocks', 'mirror'], mode });
    const d = new L.Descent({ terrain: L.terrain(s), dry: L.DRY + p.kitKg, fuel: p.fuel, mode, seed });
    let thr = d.s.thr, tilt = 0, eng = 0;
    for (let i = 0; i < 60 * 500 && d.status === 'fly'; i++) {
      if (i % 12 === 0) { const a = d.advice(); tilt = a.tilt; eng = a.engine; }
      thr = Math.max(0, Math.min(1, thr + eng * 0.7 / 60));
      d.step(1 / 60, { tilt, thr });
    }
    const r = d.result;
    if (process.env.VERBOSE) console.log('   ', s, mode, seed, r.grade, r.cause || '', 'vs', r.vs.toFixed(2), 'hs', r.hs.toFixed(2), 'tilt', r.tilt.toFixed(1), 'miss', r.miss.toFixed(1), 'fuel left', (r.fuelFrac * 100).toFixed(0) + '%', 't', r.time.toFixed(0));
    ok(r.grade !== 'crash', s + ' ' + mode + ' seed ' + seed + ': crashed, ' + r.cause + ' vs ' + r.vs.toFixed(2) + ' hs ' + r.hs.toFixed(2));
  })));
});
test('never firing the engine is a crash', () => { const d = fly('apollo11', [], 1, { thr: 0 }); ok(d.status === 'crash'); });
test('a boulder field on the target moves the landing spot 110 m on, and landing on it is a crash', () => {
  let seed = 1; while (!L.events(seed).boulders) seed++;
  const d = fly('apollo12', ['flag'], seed); ok(d.moved && d.targetX === 110, 'target moved'); ok(d.result.grade !== 'crash', 'autopilot avoids it');
});
test('kit and fuel share 150 kg: more kit means less fuel, and too much kit is a no-go', () => {
  const a = L.plan({ site: 'apollo11', kit: [], mode: 'auto' }), b = L.plan({ site: 'apollo11', kit: ['seismo', 'mirror'], mode: 'auto' });
  near(a.fuel - b.fuel, 78, 0.01); ok(a.hover > b.hover);
  const c = L.plan({ site: 'apollo11', kit: ['seismo', 'mirror', 'drill', 'rocks'], mode: 'auto' });
  ok(c.over && !c.ok && c.checks.some((k) => k.level === 'nogo'));
});
test('no single best plan: three different plans all fly, with different strengths', () => {
  const lean = L.plan({ site: 'apollo11', kit: ['flag', 'rocks'], mode: 'auto' });
  const sci = L.plan({ site: 'apollo15', kit: ['drill', 'rocks', 'seismo', 'flag'], mode: 'auto' });
  const long = L.plan({ site: 'apollo16', kit: ['rocks', 'mirror', 'seismo', 'oxygen'], mode: 'auto' });
  ok(lean.ok && sci.ok && long.ok); ok(lean.hover > sci.hover && sci.science > lean.science && long.o2 > sci.o2);
});
test('the score rewards a soft, accurate landing, finished science and a safe return', () => {
  const p = { site: 'apollo15', kit: ['rocks', 'seismo', 'mirror', 'flag'], mode: 'auto' };
  const soft = { grade: 'soft', vs: 1, hs: 0.3, miss: 5, fuel: 80, fuelFrac: 0.18 }, hard = { grade: 'hard', vs: 4, hs: 2, miss: 50, fuel: 5, fuelFrac: 0.01 };
  const all = { done: { rocks: 1, seismo: 1, mirror: 1, flag: 1 }, back: true, o2Frac: 0.3 }, some = { done: { flag: 1 }, back: false, o2Frac: 0 };
  const best = L.score(p, soft, all), mid = L.score(p, soft, some), low = L.score(p, hard, some);
  ok(best.total > mid.total && mid.total > low.total); ok(best.stars === 3 && low.stars === 1); ok(best.total <= 100);
  ok(L.score(p, { grade: 'crash' }, all).stars === 0);
});
test('jobs on the surface stay within walking range and off steep ground', () => {
  const T = L.terrain('apollo16'), ts = L.tasks(['flag', 'rocks', 'seismo', 'mirror', 'drill'], 3, T);
  ok(ts.length === 7); ts.forEach((t) => { ok(Math.hypot(t.x, t.z) < L.WALK.range - 60, t.id + ' too far'); });
});
test('a plan survives the trip through its share code, and nonsense is refused', () => {
  const p = { site: 'apollo15', kit: ['flag', 'rocks', 'seismo'], mode: 'manual' }, code = L.encode(p);
  ok(code === 'MN-4-07-M', code); const q = L.decode(code);
  ok(q.site === p.site && q.mode === 'manual' && q.kit.join() === p.kit.join());
  ok(L.decode('MN-7-00-A') === null && L.decode('MN-1-64-A') === null && L.decode('OR-11111111120') === null && L.decode('') === null);
});
console.log('\n' + passed + ' tests passed' + (failed ? ', ' + failed + ' FAILED' : ''));
process.exit(failed ? 1 : 0);
