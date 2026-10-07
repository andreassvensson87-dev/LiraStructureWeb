import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DrawingAnnotations } from '../src/drawing-annotations.js';

test('Escape cancels a pending geometry transform without changing items or undo history', () => {
  const editor = Object.create(DrawingAnnotations.prototype);
  const items = [
    {
      id: 'line',
      type: 'shape',
      shape: 'line',
      view: 'top',
      points: [
        [0, 0],
        [10, 0],
      ],
    },
  ];
  const before = structuredClone(items);
  Object.assign(editor, {
    items,
    history: [],
    future: [],
    mode: 'copy-shapes',
    selected: null,
    drag: null,
    contextMenu: { hidden: true },
    hover: { point: [100, 100] },
    ui() {},
    adapter: { redraw() {} },
  });
  let prevented = false;
  editor.key({
    key: 'Escape',
    preventDefault() {
      prevented = true;
    },
    stopImmediatePropagation() {},
  });
  assert.ok(prevented);
  assert.equal(editor.mode, null);
  assert.equal(editor.hover, null);
  assert.deepEqual(editor.items, before);
  assert.equal(editor.history.length, 0);
});
