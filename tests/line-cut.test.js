import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { planeFrame } from '../src/plate.js';
import { validateLineCut } from '../src/line-cut.js';
import { createGeometryContext } from '../src/model-object.js';
const { objectGeometry, setModel: setGeometryModel, objectCorners } = createGeometryContext();
import { rotateSweep } from '../src/rotation.js';
const sweep = {
  id: 's',
  profile: 'rect',
  width: 200,
  height: 300,
  thickness: 12,
  rotation: 0,
  start: [0, 0, 0],
  end: [3000, 0, 0],
};
const cut = {
  id: 'l',
  type: 'linecut',
  targets: ['s'],
  frame: planeFrame('XY', [[1000, -1000, 0]]),
  polygon: [
    [0, 0],
    [0, 2000],
  ],
  side: 'positive',
};
function volume(s) {
  const g = objectGeometry(s),
    p = g.attributes.position;
  let sum = 0;
  for (let i = 0; i < p.count; i += 3) {
    const a = new THREE.Vector3().fromBufferAttribute(p, i),
      b = new THREE.Vector3().fromBufferAttribute(p, i + 1),
      c = new THREE.Vector3().fromBufferAttribute(p, i + 2);
    sum += a.dot(b.cross(c)) / 6;
  }
  g.dispose();
  return sum;
}
test('Linecut removes a half-space and can reverse side without changing the source', () => {
  const original = structuredClone(sweep);
  setGeometryModel([sweep, cut]);
  assert.ok(Math.abs(volume(sweep) - 60e6) < 100);
  assert.ok(objectCorners(sweep).some((p) => Math.abs(p[0] - 1000) < 0.01));
  setGeometryModel([sweep, { ...cut, side: 'negative' }]);
  assert.ok(Math.abs(volume(sweep) - 120e6) < 100);
  setGeometryModel([sweep]);
  assert.ok(Math.abs(volume(sweep) - 180e6) < 100);
  assert.deepEqual(sweep, original);
});
test('cut is infinite along line and normal to the workplane, including extended targets', () => {
  const s = { ...sweep, end: [100000, 0, 0] },
    c = {
      ...cut,
      polygon: [
        [0, 990],
        [0, 1010],
      ],
    };
  setGeometryModel([s, c]);
  assert.ok(Math.abs(volume(s) - 60e6) < 100);
});
test('inclined cut, multiple cuts and full removal', () => {
  const c = {
    ...cut,
    polygon: [
      [0, 0],
      [1000, 2000],
    ],
  };
  setGeometryModel([sweep, c]);
  assert.ok(Math.abs(volume(sweep) - 90e6) < 100);
  setGeometryModel([
    sweep,
    cut,
    { ...cut, id: 'l2', frame: planeFrame('XY', [[500, -1000, 0]]), side: 'negative' },
  ]);
  assert.ok(Math.abs(volume(sweep) - 30e6) < 100);
  setGeometryModel([sweep, { ...cut, frame: planeFrame('XY', [[-1000, -1000, 0]]) }]);
  assert.equal(volume(sweep), 0);
});
test('rotating source and cut preserves subtraction, invalid points are rejected', () => {
  const s = rotateSweep(sweep, [0, 0, 0], [1, 2, 3], 35),
    c = rotateSweep(cut, [0, 0, 0], [1, 2, 3], 35);
  setGeometryModel([s, c]);
  assert.ok(Math.abs(volume(s) - 60e6) < 1000);
  assert.equal(validateLineCut(c), '');
  assert.ok(
    validateLineCut({
      ...cut,
      polygon: [
        [0, 0],
        [0, 0],
      ],
    }),
  );
});
