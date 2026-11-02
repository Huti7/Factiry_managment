// Offline model build: sculpt the body (js/anatomy.js), simplify every part with meshoptimizer,
// quantise + compress it, and write model/anatomy.bin + model/anatomy.json for the website.
import { writeFileSync } from 'node:fs';
import { MeshoptSimplifier, MeshoptEncoder } from 'meshoptimizer';
import { buildBody } from '../js/anatomy.js';

await MeshoptSimplifier.ready;
await MeshoptEncoder.ready;

const t0 = Date.now();
const parts = buildBody('male');
console.log(`sculpted ${parts.length} parts in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

const chunks = [];
let offset = 0;
const push = (u8) => { const o = offset; chunks.push(u8); offset += u8.byteLength; const pad = (4 - (u8.byteLength % 4)) % 4; if (pad) { chunks.push(new Uint8Array(pad)); offset += pad; } return o; };
const manifest = { version: 1, parts: [] };
let trisIn = 0, trisOut = 0;

for (const p of parts) {
  const entry = { cat: p.cat, key: p.key, side: p.side, label: p.label };
  if (p.color !== undefined) entry.color = p.color;
  if (p.mirrorOf !== undefined) { entry.mirrorOf = p.mirrorOf; manifest.parts.push(entry); continue; }
  const pos = p.geo.attributes.position.array;
  let idx = Uint32Array.from(p.geo.index.array);
  trisIn += idx.length / 3;
  // simplify (sculpted SDF meshes are dense; tubes are already light)
  const isSdf = idx.length > 6000;
  if (isSdf) {
    const target = Math.max(300, Math.floor((idx.length * 0.15) / 3) * 3);
    const [res] = MeshoptSimplifier.simplify(idx, Float32Array.from(pos), 3, target, 0.0035, []);
    idx = Uint32Array.from(res);
  }
  // compact vertices
  const remap = new Int32Array(pos.length / 3).fill(-1);
  const verts = [];
  let n = 0;
  for (let i = 0; i < idx.length; i++) {
    const v = idx[i];
    if (remap[v] < 0) { remap[v] = n++; verts.push(pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]); }
    idx[i] = remap[v];
  }
  trisOut += idx.length / 3;
  // quantise positions to 16 bit inside the part's bounding box (stride 8 bytes for the encoder)
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < verts.length; i++) { const a = i % 3; min[a] = Math.min(min[a], verts[i]); max[a] = Math.max(max[a], verts[i]); }
  const scale = [0, 1, 2].map((a) => Math.max(max[a] - min[a], 1e-6));
  const q = new Uint16Array(n * 4);
  for (let i = 0; i < n; i++) for (let a = 0; a < 3; a++) q[i * 4 + a] = Math.round(((verts[i * 3 + a] - min[a]) / scale[a]) * 65535);
  const vbuf = MeshoptEncoder.encodeVertexBuffer(new Uint8Array(q.buffer), n, 8);
  const ibuf = MeshoptEncoder.encodeIndexBuffer(new Uint8Array(idx.buffer), idx.length, 4);
  entry.vertexCount = n;
  entry.indexCount = idx.length;
  entry.min = min.map((x) => +x.toFixed(6));
  entry.scale = scale.map((x) => +x.toFixed(6));
  entry.vb = [push(vbuf), vbuf.byteLength];
  entry.ib = [push(ibuf), ibuf.byteLength];
  manifest.parts.push(entry);
}

const bin = new Uint8Array(offset);
let o = 0;
for (const c of chunks) { bin.set(c, o); o += c.byteLength; }
writeFileSync(new URL('../model/anatomy.bin', import.meta.url), bin);
writeFileSync(new URL('../model/anatomy.json', import.meta.url), JSON.stringify(manifest));
console.log(`triangles: ${trisIn} -> ${trisOut} (one side of each pair stored), bin ${(bin.byteLength / 1048576).toFixed(2)} MB, total ${((Date.now() - t0) / 1000).toFixed(1)}s`);
