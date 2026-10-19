import test from 'node:test';
import assert from 'node:assert/strict';
import { insertDrawingVertex, removeDrawingVertex } from '../src/drawing-vertex-editing.js';

test('vertex insertion uses the nearest edge including the closing edge and leaves the source intact', () => {
  const item = {
    shape: 'polygon',
    points: [
      [0, 0],
      [10, 0],
      [10, 10],
    ],
    hatch: { pattern: 'solid' },
  };
  const next = insertDrawingVertex(item, [4, 5]);
  assert.deepEqual(next.points, [
    [0, 0],
    [10, 0],
    [10, 10],
    [4.5, 4.5],
  ]);
  assert.equal(item.points.length, 3);
  assert.deepEqual(next.hatch, item.hatch);
  assert.deepEqual(removeDrawingVertex(next, 3), item);
  assert.throws(() => removeDrawingVertex(item, 1), /minst 3/);
});
test('open polylines exclude the closing edge and reject duplicate or invalid vertices', () => {
  const item = {
    shape: 'polyline',
    points: [
      [0, 0],
      [10, 0],
      [10, 10],
    ],
  };
  assert.deepEqual(insertDrawingVertex(item, [4, 5]).points, [
    [0, 0],
    [4, 0],
    [10, 0],
    [10, 10],
  ]);
  assert.throws(() => insertDrawingVertex(item, [0, 0]), /mellan/);
  assert.throws(() => removeDrawingVertex(item, 9), /hörn/);
});
