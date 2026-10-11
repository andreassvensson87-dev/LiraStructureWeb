import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shapeGrips, shapeWithGrip } from '../src/drawing-shape-grips.js';
test('rectangle exposes all corners and moving each corner keeps its opposite fixed', () => {
  const item = {
    type: 'shape',
    shape: 'rectangle',
    points: [
      [0, 0],
      [20, 10],
    ],
  };
  const grips = shapeGrips(item);
  assert.equal(grips.length, 5);
  assert.deepEqual(shapeWithGrip(item, grips[1], [30, -5]).points, [
    [0, -5],
    [30, 10],
  ]);
  assert.deepEqual(shapeWithGrip(item, grips[3], [-5, 15]).points, [
    [-5, 0],
    [20, 15],
  ]);
  assert.deepEqual(shapeWithGrip(item, grips[4], [20, 15]).points, [
    [10, 10],
    [30, 20],
  ]);
  assert.deepEqual(item.points, [
    [0, 0],
    [20, 10],
  ]);
});
test('circle has a center and four radius grips; center move retains radius', () => {
  const circle = {
      type: 'shape',
      shape: 'circle',
      points: [
        [10, 10],
        [15, 10],
      ],
    },
    grips = shapeGrips(circle);
  assert.equal(grips.length, 5);
  assert.deepEqual(shapeWithGrip(circle, grips[0], [30, 40]).points, [
    [30, 40],
    [35, 40],
  ]);
  assert.deepEqual(shapeWithGrip(circle, grips[2], [10, 30]).points, [
    [10, 10],
    [10, 30],
  ]);
  assert.throws(() => shapeWithGrip(circle, grips[1], [10, 10]));
});
