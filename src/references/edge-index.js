import { SNAP_PIXELS } from '../snap-priority.js';
import { perpendicularPoint } from '../snap-geometry.js';
import { nearestProjectedSegment } from '../model/snap-projection.js';
import { withinWorkArea, clipSegmentToBox } from '../model/work-area.js';
import * as THREE from 'three';
export function referenceCandidates(
  parts,
  {
    ray,
    camera,
    pointer,
    width,
    height,
    corners = true,
    edges = true,
    nearest = true,
    perpendicular = false,
    start = null,
    labelPrefix = 'IFC',
    workArea = null,
  },
) {
  if (!corners && (!edges || (!nearest && (!perpendicular || !start)))) return [];
  const result = [],
    cursor = new THREE.Vector2(...pointer);
  const screen = (p) => {
    const q = p.clone().project(camera);
    return new THREE.Vector2(((q.x + 1) * width) / 2, ((1 - q.y) * height) / 2);
  };
  for (const part of parts) {
    if (!part.mesh.visible) continue;
    part.mesh.updateWorldMatrix(true, false);
    const matrix = part.mesh.matrixWorld,
      inverse = matrix.clone().invert(),
      localRay = ray.clone().applyMatrix4(inverse);
    const scale = new THREE.Vector3().setFromMatrixScale(matrix);
    const span = camera.isPerspectiveCamera
      ? (2 *
          camera.position.distanceTo(part.mesh.getWorldPosition(new THREE.Vector3())) *
          Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) /
        camera.zoom
      : Math.abs(camera.top - camera.bottom) / camera.zoom;
    const radius = ((span / height) * 16) / Math.min(scale.x, scale.y, scale.z);
    for (const i of part.index.query(localRay, radius)) {
      const a = new THREE.Vector3().fromArray(part.edges, i * 6).applyMatrix4(matrix),
        b = new THREE.Vector3().fromArray(part.edges, i * 6 + 3).applyMatrix4(matrix);
      if (corners)
        for (const p of [a, b])
          if (
            withinWorkArea(workArea, p.toArray()) &&
            screen(p).distanceTo(cursor) < SNAP_PIXELS.exact + SNAP_PIXELS.retention
          )
            result.push({ coords: p.toArray(), label: `${labelPrefix}-hörn`, symbol: 'square' });
      if (edges) {
        const clipped = clipSegmentToBox(a.toArray(), b.toArray(), workArea);
        if (!clipped) continue;
        a.fromArray(clipped[0]);
        b.fromArray(clipped[1]);
        const from = a.toArray(),
          to = b.toArray();
        if (perpendicular && start) {
          const point = perpendicularPoint(start, from, to);
          if (
            point &&
            screen(new THREE.Vector3(...point)).distanceTo(cursor) <
              SNAP_PIXELS.exact + SNAP_PIXELS.retention
          )
            result.push({ coords: point, label: 'Vinkelrät', symbol: 'perpendicular' });
        }
        if (nearest) {
          const point = nearestProjectedSegment(pointer, from, to, camera, width, height);
          if (point && screen(new THREE.Vector3(...point)).distanceTo(cursor) < SNAP_PIXELS.nearest)
            result.push({ coords: point, label: 'Närmaste', symbol: 'line', edge: true });
        }
      }
    }
  }
  return result;
}
