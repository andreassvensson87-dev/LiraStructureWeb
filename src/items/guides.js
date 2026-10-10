import * as THREE from 'three';
import { pointValid } from './data.js';
export function helperIntersection(a, b) {
  const p = new THREE.Vector3(...a[0]),
    q = new THREE.Vector3(...b[0]);
  const u = new THREE.Vector3(...a[1]).sub(p),
    v = new THREE.Vector3(...b[1]).sub(q);
  const n = u.clone().cross(v),
    size = n.lengthSq();
  if (size < 1e-12) return null;
  const d = q.clone().sub(p),
    t = d.clone().cross(v).dot(n) / size,
    s = d.clone().cross(u).dot(n) / size;
  if (t < -1e-8 || t > 1 + 1e-8 || s < -1e-8 || s > 1 + 1e-8) return null;
  const first = p.addScaledVector(u, t),
    second = q.addScaledVector(v, s);
  return first.distanceTo(second) < 0.001 ? first.toArray() : null;
}
export function helperSnapPoints(lines) {
  const result = lines.flatMap(([a, b]) => [a, b, a.map((v, i) => (v + b[i]) / 2)]);
  for (let i = 0; i < lines.length; i++)
    for (let j = i + 1; j < lines.length; j++) {
      const point = helperIntersection(lines[i], lines[j]);
      if (point) result.push(point);
    }
  return result;
}
export function addHelperLine(lines, start, end) {
  if (
    !pointValid(start) ||
    !pointValid(end) ||
    Math.hypot(...end.map((v, i) => v - start[i])) < 0.001
  )
    throw Error('Hjälplinjen behöver två olika punkter.');
  return [...lines, [[...start], [...end]]];
}
