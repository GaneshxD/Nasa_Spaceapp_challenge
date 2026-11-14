/* Orbit Ranger — tests for the physics, the design checker and the simulation.
 * No test framework needed:  node tests/run-tests.js
 */
const assert = require('node:assert/strict');
require('../assets/nasa-fires.js'); require('../js/data.js'); require('../js/physics.js'); require('../js/model.js'); require('../js/sim.js'); require('../js/flight.js');
const { DATA: D, Physics: P, Model: M, Sim, Score, Flight: F } = RG;

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ok  ' + name); }
  catch (e) { console.error('FAIL  ' + name + '\n      ' + e.message); process.exitCode = 1; }
}
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ''} expected about ${b}, got ${a}`);

const classic = { sensor: 'wide', extras: [], orbit: 'sso', bus: 'midi', panels: 'M', battery: 'M', computer: 'rad', pointing: 'wheels4', radio: 'xband', network: 'two', rocket: 'rideshare' };
const withPart = (o) => Object.assign({}, classic, o);

console.log('Physics');
test('a Space Station height orbit takes about 93 minutes', () => near(P.periodMin(420), 92.9, 0.5));
test('a geostationary lap matches one turn of the Earth (23 h 56 min)', () => {
  near(P.periodMin(35786), 1436, 1);
  near((2 * Math.PI) / P.EARTH_RATE, P.periodMin(35786), 1e-9);
});
test('low-orbit speed is about 7.6 km/s, far-orbit speed about 3.1 km/s', () => {
  near(P.speedKms(500), 7.61, 0.03); near(P.speedKms(35786), 3.07, 0.02);
});
test('a VIIRS-like scanner at 824 km sees a strip about 3,000 km wide', () => near(P.swathKm(824, 56.28), 3040, 60));
test('VIIRS-like pixels are about 375 m from 824 km', () => near(P.pixelMeters(824, 0.455e-3), 375, 5));
test('low orbits spend about a third of each lap in shadow; far orbit none in summer', () => {
  near(P.dayGeometry('leo').shadowFrac, 0.37, 0.03);
  near(P.dayGeometry('sso').shadowFrac, 0.36, 0.03);
  assert.equal(P.dayGeometry('geo').shadowFrac, 0);
});
test('McMurdo cannot see the tilted low orbit or the far orbit, but sees the polar orbit every lap', () => {
  assert.equal(P.dayGeometry('leo').contact.mcmurdo.minutes, 0);
  assert.equal(P.dayGeometry('geo').contact.mcmurdo.minutes, 0);
  assert.ok(P.dayGeometry('sso').contact.mcmurdo.passes >= 14);
});
test('lat/lon round trip', () => {
  const ll = P.vecToLatLon(P.latLonToVec(37.94, -75.46));
  near(ll.lat, 37.94, 1e-9); near(ll.lon, -75.46, 1e-9);
});
test('the polar orbit covers every fire zone; the far orbit only the Americas', () => {
  assert.equal(P.coverage('sso', 'wide').neverSeen.length, 0);
  assert.ok(P.coverage('leo', 'wide').neverSeen.includes('Siberia, Russia'));
  assert.equal(P.coverage('geo', 'giant').neverSeen.length, 11);
});

console.log('NASA data');
test('14 fire zones, each with 9 real FIRMS detections from 2023', () => {
  assert.equal(RG.NASA_FIRES.zones.length, 14);
  for (const z of RG.NASA_FIRES.zones) {
    for (const cls of ['small', 'medium', 'large']) {
      assert.equal(z.fires[cls].length, 3, z.name + ' ' + cls);
      for (const f of z.fires[cls]) {
        assert.match(f.date, /^2023-\d\d-\d\d$/);
        assert.ok(f.frp > 0 && Math.abs(f.lat) <= 90 && Math.abs(f.lon) <= 180);
        assert.ok(['Terra', 'Aqua'].includes(f.sat));
      }
    }
  }
});
test('fire sizes follow the heat MODIS measured', () => {
  for (const z of RG.NASA_FIRES.zones) {
    assert.ok(Math.max(...z.fires.small.map((f) => f.frp)) < Math.min(...z.fires.medium.map((f) => f.frp)), z.name);
    assert.ok(Math.max(...z.fires.medium.map((f) => f.frp)) < Math.min(...z.fires.large.map((f) => f.frp)), z.name);
  }
});
test('every fire flown in a mission is one of those real detections', () => {
  for (const f of Sim.runAll(classic, 9).fires) {
    const pool = RG.NASA_FIRES.zones[f.zone].fires[f.size];
    assert.ok(pool.some((r) => r.lat === f.lat && r.lon === f.lon && r.date === f.seenOn && r.frp === f.frp));
  }
});
test('every ground station is a NASA Near Space Network site', () => {
  assert.deepEqual(Object.keys(D.STATIONS).sort(), ['alaska', 'mcmurdo', 'wallops', 'whitesands']);
});

console.log('Design checker');
test('the reference design has no blockers on Engineer', () => {
  const ev = M.evaluate(classic, 'engineer');
  assert.equal(ev.blocked.length, 0);
  assert.equal(Math.round(ev.mass), 312);
  near(ev.cost, 68.5, 0.01);
});
test('a giant telescope does not fit a mini body', () => {
  const ev = M.evaluate(withPart({ sensor: 'giant', bus: 'mini' }), 'sandbox');
  assert.ok(ev.blocked.some((c) => c.id === 'payloadFit'));
});
test('a shared ride cannot reach low or far orbit', () => {
  for (const orbit of ['leo', 'geo']) {
    assert.ok(M.evaluate(withPart({ orbit }), 'sandbox').blocked.some((c) => c.id === 'rocketReach'));
  }
});
test('one bonus tool makes the satellite too heavy for the shared ride', () => {
  assert.ok(M.evaluate(withPart({ extras: ['color'] }), 'engineer').blocked.some((c) => c.id === 'rocketMass'));
});
test('the budget blocks on Chief but never in Sandbox', () => {
  const pricey = withPart({ rocket: 'heavy' });
  assert.ok(M.evaluate(pricey, 'chief').blocked.some((c) => c.id === 'budget'));
  assert.equal(M.evaluate(pricey, 'sandbox').blocked.length, 0);
});
test('a small battery and small wings are flagged', () => {
  const ev = M.evaluate(withPart({ battery: 'S', panels: 'S' }), 'engineer');
  assert.ok(ev.watch.some((c) => c.id === 'battery'));
  assert.ok(ev.watch.some((c) => c.id === 'powerGen'));
});
test('an unfinished design can still be evaluated', () => {
  const ev = M.evaluate(RG.blankDesign(), 'engineer');
  assert.equal(ev.mass, 0); assert.equal(ev.cost, D.MISSION.opsCost);
});
test('mission codes round-trip', () => {
  const d = withPart({ extras: ['color', 'lightning'] });
  assert.deepEqual(M.decode(M.encode(d)), d);
  assert.equal(M.decode('nonsense'), null);
});

console.log('Mission simulation');
test('the same mission number always gives the same result', () => {
  const a = Sim.runAll(classic, 42), b = Sim.runAll(classic, 42);
  assert.deepEqual(a.counts, b.counts); assert.deepEqual(a.stats, b.stats);
});
test('every fire is accounted for: 14 zones × 3 years', () => {
  const c = Sim.runAll(classic, 3).counts;
  assert.equal(c.total, 42);
  assert.equal(c.fast + c.onTime + c.late + c.missed, 42);
});
test('the reference design earns three stars whatever the surprises', () => {
  for (let seed = 1; seed <= 8; seed++) {
    const sc = Score.compute(classic, 'engineer', Sim.runAll(classic, seed));
    assert.equal(sc.stars, 3, 'seed ' + seed + ' scored ' + sc.total);
  }
});
test('a wide scanner in far orbit is too blurry to find anything', () => {
  const d = withPart({ orbit: 'geo', rocket: 'medium' });
  assert.equal(Sim.runAll(d, 1).counts.missed, 42);
});
test('a small battery runs flat in the shadow', () => {
  assert.ok(Sim.runAll(withPart({ battery: 'S' }), 1).stats.brownouts > 0);
  assert.equal(Sim.runAll(classic, 1).stats.brownouts, 0);
});
test('a slow radio leaves warnings stuck on board', () => {
  const r = Sim.runAll(withPart({ radio: 'sband' }), 1);
  assert.ok(r.reasons.noLink > 20);
});
test('a slow radio with a small memory overflows and deletes pictures', () => {
  const r = Sim.runAll(withPart({ radio: 'sband', computer: 'basic' }), 1);
  assert.ok(r.stats.dataLost > 0);
  assert.equal(Sim.runAll(classic, 1).stats.dataLost, 0);
});
test('the smart computer still warns firefighters with a slow radio', () => {
  const r = Sim.runAll(withPart({ radio: 'sband', computer: 'ai' }), 1);
  assert.ok(r.counts.fast + r.counts.onTime >= 35);
});
test('magnetic steering blurs the wide scanner so small fires are missed', () => {
  assert.ok(Sim.runAll(withPart({ pointing: 'magnets' }), 1).reasons.tooSmall >= 15);
});
test('a spare wheel survives the wheel failure; three wheels do not', () => {
  let saw = false;
  for (let seed = 1; seed <= 12 && !saw; seed++) {
    const three = Sim.runAll(withPart({ pointing: 'wheels3' }), seed).events.find((e) => e.key === 'wheel');
    if (!three) continue;
    saw = true;
    assert.equal(three.ok, false);
    assert.equal(Sim.runAll(classic, seed).events.find((e) => e.key === 'wheel').ok, true);
  }
  assert.ok(saw, 'no seed produced a wheel failure');
});
test('scores stay between 0 and 100 and the debrief always has something to say', () => {
  const designs = [classic, withPart({ battery: 'S', panels: 'S' }), withPart({ orbit: 'geo', rocket: 'heavy', sensor: 'giant', bus: 'maxi', panels: 'L' })];
  for (const d of designs) {
    const res = Sim.runAll(d, 5), sc = Score.compute(d, 'sandbox', res), db = Score.debrief(d, 'sandbox', res, sc);
    assert.ok(sc.total >= 0 && sc.total <= 100);
    assert.ok(db.good.length + db.fix.length > 0);
  }
});

console.log('Rocket flight (levels 2 to 4)');
const rocket = (tank, engines, boosters) => ({ tank, engines, boosters });
test('engine numbers are NASA’s RS-25: 452 s, six parts oxygen to one part hydrogen', () => {
  assert.equal(F.RS25.isp, 452); assert.equal(F.MIX, 6);
  const ev = F.evaluate(rocket('M', 'E3', 'none'));
  near(ev.lox / ev.lh2, 6, 1e-9);
  near(ev.lox + ev.lh2, F.TANKS.M.prop, 1e-9);
});
test('a rocket lifts off only when its push beats its weight', () => {
  assert.ok(F.evaluate(rocket('M', 'E3', 'none')).tw > 1.15);
  assert.ok(F.evaluate(rocket('L', 'E2', 'none')).tw < 1);
  const r = F.testFlight(rocket('L', 'E2', 'none'));
  assert.equal(r.ok, false); assert.equal(r.failWhy, 'fell');
});
test('medium tanks with three engines reach space with speed to spare', () => {
  const r = F.testFlight(rocket('M', 'E3', 'none'));
  assert.equal(r.ok, true);
  assert.ok(r.apoKm > 180 && r.apoKm < 260, 'arc tops out near 200 km, got ' + r.apoKm);
});
test('small tanks alone are too slow; small tanks with boosters make it', () => {
  assert.equal(F.testFlight(rocket('S', 'E2', 'none')).ok, false);
  assert.equal(F.testFlight(rocket('S', 'E2', 'two')).ok, true);
});
test('at least three different rockets pass inside the level 2 budget', () => {
  let n = 0;
  for (const t of Object.keys(F.TANKS)) for (const e of Object.keys(F.ENGINES)) for (const b of Object.keys(F.BOOSTERS)) {
    const k = rocket(t, e, b);
    if (F.evaluate(k).cost <= F.BUDGET && F.testFlight(k).ok) n++;
  }
  assert.ok(n >= 3, 'only ' + n);
});
test('a circular orbit 200 km up takes about 88 minutes', () => {
  const r = F.RE + 200e3, el = F.elements({ r, vr: 0, vt: Math.sqrt(F.MU / r) });
  near(el.e, 0, 1e-6); near(el.periodMin, 88.5, 0.5); near(el.circNeed, 0, 1e-6);
});
test('coasting to the top of the arc and burning sideways makes an orbit', () => {
  const ins = new F.Insertion(F.testFlight(rocket('M', 'E3', 'none')).state);
  for (let i = 0; i < 4000 && ins.s.vr > 40; i++) ins.step(1, false);
  for (let i = 0; i < 4000 && !ins.inOrbit && ins.prop > 0; i++) ins.step(0.25, true);
  const r = ins.result();
  assert.equal(r.ok, true);
  assert.ok(r.periKm >= F.ORBIT_MIN && r.periodMin > 86 && r.periodMin < 92);
  assert.ok(r.fuelLeft > 0.2);
});
test('without the burn the rocket falls back into the air', () => {
  const ins = new F.Insertion(F.testFlight(rocket('M', 'E3', 'none')).state);
  for (let i = 0; i < 6000 && ins.status !== 'fail'; i++) ins.step(1, false);
  assert.equal(ins.status, 'fail');
});

console.log(`\n${passed} tests passed` + (process.exitCode ? ', some failed' : ''));
