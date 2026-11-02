// Loads the pre-built anatomy model (model/anatomy.bin + .json, produced by tools/build-model.mjs).
import * as THREE from 'three';
import { MeshoptDecoder } from '../lib/meshopt_decoder.module.js';
import { warpGeometry } from './geometry.js';
import { mirrorX } from './sdf.js';
import { femaleWarp } from './warp.js';

export async function loadAnatomy(base = 'model/', onProgress = () => {}) {
  await MeshoptDecoder.ready;
  const man = await (await fetch(base + 'anatomy.json')).json();
  const res = await fetch(base + 'anatomy.bin');
  let bin;
  const total = +res.headers.get('content-length') || 0;
  if (res.body && total) {
    const reader = res.body.getReader();
    const buf = new Uint8Array(total);
    let got = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf.set(value, got); got += value.length;
      onProgress(got / total);
    }
    bin = buf.buffer;
  } else bin = await res.arrayBuffer();

  const parts = [];
  for (const e of man.parts) {
    let geo;
    if (e.mirrorOf !== undefined) geo = mirrorX(parts[e.mirrorOf].geo);
    else {
      const n = e.vertexCount;
      const vq = new Uint8Array(n * 8);
      MeshoptDecoder.decodeVertexBuffer(vq, n, 8, new Uint8Array(bin, e.vb[0], e.vb[1]));
      const q = new Uint16Array(vq.buffer);
      const pos = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) for (let a = 0; a < 3; a++) pos[i * 3 + a] = e.min[a] + (q[i * 4 + a] / 65535) * e.scale[a];
      const ib = new Uint8Array(e.indexCount * 4);
      MeshoptDecoder.decodeIndexBuffer(ib, e.indexCount, 4, new Uint8Array(bin, e.ib[0], e.ib[1]));
      geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setIndex(new THREE.BufferAttribute(new Uint32Array(ib.buffer), 1));
      geo.computeVertexNormals();
    }
    geo.computeBoundingBox();
    geo.computeBoundingSphere();
    const p = { cat: e.cat, key: e.key, side: e.side, label: e.label, geo };
    if (e.color !== undefined) p.color = e.color;
    parts.push(p);
  }
  return parts;
}

/** female body: the same parts with female proportions */
export function femaleFrom(parts) {
  return parts.map((p) => {
    const g = p.geo.clone();
    warpGeometry(g, femaleWarp);
    return { ...p, geo: g };
  });
}
