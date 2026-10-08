import test from 'node:test';
import assert from 'node:assert/strict';
import {
  changeGridLine,
  addGridLine,
  removeGridLine,
  gridSegmentDistance,
} from '../src/grid-edit.js';
import { validateGridLabels } from '../src/grid-labels.js';
const grid = {
  x: [0, 3000, 6000],
  y: [0, 4000, 8000],
  labels: { x: ['1', '2', '3'], y: ['A', 'B', 'C'] },
};

test('moving a line across another line keeps its label and returns its sorted selection', () => {
  const before = structuredClone(grid);
  const result = changeGridLine(grid, 'y', 1, { position: 9000 });
  assert.deepEqual(result.grid.y, [0, 8000, 9000]);
  assert.deepEqual(result.grid.labels.y, ['A', 'C', 'B']);
  assert.equal(result.index, 2);
  assert.deepEqual(grid, before);
  assert.deepEqual(result.grid.x, grid.x);
});
test('a new line receives a free label without renumbering existing lines', () => {
  const result = addGridLine(grid, 'x', 1500);
  assert.deepEqual(result.grid.x, [0, 1500, 3000, 6000]);
  assert.deepEqual(result.grid.labels.x, ['1', '4', '2', '3']);
  assert.equal(result.index, 1);
  validateGridLabels(result.grid);
});
test('legacy grids receive labels before moving so labels follow their original lines', () => {
  const result = changeGridLine({ x: grid.x, y: grid.y }, 'x', 0, {
    position: 7000,
    label: 'Start',
  });
  assert.deepEqual(result.grid.labels.x, ['2', '3', 'Start']);
  assert.deepEqual(result.grid.labels.y, ['A', 'B', 'C']);
});
test('deleting a line preserves other labels and enforces the existing two-line minimum', () => {
  const result = removeGridLine(grid, 'y', 1);
  assert.deepEqual(result.grid.labels.y, ['A', 'C']);
  assert.equal(result.index, -1);
  assert.throws(() => removeGridLine(result.grid, 'y', 0), /minst två/);
});
test('grid edits reject duplicate coordinates, invalid labels and out-of-range positions', () => {
  assert.throws(() => changeGridLine(grid, 'x', 0, { position: 3000 }));
  assert.throws(() => addGridLine(grid, 'y', 4000));
  assert.throws(() => changeGridLine(grid, 'x', 0, { position: 1000001 }));
  assert.throws(() => changeGridLine(grid, 'x', 0, { label: ' ' }));
  assert.throws(() => changeGridLine(grid, 'x', 0, { label: 'A'.repeat(41) }));
  const full = { x: Array.from({ length: 20 }, (_, i) => i * 100), y: [0, 100] };
  assert.throws(() => addGridLine(full, 'x', 2050));
});
test('line picking measures finite segments rather than their infinite extensions', () => {
  assert.equal(gridSegmentDistance([50, 8], [0, 0], [100, 0]), 8);
  assert.equal(gridSegmentDistance([110, 0], [0, 0], [100, 0]), 10);
  assert.equal(gridSegmentDistance([3, 4], [0, 0], [0, 0]), 5);
});
