import * as THREE from 'three';
import { clipSegmentToBox } from './work-area.js';
const viewport = new THREE.Box3(new THREE.Vector3(-1, -1, -1), new THREE.Vector3(1, 1, 1));

/** Project the already selected edge, clipped to the viewport; never rescan model geometry. */
export function modelNearestFeedback(snap, camera, width, height) {
  if (snap?.label !== 'Närmaste' || snap.snapEdge?.points?.length !== 2 || !width || !height)
    return null;
  const projected = snap.snapEdge.points.map((p) =>
    new THREE.Vector3(...p).project(camera).toArray(),
  );
  if (projected.some((p) => !p.every(Number.isFinite))) return null;
  const clipped = clipSegmentToBox(projected[0], projected[1], viewport);
  if (!clipped) return null;
  return {
    label: 'Närmaste',
    snapEdge: { points: clipped.map(([x, y]) => [((x + 1) * width) / 2, ((1 - y) * height) / 2]) },
  };
}
