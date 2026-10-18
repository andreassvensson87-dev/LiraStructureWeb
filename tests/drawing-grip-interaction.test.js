import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DrawingGripInteraction } from '../src/drawing-grip-interaction.js';
import { DrawingAnnotations } from '../src/drawing-annotations.js';
import { beginDrawingObjectGrip } from '../src/drawing-object-grip-editor.js';
import { beginDrawingViewGrip } from '../src/drawing-view-grip-editor.js';

function fixture() {
  let value = 0,
    committed = 0,
    captures = new Set();
  const input = { value: '', setAttribute() {}, focus() {} };
  const form = {
    hidden: true,
    querySelector: (s) => (s === 'input' ? input : { textContent: '' }),
  };
  const surface = {
    contains: () => true,
    setAttribute() {},
    focus() {},
    setPointerCapture: (id) => captures.add(id),
    hasPointerCapture: (id) => captures.has(id),
    releasePointerCapture: (id) => captures.delete(id),
  };
  const node = { dataset: { gripKey: 'point' }, getAttribute: () => 'Ändra punkten' };
  const editor = {
    surface,
    dynamicInput: form,
    hint: { textContent: '' },
    dialog: { querySelectorAll: () => [] },
    ui() {},
    adapter: { paper: surface, redraw() {} },
    beginGrip: () => ({
      label: 'Ändra punkten',
      locate: (e) => ({ point: [e.clientX, e.clientY] }),
      apply: (hit) => {
        if (hit.point[0] < 0) throw Error('Ogiltigt');
        value = hit.point[0];
      },
      preview() {},
      commit() {
        committed++;
      },
      cancel() {
        value = 0;
      },
      numeric: { label: 'Radie · mm', hit: (n) => ({ point: [n, 0] }) },
    }),
  };
  const controller = Object.create(DrawingGripInteraction.prototype);
  controller.editor = editor;
  const event = (x, y = 0) => ({
    button: 0,
    pointerId: 1,
    clientX: x,
    clientY: y,
    target: { closest: () => node },
    preventDefault() {},
    stopImmediatePropagation() {},
  });
  return {
    controller,
    editor,
    event,
    get value() {
      return value;
    },
    get committed() {
      return committed;
    },
    captures,
  };
}

test('a grip commits on drag release and a click alone never starts placement', () => {
  const f = fixture();
  f.controller.down(f.event(0));
  f.controller.move(f.event(20));
  f.controller.up(f.event(25));
  assert.equal(f.value, 25);
  assert.equal(f.committed, 1);
  assert.equal(f.controller.session, null);
  assert.equal(f.captures.size, 0);
  const g = fixture();
  g.controller.down({ ...g.event(0), button: 1 });
  assert.equal(g.controller.session, undefined, 'middle button remains available to navigation');
  g.controller.down(g.event(0));
  g.controller.up(g.event(0));
  assert.equal(g.controller.session, null);
  assert.equal(g.committed, 0);
  g.controller.move(g.event(30));
  assert.equal(g.value, 0);
  assert.equal(g.committed, 0);
});
test('invalid placement cannot commit a previous preview, and Escape restores without history', () => {
  const f = fixture();
  f.controller.down(f.event(0));
  f.controller.move(f.event(20));
  f.controller.move(f.event(-1));
  assert.equal(f.committed, 0);
  assert.ok(f.controller.session);
  f.controller.key({ ...f.event(0), key: 'Escape' });
  assert.equal(f.value, 0);
  assert.equal(f.committed, 0);
  assert.equal(f.controller.session, null);
});
test('numeric grip input accepts decimal comma and rejects zero without ending placement', () => {
  const f = fixture();
  f.controller.down(f.event(0));
  f.controller.submit('0');
  assert.ok(f.controller.session);
  assert.equal(f.committed, 0);
  f.controller.submit('12,5');
  assert.equal(f.value, 12.5);
  assert.equal(f.committed, 1);
});

test('anchor grip preview carries snap references, cancel restores absent fields, and commit has one history entry', () => {
  const item = {
    id: 'dim',
    type: 'dimension',
    view: 'front',
    kind: 'horizontal',
    points: [
      [0, 0],
      [100, 0],
    ],
    line: [0, 20],
  };
  const editor = {
    items: [item],
    history: [],
    future: [],
    ui() {},
    redrawFeedback() {},
    location: () => ({ point: [10, 0], reference: { kind: 'test' } }),
    validAnchor: () => true,
    referenceFor: (hit) => hit.reference,
  };
  const node = {
    dataset: { anchor: '0' },
    closest: () => ({ dataset: { annotation: 'dim' } }),
    getAttribute: () => 'Flytta måttpunkten',
  };
  const session = beginDrawingObjectGrip(editor, {}, node);
  session.apply(session.locate({}));
  assert.deepEqual(item.points[0], [10, 0]);
  assert.equal(item.references[0].kind, 'test');
  session.cancel();
  assert.equal(item.references, undefined);
  assert.deepEqual(item.points[0], [0, 0]);
  session.apply(session.locate({}));
  session.commit();
  assert.equal(editor.history.length, 1);
});

test('moving a group of views and cropping are reversible in the same history as annotations, without changing scale', () => {
  const views = [
    { id: 'a', position: [10, 20], size: [100, 80], scale: 20, camera: { center: [0, 0] } },
    { id: 'b', position: [150, 20], size: [50, 40], scale: 50, camera: { center: [0, 0] } },
  ];
  const editor = Object.create(DrawingAnnotations.prototype);
  Object.assign(editor, {
    items: [],
    record: { annotations: [] },
    history: [],
    future: [],
    ui() {},
    cancel() {},
    adapter: { redraw() {} },
  });
  const paper = { getBoundingClientRect: () => ({ left: 0, top: 0, width: 400, height: 300 }) };
  const begin = (kind) =>
    beginDrawingViewGrip({
      event: { clientX: 0, clientY: 0 },
      node: { dataset: { viewGrip: kind }, closest: () => ({ dataset: { view: 'a' } }) },
      paper,
      paperSize: () => [400, 300],
      views: () => views,
      selected: () => views,
      annotations: editor,
      render() {},
    });
  const move = begin('move');
  assert.equal(move.locate({ clientX: 0, clientY: 0 }).view, 'paper');
  move.apply({ point: [30, 40] });
  assert.deepEqual(
    views.map((v) => v.position),
    [
      [10, 20],
      [150, 20],
    ],
    'draft does not change saved views',
  );
  move.commit();
  assert.deepEqual(
    views.map((v) => v.position),
    [
      [40, 60],
      [180, 60],
    ],
  );
  assert.equal(editor.history.length, 1);
  editor.undo();
  assert.deepEqual(
    views.map((v) => v.position),
    [
      [10, 20],
      [150, 20],
    ],
  );
  editor.undo(true);
  assert.deepEqual(
    views.map((v) => v.position),
    [
      [40, 60],
      [180, 60],
    ],
  );
  const crop = begin('e');
  crop.apply({ point: [20, 0] });
  crop.commit();
  assert.equal(views[0].size[0], 120);
  assert.equal(views[0].scale, 20);
  assert.equal(views[1].size[0], 50);
  editor.undo();
  assert.equal(views[0].size[0], 100);
  assert.equal(views[0].scale, 20);
});
