import * as THREE from 'three';
import { workPlaneAxes } from '../work-plane.js';

/** Project accepted snap feedback only; this does not choose or modify a snap. */
export function modelAxisFeedback({ snap, start, workPlane, camera, width, height }) {
  if (!start || !snap?.point || snap.kind === 'free' || !width || !height) return null;
  const base = snap.trackingBase || start;
  const delta = new THREE.Vector3(...snap.point).sub(new THREE.Vector3(...base));
  if (delta.length() < 1e-6) return null;
  const axes = workPlaneAxes(workPlane);
  const axis = Object.keys(axes).find(
    (key) =>
      delta
        .clone()
        .cross(new THREE.Vector3(...axes[key]))
        .length() < Math.max(0.001, delta.length() * 1e-8),
  );
  if (!axis && snap.kind !== 'direction') return null;
  const project = (point) => {
    const p = new THREE.Vector3(...point).project(camera);
    return Math.abs(p.z) <= 1 && Number.isFinite(p.x) && Number.isFinite(p.y)
      ? [((p.x + 1) * width) / 2, ((1 - p.y) * height) / 2]
      : null;
  };
  const a = project(base),
    b = project(snap.point);
  if (!a || !b) return null;
  const difference = b.map((v, i) => v - a[i]),
    length = Math.hypot(...difference);
  if (length < 24) return null;
  const direction = difference.map((v) => v / length);
  let corner = null;
  if (axis) {
    const candidates = Object.keys(axes)
      .filter((key) => key !== axis)
      .map((key) => {
        const p = project(
          new THREE.Vector3(...base)
            .addScaledVector(new THREE.Vector3(...axes[key]), delta.length())
            .toArray(),
        );
        if (!p) return null;
        const d = p.map((v, i) => v - a[i]),
          n = Math.hypot(...d);
        return n > 1 ? d.map((v) => v / n) : null;
      })
      .filter(Boolean)
      .sort(
        (p, q) =>
          Math.abs(q[0] * direction[1] - q[1] * direction[0]) -
          Math.abs(p[0] * direction[1] - p[1] * direction[0]),
      );
    const side = candidates[0];
    if (side && Math.abs(side[0] * direction[1] - side[1] * direction[0]) > 0.2) {
      const along = a.map((v, i) => v + direction[i] * 7);
      const across = a.map((v, i) => v + side[i] * 7);
      corner = [along, along.map((v, i) => v + side[i] * 7), across];
    }
  }
  return { axis, a, b, end: b.map((v, i) => v + direction[i] * 28), corner };
}
