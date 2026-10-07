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

test('two-point workflow goes directly to placement and stores model references', () => {
  const annotations = Object.create(DrawingAnnotations.prototype);
  let hit,
    checkpoints = 0;
  Object.assign(annotations, {
    selected: null,
    items: [],
    mode: 'horizontal',
    workflow: 'point',
    phase: 'points',
    draft: null,
    ui() {},
    location: () => hit,
    adapter: { redraw() {} },
    checkpoint() {
      checkpoints++;
    },
  });
  const click = (point, reference = null) => {
    hit = { point, reference, view: 'front' };
    annotations.down({
      button: 0,
      target: { closest: () => null },
      preventDefault() {},
      stopImmediatePropagation() {},
    });
  };
  click([0, 0], { kind: 'bore', source: 'part', featureId: 'a' });
  assert.equal(annotations.phase, 'points');
  click([100, 0], { kind: 'bore', source: 'part', featureId: 'b' });
  assert.equal(annotations.phase, 'place');
  assert.equal(checkpoints, 0);
  annotations.cancel = () => {
    annotations.mode = null;
    annotations.draft = null;
  };
  click([50, 50]);
  assert.equal(checkpoints, 1);
  assert.equal(annotations.items.length, 1);
  assert.deepEqual(annotations.items[0].line, [50, 50]);
  assert.equal(annotations.items[0].references[1].featureId, 'b');
});
test('two-point workflow allows retry after a second point with no distance in the selected direction', () => {
  const annotations = Object.create(DrawingAnnotations.prototype);
  let hit, message;
  Object.assign(annotations, {
    selected: null,
    items: [],
    mode: 'horizontal',
    workflow: 'point',
    phase: 'points',
    draft: null,
    ui(text) {
      message = text;
    },
    location: () => hit,
    adapter: { redraw() {} },
  });
  const click = (point) => {
    hit = { point, view: 'front' };
    annotations.down({
      button: 0,
      target: { closest: () => null },
      preventDefault() {},
      stopImmediatePropagation() {},
    });
  };
  click([0, 0]);
  click([0, 50]);
  assert.equal(annotations.draft.points.length, 1);
  assert.equal(annotations.draft.references.length, 1);
  assert.match(message, /riktning/);
  click([100, 50]);
  assert.equal(annotations.phase, 'place');
});
