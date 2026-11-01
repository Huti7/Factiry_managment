// Builds the procedural human body: skeleton, muscles and nervous system.
// Coordinates are in metres, feet on y = 0, the body faces +z, +x is the body's LEFT side.
import * as THREE from 'three';
import {
  V, lerp, smooth, tube, sheet, ell, torus, box, merge, warpGeometry,
  boneProf, musProf, rodProf,
} from './geometry.js';

const SIDES = [1, -1]; // 1 = left (+x), -1 = right

/** female proportions: narrower shoulders & ribcage, wider pelvis, larger Q-angle, smaller overall */
function femaleWarp(p) {
  const ax = Math.abs(p.x), sg = Math.sign(p.x) || 1, y = p.y;
  const arm = smooth(0.155, 0.19, ax) * smooth(0.45, 0.55, y) * (1 - smooth(1.47, 1.52, y));
  const torsoT = smooth(1.02, 1.18, y) * (1 - smooth(1.46, 1.53, y));
  const pelv = smooth(0.5, 0.88, y) * (1 - smooth(1.0, 1.1, y));
  const fx = 1 + 0.11 * pelv - 0.075 * torsoT;
  const xBody = p.x * fx;
  const xArm = p.x - sg * 0.013;
  p.x = lerp(xBody, xArm, arm);
  p.z *= 1 - 0.03 * torsoT;
  p.multiplyScalar(0.93);
}

export function buildBody(sex = 'male') {
  const parts = [];
  const M = sex === 'female' ? 0.86 : 1; // muscle bulk
  const add = (cat, key, side, geo, label, extra = {}) => parts.push({ cat, key, side, geo, label, ...extra });
  const S = (s, x, y, z) => V(s * x, y, z);

  // ---------- limb frames ----------
  const seg = (a, b) => ({ a, b });
  const limbs = (s) => ({
    U: seg(S(s, 0.18, 1.40, -0.035), S(s, 0.218, 1.105, -0.03)),
    F: seg(S(s, 0.222, 1.095, -0.03), S(s, 0.255, 0.865, -0.02)),
    T: seg(S(s, 0.115, 0.88, 0.0), S(s, 0.09, 0.51, 0.005)),
    L: seg(S(s, 0.098, 0.48, 0.0), S(s, 0.092, 0.09, -0.005)),
  });
  /** point on the surface of a limb: t along the segment, deg around (0 front, 90 lateral, 180 back, -90 medial) */
  const LP = (sg, s, t, deg, r) => {
    const d = sg.b.clone().sub(sg.a);
    const dn = d.clone().normalize();
    const f = V(0, 0, 1); f.sub(dn.clone().multiplyScalar(f.dot(dn))).normalize();
    const l = V(s, 0, 0); l.sub(dn.clone().multiplyScalar(l.dot(dn))).sub(f.clone().multiplyScalar(l.dot(f))).normalize();
    const a = (deg * Math.PI) / 180;
    return sg.a.clone().add(d.multiplyScalar(t)).add(f.multiplyScalar(Math.cos(a) * r)).add(l.multiplyScalar(Math.sin(a) * r));
  };
  const nearestOnSeg = (sg, p) => {
    const d = sg.b.clone().sub(sg.a);
    const t = Math.max(-0.3, Math.min(1.3, p.clone().sub(sg.a).dot(d) / d.lengthSq()));
    return sg.a.clone().add(d.multiplyScalar(t));
  };
  const hintFromSeg = (...sgs) => (p) => {
    let best = null, bd = 1e9;
    for (const sg of sgs) { const q = nearestOnSeg(sg, p); const dd = q.distanceTo(p); if (dd < bd) { bd = dd; best = q; } }
    return p.clone().sub(best);
  };
  const hintAxis = (cx = 0, cz = 0) => (p) => V(p.x - cx, 0, p.z - cz);

  // ---------- torso surface ----------
  const TORSO = [
    [1.47, 0.045, 0.045, -0.015], [1.43, 0.08, 0.075, -0.01], [1.38, 0.11, 0.095, -0.005],
    [1.30, 0.132, 0.1, -0.005], [1.22, 0.142, 0.1, -0.005], [1.14, 0.14, 0.095, -0.005],
    [1.06, 0.122, 0.085, 0.0], [1.0, 0.14, 0.085, 0.0], [0.94, 0.15, 0.09, -0.005], [0.88, 0.14, 0.09, -0.01],
  ];
  const torsoAt = (y) => {
    for (let i = 0; i < TORSO.length - 1; i++) {
      const a = TORSO[i], b = TORSO[i + 1];
      if (y <= a[0] && y >= b[0]) {
        const t = (a[0] - y) / (a[0] - b[0]);
        return [lerp(a[1], b[1], t), lerp(a[2], b[2], t), lerp(a[3], b[3], t)];
      }
    }
    const e = y > TORSO[0][0] ? TORSO[0] : TORSO[TORSO.length - 1];
    return [e[1], e[2], e[3]];
  };
  const TP = (s, y, deg, off = 0) => {
    const [W, D, cz] = torsoAt(y);
    const a = (deg * Math.PI) / 180;
    return V(s * Math.sin(a) * (W + off), y, cz + Math.cos(a) * (D + off));
  };
  const torsoCenter = (p) => V(0, p.y, torsoAt(p.y)[2]);

  // ======================================================================
  // SKELETON
  // ======================================================================

  // ---- skull ----
  const skC = V(0, 1.655, -0.005), skR = V(0.074, 0.088, 0.098);
  const skQ = (y, z) => Math.max(0.04, 1 - ((y - skC.y) / skR.y) ** 2 - ((z - skC.z) / skR.z) ** 2);
  /** point on the side of the cranium at height y, depth z, pushed out by off */
  const onSkX = (s, y, z, off = 0) => V(s * (skR.x * Math.sqrt(skQ(y, z)) + off), y, z);
  /** point on the front/top of the cranium at x, y */
  const onSkZ = (x, y, off = 0) => {
    const q = Math.max(0.02, 1 - (x / skR.x) ** 2 - ((y - skC.y) / skR.y) ** 2);
    return V(x, y, skC.z + skR.z * Math.sqrt(q) + off);
  };
  {
    const g = [];
    g.push(ell(skC, skR, { ws: 40, hs: 30, disp: (x, y, z) => (z < -0.04 && y < -0.01 ? 0.04 * smooth(-0.04, -0.09, z) : 0) }));
    g.push(ell(V(0, 1.586, 0.05), V(0.046, 0.039, 0.044))); // maxilla / face
    for (const s of SIDES) {
      g.push(ell(S(s, 0.048, 1.602, 0.068), V(0.017, 0.013, 0.013))); // zygomatic bone
      g.push(tube([S(s, 0.055, 1.6, 0.06), S(s, 0.068, 1.598, 0.03), S(s, 0.068, 1.6, 0.0)], rodProf(0.0045), { seg: 12, radial: 8 }));
      g.push(tube([S(s, 0.056, 1.6, -0.02), S(s, 0.058, 1.575, -0.025)], rodProf(0.008, 0.004), { seg: 8, radial: 10 })); // mastoid
      g.push(torus(S(s, 0.031, 1.637, 0.08), 0.017, 0.0032, V(s * 0.25, 0, 1)));
    }
    g.push(tube([V(0, 1.632, 0.09), V(0, 1.615, 0.097)], rodProf(0.004), { seg: 8, radial: 8 })); // nasal bones
    for (let i = 0; i < 14; i++) {
      const a = ((i - 6.5) / 6.5) * 1.35;
      g.push(box(V(0.028 * Math.sin(a), 1.544, 0.048 + 0.04 * Math.cos(a)), V(0.006, 0.011, 0.006), new THREE.Euler(0, a, 0)));
    }
    add('bones', 'skull', null, merge(g), 'Skull (cranium)');
    const dark = [];
    for (const s of SIDES) dark.push(ell(S(s, 0.031, 1.637, 0.07), V(0.016, 0.016, 0.016)));
    dark.push(ell(V(0, 1.602, 0.087), V(0.009, 0.014, 0.008)));
    add('bones', 'skull', null, merge(dark), 'Skull (cranium)', { color: 0x3b2a1e });
  }
  // ---- mandible ----
  {
    const pts = [S(-1, 0.052, 1.6, -0.002), S(-1, 0.054, 1.55, 0.0), S(-1, 0.046, 1.522, 0.035), S(-1, 0.025, 1.508, 0.07), V(0, 1.505, 0.083),
      S(1, 0.025, 1.508, 0.07), S(1, 0.046, 1.522, 0.035), S(1, 0.054, 1.55, 0.0), S(1, 0.052, 1.6, -0.002)];
    const g = [tube(pts, rodProf(0.013, 0.013), { seg: 60, radial: 12, width: 1, thick: 0.35, hint: hintAxis(0, 0.02), even: true })];
    for (const s of SIDES) g.push(tube([S(s, 0.05, 1.56, 0.015), S(s, 0.048, 1.595, 0.025)], rodProf(0.005, 0.003), { seg: 8, radial: 8 })); // coronoid
    for (let i = 0; i < 14; i++) {
      const a = ((i - 6.5) / 6.5) * 1.3;
      g.push(box(V(0.026 * Math.sin(a), 1.526, 0.045 + 0.038 * Math.cos(a)), V(0.0055, 0.01, 0.0055), new THREE.Euler(0, a, 0)));
    }
    add('bones', 'mandible', null, merge(g), 'Mandible');
  }
  // ---- hyoid ----
  add('bones', 'hyoid', null, tube([S(-1, 0.02, 1.478, 0.005), S(-1, 0.012, 1.474, 0.03), V(0, 1.472, 0.038), S(1, 0.012, 1.474, 0.03), S(1, 0.02, 1.478, 0.005)],
    rodProf(0.003), { seg: 24, radial: 8 }), 'Hyoid bone');

  // ---- vertebral column ----
  const spine = new THREE.CatmullRomCurve3([
    V(0, 1.545, -0.012), V(0, 1.50, -0.008), V(0, 1.45, -0.02), V(0, 1.38, -0.045), V(0, 1.28, -0.06),
    V(0, 1.18, -0.052), V(0, 1.10, -0.035), V(0, 1.03, -0.02), V(0, 0.985, -0.03),
  ], false, 'centripetal');
  const verts = [];
  for (let i = 0; i < 7; i++) verts.push({ kind: i === 0 ? 'atlas' : i === 1 ? 'axis' : 'cervical', name: `C${i + 1}`, r: 0.011, h: 0.011, rf: 0.0085, Ls: i === 6 ? 0.022 : 0.013, Lt: 0.012, drop: 0.5, disc: 0.004 });
  for (let i = 0; i < 12; i++) verts.push({ kind: 'thoracic', name: `T${i + 1}`, r: 0.012 + 0.0005 * i, h: 0.015 + 0.0005 * i, rf: 0.0072, Ls: 0.026, Lt: 0.022, drop: 1.0, disc: 0.005 });
  for (let i = 0; i < 5; i++) verts.push({ kind: 'lumbar', name: `L${i + 1}`, r: 0.019 + 0.0007 * i, h: 0.024, rf: 0.0085, Ls: 0.022, Lt: 0.026, drop: 0.15, disc: 0.008 });
  const total = verts.reduce((a, v) => a + v.h + v.disc, 0);
  let acc = 0;
  const cordPts = [];
  const vInfo = [];
  for (const v of verts) {
    const u = (acc + (v.h + v.disc) / 2) / total;
    acc += v.h + v.disc;
    const c = spine.getPointAt(u);
    const up = spine.getTangentAt(u).negate().normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), up);
    const g = [];
    const zc = -(v.r * 0.85 + v.rf * 0.55);
    if (v.kind === 'atlas') {
      g.push(torus(V(0, 0, -0.004), 0.014, 0.0035, V(0, 1, 0)));
      for (const s of SIDES) g.push(tube([V(s * 0.013, 0, -0.004), V(s * 0.03, 0.001, -0.006)], rodProf(0.004, 0.003), { seg: 8, radial: 8 }));
    } else {
      const body = new THREE.CylinderGeometry(v.r, v.r, v.h, 18, 1);
      body.scale(1, 1, 0.82);
      g.push(body);
      if (v.kind === 'axis') g.push(tube([V(0, v.h / 2, 0), V(0, v.h / 2 + 0.014, 0.001)], rodProf(0.005, 0.003), { seg: 8, radial: 8 }));
      const arch = new THREE.TorusGeometry(v.rf, v.rf * 0.36, 6, 16, Math.PI);
      arch.rotateX(-Math.PI / 2);
      arch.translate(0, 0, zc);
      g.push(arch);
      for (const s of SIDES) {
        g.push(tube([V(s * v.rf * 0.75, 0, -v.r * 0.6), V(s * v.rf, 0, zc + 0.001)], rodProf(v.rf * 0.36), { seg: 6, radial: 8 }));
        g.push(tube([V(s * v.rf, 0, zc), V(s * (v.rf + v.Lt), 0.002, zc - 0.006)], rodProf(0.0028, 0.0022), { seg: 8, radial: 8 }));
      }
      const sp0 = V(0, 0, zc - v.rf * 0.9);
      const dir = V(0, -v.drop, -1).normalize();
      g.push(tube([sp0, sp0.clone().add(dir.multiplyScalar(v.Ls))], rodProf(0.0036, 0.0024), { seg: 8, radial: 8, width: 0.6, hint: V(1, 0, 0) }));
    }
    const geo = merge(g);
    geo.applyQuaternion(q);
    geo.translate(c.x, c.y, c.z);
    const key = v.kind === 'atlas' ? 'atlas' : v.kind === 'axis' ? 'axis' : v.kind;
    add('bones', key, null, geo, `${v.name} vertebra`);
    const cp = V(0, 0, v.kind === 'atlas' ? -0.004 : zc).applyQuaternion(q).add(c);
    cordPts.push(cp);
    vInfo.push({ ...v, c, cord: cp, q, up });
  }
  const T = (n) => vInfo[6 + n]; // thoracic n (1..12)

  // ---- sacrum & coccyx ----
  add('bones', 'sacrum', null, sheet([
    [V(-0.05, 0.985, -0.045), V(0, 0.99, -0.04), V(0.05, 0.985, -0.045)],
    [V(-0.042, 0.94, -0.065), V(0, 0.94, -0.062), V(0.042, 0.94, -0.065)],
    [V(-0.015, 0.885, -0.08), V(0, 0.882, -0.08), V(0.015, 0.885, -0.08)],
  ], 0.016, { center: (p) => V(0, p.y, 0.05), back: 0.6, expo: 0.35 }), 'Sacrum');
  add('bones', 'coccyx', null, tube([V(0, 0.884, -0.081), V(0, 0.866, -0.08), V(0, 0.85, -0.07)], rodProf(0.007, 0.003), { seg: 12, radial: 10, width: 1.3, hint: V(0, 0, 1) }), 'Coccyx');

  // ---- sternum ----
  {
    const prof = (t, L) => {
      const k = [[0, 0.02], [0.12, 0.026], [0.26, 0.016], [0.8, 0.018], [0.88, 0.008], [1, 0.005]];
      let r = 0.005;
      for (let i = 0; i < k.length - 1; i++) if (t >= k[i][0] && t <= k[i + 1][0]) r = lerp(k[i][1], k[i + 1][1], (t - k[i][0]) / (k[i + 1][0] - k[i][0]));
      return r * Math.min(1, 1.5 * Math.sin(Math.PI * Math.min(t, 1 - t) + 0.3));
    };
    add('bones', 'sternum', null, tube([V(0, 1.42, 0.072), V(0, 1.36, 0.08), V(0, 1.28, 0.088), V(0, 1.215, 0.088)], prof, { seg: 40, radial: 14, thick: 0.28, hint: V(0, 0, 1) }), 'Sternum');
  }

  // ---- ribs ----
  const RW = [0.055, 0.08, 0.098, 0.112, 0.122, 0.13, 0.135, 0.137, 0.136, 0.13, 0.12, 0.105];
  const RZ = [0.06, 0.072, 0.08, 0.086, 0.09, 0.092, 0.092, 0.088, 0.08, 0.068, 0.03, 0.0];
  const RS = [1.40, 1.375, 1.35, 1.325, 1.30, 1.275, 1.25];
  const ribCurves = [];
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
      const r = i === 1 ? 0.0045 : 0.0042;
      const g = tube(pts, rodProf(r, i <= 10 ? r * 0.9 : r * 0.6), { seg: 48, radial: 10, width: 1.7, thick: 0.6, hint: hintAxis(0, 0) });
      const key = i <= 7 ? 'trueRibs' : i <= 10 ? 'falseRibs' : 'floatingRibs';
      add('bones', key, s > 0 ? 'L' : 'R', g, `Rib ${i}`);
      ribCurves.push({ s, i, pts });
    }
  }

  // ---- shoulder girdle ----
  for (const s of SIDES) {
    const side = s > 0 ? 'L' : 'R';
    add('bones', 'clavicle', side, tube([S(s, 0.02, 1.425, 0.072), S(s, 0.07, 1.432, 0.078), S(s, 0.13, 1.44, 0.04), S(s, 0.172, 1.447, -0.002)],
      boneProf(0.0085, 0.006, 0.008), { seg: 30, radial: 12, width: 1.15 }), 'Clavicle');
    const blade = sheet([
      [S(s, 0.055, 1.405, -0.1), S(s, 0.06, 1.33, -0.112), S(s, 0.078, 1.25, -0.105)],
      [S(s, 0.15, 1.39, -0.06), S(s, 0.125, 1.33, -0.095), S(s, 0.086, 1.25, -0.106)],
    ], 0.004, { center: torsoCenter, back: 0.8, expo: 0.25 });
    const spineSc = tube([S(s, 0.06, 1.375, -0.112), S(s, 0.11, 1.39, -0.112), S(s, 0.155, 1.42, -0.072), S(s, 0.178, 1.445, -0.022)],
      boneProf(0.003, 0.004, 0.009), { seg: 24, radial: 10, width: 1.6, hint: hintAxis(0, 0) });
    const corac = tube([S(s, 0.13, 1.405, -0.035), S(s, 0.138, 1.405, 0.0), S(s, 0.14, 1.398, 0.018)], rodProf(0.0055, 0.004), { seg: 10, radial: 8 });
    const glen = ell(S(s, 0.152, 1.39, -0.045), V(0.008, 0.019, 0.013));
    add('bones', 'scapula', side, merge([blade, spineSc, corac, glen]), 'Scapula');
  }

  // ---- upper limb bones ----
  for (const s of SIDES) {
    const side = s > 0 ? 'L' : 'R';
    const head = ell(S(s, 0.17, 1.392, -0.035), V(0.022, 0.022, 0.022));
    const tuber = ell(S(s, 0.19, 1.39, -0.025), V(0.012, 0.016, 0.013));
    const shaft = tube([S(s, 0.18, 1.395, -0.035), S(s, 0.2, 1.25, -0.035), S(s, 0.218, 1.105, -0.03)],
      boneProf(0.02, 0.011, 0.016), { seg: 36, radial: 14, width: (t) => 1 + 0.65 * smooth(0.75, 0.97, t), thick: (t) => 1 - 0.3 * smooth(0.75, 0.97, t), hint: V(0, 0, 1) });
    add('bones', 'humerus', side, merge([head, tuber, shaft]), 'Humerus');
    add('bones', 'ulna', side, tube([S(s, 0.21, 1.118, -0.047), S(s, 0.214, 1.09, -0.032), S(s, 0.228, 0.98, -0.028), S(s, 0.24, 0.86, -0.028)],
      boneProf(0.012, 0.0068, 0.0068), { seg: 32, radial: 12 }), 'Ulna');
    add('bones', 'radius', side, tube([S(s, 0.236, 1.09, -0.02), S(s, 0.25, 0.98, -0.018), S(s, 0.265, 0.868, -0.014)],
      boneProf(0.0085, 0.0068, 0.013), { seg: 32, radial: 12, width: (t) => 1 + 0.4 * smooth(0.7, 1, t), hint: V(0, 0, 1) }), 'Radius');
    // hand: palm faces forward (+z), thumb lateral
    const cx = 0.256;
    const carp = [];
    [0.274, 0.264, 0.253, 0.242].forEach((x) => carp.push(ell(S(s, x, 0.852, -0.017), V(0.006, 0.0065, 0.008))));
    [0.272, 0.262, 0.251, 0.241].forEach((x) => carp.push(ell(S(s, x, 0.837, -0.016), V(0.0058, 0.0068, 0.0075))));
    add('bones', 'carpals', side, merge(carp), 'Carpal bones');
    const off = [0.022, 0.012, 0.002, -0.008, -0.017];
    const mcEndY = [0.80, 0.766, 0.762, 0.768, 0.776];
    const prox = [0.03, 0.04, 0.045, 0.042, 0.033], mid = [0, 0.024, 0.028, 0.026, 0.019], dist = [0.022, 0.018, 0.019, 0.018, 0.016];
    const mc = [], ph = [];
    for (let f = 0; f < 5; f++) {
      let a, b, dir;
      if (f === 0) { a = S(s, cx + 0.016, 0.84, -0.01); b = S(s, cx + 0.028, 0.80, 0.016); }
      else { a = S(s, cx + off[f] * 0.6, 0.83, -0.016); b = S(s, cx + off[f], mcEndY[f], -0.012); }
      mc.push(tube([a, b], boneProf(0.005, 0.0033, 0.0048), { seg: 12, radial: 10 }));
      dir = b.clone().sub(a).normalize();
      if (f > 0) dir = dir.lerp(V(s * (off[f] * 1.5), -1, 0.06), 0.6).normalize();
      else dir = dir.lerp(V(s * 0.1, -1, 0.35), 0.45).normalize();
      let p = b.clone().add(dir.clone().multiplyScalar(0.003));
      const lens = [prox[f], mid[f], dist[f]].filter((x) => x > 0);
      lens.forEach((len, k) => {
        const q = p.clone().add(dir.clone().multiplyScalar(len));
        const rr = 0.0042 - k * 0.0007;
        ph.push(tube([p, q], boneProf(rr, rr * 0.75, k === lens.length - 1 ? rr * 0.6 : rr * 0.9), { seg: 10, radial: 9 }));
        p = q.clone().add(dir.clone().multiplyScalar(0.0025));
        dir = dir.lerp(V(0, -0.6, 0.4), 0.12).normalize();
      });
    }
    add('bones', 'metacarpals', side, merge(mc), 'Metacarpals');
    add('bones', 'handPhalanges', side, merge(ph), 'Phalanges of the hand');
  }

  // ---- pelvis ----
  for (const s of SIDES) {
    const side = s > 0 ? 'L' : 'R';
    const H = S(s, 0.088, 0.905, 0.005);
    const ilium = sheet([
      [S(s, 0.118, 1.0, 0.055), S(s, 0.14, 1.03, 0.02), S(s, 0.135, 1.045, -0.025), S(s, 0.105, 1.035, -0.06), S(s, 0.055, 1.0, -0.08)],
      [S(s, 0.103, 0.945, 0.04), S(s, 0.1, 0.935, 0.015), S(s, 0.095, 0.932, -0.01), S(s, 0.08, 0.945, -0.04), S(s, 0.047, 0.955, -0.062)],
    ], 0.007, { center: (p) => V(0, p.y, -0.01), back: 0.7, expo: 0.25 });
    const crest = tube([S(s, 0.118, 1.0, 0.055), S(s, 0.14, 1.03, 0.02), S(s, 0.135, 1.045, -0.025), S(s, 0.105, 1.035, -0.06), S(s, 0.055, 1.0, -0.08)],
      rodProf(0.006), { seg: 30, radial: 10 });
    const ring = tube([S(s, 0.085, 0.905, 0.032), S(s, 0.045, 0.905, 0.05), S(s, 0.012, 0.895, 0.062), S(s, 0.01, 0.865, 0.055),
      S(s, 0.04, 0.835, 0.03), S(s, 0.075, 0.82, -0.01), S(s, 0.09, 0.86, -0.025), S(s, 0.095, 0.89, -0.02)],
    () => 0.0085, { closed: true, seg: 48, radial: 10 });
    const acet = torus(H, 0.024, 0.007, V(s, -0.3, 0.25), { rs: 8, ts: 24 });
    const back = ell(H.clone().add(V(-s * 0.012, 0.01, -0.005)), V(0.014, 0.034, 0.03));
    const sciatic = ell(S(s, 0.07, 0.94, -0.05), V(0.012, 0.03, 0.02));
    add('bones', 'hipBone', side, merge([ilium, crest, ring, acet, back, sciatic]), 'Hip bone (os coxae)');
  }

  // ---- lower limb bones ----
  for (const s of SIDES) {
    const side = s > 0 ? 'L' : 'R';
    const H = S(s, 0.088, 0.905, 0.005);
    const head = ell(H, V(0.023, 0.023, 0.023));
    const neck = tube([H, S(s, 0.12, 0.885, 0.0)], rodProf(0.014), { seg: 8, radial: 12 });
    const gt = ell(S(s, 0.13, 0.895, -0.008), V(0.016, 0.022, 0.018));
    const lt = ell(S(s, 0.108, 0.84, -0.01), V(0.009, 0.01, 0.009));
    const shaft = tube([S(s, 0.125, 0.885, 0.0), S(s, 0.108, 0.7, 0.008), S(s, 0.09, 0.52, 0.0)], boneProf(0.018, 0.0135, 0.02), { seg: 36, radial: 14 });
    const cond = [ell(S(s, 0.072, 0.508, -0.005), V(0.017, 0.02, 0.025)), ell(S(s, 0.108, 0.51, -0.005), V(0.017, 0.02, 0.025))];
    add('bones', 'femur', side, merge([head, neck, gt, lt, shaft, ...cond]), 'Femur');
    add('bones', 'patella', side, ell(S(s, 0.092, 0.522, 0.042), V(0.02, 0.024, 0.009)), 'Patella');
    const tib = tube([S(s, 0.09, 0.49, 0.005), S(s, 0.088, 0.30, 0.012), S(s, 0.085, 0.085, 0.0)], boneProf(0.03, 0.013, 0.019),
      { seg: 36, radial: 14, width: (t) => 1 + 0.35 * (1 - smooth(0, 0.2, t)), hint: V(0, 0, 1) });
    const tubero = ell(S(s, 0.09, 0.455, 0.022), V(0.008, 0.012, 0.006));
    const mall = ell(S(s, 0.074, 0.072, 0.0), V(0.008, 0.013, 0.01));
    add('bones', 'tibia', side, merge([tib, tubero, mall]), 'Tibia');
    add('bones', 'fibula', side, tube([S(s, 0.123, 0.47, -0.012), S(s, 0.119, 0.25, -0.012), S(s, 0.121, 0.055, -0.008)], boneProf(0.0105, 0.0062, 0.0105), { seg: 32, radial: 12 }), 'Fibula');
    add('bones', 'talus', side, ell(S(s, 0.096, 0.067, 0.008), V(0.017, 0.012, 0.022)), 'Talus');
    add('bones', 'calcaneus', side, ell(S(s, 0.098, 0.034, -0.03), V(0.017, 0.022, 0.042), { rot: new THREE.Euler(-0.15, 0, 0) }), 'Calcaneus');
    add('bones', 'tarsals', side, merge([
      ell(S(s, 0.085, 0.055, 0.034), V(0.016, 0.01, 0.008)), ell(S(s, 0.118, 0.032, 0.04), V(0.012, 0.012, 0.015)),
      ell(S(s, 0.066, 0.045, 0.058), V(0.007, 0.011, 0.012)), ell(S(s, 0.081, 0.041, 0.057), V(0.007, 0.01, 0.011)), ell(S(s, 0.096, 0.037, 0.057), V(0.007, 0.01, 0.011)),
    ]), 'Navicular, cuboid & cuneiforms');
    const xs = [0.065, 0.08, 0.093, 0.106, 0.12], xd = [0.06, 0.077, 0.092, 0.106, 0.12];
    const yp = [0.042, 0.038, 0.035, 0.032, 0.03], zp = [0.07, 0.072, 0.07, 0.065, 0.055], zd = [0.15, 0.145, 0.138, 0.128, 0.115];
    const rr = [0.0075, 0.005, 0.0048, 0.0046, 0.0048];
    const pp = [0.028, 0.02, 0.018, 0.016, 0.015], pm = [0, 0.011, 0.01, 0.009, 0.008], pd = [0.02, 0.009, 0.009, 0.008, 0.008];
    const mt = [], tp = [];
    for (let k = 0; k < 5; k++) {
      const a = S(s, xs[k], yp[k], zp[k]), b = S(s, xd[k], 0.017, zd[k]);
      mt.push(tube([a, b], boneProf(rr[k] * 1.25, rr[k] * 0.75, rr[k] * 1.1), { seg: 12, radial: 10 }));
      let p = b.clone().add(V(0, -0.001, 0.004));
      [pp[k], pm[k], pd[k]].filter((x) => x > 0).forEach((len, j) => {
        const q = p.clone().add(V(0, -0.002, len));
        const r = (k === 0 ? 0.0068 : 0.0042) * (1 - j * 0.12);
        tp.push(tube([p, q], boneProf(r, r * 0.75, r * 0.8), { seg: 8, radial: 9 }));
        p = q.clone().add(V(0, -0.0005, 0.002));
      });
    }
    add('bones', 'metatarsals', side, merge(mt), 'Metatarsals');
    add('bones', 'footPhalanges', side, merge(tp), 'Phalanges of the foot');
  }

  // ======================================================================
  // MUSCLES
  // ======================================================================
  const mus = (pts, R, o = {}) => tube(pts, musProf(R * M, o.peak ?? 0.5, o.tendon ?? 0.14), { seg: 36, radial: 14, ...o });
  const msheet = (rows, th, o = {}) => sheet(rows, th * M, o);
  const skCenter = () => skC;

  // head & neck (single)
  add('muscles', 'frontalis', null, msheet([
    [onSkZ(-0.05, 1.71, 0.002), onSkZ(-0.025, 1.73, 0.002), onSkZ(0, 1.733, 0.002), onSkZ(0.025, 1.73, 0.002), onSkZ(0.05, 1.71, 0.002)],
    [onSkZ(-0.05, 1.66, 0.002), onSkZ(-0.025, 1.662, 0.002), onSkZ(0, 1.664, 0.002), onSkZ(0.025, 1.662, 0.002), onSkZ(0.05, 1.66, 0.002)],
  ], 0.003, { center: skCenter, back: 0.1, expo: 0.3, mod: (u, v) => 1 - 0.6 * Math.exp(-((u - 0.5) ** 2) / 0.004) }), 'Frontalis (occipitofrontalis)');
  for (const s of SIDES) {
    const side = s > 0 ? 'L' : 'R';
    const lb = limbs(s);
    add('muscles', 'temporalis', side, msheet([
      [onSkX(s, 1.685, 0.05, 0.002), onSkX(s, 1.705, 0.005, 0.002), onSkX(s, 1.69, -0.045, 0.002), onSkX(s, 1.655, -0.07, 0.002)],
      [S(s, 0.066, 1.612, 0.036), S(s, 0.069, 1.61, 0.028), S(s, 0.07, 1.61, 0.02), S(s, 0.07, 1.613, 0.012)],
    ], 0.005, { center: skCenter, back: 0.1, expo: 0.4 }), 'Temporalis');
    add('muscles', 'masseter', side, mus([S(s, 0.064, 1.598, 0.035), S(s, 0.064, 1.565, 0.025), S(s, 0.06, 1.53, 0.012)], 0.011,
      { width: 1.25, thick: 0.45, hint: hintAxis(0, 0.02), tendon: 0.5 }), 'Masseter');
    {
      const oo = new THREE.TorusGeometry(0.019, 0.0045 * M, 8, 32);
      oo.scale(1, 0.85, 0.35);
      oo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 0, 1), V(s * 0.25, 0, 1).normalize()));
      oo.translate(s * 0.031, 1.637, 0.084);
      add('muscles', 'orbicularisOculi', side, oo, 'Orbicularis oculi');
    }
    add('muscles', 'zygomaticus', side, mus([S(s, 0.055, 1.603, 0.078), S(s, 0.042, 1.578, 0.09), S(s, 0.024, 1.55, 0.097)], 0.004, { radial: 10, tendon: 0.4 }), 'Zygomaticus major');
    add('muscles', 'sternocleidomastoid', side, mus([S(s, 0.056, 1.585, -0.02), S(s, 0.045, 1.52, 0.012), S(s, 0.03, 1.465, 0.055), S(s, 0.018, 1.43, 0.08)], 0.0095,
      { width: 1.35, thick: 0.75, hint: hintAxis(0, -0.01), tendon: 0.35 }), 'Sternocleidomastoid');

    // trapezius
    add('muscles', 'trapezius', side, msheet([
      [S(s, 0.0, 1.6, -0.088), S(s, 0.0, 1.52, -0.058), S(s, 0.0, 1.44, -0.082), S(s, 0.0, 1.33, -0.124), S(s, 0.0, 1.2, -0.118), S(s, 0.0, 1.11, -0.1)],
      [S(s, 0.03, 1.58, -0.078), S(s, 0.045, 1.5, -0.052), S(s, 0.1, 1.45, -0.068), S(s, 0.09, 1.36, -0.13), S(s, 0.06, 1.27, -0.126), S(s, 0.035, 1.18, -0.115)],
      [S(s, 0.1, 1.452, 0.022), S(s, 0.15, 1.46, -0.01), S(s, 0.178, 1.455, -0.04), S(s, 0.12, 1.405, -0.12), S(s, 0.075, 1.38, -0.123), S(s, 0.066, 1.375, -0.122)],
    ], 0.0065, { center: (p) => V(s * 0.02, p.y, torsoAt(p.y)[2] + 0.01), back: 0.15, expo: 0.35, nu: 30 }), 'Trapezius');

    // deltoid
    const hc = S(s, 0.172, 1.392, -0.035);
    add('muscles', 'deltoid', side, msheet([
      [S(s, 0.12, 1.448, 0.055), S(s, 0.16, 1.458, 0.035), S(s, 0.188, 1.458, 0.0), S(s, 0.168, 1.445, -0.062), S(s, 0.12, 1.41, -0.112)],
      [S(s, 0.155, 1.385, 0.04), S(s, 0.203, 1.395, 0.02), S(s, 0.22, 1.39, -0.035), S(s, 0.2, 1.37, -0.088), S(s, 0.15, 1.35, -0.1)],
      [LP(lb.U, s, 0.42, 40, 0.017), LP(lb.U, s, 0.44, 70, 0.017), LP(lb.U, s, 0.45, 90, 0.017), LP(lb.U, s, 0.44, 110, 0.017), LP(lb.U, s, 0.42, 140, 0.017)],
    ], 0.012, { center: () => hc, back: 0.4, expo: 0.45 }), 'Deltoid');

    // pectoralis major
    add('muscles', 'pectoralisMajor', side, msheet([
      [S(s, 0.11, 1.442, 0.068), S(s, 0.06, 1.437, 0.09), S(s, 0.025, 1.40, 0.094), S(s, 0.022, 1.33, 0.1), S(s, 0.025, 1.26, 0.104), S(s, 0.06, 1.238, 0.102)],
      [S(s, 0.14, 1.415, 0.07), S(s, 0.12, 1.39, 0.1), S(s, 0.1, 1.35, 0.108), S(s, 0.1, 1.315, 0.11), S(s, 0.11, 1.28, 0.104), S(s, 0.13, 1.27, 0.088)],
      [LP(lb.U, s, 0.16, 35, 0.017), LP(lb.U, s, 0.18, 30, 0.017), LP(lb.U, s, 0.2, 25, 0.017), LP(lb.U, s, 0.22, 20, 0.017), LP(lb.U, s, 0.24, 15, 0.017), LP(lb.U, s, 0.26, 10, 0.017)],
    ], 0.008, { center: (p) => V(s * 0.04, p.y, -0.02), back: 0.3, expo: 0.4, nu: 26 }), 'Pectoralis major');

    // serratus anterior (sawtooth front edge)
    add('muscles', 'serratusAnterior', side, msheet([
      [TP(s, 1.33, 62, 0.006), TP(s, 1.28, 58, 0.006), TP(s, 1.23, 55, 0.006), TP(s, 1.18, 52, 0.006), TP(s, 1.13, 52, 0.006)],
      [TP(s, 1.36, 105, 0.008), TP(s, 1.31, 108, 0.008), TP(s, 1.26, 110, 0.008), TP(s, 1.21, 112, 0.008), TP(s, 1.17, 115, 0.008)],
      [TP(s, 1.38, 148, 0.002), TP(s, 1.35, 150, 0.002), TP(s, 1.32, 152, 0.002), TP(s, 1.29, 155, 0.002), TP(s, 1.26, 158, 0.002)],
    ], 0.006, { center: torsoCenter, back: 0.2, expo: 0.3, nu: 40, mod: (u, v) => (v < 0.4 ? 0.55 + 0.45 * Math.abs(Math.sin(u * Math.PI * 5)) : 1) }), 'Serratus anterior');

    // rectus abdominis with tendinous intersections
    add('muscles', 'rectusAbdominis', side, msheet([
      [S(s, 0.008, 1.265, 0.098), S(s, 0.008, 1.12, 0.094), S(s, 0.008, 0.98, 0.09), S(s, 0.01, 0.89, 0.072)],
      [S(s, 0.068, 1.265, 0.097), S(s, 0.062, 1.12, 0.092), S(s, 0.05, 0.98, 0.087), S(s, 0.02, 0.89, 0.07)],
    ], 0.01, { center: (p) => V(s * 0.03, p.y, 0), back: 0.2, expo: 0.3, nu: 40, nv: 10,
      mod: (u) => 1 - 0.45 * (Math.exp(-((u - 0.18) ** 2) / 0.0006) + Math.exp(-((u - 0.34) ** 2) / 0.0006) + Math.exp(-((u - 0.5) ** 2) / 0.0006)) }), 'Rectus abdominis');

    // external oblique
    add('muscles', 'externalOblique', side, msheet([
      [TP(s, 1.25, 58, 0.01), TP(s, 1.17, 78, 0.01), TP(s, 1.09, 95, 0.007), TP(s, 1.02, 100, 0.012), TP(s, 0.99, 92, 0.012)],
      [S(s, 0.072, 1.225, 0.104), S(s, 0.07, 1.12, 0.099), S(s, 0.064, 1.02, 0.094), S(s, 0.045, 0.94, 0.086), S(s, 0.03, 0.9, 0.08)],
    ], 0.008, { center: torsoCenter, back: 0.25, expo: 0.35 }), 'External oblique');

    // latissimus dorsi
    add('muscles', 'latissimusDorsi', side, msheet([
      [TP(s, 1.28, 179, 0.008), TP(s, 1.18, 179, 0.008), TP(s, 1.08, 179, 0.01), TP(s, 1.0, 168, 0.01), TP(s, 0.995, 140, 0.012)],
      [TP(s, 1.29, 150, 0.014), TP(s, 1.22, 128, 0.016), TP(s, 1.16, 112, 0.014), TP(s, 1.10, 105, 0.012), TP(s, 1.04, 102, 0.012)],
      [S(s, 0.165, 1.315, -0.05), S(s, 0.168, 1.322, -0.04), S(s, 0.17, 1.33, -0.03), S(s, 0.173, 1.336, -0.022), S(s, 0.176, 1.342, -0.015)],
    ], 0.008, { center: torsoCenter, back: 0.2, expo: 0.35, nu: 26 }), 'Latissimus dorsi');

    add('muscles', 'erectorSpinae', side, mus([S(s, 0.03, 0.93, -0.088), S(s, 0.036, 1.05, -0.08), S(s, 0.04, 1.2, -0.112), S(s, 0.034, 1.35, -0.108), S(s, 0.022, 1.5, -0.05)], 0.016,
      { width: 1.0, thick: 0.75, hint: hintAxis(0, 0), peak: 0.3, tendon: 0.3, seg: 48 }), 'Erector spinae');

    // arm
    add('muscles', 'biceps', side, mus([S(s, 0.155, 1.4, -0.01), LP(lb.U, s, 0.2, 15, 0.022), LP(lb.U, s, 0.52, 5, 0.027), LP(lb.U, s, 0.82, 0, 0.022), LP(lb.F, s, 0.1, 15, 0.013)], 0.017,
      { width: 1.15, thick: 0.9, hint: hintFromSeg(lb.U, lb.F), peak: 0.58 }), 'Biceps brachii');
    add('muscles', 'brachialis', side, mus([LP(lb.U, s, 0.45, 25, 0.014), LP(lb.U, s, 0.75, 20, 0.019), LP(lb.F, s, 0.08, -10, 0.011)], 0.013,
      { width: 1.4, thick: 0.8, hint: hintFromSeg(lb.U, lb.F) }), 'Brachialis');
    add('muscles', 'triceps', side, mus([S(s, 0.155, 1.37, -0.062), LP(lb.U, s, 0.3, 180, 0.025), LP(lb.U, s, 0.62, 180, 0.027), S(s, 0.212, 1.118, -0.058)], 0.02,
      { width: 1.3, thick: 0.85, hint: hintFromSeg(lb.U), peak: 0.45 }), 'Triceps brachii');
    add('muscles', 'brachioradialis', side, mus([LP(lb.U, s, 0.7, 80, 0.016), LP(lb.F, s, 0.15, 60, 0.021), LP(lb.F, s, 0.5, 55, 0.016), LP(lb.F, s, 0.95, 80, 0.011)], 0.011,
      { width: 1.2, thick: 0.8, hint: hintFromSeg(lb.F, lb.U), peak: 0.35 }), 'Brachioradialis');
    add('muscles', 'forearmFlexors', side, mus([LP(lb.U, s, 0.97, -90, 0.022), LP(lb.F, s, 0.25, -30, 0.02), LP(lb.F, s, 0.6, -10, 0.016), LP(lb.F, s, 0.98, 0, 0.011)], 0.016,
      { width: 1.6, thick: 0.7, hint: hintFromSeg(lb.F), peak: 0.35 }), 'Forearm flexor group');
    add('muscles', 'forearmExtensors', side, mus([LP(lb.U, s, 0.97, 100, 0.02), LP(lb.F, s, 0.25, 150, 0.019), LP(lb.F, s, 0.6, 172, 0.016), LP(lb.F, s, 0.98, 180, 0.011)], 0.014,
      { width: 1.5, thick: 0.7, hint: hintFromSeg(lb.F), peak: 0.35 }), 'Forearm extensor group');

    // hip
    add('muscles', 'gluteusMaximus', side, msheet([
      [S(s, 0.09, 1.035, -0.082), S(s, 0.05, 0.995, -0.1), S(s, 0.03, 0.93, -0.104), S(s, 0.02, 0.87, -0.098)],
      [S(s, 0.13, 0.985, -0.092), S(s, 0.105, 0.925, -0.13), S(s, 0.092, 0.865, -0.125), S(s, 0.08, 0.82, -0.095)],
      [S(s, 0.153, 0.9, -0.035), S(s, 0.152, 0.86, -0.032), S(s, 0.147, 0.82, -0.03), S(s, 0.142, 0.78, -0.026)],
    ], 0.02, { center: (p) => V(s * 0.06, p.y, 0), back: 0.25, expo: 0.45 }), 'Gluteus maximus');
    add('muscles', 'gluteusMedius', side, msheet([
      [S(s, 0.128, 1.003, 0.042), S(s, 0.148, 1.038, 0.0), S(s, 0.138, 1.05, -0.035), S(s, 0.112, 1.038, -0.062)],
      [S(s, 0.15, 0.905, 0.006), S(s, 0.152, 0.905, -0.004), S(s, 0.152, 0.905, -0.014), S(s, 0.149, 0.905, -0.024)],
    ], 0.012, { center: (p) => V(s * 0.085, p.y, -0.01), back: 0.3, expo: 0.4 }), 'Gluteus medius');
    add('muscles', 'iliopsoas', side, mus([S(s, 0.028, 1.12, -0.012), S(s, 0.045, 1.02, 0.0), S(s, 0.068, 0.935, 0.045), S(s, 0.088, 0.865, 0.03), S(s, 0.105, 0.84, 0.004)], 0.016,
      { width: 1.15, thick: 0.9, peak: 0.4 }), 'Iliopsoas');

    // thigh
    const T_ = lb.T, L_ = lb.L;
    add('muscles', 'sartorius', side, mus([S(s, 0.12, 1.0, 0.068), LP(T_, s, 0.25, -10, 0.05), LP(T_, s, 0.55, -60, 0.047), LP(T_, s, 0.88, -110, 0.038), LP(L_, s, 0.1, -60, 0.026)], 0.008,
      { width: 1.6, thick: 0.6, hint: hintFromSeg(T_, L_), seg: 48, tendon: 0.4 }), 'Sartorius');
    add('muscles', 'rectusFemoris', side, mus([S(s, 0.105, 0.94, 0.05), LP(T_, s, 0.2, 10, 0.042), LP(T_, s, 0.5, 5, 0.052), LP(T_, s, 0.85, 0, 0.037), S(s, 0.092, 0.548, 0.05)], 0.02,
      { width: 1.2, thick: 0.85, hint: hintFromSeg(T_), peak: 0.48 }), 'Rectus femoris');
    add('muscles', 'vastusLateralis', side, mus([LP(T_, s, 0.04, 95, 0.03), LP(T_, s, 0.4, 82, 0.049), LP(T_, s, 0.75, 62, 0.042), LP(T_, s, 0.97, 30, 0.032)], 0.024,
      { width: 1.3, thick: 0.8, hint: hintFromSeg(T_), peak: 0.45 }), 'Vastus lateralis');
    add('muscles', 'vastusMedialis', side, mus([LP(T_, s, 0.3, -60, 0.03), LP(T_, s, 0.65, -55, 0.043), LP(T_, s, 0.9, -40, 0.04), LP(T_, s, 0.99, -15, 0.032)], 0.021,
      { width: 1.25, thick: 0.85, hint: hintFromSeg(T_), peak: 0.68 }), 'Vastus medialis');
    add('muscles', 'adductors', side, mus([S(s, 0.03, 0.872, 0.04), LP(T_, s, 0.3, -95, 0.036), LP(T_, s, 0.6, -100, 0.031), LP(T_, s, 0.85, -110, 0.024)], 0.024,
      { width: 1.4, thick: 0.9, hint: hintFromSeg(T_), peak: 0.35 }), 'Adductor group');
    add('muscles', 'gracilis', side, mus([S(s, 0.018, 0.86, 0.04), LP(T_, s, 0.35, -112, 0.046), LP(T_, s, 0.75, -122, 0.041), LP(L_, s, 0.08, -80, 0.028)], 0.008,
      { width: 1.4, thick: 0.7, hint: hintFromSeg(T_, L_), tendon: 0.3 }), 'Gracilis');
    add('muscles', 'bicepsFemoris', side, mus([S(s, 0.075, 0.828, -0.035), LP(T_, s, 0.4, 150, 0.041), LP(T_, s, 0.75, 135, 0.041), S(s, 0.126, 0.47, -0.03)], 0.018,
      { width: 1.2, thick: 0.9, hint: hintFromSeg(T_), peak: 0.5 }), 'Biceps femoris');
    add('muscles', 'semitendinosus', side, mus([S(s, 0.068, 0.825, -0.038), LP(T_, s, 0.4, -165, 0.043), LP(T_, s, 0.75, -150, 0.039), LP(L_, s, 0.08, -110, 0.028)], 0.016,
      { width: 1.2, thick: 0.9, hint: hintFromSeg(T_, L_), peak: 0.4 }), 'Semitendinosus');

    // leg
    const gm = mus([S(s, 0.075, 0.525, -0.032), LP(L_, s, 0.2, -145, 0.036), LP(L_, s, 0.4, -170, 0.027), LP(L_, s, 0.56, 180, 0.02)], 0.019,
      { width: 1.1, thick: 0.9, hint: hintFromSeg(L_), peak: 0.38 });
    const gl = mus([S(s, 0.11, 0.525, -0.032), LP(L_, s, 0.2, 150, 0.034), LP(L_, s, 0.4, 170, 0.026), LP(L_, s, 0.56, 180, 0.02)], 0.017,
      { width: 1.1, thick: 0.9, hint: hintFromSeg(L_), peak: 0.38 });
    add('muscles', 'gastrocnemius', side, merge([gm, gl]), 'Gastrocnemius');
    add('muscles', 'soleus', side, mus([LP(L_, s, 0.1, 180, 0.02), LP(L_, s, 0.45, 180, 0.03), LP(L_, s, 0.7, 180, 0.023), LP(L_, s, 0.86, 180, 0.016)], 0.021,
      { width: 1.75, thick: 0.6, hint: hintFromSeg(L_), peak: 0.5 }), 'Soleus');
    add('muscles', 'achilles', side, tube([LP(L_, s, 0.6, 180, 0.019), LP(L_, s, 0.9, 180, 0.017), S(s, 0.098, 0.04, -0.074)], rodProf(0.0058 * M, 0.0062 * M),
      { seg: 20, radial: 10, width: 1.4, thick: 0.7, hint: hintFromSeg(L_) }), 'Achilles (calcaneal) tendon', { color: 0xe8dcc3 });
    add('muscles', 'tibialisAnterior', side, mus([LP(L_, s, 0.08, 50, 0.025), LP(L_, s, 0.4, 45, 0.026), LP(L_, s, 0.8, 20, 0.017), S(s, 0.085, 0.078, 0.034), S(s, 0.066, 0.052, 0.07)], 0.012,
      { width: 1.2, thick: 0.85, hint: hintFromSeg(L_), peak: 0.35, tendon: 0.25 }), 'Tibialis anterior');
    add('muscles', 'fibularisLongus', side, mus([LP(L_, s, 0.05, 100, 0.023), LP(L_, s, 0.5, 105, 0.021), LP(L_, s, 0.85, 112, 0.015), S(s, 0.128, 0.05, -0.022), S(s, 0.118, 0.025, 0.03)], 0.01,
      { width: 1.2, thick: 0.85, hint: hintFromSeg(L_), peak: 0.3, tendon: 0.3 }), 'Fibularis (peroneus) longus');
  }
  // diaphragm dome
  add('muscles', 'diaphragm', null, ell(V(0, 1.12, -0.005), V(0.122 * (sex === 'female' ? 0.97 : 1), 0.075, 0.085), { thetaLength: Math.PI * 0.5, ws: 32, hs: 14 }), 'Diaphragm');

  // ======================================================================
  // NERVOUS SYSTEM
  // ======================================================================
  const nerve = (pts, r, o = {}) => tube(pts, rodProf(r, o.r2 ?? r * 0.7), { seg: 40, radial: 8, ...o });
  const gyri = (x, y, z) => 0.035 * (Math.sin(x * 160 + Math.sin(z * 90) * 2) * Math.sin(y * 150 + Math.cos(x * 70)) * Math.sin(z * 140 + Math.sin(y * 80) * 2));
  add('nerves', 'cerebrum', null, merge([
    ell(V(0.0345, 1.672, -0.006), V(0.033, 0.058, 0.086), { ws: 56, hs: 40, disp: gyri }),
    ell(V(-0.0345, 1.672, -0.006), V(0.033, 0.058, 0.086), { ws: 56, hs: 40, disp: gyri }),
  ]), 'Cerebrum', { color: 0xdca69a });
  add('nerves', 'cerebellum', null, ell(V(0, 1.605, -0.062), V(0.05, 0.024, 0.03), { ws: 40, hs: 30, disp: (x, y) => 0.06 * Math.sin(y * 900) }), 'Cerebellum', { color: 0xd49287 });
  add('nerves', 'brainstem', null, tube([V(0, 1.645, -0.012), V(0, 1.6, -0.02), V(0, 1.56, -0.02)], rodProf(0.011, 0.007), { seg: 16, radial: 14 }), 'Brainstem', { color: 0xd8a093 });
  add('nerves', 'spinalCord', null, tube([V(0, 1.565, -0.02), ...cordPts.slice(0, 20)], (t, L) => lerp(0.0062, 0.0045, t) * (t > 0.92 ? 1 - smooth(0.92, 1, t) * 0.8 : 1) * Math.min(1, t * L / 0.004 + 0.4), { seg: 80, radial: 12, even: true }), 'Spinal cord');
  {
    const g = [];
    const start = cordPts[19];
    for (let k = 0; k < 10; k++) {
      const sx = (k - 4.5) * 0.0025;
      const tgt = k < 8 ? cordPts[Math.min(23, 20 + Math.floor(k / 2))] : V(0, 0.93, -0.06);
      const end = V(sx * 4, 0.9 - (k % 5) * 0.004, -0.07);
      g.push(tube([start.clone().add(V(sx, 0, 0)), tgt.clone().add(V(sx, -0.01, 0)), end], rodProf(0.0011), { seg: 24, radial: 6 }));
    }
    add('nerves', 'caudaEquina', null, merge(g), 'Cauda equina');
  }
  for (const s of SIDES) {
    const side = s > 0 ? 'L' : 'R';
    const lb = limbs(s);
    const eye = ell(S(s, 0.031, 1.637, 0.072), V(0.0118, 0.0118, 0.0118));
    const optic = nerve([S(s, 0.031, 1.637, 0.06), S(s, 0.022, 1.635, 0.04), S(s, 0.004, 1.632, 0.02)], 0.0022, { r2: 0.0022 });
    add('nerves', 'eyeOptic', side, eye, 'Eye', { color: 0xf3efe6 });
    add('nerves', 'eyeOptic', side, optic, 'Optic nerve (CN II)');
    add('nerves', 'trigeminal', side, merge([
      nerve([S(s, 0.02, 1.625, -0.01), S(s, 0.03, 1.63, 0.02), S(s, 0.03, 1.655, 0.07), onSkZ(s * 0.025, 1.69, 0.002)], 0.0012),
      nerve([S(s, 0.02, 1.625, -0.01), S(s, 0.035, 1.61, 0.03), S(s, 0.032, 1.608, 0.082), S(s, 0.02, 1.598, 0.089)], 0.0012),
      nerve([S(s, 0.02, 1.625, -0.01), S(s, 0.045, 1.58, 0.0), S(s, 0.05, 1.54, 0.04), S(s, 0.022, 1.515, 0.088)], 0.0012),
    ]), 'Trigeminal nerve (CN V)');
    const fo = S(s, 0.066, 1.585, 0.0);
    add('nerves', 'facialNerve', side, merge([
      nerve([S(s, 0.03, 1.625, -0.02), S(s, 0.06, 1.6, -0.02), fo], 0.0013, { r2: 0.0012 }),
      ...[onSkX(s, 1.68, 0.04, 0.003), S(s, 0.052, 1.612, 0.07), S(s, 0.046, 1.575, 0.088), S(s, 0.042, 1.528, 0.07), S(s, 0.05, 1.49, 0.03)]
        .map((e) => nerve([fo, fo.clone().lerp(e, 0.5).add(V(s * 0.006, 0, 0)), e], 0.0009)),
    ]), 'Facial nerve (CN VII)');
    add('nerves', 'vagus', side, nerve([S(s, 0.012, 1.6, -0.02), S(s, 0.03, 1.55, 0.0), S(s, 0.028, 1.47, 0.02), S(s, 0.025, 1.38, 0.0), S(s, 0.022, 1.25, 0.01), S(s, 0.025, 1.12, 0.03), S(s, 0.03, 1.05, 0.04)], 0.0016, { r2: 0.0012, seg: 60 }), 'Vagus nerve (CN X)');

    // sympathetic trunk with ganglia
    const st = [], stPts = [];
    vInfo.forEach((v, k) => { if (k >= 1) stPts.push(v.c.clone().add(V(s * (v.r + 0.006), 0, 0.006))); });
    stPts.push(V(s * 0.03, 0.95, -0.03), V(s * 0.015, 0.89, -0.065));
    st.push(nerve(stPts, 0.0012, { r2: 0.0009, seg: 80 }));
    stPts.forEach((p, k) => { if (k % 1 === 0) st.push(ell(p, V(0.0024, 0.0034, 0.0024), { ws: 8, hs: 6 })); });
    add('nerves', 'sympatheticTrunk', side, merge(st), 'Sympathetic trunk');

    // spinal nerve roots
    const sn = [];
    vInfo.forEach((v) => sn.push(nerve([v.cord, v.cord.clone().add(V(s * 0.02, -v.h * 0.4, 0.004)), v.cord.clone().add(V(s * 0.04, -v.h * 0.8, 0.012))], 0.0016, { seg: 10, radial: 6 })));
    for (let k = 0; k < 5; k++) sn.push(nerve([V(s * 0.012, 0.965 - k * 0.018, -0.06), V(s * 0.045, 0.955 - k * 0.02, -0.055)], 0.0014, { seg: 8, radial: 6 }));
    add('nerves', 'spinalNerves', side, merge(sn), 'Spinal nerves');

    // intercostal nerves follow beneath ribs
    const ic = [];
    ribCurves.filter((r) => r.s === s && r.i <= 11).forEach((r) => {
      const pts = r.pts.slice(1).map((p) => p.clone().add(V(0, -0.0075, 0)).multiply(V(0.97, 1, 0.97)));
      ic.push(nerve(pts, 0.0011, { r2: 0.0009, seg: 40, radial: 6 }));
    });
    add('nerves', 'intercostalNerves', side, merge(ic), 'Intercostal nerves');

    // brachial plexus
    const ax = S(s, 0.152, 1.37, -0.01);
    const bp = [];
    for (let k = 0; k < 5; k++) {
      const v = vInfo[4 + k];
      bp.push(nerve([v.cord.clone().add(V(s * 0.03, -0.004, 0.01)), S(s, 0.07, 1.44 - k * 0.012, 0.0), S(s, 0.12, 1.4 - k * 0.006, 0.0), ax.clone().add(V(0, -k * 0.003, 0))], 0.0022, { r2: 0.002, seg: 30 }));
    }
    bp.push(nerve([ax, LP(lb.U, s, 0.12, -150, 0.02), LP(lb.U, s, 0.15, 150, 0.024), LP(lb.U, s, 0.16, 100, 0.02)], 0.0016, { seg: 20 })); // axillary
    bp.push(nerve([ax, LP(lb.U, s, 0.25, -20, 0.017), LP(lb.U, s, 0.6, 10, 0.016), LP(lb.F, s, 0.1, 60, 0.012)], 0.0016, { seg: 30 })); // musculocutaneous
    add('nerves', 'brachialPlexus', side, merge(bp), 'Brachial plexus (with axillary & musculocutaneous nerves)');
    add('nerves', 'radialNerve', side, nerve([ax, LP(lb.U, s, 0.3, -150, 0.017), LP(lb.U, s, 0.55, 175, 0.016), LP(lb.U, s, 0.85, 95, 0.016), LP(lb.F, s, 0.1, 60, 0.013), LP(lb.F, s, 0.6, 85, 0.01), S(s, 0.28, 0.84, -0.01), S(s, 0.29, 0.79, 0.0)], 0.0022, { r2: 0.0012, seg: 70 }), 'Radial nerve');
    const md = [nerve([ax, LP(lb.U, s, 0.4, -60, 0.019), LP(lb.U, s, 0.92, -30, 0.019), LP(lb.F, s, 0.3, 0, 0.011), LP(lb.F, s, 0.95, 0, 0.009), S(s, 0.258, 0.82, 0.0)], 0.0022, { r2: 0.0016, seg: 70 })];
    [[0.29, 0.79], [0.272, 0.74], [0.258, 0.73], [0.247, 0.74]].forEach(([x, y]) => md.push(nerve([S(s, 0.258, 0.82, 0.0), S(s, x, y, 0.004)], 0.0009, { seg: 10, radial: 6 })));
    add('nerves', 'medianNerve', side, merge(md), 'Median nerve');
    const ul = [nerve([ax, LP(lb.U, s, 0.5, -110, 0.018), LP(lb.U, s, 0.97, -135, 0.023), LP(lb.F, s, 0.4, -80, 0.012), LP(lb.F, s, 0.95, -60, 0.01), S(s, 0.243, 0.82, -0.004)], 0.0022, { r2: 0.0015, seg: 70 })];
    [[0.247, 0.74], [0.238, 0.755]].forEach(([x, y]) => ul.push(nerve([S(s, 0.243, 0.82, -0.004), S(s, x, y, 0.0)], 0.0009, { seg: 10, radial: 6 })));
    add('nerves', 'ulnarNerve', side, merge(ul), 'Ulnar nerve');

    // lumbosacral
    const T_ = lb.T, L_ = lb.L;
    const fm = [nerve([vInfo[20].cord.clone().add(V(s * 0.035, 0, 0.01)), S(s, 0.055, 1.0, 0.0), S(s, 0.07, 0.93, 0.045), S(s, 0.08, 0.88, 0.05)], 0.0026, { r2: 0.0022, seg: 40 })];
    [[-30, 0.4], [-5, 0.55], [30, 0.5], [-70, 0.85]].forEach(([d, t]) => fm.push(nerve([S(s, 0.08, 0.88, 0.05), LP(T_, s, t * 0.5, d, 0.03), LP(T_, s, t, d, 0.035)], 0.0013, { seg: 20, radial: 6 })));
    fm.push(nerve([S(s, 0.08, 0.88, 0.05), LP(T_, s, 0.5, -70, 0.04), LP(T_, s, 0.95, -100, 0.04), LP(L_, s, 0.5, -60, 0.03), S(s, 0.075, 0.07, 0.015)], 0.0011, { seg: 50, radial: 6 })); // saphenous
    add('nerves', 'femoralNerve', side, merge(fm), 'Femoral nerve');
    const split = LP(T_, s, 0.82, 172, 0.028);
    add('nerves', 'sciaticNerve', side, nerve([V(s * 0.025, 0.94, -0.07), S(s, 0.07, 0.9, -0.075), S(s, 0.095, 0.85, -0.07), LP(T_, s, 0.1, 168, 0.03), LP(T_, s, 0.5, 172, 0.03), split], 0.0042, { r2: 0.0035, seg: 50, radial: 10 }), 'Sciatic nerve');
    add('nerves', 'tibialNerve', side, merge([
      nerve([split, LP(L_, s, 0.02, 180, 0.026), LP(L_, s, 0.5, -170, 0.02), LP(L_, s, 0.9, -130, 0.018), S(s, 0.075, 0.055, -0.025), S(s, 0.08, 0.02, 0.04), S(s, 0.07, 0.015, 0.12)], 0.0028, { r2: 0.0012, seg: 70 }),
      nerve([S(s, 0.08, 0.02, 0.04), S(s, 0.105, 0.015, 0.11)], 0.0011, { seg: 10, radial: 6 }),
    ]), 'Tibial nerve');
    add('nerves', 'commonFibular', side, nerve([split, LP(L_, s, 0.04, 140, 0.03), LP(L_, s, 0.14, 95, 0.026), LP(L_, s, 0.55, 60, 0.021), LP(L_, s, 0.92, 30, 0.016), S(s, 0.1, 0.05, 0.07), S(s, 0.085, 0.025, 0.13)], 0.0024, { r2: 0.001, seg: 70 }), 'Common fibular (peroneal) nerve');
  }

  if (sex === 'female') for (const p of parts) warpGeometry(p.geo, femaleWarp);
  else for (const p of parts) { p.geo.computeBoundingBox(); p.geo.computeBoundingSphere(); }
  return parts;
}
