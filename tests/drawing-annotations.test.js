import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DrawingAnnotations } from '../src/drawing-annotations.js';

test('adding dimension points transfers focus from the dismissed menu to the drawing', () => {
  const annotations = Object.create(DrawingAnnotations.prototype);
  let focused = false;
  let tabindex;
  Object.assign(annotations, {
    items: [
      {
        id: 'chain',
        type: 'dimension',
        points: [
          [0, 0],
          [10, 0],
        ],
      },
    ],
    selected: 'chain',
    contextMenu: { hidden: false },
    surface: {
      setAttribute: (name, value) => {
        tabindex = [name, value];
      },
      focus: (options) => {
        focused = options.preventScroll;
      },
    },
    ui() {},
    adapter: { redraw() {} },
  });
  annotations.startAdding();
  assert.equal(annotations.contextMenu.hidden, true);
  assert.equal(annotations.mode, 'add');
  assert.deepEqual(tabindex, ['tabindex', '-1']);
  assert.equal(focused, true);

  const points = structuredClone(annotations.items[0].points);
  let prevented = false;
  let stopped = false;
  annotations.key({
    key: 'Escape',
    target: { closest: () => ({}) },
    preventDefault() {
      prevented = true;
    },
    stopImmediatePropagation() {
      stopped = true;
    },
  });
  assert.equal(annotations.mode, null);
  assert.equal(annotations.hover, null);
  assert.equal(prevented && stopped, true);
  assert.deepEqual(annotations.items[0].points, points);
});
