import test from 'node:test';
import assert from 'node:assert/strict';
import { dimensionAxis, chainGeometry, insertDimensionPoint } from '../src/dimension-chain.js';
test('horizontal chain sorts picks and measures projected distances', () => {
  const g = chainGeometry({
    kind: 'horizontal',
    points: [
      [300, 20],
      [0, 40],
      [100, 10],
    ],
    line: [15, 200],
  });
  assert.deepEqual(
    g.segments.map((s) => s.length),
    [100, 200],
  );
  assert.deepEqual(
    g.points.map((p) => p.end),
    [
      [0, 200],
      [100, 200],
      [300, 200],
    ],
  );
});
test('vertical chain ignores horizontal offsets', () => {
  const g = chainGeometry({
    kind: 'vertical',
    points: [
      [90, 200],
      [0, -100],
      [50, 0],
    ],
    line: [400, 50],
  });
  assert.deepEqual(
    g.segments.map((s) => s.length),
    [100, 200],
  );
  assert.ok(g.points.every((p) => p.end[0] === 400));
});
test('free chain retains initial direction when adding or removing points', () => {
  const item = {
    kind: 'free',
    points: [
      [0, 0],
      [300, 400],
    ],
    line: [0, 100],
  };
  item.axis = dimensionAxis(item.kind, item.points);
  assert.equal(chainGeometry(item).segments[0].length, 500);
  assert.equal(insertDimensionPoint(item, [150, 200]), true);
  assert.equal(insertDimensionPoint(item, [150, 200]), false);
  assert.deepEqual(
    chainGeometry(item).segments.map((s) => s.length),
    [250, 250],
  );
  item.points.splice(0, 1);
  assert.equal(chainGeometry(item).segments[0].length, 250);
  assert.deepEqual(item.axis, [0.6, 0.8]);
});
test('duplicates at same projected station are omitted and zero free axes rejected', () => {
  assert.equal(
    chainGeometry({
      kind: 'horizontal',
      points: [
        [0, 0],
        [0, 20],
        [50, 0],
      ],
      line: [0, 30],
    }).segments.length,
    1,
  );
  assert.throws(() =>
    dimensionAxis('free', [
      [0, 0],
      [0, 0],
    ]),
  );
});
test('moving an anchor updates values without moving the dimension line', async () => {
  const { moveDimensionPoint } = await import('../src/dimension-chain.js');
  const item = {
    kind: 'horizontal',
    axis: [1, 0],
    points: [
      [0, 0],
      [100, 0],
      [300, 0],
    ],
    line: [0, 90],
  };
  assert.equal(moveDimensionPoint(item, 1, [150, 40]), true);
  assert.deepEqual(
    chainGeometry(item).segments.map((s) => s.length),
    [150, 150],
  );
  assert.deepEqual(item.line, [0, 90]);
  assert.equal(moveDimensionPoint(item, 1, [300, 20]), false);
  assert.deepEqual(item.points[1], [150, 40]);
});

test('hole dimensions use stable bore references from the same part and omit repeated stations', async () => {
  const { holeDimensionPoints } = await import('../src/dimension-chain.js');
  const point = (x, y, source, featureId) =>
    Object.assign([x, y], { reference: { kind: 'bore', source, featureId } });
  const candidates = [
    point(100, 20, 'part', 'b'),
    point(0, 20, 'part', 'a'),
    point(100, 50, 'part', 'c'),
    point(500, 20, 'other', 'd'),
  ];
  const result = holeDimensionPoints(candidates, candidates[0].reference, 'horizontal');
  assert.deepEqual(
    result.map((p) => [...p]),
    [
      [0, 20],
      [100, 20],
    ],
  );
  assert.equal(result[0].reference.featureId, 'a');
  assert.deepEqual(holeDimensionPoints(candidates, null, 'horizontal'), []);
});
test('paper offsets honour projection scale and decimal choices format real model distances', async () => {
  const { dimensionPaperOffset, setDimensionPaperOffset, formatDimension } = await import(
    '../src/dimension-chain.js'
  );
  const item = {
    kind: 'horizontal',
    points: [
      [0, 0],
      [1000, 0],
    ],
    line: [0, 200],
  };
  const project = (p) => p.map((v) => v * 0.08);
  assert.equal(dimensionPaperOffset(item, project, 4).value, 4);
  assert.deepEqual(setDimensionPaperOffset(item, 10, project, 4), [0, 500]);
  assert.deepEqual(setDimensionPaperOffset(item, -10, project, 4), [0, -500]);
  assert.equal(formatDimension(123.456, 2), '123,46');
  assert.equal(formatDimension(123, 2), '123,00');
  assert.equal(formatDimension(123.456, 0), '123');
  assert.throws(() => formatDimension(1, 5));
  assert.throws(() => setDimensionPaperOffset(item, NaN, project, 4));
});
