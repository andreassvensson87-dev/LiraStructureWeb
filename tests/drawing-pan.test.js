import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DrawingAnnotations } from '../src/drawing-annotations.js';
import { DrawingShapeTransform } from '../src/drawing-shape-transform.js';
import { installDrawingPan } from '../src/drawing-pan.js';
function setup(blocked = () => false, completion) {
  const handlers = {},
    classes = new Set();
  let captured = null;
  const workspace = {
    scrollLeft: 300,
    scrollTop: 200,
    classList: { add: (c) => classes.add(c), remove: (c) => classes.delete(c) },
    addEventListener: (type, handler) => (handlers[type] = handler),
    setPointerCapture: (id) => (captured = id),
    hasPointerCapture: (id) => captured === id,
    releasePointerCapture: () => (captured = null),
  };
  const pan = installDrawingPan(workspace, { blocked, completion });
  const fire = (type, values = {}) => {
    const event = {
      button: 2,
      pointerId: 1,
      clientX: 100,
      clientY: 100,
      preventDefault() {
        this.prevented = true;
      },
      stopImmediatePropagation() {
        this.stopped = true;
      },
      ...values,
    };
    handlers[type](event);
    return event;
  };
  return { workspace, pan, fire, classes };
}
test('secondary click-drag pans workspace and consumes events before annotation tools', () => {
  const { workspace, pan, fire, classes } = setup();
  assert.equal(fire('pointerdown').stopped, true);
  assert.equal(pan.active, true);
  fire('pointermove', { clientX: 150, clientY: 80 });
  assert.equal(workspace.scrollLeft, 250);
  assert.equal(workspace.scrollTop, 220);
  assert.equal(fire('pointerup').stopped, true);
  assert.equal(pan.active, false);
  assert.equal(classes.size, 0);
});
test('left clicks and active object drags are preserved; cancellation releases pan', () => {
  const { pan, fire } = setup();
  assert.equal(fire('pointerdown', { button: 0 }).stopped, undefined);
  assert.equal(pan.active, false);
  fire('pointerdown', { button: 1 });
  pan.cancel();
  assert.equal(pan.active, false);
  const blocked = setup(() => true);
  assert.equal(blocked.fire('pointerdown').stopped, undefined);
  assert.equal(blocked.pan.active, false);
});

test('annotation context menu keeps secondary click while middle drag can still pan', () => {
  const { pan, fire } = setup();
  const target = {
    closest: (selector) => (selector.split(',').includes('[data-annotation]') ? {} : null),
  };
  assert.equal(fire('pointerdown', { target }).stopped, undefined);
  assert.equal(pan.active, false);
  assert.equal(fire('pointerdown', { target, button: 1 }).stopped, true);
  assert.equal(pan.active, true);
});

function annotationSession() {
  const annotations = Object.create(DrawingAnnotations.prototype);
  Object.assign(annotations, {
    mode: 'polygon',
    workflow: 'shape',
    phase: 'points',
    items: [],
    history: [],
    draft: {
      id: 'polygon',
      type: 'shape',
      shape: 'polygon',
      view: 'front',
      points: [
        [0, 0],
        [100, 0],
        [100, 100],
      ],
    },
    ui() {},
    adapter: { redraw() {} },
    checkpoint() {
      this.history.push(structuredClone(this.items));
    },
    start(mode, workflow) {
      this.mode = mode;
      this.workflow = workflow;
      this.draft = null;
    },
    surface: { focus() {} },
  });
  const f = setup(() => false, {
    getCommand: () => annotations.completionCommand(),
    complete: () => annotations.complete(),
  });
  const click = (extra = {}) => {
    f.fire('pointerdown', { button: 1, ...extra });
    f.fire('pointerup', { button: 1, ...extra });
  };
  return { ...f, annotations, click };
}

test('drawing middle completion closes a polygon once without adding its release point; pan and modifiers never commit', () => {
  const f = annotationSession(),
    a = f.annotations;
  for (const key of ['ctrlKey', 'metaKey', 'altKey', 'shiftKey']) f.click({ [key]: true });
  f.fire('pointerdown', { button: 1 });
  f.fire('pointermove', { button: 1, clientX: 180, clientY: 140 });
  assert.equal(f.workspace.scrollLeft, 220);
  assert.equal(f.workspace.scrollTop, 160);
  f.fire('pointermove', { button: 1 });
  f.fire('pointerup', { button: 1 });
  assert.equal(a.items.length, 0);
  for (const type of ['pointercancel', 'lostpointercapture']) {
    f.fire('pointerdown', { button: 1 });
    f.fire(type, { button: 1 });
    f.fire('pointerup', { button: 1 });
  }
  assert.equal(a.items.length, 0);
  f.click();
  assert.equal(a.items.length, 1);
  assert.equal(a.items[0].points.length, 3);
  assert.equal(a.history.length, 1);
  assert.equal(f.pan.active, false);
  f.click();
  assert.equal(a.items.length, 1, 'empty next polygon cannot confirm');
});

test('drawing middle completion advances dimensions to placement without storing a measurement or choosing its line', () => {
  const f = annotationSession(),
    a = f.annotations;
  a.mode = 'horizontal';
  a.workflow = 'chain';
  a.draft = {
    id: 'dimension',
    type: 'dimension',
    kind: 'horizontal',
    points: [
      [0, 0],
      [100, 0],
    ],
    view: 'front',
  };
  f.click();
  assert.equal(a.phase, 'place');
  assert.equal(a.items.length, 0);
  assert.equal(a.history.length, 0);
  const before = structuredClone(a.draft);
  f.click();
  assert.deepEqual(a.draft, before, 'placing the line still requires a real point click');
  a.phase = 'points';
  a.draft.points = [[0, 0]];
  f.click();
  assert.equal(a.phase, 'points', 'insufficient points stay editable');
});

test('drawing transform and automatic dimension selections confirm only their selection phase', () => {
  for (const mode of ['move-shapes', 'copy-shapes', 'rotate-shapes']) {
    const f = annotationSession(),
      a = f.annotations;
    a.mode = mode;
    a.transform = Object.create(DrawingShapeTransform.prototype);
    Object.assign(a.transform, { editor: a, phase: 'select', ids: ['shape'], active: () => true });
    f.click();
    assert.equal(a.transform.phase, 'base');
    f.click();
    assert.equal(a.transform.phase, 'base');
    assert.equal(a.items.length, 0);
  }
  const f = annotationSession(),
    a = f.annotations;
  a.mode = 'assistant';
  a.assistant = { phase: 'select', sources: ['part'], ui() {} };
  f.click();
  assert.equal(a.assistant.phase, 'place');
  f.click();
  assert.equal(a.items.length, 0);
  a.mode = 'richtext';
  a.richText = { draft: {} };
  assert.equal(a.completionCommand(), null, 'middle click must not save text');
});
