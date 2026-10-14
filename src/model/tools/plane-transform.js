import * as THREE from 'three';
import { workPlaneFromPoints } from '../../work-plane.js';
import { rotateObject } from '../../rotation.js';
import { transformObject } from '../../transform.js';

/** Rigid mapping between two three-point frames; point spacing never scales objects. */
export function planeTransformCandidates(sources, startPoints, targetPoints) {
  for (const points of [startPoints, targetPoints])
    if (points.length !== 3 || points.some((p) => p.length !== 3 || !p.every(Number.isFinite)))
      throw Error('Välj tre giltiga punkter för varje plan.');
  const start = workPlaneFromPoints(startPoints),
    target = workPlaneFromPoints(targetPoints);
  const basis = (frame) => {
    const u = new THREE.Vector3(...frame.u),
      v = new THREE.Vector3(...frame.v);
    return new THREE.Matrix4().makeBasis(u, v, u.clone().cross(v));
  };
  const q = new THREE.Quaternion()
    .setFromRotationMatrix(basis(target).multiply(basis(start).transpose()))
    .normalize();
  if (q.w < 0) q.set(-q.x, -q.y, -q.z, -q.w);
  const angle = 2 * Math.acos(THREE.MathUtils.clamp(q.w, -1, 1));
  const axis = new THREE.Vector3(q.x, q.y, q.z);
  if (axis.lengthSq() < 1e-20) axis.set(0, 0, 1);
  return sources.map((source) =>
    transformObject(
      rotateObject(source, start.origin, axis.normalize().toArray(), (angle * 180) / Math.PI),
      'move',
      start.origin,
      target.origin,
    ),
  );
}
