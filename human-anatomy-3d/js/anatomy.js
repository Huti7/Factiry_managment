// Builds the human body: skeleton, muscles and nervous system.
// Bones and muscles are sculpted as smooth signed-distance fields (blended bone landmarks,
// muscles made of many fibre bundles) and polygonised; nerves are swept tubes.
// Coordinates are in metres, feet on y = 0, the body faces +z, +x is the body's LEFT side.
import * as THREE from 'three';
import { V, lerp, smooth, tube, sheet, ell, box, merge, warpGeometry, rodProf } from './geometry.js';
import { femaleWarp } from './warp.js';
import {
  sphere, ellipsoid as E, capsule as C, chain, curveTube, torusSDF, U, SUB, bounds, polygonize, mirrorX,
  hit, plate, place, rcyl, rbox,
} from './sdf.js';

const SIDES = [1, -1];

let MALE = null;
export function buildBody(sex = 'male') {
  if (!MALE) MALE = buildMale();
  if (sex !== 'female') return MALE;
  return MALE.map((p) => {
    const g = p.geo.clone();
    warpGeometry(g, femaleWarp);
    return { ...p, geo: g };
  });
}

function buildMale() {
  const parts = [];
  const add = (cat, key, side, geo, label, extra = {}) => { geo.computeBoundingBox(); geo.computeBoundingSphere(); parts.push({ cat, key, side, geo, label, ...extra }); };
  const addPair = (cat, key, geoL, label, extra = {}) => { add(cat, key, 'L', geoL, label, extra); add(cat, key, 'R', mirrorX(geoL), label, { ...extra, mirrorOf: parts.length - 1 }); };
  const S = (s, x, y, z) => V(s * x, y, z);
  /** polygonise a field over the bounds of the given points */
  const solid = (f, pts, h, pad = 0.03, sm = 1) => polygonize(f, bounds(pts, pad), h, sm);

  // ---------------- frames (left side) ----------------
  const seg = (a, b) => ({ a, b });
  const LB = {
    U: seg(V(0.18, 1.40, -0.035), V(0.218, 1.105, -0.03)),
    F: seg(V(0.222, 1.095, -0.03), V(0.255, 0.865, -0.02)),
    T: seg(V(0.115, 0.88, 0.0), V(0.09, 0.51, 0.005)),
    L: seg(V(0.098, 0.48, 0.0), V(0.092, 0.09, -0.005)),
  };
  const limbs = (s) => {
    const m = (sg) => seg(V(s * sg.a.x, sg.a.y, sg.a.z), V(s * sg.b.x, sg.b.y, sg.b.z));
    return { U: m(LB.U), F: m(LB.F), T: m(LB.T), L: m(LB.L) };
  };
  /** point around a limb segment: t along it, deg (0 front, 90 lateral, 180 back, -90 medial), r radius */
  const LP = (sg, s, t, deg, r) => {
    const d = sg.b.clone().sub(sg.a);
    const dn = d.clone().normalize();
    const f = V(0, 0, 1); f.sub(dn.clone().multiplyScalar(f.dot(dn))).normalize();
    const l = V(s, 0, 0); l.sub(dn.clone().multiplyScalar(l.dot(dn))).sub(f.clone().multiplyScalar(l.dot(f))).normalize();
    const a = (deg * Math.PI) / 180;
    return sg.a.clone().add(d.multiplyScalar(t)).add(f.multiplyScalar(Math.cos(a) * r)).add(l.multiplyScalar(Math.sin(a) * r));
  };
  const lp = (k, t, deg, r) => LP(LB[k], 1, t, deg, r);

  // torso envelope (rib cage / abdomen), used to lay trunk muscles on the body
  const TORSO = [
    [1.47, 0.045, 0.045, -0.015], [1.43, 0.08, 0.075, -0.01], [1.38, 0.11, 0.095, -0.005],
    [1.30, 0.132, 0.1, -0.005], [1.22, 0.142, 0.1, -0.005], [1.14, 0.14, 0.095, -0.005],
    [1.06, 0.122, 0.085, 0.0], [1.0, 0.14, 0.085, 0.0], [0.94, 0.15, 0.09, -0.005], [0.88, 0.14, 0.09, -0.01],
  ];
  const torsoAt = (y) => {
    for (let i = 0; i < TORSO.length - 1; i++) {
      const a = TORSO[i], b = TORSO[i + 1];
      if (y <= a[0] && y >= b[0]) { const t = (a[0] - y) / (a[0] - b[0]); return [lerp(a[1], b[1], t), lerp(a[2], b[2], t), lerp(a[3], b[3], t)]; }
    }
    const e = y > TORSO[0][0] ? TORSO[0] : TORSO[TORSO.length - 1];
    return [e[1], e[2], e[3]];
  };
  const TP = (y, deg, off = 0) => {
    const [W, D, cz] = torsoAt(y);
    const a = (deg * Math.PI) / 180;
    return V(Math.sin(a) * (W + off), y, cz + Math.cos(a) * (D + off));
  };

  // ---------------- muscle building blocks ----------------
  /** one fibre bundle along control points; belly radius r with tendinous ends */
  const fasc = (ctrl, r, o = {}) => {
    const tendon = o.tendon ?? 0.3, pw = o.pw ?? 0.7, peak = o.peak ?? 0.5;
    return curveTube(ctrl, (t) => {
      const u = t < peak ? (t / peak) * 0.5 : 0.5 + ((t - peak) / (1 - peak)) * 0.5;
      return r * (tendon + (1 - tendon) * Math.pow(Math.max(0, Math.sin(Math.PI * u)), pw));
    }, o.n ?? 12);
  };
  const curveCache = new Map();
  const sampleRow = (row, u) => {
    if (row.length === 1) return row[0].clone();
    let c = curveCache.get(row);
    if (!c) { c = new THREE.CatmullRomCurve3(row, false, 'centripetal'); curveCache.set(row, c); }
    return c.getPoint(u);
  };
  /** a fan / sheet of n bundles interpolated between rows of control points (origin row ... insertion row) */
  const rowLen = (row) => { let L = 0, prev = sampleRow(row, 0); for (let i = 1; i <= 20; i++) { const q = sampleRow(row, i / 20); L += q.distanceTo(prev); prev = q; } return L; };
  const fan = (rows, n, r, o = {}) => {
    const out = [];
    const rMid = typeof r === 'function' ? r(0.5) : r;
    const maxLen = Math.max(...rows.map((row) => (row.length > 1 ? rowLen(row) : 0)));
    n = Math.max(n, Math.ceil(maxLen / (rMid * (o.spacing ?? 1.25))) + 1);
    for (let i = 0; i < n; i++) {
      const u = n === 1 ? 0.5 : i / (n - 1);
      let ctrl = rows.map((row) => sampleRow(row, u));
      if (o.adjust) ctrl = o.adjust(ctrl, u);
      const rr = typeof r === 'function' ? r(u) : r;
      out.push(fasc(ctrl, rr, o));
    }
    return out;
  };
  /** polygonise a muscle made of bundles */
  const muscle = (fs, h = 0.0018, k = null) => {
    fs = fs.flat();
    const pts = [], rmax = [];
    fs.forEach((f) => { pts.push(...f.pts); rmax.push(...f.rs); });
    const kk = k ?? Math.max(...rmax) * 1.15;
    return solid(U(kk, fs), pts, h, Math.max(...rmax) + kk + h * 3);
  };
  const tendonCol = { color: 0xe8dcc3 };

  // ======================================================================
  // SKELETON
  // ======================================================================

  // ---------------- skull ----------------
  const vault = U(0.014,
    E(V(0, 1.662, -0.012), V(0.071, 0.083, 0.094)),
    E(V(0, 1.668, 0.028), V(0.063, 0.072, 0.064)),
    E(V(0, 1.632, -0.062), V(0.058, 0.05, 0.046)));
  const vaultSurfX = (y, z, off = 0) => hit(vault, V(0.2, y, z), V(-1, 0, 0)).add(V(off, 0, 0));
  const vaultSurfZ = (x, y, off = 0) => hit(vault, V(x, y, 0.25), V(0, 0, -1)).add(V(0, 0, off));
  let skullF;
  {
    const face = U(0.012,
      E(V(0, 1.585, 0.056), V(0.035, 0.034, 0.036)),
      chain(Array.from({ length: 11 }, (_, i) => { const a = -1.45 + (i * 2.9) / 10; return V(0.029 * Math.sin(a), 1.557, 0.044 + 0.037 * Math.cos(a)); }), Array(11).fill(0.0062)),
      ...SIDES.map((s) => E(S(s, 0.05, 1.61, 0.058), V(0.013, 0.014, 0.011), new THREE.Euler(0, s * 0.5, 0))),
      ...SIDES.map((s) => chain([S(s, 0.036, 1.614, 0.078), S(s, 0.052, 1.609, 0.066), S(s, 0.062, 1.606, 0.042)], [0.0055, 0.0068, 0.005])), // cheekbone ridge
      chain([V(-0.045, 1.649, 0.08), V(0, 1.653, 0.091), V(0.045, 1.649, 0.08)], [0.006, 0.0075, 0.006]),
      C(V(0, 1.636, 0.088), V(0, 1.612, 0.1), 0.004, 0.003),
      ...SIDES.map((s) => C(S(s, 0.055, 1.6, -0.026), S(s, 0.056, 1.576, -0.022), 0.008, 0.004)),
      E(V(0, 1.598, 0.02), V(0.05, 0.022, 0.05)), // skull base / maxillary body joining the vault
    );
    let f = U(0.012, vault, face);
    for (const s of SIDES) f = SUB(f, E(S(s, 0.1, 1.638, 0.005), V(0.035, 0.04, 0.05)), 0.012); // temporal fossa
    for (const s of SIDES) f = SUB(f, rbox(S(s, 0.031, 1.633, 0.092), V(0.0185, 0.0168, 0.032), 0.0085, new THREE.Euler(0, s * 0.25, -s * 0.12)), 0.004); // orbits (rounded-square)
    f = SUB(f, E(V(0, 1.598, 0.097), V(0.0095, 0.016, 0.022)), 0.003); // nasal aperture
    for (const s of SIDES) f = U(0.004, f, chain([S(s, 0.056, 1.607, 0.05), S(s, 0.066, 1.604, 0.02), S(s, 0.065, 1.604, -0.004), S(s, 0.058, 1.606, -0.022)], [0.005, 0.0042, 0.0042, 0.005])); // zygomatic arch
    skullF = f;
    const g = [solid(f, [V(-0.085, 1.54, -0.12), V(0.085, 1.76, 0.115)], 0.0013, 0.01)];
    for (let i = 0; i < 14; i++) {
      const a = ((i - 6.5) / 6.5) * 1.35;
      g.push(box(V(0.027 * Math.sin(a), 1.543, 0.046 + 0.038 * Math.cos(a)), V(0.0058, 0.011, 0.0052), new THREE.Euler(0, a, 0)));
    }
    add('bones', 'skull', null, merge(g), 'Skull (cranium)');
    const dark = SIDES.map((s) => ell(S(s, 0.031, 1.633, 0.068), V(0.0155, 0.0138, 0.006)));
    dark.push(ell(V(0, 1.597, 0.084), V(0.006, 0.011, 0.008)));
    add('bones', 'skull', null, merge(dark), 'Skull (cranium)', { color: 0x3b2a1e });
  }
  const skullSurf = (p, dir, off = 0.002) => { const q = hit(skullF, p, dir); return q.add(dir.clone().normalize().multiplyScalar(-off)); };

  // ---------------- mandible ----------------
  {
    const fs = [];
    for (const s of SIDES) {
      const low = [S(s, 0.0, 1.495, 0.081), S(s, 0.028, 1.499, 0.064), S(s, 0.045, 1.511, 0.032), S(s, 0.052, 1.532, 0.0)];
      const up = [S(s, 0.0, 1.524, 0.079), S(s, 0.026, 1.525, 0.062), S(s, 0.04, 1.53, 0.036), S(s, 0.047, 1.546, 0.012)];
      fs.push(plate([...low, ...up.slice().reverse()], 0.0075)); // body
      fs.push(plate([S(s, 0.052, 1.532, 0.0), S(s, 0.055, 1.568, -0.01), S(s, 0.053, 1.592, -0.008), S(s, 0.052, 1.58, 0.006), S(s, 0.051, 1.594, 0.024), S(s, 0.048, 1.56, 0.022), S(s, 0.047, 1.546, 0.012)], 0.0055)); // ramus
      fs.push(chain(low, [0.005, 0.0052, 0.0052, 0.0055])); // thick lower border
      fs.push(chain([S(s, 0.052, 1.532, 0.0), S(s, 0.055, 1.568, -0.01), S(s, 0.053, 1.59, -0.008)], [0.005, 0.0042, 0.004])); // posterior border
      fs.push(E(S(s, 0.053, 1.597, -0.008), V(0.0095, 0.0045, 0.0058))); // condyle
      fs.push(chain(up, [0.0042, 0.0042, 0.0042, 0.0042])); // alveolar part
    }
    fs.push(E(V(0, 1.499, 0.082), V(0.014, 0.01, 0.0065))); // chin
    const f = U(0.006, fs);
    const g = [solid(f, [V(-0.065, 1.48, -0.025), V(0.065, 1.61, 0.095)], 0.001, 0.008)];
    for (let i = 0; i < 14; i++) {
      const a = ((i - 6.5) / 6.5) * 1.3;
      g.push(box(V(0.025 * Math.sin(a), 1.531, 0.044 + 0.036 * Math.cos(a)), V(0.0052, 0.01, 0.005), new THREE.Euler(0, a, 0)));
    }
    add('bones', 'mandible', null, merge(g), 'Mandible');
  }
  add('bones', 'hyoid', null, tube([S(-1, 0.02, 1.478, 0.005), S(-1, 0.012, 1.474, 0.03), V(0, 1.472, 0.038), S(1, 0.012, 1.474, 0.03), S(1, 0.02, 1.478, 0.005)],
    rodProf(0.003), { seg: 24, radial: 8 }), 'Hyoid bone');

  // ---------------- vertebral column ----------------
  const spine = new THREE.CatmullRomCurve3([
    V(0, 1.545, -0.012), V(0, 1.50, -0.008), V(0, 1.45, -0.02), V(0, 1.38, -0.045), V(0, 1.28, -0.06),
    V(0, 1.18, -0.052), V(0, 1.10, -0.035), V(0, 1.03, -0.02), V(0, 0.985, -0.03),
  ], false, 'centripetal');
  const verts = [];
  for (let i = 0; i < 7; i++) verts.push({ kind: i === 0 ? 'atlas' : i === 1 ? 'axis' : 'cervical', name: `C${i + 1}`, r: 0.0115, h: 0.0105, rf: 0.0085, Ls: i === 6 ? 0.022 : 0.013 + i * 0.001, Lt: 0.013, drop: 0.45, disc: 0.0045 });
  for (let i = 0; i < 12; i++) verts.push({ kind: 'thoracic', name: `T${i + 1}`, r: 0.0125 + 0.0005 * i, h: 0.0155 + 0.0005 * i, rf: 0.0072, Ls: 0.026, Lt: 0.021 - i * 0.0006, drop: 1.0, disc: 0.005 });
  for (let i = 0; i < 5; i++) verts.push({ kind: 'lumbar', name: `L${i + 1}`, r: 0.0195 + 0.0007 * i, h: 0.0245, rf: 0.0085, Ls: 0.022, Lt: 0.024 + (i === 2 ? 0.004 : 0), drop: 0.12, disc: 0.0085 });
  const total = verts.reduce((a, v) => a + v.h + v.disc, 0);
  let acc = 0;
  const cordPts = [], vInfo = [], discs = [];
  verts.forEach((v, vi) => {
    const u = (acc + (v.h + v.disc) / 2) / total;
    acc += v.h + v.disc;
    const c = spine.getPointAt(u);
    const up = spine.getTangentAt(u).negate().normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), up);
    const zc = -(v.r * 0.85 + v.rf * 0.6);
    const fs = [];
    if (v.kind === 'atlas') {
      fs.push(torusSDF(V(0, 0, -0.004), 0.0145, 0.0032, V(0, 1, 0)));
      for (const s of [1, -1]) {
        fs.push(E(V(s * 0.0125, 0, -0.002), V(0.0055, 0.0055, 0.0075)));
        fs.push(C(V(s * 0.016, 0, -0.004), V(s * 0.03, 0.001, -0.006), 0.0042, 0.0034));
      }
      fs.push(E(V(0, 0, -0.019), V(0.004, 0.003, 0.003)));
    } else {
      const zs = v.kind === 'cervical' || v.kind === 'axis' ? 0.75 : 0.8;
      fs.push(rcyl(v.r, v.h, 0.0025, zs));
      if (v.kind === 'axis') fs.push(C(V(0, v.h / 2, 0), V(0, v.h / 2 + 0.014, 0.001), 0.0048, 0.0036));
      for (const s of [1, -1]) {
        const ped = V(s * v.rf * 0.95, 0, zc + v.rf * 0.25);
        fs.push(C(V(s * v.r * 0.55, 0, -v.r * 0.6), ped, v.rf * 0.33));
        fs.push(C(ped, V(0, -0.001, zc - v.rf * 0.95), 0.0026)); // lamina
        fs.push(C(ped, V(s * (v.rf + v.Lt), 0.002, zc - 0.006), 0.0028, 0.0033)); // transverse process
        fs.push(C(ped.clone().add(V(0, v.h * 0.15, -0.003)), ped.clone().add(V(0, v.h * 0.62, -0.004)), 0.0024)); // superior articular
        fs.push(C(ped.clone().add(V(0, -v.h * 0.1, -0.005)), ped.clone().add(V(0, -v.h * 0.6, -0.006)), 0.0024)); // inferior articular
      }
      const sp0 = V(0, -0.001, zc - v.rf * 0.95);
      const tip = sp0.clone().add(V(0, -v.drop, -1).normalize().multiplyScalar(v.Ls));
      fs.push(C(sp0, tip, v.kind === 'lumbar' ? 0.0045 : 0.003, v.kind === 'lumbar' ? 0.004 : 0.0028));
      if (v.kind === 'cervical' && v.name !== 'C7') for (const s of [1, -1]) fs.push(E(tip.clone().add(V(s * 0.003, 0, 0)), V(0.003, 0.003, 0.003))); // bifid tip
    }
    let lf = U(0.003, fs);
    if (v.kind !== 'atlas') lf = SUB(lf, E(V(0, 0, zc + v.rf * 0.1), V(v.rf * 0.75, 0.05, v.rf * 0.72)), 0.002); // vertebral foramen
    const f = place(lf, c, q);
    const R = 0.062;
    add('bones', v.kind, null, solid(f, [c.clone().addScalar(-R), c.clone().addScalar(R)], 0.0009, 0.0, 0), `${v.name} vertebra`);
    const cp = V(0, 0, v.kind === 'atlas' ? -0.004 : zc).applyQuaternion(q).add(c);
    cordPts.push(cp);
    vInfo.push({ ...v, c, cord: cp, q, up });
    // intervertebral disc below this vertebra (none between C1 and C2)
    const nxt = verts[vi + 1];
    if (v.kind !== 'atlas' && nxt) {
      const ud = (acc - v.disc / 2) / total;
      const dc = spine.getPointAt(ud), dq = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), spine.getTangentAt(ud).negate().normalize());
      const rr = (v.r + nxt.r) / 2;
      const d = new THREE.CylinderGeometry(rr * 0.97, rr * 0.97, v.disc * 1.2, 22, 1);
      d.scale(1, 1, 0.8); d.applyQuaternion(dq); d.translate(dc.x, dc.y, dc.z);
      discs.push(d);
    }
  });
  add('bones', 'discs', null, merge(discs), 'Intervertebral discs', { color: 0xbfc0a8 });
  const T = (n) => vInfo[6 + n];

  // ---------------- sacrum & coccyx ----------------
  {
    const fs = [
      plate([V(-0.052, 0.986, -0.047), V(0.052, 0.986, -0.047), V(0.036, 0.93, -0.068), V(0.012, 0.884, -0.082), V(-0.012, 0.884, -0.082), V(-0.036, 0.93, -0.068)], 0.013),
      E(V(0, 0.976, -0.038), V(0.024, 0.011, 0.016)), // S1 body / promontory
      E(V(0, 0.95, -0.052), V(0.019, 0.016, 0.011)), E(V(0, 0.92, -0.065), V(0.014, 0.014, 0.009)),
      E(V(0.036, 0.975, -0.05), V(0.019, 0.014, 0.015)), E(V(-0.036, 0.975, -0.05), V(0.019, 0.014, 0.015)), // alae
      chain([V(0, 0.98, -0.066), V(0, 0.94, -0.078), V(0, 0.905, -0.088)], [0.0035, 0.003, 0.0025]), // median crest
    ];
    let f = U(0.008, fs);
    for (let i = 0; i < 4; i++) for (const s of SIDES) {
      const y = 0.966 - i * 0.022, x = 0.019 - i * 0.002;
      f = SUB(f, sphere(V(s * x, y, -0.037 - i * 0.012), 0.0042 - i * 0.0004), 0.002); // anterior foramina
      f = SUB(f, sphere(V(s * x, y - 0.002, -0.07 - i * 0.008), 0.0032), 0.002); // posterior foramina
    }
    add('bones', 'sacrum', null, solid(f, [V(-0.07, 0.87, -0.1), V(0.07, 1.0, -0.02)], 0.0011, 0.006), 'Sacrum');
    const cf = U(0.002, E(V(0, 0.876, -0.083), V(0.009, 0.006, 0.005)), E(V(0, 0.866, -0.081), V(0.007, 0.005, 0.0045)), E(V(0, 0.857, -0.077), V(0.0055, 0.0045, 0.004)), E(V(0, 0.849, -0.072), V(0.004, 0.004, 0.0035)));
    add('bones', 'coccyx', null, solid(cf, [V(-0.012, 0.84, -0.09), V(0.012, 0.885, -0.065)], 0.0006, 0.004), 'Coccyx');
  }

  // ---------------- sternum ----------------
  {
    let f = U(0.008,
      E(V(0, 1.398, 0.075), V(0.027, 0.022, 0.0075), new THREE.Euler(-0.15, 0, 0)),
      E(V(0, 1.31, 0.085), V(0.0175, 0.06, 0.0068), new THREE.Euler(-0.1, 0, 0)),
      C(V(0, 1.252, 0.089), V(0, 1.222, 0.091), 0.0055, 0.0025));
    f = SUB(f, sphere(V(0, 1.425, 0.074), 0.009), 0.003);
    add('bones', 'sternum', null, solid(f, [V(-0.04, 1.21, 0.06), V(0.04, 1.43, 0.1)], 0.0009, 0.006), 'Sternum');
  }

  // ---------------- ribs & costal cartilages ----------------
  const RW = [0.055, 0.08, 0.098, 0.112, 0.122, 0.13, 0.135, 0.137, 0.136, 0.13, 0.12, 0.105];
  const RZ = [0.06, 0.072, 0.08, 0.086, 0.09, 0.092, 0.092, 0.088, 0.08, 0.068, 0.03, 0.0];
  const RS = [1.40, 1.375, 1.35, 1.325, 1.30, 1.275, 1.25];
  const ribCurves = [];
  const cart = { 1: [], [-1]: [] };
  for (const s of SIDES) {
    for (let i = 1; i <= 12; i++) {
      const tv = T(i), yb = tv.c.y, zv = tv.c.z, W = RW[i - 1], zf = RZ[i - 1];
      const zb = zv - 0.04;
      let pts;
      if (i <= 10) {
        const ys = i <= 7 ? RS[i - 1] : 1.24 - 0.025 * (i - 7);
        const yLow = Math.min(yb - 0.05 - 0.007 * i, ys - 0.012);
        const end = i <= 7 ? S(s, 0.022, ys, 0.083) : S(s, 0.03 + 0.016 * (i - 7), ys, 0.078 - 0.004 * (i - 7));
        pts = [S(s, 0.012, yb + 0.003, zv - 0.008), S(s, 0.035, yb, zv - 0.032), S(s, 0.6 * W, yb - 0.01, zb),
          S(s, W, yb - 0.6 * (yb - yLow), (zb + zf) * 0.3), S(s, 0.75 * W, yLow, zf * 0.85),
          S(s, 0.4 * W + 0.01, (yLow + ys) / 2 - 0.004, zf), end];
      } else {
        pts = [S(s, 0.012, yb + 0.003, zv - 0.008), S(s, 0.035, yb, zv - 0.032), S(s, 0.6 * W, yb - 0.012, zb),
          S(s, W, yb - 0.04, (zb + zf) * 0.3 - 0.01), S(s, 0.85 * W, yb - 0.065, zf)];
      }
      const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
      const tc = i === 1 ? 0.8 : i <= 7 ? 0.8 - i * 0.012 : i <= 10 ? 0.62 : 1;
      const sampleSeg = (t0, t1, n) => Array.from({ length: n + 1 }, (_, k) => curve.getPointAt(t0 + ((t1 - t0) * k) / n));
      const r = i === 1 ? 0.0048 : 0.0043;
      const g = tube(sampleSeg(0, tc, 24), rodProf(r, i <= 10 ? r * 0.95 : r * 0.55), { seg: 48, radial: 10, width: (t) => 1.25 + 0.7 * smooth(0, 0.25, t), thick: 0.6, hint: (p) => V(p.x, 0, p.z) });
      const key = i <= 7 ? 'trueRibs' : i <= 10 ? 'falseRibs' : 'floatingRibs';
      add('bones', key, s > 0 ? 'L' : 'R', g, `Rib ${i}`);
      if (tc < 1) cart[s].push(tube(sampleSeg(tc - 0.01, 1, 14), rodProf(r * 0.85, r * 0.8), { seg: 24, radial: 10, width: 1.3, thick: 0.75, hint: (p) => V(p.x, 0, p.z) }));
      ribCurves.push({ s, i, pts, curve });
    }
  }
  add('bones', 'costalCartilages', 'L', merge(cart[1]), 'Costal cartilages', { color: 0xd6d9c6 });
  add('bones', 'costalCartilages', 'R', merge(cart[-1]), 'Costal cartilages', { color: 0xd6d9c6 });

  // ---------------- shoulder girdle (left, mirrored) ----------------
  addPair('bones', 'clavicle', tube([V(0.02, 1.425, 0.072), V(0.07, 1.432, 0.078), V(0.13, 1.44, 0.04), V(0.172, 1.447, -0.002)],
    (t) => (0.0072 + 0.0032 * (smooth(0, 0.1, 0.1 - t) + smooth(0.85, 1, t))) * Math.min(1, Math.sin(Math.PI * Math.min(t, 1 - t)) * 6 + 0.35),
    { seg: 36, radial: 14, width: (t) => 1.1 + 0.5 * smooth(0.6, 1, t), thick: (t) => 1 - 0.3 * smooth(0.6, 1, t), hint: V(0, 1, 0) }), 'Clavicle');
  const humHead = V(0.172, 1.392, -0.035);
  {
    const blade = plate([V(0.058, 1.405, -0.1), V(0.1, 1.41, -0.09), V(0.128, 1.402, -0.073), V(0.142, 1.375, -0.06), V(0.12, 1.33, -0.086), V(0.083, 1.252, -0.106),
      V(0.07, 1.29, -0.11), V(0.061, 1.34, -0.111)], 0.0028);
    const fs = [
      blade,
      chain([V(0.058, 1.405, -0.1), V(0.061, 1.34, -0.111), V(0.07, 1.29, -0.11), V(0.083, 1.252, -0.106)], [0.0028, 0.003, 0.003, 0.004]), // medial border
      chain([V(0.142, 1.375, -0.058), V(0.12, 1.33, -0.087), V(0.083, 1.252, -0.106)], [0.006, 0.0045, 0.004]), // lateral border
      chain([V(0.06, 1.375, -0.108), V(0.1, 1.386, -0.12), V(0.14, 1.405, -0.108), V(0.16, 1.43, -0.072), V(0.172, 1.443, -0.04)], [0.0025, 0.004, 0.0055, 0.0055, 0.005]), // spine of scapula
      E(V(0.171, 1.444, -0.035), V(0.017, 0.005, 0.021), new THREE.Euler(0.15, -0.3, 0.1)), // acromion
      chain([V(0.125, 1.405, -0.05), V(0.131, 1.412, -0.018), V(0.136, 1.404, 0.008)], [0.0055, 0.0048, 0.004]), // coracoid
      C(V(0.142, 1.38, -0.058), V(0.15, 1.39, -0.047), 0.009, 0.01), // neck
    ];
    let f = U(0.006, fs);
    f = U(0.003, f, SUB(E(V(0.151, 1.39, -0.046), V(0.008, 0.02, 0.014)), sphere(humHead.clone().add(V(0.003, 0, 0)), 0.022), 0.002)); // glenoid cavity
    addPair('bones', 'scapula', solid(f, [V(0.04, 1.23, -0.13), V(0.2, 1.46, 0.02)], 0.0011, 0.006), 'Scapula');
  }

  // ---------------- arm (left, mirrored) ----------------
  const rcylAt = (c, r, h) => place(rcyl(r, h, 0.003), c, new THREE.Quaternion());
  {
    const f = SUB(U(0.008,
      sphere(humHead, 0.0215),
      E(V(0.19, 1.392, -0.028), V(0.011, 0.016, 0.013)), E(V(0.18, 1.384, -0.012), V(0.007, 0.01, 0.007)),
      chain([V(0.185, 1.38, -0.032), V(0.195, 1.3, -0.034), V(0.205, 1.2, -0.034), V(0.212, 1.14, -0.032)], [0.0125, 0.0112, 0.0108, 0.012]),
      E(V(0.205, 1.27, -0.029), V(0.006, 0.02, 0.007)),
      E(V(0.216, 1.12, -0.032), V(0.024, 0.017, 0.0105)),
      E(V(0.193, 1.112, -0.036), V(0.009, 0.008, 0.008)), E(V(0.238, 1.113, -0.032), V(0.006, 0.007, 0.007)),
      E(V(0.208, 1.098, -0.027), V(0.0105, 0.009, 0.011)), sphere(V(0.228, 1.1, -0.021), 0.008),
    ), E(V(0.215, 1.122, -0.046), V(0.008, 0.01, 0.0055)), 0.003);
    addPair('bones', 'humerus', solid(f, [V(0.14, 1.08, -0.07), V(0.26, 1.42, 0.01)], 0.0012, 0.004), 'Humerus');
    const fu = SUB(U(0.006,
      E(V(0.21, 1.116, -0.046), V(0.009, 0.015, 0.0105)), E(V(0.211, 1.09, -0.019), V(0.007, 0.006, 0.009)),
      chain([V(0.211, 1.098, -0.038), V(0.222, 1.0, -0.034), V(0.235, 0.9, -0.03), V(0.24, 0.866, -0.028)], [0.0095, 0.0065, 0.005, 0.0066]),
      C(V(0.24, 0.866, -0.031), V(0.242, 0.853, -0.035), 0.003, 0.0018),
    ), sphere(V(0.208, 1.098, -0.027), 0.0108), 0.002);
    addPair('bones', 'ulna', solid(fu, [V(0.19, 0.84, -0.07), V(0.26, 1.14, 0.0)], 0.0009, 0.004), 'Ulna');
    const fr = U(0.006,
      rcylAt(V(0.232, 1.087, -0.02), 0.0105, 0.009),
      chain([V(0.232, 1.084, -0.02), V(0.234, 1.068, -0.016), V(0.248, 1.0, -0.016), V(0.258, 0.92, -0.015), V(0.263, 0.878, -0.014)], [0.006, 0.007, 0.0066, 0.008, 0.011]),
      E(V(0.26, 0.872, -0.016), V(0.018, 0.0075, 0.0105)),
      C(V(0.275, 0.868, -0.014), V(0.279, 0.856, -0.013), 0.004, 0.002));
    addPair('bones', 'radius', solid(fr, [V(0.21, 0.84, -0.04), V(0.29, 1.1, 0.0)], 0.0009, 0.004), 'Radius');
  }

  // ---------------- hand (left, palm forward, mirrored) ----------------
  {
    const carp = [
      E(V(0.273, 0.853, -0.016), V(0.0068, 0.0058, 0.0085), new THREE.Euler(0, 0, 0.4)), E(V(0.262, 0.854, -0.017), V(0.0058, 0.0062, 0.0085)),
      E(V(0.252, 0.852, -0.018), V(0.0055, 0.0058, 0.0075)), E(V(0.245, 0.85, -0.008), V(0.004, 0.0045, 0.0045)),
      E(V(0.276, 0.838, -0.013), V(0.0065, 0.006, 0.0075)), E(V(0.266, 0.837, -0.016), V(0.0052, 0.0058, 0.007)),
      E(V(0.256, 0.835, -0.017), V(0.0062, 0.0085, 0.0085)), E(V(0.245, 0.836, -0.017), V(0.006, 0.0075, 0.008)),
    ];
    addPair('bones', 'carpals', solid(U(0.0012, carp), [V(0.235, 0.825, -0.03), V(0.285, 0.862, -0.002)], 0.0006, 0.003), 'Carpal bones');
    const cx = 0.256;
    const off = [0.022, 0.012, 0.002, -0.008, -0.017];
    const mcEndY = [0.80, 0.766, 0.762, 0.768, 0.776];
    const prox = [0.03, 0.04, 0.045, 0.042, 0.033], mid = [0, 0.024, 0.028, 0.026, 0.019], dist = [0.022, 0.018, 0.019, 0.018, 0.016];
    const mcF = [], phF = [];
    const longBone = (a, b, ra, rs, rb) => {
      const d = b.clone().sub(a);
      return U(0.003, C(a.clone().addScaledVector(d, 0.12), b.clone().addScaledVector(d, -0.12), rs * 1.05, rs * 0.95), sphere(a.clone().addScaledVector(d, 0.1), ra), sphere(b.clone().addScaledVector(d, -0.08), rb));
    };
    for (let fI = 0; fI < 5; fI++) {
      let a, b;
      if (fI === 0) { a = V(cx + 0.017, 0.836, -0.008); b = V(cx + 0.029, 0.8, 0.014); }
      else { a = V(cx + off[fI] * 0.6, 0.83, -0.016); b = V(cx + off[fI], mcEndY[fI], -0.012); }
      mcF.push(longBone(a, b, fI === 0 ? 0.0055 : 0.0048, fI === 0 ? 0.0038 : 0.0031, fI === 0 ? 0.0052 : 0.0047));
      let dir = b.clone().sub(a).normalize();
      if (fI > 0) dir = dir.lerp(V(off[fI] * 1.5, -1, 0.06), 0.6).normalize();
      else dir = dir.lerp(V(0.1, -1, 0.35), 0.45).normalize();
      let p = b.clone().add(dir.clone().multiplyScalar(0.0045));
      const lens = [prox[fI], mid[fI], dist[fI]].filter((x) => x > 0);
      lens.forEach((len, k) => {
        const q = p.clone().add(dir.clone().multiplyScalar(len));
        const rr = (fI === 0 ? 0.0048 : 0.0043) - k * 0.0006;
        const last = k === lens.length - 1;
        phF.push(last ? U(0.002, C(p, q.clone().addScaledVector(dir, -0.003), rr * 0.75, rr * 0.55), sphere(p.clone().addScaledVector(dir, 0.003), rr), E(q.clone().addScaledVector(dir, -0.003), V(rr * 0.85, rr * 0.6, rr * 0.6)))
          : longBone(p, q, rr, rr * 0.68, rr * 0.82));
        p = q.clone().add(dir.clone().multiplyScalar(0.002));
        dir = dir.lerp(V(0, -0.4, 0.92), fI === 0 ? 0.15 : 0.42).normalize();
      });
    }
    addPair('bones', 'metacarpals', solid(U(0, mcF), [V(0.225, 0.75, -0.03), V(0.3, 0.845, 0.025)], 0.0006, 0.004), 'Metacarpals');
    addPair('bones', 'handPhalanges', solid(U(0, phF), [V(0.22, 0.64, -0.03), V(0.32, 0.81, 0.05)], 0.0006, 0.004), 'Phalanges of the hand');
  }

  // ---------------- pelvis (left, mirrored) ----------------
  const H = V(0.088, 0.905, 0.005);
  {
    const crest = [V(0.118, 1.0, 0.057), V(0.138, 1.028, 0.025), V(0.14, 1.043, -0.012), V(0.124, 1.046, -0.045), V(0.095, 1.033, -0.068), V(0.06, 1.008, -0.082), V(0.05, 0.99, -0.08)];
    const wing = plate([
      V(0.118, 1.0, 0.057), V(0.138, 1.028, 0.025), V(0.14, 1.043, -0.012), V(0.124, 1.046, -0.045), V(0.095, 1.033, -0.068), V(0.06, 1.008, -0.082),
      V(0.048, 0.975, -0.068), V(0.07, 0.94, -0.052), V(0.088, 0.93, -0.03), V(0.098, 0.928, 0.0), V(0.106, 0.945, 0.042),
    ], 0.0055, [V(0.11, 0.985, -0.01), V(0.09, 0.99, -0.045)]);
    const fs = [
      wing,
      chain(crest, [0.0065, 0.006, 0.0058, 0.0058, 0.006, 0.007, 0.0065]),
      E(V(0.118, 1.0, 0.057), V(0.007, 0.008, 0.007)), // ASIS
      E(V(0.105, 0.945, 0.045), V(0.006, 0.007, 0.006)), // AIIS
      E(V(0.062, 0.97, -0.072), V(0.013, 0.025, 0.012)), // auricular (sacroiliac) region
      chain([V(0.085, 0.885, 0.03), V(0.06, 0.898, 0.047), V(0.03, 0.897, 0.058), V(0.012, 0.892, 0.062)], [0.0085, 0.007, 0.0065, 0.0065]), // superior pubic ramus
      E(V(0.0105, 0.876, 0.058), V(0.0055, 0.018, 0.009)), // symphyseal surface
      chain([V(0.012, 0.862, 0.054), V(0.03, 0.845, 0.04), V(0.05, 0.832, 0.02), V(0.068, 0.825, -0.005)], [0.0065, 0.0055, 0.006, 0.008]), // inferior ramus
      E(V(0.074, 0.827, -0.018), V(0.011, 0.02, 0.014)), // ischial tuberosity
      chain([V(0.078, 0.835, -0.025), V(0.086, 0.865, -0.03), V(0.088, 0.89, -0.025)], [0.009, 0.0095, 0.011]), // ischium body
      chain([V(0.086, 0.872, -0.036), V(0.07, 0.874, -0.05)], [0.0045, 0.0022]), // ischial spine
      chain([V(0.088, 0.93, -0.03), V(0.07, 0.94, -0.052), V(0.05, 0.96, -0.068)], [0.006, 0.0055, 0.006]), // greater sciatic notch rim
    ];
    let f = U(0.007, fs);
    const acet = SUB(E(H.clone().add(V(-0.006, 0.0, -0.002)), V(0.022, 0.03, 0.03)), sphere(H, 0.0245), 0.002);
    f = U(0.006, SUB(f, sphere(H, 0.0245), 0.002), acet);
    addPair('bones', 'hipBone', solid(f, [V(0.0, 0.8, -0.1), V(0.155, 1.06, 0.075)], 0.0013, 0.006), 'Hip bone (os coxae)');
  }

  // ---------------- leg (left, mirrored) ----------------
  {
    const ff = SUB(U(0.01,
      sphere(H, 0.0232),
      C(H, V(0.118, 0.886, -0.002), 0.0145, 0.016),
      E(V(0.128, 0.893, -0.012), V(0.015, 0.024, 0.02)),
      E(V(0.104, 0.842, -0.016), V(0.008, 0.01, 0.008)),
      C(V(0.128, 0.885, -0.025), V(0.106, 0.845, -0.018), 0.005),
      chain([V(0.122, 0.875, -0.002), V(0.115, 0.78, 0.004), V(0.105, 0.66, 0.007), V(0.095, 0.56, 0.002)], [0.0165, 0.0135, 0.013, 0.016]),
      C(V(0.115, 0.79, -0.009), V(0.1, 0.6, -0.008), 0.0045),
      E(V(0.075, 0.513, -0.008), V(0.0165, 0.022, 0.029)), E(V(0.11, 0.515, -0.008), V(0.016, 0.022, 0.028)),
      E(V(0.092, 0.53, 0.01), V(0.023, 0.02, 0.014)),
      E(V(0.068, 0.522, -0.004), V(0.008, 0.01, 0.01)), E(V(0.118, 0.524, -0.004), V(0.007, 0.009, 0.009)),
    ), E(V(0.092, 0.5, -0.022), V(0.0065, 0.016, 0.022)), 0.004);
    addPair('bones', 'femur', solid(ff, [V(0.04, 0.48, -0.05), V(0.155, 0.935, 0.04)], 0.0014, 0.004), 'Femur');
    addPair('bones', 'patella', solid(U(0.006, E(V(0.092, 0.524, 0.043), V(0.021, 0.022, 0.009)), E(V(0.092, 0.506, 0.042), V(0.011, 0.012, 0.007))),
      [V(0.065, 0.49, 0.025), V(0.12, 0.555, 0.06)], 0.0008, 0.003), 'Patella');
    const ft = U(0.009,
      E(V(0.075, 0.47, 0.0), V(0.02, 0.012, 0.026)), E(V(0.11, 0.47, -0.002), V(0.02, 0.012, 0.024)),
      E(V(0.092, 0.48, 0.0), V(0.005, 0.007, 0.008)),
      E(V(0.092, 0.44, 0.024), V(0.009, 0.014, 0.007)),
      chain([V(0.092, 0.45, 0.004), V(0.09, 0.38, 0.008), V(0.088, 0.25, 0.01), V(0.086, 0.13, 0.004), V(0.085, 0.092, 0.0)], [0.02, 0.0145, 0.0122, 0.0135, 0.018]),
      C(V(0.092, 0.42, 0.02), V(0.088, 0.18, 0.019), 0.004, 0.0035),
      E(V(0.072, 0.072, 0.002), V(0.0068, 0.016, 0.011)));
    addPair('bones', 'tibia', solid(ft, [V(0.05, 0.05, -0.035), V(0.135, 0.495, 0.04)], 0.0013, 0.004), 'Tibia');
    const ffib = U(0.006, E(V(0.122, 0.462, -0.014), V(0.0095, 0.011, 0.01)),
      chain([V(0.122, 0.455, -0.014), V(0.12, 0.3, -0.014), V(0.121, 0.12, -0.01), V(0.123, 0.075, -0.01)], [0.0058, 0.0055, 0.0058, 0.0075]),
      E(V(0.124, 0.064, -0.012), V(0.0068, 0.019, 0.01)));
    addPair('bones', 'fibula', solid(ffib, [V(0.105, 0.04, -0.03), V(0.14, 0.48, 0.005)], 0.0011, 0.004), 'Fibula');
    // foot
    addPair('bones', 'talus', solid(U(0.004, E(V(0.096, 0.066, -0.002), V(0.016, 0.013, 0.019)), E(V(0.09, 0.06, 0.025), V(0.0105, 0.009, 0.011))),
      [V(0.07, 0.045, -0.025), V(0.12, 0.085, 0.04)], 0.0008, 0.003), 'Talus');
    addPair('bones', 'calcaneus', solid(U(0.006, E(V(0.098, 0.03, -0.05), V(0.015, 0.022, 0.018)), E(V(0.1, 0.035, -0.015), V(0.017, 0.016, 0.03)),
      E(V(0.108, 0.033, 0.022), V(0.012, 0.011, 0.012)), E(V(0.084, 0.045, -0.008), V(0.008, 0.005, 0.01))),
    [V(0.07, 0.0, -0.075), V(0.13, 0.06, 0.04)], 0.0009, 0.003), 'Calcaneus');
    addPair('bones', 'tarsals', solid(U(0.0015,
      E(V(0.083, 0.058, 0.04), V(0.016, 0.011, 0.008), new THREE.Euler(0, 0, -0.3)), E(V(0.117, 0.032, 0.04), V(0.012, 0.011, 0.015)),
      E(V(0.068, 0.045, 0.06), V(0.0068, 0.0125, 0.012)), E(V(0.081, 0.046, 0.058), V(0.006, 0.011, 0.01)), E(V(0.096, 0.04, 0.057), V(0.0068, 0.011, 0.011))),
    [V(0.055, 0.015, 0.02), V(0.135, 0.075, 0.075)], 0.0008, 0.003), 'Navicular, cuboid & cuneiforms');
    const xs = [0.066, 0.081, 0.094, 0.107, 0.121], xd = [0.06, 0.077, 0.092, 0.106, 0.12];
    const yp = [0.044, 0.04, 0.036, 0.032, 0.029], zp = [0.07, 0.07, 0.068, 0.062, 0.052], zd = [0.15, 0.145, 0.138, 0.128, 0.115];
    const rr = [0.0072, 0.0048, 0.0046, 0.0045, 0.0048];
    const pp = [0.028, 0.02, 0.018, 0.016, 0.015], pm = [0, 0.011, 0.01, 0.009, 0.008], pd = [0.02, 0.009, 0.009, 0.008, 0.008];
    const mt = [], tp = [];
    for (let k = 0; k < 5; k++) {
      const a = V(xs[k], yp[k], zp[k]), b = V(xd[k], 0.017, zd[k]);
      const d = b.clone().sub(a);
      mt.push(U(0.003, C(a, b, rr[k] * 0.85, rr[k] * 0.7), E(a.clone().addScaledVector(d, 0.05), V(rr[k] * 1.15, rr[k] * 1.4, rr[k] * 1.2)), sphere(b.clone().addScaledVector(d, -0.04), rr[k] * 1.12)));
      let p = b.clone().add(V(0, -0.001, 0.005));
      [pp[k], pm[k], pd[k]].filter((x) => x > 0).forEach((len, j) => {
        const q = p.clone().add(V(0, -0.002, len));
        const r = (k === 0 ? 0.0068 : 0.0043) * (1 - j * 0.12);
        tp.push(U(0.002, C(p, q, r * 0.8, r * 0.65), sphere(p.clone().add(V(0, 0, 0.002)), r), sphere(q.clone().add(V(0, 0, -0.002)), r * 0.78)));
        p = q.clone().add(V(0, -0.0005, 0.0025));
      });
    }
    addPair('bones', 'metatarsals', solid(U(0, mt), [V(0.045, 0.005, 0.045), V(0.135, 0.06, 0.165)], 0.0007, 0.004), 'Metatarsals');
    addPair('bones', 'footPhalanges', solid(U(0, tp), [V(0.045, 0.0, 0.135), V(0.135, 0.035, 0.215)], 0.0006, 0.004), 'Phalanges of the foot');
  }

  // ======================================================================
  // MUSCLES (left side sculpted from fibre bundles, then mirrored)
  // ======================================================================
  const mp = (key, fs, label, h, extra) => addPair('muscles', key, muscle(fs, h), label, extra);
  const skC = V(0, 1.655, -0.005);
  const toward = (p) => skC.clone().sub(p).normalize();
  /** project p onto the skull along dir (falls back to aiming at the skull centre if the ray misses) */
  const skAt = (p, off, dir = null) => {
    const d = (dir || toward(p)).clone().normalize();
    const q = hit(skullF, p, d);
    if (q.distanceTo(p) < 1e-6) return skullSurf(p, toward(p), off);
    return q.add(d.multiplyScalar(-off));
  };
  const sk = (y, z, off = 0.0025) => skAt(V(0.2, y, z), off, V(-1, 0, 0)); // lateral skull surface point
  const skF = (x, y, off = 0.0025) => skAt(V(x, y, 0.25), off, V(0, 0, -1)); // frontal skull surface point

  // ---- head ----
  {
    const fr = [];
    for (let i = 0; i < 16; i++) {
      const x = -0.046 + (i * 0.092) / 15;
      if (Math.abs(x) < 0.006) continue;
      fr.push(fasc([skF(x, 1.72, 0.002), skF(x, 1.695, 0.003), skF(x * 1.02, 1.664, 0.003)], 0.0042, { tendon: 0.75 }));
    }
    for (const s of SIDES) for (let i = 0; i < 3; i++) {
      fr.push(fasc([skAt(V(s * (0.02 + i * 0.012), 1.7, -0.3), 0.002, V(0, 0, 1)), skAt(V(s * (0.022 + i * 0.012), 1.645, -0.3), 0.003, V(0, 0, 1))], 0.0032, { tendon: 0.5 }));
    }
    add('muscles', 'frontalis', null, muscle(fr, 0.0011), 'Frontalis (occipitofrontalis)');

    const tOrig = [[1.675, 0.045], [1.698, 0.022], [1.708, -0.008], [1.703, -0.036], [1.684, -0.06], [1.66, -0.074]].map(([y, z]) => sk(y, z, 0.0025));
    const tMid = [[1.63, 0.032], [1.632, 0.022], [1.632, 0.01], [1.63, -0.002], [1.628, -0.012], [1.626, -0.02]].map(([y, z]) => sk(y, z, 0.006));
    const tIns = [V(0.052, 1.59, 0.027), V(0.053, 1.588, 0.024)];
    mp('temporalis', fan([tOrig, tMid, tIns], 9, 0.0042, { tendon: 0.5, peak: 0.3, spacing: 1.0 }), 'Temporalis', 0.0011);
    mp('masseter', fan([[V(0.058, 1.598, 0.046), V(0.066, 1.6, 0.022), V(0.066, 1.6, 0.0)], [V(0.064, 1.566, 0.034), V(0.069, 1.566, 0.016), V(0.066, 1.568, 0.0)], [V(0.051, 1.522, 0.03), V(0.058, 1.528, 0.014), V(0.058, 1.536, -0.002)]], 6, 0.0068, { tendon: 0.65, spacing: 1.0 }), 'Masseter', 0.0011);
    const oc = V(0.031, 1.633, 0.084);
    const ring = (c, rx, ry, n, zf) => Array.from({ length: n + 1 }, (_, i) => { const a = (i / n) * Math.PI * 2; return V(c.x + rx * Math.cos(a), c.y + ry * Math.sin(a), zf(a)); });
    const surfZ = (x, y, off) => skAt(V(x, y, 0.3), off, V(0, 0, -1)).z;
    mp('orbicularisOculi', [0.0165, 0.02, 0.0235].map((k) => curveTube(ring(oc, k, k * 0.88, 20, (a) => surfZ(oc.x + k * Math.cos(a), oc.y + k * 0.88 * Math.sin(a), 0.0016)), () => 0.0022, 40)), 'Orbicularis oculi', 0.0008);
    add('muscles', 'orbicularisOris', null, muscle([0.016, 0.0205, 0.025].map((k) => curveTube(ring(V(0, 1.541, 0), k, k * 0.5, 20, (a) => 0.052 + 0.039 * Math.sqrt(Math.max(0, 1 - ((k * Math.cos(a)) / 0.034) ** 2))), () => 0.0026, 40)), 0.0008), 'Orbicularis oris');
    mp('zygomaticus', [fasc([V(0.057, 1.602, 0.073), V(0.046, 1.578, 0.088), V(0.026, 1.548, 0.097)], 0.0036, { tendon: 0.5 }), fasc([V(0.047, 1.612, 0.08), V(0.036, 1.585, 0.093), V(0.023, 1.553, 0.099)], 0.0026, { tendon: 0.5 })], 'Zygomaticus major', 0.0009);
  }
  // ---- neck ----
  mp('sternocleidomastoid', [
    fasc([V(0.012, 1.425, 0.08), V(0.028, 1.47, 0.06), V(0.045, 1.53, 0.012), V(0.056, 1.588, -0.022)], 0.0075, { peak: 0.4, tendon: 0.35 }),
    fasc([V(0.035, 1.437, 0.075), V(0.04, 1.48, 0.045), V(0.05, 1.535, 0.005), V(0.058, 1.585, -0.025)], 0.0068, { peak: 0.45, tendon: 0.35 }),
  ], 'Sternocleidomastoid', 0.0013);
  mp('scalenes', fan([[V(0.03, 1.52, -0.012), V(0.032, 1.48, -0.018)], [V(0.04, 1.47, 0.0), V(0.05, 1.44, -0.01)], [V(0.04, 1.405, 0.03), V(0.062, 1.395, 0.0)]], 3, 0.0055), 'Scalenes', 0.0013);
  mp('levatorScapulae', [fasc([V(0.032, 1.54, -0.02), V(0.045, 1.48, -0.05), V(0.058, 1.41, -0.095)], 0.0065)], 'Levator scapulae', 0.0013);
  mp('spleniusCapitis', fan([[V(0.004, 1.455, -0.075), V(0.004, 1.4, -0.098)], [V(0.025, 1.52, -0.06), V(0.03, 1.5, -0.065)], [V(0.04, 1.6, -0.065), V(0.055, 1.592, -0.04)]], 4, 0.005), 'Splenius capitis', 0.0013);
  mp('infrahyoid', [fasc([V(0.006, 1.418, 0.073), V(0.008, 1.445, 0.062), V(0.008, 1.472, 0.038)], 0.0035, { tendon: 0.6 }), fasc([V(0.016, 1.42, 0.07), V(0.018, 1.45, 0.058), V(0.016, 1.474, 0.032)], 0.0035, { tendon: 0.6 })], 'Infrahyoid (strap) muscles', 0.001);

  // ---- back & shoulder ----
  mp('trapezius', fan([
    [V(0.0, 1.605, -0.086), V(0.0, 1.53, -0.062), V(0.0, 1.45, -0.084), V(0.0, 1.36, -0.12), V(0.0, 1.25, -0.122), V(0.0, 1.14, -0.104)],
    [V(0.035, 1.57, -0.072), V(0.055, 1.49, -0.055), V(0.1, 1.45, -0.075), V(0.085, 1.365, -0.13), V(0.055, 1.27, -0.127), V(0.03, 1.18, -0.115)],
    [V(0.105, 1.452, 0.022), V(0.152, 1.462, -0.008), V(0.176, 1.456, -0.04), V(0.125, 1.408, -0.122), V(0.08, 1.383, -0.124), V(0.064, 1.378, -0.12)],
  ], 18, (u) => 0.0042 + 0.0018 * Math.sin(Math.PI * Math.min(1, u * 1.5)), { tendon: 0.55, pw: 0.5 }), 'Trapezius', 0.0018);
  mp('rhomboids', fan([[V(0.003, 1.43, -0.098), V(0.003, 1.33, -0.122)], [V(0.06, 1.405, -0.108), V(0.075, 1.27, -0.113)]], 6, 0.0045), 'Rhomboids', 0.0016);
  mp('supraspinatus', fan([[V(0.065, 1.4, -0.104), V(0.1, 1.405, -0.096)], [V(0.14, 1.41, -0.075), V(0.15, 1.415, -0.065)], [V(0.188, 1.405, -0.03), V(0.19, 1.405, -0.026)]], 3, 0.006), 'Supraspinatus', 0.0015);
  mp('infraspinatus', fan([[V(0.066, 1.365, -0.118), V(0.068, 1.32, -0.12), V(0.078, 1.28, -0.117), V(0.11, 1.32, -0.105)], [V(0.12, 1.37, -0.11), V(0.13, 1.355, -0.1)], [V(0.188, 1.388, -0.046), V(0.186, 1.378, -0.05)]], 7, 0.006, { peak: 0.35 }), 'Infraspinatus', 0.0016);
  mp('teresMinor', [fasc([V(0.12, 1.33, -0.098), V(0.155, 1.36, -0.085), V(0.184, 1.372, -0.055)], 0.006)], 'Teres minor', 0.0015);
  mp('teresMajor', fan([[V(0.083, 1.262, -0.115), V(0.092, 1.278, -0.113)], [V(0.14, 1.3, -0.085), V(0.145, 1.31, -0.08)], [V(0.18, 1.335, -0.02), V(0.18, 1.345, -0.022)]], 3, 0.0075), 'Teres major', 0.0015);
  {
    const hc = humHead;
    const orig = [V(0.115, 1.448, 0.055), V(0.15, 1.456, 0.045), V(0.176, 1.456, 0.012), V(0.185, 1.45, -0.025), V(0.17, 1.437, -0.07), V(0.135, 1.413, -0.112)];
    const ins = [lp('U', 0.42, 35, 0.017), lp('U', 0.44, 65, 0.017), lp('U', 0.45, 95, 0.017), lp('U', 0.44, 125, 0.017), lp('U', 0.42, 150, 0.017)];
    const adjust = (ctrl) => {
      const o = ctrl[0], i = ctrl[1];
      const m1 = o.clone().lerp(i, 0.3), m2 = o.clone().lerp(i, 0.62);
      const push = (m, r) => hc.clone().add(m.clone().sub(hc).normalize().multiplyScalar(r));
      return [o, push(m1, 0.041), push(m2, 0.037), i];
    };
    mp('deltoid', fan([orig, ins], 15, 0.0075, { adjust, tendon: 0.35, peak: 0.42 }), 'Deltoid', 0.0016);
  }
  // ---- chest & abdomen ----
  const chestZ = (x, y, off) => { const [W, D, cz] = torsoAt(y); return cz + D * Math.sqrt(Math.max(0.05, 1 - (x / (W + 0.01)) ** 2)) + off; };
  {
    const orig = [V(0.115, 1.444, 0.07), V(0.07, 1.439, 0.088), V(0.03, 1.42, 0.09), V(0.024, 1.36, 0.098), V(0.026, 1.3, 0.102), V(0.03, 1.25, 0.104), V(0.06, 1.236, 0.104), V(0.085, 1.235, 0.1)];
    const ins = [lp('U', 0.27, 18, 0.017), lp('U', 0.25, 20, 0.017), lp('U', 0.23, 22, 0.017), lp('U', 0.21, 25, 0.017), lp('U', 0.19, 28, 0.017), lp('U', 0.17, 30, 0.017), lp('U', 0.15, 33, 0.017), lp('U', 0.14, 35, 0.017)];
    const adjust = (ctrl) => {
      const [o, i] = ctrl;
      const ms = [0.3, 0.6].map((t) => { const m = o.clone().lerp(i, t); m.z = Math.max(m.z, chestZ(m.x, m.y, 0.012 - t * 0.004)); return m; });
      return [o, ...ms, i];
    };
    mp('pectoralisMajor', fan([orig, ins], 17, (u) => 0.0058 + 0.0012 * Math.sin(Math.PI * u), { adjust, tendon: 0.4, peak: 0.45 }), 'Pectoralis major', 0.0017);
  }
  {
    const slips = [];
    for (let i = 0; i < 8; i++) {
      const y = 1.355 - i * 0.03;
      slips.push(fasc([TP(y - 0.015, 58 - i, 0.003), TP(y - 0.005, 85, 0.008), TP(y + 0.01, 120, 0.008), V(0.065 + i * 0.003, 1.395 - i * 0.019, -0.098)], 0.0078, { tendon: 0.35, peak: 0.35 }));
    }
    mp('serratusAnterior', slips, 'Serratus anterior', 0.0016);
  }
  {
    const bump = (t) => 1 - 0.42 * [0.2, 0.37, 0.53].reduce((a, c) => a + Math.exp(-(((t - c) / 0.022) ** 2)), 0);
    const cols = [0.014, 0.032, 0.05].map((x, k) => curveTube([V(x * 0.9, 1.262, 0.1), V(x, 1.18, 0.101), V(x * 0.95, 1.08, 0.099), V(x * 0.8, 0.98, 0.092), V(0.012 + x * 0.25, 0.892, 0.07)],
      (t) => 0.0095 * bump(t) * (0.4 + 0.6 * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.05 + 0.03)), 0.35)) * (k === 2 ? 0.85 : 1), 28));
    mp('rectusAbdominis', cols, 'Rectus abdominis', 0.0016);
  }
  {
    const slips = [];
    for (let i = 0; i < 13; i++) {
      const y = 1.27 - i * 0.0228;
      const o = TP(y, 52 + i * 3.8, 0.008);
      const e = i < 10 ? V(0.072 - i * 0.0015, y - 0.1, chestZ(0.072, y - 0.1, 0.006)) : TP(1.0 - (i - 10) * 0.008, 75 + (i - 10) * 10, 0.012);
      slips.push(fasc([o, o.clone().lerp(e, 0.5).add(V(0.008, 0, 0.004)), e], 0.0095, { tendon: 0.4, pw: 0.45 }));
    }
    mp('externalOblique', slips, 'External oblique', 0.0018);
    mp('internalOblique', fan([
      [TP(1.005, 108, 0.004), TP(0.99, 85, 0.006), TP(0.975, 60, 0.006), V(0.07, 0.94, 0.084)],
      [TP(1.16, 105, 0.002), TP(1.13, 85, 0.002), TP(1.1, 62, 0.002), V(0.068, 1.06, 0.09)],
    ], 8, 0.0065, { tendon: 0.55, pw: 0.4 }), 'Internal oblique', 0.0018);
  }
  {
    const orig = [TP(1.29, 179, 0.009), TP(1.2, 179, 0.009), TP(1.11, 179, 0.011), TP(1.02, 176, 0.012), TP(1.0, 150, 0.013), TP(1.015, 120, 0.013)];
    const mid = [TP(1.3, 150, 0.016), TP(1.25, 132, 0.019), TP(1.2, 118, 0.018), TP(1.15, 108, 0.016), TP(1.11, 102, 0.015), TP(1.08, 98, 0.015)];
    const ins = [V(0.168, 1.318, -0.055), V(0.172, 1.326, -0.042), V(0.175, 1.332, -0.03), V(0.178, 1.336, -0.022), V(0.18, 1.34, -0.016), V(0.181, 1.343, -0.012)];
    mp('latissimusDorsi', fan([orig, mid, ins], 16, 0.0046, { tendon: 0.45, pw: 0.45, peak: 0.4 }), 'Latissimus dorsi', 0.0018);
  }
  mp('erectorSpinae', [
    fasc([V(0.012, 0.93, -0.088), V(0.014, 1.05, -0.085), V(0.014, 1.2, -0.112), V(0.012, 1.34, -0.112), V(0.008, 1.41, -0.1)], 0.0085, { peak: 0.35 }),
    fasc([V(0.028, 0.93, -0.09), V(0.032, 1.05, -0.088), V(0.034, 1.2, -0.116), V(0.03, 1.36, -0.108), V(0.022, 1.5, -0.05)], 0.012, { peak: 0.3, n: 16 }),
    fasc([V(0.05, 0.98, -0.085), V(0.056, 1.07, -0.085), V(0.06, 1.2, -0.112), V(0.055, 1.35, -0.108)], 0.0095, { peak: 0.3 }),
  ], 'Erector spinae', 0.0018);
  {
    // intercostal muscles: thin sheets between neighbouring ribs (left side)
    const ribL = ribCurves.filter((r) => r.s === 1);
    const sheets = [];
    for (let i = 0; i < 11; i++) {
      const a = ribL[i].curve, b = ribL[i + 1].curve;
      const ua = i + 1 <= 10 ? 0.95 : 0.9, ub = i + 2 <= 10 ? 0.95 : 0.92;
      const rowA = Array.from({ length: 12 }, (_, k) => a.getPointAt(0.06 + (k / 11) * (ua - 0.06)).add(V(0, -0.003, 0)));
      const rowB = Array.from({ length: 12 }, (_, k) => b.getPointAt(0.06 + (k / 11) * (ub - 0.06)).add(V(0, 0.003, 0)));
      sheets.push(sheet([rowA, rowB], 0.0018, { nu: 30, nv: 4, center: (p) => V(0, p.y, -0.005), back: 0.6, expo: 0.15 }));
    }
    const g = merge(sheets);
    add('muscles', 'intercostals', 'L', g, 'Intercostal muscles', { color: 0x9a3a30 });
    add('muscles', 'intercostals', 'R', mirrorX(g), 'Intercostal muscles', { color: 0x9a3a30 });
  }
  add('muscles', 'diaphragm', null, ell(V(0, 1.12, -0.005), V(0.122, 0.075, 0.085), { thetaLength: Math.PI * 0.5, ws: 40, hs: 16 }), 'Diaphragm');

  // ---- arm ----
  mp('biceps', [
    fasc([V(0.152, 1.398, -0.042), V(0.18, 1.41, -0.012), lp('U', 0.2, 20, 0.02), lp('U', 0.55, 8, 0.027), lp('U', 0.85, 0, 0.022), lp('F', 0.1, 15, 0.012)], 0.0105, { peak: 0.6, tendon: 0.25, n: 16 }),
    fasc([V(0.136, 1.4, 0.008), V(0.16, 1.37, 0.012), lp('U', 0.25, -15, 0.021), lp('U', 0.55, -10, 0.026), lp('U', 0.85, -5, 0.021), lp('F', 0.1, 10, 0.012)], 0.0105, { peak: 0.6, tendon: 0.25, n: 16 }),
    fasc([lp('U', 0.85, -20, 0.02), lp('F', 0.12, -40, 0.02), lp('F', 0.25, -70, 0.018)], 0.003, { tendon: 0.8 }),
  ], 'Biceps brachii', 0.0015);
  mp('brachialis', [fasc([lp('U', 0.45, 40, 0.016), lp('U', 0.75, 40, 0.022), V(0.214, 1.08, -0.012)], 0.0095), fasc([lp('U', 0.45, -30, 0.016), lp('U', 0.75, -35, 0.021), V(0.212, 1.08, -0.014)], 0.0095)], 'Brachialis', 0.0015);
  mp('triceps', [
    fasc([V(0.148, 1.372, -0.062), lp('U', 0.2, -170, 0.024), lp('U', 0.48, -165, 0.03), lp('U', 0.8, 180, 0.024), V(0.21, 1.12, -0.06)], 0.011, { peak: 0.45, n: 14 }),
    fasc([lp('U', 0.12, 130, 0.016), lp('U', 0.35, 140, 0.028), lp('U', 0.65, 160, 0.027), V(0.214, 1.12, -0.06)], 0.0105, { peak: 0.4 }),
    fasc([lp('U', 0.4, -140, 0.016), lp('U', 0.65, -150, 0.024), lp('U', 0.88, -170, 0.022), V(0.208, 1.12, -0.058)], 0.0085, { peak: 0.5 }),
  ], 'Triceps brachii', 0.0015);
  mp('brachioradialis', [fasc([lp('U', 0.66, 95, 0.016), lp('U', 0.88, 85, 0.022), lp('F', 0.18, 60, 0.026), lp('F', 0.55, 55, 0.017), lp('F', 0.95, 75, 0.012), V(0.276, 0.865, -0.012)], 0.0095, { peak: 0.35, tendon: 0.2, n: 16 })], 'Brachioradialis', 0.0013);
  {
    const med = V(0.192, 1.112, -0.036);
    mp('forearmFlexors', [
      fasc([med, lp('F', 0.2, -10, 0.022), lp('F', 0.45, 60, 0.014), lp('F', 0.5, 75, 0.011)], 0.0075, { peak: 0.35 }), // pronator teres
      fasc([med, lp('F', 0.25, -25, 0.024), lp('F', 0.6, -5, 0.017), V(0.264, 0.86, -0.004)], 0.0088, { peak: 0.3, tendon: 0.2 }), // flexor carpi radialis
      fasc([med, lp('F', 0.25, -45, 0.024), lp('F', 0.6, -20, 0.017), V(0.256, 0.856, -0.002)], 0.006, { peak: 0.3, tendon: 0.2 }), // palmaris longus
      fasc([med, lp('F', 0.3, -60, 0.02), lp('F', 0.65, -40, 0.016), V(0.256, 0.852, -0.008)], 0.0098, { peak: 0.4, tendon: 0.25 }), // flexor digitorum superficialis
      fasc([med, lp('F', 0.25, -95, 0.022), lp('F', 0.6, -95, 0.017), V(0.244, 0.852, -0.01)], 0.009, { peak: 0.35, tendon: 0.2 }), // flexor carpi ulnaris
    ], 'Forearm flexor group', 0.0013);
    const lat = V(0.238, 1.113, -0.033);
    const fs = [
      fasc([lp('U', 0.82, 105, 0.017), lp('F', 0.2, 95, 0.024), lp('F', 0.55, 110, 0.017), V(0.27, 0.86, -0.028)], 0.0088, { peak: 0.3, tendon: 0.2 }), // ECRL/B
      fasc([lat, lp('F', 0.25, 140, 0.022), lp('F', 0.6, 160, 0.016), V(0.257, 0.862, -0.034)], 0.009, { peak: 0.35, tendon: 0.2 }), // extensor digitorum
      fasc([lat, lp('F', 0.25, 175, 0.02), lp('F', 0.6, -165, 0.015), V(0.242, 0.86, -0.032)], 0.0065, { peak: 0.35, tendon: 0.2 }), // ECU
      fasc([lp('F', 0.45, 160, 0.014), lp('F', 0.7, 120, 0.016), lp('F', 0.92, 100, 0.013), V(0.284, 0.84, -0.012)], 0.0045, { tendon: 0.4 }), // APL
    ];
    [[0.271, 0.768], [0.258, 0.764], [0.247, 0.77], [0.238, 0.778]].forEach(([x, y]) => fs.push(fasc([V(0.257, 0.86, -0.034), V((0.257 + x) / 2, (0.86 + y) / 2, -0.026), V(x, y, -0.02)], 0.0016, { tendon: 0.9 })));
    mp('forearmExtensors', fs, 'Forearm extensor group', 0.0011);
    mp('handMuscles', [
      fasc([V(0.27, 0.836, -0.004), V(0.282, 0.818, 0.006), V(0.29, 0.797, 0.016)], 0.0075, { tendon: 0.4 }), // thenar
      fasc([V(0.263, 0.832, -0.004), V(0.272, 0.808, 0.003), V(0.284, 0.79, 0.012)], 0.006, { tendon: 0.4 }),
      fasc([V(0.244, 0.836, -0.007), V(0.239, 0.808, -0.006), V(0.238, 0.778, -0.009)], 0.0068, { tendon: 0.4 }), // hypothenar
      ...[0.259, 0.249].map((x) => fasc([V(x, 0.826, -0.01), V(x, 0.795, -0.006), V(x, 0.77, -0.008)], 0.004, { tendon: 0.5 })),
    ], 'Hand muscles (thenar, hypothenar & interossei)', 0.0009);
  }

  // ---- hip & thigh ----
  mp('gluteusMaximus', fan([
    [V(0.1, 1.04, -0.084), V(0.065, 1.012, -0.098), V(0.048, 0.97, -0.104), V(0.035, 0.92, -0.106), V(0.022, 0.875, -0.1)],
    [V(0.135, 0.99, -0.096), V(0.12, 0.95, -0.128), V(0.105, 0.91, -0.135), V(0.095, 0.865, -0.128), V(0.085, 0.825, -0.1)],
    [V(0.155, 0.91, -0.036), V(0.156, 0.88, -0.034), V(0.152, 0.85, -0.032), V(0.145, 0.81, -0.03), V(0.138, 0.78, -0.025)],
  ], 12, 0.011, { tendon: 0.4, pw: 0.55 }), 'Gluteus maximus', 0.002);
  mp('gluteusMedius', fan([
    [V(0.13, 1.003, 0.045), V(0.149, 1.035, 0.012), V(0.145, 1.05, -0.025), V(0.122, 1.048, -0.055), V(0.1, 1.035, -0.07)],
    [V(0.14, 0.97, 0.02), V(0.152, 0.98, -0.005), V(0.148, 0.98, -0.03), V(0.13, 0.975, -0.05)],
    [V(0.147, 0.905, 0.004), V(0.151, 0.905, -0.006), V(0.151, 0.905, -0.016), V(0.148, 0.905, -0.026)],
  ], 9, 0.0085, { tendon: 0.35 }), 'Gluteus medius', 0.0018);
  mp('tensorFasciaeLatae', [fasc([V(0.122, 1.0, 0.06), V(0.142, 0.95, 0.045), V(0.15, 0.89, 0.03)], 0.0085, { tendon: 0.4 }), fasc([V(0.13, 0.99, 0.05), V(0.148, 0.94, 0.035), V(0.153, 0.885, 0.018)], 0.007, { tendon: 0.4 })], 'Tensor fasciae latae', 0.0016);
  mp('iliotibialBand', [-0.006, 0, 0.006].map((dz) => fasc([V(0.152, 0.9, dz), lp('T', 0.3, 92, 0.052).add(V(0, 0, dz)), lp('T', 0.65, 90, 0.045).add(V(0, 0, dz)), lp('T', 0.95, 80, 0.035).add(V(0, 0, dz)), V(0.122, 0.468, 0.008 + dz)], 0.0028, { tendon: 0.9 })), 'Iliotibial band', 0.0013, tendonCol);
  mp('iliopsoas', [
    ...[1.12, 1.08, 1.03].map((y) => fasc([V(0.024, y, -0.016), V(0.04, 1.0, 0.0), V(0.068, 0.925, 0.048), V(0.09, 0.87, 0.032), V(0.104, 0.845, -0.006)], 0.0085, { peak: 0.35 })),
    ...[[0.1, 1.0, 0.0], [0.12, 1.01, 0.03]].map(([x, y, z]) => fasc([V(x, y, z), V(0.09, 0.96, 0.035), V(0.078, 0.915, 0.047), V(0.096, 0.868, 0.028), V(0.104, 0.845, -0.006)], 0.0075, { peak: 0.3 })),
  ], 'Iliopsoas', 0.0018);
  mp('sartorius', [-4.5, 4.5].map((o) => fasc([V(0.12, 1.0, 0.066), lp('T', 0.15, 15 + o, 0.055), lp('T', 0.45, -45 + o, 0.055), lp('T', 0.75, -95 + o, 0.05), lp('T', 1.0, -115 + o, 0.04), lp('L', 0.1, -60, 0.027)], 0.0055, { tendon: 0.35, pw: 0.3, n: 20 })), 'Sartorius', 0.0014);
  mp('rectusFemoris', [-0.007, 0, 0.007].map((o, k) => fasc([V(0.105 + o * 0.3, 0.945, 0.048), lp('T', 0.15, 8 + o * 600, 0.05), lp('T', 0.5, 5 + o * 900, 0.062), lp('T', 0.85, o * 600, 0.044), V(0.092 + o * 0.6, 0.55, 0.05)], k === 1 ? 0.012 : 0.0095, { peak: 0.5, tendon: 0.25 })), 'Rectus femoris', 0.0018);
  mp('vastusLateralis', [
    ...[0.06, 0.2, 0.35].map((t, k) => fasc([lp('T', t, 130 - k * 5, 0.025), lp('T', 0.3 + t * 0.6, 95 - k * 6, 0.047), lp('T', 0.78, 62 - k * 6, 0.042), V(0.108, 0.55, 0.04)], 0.0125, { peak: 0.45, tendon: 0.25 })),
    fasc([lp('T', 0.05, 100, 0.03), lp('T', 0.35, 80, 0.048), lp('T', 0.7, 45, 0.046), V(0.1, 0.552, 0.046)], 0.011, { peak: 0.45, tendon: 0.25 }),
  ], 'Vastus lateralis', 0.0019);
  mp('vastusMedialis', [0.35, 0.5, 0.65].map((t, k) => fasc([lp('T', t, -150, 0.02), lp('T', t + 0.2, -75 + k * 5, 0.048), lp('T', 0.94, -45 + k * 8, 0.044), V(0.08, 0.538, 0.04)], 0.011, { peak: 0.62, tendon: 0.25 })), 'Vastus medialis', 0.0018);
  mp('patellarLigament', [-0.006, 0, 0.006].map((o) => fasc([V(0.092 + o, 0.556, 0.046), V(0.092 + o, 0.53, 0.054), V(0.092 + o * 0.8, 0.505, 0.05), V(0.092 + o * 0.7, 0.475, 0.04), V(0.092 + o * 0.6, 0.445, 0.032)], 0.0042, { tendon: 0.8 })), 'Quadriceps tendon & patellar ligament', 0.0009, tendonCol);
  mp('adductors', fan([
    [V(0.015, 0.885, 0.058), V(0.025, 0.86, 0.048), V(0.045, 0.835, 0.03), V(0.068, 0.825, -0.008), V(0.075, 0.828, -0.022)],
    [lp('T', 0.15, -60, 0.05), lp('T', 0.3, -85, 0.058), lp('T', 0.45, -100, 0.06), lp('T', 0.6, -115, 0.055), lp('T', 0.75, -125, 0.05)],
    [lp('T', 0.3, -150, 0.017), lp('T', 0.45, -155, 0.017), lp('T', 0.6, -160, 0.017), lp('T', 0.75, -160, 0.017), lp('T', 0.92, -125, 0.024)],
  ], 10, 0.0105, { tendon: 0.3 }), 'Adductor group', 0.002);
  mp('gracilis', [-4, 4].map((o) => fasc([V(0.014, 0.865, 0.048 + o * 0.001), lp('T', 0.3, -105 + o, 0.064), lp('T', 0.7, -118 + o, 0.054), lp('T', 1.0, -125 + o, 0.04), lp('L', 0.08, -80, 0.029)], 0.0055, { tendon: 0.3, pw: 0.4, n: 16 })), 'Gracilis', 0.0014);
  mp('bicepsFemoris', [
    fasc([V(0.074, 0.828, -0.035), lp('T', 0.25, 160, 0.05), lp('T', 0.55, 150, 0.058), lp('T', 0.85, 135, 0.048), V(0.124, 0.468, -0.024)], 0.012, { peak: 0.5, tendon: 0.25 }),
    fasc([V(0.076, 0.826, -0.03), lp('T', 0.3, 168, 0.045), lp('T', 0.6, 158, 0.052), lp('T', 0.88, 140, 0.042), V(0.124, 0.47, -0.022)], 0.0095, { peak: 0.5, tendon: 0.25 }),
    fasc([lp('T', 0.45, 170, 0.02), lp('T', 0.7, 150, 0.04), V(0.122, 0.475, -0.02)], 0.0095, { peak: 0.5, tendon: 0.3 }),
  ], 'Biceps femoris', 0.0018);
  mp('semitendinosus', [-4.5, 4.5].map((o) => fasc([V(0.068, 0.826, -0.038), lp('T', 0.3, -168 + o, 0.054), lp('T', 0.6, -158 + o, 0.054), lp('T', 0.95, -140, 0.045), lp('L', 0.08, -110, 0.029)], 0.0092, { peak: 0.4, tendon: 0.25, n: 16 })), 'Semitendinosus', 0.0017);
  mp('semimembranosus', [-5.4, 5.4].map((o) => fasc([V(0.07, 0.83, -0.028), lp('T', 0.35, -150 + o, 0.04), lp('T', 0.7, -135 + o, 0.048), lp('T', 0.95, -125, 0.04), V(0.072, 0.468, -0.018)], 0.0105, { peak: 0.65, tendon: 0.25 })), 'Semimembranosus', 0.0017);

  // ---- leg & foot ----
  mp('gastrocnemius', [
    fasc([V(0.074, 0.528, -0.03), lp('L', 0.12, -150, 0.04), lp('L', 0.28, -160, 0.048), lp('L', 0.5, -175, 0.034), lp('L', 0.6, 180, 0.022)], 0.0145, { peak: 0.38, tendon: 0.2 }),
    fasc([V(0.08, 0.52, -0.036), lp('L', 0.15, -125, 0.04), lp('L', 0.3, -135, 0.047), lp('L', 0.48, -160, 0.032)], 0.0115, { peak: 0.38, tendon: 0.25 }),
    fasc([V(0.11, 0.528, -0.03), lp('L', 0.12, 150, 0.04), lp('L', 0.27, 160, 0.044), lp('L', 0.48, 175, 0.032), lp('L', 0.6, 180, 0.022)], 0.013, { peak: 0.38, tendon: 0.2 }),
  ], 'Gastrocnemius', 0.0017);
  mp('soleus', [
    fasc([lp('L', 0.05, 150, 0.025), lp('L', 0.35, 140, 0.036), lp('L', 0.6, 160, 0.03), lp('L', 0.82, 180, 0.02)], 0.011, { peak: 0.45 }),
    fasc([lp('L', 0.1, 180, 0.02), lp('L', 0.42, 180, 0.03), lp('L', 0.65, 180, 0.026), lp('L', 0.85, 180, 0.018)], 0.0095, { peak: 0.45 }),
    fasc([lp('L', 0.15, -150, 0.022), lp('L', 0.42, -135, 0.034), lp('L', 0.62, -150, 0.03), lp('L', 0.82, -175, 0.02)], 0.011, { peak: 0.45 }),
  ], 'Soleus', 0.0017);
  mp('achilles', [-6, 6].map((o) => fasc([lp('L', 0.55, 180 + o, 0.026), lp('L', 0.8, 180, 0.019), lp('L', 0.95, 180, 0.02), V(0.098 + o * 0.0003, 0.042, -0.072)], 0.0042, { tendon: 0.85 })), 'Achilles (calcaneal) tendon', 0.0011, tendonCol);
  mp('tibialisAnterior', [
    fasc([lp('L', 0.06, 50, 0.03), lp('L', 0.3, 42, 0.034), lp('L', 0.6, 30, 0.027), lp('L', 0.88, 12, 0.02), V(0.082, 0.075, 0.036), V(0.068, 0.052, 0.069)], 0.011, { peak: 0.3, tendon: 0.2, n: 18 }),
    fasc([lp('L', 0.1, 62, 0.03), lp('L', 0.35, 55, 0.032), lp('L', 0.6, 35, 0.026)], 0.007, { peak: 0.4 }),
  ], 'Tibialis anterior', 0.0014);
  {
    const fs = [fasc([lp('L', 0.05, 80, 0.03), lp('L', 0.35, 72, 0.031), lp('L', 0.7, 60, 0.026), V(0.1, 0.075, 0.036)], 0.0072, { peak: 0.4, tendon: 0.25 })];
    [[0.077, 0.15], [0.092, 0.142], [0.106, 0.132], [0.12, 0.12]].forEach(([x, z]) => fs.push(fasc([V(0.1, 0.075, 0.036), V((0.1 + x) / 2, 0.042, (0.05 + z) / 2), V(x, 0.024, z)], 0.0016, { tendon: 0.9 })));
    mp('extensorDigitorumLongus', fs, 'Extensor digitorum longus', 0.0011);
  }
  mp('fibularisLongus', [
    fasc([lp('L', 0.04, 105, 0.026), lp('L', 0.35, 108, 0.028), lp('L', 0.7, 115, 0.02), V(0.13, 0.06, -0.022), V(0.122, 0.028, 0.025)], 0.0098, { peak: 0.3, tendon: 0.2, n: 16 }),
    fasc([lp('L', 0.4, 120, 0.022), lp('L', 0.65, 125, 0.024), lp('L', 0.88, 130, 0.017), V(0.131, 0.055, -0.018), V(0.13, 0.03, 0.035)], 0.007, { peak: 0.4, tendon: 0.25 }),
  ], 'Fibularis (peroneus) longus & brevis', 0.0014);
  mp('footMuscles', [
    fasc([V(0.11, 0.045, 0.03), V(0.1, 0.04, 0.06), V(0.085, 0.03, 0.1)], 0.005, { tendon: 0.4 }), // extensor digitorum brevis
    fasc([V(0.08, 0.02, -0.04), V(0.068, 0.02, 0.02), V(0.062, 0.016, 0.1)], 0.0065, { tendon: 0.35 }), // abductor hallucis
    fasc([V(0.095, 0.01, -0.035), V(0.095, 0.008, 0.03), V(0.098, 0.009, 0.11)], 0.0068, { tendon: 0.35 }), // flexor digitorum brevis
    fasc([V(0.115, 0.012, -0.03), V(0.125, 0.012, 0.03), V(0.123, 0.012, 0.1)], 0.005, { tendon: 0.35 }), // abductor digiti minimi
  ], 'Foot muscles', 0.0011);

  // ======================================================================
  // NERVOUS SYSTEM
  // ======================================================================
  const onSkX = (s, y, z, off = 0) => { const p = vaultSurfX(y, z, off); p.x *= s; return p; };
  const onSkZ = (x, y, off = 0) => vaultSurfZ(x, y, off);
  const nerve = (pts, r, o = {}) => tube(pts, rodProf(r, o.r2 ?? r * 0.7), { seg: 40, radial: 8, ...o });
  const gyri = (x, y, z) => 0.035 * (Math.sin(x * 160 + Math.sin(z * 90) * 2) * Math.sin(y * 150 + Math.cos(x * 70)) * Math.sin(z * 140 + Math.sin(y * 80) * 2));
  add('nerves', 'cerebrum', null, merge([
    ell(V(0.0345, 1.672, -0.006), V(0.033, 0.058, 0.086), { ws: 56, hs: 40, disp: gyri }),
    ell(V(-0.0345, 1.672, -0.006), V(0.033, 0.058, 0.086), { ws: 56, hs: 40, disp: gyri }),
  ]), 'Cerebrum', { color: 0xdca69a });
  add('nerves', 'cerebellum', null, ell(V(0, 1.605, -0.062), V(0.05, 0.024, 0.03), { ws: 40, hs: 30, disp: (x, y) => 0.06 * Math.sin(y * 900) }), 'Cerebellum', { color: 0xd49287 });
  add('nerves', 'brainstem', null, tube([V(0, 1.645, -0.012), V(0, 1.6, -0.02), V(0, 1.56, -0.02)], rodProf(0.011, 0.007), { seg: 16, radial: 14 }), 'Brainstem', { color: 0xd8a093 });
  add('nerves', 'spinalCord', null, tube([V(0, 1.565, -0.02), ...cordPts.slice(0, 20)], (t, L) => lerp(0.0055, 0.0042, t) * (t > 0.92 ? 1 - smooth(0.92, 1, t) * 0.8 : 1) * Math.min(1, (t * L) / 0.004 + 0.4), { seg: 80, radial: 12, even: true }), 'Spinal cord');
  {
    const g = [];
    const start = cordPts[19];
    for (let k = 0; k < 10; k++) {
      const sx = (k - 4.5) * 0.0022;
      const tgt = k < 8 ? cordPts[Math.min(23, 20 + Math.floor(k / 2))] : V(0, 0.93, -0.06);
      const end = V(sx * 4, 0.9 - (k % 5) * 0.004, -0.07);
      g.push(tube([start.clone().add(V(sx, 0, 0)), tgt.clone().add(V(sx, -0.01, 0)), end], rodProf(0.001), { seg: 24, radial: 6 }));
    }
    add('nerves', 'caudaEquina', null, merge(g), 'Cauda equina');
  }
  for (const s of SIDES) {
    const side = s > 0 ? 'L' : 'R';
    const lb = limbs(s);
    add('nerves', 'eyeOptic', side, ell(S(s, 0.031, 1.633, 0.073), V(0.0118, 0.0118, 0.0118)), 'Eye', { color: 0xf3efe6 });
    add('nerves', 'eyeOptic', side, nerve([S(s, 0.031, 1.633, 0.061), S(s, 0.022, 1.632, 0.04), S(s, 0.004, 1.63, 0.02)], 0.0022, { r2: 0.0022 }), 'Optic nerve (CN II)');
    add('nerves', 'trigeminal', side, merge([
      nerve([S(s, 0.02, 1.625, -0.01), S(s, 0.03, 1.63, 0.02), S(s, 0.03, 1.655, 0.07), onSkZ(s * 0.025, 1.69, 0.002)], 0.0012),
      nerve([S(s, 0.02, 1.625, -0.01), S(s, 0.035, 1.61, 0.03), S(s, 0.032, 1.608, 0.08), S(s, 0.02, 1.602, 0.09)], 0.0012),
      nerve([S(s, 0.02, 1.625, -0.01), S(s, 0.045, 1.58, 0.0), S(s, 0.05, 1.54, 0.04), S(s, 0.02, 1.508, 0.087)], 0.0012),
    ]), 'Trigeminal nerve (CN V)');
    const fo = S(s, 0.066, 1.585, 0.0);
    add('nerves', 'facialNerve', side, merge([
      nerve([S(s, 0.03, 1.625, -0.02), S(s, 0.06, 1.6, -0.02), fo], 0.0013, { r2: 0.0012 }),
      ...[onSkX(s, 1.68, 0.04, 0.003), S(s, 0.055, 1.612, 0.07), S(s, 0.047, 1.575, 0.088), S(s, 0.042, 1.522, 0.07), S(s, 0.05, 1.49, 0.03)]
        .map((e) => nerve([fo, fo.clone().lerp(e, 0.5).add(V(s * 0.008, 0, 0)), e], 0.0009)),
    ]), 'Facial nerve (CN VII)');
    add('nerves', 'vagus', side, nerve([S(s, 0.012, 1.6, -0.02), S(s, 0.03, 1.55, 0.0), S(s, 0.028, 1.47, 0.02), S(s, 0.025, 1.38, 0.0), S(s, 0.022, 1.25, 0.01), S(s, 0.025, 1.12, 0.03), S(s, 0.03, 1.05, 0.04)], 0.0016, { r2: 0.0012, seg: 60 }), 'Vagus nerve (CN X)');
    const st = [], stPts = [];
    vInfo.forEach((v, k) => { if (k >= 1) stPts.push(v.c.clone().add(V(s * (v.r + 0.006), 0, 0.006))); });
    stPts.push(V(s * 0.03, 0.95, -0.03), V(s * 0.015, 0.89, -0.065));
    st.push(nerve(stPts, 0.0012, { r2: 0.0009, seg: 80 }));
    stPts.forEach((p) => st.push(ell(p, V(0.0024, 0.0034, 0.0024), { ws: 8, hs: 6 })));
    add('nerves', 'sympatheticTrunk', side, merge(st), 'Sympathetic trunk');
    const sn = [];
    vInfo.forEach((v) => sn.push(nerve([v.cord, v.cord.clone().add(V(s * 0.02, -v.h * 0.4, 0.004)), v.cord.clone().add(V(s * 0.04, -v.h * 0.8, 0.012))], 0.0016, { seg: 10, radial: 6 })));
    for (let k = 0; k < 5; k++) sn.push(nerve([V(s * 0.012, 0.965 - k * 0.018, -0.06), V(s * 0.045, 0.955 - k * 0.02, -0.055)], 0.0014, { seg: 8, radial: 6 }));
    add('nerves', 'spinalNerves', side, merge(sn), 'Spinal nerves');
    const ic = [];
    ribCurves.filter((r) => r.s === s && r.i <= 11).forEach((r) => {
      const pts = r.pts.slice(1).map((p) => p.clone().add(V(0, -0.0075, 0)).multiply(V(0.97, 1, 0.97)));
      ic.push(nerve(pts, 0.0011, { r2: 0.0009, seg: 40, radial: 6 }));
    });
    add('nerves', 'intercostalNerves', side, merge(ic), 'Intercostal nerves');
    const ax = S(s, 0.152, 1.37, -0.01);
    const bp = [];
    for (let k = 0; k < 5; k++) {
      const v = vInfo[4 + k];
      bp.push(nerve([v.cord.clone().add(V(s * 0.03, -0.004, 0.01)), S(s, 0.07, 1.44 - k * 0.012, 0.0), S(s, 0.12, 1.4 - k * 0.006, 0.0), ax.clone().add(V(0, -k * 0.003, 0))], 0.0022, { r2: 0.002, seg: 30 }));
    }
    bp.push(nerve([ax, LP(lb.U, s, 0.12, -150, 0.02), LP(lb.U, s, 0.15, 150, 0.024), LP(lb.U, s, 0.16, 100, 0.02)], 0.0016, { seg: 20 }));
    bp.push(nerve([ax, LP(lb.U, s, 0.25, -20, 0.017), LP(lb.U, s, 0.6, 10, 0.016), LP(lb.F, s, 0.1, 60, 0.012)], 0.0016, { seg: 30 }));
    add('nerves', 'brachialPlexus', side, merge(bp), 'Brachial plexus (with axillary & musculocutaneous nerves)');
    add('nerves', 'radialNerve', side, nerve([ax, LP(lb.U, s, 0.3, -150, 0.017), LP(lb.U, s, 0.55, 175, 0.016), LP(lb.U, s, 0.85, 95, 0.016), LP(lb.F, s, 0.1, 60, 0.013), LP(lb.F, s, 0.6, 85, 0.01), S(s, 0.28, 0.84, -0.01), S(s, 0.29, 0.79, 0.0)], 0.0022, { r2: 0.0012, seg: 70 }), 'Radial nerve');
    const md = [nerve([ax, LP(lb.U, s, 0.4, -60, 0.019), LP(lb.U, s, 0.92, -30, 0.019), LP(lb.F, s, 0.3, 0, 0.011), LP(lb.F, s, 0.95, 0, 0.009), S(s, 0.258, 0.82, 0.0)], 0.0022, { r2: 0.0016, seg: 70 })];
    [[0.29, 0.79], [0.272, 0.74], [0.258, 0.73], [0.247, 0.74]].forEach(([x, y]) => md.push(nerve([S(s, 0.258, 0.82, 0.0), S(s, x, y, 0.004)], 0.0009, { seg: 10, radial: 6 })));
    add('nerves', 'medianNerve', side, merge(md), 'Median nerve');
    const ul = [nerve([ax, LP(lb.U, s, 0.5, -110, 0.018), LP(lb.U, s, 0.97, -135, 0.023), LP(lb.F, s, 0.4, -80, 0.012), LP(lb.F, s, 0.95, -60, 0.01), S(s, 0.243, 0.82, -0.004)], 0.0022, { r2: 0.0015, seg: 70 })];
    [[0.247, 0.74], [0.238, 0.755]].forEach(([x, y]) => ul.push(nerve([S(s, 0.243, 0.82, -0.004), S(s, x, y, 0.0)], 0.0009, { seg: 10, radial: 6 })));
    add('nerves', 'ulnarNerve', side, merge(ul), 'Ulnar nerve');
    const T_ = lb.T, L_ = lb.L;
    const fm = [nerve([vInfo[20].cord.clone().add(V(s * 0.035, 0, 0.01)), S(s, 0.055, 1.0, 0.0), S(s, 0.07, 0.93, 0.045), S(s, 0.08, 0.88, 0.05)], 0.0026, { r2: 0.0022, seg: 40 })];
    [[-30, 0.4], [-5, 0.55], [30, 0.5], [-70, 0.85]].forEach(([d, t]) => fm.push(nerve([S(s, 0.08, 0.88, 0.05), LP(T_, s, t * 0.5, d, 0.03), LP(T_, s, t, d, 0.035)], 0.0013, { seg: 20, radial: 6 })));
    fm.push(nerve([S(s, 0.08, 0.88, 0.05), LP(T_, s, 0.5, -70, 0.04), LP(T_, s, 0.95, -100, 0.04), LP(L_, s, 0.5, -60, 0.03), S(s, 0.075, 0.07, 0.015)], 0.0011, { seg: 50, radial: 6 }));
    add('nerves', 'femoralNerve', side, merge(fm), 'Femoral nerve');
    const split = LP(T_, s, 0.82, 172, 0.028);
    add('nerves', 'sciaticNerve', side, nerve([V(s * 0.025, 0.94, -0.07), S(s, 0.07, 0.9, -0.075), S(s, 0.095, 0.85, -0.07), LP(T_, s, 0.1, 168, 0.03), LP(T_, s, 0.5, 172, 0.03), split], 0.0042, { r2: 0.0035, seg: 50, radial: 10 }), 'Sciatic nerve');
    add('nerves', 'tibialNerve', side, merge([
      nerve([split, LP(L_, s, 0.02, 180, 0.026), LP(L_, s, 0.5, -170, 0.02), LP(L_, s, 0.9, -130, 0.018), S(s, 0.075, 0.055, -0.025), S(s, 0.08, 0.02, 0.04), S(s, 0.07, 0.015, 0.12)], 0.0028, { r2: 0.0012, seg: 70 }),
      nerve([S(s, 0.08, 0.02, 0.04), S(s, 0.105, 0.015, 0.11)], 0.0011, { seg: 10, radial: 6 }),
    ]), 'Tibial nerve');
    add('nerves', 'commonFibular', side, nerve([split, LP(L_, s, 0.04, 140, 0.03), LP(L_, s, 0.14, 95, 0.026), LP(L_, s, 0.55, 60, 0.021), LP(L_, s, 0.92, 30, 0.016), S(s, 0.1, 0.05, 0.07), S(s, 0.085, 0.025, 0.13)], 0.0024, { r2: 0.001, seg: 70 }), 'Common fibular (peroneal) nerve');
  }

  // forearm + hand rotated inward about the elbow (reference pose: forearms hang straight beside the thighs)
  const theta = 0.13;
  const armPose = (p) => {
    const ax = Math.abs(p.x), sg = Math.sign(p.x) || 1;
    const w = smooth(0.165, 0.185, ax) * smooth(1.13, 1.06, p.y);
    if (w <= 0) return;
    const th = theta * w, c = Math.cos(th), sn = Math.sin(th);
    const dx = ax - 0.222, dy = p.y - 1.1;
    p.x = sg * (0.222 + dx * c + dy * sn);
    p.y = 1.1 - dx * sn + dy * c;
  };
  for (const p of parts) warpGeometry(p.geo, armPose);

  // ---- proportions matched to the reference skeleton (front/back photographs) ----
  const proportions = (p) => {
    const ax = Math.abs(p.x), sg = Math.sign(p.x) || 1;
    // longer upper arm: everything below mid-humerus moves down 3.5 cm
    const arm = smooth(0.16, 0.178, ax) * (1 - smooth(1.36, 1.42, p.y));
    p.y -= 0.035 * arm * smooth(1.32, 1.12, p.y);
    // smaller head on a longer neck: the head is shortened toward its crown
    p.y += 0.12 * (1.745 - p.y) * smooth(1.42, 1.55, p.y) * (p.y < 1.745 ? 1 : 0);
    // wider rib cage, narrower iliac wings (trunk only, arms excluded)
    const trunk = 1 - smooth(0.15, 0.175, ax);
    const chest = smooth(1.1, 1.2, p.y) * (1 - smooth(1.4, 1.47, p.y));
    const wings = smooth(0.925, 0.975, p.y) * (1 - smooth(1.06, 1.1, p.y));
    p.x = sg * ax * (1 + trunk * (0.08 * chest - 0.09 * wings));
  };
  for (const p of parts) warpGeometry(p.geo, proportions);

  // fuller muscle bellies (closer to the reference figure): push muscle surfaces out along their normals
  for (const p of parts) {
    if (p.cat !== 'muscles' || p.color !== undefined || p.key === 'diaphragm') continue;
    const pos = p.geo.attributes.position, nor = p.geo.attributes.normal;
    const k = ['frontalis', 'orbicularisOculi', 'orbicularisOris', 'zygomaticus', 'intercostals', 'infrahyoid'].includes(p.key) ? 0.0008 : 0.0028;
    for (let i = 0; i < pos.count; i++) pos.setXYZ(i, pos.getX(i) + nor.getX(i) * k, pos.getY(i) + nor.getY(i) * k, pos.getZ(i) + nor.getZ(i) * k);
    p.geo.computeVertexNormals();
  }
  return parts;
}
