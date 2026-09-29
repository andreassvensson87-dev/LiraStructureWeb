import test from 'node:test';
import assert from 'node:assert/strict';
import { snapDrawingGrid } from '../src/drawing-grid-snap.js';
const grid = { x: [0, 3000, 6000], y: [0, 4000, 8000] };
test('snaps both coordinates near an intersection', () =>
  assert.deepEqual(snapDrawingGrid([2980, 4020], grid, 30), [3000, 4000]));
test('snaps along one line and preserves the free coordinate', () =>
  assert.deepEqual(snapDrawingGrid([2980, 2500], grid, 30), [3000, 2500]));
test('leaves remote points and positions beyond the drawn extents free', () => {
  assert.equal(snapDrawingGrid([1500, 2500], grid, 30), null);
  assert.equal(snapDrawingGrid([0, 10000], grid, 30), null);
});
