import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rectangleSelection } from '../src/frame-selection.js';
const line = (id, points) => ({ id, points });
test('window requires every vertex; crossing includes segments with both ends outside', () => {
  const shapes = [
    line('inside', [
      [2, 2],
      [8, 8],
    ]),
    line('through', [
      [-5, 5],
      [15, 5],
    ]),
    line('outside', [
      [11, 0],
      [11, 10],
    ]),
  ];
  assert.deepEqual(rectangleSelection(shapes, [0, 0], [10, 10]), ['inside']);
  assert.deepEqual(rectangleSelection(shapes, [10, 10], [0, 0]), ['inside', 'through']);
});
test('crossing avoids polyline bounding box false positives', () => {
  assert.deepEqual(
    rectangleSelection(
      [
        line('L', [
          [0, 0],
          [0, 20],
          [20, 20],
        ]),
      ],
      [12, 8],
      [8, 12],
    ),
    [],
  );
});
test('window encloses every part of a block; crossing needs only one', () => {
  const parts = [
    line('block', [
      [2, 2],
      [8, 8],
    ]),
    line('block', [
      [20, 20],
      [30, 30],
    ]),
  ];
  assert.deepEqual(rectangleSelection(parts, [0, 0], [10, 10]), []);
  assert.deepEqual(rectangleSelection(parts, [10, 10], [0, 0]), ['block']);
});
test('closed text/image bounds include a rectangle entirely inside and respect rotation', () => {
  const shape = {
    id: 'image',
    closed: true,
    points: [
      [0, 10],
      [10, 0],
      [20, 10],
      [10, 20],
    ],
  };
  assert.deepEqual(rectangleSelection([shape], [12, 8], [8, 12]), ['image']);
  assert.deepEqual(rectangleSelection([shape], [2, 0], [0, 2]), []);
  assert.deepEqual(rectangleSelection([shape], [0, 0], [20, 20]), ['image']);
});
