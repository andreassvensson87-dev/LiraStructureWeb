import { test } from 'node:test';
import assert from 'node:assert/strict';
import { translatedShapes, DrawingShapeTransform } from '../src/drawing-shape-transform.js';
import { arcGeometry } from '../src/drawing-shapes.js';
import { DrawingAnnotations } from '../src/drawing-annotations.js';

const shapes = () => [
  {
    id: 'line',
    type: 'shape',
    shape: 'polyline',
    view: 'top',
    closed: true,
    points: [
      [0, 0],
      [20, 0],
      [20, 10],
    ],
  },
  {
    id: 'circle',
    type: 'shape',
    shape: 'circle',
    view: 'top',
    points: [
      [10, 10],
      [15, 10],
    ],
  },
  {
    id: 'arc',
    type: 'shape',
    shape: 'arc',
    view: 'top',
    points: [
      [0, 0],
      [10, 10],
      [20, 0],
    ],
  },
];
test('translation preserves geometry and metadata without mutating the original selection', () => {
  const items = shapes(),
    before = structuredClone(items);
  const result = translatedShapes(
    items,
    items.map((item) => item.id),
    [10, 20],
    [40, -5],
  );
  assert.deepEqual(items, before);
  assert.deepEqual(result[0].points, [
    [30, -25],
    [50, -25],
    [50, -15],
  ]);
  assert.equal(result[0].closed, true);
  assert.equal(result[0].id, 'line');
  assert.equal(Math.hypot(...result[1].points[1].map((v, i) => v - result[1].points[0][i])), 5);
  assert.equal(arcGeometry(result[2].points).radius, arcGeometry(items[2].points).radius);
});
test('copies have independent ids and geometry and reject mixed views, dimensions and zero moves', () => {
  const items = shapes();
  const copies = translatedShapes(items, ['line', 'circle'], [0, 0], [30, 0], true);
  assert.notEqual(copies[0].id, items[0].id);
  copies[0].points[0][0] = 1000;
  assert.equal(items[0].points[0][0], 0);
  assert.throws(() => translatedShapes(items, ['line'], [0, 0], [0, 0]));
  assert.throws(() => translatedShapes(items, ['line'], [0, 0], [NaN, 0]));
  items[1].view = 'front';
  assert.throws(() => translatedShapes(items, ['line', 'circle'], [0, 0], [10, 0]));
  items[0].type = 'dimension';
  assert.throws(() => translatedShapes(items, ['line'], [0, 0], [10, 0]));
});
test('two point move and copy commit a multi-selection once and support undo and redo', () => {
  for (const mode of ['move-shapes', 'copy-shapes']) {
    const editor = Object.create(DrawingAnnotations.prototype);
    const transform = Object.create(DrawingShapeTransform.prototype);
    let point = [0, 0];
    Object.assign(editor, {
      items: shapes(),
      history: [],
      future: [],
      record: {},
      mode,
      location: () => ({ point, view: 'top' }),
      ui() {},
      cancel() {
        this.mode = null;
      },
      adapter: { redraw() {} },
      surface: { focus() {} },
    });
    const before = structuredClone(editor.items);
    Object.assign(transform, {
      editor,
      ids: ['line', 'circle'],
      view: 'top',
      phase: 'select',
      ui() {},
    });
    transform.finishSelection();
    transform.down({});
    assert.equal(transform.phase, 'destination');
    assert.deepEqual(editor.items, before);
    point = [30, 40];
    transform.down({});
    assert.equal(editor.history.length, 1);
    assert.equal(editor.items.length, mode === 'copy-shapes' ? 5 : 3);
    assert.deepEqual(editor.items[mode === 'copy-shapes' ? 3 : 0].points[0], [30, 40]);
    assert.deepEqual(editor.items[2], before[2]);
    const after = structuredClone(editor.items);
    editor.undo();
    assert.deepEqual(editor.items, before);
    editor.undo(true);
    assert.deepEqual(editor.items, after);
  }
});
