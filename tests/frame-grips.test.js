import test from 'node:test';
import assert from 'node:assert/strict';
import { frameGrips } from '../src/frame-grips.js';
import { transformFrameEntity } from '../src/frame-model.js';
test('text grips use true text anchor independently of alignment and rotation', () => {
  const e = { type: 'text', point: [40, 60], angle: 90, align: 'end' };
  assert.deepEqual(frameGrips(e), [[40, 60]]);
  assert.deepEqual(transformFrameEntity(e, frameGrips(e)[0], [10, 20]).point, [10, 20]);
});
test('polyline grips avoid duplicate closure and move all vertices together', () => {
  const e = {
    type: 'line',
    points: [
      [0, 0],
      [100, 0],
      [100, 50],
      [0, 0],
    ],
  };
  assert.equal(frameGrips(e).length, 3);
  const moved = transformFrameEntity(e, frameGrips(e)[1], [110, 20]);
  assert.deepEqual(moved.points, [
    [10, 20],
    [110, 20],
    [110, 70],
    [10, 20],
  ]);
  assert.deepEqual(e.points[0], [0, 0]);
});
test('anchored block grip resolves paper coordinates', () => {
  assert.deepEqual(
    frameGrips(
      { type: 'block', anchor: 'top-right', point: [-20, -30] },
      { width: 420, height: 297 },
    ),
    [[400, 267]],
  );
});

test('moving a line or polyline grip changes only its vertex', async () => {
  const { moveFrameVertex } = await import('../src/frame-grips.js');
  const line = {
    type: 'line',
    points: [
      [0, 0],
      [100, 0],
      [100, 50],
    ],
  };
  assert.deepEqual(moveFrameVertex(line, 1, [120, 10]).points, [
    [0, 0],
    [120, 10],
    [100, 50],
  ]);
  assert.deepEqual(line.points, [
    [0, 0],
    [100, 0],
    [100, 50],
  ]);
  const closed = {
    type: 'line',
    points: [
      [0, 0],
      [100, 0],
      [100, 50],
      [0, 0],
    ],
  };
  assert.deepEqual(moveFrameVertex(closed, 0, [10, 10]).points, [
    [10, 10],
    [100, 0],
    [100, 50],
    [10, 10],
  ]);
});

test('shared grip moves coincident vertices only in selected lines, including closure', async () => {
  const { coincidentFrameVertices, moveFrameVertices } = await import('../src/frame-grips.js');
  const entities = [
    {
      id: 'a',
      type: 'line',
      points: [
        [0, 0],
        [100, 0],
      ],
    },
    {
      id: 'b',
      type: 'line',
      points: [
        [0, 50],
        [0, 0],
        [60, 60],
        [0, 50],
      ],
    },
    {
      id: 'c',
      type: 'line',
      points: [
        [0, 0],
        [30, 20],
        [20, 30],
        [0, 0],
      ],
    },
    {
      id: 'unselected',
      type: 'line',
      points: [
        [0, 0],
        [10, 10],
      ],
    },
    {
      id: 'near',
      type: 'line',
      points: [
        [0.01, 0],
        [10, 10],
      ],
    },
    { id: 'text', type: 'text', point: [0, 0] },
  ];
  const matches = coincidentFrameVertices(
    entities,
    new Set(['a', 'b', 'c', 'near', 'text']),
    [0, 0],
  );
  assert.deepEqual(matches, { a: [0], b: [1], c: [0, 3] });
  const result = entities.map((e) => moveFrameVertices(e, matches, [5, 8]));
  assert.deepEqual(result[0].points, [
    [5, 8],
    [100, 0],
  ]);
  assert.deepEqual(result[1].points, [
    [0, 50],
    [5, 8],
    [60, 60],
    [0, 50],
  ]);
  assert.deepEqual(result[2].points, [
    [5, 8],
    [30, 20],
    [20, 30],
    [5, 8],
  ]);
  for (const i of [3, 4, 5]) assert.equal(result[i], entities[i]);
  assert.deepEqual(entities[0].points[0], [0, 0]);
});

test('editing grips include a whole-object center without duplicating closed endpoints', async () => {
  const { frameEditGrips } = await import('../src/frame-grips.js');
  const entity = {
    type: 'line',
    points: [
      [0, 0],
      [80, 0],
      [80, 40],
      [0, 0],
    ],
  };
  assert.deepEqual(frameEditGrips(entity), [
    { point: [0, 0], index: 0 },
    { point: [80, 0], index: 1 },
    { point: [80, 40], index: 2 },
    { point: [40, 20], index: -1 },
  ]);
  assert.deepEqual(transformFrameEntity(entity, [40, 20], [50, 25]).points, [
    [10, 5],
    [90, 5],
    [90, 45],
    [10, 5],
  ]);
  assert.deepEqual(frameEditGrips({ type: 'text', point: [7, 9] }), [{ point: [7, 9], index: 0 }]);
});

test('magnetic frame snapping acquires, holds and releases at pixel distances across zoom', async () => {
  const { magneticFrameSnap } = await import('../src/frame-grips.js');
  for (const pixelSize of [0.1, 1, 10]) {
    const options = { entities: [{ type: 'point', point: [0, 0] }], pixelSize, polar: 0 };
    const hit = magneticFrameSnap([13 * pixelSize, 0], options);
    assert.equal(hit.kind, 'Ändpunkt');
    assert.deepEqual(hit.point, [0, 0]);
    assert.deepEqual(magneticFrameSnap([17 * pixelSize, 0], options, hit).point, [0, 0]);
    const released = magneticFrameSnap([19 * pixelSize, 0], options, hit);
    assert.equal(released.kind, 'Fritt');
    assert.deepEqual(released.point, [19 * pixelSize, 0]);
    assert.equal(
      magneticFrameSnap([13 * pixelSize, 0], { ...options, endpoints: false }).kind,
      'Fritt',
    );
  }
});
