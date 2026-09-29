import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { sweepFrame, sweepGeometry } from '../src/sweep.js';
import { partMatrix } from '../src/part-marks.js';
import { partViewFrame, partDrawingReflection } from '../src/part-view-frame.js';
import { frameMatrix } from '../src/drawing-sections.js';

const beam = {
  type: 'sweep',
  profile: 'custom',
  section: {
    anchor: [0, 0],
    properties: { bounds: { minX: 0, maxX: 80, minY: 0, maxY: 140 } },
    loops: [
      [
        [0, 0],
        [80, 0],
        [80, 20],
        [20, 20],
        [20, 140],
        [0, 140],
      ],
    ],
  },
  width: 80,
  height: 140,
  thickness: 20,
  start: [0, 0, 0],
  end: [1000, 0, 0],
  rotation: 0,
};
const close = (a, b, tolerance = 0.001) => {
  assert.equal(a.length, b.length);
  a.forEach((v, i) => assert.ok(Math.abs(v - b[i]) < tolerance, `${v} != ${b[i]}`));
};
const drawingMatrix = (source) => {
  const local = partMatrix(source);
  return (partDrawingReflection(local) || new THREE.Matrix4()).multiply(local);
};

test('asymmetric profile has identical drawing geometry regardless of model placement and roll', () => {
  const base = sweepGeometry(beam).applyMatrix4(drawingMatrix(beam));
  for (const config of [
    { rotation: 90 },
    { rotation: 180 },
    { rotation: 270 },
    { start: [300, 100, -200], end: [300, 700, 600], rotation: 37, profileUp: [1, 0, 0] },
    { end: [0, 0, 1000], rotation: 180 },
  ]) {
    const source = { ...beam, ...config };
    const geometry = sweepGeometry(source).applyMatrix4(drawingMatrix(source));
    close([...geometry.attributes.position.array], [...base.attributes.position.array]);
    geometry.dispose();
  }
  base.dispose();
});

test('Top looks from positive profile height even when that side faces down in the model', () => {
  const source = { ...beam, rotation: 180 };
  const f = sweepFrame(source);
  assert.ok(f.y.z < -0.999);
  const topPoint = f.start.clone().addScaledVector(f.axis, 500).addScaledVector(f.y, 140);
  const bottomPoint = f.start.clone().addScaledVector(f.axis, 500);
  const matrix = frameMatrix(partViewFrame('top')).multiply(drawingMatrix(source));
  assert.ok(topPoint.applyMatrix4(matrix).z > bottomPoint.applyMatrix4(matrix).z);
  const front = frameMatrix(partViewFrame('front')).multiply(drawingMatrix(source));
  close(f.y.clone().transformDirection(front).toArray(), [0, 1, 0]);
});

test('drawing projection preserves handedness and a top-view diagonal is not mirrored', () => {
  const matrix = drawingMatrix(beam);
  assert.ok(Math.abs(matrix.determinant() - 1) < 1e-8);
  // This beam runs along world X, with profile top along world Z.
  // A real camera above it must preserve positive world Y as screen up.
  close(new THREE.Vector3(100, 50, 150).applyMatrix4(matrix).toArray(), [100, 50, 150]);
  close(new THREE.Vector3(200, -50, 150).applyMatrix4(matrix).toArray(), [200, -50, 150]);
  assert.equal(partDrawingReflection(new THREE.Matrix4()), null);
});
