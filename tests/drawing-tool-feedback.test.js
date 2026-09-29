import test from 'node:test';
import assert from 'node:assert/strict';
import { polarPoint } from '../src/drawing-tool-feedback.js';
import { snapDrawingLines } from '../src/drawing-grid-snap.js';
test('polar constrains near a chosen direction, including negative directions', () => {
  assert.deepEqual(polarPoint([100, 3], [0, 0], 45, 5), [100, 0]);
  const p = polarPoint([-100, 3], [0, 0], 45, 5);
  assert.ok(Math.abs(p[0] + 100) < 1e-8 && Math.abs(p[1]) < 1e-8);
  assert.equal(polarPoint([100, 30], [0, 0], 45, 5), null);
  assert.equal(polarPoint([100, 3], [0, 0], 0, 5), null);
});
test('polar supports custom angles and leaves base unchanged', () => {
  const base = [10, 20],
    p = polarPoint([110, 77], base, 30, 5);
  assert.ok(Math.abs((p[1] - 20) / (p[0] - 10) - Math.tan(Math.PI / 6)) < 1e-9);
  assert.deepEqual(base, [10, 20]);
});
test('reference snap prefers crossing and respects segment extents', () => {
  const lines = [
    [
      [0, 0],
      [100, 0],
    ],
    [
      [50, -100],
      [50, 100],
    ],
  ];
  assert.deepEqual(snapDrawingLines([53, 2], lines, 5), [50, 0]);
  assert.deepEqual(snapDrawingLines([20, 3], lines, 5), [20, 0]);
  assert.equal(snapDrawingLines([120, 3], lines, 5), null);
  assert.equal(snapDrawingLines([20, 20], lines, 5), null);
});
