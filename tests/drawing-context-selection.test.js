import test from 'node:test';
import assert from 'node:assert/strict';
import {
  drawingContextSelection,
  withoutDrawingSelection,
} from '../src/drawing-context-selection.js';
import { DrawingAnnotations } from '../src/drawing-annotations.js';

test('right click preserves mixed selection and only replaces it for an unselected target', () => {
  const selected = { annotationIds: ['dimension', 'text', 'line'], viewIds: ['front'] };
  assert.equal(
    drawingContextSelection(selected, { kind: 'annotation', id: 'dimension' }),
    selected,
  );
  assert.equal(drawingContextSelection(selected, { kind: 'view', id: 'front' }), selected);
  assert.equal(drawingContextSelection(selected, null), selected);
  assert.deepEqual(drawingContextSelection(selected, { kind: 'annotation', id: 'other' }), {
    annotationIds: ['other'],
    viewIds: [],
  });
  const scoped = { annotationIds: ['dimension'], viewIds: [] };
  assert.equal(drawingContextSelection(scoped, { kind: 'annotation', id: 'dimension' }), scoped);
});
test('mixed deletion includes dependent view contents once, preserves other views and is restorable', () => {
  const before = {
    views: [{ id: 'front' }, { id: 'section', source: { parentViewId: 'front' } }, { id: 'top' }],
    annotations: [
      { id: 'dim', view: 'front' },
      { id: 'text', view: 'section' },
      { id: 'line', view: 'paper' },
      { id: 'keep', view: 'top' },
    ],
    annotationIds: ['dim', 'line'],
    viewIds: ['front'],
  };
  const original = structuredClone(before);
  const after = withoutDrawingSelection(before);
  assert.deepEqual(
    after.views.map((v) => v.id),
    ['top'],
  );
  assert.deepEqual(
    after.annotations.map((a) => a.id),
    ['keep'],
  );
  assert.deepEqual(before, original);
  assert.throws(
    () => withoutDrawingSelection({ ...before, viewIds: ['front', 'top'] }),
    /Minst en vy/,
  );
});
test('dimension point removal shares inspector validation and preserves references with undo', () => {
  const editor = Object.create(DrawingAnnotations.prototype);
  Object.assign(editor, {
    items: [
      {
        id: 'd',
        type: 'dimension',
        points: [
          [0, 0],
          [5, 0],
          [10, 0],
        ],
        references: ['a', 'b', 'c'],
      },
    ],
    selected: 'd',
    history: [],
    future: [],
    ui() {},
    adapter: { redraw() {} },
  });
  editor.removeDimensionPoint(1);
  assert.deepEqual(editor.items[0].points, [
    [0, 0],
    [10, 0],
  ]);
  assert.deepEqual(editor.items[0].references, ['a', 'c']);
  assert.deepEqual(editor.history[0][0].references, ['a', 'b', 'c']);
  editor.removeDimensionPoint(0);
  assert.equal(editor.items[0].points.length, 2);
  assert.equal(editor.history.length, 1);
});

test('mixed context deletion uses a single drawing history entry and restores scope on undo', () => {
  const before = {
    views: [{ id: 'front' }, { id: 'top' }],
    annotations: [
      { id: 'd', view: 'front' },
      { id: 'p', view: 'paper' },
    ],
    viewIds: ['front'],
    annotationIds: ['d', 'p'],
    selectionScope: { viewIds: ['front'], annotationIds: ['d', 'p'], type: '' },
  };
  const after = withoutDrawingSelection(before);
  assert.deepEqual(after.selectionScope, { viewIds: [], annotationIds: [], type: '' });
  assert.deepEqual(before.selectionScope.annotationIds, ['d', 'p']);
});

test('context removal records one reversible operation and cancellation leaves history untouched', async () => {
  const { DrawingMarquee } = await import('../src/drawing-marquee.js');
  const state = {
    views: [{ id: 'front' }, { id: 'top' }],
    annotations: [
      { id: 'd', view: 'front' },
      { id: 'p', view: 'paper' },
    ],
    viewIds: ['front'],
    annotationIds: ['d', 'p'],
  };
  const marquee = Object.create(DrawingMarquee.prototype);
  let applied;
  marquee.editor = {
    history: [],
    future: ['redo'],
    ui(message) {
      assert.fail(message);
    },
  };
  marquee.snapshot = () => structuredClone(state);
  marquee.apply = (next) => {
    applied = next;
  };
  await marquee.removeSelection(async () => false);
  assert.equal(marquee.editor.history.length, 0);
  assert.deepEqual(marquee.editor.future, ['redo']);
  await marquee.removeSelection(async (count) => {
    assert.equal(count, 1);
    return true;
  });
  assert.deepEqual(
    applied.views.map((v) => v.id),
    ['top'],
  );
  assert.deepEqual(applied.annotations, []);
  assert.equal(marquee.editor.history.length, 1);
  const operation = marquee.editor.history[0];
  operation.apply(operation.before);
  assert.deepEqual(applied, state);
  operation.apply(operation.after);
  assert.equal(applied.views.length, 1);
  assert.deepEqual(marquee.editor.future, []);
});
