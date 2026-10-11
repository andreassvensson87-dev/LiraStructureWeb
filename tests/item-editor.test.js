import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { ItemEditor } from '../src/items/editor.js';

function editorFixture(persist) {
  const geometry = new THREE.BoxGeometry(20, 30, 100);
  const definition = {
    id: 'item',
    revision: 1,
    name: 'Post',
    article: '123',
    supplier: 'Test',
    sourceName: 'test.step',
    geometryId: 'post-mesh',
    start: [0, 0, -50],
    end: [0, 0, 50],
    snap: 'anchors',
    mesh: {
      positions: Array.from(geometry.attributes.position.array),
      normals: Array.from(geometry.attributes.normal.array),
      indices: Array.from(geometry.index.array),
    },
  };
  geometry.dispose();
  const entry = { definition, folder: 'standard', starred: true };
  const library = {
    schema: 1,
    folders: [{ id: 'standard', name: 'Standard', parent: null }],
    items: [entry],
  };
  const controls = new Map([
    ['[data-save]', { disabled: false }],
    ['[data-test]', { disabled: false }],
    ['[data-model-snap]', { value: 'box' }],
    ['[data-editor-error]', { textContent: '' }],
  ]);
  const selected = [];
  const editor = Object.assign(Object.create(ItemEditor.prototype), {
    session: {},
    onClose: () => {},
    draft: { ...definition, name: 'Edited post' },
    editing: entry,
    latest: () => [{ ...entry, definition: { ...definition, revision: 4 } }],
    getLibrary: () => library,
    persist,
    onSaved: (value) => selected.push(value),
    e$: (selector) => controls.get(selector),
  });
  return { editor, controls, selected, library };
}

test('Item editor selects a new version only after library persistence completes', async () => {
  let complete, proposal;
  const persisted = new Promise((resolve) => {
    complete = resolve;
  });
  const { editor, controls, selected, library } = editorFixture((value) => {
    proposal = value;
    return persisted;
  });
  const saving = editor.saveEditor();
  assert.equal(controls.get('[data-save]').disabled, true);
  assert.equal(controls.get('[data-test]').disabled, true);
  assert.deepEqual(selected, []);
  assert.equal(library.items.length, 1);
  assert.equal(proposal.items[1].definition.revision, 5);
  assert.equal(proposal.items[1].definition.snap, 'box');
  assert.equal(proposal.items[1].starred, true);
  complete();
  const result = await saving;
  assert.deepEqual(selected, [result]);
  assert.equal(result.name, 'Edited post');
  assert.equal(controls.get('[data-save]').disabled, false);
  assert.equal(controls.get('[data-test]').disabled, false);
});

test('failed Item persistence retains the draft without selecting an unsaved version', async () => {
  const { editor, controls, selected, library } = editorFixture(async () => {
    throw Error('Storage unavailable');
  });
  assert.equal(await editor.saveEditor(), null);
  assert.equal(editor.draft.name, 'Edited post');
  assert.equal(library.items.length, 1);
  assert.deepEqual(selected, []);
  assert.equal(controls.get('[data-editor-error]').textContent, 'Storage unavailable');
  assert.equal(controls.get('[data-save]').disabled, false);
  assert.equal(controls.get('[data-test]').disabled, false);
});

test('closing an Item session releases its viewport, draft and field handlers', () => {
  const { editor } = editorFixture(async () => {});
  let disposed = 0,
    notified = 0;
  const fields = new Map();
  editor.view = { dispose: () => disposed++ };
  editor.guides = [
    [
      [0, 0, 0],
      [10, 0, 0],
    ],
  ];
  editor.helperStart = [1, 2, 3];
  editor.mode = 'helper';
  editor.e$ = (selector) => {
    if (!fields.has(selector))
      fields.set(selector, { replaceChildren: () => fields.set(selector, null) });
    return fields.get(selector);
  };
  editor.onClose = () => notified++;
  editor.endSession();
  assert.equal(disposed, 1);
  assert.equal(notified, 1);
  for (const key of ['session', 'view', 'draft', 'editing', 'mode', 'helperStart'])
    assert.equal(editor[key], null);
  assert.deepEqual(editor.guides, []);
  assert.equal(fields.size, 3);
  assert.ok([...fields.values()].every((value) => value === null));
});

test('an old Item save cannot select, close or overwrite a newer session', async () => {
  let complete;
  const { editor, controls, selected } = editorFixture(
    () =>
      new Promise((resolve) => {
        complete = resolve;
      }),
  );
  const saving = editor.saveEditor();
  assert.equal(await editor.saveEditor(), null, 'Do not start overlapping library writes');
  const newerSession = {};
  editor.session = newerSession;
  editor.draft = { ...editor.draft, name: 'New session' };
  complete();
  assert.equal(await saving, null);
  assert.deepEqual(selected, []);
  assert.equal(editor.session, newerSession);
  assert.equal(editor.draft.name, 'New session');
  assert.equal(controls.get('[data-save]').disabled, false);
});

test('an old Item storage failure does not show an error in a newer session', async () => {
  let fail;
  const { editor, controls, selected } = editorFixture(
    () =>
      new Promise((resolve, reject) => {
        fail = reject;
      }),
  );
  const saving = editor.saveEditor();
  editor.session = {};
  fail(Error('Old storage failure'));
  assert.equal(await saving, null);
  assert.deepEqual(selected, []);
  assert.equal(controls.get('[data-editor-error]').textContent, '');
  assert.equal(controls.get('[data-test]').disabled, false);
});
