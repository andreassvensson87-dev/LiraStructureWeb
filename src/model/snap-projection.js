import * as THREE from 'three';
import { segmentParameter, segmentPoint } from '../snap-geometry.js';

// Screen proximity chooses a point on the real 3D edge, including perspective views.
export function nearestProjectedSegment(pointer, a, b, camera, width, height) {
  const project = (p) =>
    new THREE.Vector4(...p, 1)
      .applyMatrix4(camera.matrixWorldInverse)
      .applyMatrix4(camera.projectionMatrix);
  const from = project(a),
    to = project(b);
  if (from.w <= 0 || to.w <= 0) return null;
  const screen = (p) => [((p.x / p.w + 1) * width) / 2, ((1 - p.y / p.w) * height) / 2];
  const t = segmentParameter(pointer, screen(from), screen(to));
  if (t === null) return null;
  const s = Math.max(0, Math.min(1, t));
  return segmentPoint(a, b, (s * from.w) / ((1 - s) * to.w + s * from.w));
}
