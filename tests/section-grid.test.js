import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sectionGridLines } from '../src/section-grid.js';
const grid = { x: [0, 3000, 6000], y: [0, 4000, 8000] };
test('vertical section shows crossing grid planes with original labels', () => {
  const frame = { origin: [1000, 0, 0], x: [1, 0, 0], y: [0, 0, 1] };
  const lines = sectionGridLines(grid, frame, [-500, -100, 6000, 4000]);
  assert.deepEqual(
    lines.map((l) => l.label),
    ['2', '3'],
  );
  assert.deepEqual(lines[0].points, [
    [2000, -100],
    [2000, 4000],
  ]);
});
test('reversing section direction mirrors positions without changing labels', () => {
  const lines = sectionGridLines(
    grid,
    { origin: [6000, 0, 0], x: [-1, 0, 0], y: [0, 0, 1] },
    [-1, 0, 6001, 200],
  );
  assert.deepEqual(
    lines.map((l) => l.points[0][0] + 0),
    [6000, 3000, 0],
  );
  assert.deepEqual(
    lines.map((l) => l.label),
    ['1', '2', '3'],
  );
});
test('oblique section includes both grid families and combines coincident lines', () => {
  const r = Math.SQRT1_2,
    lines = sectionGridLines(
      grid,
      { origin: [0, 0, 0], x: [r, r, 0], y: [0, 0, 1] },
      [-10, 0, 12000, 200],
    );
  assert.equal(lines[0].label, '1 / A');
  assert.ok(lines.some((l) => l.label === 'B'));
  assert.ok(lines.some((l) => l.label === '2'));
});
test('general section frame clips sloped grid lines and omits parallel planes', () => {
  const lines = sectionGridLines(
    { x: [0], y: [] },
    { origin: [0, 0, 0], x: [1, 0, 0], y: [1, 0, 1] },
    [-10, -10, 10, 10],
  );
  assert.deepEqual(lines[0].points, [
    [-10, 10],
    [10, -10],
  ]);
  assert.deepEqual(
    sectionGridLines(
      { x: [0], y: [] },
      { origin: [0, 0, 0], x: [0, 1, 0], y: [0, 0, 1] },
      [-10, -10, 10, 10],
    ),
    [],
  );
});

test('level lines use absolute project elevations relative to the section origin', async () => {
  const { sectionLevelLines } = await import('../src/section-grid.js');
  const levels = [
      { id: 'base', name: 'Grund', elevation: -500 },
      { id: 'floor', name: 'Plan 1', elevation: 3000 },
      { id: 'roof', name: 'Tak', elevation: 6000 },
    ],
    frame = { origin: [0, 0, 1200], x: [1, 0, 0], y: [0, 0, 1] };
  const lines = sectionLevelLines(levels, frame, [-100, -2000, 4000, 2000]);
  assert.deepEqual(
    lines.map((l) => l.elevation),
    [-500, 3000],
  );
  assert.deepEqual(lines[0].points, [
    [-100, -1700],
    [4000, -1700],
  ]);
  assert.equal(lines[1].name, 'Plan 1');
});
test('level lines also work for tilted section planes and omit parallel views', async () => {
  const { sectionLevelLines } = await import('../src/section-grid.js');
  const levels = [{ id: 'zero', name: 'Noll', elevation: 0 }];
  assert.deepEqual(
    sectionLevelLines(
      levels,
      { origin: [0, 0, 0], x: [1, 0, 1], y: [0, 1, 1] },
      [-10, -10, 10, 10],
    )[0].points,
    [
      [-10, 10],
      [10, -10],
    ],
  );
  assert.deepEqual(
    sectionLevelLines(
      levels,
      { origin: [0, 0, 0], x: [1, 0, 0], y: [0, 1, 0] },
      [-10, -10, 10, 10],
    ),
    [],
  );
});
