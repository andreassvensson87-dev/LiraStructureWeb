import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { vectorDrawing, geometryVectors } from '../src/drawing-vector.js';
const geometry = (points) =>
  new THREE.BufferGeometry().setFromPoints(points.map((p) => new THREE.Vector3(...p)));
const cover = () =>
  geometry([
    [0, -1, 1],
    [2, -1, 1],
    [2, 1, 1],
    [0, -1, 1],
    [2, 1, 1],
    [0, 1, 1],
  ]);
test('partly occluded edge splits into visible and hidden vector intervals', () => {
  const surface = cover(),
    edge = geometry([
      [-1, 0, 0],
      [3, 0, 0],
    ]);
  const [result] = vectorDrawing([{ geometry: surface }], [{ geometry: edge }]);
  assert.deepEqual(result.visible, [
    [
      [-1, 0, 0],
      [0, 0, 0],
    ],
    [
      [2, 0, 0],
      [3, 0, 0],
    ],
  ]);
  assert.deepEqual(result.hidden, [
    [
      [0, 0, 0],
      [2, 0, 0],
    ],
  ]);
  surface.dispose();
  edge.dispose();
});
test('coplanar edges stay visible, while lower edges are hidden', () => {
  const surface = cover(),
    edge = geometry([
      [0.2, 0, 1],
      [1.8, 0, 1],
      [0.2, 0, 0],
      [1.8, 0, 0],
    ]);
  const [result] = vectorDrawing([{ geometry: surface }], [{ geometry: edge }]);
  assert.equal(result.visible.length, 1);
  assert.equal(result.hidden.length, 1);
  surface.dispose();
  edge.dispose();
});
test('section planes clip both occluders and edges', () => {
  const surface = cover(),
    edge = geometry([
      [-1, 0, 0],
      [3, 0, 0],
    ]);
  const planes = [new THREE.Plane(new THREE.Vector3(-1, 0, 0), 1)];
  const [result] = vectorDrawing([{ geometry: surface, planes }], [{ geometry: edge, planes }]);
  assert.deepEqual(result.hidden, [
    [
      [0, 0, 0],
      [1, 0, 0],
    ],
  ]);
  assert.deepEqual(result.visible, [
    [
      [-1, 0, 0],
      [0, 0, 0],
    ],
  ]);
  surface.dispose();
  edge.dispose();
});
test('sloping edge splits where it crosses the occluding depth', () => {
  const surface = cover(),
    edge = geometry([
      [0.2, 0, 0],
      [1.8, 0, 2],
    ]);
  const [result] = vectorDrawing([{ geometry: surface }], [{ geometry: edge }]);
  assert.equal(result.visible.length, 1);
  assert.equal(result.hidden.length, 1);
  assert.ok(Math.abs(result.hidden[0][1][0] - 1) < 0.002);
  surface.dispose();
  edge.dispose();
});
test('overlay lines are not hidden and indexed box geometry is supported', () => {
  const surface = new THREE.BoxGeometry(2, 2, 2),
    edge = geometry([
      [-2, 0, -2],
      [2, 0, -2],
    ]);
  const [result] = vectorDrawing(
    [{ geometry: surface }],
    [{ geometry: edge, overlay: true, dashed: true }],
  );
  assert.equal(result.hidden.length, 0);
  assert.equal(result.visible.length, 1);
  assert.equal(result.dashed, true);
  const [box] = geometryVectors(surface);
  assert.equal(box.visible.length, 4);
  assert.equal(box.hidden.length, 4);
  surface.dispose();
  edge.dispose();
});
