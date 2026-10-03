import * as THREE from 'three';
import { isHelper, objectAnchors, selectionGeometryReader } from './model-object.js';
function triangleIntersectsRect(points, rect) {
  const corners = [
    [rect.left, rect.top],
    [rect.right, rect.top],
    [rect.right, rect.bottom],
    [rect.left, rect.bottom],
  ];
  const axes = [
    [1, 0],
    [0, 1],
  ];
  for (let i = 0; i < 3; i++) {
    const a = points[i],
      b = points[(i + 1) % 3];
    axes.push([a.y - b.y, b.x - a.x]);
  }
  for (const [x, y] of axes) {
    if (Math.abs(x) + Math.abs(y) < 1e-10) continue;
    const t = points.map((p) => p.x * x + p.y * y),
      r = corners.map((p) => p[0] * x + p[1] * y);
    if (Math.max(...t) < Math.min(...r) - 1e-7 || Math.max(...r) < Math.min(...t) - 1e-7)
      return false;
  }
  return true;
}
// Left-to-right contains the complete sweep; right-to-left crosses actual surfaces.
export function enclosedSweeps(sweeps, camera, width, height, a, b, model = sweeps) {
  const geometryForSelection = selectionGeometryReader(model);
  const rect = {
    left: Math.min(a.x, b.x),
    right: Math.max(a.x, b.x),
    top: Math.min(a.y, b.y),
    bottom: Math.max(a.y, b.y),
  };
  const vector = new THREE.Vector3();
  const project = (point) => {
    const p = vector.fromArray(point).project(camera);
    return { x: ((p.x + 1) * width) / 2, y: ((1 - p.y) * height) / 2, z: p.z };
  };
  const inside = (p) =>
    p.z >= -1 &&
    p.z <= 1 &&
    p.x >= rect.left &&
    p.x <= rect.right &&
    p.y >= rect.top &&
    p.y <= rect.bottom;
  return sweeps
    .filter((s) => {
      if (isHelper(s)) {
        const points = objectAnchors(s).map(project);
        if (b.x >= a.x || points.length === 1) return points.every(inside);
        if (points.every((p) => p.z < -1) || points.every((p) => p.z > 1)) return false;
        return triangleIntersectsRect([points[0], points[1], points[1]], rect);
      }
      const geometry = geometryForSelection(s);
      const vertices = geometry.attributes.position.array;
      if (!vertices.length) return false;
      // Orthographic projection is affine: eight box corners bound every surface point.
      // Accept fully enclosed objects and reject disjoint ones before examining triangles.
      if (camera.isOrthographicCamera) {
        const box = geometry.boundingBox;
        const corners = [];
        for (const x of [box.min.x, box.max.x])
          for (const y of [box.min.y, box.max.y])
            for (const z of [box.min.z, box.max.z]) corners.push(project([x, y, z]));
        if (corners.every(inside)) return true;
        if (
          Math.max(...corners.map((p) => p.x)) < rect.left ||
          Math.min(...corners.map((p) => p.x)) > rect.right ||
          Math.max(...corners.map((p) => p.y)) < rect.top ||
          Math.min(...corners.map((p) => p.y)) > rect.bottom ||
          corners.every((p) => p.z < -1) ||
          corners.every((p) => p.z > 1)
        )
          return false;
      }
      if (b.x >= a.x) {
        if (!vertices.length) return false;
        for (let i = 0; i < vertices.length; i += 3)
          if (!inside(project(vertices.subarray(i, i + 3)))) return false;
        return true;
      }
      const index = geometry.index;
      for (let i = 0; i < (index?.count ?? vertices.length / 3); i += 3) {
        const points = [0, 1, 2].map((offset) => {
          const start = (index ? index.getX(i + offset) : i + offset) * 3;
          return project(vertices.subarray(start, start + 3));
        });
        if (points.every((p) => p.z < -1) || points.every((p) => p.z > 1)) continue;
        if (triangleIntersectsRect(points, rect)) return true;
      }
      return false;
    })
    .map((s) => s.id);
}
