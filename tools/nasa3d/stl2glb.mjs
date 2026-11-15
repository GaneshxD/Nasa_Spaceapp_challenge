// A 3D-printable STL (no colours, Z up) -> a small GLB: weld, simplify, optional smooth normals, meshopt.
import { Document, NodeIO } from '@gltf-transform/core';
import { EXTMeshoptCompression, ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { weld, simplify, normals, prune, reorder, quantize } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import fs from 'fs';
const [,, src, dst, budgetArg, smoothArg, colorArg] = process.argv;
const budget = +budgetArg || 12000, smooth = smoothArg === '1';
await MeshoptEncoder.ready; await MeshoptSimplifier.ready;
const buf = fs.readFileSync(src);
let pos;
const head = buf.slice(0, 1024).toString('latin1');
const ascii = /^\s*solid/.test(head) && /facet\s+normal/.test(head);
const n = ascii ? 0 : Math.min(buf.readUInt32LE(80), Math.floor((buf.length - 84) / 50));
if (!ascii) {
  pos = new Float32Array(n * 9);
  for (let i = 0; i < n; i++) { const o = 84 + i * 50 + 12; for (let k = 0; k < 9; k++) pos[i * 9 + k] = buf.readFloatLE(o + k * 4); }
} else {
  const m = buf.toString('latin1').match(/vertex\s+(\S+)\s+(\S+)\s+(\S+)/g) || [];
  pos = new Float32Array(m.length * 3);
  m.forEach((l, i) => { const p = l.trim().split(/\s+/); pos[i * 3] = +p[1]; pos[i * 3 + 1] = +p[2]; pos[i * 3 + 2] = +p[3]; });
}
// Z up (printer bed) -> Y up
for (let i = 0; i < pos.length; i += 3) { const y = pos[i + 1], z = pos[i + 2]; pos[i + 1] = z; pos[i + 2] = -y; }
const doc = new Document(); doc.setLogger({ debug(){}, info(){}, warn(){}, error(){} });
const b = doc.createBuffer();
const col = (colorArg || '0.72,0.70,0.67').split(',').map(Number);
const mat = doc.createMaterial('m').setBaseColorFactor([col[0], col[1], col[2], 1]).setRoughnessFactor(smooth ? 0.95 : 0.6).setMetallicFactor(smooth ? 0 : 0.25);
const prim = doc.createPrimitive().setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(pos).setBuffer(b)).setMaterial(mat);
const node = doc.createNode('model').setMesh(doc.createMesh('model').addPrimitive(prim));
doc.createScene().addChild(node);
const trisIn = pos.length / 9;
const tris = () => { let t = 0; for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) { const ix = p.getIndices(); t += (ix ? ix.getCount() : p.getAttribute('POSITION').getCount()) / 3; } return t; };
await doc.transform(weld({ overwrite: true }));
if (!prim.getIndices()) { const c = pos.length / 3, ix = new Uint32Array(c); for (let i = 0; i < c; i++) ix[i] = i; prim.setIndices(doc.createAccessor().setType('SCALAR').setArray(ix).setBuffer(b)); }
for (const err of [0.003, 0.01, 0.03, 0.08]) {
  const now = tris();
  if (now <= budget * 1.15) break;
  await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio: Math.max(0.01, budget / now), error: err }));
}
await doc.transform(prune(), reorder({ encoder: MeshoptEncoder, level: 'medium' }), quantize({ quantizePosition: 14, quantizeNormal: 8 }));
doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
const out = await new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder }).writeBinary(doc);
fs.writeFileSync(dst, out);
console.log(JSON.stringify({ src, bytes: out.byteLength, trisIn, tris: tris(), tex: 0, mats: 1, prims: 1 }));
