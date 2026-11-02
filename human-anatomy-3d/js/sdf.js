// Signed-distance-field sculpting + surface-nets polygonizer.
// Shapes are smooth-blended so bones and muscles look organic instead of built from primitives.
import * as THREE from 'three';

// ---------- primitives (closures over plain numbers for speed) ----------
export function sphere(c, r) {
  const cx = c.x, cy = c.y, cz = c.z;
  return (x, y, z) => Math.sqrt((x - cx) ** 2 + (y - cy) ** 2 + (z - cz) ** 2) - r;
}

/** ellipsoid with optional rotation (THREE.Euler or Quaternion) */
export function ellipsoid(c, r, rot = null) {
  const cx = c.x, cy = c.y, cz = c.z, rx = r.x, ry = r.y, rz = r.z;
  let m = null;
  if (rot) {
    const q = rot.isQuaternion ? rot.clone() : new THREE.Quaternion().setFromEuler(rot);
    m = new THREE.Matrix4().makeRotationFromQuaternion(q.invert()).elements;
  }
  return (x, y, z) => {
    let px = x - cx, py = y - cy, pz = z - cz;
    if (m) {
      const ax = m[0] * px + m[4] * py + m[8] * pz;
      const ay = m[1] * px + m[5] * py + m[9] * pz;
      const az = m[2] * px + m[6] * py + m[10] * pz;
      px = ax; py = ay; pz = az;
    }
    const k0 = Math.sqrt((px / rx) ** 2 + (py / ry) ** 2 + (pz / rz) ** 2);
    const k1 = Math.sqrt((px / (rx * rx)) ** 2 + (py / (ry * ry)) ** 2 + (pz / (rz * rz)) ** 2);
    return k1 < 1e-9 ? -Math.min(rx, ry, rz) : (k0 * (k0 - 1)) / k1;
  };
}

/** cone-capsule between a and b with radii ra, rb */
export function capsule(a, b, ra, rb = ra) {
  const ax = a.x, ay = a.y, az = a.z;
  const bx = b.x - ax, by = b.y - ay, bz = b.z - az;
  const bb = bx * bx + by * by + bz * bz || 1e-12;
  return (x, y, z) => {
    const px = x - ax, py = y - ay, pz = z - az;
    let h = (px * bx + py * by + pz * bz) / bb;
    h = h < 0 ? 0 : h > 1 ? 1 : h;
    const dx = px - bx * h, dy = py - by * h, dz = pz - bz * h;
    return Math.sqrt(dx * dx + dy * dy + dz * dz) - (ra + (rb - ra) * h);
  };
}

/** polyline of cone-capsules: pts[], radii[] (same length) */
export function chain(pts, radii) {
  const segs = [];
  for (let i = 0; i < pts.length - 1; i++) segs.push(capsule(pts[i], pts[i + 1], radii[i], radii[i + 1]));
  return (x, y, z) => {
    let d = 1e9;
    for (let i = 0; i < segs.length; i++) { const v = segs[i](x, y, z); if (v < d) d = v; }
    return d;
  };
}

/** smooth curve through ctrl points with a radius function r(t) */
export function curveTube(ctrl, rfn, n = 10) {
  const curve = new THREE.CatmullRomCurve3(ctrl, false, 'centripetal');
  const pts = [], rs = [];
  for (let i = 0; i <= n; i++) { const t = i / n; pts.push(curve.getPoint(t)); rs.push(rfn(t)); }
  const f = chain(pts, rs);
  f.pts = pts; f.rs = rs;
  // AABB lower bound used by U() to skip far-away pieces
  const mr = Math.max(...rs);
  let x0 = 1e9, y0 = 1e9, z0 = 1e9, x1 = -1e9, y1 = -1e9, z1 = -1e9;
  for (const p of pts) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); z0 = Math.min(z0, p.z); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); z1 = Math.max(z1, p.z); }
  x0 -= mr; y0 -= mr; z0 -= mr; x1 += mr; y1 += mr; z1 += mr;
  f.lb = (x, y, z) => {
    const dx = Math.max(x0 - x, 0, x - x1), dy = Math.max(y0 - y, 0, y - y1), dz = Math.max(z0 - z, 0, z - z1);
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  };
  return f;
}

export function torusSDF(c, R, r, normal) {
  const q = new THREE.Quaternion().setFromUnitVectors(normal.clone().normalize(), new THREE.Vector3(0, 1, 0));
  const m = new THREE.Matrix4().makeRotationFromQuaternion(q).elements;
  return (x, y, z) => {
    const px = x - c.x, py = y - c.y, pz = z - c.z;
    const ax = m[0] * px + m[4] * py + m[8] * pz;
    const ay = m[1] * px + m[5] * py + m[9] * pz;
    const az = m[2] * px + m[6] * py + m[10] * pz;
    const qx = Math.sqrt(ax * ax + az * az) - R;
    return Math.sqrt(qx * qx + ay * ay) - r;
  };
}

/** rounded box with rotation */
export function rbox(c, half, round = 0.001, rot = null) {
  let m = null;
  if (rot) {
    const q = rot.isQuaternion ? rot.clone() : new THREE.Quaternion().setFromEuler(rot);
    m = new THREE.Matrix4().makeRotationFromQuaternion(q.invert()).elements;
  }
  const hx = half.x - round, hy = half.y - round, hz = half.z - round;
  return (x, y, z) => {
    let px = x - c.x, py = y - c.y, pz = z - c.z;
    if (m) {
      const ax = m[0] * px + m[4] * py + m[8] * pz, ay = m[1] * px + m[5] * py + m[9] * pz, az = m[2] * px + m[6] * py + m[10] * pz;
      px = ax; py = ay; pz = az;
    }
    const qx = Math.abs(px) - hx, qy = Math.abs(py) - hy, qz = Math.abs(pz) - hz;
    const o = Math.sqrt(Math.max(qx, 0) ** 2 + Math.max(qy, 0) ** 2 + Math.max(qz, 0) ** 2);
    return o + Math.min(Math.max(qx, qy, qz), 0) - round;
  };
}

// ---------- operators ----------
export function smin(a, b, k) {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}
/** smooth union of many fields */
export function U(k, ...fs) {
  fs = fs.flat().filter(Boolean);
  if (k <= 0) return (x, y, z) => { let d = 1e9; for (const f of fs) { const v = f(x, y, z); if (v < d) d = v; } return d; };
  return (x, y, z) => {
    let d = fs[0](x, y, z);
    for (let i = 1; i < fs.length; i++) {
      const fi = fs[i];
      if (fi.lb && fi.lb(x, y, z) - d > k) continue;
      const b = fi(x, y, z);
      if (b - d > k) continue;
      d = smin(d, b, k);
    }
    return d;
  };
}
/** a minus b (smooth) */
export function SUB(a, b, k = 0.002) {
  return (x, y, z) => {
    const da = a(x, y, z), db = -b(x, y, z);
    const h = Math.max(k - Math.abs(da - db), 0) / k;
    return Math.max(da, db) + h * h * k * 0.25;
  };
}
/** intersection */
export function AND(a, b, k = 0.002) {
  return (x, y, z) => {
    const da = a(x, y, z), db = b(x, y, z);
    const h = Math.max(k - Math.abs(da - db), 0) / k;
    return Math.max(da, db) + h * h * k * 0.25;
  };
}
/** add a displacement (bumpy surface) */
export function DISP(f, fn) { return (x, y, z) => f(x, y, z) + fn(x, y, z); }

// ---------- bounds helper ----------
export function bounds(pts, pad) {
  const min = new THREE.Vector3(Infinity, Infinity, Infinity), max = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
  for (const p of pts) { min.min(p); max.max(p); }
  return { min: min.subScalar(pad), max: max.addScalar(pad) };
}

// ---------- surface nets polygonizer ----------
export function polygonize(f, box, h, smoothIter = 1) {
  const { min, max } = box;
  const nx = Math.ceil((max.x - min.x) / h) + 2, ny = Math.ceil((max.y - min.y) / h) + 2, nz = Math.ceil((max.z - min.z) / h) + 2;
  const ox = min.x - h * 0.5, oy = min.y - h * 0.5, oz = min.z - h * 0.5;
  const N = nx * ny * nz;
  const val = new Float32Array(N);
  const B = 4, skip = Math.sqrt(3) * B * h * 0.5 * 1.5 + h;
  const id = (i, j, k) => i + nx * (j + ny * k);
  for (let bk = 0; bk < nz; bk += B) for (let bj = 0; bj < ny; bj += B) for (let bi = 0; bi < nx; bi += B) {
    const ei = Math.min(nx, bi + B), ej = Math.min(ny, bj + B), ek = Math.min(nz, bk + B);
    const cx = ox + ((bi + ei - 1) / 2) * h, cy = oy + ((bj + ej - 1) / 2) * h, cz = oz + ((bk + ek - 1) / 2) * h;
    const dc = f(cx, cy, cz);
    if (Math.abs(dc) > skip) {
      for (let k = bk; k < ek; k++) for (let j = bj; j < ej; j++) for (let i = bi; i < ei; i++) val[id(i, j, k)] = dc;
    } else {
      for (let k = bk; k < ek; k++) for (let j = bj; j < ej; j++) for (let i = bi; i < ei; i++) val[id(i, j, k)] = f(ox + i * h, oy + j * h, oz + k * h);
    }
  }
  // force outside at the border so surfaces close
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    if (i === 0 || j === 0 || k === 0 || i === nx - 1 || j === ny - 1 || k === nz - 1) { const q = id(i, j, k); if (val[q] < 0) val[q] = 1e-4; }
  }
  const cellV = new Int32Array(N).fill(-1);
  const pos = [];
  const E = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  const co = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
  const v8 = new Float32Array(8);
  for (let k = 0; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    let mask = 0;
    for (let c = 0; c < 8; c++) { const v = val[id(i + co[c][0], j + co[c][1], k + co[c][2])]; v8[c] = v; if (v < 0) mask |= 1 << c; }
    if (mask === 0 || mask === 255) continue;
    let sx = 0, sy = 0, sz = 0, n = 0;
    for (const [a, b] of E) {
      const va = v8[a], vb = v8[b];
      if ((va < 0) === (vb < 0)) continue;
      const t = va / (va - vb);
      sx += co[a][0] + (co[b][0] - co[a][0]) * t;
      sy += co[a][1] + (co[b][1] - co[a][1]) * t;
      sz += co[a][2] + (co[b][2] - co[a][2]) * t;
      n++;
    }
    cellV[id(i, j, k)] = pos.length / 3;
    pos.push(ox + (i + sx / n) * h, oy + (j + sy / n) * h, oz + (k + sz / n) * h);
  }
  const idx = [];
  const quad = (a, b, c, d, flip) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    if (flip) idx.push(a, c, b, a, d, c); else idx.push(a, b, c, a, c, d);
  };
  for (let k = 1; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
    const v0 = val[id(i, j, k)] < 0;
    if (v0 !== (val[id(i + 1, j, k)] < 0)) // x edge
      quad(cellV[id(i, j - 1, k - 1)], cellV[id(i, j, k - 1)], cellV[id(i, j, k)], cellV[id(i, j - 1, k)], !v0);
    if (v0 !== (val[id(i, j + 1, k)] < 0)) // y edge
      quad(cellV[id(i - 1, j, k - 1)], cellV[id(i - 1, j, k)], cellV[id(i, j, k)], cellV[id(i, j, k - 1)], !v0);
    if (v0 !== (val[id(i, j, k + 1)] < 0)) // z edge
      quad(cellV[id(i - 1, j - 1, k)], cellV[id(i, j - 1, k)], cellV[id(i, j, k)], cellV[id(i - 1, j, k)], !v0);
  }
  // light laplacian smoothing (keeps surface-nets stair steps away)
  if (smoothIter > 0) {
    const nv = pos.length / 3;
    const nb = Array.from({ length: nv }, () => new Set());
    for (let t = 0; t < idx.length; t += 3) {
      const a = idx[t], b = idx[t + 1], c = idx[t + 2];
      nb[a].add(b); nb[a].add(c); nb[b].add(a); nb[b].add(c); nb[c].add(a); nb[c].add(b);
    }
    let P = Float32Array.from(pos);
    for (let it = 0; it < smoothIter; it++) {
      const Q = new Float32Array(P.length);
      for (let v = 0; v < nv; v++) {
        let x = 0, y = 0, z = 0, n = 0;
        for (const w of nb[v]) { x += P[w * 3]; y += P[w * 3 + 1]; z += P[w * 3 + 2]; n++; }
        if (!n) { Q[v * 3] = P[v * 3]; Q[v * 3 + 1] = P[v * 3 + 1]; Q[v * 3 + 2] = P[v * 3 + 2]; continue; }
        Q[v * 3] = P[v * 3] * 0.5 + (x / n) * 0.5; Q[v * 3 + 1] = P[v * 3 + 1] * 0.5 + (y / n) * 0.5; Q[v * 3 + 2] = P[v * 3 + 2] * 0.5 + (z / n) * 0.5;
      }
      P = Q;
    }
    pos.length = 0;
    for (let i = 0; i < P.length; i++) pos.push(P[i]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** mirror a geometry across x = 0 (left side -> right side) */
export function mirrorX(g) {
  const m = g.clone();
  const p = m.attributes.position;
  for (let i = 0; i < p.count; i++) p.setX(i, -p.getX(i));
  const ix = m.index.array;
  for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; }
  m.index.needsUpdate = true;
  m.computeVertexNormals();
  return m;
}

/** march from p along dir until hitting the surface of f; returns the surface point (or p if missed) */
export function hit(f, p, dir, maxT = 0.4) {
  const d0 = dir.clone().normalize();
  let t = 0;
  for (let i = 0; i < 200; i++) {
    const q = p.clone().addScaledVector(d0, t);
    const d = f(q.x, q.y, q.z);
    if (d < 0.0002) return q;
    t += Math.max(d * 0.8, 0.0003);
    if (t > maxT) break;
  }
  return p.clone();
}

/** thin (optionally curved) plate through a 3D polygon; the plate follows the polygon vertices' offsets */
export function plate(poly, thick, extra = []) {
  const c = new THREE.Vector3();
  poly.forEach((p) => c.add(p)); c.divideScalar(poly.length);
  const n = new THREE.Vector3();
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    n.x += (a.y - b.y) * (a.z + b.z); n.y += (a.z - b.z) * (a.x + b.x); n.z += (a.x - b.x) * (a.y + b.y);
  }
  n.normalize();
  const u = poly[0].clone().sub(c); u.sub(n.clone().multiplyScalar(u.dot(n))).normalize();
  const v = new THREE.Vector3().crossVectors(n, u);
  const P2 = poly.map((p) => { const w = p.clone().sub(c); return [w.dot(u), w.dot(v), w.dot(n)]; });
  const ctrl = P2.concat(extra.map((p) => { const w = p.clone().sub(c); return [w.dot(u), w.dot(v), w.dot(n)]; }));
  const th = typeof thick === 'function' ? thick : () => thick;
  return (x, y, z) => {
    const wx = x - c.x, wy = y - c.y, wz = z - c.z;
    const pu = wx * u.x + wy * u.y + wz * u.z, pv = wx * v.x + wy * v.y + wz * v.z, pn = wx * n.x + wy * n.y + wz * n.z;
    // polygon sdf (iq)
    let d = (pu - P2[0][0]) ** 2 + (pv - P2[0][1]) ** 2, s = 1;
    for (let i = 0, j = P2.length - 1; i < P2.length; j = i, i++) {
      const ex = P2[j][0] - P2[i][0], ey = P2[j][1] - P2[i][1];
      const qx = pu - P2[i][0], qy = pv - P2[i][1];
      const h = Math.max(0, Math.min(1, (qx * ex + qy * ey) / (ex * ex + ey * ey)));
      const bx = qx - ex * h, by = qy - ey * h;
      d = Math.min(d, bx * bx + by * by);
      const c1 = pv >= P2[i][1], c2 = pv < P2[j][1], c3 = ex * qy > ey * qx;
      if ((c1 && c2 && c3) || (!c1 && !c2 && !c3)) s = -s;
    }
    const d2 = s * Math.sqrt(d);
    // inverse distance weighted height of the plate surface
    let ws = 0, hs = 0;
    for (const q of ctrl) { const dd = (pu - q[0]) ** 2 + (pv - q[1]) ** 2 + 1e-7; const w = 1 / dd; ws += w; hs += w * q[2]; }
    const dn = Math.abs(pn - hs / ws) - th(pu, pv) * 0.5;
    const ox = Math.max(d2, 0), oy = Math.max(dn, 0);
    return Math.sqrt(ox * ox + oy * oy) + Math.min(Math.max(d2, dn), 0);
  };
}

/** wrap a local-space field: place it at c with rotation q */
export function place(f, c, q) {
  const m = new THREE.Matrix4().makeRotationFromQuaternion(q.clone().invert()).elements;
  return (x, y, z) => {
    const px = x - c.x, py = y - c.y, pz = z - c.z;
    return f(m[0] * px + m[4] * py + m[8] * pz, m[1] * px + m[5] * py + m[9] * pz, m[2] * px + m[6] * py + m[10] * pz);
  };
}

/** rounded cylinder along local y */
export function rcyl(r, h, round, zScale = 1) {
  return (x, y, z) => {
    const dx = Math.sqrt(x * x + (z / zScale) ** 2) - (r - round), dy = Math.abs(y) - (h / 2 - round);
    return Math.min(Math.max(dx, dy), 0) + Math.sqrt(Math.max(dx, 0) ** 2 + Math.max(dy, 0) ** 2) - round;
  };
}
