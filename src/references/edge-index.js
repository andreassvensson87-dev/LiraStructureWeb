import { perpendicularPoint } from '../snap-geometry.js';
import { nearestProjectedSegment } from '../model/snap-projection.js';
import { withinWorkArea, clipSegmentToBox } from '../model/work-area.js';
import * as THREE from 'three';
/** Bounding-volume tree over geometric feature edges, never triangle diagonals. */
export function edgeIndex(array) {
  const ids = Array.from({ length: array.length / 6 }, (_, i) => i);
  const point = (i, end) => new THREE.Vector3().fromArray(array, i * 6 + end * 3);
  const build = (items) => {
    const box = new THREE.Box3();
    for (const i of items) {
      box.expandByPoint(point(i, 0));
      box.expandByPoint(point(i, 1));
    }
    if (items.length <= 24) return { box, items };
    const size = box.getSize(new THREE.Vector3()),
      axis = size.x > size.y ? (size.x > size.z ? 0 : 2) : size.y > size.z ? 1 : 2;
    items.sort(
      (a, b) =>
        array[a * 6 + axis] +
        array[a * 6 + 3 + axis] -
        (array[b * 6 + axis] + array[b * 6 + 3 + axis]),
    );
    const middle = Math.floor(items.length / 2);
    return { box, left: build(items.slice(0, middle)), right: build(items.slice(middle)) };
  };
  const root = build(ids);
  return {
    bounds: root.box,
    query(ray, radius) {
      const result = [],
        box = new THREE.Box3();
      const visit = (node) => {
        if (!ray.intersectsBox(box.copy(node.box).expandByScalar(radius))) return;
        if (node.items) result.push(...node.items);
        else {
          visit(node.left);
          visit(node.right);
        }
      };
      visit(root);
      return result;
    },
  };
}
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
          if (withinWorkArea(workArea, p.toArray()) && screen(p).distanceTo(cursor) < 14)
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
          if (point && screen(new THREE.Vector3(...point)).distanceTo(cursor) < 12)
            result.push({ coords: point, label: 'Vinkelrät', symbol: 'perpendicular' });
        }
        if (nearest) {
          const point = nearestProjectedSegment(pointer, from, to, camera, width, height);
          if (point && screen(new THREE.Vector3(...point)).distanceTo(cursor) < 10)
            result.push({ coords: point, label: 'Närmaste', symbol: 'line', edge: true });
        }
      }
    }
  }
  return result;
}
