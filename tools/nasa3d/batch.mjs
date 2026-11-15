import fs from 'fs'; import { execFileSync } from 'child_process';
const R = './work', man = JSON.parse(fs.readFileSync(R + '/manifest.json', 'utf8'));
const list = man.filter(e => e.kind === 'glb' || e.kind === 'stl').sort((a, b) => a.size - b.size);
let ok = 0, bad = 0;
for (const e of list) {
  const dst = `${R}/opt/${e.id}.glb`, meta = `${R}/opt/${e.id}.json`;
  if (fs.existsSync(meta)) { ok++; continue; }
  try {
    const args = e.kind === 'glb' ? ['--max-old-space-size=2700', 'process.mjs', e.src, dst, String(e.budget), String(e.tex)]
      : ['--max-old-space-size=2700', 'stl2glb.mjs', e.src, dst, String(e.budget), String(e.smooth), /mars|gale|victoria|valles/i.test(e.id) ? '0.72,0.45,0.30' : /hurricane/i.test(e.id) ? '0.9,0.93,0.97' : /^(space-launch|landsat|dart|curiosity)/.test(e.id) ? '0.86,0.87,0.9' : '0.62,0.61,0.6'];
    const out = execFileSync('node', args, { cwd: '.', timeout: 1500000, maxBuffer: 1 << 26, stdio: ['ignore', 'pipe', 'pipe'] }).toString();
    const line = out.trim().split('\n').filter(l => l.startsWith('{')).pop();
    fs.writeFileSync(meta, line); ok++;
    console.log('ok', e.id, line.slice(0, 160));
  } catch (err) { bad++; console.log('FAIL', e.id, String(err.stderr || err).slice(-300).replace(/\n/g, ' ')); }
}
console.log('DONE ok', ok, 'bad', bad);
