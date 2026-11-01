// Procedural geometry helpers used to sculpt the anatomy model.
import * as THREE from 'three';
import { mergeGeometries } from '../lib/BufferGeometryUtils.js';

export const V = (x, y, z) => new THREE.Vector3(x, y, z);
export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp01 = (t) => Math.min(1, Math.max(0, t));
export const smooth = (e0, e1, x) => { const t = clamp01((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t); };

function anyPerp(T) {
  const a = Math.abs(T.y) < 0.9 ? V(0, 1, 0) : V(1, 0, 0);
  return a.sub(T.clone().multiplyScalar(a.dot(T))).normalize();
}

/** rounded end factor: 1 in the middle, quarter-circle falloff over the end lengths ea / eb (fractions of t). */
export function cap(t, ea, eb = ea) {
  if (ea > 0 && t < ea) return Math.sqrt(Math.max(0, 1 - ((ea - t) / ea) ** 2));
  if (eb > 0 && t > 1 - eb) return Math.sqrt(Math.max(0, 1 - ((t - 1 + eb) / eb) ** 2));
  return 1;
}

/** long bone profile: wide rounded heads (ra, rb) and a narrow shaft rs */
export function boneProf(ra, rs, rb) {
  return (t, L) => {
    const base = t < 0.33 ? lerp(ra, rs, smooth(0, 0.33, t)) : t > 0.67 ? lerp(rs, rb, smooth(0.67, 1, t)) : rs;
    return base * cap(t, Math.min(0.3, (ra * 0.9) / L), Math.min(0.3, (rb * 0.9) / L));
  };
}

/** muscle belly profile: tendinous ends, belly peaking at `peak` */
export function musProf(R, peak = 0.5, tendon = 0.14) {
  return (t) => {
    const u = t < peak ? (t / peak) * 0.5 : 0.5 + ((t - peak) / (1 - peak)) * 0.5;
    return R * (tendon + (1 - tendon) * Math.pow(Math.sin(Math.PI * u), 0.85)) * cap(t, 0.025);
  };
}

/** constant radius with rounded ends */
export function rodProf(r, r2 = r) {
  return (t, L) => lerp(r, r2, t) * cap(t, Math.min(0.4, r / L), Math.min(0.4, r2 / L));
}

/**
 * Tube along a CatmullRom path with a variable radius and elliptical cross-section.
 * width / thick: multipliers (numbers or functions of t) along B and N.
 * hint: Vector3 or fn(p,T) giving the direction of N ("thickness" axis, usually outward).
 */
export function tube(points, radiusFn, opt = {}) {
  const { seg = 40, radial = 14, width = 1, thick = 1, hint = null, closed = false, even = false } = opt;
  const curve = points.isCurve ? points : new THREE.CatmullRomCurve3(points, closed, 'centripetal', 0.5);
  const L = curve.getLength();
  const rings = closed ? seg : seg + 1;
  const pos = [], idx = [];
  let prevN = null;
  for (let i = 0; i < rings; i++) {
    const s = i / seg;
    const t = closed || even ? s : (1 - Math.cos(Math.PI * s)) / 2;
    const p = curve.getPointAt(t);
    const T = curve.getTangentAt(t).normalize();
    let N;
    if (hint) {
      N = typeof hint === 'function' ? hint(p, T) : hint.clone();
      N.sub(T.clone().multiplyScalar(N.dot(T)));
      if (N.lengthSq() < 1e-10) N = prevN ? prevN.clone() : anyPerp(T);
      N.normalize();
      if (prevN && N.dot(prevN) < -0.2) N.negate();
    } else if (prevN) {
      N = prevN.clone().sub(T.clone().multiplyScalar(prevN.dot(T)));
      if (N.lengthSq() < 1e-10) N = anyPerp(T);
      N.normalize();
    } else N = anyPerp(T);
    prevN = N;
    const B = new THREE.Vector3().crossVectors(T, N).normalize();
    const r = radiusFn(t, L);
    const w = typeof width === 'function' ? width(t) : width;
    const k = typeof thick === 'function' ? thick(t) : thick;
    for (let j = 0; j < radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      const c = Math.cos(a) * k * r, sn = Math.sin(a) * w * r;
      pos.push(p.x + N.x * c + B.x * sn, p.y + N.y * c + B.y * sn, p.z + N.z * c + B.z * sn);
    }
  }
  const last = closed ? rings : rings - 1;
  for (let i = 0; i < last; i++) {
    const i2 = (i + 1) % rings;
    for (let j = 0; j < radial; j++) {
      const j2 = (j + 1) % radial;
      const a = i * radial + j, b = i * radial + j2, c = i2 * radial + j, d = i2 * radial + j2;
      idx.push(a, b, c, b, d, c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/**
 * A thick curved sheet (for flat muscles and flat bones).
 * rows: array of point arrays; each row is a curve along u, rows are interpolated along v.
 * center: fn(p) -> point that lies "inside" the body, used to orient the bulge outward.
 */
export function sheet(rows, thick, opt = {}) {
  const { nu = 22, nv = 18, center = (p) => V(0, p.y, 0), back = 0.35, mod = null, expo = 0.55 } = opt;
  const curves = rows.map((r) => new THREE.CatmullRomCurve3(r.length === 1 ? [r[0], r[0].clone()] : r, false, 'centripetal'));
  const grid = [];
  for (let i = 0; i <= nu; i++) {
    const u = i / nu;
    const ctrl = curves.map((c) => c.getPoint(u));
    const vc = new THREE.CatmullRomCurve3(ctrl, false, 'centripetal');
    const row = [];
    for (let j = 0; j <= nv; j++) row.push(vc.getPoint(j / nv));
    grid.push(row);
  }
  const top = [], bot = [];
  let flips = 0;
  for (let i = 0; i <= nu; i++) {
    for (let j = 0; j <= nv; j++) {
      const p = grid[i][j];
      const du = grid[Math.min(nu, i + 1)][j].clone().sub(grid[Math.max(0, i - 1)][j]);
      const dv = grid[i][Math.min(nv, j + 1)].clone().sub(grid[i][Math.max(0, j - 1)]);
      let n = new THREE.Vector3().crossVectors(du, dv);
      const out = p.clone().sub(center(p));
      if (n.lengthSq() < 1e-12) n = out.clone();
      n.normalize();
      if (n.dot(out) < 0) { n.negate(); flips++; }
      const u = i / nu, v = j / nv;
      let s = Math.pow(Math.max(0, Math.sin(Math.PI * u) * Math.sin(Math.PI * v)), expo);
      if (mod) s *= mod(u, v);
      top.push(p.x + n.x * thick * s, p.y + n.y * thick * s, p.z + n.z * thick * s);
      bot.push(p.x - n.x * thick * back * s, p.y - n.y * thick * back * s, p.z - n.z * thick * back * s);
    }
  }
  const pos = top.concat(bot);
  const off = (nu + 1) * (nv + 1);
  const idx = [];
  const flip = flips > ((nu + 1) * (nv + 1)) / 2;
  for (let i = 0; i < nu; i++) {
    for (let j = 0; j < nv; j++) {
      const a = i * (nv + 1) + j, b = (i + 1) * (nv + 1) + j, c = a + 1, d = b + 1;
      if (flip) {
        idx.push(a, c, b, b, c, d);
        idx.push(off + a, off + b, off + c, off + b, off + d, off + c);
      } else {
        idx.push(a, b, c, b, d, c);
        idx.push(off + a, off + c, off + b, off + b, off + c, off + d);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** ellipsoid; disp(p, n) returns a radial displacement to add (for brain folds etc.) */
export function ell(c, r, opt = {}) {
  const { ws = 28, hs = 20, rot = null, disp = null, phiStart, phiLength, thetaStart, thetaLength } = opt;
  const g = new THREE.SphereGeometry(1, ws, hs, phiStart, phiLength, thetaStart, thetaLength);
  if (disp) {
    const p = g.attributes.position;
    const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      const d = 1 + disp(v.x * r.x, v.y * r.y, v.z * r.z, v);
      p.setXYZ(i, v.x * d, v.y * d, v.z * d);
    }
  }
  g.scale(r.x, r.y, r.z);
  if (rot) g.applyQuaternion(new THREE.Quaternion().setFromEuler(rot));
  g.translate(c.x, c.y, c.z);
  return g;
}

export function torus(c, R, r, normal, opt = {}) {
  const g = new THREE.TorusGeometry(R, r, opt.rs || 8, opt.ts || 28, opt.arc || Math.PI * 2);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 0, 1), normal.clone().normalize()));
  g.translate(c.x, c.y, c.z);
  return g;
}

export function box(c, s, rot = null) {
  const g = new THREE.BoxGeometry(s.x, s.y, s.z);
  if (rot) g.applyQuaternion(new THREE.Quaternion().setFromEuler(rot));
  g.translate(c.x, c.y, c.z);
  return g;
}

/** merge geometries into one, normalising attributes */
export function merge(list) {
  const gs = list.filter(Boolean).map((g) => {
    let h = g.index ? g : g;
    if (!h.index) {
      const idx = [];
      for (let i = 0; i < h.attributes.position.count; i++) idx.push(i);
      h.setIndex(idx);
    }
    for (const k of Object.keys(h.attributes)) if (k !== 'position' && k !== 'normal') h.deleteAttribute(k);
    if (!h.attributes.normal) h.computeVertexNormals();
    return h;
  });
  if (gs.length === 1) return gs[0];
  return mergeGeometries(gs, false);
}

/** apply a point warp to every vertex */
export function warpGeometry(g, fn) {
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    fn(v);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  p.needsUpdate = true;
  g.computeVertexNormals();
  g.computeBoundingBox();
  g.computeBoundingSphere();
}
