import { planeFrame } from './plate.js';

// Three clicks define a right-handed, orthonormal frame in model coordinates.
export function workPlaneFromPoints(points) {
  return planeFrame('three', points);
}
export function drawingWorkPlane(operation, temporaryPlane) {
  if (operation?.planeId) return null;
  if (operation?.mode === 'plateCreate') return operation.frame;
  if (operation?.mode === 'plateVertex') return operation.source.frame;
  if (operation?.gripRefs || operation?.mode === 'grip') return operation.frame || null;
  return !operation || ['move', 'copy'].includes(operation.mode) ? temporaryPlane : null;
}
