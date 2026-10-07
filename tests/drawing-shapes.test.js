import { test } from 'node:test';
import assert from 'node:assert/strict';
import { arcGeometry, shapePath, validateShape, shapeSnapPoints } from '../src/drawing-shapes.js';
import { DrawingAnnotations } from '../src/drawing-annotations.js';

test('circle and rectangle retain view dimensions when projected to a scaled sheet', () => {
  const project = ([x, y]) => [10 + x / 20, 100 - y / 20];
  assert.equal(
    shapePath(
      'circle',
      [
        [0, 0],
        [100, 0],
      ],
      project,
    ),
    'M5,100a5,5 0 1 0 10,0a5,5 0 1 0 -10,0',
  );
  assert.equal(
    shapePath(
      'rectangle',
      [
        [0, 0],
        [200, 100],
      ],
      project,
    ),
    'M10,100L20,100L20,95L10,95Z',
  );
  assert.equal(
    shapeSnapPoints({
      shape: 'rectangle',
      points: [
        [0, 0],
        [200, 100],
      ],
    }).length,
    4,
  );
});

test('three-point arc follows the middle point, including major and mirrored arcs', () => {
  const points = [
    [1, 0],
    [-1, 0],
    [0, 1],
  ];
  const arc = arcGeometry(points);
  assert.ok(arc.center.every((v) => Math.abs(v) < 1e-10));
  assert.equal(arc.radius, 1);
  assert.ok(Math.abs(arc.sweep + 1.5 * Math.PI) < 1e-10);
  const path = shapePath('arc', points, ([x, y]) => [x, -y]);
  assert.match(path, /^M1,0L/);
  assert.ok(path.includes('-1'));
  assert.throws(
    () =>
      validateShape('arc', [
        [0, 0],
        [1, 0],
        [2, 0],
      ]),
    /samma linje/,
  );
  assert.throws(
    () =>
      validateShape('rectangle', [
        [0, 0],
        [0, 20],
      ]),
    /bredd/,
  );
});

function editor() {
  const a = Object.create(DrawingAnnotations.prototype);
  Object.assign(a, {
    items: [],
    history: [],
    future: [],
    contextMenu: { hidden: true },
    surface: { setAttribute() {}, focus() {} },
    adapter: { redraw() {} },
    ui() {},
  });
  a.record = { annotations: a.items };
  return a;
}
const event = {
  button: 0,
  target: { closest: () => null },
  preventDefault() {},
  stopImmediatePropagation() {},
};

test('shape creation repeats, is saved with its view and supports undo and redo', () => {
  const a = editor();
  a.start('circle', 'shape');
  let hit;
  a.location = () => hit;
  for (const point of [
    [0, 0],
    [100, 0],
  ]) {
    hit = { point, view: 'front' };
    a.down(event);
  }
  assert.equal(a.items.length, 1);
  assert.equal(a.items[0].type, 'shape');
  assert.equal(a.items[0].view, 'front');
  assert.equal(a.mode, 'circle');
  assert.equal(a.draft, null);
  a.undo();
  assert.equal(a.items.length, 0);
  a.undo(true);
  assert.equal(a.items.length, 1);
  assert.deepEqual(a.record.annotations, a.items);
});

test('a chain waits for Enter before placement, including two-point chains', () => {
  const a = editor();
  let hit;
  a.location = () => hit;
  a.start('horizontal');
  for (const point of [
    [0, 0],
    [100, 0],
    [250, 0],
  ]) {
    hit = { point, view: 'front' };
    a.down(event);
  }
  assert.equal(a.phase, 'points');
  assert.equal(a.items.length, 0);
  a.finishPoints();
  hit = { point: [0, 40], view: 'front' };
  a.down(event);
  assert.equal(a.items[0].points.length, 3);
  assert.deepEqual(a.items[0].line, [0, 40]);
});

test('closing a polyline stores a single closed object and invalid arcs allow retry', () => {
  const a = editor();
  let hit;
  a.location = () => hit;
  a.start('polyline', 'shape');
  for (const point of [
    [0, 0],
    [100, 0],
    [100, 100],
  ]) {
    hit = { point, view: 'front' };
    a.down(event);
  }
  a.finishShape(true);
  assert.equal(a.items[0].closed, true);
  a.start('arc', 'shape');
  for (const point of [
    [0, 0],
    [100, 0],
    [200, 0],
  ]) {
    hit = { point, view: 'front' };
    a.down(event);
  }
  assert.equal(a.items.length, 1);
  assert.equal(a.draft.points.length, 2);
  hit = { point: [100, 100], view: 'front' };
  a.down(event);
  assert.equal(a.items.length, 2);
});

test('line segments continue from the preceding endpoint until Enter finishes', () => {
  const a = editor();
  let hit;
  a.location = () => hit;
  a.start('line', 'shape');
  for (const point of [
    [0, 0],
    [100, 0],
    [100, 80],
  ]) {
    hit = { point, view: 'front' };
    a.down(event);
  }
  assert.equal(a.items.length, 2);
  assert.deepEqual(a.items[1].points, [
    [100, 0],
    [100, 80],
  ]);
  a.key({ ...event, key: 'Enter' });
  assert.equal(a.mode, null);
  assert.equal(a.items.length, 2);
});

test('geometry snaps to drawn corners in the same view and Shift constrains a new line', () => {
  const a = editor();
  a.items.push({
    type: 'shape',
    shape: 'rectangle',
    view: 'front',
    points: [
      [0, 0],
      [100, 80],
    ],
  });
  a.adapter = {
    ...a.adapter,
    locate: () => ({ view: 'front', point: [99, 1] }),
    project: (p) => p,
    pixelScale: () => 1,
    candidates: () => [],
  };
  assert.deepEqual(a.location(event).point, [100, 0]);
  a.start('line', 'shape');
  a.draft = { points: [[0, 0]] };
  a.adapter.locate = () => ({ view: 'front', point: [40, 18] });
  assert.deepEqual(a.location({ ...event, shiftKey: true }).point, [40, 0]);
  a.adapter.locate = () => ({ view: 'other', point: [99, 1] });
  assert.equal(a.location(event).snapped, undefined);
});
