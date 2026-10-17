import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';

const hooks = registerHooks({
  load(url, context, nextLoad) {
    return url.endsWith('.css')
      ? { format: 'module', source: '', shortCircuit: true }
      : nextLoad(url, context);
  },
});
const { FastenerUI } = await import('../src/fasteners/ui.js');
hooks.deregister();

test('confirming target selection returns an edited group to its pending inspector without committing it', () => {
  const source = { id: 'screw' },
    draft = { holes: [{ targetId: 'new-part' }] };
  const error = { textContent: '' };
  const calls = [];
  const ui = Object.assign(Object.create(FastenerUI.prototype), {
    editingObject: source,
    loadedSource: source,
    placeForm: { querySelector: () => error },
    readPlacement: () => draft,
    selectSource(id) {
      assert.equal(this.keepPlacementDraft, true, 'selection transitions cannot reset the fields');
      calls.push(['select', id]);
    },
    previewRange() {
      calls.push(['preview']);
    },
    commit() {
      assert.fail('target selection must not commit');
    },
    beginPlacement() {
      assert.fail('editing must not start a new group');
    },
  });
  ui.confirmTargets();
  assert.deepEqual(calls, [['select', 'screw'], ['preview']]);
  assert.equal(ui.loadedSource, source);
  assert.equal(ui.keepPlacementDraft, false);
  assert.equal(error.textContent, '');
  ui.readPlacement = () => {
    throw Error('Välj minst ett objekt');
  };
  ui.confirmTargets();
  assert.equal(calls.length, 2, 'invalid target selection stays in target selection');
  assert.match(error.textContent, /minst ett/);
});

test('reselecting placement targets retains the form and then resumes the existing placement draft', () => {
  const calls = [],
    draft = { holes: [{ targetId: 'a' }, { targetId: 'b' }] };
  const ui = Object.assign(Object.create(FastenerUI.prototype), {
    holeRows: draft.holes,
    readHoles() {},
    beginTargets(ids) {
      assert.equal(this.keepPlacementDraft, true);
      calls.push(['targets', ids]);
    },
    readPlacement: () => draft,
    beginPlacement(value) {
      calls.push(['resume', value]);
    },
    placeForm: { querySelector: () => ({ textContent: '' }) },
    commit() {
      assert.fail('choosing targets cannot create a group');
    },
  });
  ui.pickTargets();
  assert.equal(ui.keepPlacementDraft, false);
  ui.confirmTargets();
  assert.deepEqual(calls, [
    ['targets', ['a', 'b']],
    ['resume', draft],
  ]);
});
