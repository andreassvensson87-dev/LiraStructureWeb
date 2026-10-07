import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DrawingAnnotations } from '../src/drawing-annotations.js';
const setup = () => {
  const editor = Object.create(DrawingAnnotations.prototype);
  const original = {
    id: 'shape',
    type: 'shape',
    shape: 'line',
    points: [
      [0, 0],
      [10, 0],
    ],
  };
  const item = {
    ...structuredClone(original),
    points: [
      [0, 0],
      [20, 20],
    ],
  };
  Object.assign(editor, {
    items: [item],
    history: [],
    future: [],
    surface: { classList: { remove() {} }, hasPointerCapture: () => false },
    adapter: { redraw() {} },
    ui() {},
    drag: {
      pointerId: 1,
      item,
      moved: true,
      shapeBefore: original,
      points: original.points,
      before: [structuredClone(original)],
    },
  });
  return editor;
};
const event = (target, buttons = 0, pointerId = 1) => ({
  target,
  buttons,
  pointerId,
  preventDefault() {},
  stopImmediatePropagation() {},
});
test('normal release capture loss commits the changed shape rather than restoring it', () => {
  const editor = setup();
  editor.lostCapture(event(editor.surface));
  assert.deepEqual(editor.items[0].points, [
    [0, 0],
    [20, 20],
  ]);
  assert.equal(editor.history.length, 1);
  editor.up(event(editor.surface));
  assert.equal(editor.history.length, 1);
});
test('capture events from replaced child grips and unrelated pointers do not cancel a drag', () => {
  const editor = setup();
  editor.lostCapture(event({}, 1));
  editor.lostCapture(event(editor.surface, 1, 2));
  editor.up(event(editor.surface, 0, 2));
  assert.ok(editor.drag);
  editor.up(event(editor.surface));
  assert.deepEqual(editor.items[0].points, [
    [0, 0],
    [20, 20],
  ]);
  assert.equal(editor.history.length, 1);
});
test('actual interrupted capture still restores the original shape', () => {
  const editor = setup();
  editor.lostCapture(event(editor.surface, 1));
  assert.deepEqual(editor.items[0].points, [
    [0, 0],
    [10, 0],
  ]);
  assert.equal(editor.history.length, 0);
});
