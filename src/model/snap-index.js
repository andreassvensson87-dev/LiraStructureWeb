import * as THREE from 'three';
import { createSnapGeometryContext, objectAnchors } from '../model-object.js';

/** Screen bounds are cheap to index; detailed corners and edges are evaluated only near the cursor. */
export class SnapIndex {
  constructor(model) {
    this.model = model;
    this.context = createSnapGeometryContext(model);
    this.signature = '';
    this.cells = new Map();
    this.large = [];
  }
  nearbyContext(camera, width, height, pointer, start, midpoint, perpendicular) {
    const clip = new THREE.Matrix4().multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse,
    );
    const screen = new THREE.Vector3(),
      a = new THREE.Vector3(),
      b = new THREE.Vector3(),
      delta = new THREE.Vector3(),
      candidate = new THREE.Vector3();
    const origin = start ? new THREE.Vector3(...start) : null;
    const near = (point, tolerance) => {
      screen.copy(point).applyMatrix4(clip);
      if (Math.abs(screen.z) > 1) return false;
      const x = ((screen.x + 1) * width) / 2 - pointer[0];
      const y = ((1 - screen.y) * height) / 2 - pointer[1];
      return x * x + y * y < tolerance * tolerance;
    };
    return {
      holeCenters: (s) =>
        this.context.holeCenters(s).filter((h) => near(a.fromArray(h.coords), 14)),
      objectCorners: (s) => {
        const { points, matrix } = this.context.cornerFeatures(s);
        const result = [];
        for (const coords of points) {
          a.fromArray(coords);
          if (matrix) a.applyMatrix4(matrix);
          if (near(a, 14)) result.push(a.toArray());
        }
        return result;
      },
      objectSegments: (s) => {
        const { segments, matrix } = this.context.segmentFeatures(s);
        const result = [];
        for (const [from, to] of segments) {
          a.fromArray(from);
          b.fromArray(to);
          if (matrix) {
            a.applyMatrix4(matrix);
            b.applyMatrix4(matrix);
          }
          let include = midpoint && near(candidate.copy(a).add(b).multiplyScalar(0.5), 12);
          if (!include && perpendicular && origin) {
            delta.copy(b).sub(a);
            const length = delta.lengthSq();
            const t = length > 1e-12 ? candidate.copy(origin).sub(a).dot(delta) / length : -1;
            include = t >= 0 && t <= 1 && near(candidate.copy(a).addScaledVector(delta, t), 12);
          }
          if (include) result.push([a.toArray(), b.toArray()]);
        }
        return result;
      },
    };
  }
  query(camera, width, height, pointer) {
    if (!camera.isOrthographicCamera) return this.model;
    const signature = [
      ...camera.matrixWorld.elements,
      ...camera.projectionMatrix.elements,
      width,
      height,
    ].join(',');
    if (signature !== this.signature) {
      this.signature = signature;
      this.cells.clear();
      this.large = [];
      const box = new THREE.Box3(),
        vector = new THREE.Vector3();
      for (const object of this.model) {
        box.copy(this.context.bounds(object));
        for (const anchor of objectAnchors(object)) box.expandByPoint(vector.fromArray(anchor));
        if (box.isEmpty()) continue;
        let minX = Infinity,
          minY = Infinity,
          maxX = -Infinity,
          maxY = -Infinity;
        let minZ = Infinity,
          maxZ = -Infinity;
        for (const x of [box.min.x, box.max.x])
          for (const y of [box.min.y, box.max.y])
            for (const z of [box.min.z, box.max.z]) {
              vector.set(x, y, z).project(camera);
              const sx = ((vector.x + 1) * width) / 2,
                sy = ((1 - vector.y) * height) / 2;
              minX = Math.min(minX, sx);
              maxX = Math.max(maxX, sx);
              minY = Math.min(minY, sy);
              maxY = Math.max(maxY, sy);
              minZ = Math.min(minZ, vector.z);
              maxZ = Math.max(maxZ, vector.z);
            }
        minX -= 16;
        minY -= 16;
        maxX += 16;
        maxY += 16;
        if (maxZ < -1 || minZ > 1 || maxX < 0 || maxY < 0 || minX > width || minY > height)
          continue;
        const entry = { object, minX, minY, maxX, maxY };
        const left = Math.floor(Math.max(0, minX) / 64),
          right = Math.floor(Math.min(width, maxX) / 64);
        const top = Math.floor(Math.max(0, minY) / 64),
          bottom = Math.floor(Math.min(height, maxY) / 64);
        if ((right - left + 1) * (bottom - top + 1) > 100) {
          this.large.push(entry);
          continue;
        }
        for (let x = left; x <= right; x++)
          for (let y = top; y <= bottom; y++) {
            const key = `${x}:${y}`;
            if (!this.cells.has(key)) this.cells.set(key, []);
            this.cells.get(key).push(entry);
          }
      }
    }
    const [x, y] = pointer;
    return [...(this.cells.get(`${Math.floor(x / 64)}:${Math.floor(y / 64)}`) || []), ...this.large]
      .filter((r) => x >= r.minX && x <= r.maxX && y >= r.minY && y <= r.maxY)
      .map((r) => r.object);
  }
}
