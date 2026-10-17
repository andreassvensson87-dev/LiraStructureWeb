import test from 'node:test';
import assert from 'node:assert/strict';
import { SectionEditor } from '../src/section-editor.js';
import { createPointerCompletion } from '../src/pointer-completion.js';

function fixture() {
  const editor = Object.create(SectionEditor.prototype);
  let captured = null;
  Object.assign(editor, {
    mode: 'poly',
    draft: [
      [0, 0],
      [100, 0],
      [100, 100],
    ],
    undo: [],
    redo: [],
    def: { name: 'Test', parameters: [], loops: [], anchor: [0, 0], catalog: {} },
    center: [0, 0],
    scale: 2,
    local: (e) => [e.clientX, e.clientY],
    $: () => ({ querySelectorAll: () => [] }),
    draw() {},
    sync() {},
    canvas: {
      setPointerCapture: (id) => {
        captured = id;
      },
      hasPointerCapture: (id) => captured === id,
      releasePointerCapture: () => {
        captured = null;
      },
    },
  });
  editor.completion = createPointerCompletion({
    getCommand: () =>
      ['poly', 'hole'].includes(editor.mode) && editor.draft.length ? editor.draft : null,
    complete: () => editor.action('finish'),
  });
  const event = (extra = {}) => ({ button: 1, pointerId: 1, clientX: 100, clientY: 100, ...extra });
  return { editor, event, captured: () => captured };
}

test('profile contour completion uses the real finish/history path while middle and right drags retain panning', () => {
  const { editor: e, event, captured } = fixture();
  const before = structuredClone(e.draft);
  e.down(event());
  e.move(event({ clientX: 160, clientY: 120 }));
  assert.deepEqual(e.center, [-30, 10]);
  e.move(event());
  e.up(event());
  assert.equal(e.def.loops.length, 0, 'a pan returning to origin is still a pan');
  assert.deepEqual(e.draft, before);
  for (const extra of [
    { ctrlKey: true },
    { metaKey: true },
    { shiftKey: true },
    { altKey: true },
    { button: 2 },
  ]) {
    e.down(event(extra));
    e.up(event(extra));
    assert.equal(e.def.loops.length, 0);
    assert.equal(captured(), null);
  }
  e.down(event());
  e.up(event());
  assert.equal(e.mode, 'select', e.error);
  assert.equal(e.def.loops.length, 1);
  assert.equal(e.def.loops[0].vertices.length, 3);
  assert.equal(e.undo.length, 1);
  assert.equal(captured(), null);
  e.action('undo');
  assert.equal(e.def.loops.length, 0);
  assert.deepEqual(e.draft, before);
});

test('incomplete profile contour remains editable and cancelled or replaced drafts never complete', () => {
  const { editor: e, event } = fixture();
  e.draft = [
    [0, 0],
    [100, 0],
  ];
  e.down(event());
  e.up(event());
  assert.equal(e.def.loops.length, 0);
  assert.equal(e.undo.length, 0);
  assert.match(e.error, /tre punkter/);
  e.draft.push([100, 100]);
  e.down(event());
  e.completion.cancel();
  e.up(event());
  assert.equal(e.def.loops.length, 0);
  e.down(event());
  e.draft = [...e.draft];
  e.up(event());
  assert.equal(e.def.loops.length, 0, 'a replacement draft cannot inherit a previous press');
  e.down(event());
  e.up(event());
  assert.equal(e.def.loops.length, 1);
});
