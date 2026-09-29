import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { workPlaneFromPoints, drawingWorkPlane } from '../src/work-plane.js';
import { resolveSnap } from '../src/snap.js';
test('three model points define an orthonormal inclined plane through all points', () => {
  const points = [
      [100, 200, 300],
      [2100, 200, 2300],
      [100, 3200, 3300],
    ],
    frame = workPlaneFromPoints(points),
    u = new THREE.Vector3(...frame.u),
    v = new THREE.Vector3(...frame.v),
    normal = u.clone().cross(v);
  assert.deepEqual(frame.origin, points[0]);
  assert.ok(Math.abs(u.length() - 1) < 1e-10);
  assert.ok(Math.abs(v.length() - 1) < 1e-10);
  assert.ok(Math.abs(u.dot(v)) < 1e-10);
  for (const p of points)
    assert.ok(
      Math.abs(new THREE.Vector3(...p).sub(new THREE.Vector3(...frame.origin)).dot(normal)) < 1e-8,
    );
  const target = new THREE.Vector3(...frame.origin)
      .addScaledVector(u, 1234)
      .addScaledVector(v, 987),
    camera = new THREE.OrthographicCamera(-5000, 5000, 5000, -5000, 1, 100000);
  camera.position.copy(target).addScaledVector(normal, 10000);
  camera.up.copy(v);
  camera.lookAt(target);
  camera.updateMatrixWorld();
  const caster = new THREE.Raycaster();
  caster.setFromCamera(new THREE.Vector2(0, 0), camera);
  const result = resolveSnap({
    pointer: [500, 500],
    camera,
    width: 1000,
    height: 1000,
    ray: caster.ray,
    start: null,
    z: 0,
    sweeps: [],
    grid: { x: [], y: [] },
    workPlane: frame,
  });
  assert.ok(target.distanceTo(new THREE.Vector3(...result.point)) < 1e-8);
});
test('duplicate and collinear workplane points are rejected', () => {
  for (const points of [
    [
      [0, 0, 0],
      [0, 0, 0],
      [0, 100, 0],
    ],
    [
      [0, 0, 0],
      [100, 100, 100],
      [200, 200, 200],
    ],
  ])
    assert.throws(() => workPlaneFromPoints(points), /samma linje/);
});

test('copy and move use the active inclined plane for target snapping', () => {
  const frame = workPlaneFromPoints([
    [0, 0, 0],
    [2000, 0, 2000],
    [0, 2000, 0],
  ]);
  const normal = new THREE.Vector3(...frame.u).cross(new THREE.Vector3(...frame.v)),
    target = new THREE.Vector3(...frame.u)
      .multiplyScalar(1234)
      .addScaledVector(new THREE.Vector3(...frame.v), 789);
  const camera = new THREE.OrthographicCamera(-5000, 5000, 5000, -5000, 1, 100000);
  camera.position.copy(target).addScaledVector(normal, 10000);
  camera.up.fromArray(frame.v);
  camera.lookAt(target);
  camera.updateMatrixWorld();
  const caster = new THREE.Raycaster();
  caster.setFromCamera(new THREE.Vector2(0, 0), camera);
  for (const mode of ['copy', 'move']) {
    const workPlane = drawingWorkPlane({ mode }, frame);
    assert.equal(workPlane, frame);
    const snap = resolveSnap({
      pointer: [500, 500],
      camera,
      width: 1000,
      height: 1000,
      ray: caster.ray,
      start: [0, 0, 0],
      z: 0,
      sweeps: [],
      grid: { x: [], y: [] },
      axisSnap: false,
      polar: 0,
      workPlane,
    });
    assert.ok(target.distanceTo(new THREE.Vector3(...snap.point)) < 1e-8);
  }
  assert.equal(drawingWorkPlane({ mode: 'copy' }, null), null);
  assert.equal(drawingWorkPlane({ mode: 'workPlane' }, frame), null);
});
