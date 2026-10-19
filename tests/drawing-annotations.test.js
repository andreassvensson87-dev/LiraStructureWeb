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
    contextMenu: {
      closed: false,
      close() {
        this.closed = true;
      },
      isOpen() {
        return !this.closed;
      },
    },
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
  assert.equal(annotations.contextMenu.closed, true);
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

test('pointer feedback preserves the scene while updating snap and transform previews', () => {
  const annotations = Object.create(DrawingAnnotations.prototype);
  const calls = [];
  Object.assign(annotations, {
    mode: 'line',
    graphicsRoot: { isConnected: true },
    adapter: { redraw: () => calls.push('scene') },
    location: () => ({ point: [12, 34], view: 'plan', snapped: true }),
    item: () => null,
    paintOverlay: () => calls.push('overlay'),
    render: () => calls.push('objects'),
    richText: { paintFeedback: () => calls.push('paper-overlay') },
  });
  annotations.movePoint({ clientX: 12, clientY: 34 });
  assert.deepEqual(annotations.hover.point, [12, 34]);
  assert.deepEqual(calls, ['overlay', 'paper-overlay']);
  calls.length = 0;
  annotations.transform = { active: () => true, phase: 'target', view: 'plan' };
  annotations.movePoint({ clientX: 23, clientY: 45 });
  assert.deepEqual(calls, ['overlay', 'paper-overlay']);
  calls.length = 0;
  annotations.redrawFeedback(true);
  assert.deepEqual(calls, ['objects']);
});

test('closing annotation graphics releases the detached scene through overlay parent references', () => {
  const annotations = Object.create(DrawingAnnotations.prototype);
  let removed = false;
  annotations.graphicsRoot = { modelPaths: Array(100).fill('projected model') };
  annotations.overlay = {
    remove: () => {
      removed = true;
    },
  };
  annotations.releaseGraphics();
  assert.equal(removed, true);
  assert.equal(annotations.overlay, null);
  assert.equal(annotations.graphicsRoot, null);
});

test('shape creation commits one history entry, continues a line and restores it with undo/redo', () => {
  const editor = Object.create(DrawingAnnotations.prototype);
  let hit;
  Object.assign(editor, {
    record: { annotations: [] },
    items: [],
    history: [],
    future: [],
    selectedIds: new Set(),
    surface: { setAttribute() {}, focus() {} },
    contextMenu: { close() {}, isOpen: () => false },
    adapter: { redraw() {} },
    ui() {},
    location: () => hit,
  });
  editor.record.annotations = editor.items;
  const pick = (point) => {
    hit = { point, view: 'front' };
    editor.down({
      button: 0,
      target: { closest: () => null },
      preventDefault() {},
      stopImmediatePropagation() {},
    });
  };
  editor.start('line', 'shape');
  pick([0, 0]);
  pick([100, 0]);
  assert.equal(editor.items.length, 1);
  assert.equal(editor.history.length, 1);
  assert.deepEqual(editor.draft.points, [[100, 0]]);
  pick([100, 50]);
  assert.equal(editor.items.length, 2);
  assert.deepEqual(editor.items[1].points, [
    [100, 0],
    [100, 50],
  ]);
  editor.undo();
  assert.equal(editor.items.length, 1);
  editor.undo(true);
  assert.equal(editor.items.length, 2);
  assert.equal(editor.record.annotations, editor.items);
  editor.start('polygon', 'shape');
  pick([0, 0]);
  pick([50, 0]);
  pick([50, 50]);
  pick([0, 0]);
  assert.equal(editor.items.at(-1).closed, true);
  assert.equal(editor.items.at(-1).points.length, 3);
});
test('duplicate dimension point preserves model references and the redo stack', () => {
  const editor = Object.create(DrawingAnnotations.prototype);
  const item = {
    id: 'dimension',
    type: 'dimension',
    kind: 'horizontal',
    points: [
      [0, 0],
      [100, 0],
    ],
    line: [0, 20],
    references: [{ source: 'beam', featureId: 'start' }, null],
  };
  Object.assign(editor, {
    record: { annotations: [item] },
    items: [item],
    selected: 'dimension',
    mode: 'add',
    phase: 'points',
    history: [],
    future: [[{ id: 'redo' }]],
    ui() {},
    adapter: { redraw() {} },
    location: () => ({ view: 'front', point: [0, 0], reference: { source: 'other' } }),
  });
  const before = structuredClone(item),
    redo = structuredClone(editor.future);
  editor.down({
    button: 0,
    target: { closest: () => null },
    preventDefault() {},
    stopImmediatePropagation() {},
  });
  assert.deepEqual(item, before);
  assert.deepEqual(editor.future, redo);
  assert.equal(editor.history.length, 0);
});
