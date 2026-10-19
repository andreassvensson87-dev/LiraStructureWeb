import test from 'node:test';
import assert from 'node:assert/strict';
import { viewsInRectangle } from '../src/drawing-views.js';
import { translateDrawingSelection } from '../src/drawing-mixed-transform.js';
import { DrawingAnnotations } from '../src/drawing-annotations.js';

const view = (id, scale, position = [0, 0]) => ({
  id,
  name: id,
  scale,
  position,
  size: [100, 80],
  camera: { center: [0, 0] },
});
const line = (id, owner) => ({
  id,
  type: 'shape',
  shape: 'line',
  view: owner,
  points: [
    [0, 0],
    [10, 10],
  ],
});

test('crossing windows inside a view do not select it; border crossings and full windows do', () => {
  const views = [view('a', 10)];
  assert.deepEqual(viewsInRectangle(views, [60, 20], [20, 40]), []);
  assert.deepEqual(viewsInRectangle(views, [110, 20], [90, 40]), ['a']);
  assert.deepEqual(viewsInRectangle(views, [-1, -1], [101, 81]), ['a']);
  assert.deepEqual(viewsInRectangle(views, [10, 10], [90, 70]), []);
});

test('mixed move travels once with its view, while independent objects use their own scale and paper axes', () => {
  const views = [view('a', 10), view('b', 20)],
    items = [line('attached', 'a'), line('other', 'b'), line('paper', 'paper')];
  const before = structuredClone({ views, items });
  const moved = translateDrawingSelection(
    views,
    items,
    ['a'],
    items.map((a) => a.id),
    [5, 3],
  );
  assert.deepEqual(moved.views[0].position, [5, 3]);
  assert.deepEqual(moved.annotations[0].points, items[0].points);
  assert.deepEqual(moved.annotations[1].points[0], [100, -60]);
  assert.deepEqual(moved.annotations[2].points[0], [5, 3]);
  assert.deepEqual({ views, items }, before);
  const states = [];
  const editor = Object.assign(Object.create(DrawingAnnotations.prototype), {
    history: [],
    future: [],
    ui() {},
    adapter: { redraw() {} },
  });
  editor.recordOperation(before, moved, (value) => states.push(value));
  editor.undo();
  editor.undo(true);
  assert.deepEqual(states, [before, moved]);
});

test('mixed copies duplicate view contents once with new identities and remap copied dependent views', () => {
  const views = [
    view('a', 10),
    { ...view('detail', 5), source: { parentViewId: 'a' } },
    view('b', 20),
  ];
  const items = [
    line('attached', 'a'),
    line('unselected attached', 'a'),
    line('detail line', 'detail'),
    line('other', 'b'),
  ];
  const copied = translateDrawingSelection(
    views,
    items,
    ['a', 'detail'],
    ['attached', 'other'],
    [5, -3],
    true,
  );
  assert.equal(copied.views.length, 5);
  assert.equal(copied.annotations.length, 8);
  const owner = copied.views[3],
    detail = copied.views[4];
  assert.deepEqual(owner.position, [5, -3]);
  assert.equal(detail.source.parentViewId, owner.id);
  assert.equal(copied.annotations.filter((a) => a.view === owner.id).length, 2);
  assert.deepEqual(copied.annotations.find((a) => a.view === owner.id).points, items[0].points);
  assert.deepEqual(copied.annotations.at(-1).points[0], [100, 60]);
  assert.equal(new Set(copied.annotations.map((a) => a.id)).size, 8);
});

test('dimensions retain anchors when carried by a view; independent dimensions and text translate in paper millimeters', () => {
  const views = [view('a', 10), view('b', 25)];
  const dimension = {
    id: 'dim',
    type: 'dimension',
    view: 'a',
    kind: 'horizontal',
    points: [
      [0, 0],
      [100, 0],
    ],
    line: [0, 20],
    references: [{ source: 'model' }, null],
  };
  const items = [
    dimension,
    { ...structuredClone(dimension), id: 'independent', view: 'b' },
    {
      id: 'text',
      type: 'richtext',
      view: 'paper',
      points: [[20, 30]],
      width: 40,
      rotation: 15,
      paragraphs: [{ runs: [{ text: 'Kontroll' }] }],
    },
  ];
  const result = translateDrawingSelection(
    views,
    items,
    ['a'],
    items.map((a) => a.id),
    [4, -2],
  );
  assert.deepEqual(result.annotations[0], dimension);
  assert.deepEqual(result.annotations[1].points, [
    [100, 50],
    [200, 50],
  ]);
  assert.deepEqual(result.annotations[1].line, [100, 70]);
  assert.deepEqual(result.annotations[1].references, [null, null]);
  assert.deepEqual(result.annotations[2].points, [[24, 28]]);
  assert.equal(result.annotations[2].rotation, 15);
  assert.deepEqual(result.annotations[2].paragraphs, items[2].paragraphs);
});
