import * as THREE from 'three';
import { planeFrame } from './plate.js';

// Three clicks define a right-handed, orthonormal frame in model coordinates.
export function workPlaneFromPoints(points) {
  return planeFrame('three', points);
}
// Keep the picked X direction; use the previous Y as orientation reference.
// If X coincides with that Y, retain the previous plane normal instead of a singular frame.
export function workPlaneFromTwoPoints(points, reference = null) {
  if (
    points.length !== 2 ||
    points.some((p) => !Array.isArray(p) || p.length !== 3 || !p.every(Number.isFinite))
  )
    throw new Error('Välj två giltiga punkter.');
  const origin = points[0],
    u = new THREE.Vector3(...points[1]).sub(new THREE.Vector3(...origin));
  if (u.length() < 1) throw new Error('Välj en punkt minst 1 mm från origo.');
  u.normalize();
  const previousU = new THREE.Vector3(...(reference?.u || [1, 0, 0]));
  const previousV = new THREE.Vector3(...(reference?.v || [0, 1, 0]));
  const normal = u.clone().cross(previousV);
  if (normal.length() < 1e-8) normal.copy(previousU).cross(previousV);
  const v = normal.normalize().cross(u).normalize();
  return { origin: [...origin], u: u.toArray(), v: v.toArray() };
}
export function drawingWorkPlane(operation, temporaryPlane) {
  if (operation?.planeId) return null;
  if (operation?.mode === 'fastenerCreate') return operation.frame;
  if (operation?.mode === 'plateCreate') return operation.frame;
  if (operation?.mode === 'plateVertex') return operation.source.frame;
  if (operation?.gripRefs || operation?.mode === 'grip')
    return operation.frame || (operation.linearId ? temporaryPlane : null) || null;
  return !operation || ['move', 'copy'].includes(operation.mode) ? temporaryPlane : null;
}
