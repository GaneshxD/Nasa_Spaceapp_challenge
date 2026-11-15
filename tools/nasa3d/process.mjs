// Turn one NASA GLB into a small, phone-friendly GLB:
// decode Draco, merge parts, simplify to a triangle budget, shrink textures to WebP, meshopt-compress.
import { NodeIO, PropertyType } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression, KHRMeshQuantization, EXTTextureWebP } from '@gltf-transform/extensions';
import { dedup, prune, flatten, join, weld, simplify, palette, textureCompress, quantize, reorder, getBounds, dequantize, compactPrimitive } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import draco3d from 'draco3dgltf';
import sharp from 'sharp';
import fs from 'fs';

const [,, src, dst, budgetArg, texArg] = process.argv;
const budget = +budgetArg || 15000, texMax = +texArg || 512;
await MeshoptDecoder.ready; await MeshoptEncoder.ready; await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'draco3d.decoder': await draco3d.createDecoderModule(),
  'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder
});
const quiet = { debug(){}, info(){}, warn(){}, error(){} };

// Some source files point at texture files that are not in the repository. Swap those for a 1x1 white pixel.
function patch(buf) {
  const jsonLen = buf.readUInt32LE(12);
  const json = JSON.parse(buf.slice(20, 20 + jsonLen).toString('utf8'));
  let changed = false;
  const white = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
  (json.images || []).forEach(im => { if (im.uri && !im.uri.startsWith('data:')) { im.uri = white; im.mimeType = 'image/png'; changed = true; } });
  if (!changed) return buf;
  let js = Buffer.from(JSON.stringify(json), 'utf8');
  const pad = (4 - (js.length % 4)) % 4; js = Buffer.concat([js, Buffer.alloc(pad, 0x20)]);
  const rest = buf.slice(20 + jsonLen);
  const head = Buffer.alloc(20);
  head.writeUInt32LE(0x46546C67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(20 + js.length + rest.length, 8);
  head.writeUInt32LE(js.length, 12); head.writeUInt32LE(0x4E4F534A, 16);
  return Buffer.concat([head, js, rest]);
}

function count(doc) {
  let tris = 0, verts = 0, prims = 0;
  for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) {
    const pos = p.getAttribute('POSITION'); if (!pos) continue; prims++;
    verts += pos.getCount(); const ind = p.getIndices(); tris += (ind ? ind.getCount() : pos.getCount()) / 3;
  }
  return { tris: Math.round(tris), verts, prims };
}

const doc = await io.readBinary(new Uint8Array(patch(fs.readFileSync(src))));
doc.setLogger(quiet);
const root = doc.getRoot();
const before = count(doc);
const scene0 = root.getDefaultScene() || root.listScenes()[0];
const b0 = getBounds(scene0);
const dims = b0.max.map((v, k) => v - b0.min[k]);
const hadAnim = root.listAnimations().length;

// Phones draw plain materials fastest: glass becomes simple see-through, the fancy layers go.
for (const mat of root.listMaterials()) {
  const tr = mat.getExtension('KHR_materials_transmission');
  if (tr && tr.getTransmissionFactor() > 0.2) { const c = mat.getBaseColorFactor(); c[3] = Math.min(c[3], 0.45); mat.setBaseColorFactor(c); mat.setAlphaMode('BLEND'); }
  for (const name of ['KHR_materials_transmission', 'KHR_materials_volume', 'KHR_materials_ior', 'KHR_materials_specular', 'KHR_materials_sheen', 'KHR_materials_clearcoat', 'KHR_materials_iridescence', 'KHR_materials_anisotropy', 'KHR_materials_emissive_strength']) mat.setExtension(name, null);
  // normal/occlusion maps cost bytes and little shows at this size
  mat.setNormalTexture(null); mat.setOcclusionTexture(null);
  if (mat.getMetallicRoughnessTexture()) { mat.setMetallicRoughnessTexture(null); }
}
for (const ext of root.listExtensionsUsed()) {
  if (/KHR_materials_(transmission|volume|ior|specular|sheen|clearcoat|iridescence|anisotropy|emissive_strength)|KHR_draco/.test(ext.extensionName)) ext.dispose();
}
// animations (panels unfolding and the like) are dropped: the gallery shows each craft in one pose
for (const a of root.listAnimations()) { for (const c of a.listChannels()) c.dispose(); for (const sm of a.listSamplers()) sm.dispose(); a.dispose(); }
for (const s of root.listSkins()) s.dispose();

await doc.transform(dedup(), prune(), dequantize(), flatten());
// drop attributes the simple materials no longer need
for (const m of root.listMeshes()) for (const p of m.listPrimitives()) {
  for (const sem of p.listSemantics()) {
    // normals are not shipped: the game works them out again from the shape, which halves the download
    if (/^(NORMAL|TANGENT|TEXCOORD_[1-9]|COLOR_[1-9]|JOINTS_\d|WEIGHTS_\d)$/.test(sem)) p.setAttribute(sem, null);
    if (sem === 'TEXCOORD_0' && !(p.getMaterial() && p.getMaterial().getBaseColorTexture()) && !(p.getMaterial() && p.getMaterial().getEmissiveTexture())) p.setAttribute(sem, null);
  }
  for (const t of p.listTargets()) t.dispose();
}
let nMat = root.listMaterials().length;
if (nMat > 6) { try { await doc.transform(palette({ min: 5 })); } catch (e) { /* keep separate materials */ } }
await doc.transform(dedup(), join({ keepNamed: false }), weld({}));
let mid = count(doc);
if (mid.tris > budget) {
  const passes = [[0.004, 1], [0.012, 1], [0.03, 1], [0.08, 1]];
  for (const [err] of passes) {
    const now = count(doc).tris;
    if (now <= budget * 1.15) break;
    await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio: Math.max(0.02, budget / now), error: err, lockBorder: false }));
  }
}
// Models made of thousands of loose pieces resist careful simplifying. For those, merge nearby
// vertices on a grid instead (coarser, but it always reaches the budget).
{
  const now = count(doc).tris;
  if (now > budget * 2.5) {
    const buffer = root.listBuffers()[0];
    for (const m of root.listMeshes()) for (const p of m.listPrimitives()) {
      const ind = p.getIndices(), pos = p.getAttribute('POSITION');
      if (!ind || !pos) continue;
      const target = Math.max(120, Math.floor(budget * 1.5 * (ind.getCount() / 3 / now))) * 3;
      if (ind.getCount() <= target) continue;
      const res = MeshoptSimplifier.simplifySloppy(new Uint32Array(ind.getArray()), new Float32Array(pos.getArray()), 3, null, target, 0.5);
      p.setIndices(doc.createAccessor().setType('SCALAR').setArray(res[0]).setBuffer(buffer));
      compactPrimitive(p);
    }
  }
}
await doc.transform(prune({ keepAttributes: false, keepLeaves: false }), dedup());
// textures: at most texMax pixels a side, stored as WebP
if (root.listTextures().length) {
  const nt = root.listTextures().length, side = nt > 8 ? Math.min(texMax, 256) : nt > 4 ? Math.min(texMax, 512) : texMax;
  await doc.transform(textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [side, side], quality: 70, effort: 80 }));
}
await doc.transform(prune(), reorder({ encoder: MeshoptEncoder, level: 'medium' }),
  quantize({ quantizePosition: 14, quantizeNormal: 8, quantizeTexcoord: 12, quantizeColor: 8 }));
doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
const out = await io.writeBinary(doc);
fs.writeFileSync(dst, out);
const after = count(doc);
console.log(JSON.stringify({ src, bytes: out.byteLength, trisIn: before.tris, tris: after.tris, verts: after.verts, prims: after.prims,
  mats: root.listMaterials().length, tex: root.listTextures().length, dims: dims.map(v => +v.toPrecision(4)), anim: hadAnim }));
