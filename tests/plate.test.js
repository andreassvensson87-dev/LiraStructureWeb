import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  planeFrame,
  plateGeometry,
  plateVertices,
  plateCorners,
  validatePlate,
  plateArea,
} from '../src/plate.js';
import { rotateSweep } from '../src/rotation.js';
import { transformSweep } from '../src/transform.js';
import { enclosedSweeps } from '../src/selection.js';
import { resolveSnap } from '../src/snap.js';
const plate = {
  id: 'plate',
  type: 'plate',
  frame: planeFrame('XY', [[0, 0, 0]]),
  polygon: [
    [0, 0],
    [3000, 0],
    [3000, 2000],
    [1000, 2000],
    [1000, 4000],
    [0, 4000],
  ],
  thickness: 200,
  side: 'center',
};
test('concave Plate has correct closed outward volume on all placements and planes', () => {
  for (const mode of ['XY', 'XZ', 'YZ', 'three'])
    for (const side of ['center', 'positive', 'negative'])
      for (const polygon of [plate.polygon, [...plate.polygon].reverse()]) {
        const s = {
          ...plate,
          side,
          polygon,
          frame: planeFrame(mode, [
            [100, 200, 300],
            [2100, 400, 1100],
            [100, 2700, 800],
          ]),
        };
        assert.equal(validatePlate(s), '');
        const g = plateGeometry(s),
          p = g.attributes.position;
        let volume = 0;
        const edges = new Map();
        for (let i = 0; i < p.count; i += 3) {
          const tri = [0, 1, 2].map((j) => new THREE.Vector3().fromBufferAttribute(p, i + j));
          volume += tri[0].dot(tri[1].clone().cross(tri[2])) / 6;
          for (let j = 0; j < 3; j++) {
            const a = tri[j]
                .toArray()
                .map((v) => v.toFixed(2))
                .join(','),
              b = tri[(j + 1) % 3]
                .toArray()
                .map((v) => v.toFixed(2))
                .join(',');
            const k = [a, b].sort().join('|');
            edges.set(k, (edges.get(k) || 0) + 1);
          }
        }
        assert.ok(
          Math.abs(volume - plateArea(s) * s.thickness) / (plateArea(s) * s.thickness) < 1e-5,
        );
        assert.ok([...edges.values()].every((n) => n === 2));
        g.dispose();
      }
});
test('invalid polygons and planes are rejected', () => {
  for (const polygon of [
    [
      [0, 0],
      [100, 100],
      [0, 100],
      [100, 0],
    ],
    [
      [0, 0],
      [100, 0],
      [50, 0],
    ],
    [
      [0, 0],
      [0, 0],
      [100, 100],
    ],
    [
      [0, 0],
      [100, 0],
      [100, 100],
      [50, 0],
      [0, 100],
    ],
  ])
    assert.ok(validatePlate({ ...plate, polygon }));
  assert.throws(() =>
    planeFrame('three', [
      [0, 0, 0],
      [1, 0, 0],
      [2, 0, 0],
    ]),
  );
  assert.ok(validatePlate({ ...plate, thickness: 0 }));
});
test('plate move and arbitrary rotation preserve all corners and source', () => {
  const before = structuredClone(plate),
    moved = transformSweep(plate, 'copy', [0, 0, 0], [300, 700, 900]);
  assert.deepEqual(plateVertices(moved)[0], [300, 700, 900]);
  const axis = new THREE.Vector3(1, 2, 3).normalize(),
    q = new THREE.Quaternion().setFromAxisAngle(axis, 0.7),
    rotated = rotateSweep(plate, [0, 0, 0], axis.toArray(), (0.7 * 180) / Math.PI);
  plateCorners(rotated).forEach((p, i) =>
    assert.ok(
      new THREE.Vector3(...p).distanceTo(
        new THREE.Vector3(...plateCorners(plate)[i]).applyQuaternion(q),
      ) < 1e-6,
    ),
  );
  assert.deepEqual(plate, before);
});
test('plate snaps in its work plane and participates in window/crossing selection', () => {
  const camera = new THREE.OrthographicCamera(-5000, 5000, 5000, -5000, 1, 10000);
  camera.position.set(0, 0, 5000);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  assert.deepEqual(
    enclosedSweeps([plate], camera, 1000, 1000, { x: 490, y: 90 }, { x: 810, y: 510 }),
    ['plate'],
  );
  const ray = new THREE.Raycaster();
  ray.setFromCamera(new THREE.Vector2(0, 0), camera);
  const snap = resolveSnap({
    pointer: [500, 500],
    camera,
    width: 1000,
    height: 1000,
    ray: ray.ray,
    start: null,
    z: 0,
    sweeps: [plate],
    grid: { x: [], y: [] },
    workPlane: plate.frame,
  });
  assert.deepEqual(snap.point, [0, 0, 0]);
  const raised = planeFrame('XY', [[0, 0, 500]]),
    above = resolveSnap({
      pointer: [500, 500],
      camera,
      width: 1000,
      height: 1000,
      ray: ray.ray,
      start: null,
      z: 0,
      sweeps: [plate],
      grid: { x: [0], y: [0] },
      workPlane: raised,
    });
  assert.deepEqual(above.point, [0, 0, 500]);
});
