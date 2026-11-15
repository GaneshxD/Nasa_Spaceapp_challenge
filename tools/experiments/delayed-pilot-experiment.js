// How robust is the Moon landing to a human? Reaction delay, missed cues, and doing nothing at all.
const path = require('path'), root = path.join(__dirname, '..', '..');
require(path.join(root, 'assets/moon-sites.js')); require(path.join(root, 'js/core/lunar.js'));
const L = globalThis.RG.Lunar;
function rng(a){return function(){a|=0;a=(a+0x6D2B79F5)|0;var t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296}}
function run(site, mode, seed, o, kit) {
  const p = L.plan({ site, kit: kit || ['flag', 'rocks', 'mirror'], mode });
  const d = new L.Descent({ terrain: L.terrain(site), dry: L.DRY + p.kitKg, fuel: p.fuel, mode, seed });
  const r = rng(seed * 7 + 1); let thr = d.s.thr, queue = [], tilt = 0, eng = 0;
  for (let i = 0; i < 60 * 600 && d.status === 'fly'; i++) {
    if (i % 6 === 0) { const a = d.advice(); queue.push({ at: i + Math.round((o.delay + (r() - 0.5) * o.jitter) * 60), tilt: a.tilt, eng: a.engine }); }
    while (queue.length && queue[0].at <= i) { const q = queue.shift(); if (r() > o.miss) { tilt = q.tilt; eng = q.eng; } }
    if (o.idle) { tilt = 0; eng = 0; }
    thr = d.throttleStep ? d.throttleStep(thr, eng, 1 / 60) : Math.max(0, Math.min(1, thr + eng * 0.7 / 60));
    d.step(1 / 60, { tilt, thr });
  }
  return d.result || { grade: 'timeout', time: d.s.t };
}
function sweep(label, o, kit) {
  const tally = {}, causes = {}; let fuel = 0, n = 0, time = 0;
  L.SITE_ORDER.forEach((s) => ['auto', 'manual'].forEach((mode) => { for (let seed = 1; seed <= 12; seed++) {
    const r = run(s, mode, seed, o, kit); const k = mode + ':' + (r.grade === 'crash' ? 'CRASH' : 'ok'); tally[k] = (tally[k] || 0) + 1;
    if (r.grade === 'crash') causes[mode + ':' + r.cause] = (causes[mode + ':' + r.cause] || 0) + 1; else { fuel += r.fuelFrac; time += r.time; n++; }
  } }));
  console.log(label.padEnd(28), 'auto crash', String(tally['auto:CRASH'] || 0).padStart(2) + '/72', ' manual crash', String(tally['manual:CRASH'] || 0).padStart(2) + '/72',
    ' fuel left', n ? Math.round(fuel / n * 100) + '%' : '-', ' time', n ? Math.round(time / n) + 's' : '-', JSON.stringify(causes));
}
const K = process.argv[2] === 'heavy' ? ['seismo', 'mirror', 'drill', 'flag'] : undefined;
sweep('perfect (0.0 s)', { delay: 0, jitter: 0, miss: 0 }, K);
sweep('quick (0.25 s)', { delay: 0.25, jitter: 0.1, miss: 0 }, K);
sweep('typical (0.45 s)', { delay: 0.45, jitter: 0.2, miss: 0.05 }, K);
sweep('slow child (0.8 s)', { delay: 0.8, jitter: 0.4, miss: 0.1 }, K);
sweep('very slow (1.2 s)', { delay: 1.2, jitter: 0.5, miss: 0.15 }, K);
sweep('hands off', { delay: 0, jitter: 0, miss: 0, idle: true }, K);
