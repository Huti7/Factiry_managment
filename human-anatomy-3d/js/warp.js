// Female body proportions applied as a smooth warp of the (male) model.
// Narrower shoulders and rib cage, wider pelvis (larger Q-angle), slightly smaller overall.
import { lerp, smooth } from './geometry.js';

export function femaleWarp(p) {
  const ax = Math.abs(p.x), sg = Math.sign(p.x) || 1, y = p.y;
  const arm = smooth(0.155, 0.19, ax) * smooth(0.45, 0.55, y) * (1 - smooth(1.47, 1.52, y));
  const torsoT = smooth(1.02, 1.18, y) * (1 - smooth(1.46, 1.53, y));
  const pelv = smooth(0.5, 0.88, y) * (1 - smooth(1.0, 1.1, y));
  const fx = 1 + 0.11 * pelv - 0.075 * torsoT;
  p.x = lerp(p.x * fx, p.x - sg * 0.013, arm);
  p.z *= 1 - 0.03 * torsoT;
  p.multiplyScalar(0.93);
}
