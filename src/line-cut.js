import * as THREE from 'three';
import { plateVertices, plateNormal } from './plate.js';
export const isLineCut = (s) => s?.type === 'linecut';
export function lineCutFrame(s) {
  const [a, b] = plateVertices(s).map((p) => new THREE.Vector3(...p)),
    u = b.clone().sub(a).normalize(),
    v = plateNormal(s),
    n = u.clone().cross(v).normalize();
  return { origin: a, u, v, n, length: a.distanceTo(b) };
}
export function validateLineCut(s) {
  if (!s.frame || s.polygon?.length !== 2) return 'Linecut behöver två punkter.';
  if (![...s.frame.origin, ...s.frame.u, ...s.frame.v, ...s.polygon.flat()].every(Number.isFinite))
    return 'Ange giltiga koordinater.';
  const u = new THREE.Vector3(...s.frame.u),
    v = new THREE.Vector3(...s.frame.v);
  if (
    Math.abs(u.length() - 1) > 1e-6 ||
    Math.abs(v.length() - 1) > 1e-6 ||
    Math.abs(u.dot(v)) > 1e-6
  )
    return 'Ogiltigt arbetsplan.';
  if (lineCutFrame(s).length < 1) return 'Punkterna måste ligga minst 1 mm isär.';
  if (
    plateVertices(s)
      .flat()
      .some((x) => Math.abs(x) > 1e7)
  )
    return 'Koordinater måste ligga inom ±10 000 000 mm.';
  if (!['positive', 'negative'].includes(s.side)) return 'Välj vilken sida som ska tas bort.';
  return '';
}
// A finite display rectangle represents the infinite cutting plane, not material.
export function lineCutGeometry(s) {
  const { origin, u, v, n, length } = lineCutFrame(s),
    g = new THREE.PlaneGeometry(length, Math.max(500, length * 0.35));
  const m = new THREE.Matrix4().makeBasis(u, v, n);
  m.setPosition(origin.clone().addScaledVector(u, length / 2));
  g.applyMatrix4(m);
  return g.toNonIndexed();
}
export function lineCutTool(s, target) {
  const { origin, u, v, n } = lineCutFrame(s);
  target.computeBoundingBox();
  const box = target.boundingBox;
  if (box.isEmpty()) return null;
  const min = [Infinity, Infinity, Infinity],
    max = [-Infinity, -Infinity, -Infinity];
  for (const x of [box.min.x, box.max.x])
    for (const y of [box.min.y, box.max.y])
      for (const z of [box.min.z, box.max.z]) {
        const p = new THREE.Vector3(x, y, z).sub(origin);
        [u, v, n].forEach((axis, i) => {
          const t = p.dot(axis);
          min[i] = Math.min(min[i], t);
          max[i] = Math.max(max[i], t);
        });
      }
  const positive = s.side === 'positive';
  if (positive ? max[2] <= 0 : min[2] >= 0) return null;
  const margin = Math.max(10, box.getSize(new THREE.Vector3()).length() * 0.01);
  for (let i = 0; i < 3; i++) {
    min[i] -= margin;
    max[i] += margin;
  }
  if (positive) min[2] = 0;
  else max[2] = 0;
  const g = new THREE.BoxGeometry(...max.map((m, i) => m - min[i]));
  const m = new THREE.Matrix4().makeBasis(u, v, n);
  m.setPosition(
    origin
      .clone()
      .addScaledVector(u, (min[0] + max[0]) / 2)
      .addScaledVector(v, (min[1] + max[1]) / 2)
      .addScaledVector(n, (min[2] + max[2]) / 2),
  );
  g.applyMatrix4(m);
  return g;
}
