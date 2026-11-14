/* Balance helper: flies a set of reference designs and prints their scores.
 * Run with:  node tools/balance.js            (reference designs)
 *            node tools/balance.js sample 400 (random sample of launchable designs)
 */
require('../assets/nasa-fires.js'); require('../js/data.js'); require('../js/physics.js'); require('../js/model.js'); require('../js/sim.js');
const { DATA: D, Model: M, Sim, Score } = RG;

const base = { sensor: 'wide', extras: [], orbit: 'sso', bus: 'midi', panels: 'M', battery: 'M', computer: 'rad', pointing: 'wheels3', radio: 'xband', network: 'two', rocket: 'medium' };
const designs = {
  'classic polar': base,
  'classic + colour': { ...base, extras: ['color'] },
  'classic + all extras': { ...base, extras: ['color', 'smoke', 'lightning'] },
  'classic, smart computer, 1 station': { ...base, computer: 'ai', network: 'one' },
  'classic, basic brain, 1 station': { ...base, computer: 'basic', network: 'one' },
  'classic, small battery': { ...base, battery: 'S' },
  'classic, small wings': { ...base, panels: 'S' },
  'classic, magnets': { ...base, pointing: 'magnets' },
  'classic, small radio': { ...base, radio: 'sband' },
  'lean classic, shared ride': { ...base, rocket: 'rideshare' },
  'lean classic, spare wheel, shared': { ...base, pointing: 'wheels4', rocket: 'rideshare' },
  'lean, smart, spare, 1 station, shared': { ...base, pointing: 'wheels4', computer: 'ai', network: 'one', rocket: 'rideshare' },
  'low orbit wide, small rocket': { ...base, orbit: 'leo', network: 'four', rocket: 'small' },
  'cheap mini polar': { sensor: 'mini', extras: [], orbit: 'sso', bus: 'mini', panels: 'S', battery: 'S', computer: 'basic', pointing: 'magnets', radio: 'sband', network: 'two', rocket: 'rideshare' },
  'mini polar, tuned': { sensor: 'mini', extras: ['color'], orbit: 'sso', bus: 'mini', panels: 'M', battery: 'S', computer: 'ai', pointing: 'wheels3', radio: 'xband', network: 'two', rocket: 'rideshare' },
  'mini low, tuned': { sensor: 'mini', extras: ['color'], orbit: 'leo', bus: 'mini', panels: 'M', battery: 'S', computer: 'ai', pointing: 'wheels4', radio: 'xband', network: 'four', rocket: 'small' },
  'mini low orbit': { sensor: 'mini', extras: [], orbit: 'leo', bus: 'mini', panels: 'S', battery: 'S', computer: 'rad', pointing: 'wheels3', radio: 'sband', network: 'four', rocket: 'small' },
  'giant in far orbit': { sensor: 'giant', extras: ['lightning'], orbit: 'geo', bus: 'maxi', panels: 'L', battery: 'M', computer: 'rad', pointing: 'wheels4', radio: 'xband', network: 'one', rocket: 'heavy' },
  'giant in polar orbit': { sensor: 'giant', extras: [], orbit: 'sso', bus: 'maxi', panels: 'L', battery: 'L', computer: 'rad', pointing: 'wheels4', radio: 'xband', network: 'four', rocket: 'medium' },
  'wide in far orbit': { ...base, orbit: 'geo', rocket: 'medium' }
};

function fly(d, diff, seeds) {
  const out = [];
  for (const s of seeds) { const r = Sim.runAll(d, s); out.push({ r, sc: Score.compute(d, diff, r) }); }
  return out;
}
const pad = (s, n) => String(s).padEnd(n);

if (process.argv[2] === 'sample') {
  const N = +process.argv[3] || 300;
  const keys = (t) => Object.keys(D[t]);
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  for (const diff of ['cadet', 'engineer', 'chief']) {
    const hist = [0, 0, 0, 0]; let tried = 0, best = null;
    const t0 = Date.now();
    while (hist.reduce((a, b) => a + b) < N && tried < N * 400) {
      tried++;
      const d = { sensor: pick(keys('SENSORS')), extras: keys('EXTRAS').filter(() => Math.random() < 0.3), orbit: pick(keys('ORBITS')), bus: pick(keys('BUSES')), panels: pick(keys('PANELS')), battery: pick(keys('BATTERIES')), computer: pick(keys('COMPUTERS')), pointing: pick(keys('POINTING')), radio: pick(keys('RADIOS')), network: pick(keys('NETWORKS')), rocket: pick(keys('ROCKETS')) };
      if (M.evaluate(d, diff).blocked.length) continue;
      const sc = Score.compute(d, diff, Sim.runAll(d, 7));
      hist[sc.stars]++;
      if (!best || sc.total > best.sc.total) best = { d, sc };
    }
    console.log(diff, 'launchable share', (hist.reduce((a, b) => a + b) / tried * 100).toFixed(1) + '%', 'stars 0/1/2/3:', hist.join(' / '), 'best', best.sc.total, M.encode(best.d), JSON.stringify(best.d), ((Date.now() - t0) / 1000).toFixed(1) + 's');
  }
} else {
  const diff = process.argv[2] || 'engineer';
  console.log('difficulty:', diff, 'budget', D.DIFFICULTY[diff].budget);
  for (const [name, d] of Object.entries(designs)) {
    const ev = M.evaluate(d, diff);
    const runs = fly(d, diff, [1, 2, 3, 4, 5, 6]);
    const tot = runs.map((x) => x.sc.total);
    const a = runs[0];
    const c = a.r.counts, rs = a.r.reasons;
    console.log(pad(name, 36), 'cost', pad(ev.cost.toFixed(1), 6), 'kg', pad(Math.round(ev.mass), 5),
      ev.blocked.length ? 'BLOCKED(' + ev.blocked.map((b) => b.id).join(',') + ')' : pad('', 0),
      'score', tot.join(','), '| sci', a.sc.science.toFixed(0), 'bon', a.sc.bonus.toFixed(1), 'eff', a.sc.efficiency.toFixed(1), 'hl', a.sc.health.toFixed(1),
      '| fast/on/late/miss', [c.fast, c.onTime, c.late, c.missed].join('/'), '| notSeen', rs.notSeen, 'small', rs.tooSmall, 'off', rs.off, 'noLink', rs.noLink, 'del', rs.deleted,
      '| brown', a.r.stats.brownouts, 'lostGB', a.r.stats.dataLost.toFixed(0), 'avgH', a.r.avgDelayH == null ? '-' : a.r.avgDelayH.toFixed(1));
  }
}
