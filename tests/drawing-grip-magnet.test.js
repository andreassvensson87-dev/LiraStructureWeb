import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DrawingAnnotations } from '../src/drawing-annotations.js';
test('grip snapping captures at 14 pixels, holds through small motion, and releases at 18 pixels', () => {
  const editor = Object.create(DrawingAnnotations.prototype);
  let point = [12, 0];
  Object.assign(editor, {
    items: [],
    drag: { shapeBefore: {}, magnetPoint: null },
    adapter: {
      locate: () => ({ point: [...point], view: 'top' }),
      project: (p) => p,
      pixelScale: () => 1,
      candidates: () => [[0, 0]],
    },
  });
  assert.deepEqual(editor.location({}, 'top', true, 'dragged').point, [0, 0]);
  point = [16, 0];
  assert.deepEqual(editor.location({}, 'top', true, 'dragged').point, [0, 0]);
  point = [20, 0];
  assert.deepEqual(editor.location({}, 'top', true, 'dragged').point, [20, 0]);
  assert.equal(editor.drag.magnetPoint, null);
  point = [12, 0];
  assert.deepEqual(editor.location({}, 'top', true).point, [12, 0]);
});
