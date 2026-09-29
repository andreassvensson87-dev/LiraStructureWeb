import * as THREE from 'three';

// Keep the numbering frame stable, but remove its reflection for drawing cameras.
export function partDrawingReflection(localMatrix) {
  return localMatrix.determinant() < 0 ? new THREE.Matrix4().makeScale(1, -1, 1) : null;
}

// Drawing coordinates: length, transverse direction, profile height.
// These are intrinsic profile directions, never the model's global up.
export function partViewFrame(view) {
  if (view === 'front')
    return { origin: [0, 0, 0], x: [1, 0, 0], y: [0, 0, 1], normal: [0, -1, 0] };
  if (view === 'top') return { origin: [0, 0, 0], x: [1, 0, 0], y: [0, 1, 0], normal: [0, 0, 1] };
  if (view === 'bottom')
    return { origin: [0, 0, 0], x: [1, 0, 0], y: [0, -1, 0], normal: [0, 0, -1] };
  if (view === 'back') return { origin: [0, 0, 0], x: [-1, 0, 0], y: [0, 0, 1], normal: [0, 1, 0] };
  if (view === 'left')
    return { origin: [0, 0, 0], x: [0, -1, 0], y: [0, 0, 1], normal: [-1, 0, 0] };
  if (view === 'right') return { origin: [0, 0, 0], x: [0, 1, 0], y: [0, 0, 1], normal: [1, 0, 0] };
  throw new Error(`Unknown part projection: ${view}`);
}
