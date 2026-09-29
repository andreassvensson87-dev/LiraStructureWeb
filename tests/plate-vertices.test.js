import test from 'node:test';
import assert from 'node:assert/strict';
import { editPlateVertex } from '../src/plate-vertices.js';
import { plateArea } from '../src/plate.js';
const s = {
  type: 'plate',
  polygon: [
    [0, 0],
    [2000, 0],
    [2000, 3000],
    [0, 3000],
  ],
  frame: { origin: [0, 0, 0], u: [1, 0, 0], v: [0, 1, 0] },
  thickness: 200,
  side: 'center',
  contourOffset: 50,
};
test('midpoint follows reference edge and preserves offset and area', () => {
  const next = editPlateVertex(s, 0);
  assert.deepEqual(next.polygon[1], [1000, 0]);
  assert.equal(next.contourOffset, 50);
  assert.equal(plateArea(next), plateArea(s));
  assert.deepEqual(editPlateVertex(next, 1, true), s);
  assert.equal(s.polygon.length, 4);
});
test('closing edge and minimum vertex count', () => {
  assert.deepEqual(editPlateVertex(s, 3).polygon[4], [0, 1500]);
  const triangle = editPlateVertex(s, 0, true);
  assert.equal(triangle.polygon.length, 3);
  assert.throws(() => editPlateVertex(triangle, 0, true));
  assert.throws(() => editPlateVertex(s, 10));
});
