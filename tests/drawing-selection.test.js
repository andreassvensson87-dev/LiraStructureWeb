import test from 'node:test';
import assert from 'node:assert/strict';
import { createProject } from '../src/project/project-state.js';
import { createAssembly } from '../src/project/assemblies.js';
import { defaultNumberingSettings, planNumbering, applyNumbering } from '../src/numbering/plan.js';
import { drawingCreationGroups, createSelectedDrawings } from '../src/drawing-creation.js';
import { selectionDrawingContext } from '../src/drawing-selection.js';
import { createSelectionDrawingActions } from '../src/app/selection-drawings.js';

function fixture(numbered = true) {
  const state = createProject({
    grid: { x: [0, 1000], y: [0, 1000] },
    levels: {
      active: 'l',
      items: [{ id: 'l', name: 'Plan', elevation: 0 }],
    },
  });
  state.objects = ['a', 'b', 'c', 'd'].map((id, i) => ({
    id,
    name: id,
    type: 'sweep',
    profile: 'rect',
    width: 100,
    height: 200,
    thickness: 10,
    rotation: 0,
    start: [Math.floor(i / 2) * 2000, (i % 2) * 300, 0],
    end: [Math.floor(i / 2) * 2000 + 1000, (i % 2) * 300, 0],
  }));
  state.objects.push({ id: 'helper', type: 'helperpoint', start: [0, 0, 0] });
  state.assemblies = [createAssembly(state, ['a', 'b'], 'a', 'Par', () => 'one')];
  if (numbered) {
    number(state, { parts: true, assemblies: true });
    const ids = new Set(state.objects.map((o) => o.id));
    state.drawings = createSelectedDrawings(
      state,
      ids,
      new Set(drawingCreationGroups(state, ids).map((g) => g.key)),
    );
  }
  return state;
}
function number(state, kinds) {
  const plan = planNumbering(state, { ...defaultNumberingSettings(), ...kinds });
  Object.assign(state, applyNumbering(plan, state));
}
function actionsFor(state, overrides = {}) {
  const calls = { batch: [], open: [], number: [], restored: [], message: [] };
  const actions = createSelectionDrawingActions({
    getState: () => state,
    prepare() {},
    number: async (kinds) => {
      calls.number.push(kinds);
      number(state, kinds);
      return true;
    },
    restoreSelection: (ids) => calls.restored.push(ids),
    showBatch: (type, ids) => calls.batch.push({ type, ids: [...ids] }),
    openDrawing: (record) => calls.open.push(record),
    message: (text) => calls.message.push(text),
    ...overrides,
  });
  return { actions, calls };
}
test('selection links shared part types and member-owned assemblies once, excludes GA/helpers, and never mutates', () => {
  const state = fixture();
  state.drawings.push({ id: 'ga', type: 'GA', number: 'GA-001' });
  const before = JSON.stringify(state);
  const member = selectionDrawingContext(state, new Set(['b', 'helper']));
  assert.equal(member.selection.size, 1);
  assert.deepEqual(
    member.drawings.map((link) => link.record.type),
    ['SP', 'AS'],
  );
  assert.ok(member.drawings.every((link) => link.valid));
  const part = member.drawings[0].record;
  assert.ok(
    selectionDrawingContext(state, ['c']).drawings.some((link) => link.record.id === part.id),
  );
  const multiple = selectionDrawingContext(state, ['a', 'b']);
  assert.equal(multiple.drawings.length, 2);
  assert.equal(JSON.stringify(state), before);
});
test('unnumbered standalone part gets an assembly request through explicit numbering and retains the captured selection', async () => {
  const state = fixture(false),
    ids = new Set(['c', 'helper']);
  const { actions, calls } = actionsFor(state, {
    number: async (kinds) => {
      calls.number.push(kinds);
      ids.clear();
      ids.add('a');
      number(state, kinds);
      return true;
    },
  });
  await actions.createForSelection('AS', ids);
  assert.deepEqual(calls.number, [{ parts: true, assemblies: true }]);
  assert.deepEqual(calls.restored, [['c', 'helper']]);
  assert.deepEqual(calls.batch, [{ type: 'AS', ids: ['c', 'helper'] }]);
  assert.ok(state.assemblies.some((a) => a.mainId === 'c'));
  assert.equal(state.drawings.length, 0); // Creation remains the batch dialog's transaction.
});
test('cancelled numbering creates nothing and duplicate pending requests cannot open another numbering dialog', async () => {
  const state = fixture(false),
    before = JSON.stringify(state);
  let finish;
  const { actions, calls } = actionsFor(state, {
    number: (kinds) => {
      calls.number.push(kinds);
      return new Promise((done) => {
        finish = done;
      });
    },
  });
  const pending = actions.createForSelection('SP', ['a']);
  await actions.createForSelection('AS', ['c']);
  assert.deepEqual(calls.number, [{ parts: true, assemblies: false }]);
  finish(false);
  await pending;
  assert.equal(JSON.stringify(state), before);
  assert.deepEqual(calls.batch, []);
  assert.deepEqual(calls.restored, [['a']]);
});
test('valid existing drawing opens directly even when another selected part needs numbering', async () => {
  const state = fixture();
  const record = state.drawings.find((d) => d.type === 'SP');
  state.objects[0].end[0] += 200;
  const { actions, calls } = actionsFor(state);
  await actions.openForSelection(record, ['a', 'b']);
  assert.equal(calls.number.length, 0);
  assert.equal(calls.open[0].id, record.id);
});
test('stale part drawing resumes through its current selection link after numbering splits a shared type', async () => {
  const state = fixture();
  const old = state.drawings.find((d) => d.type === 'SP');
  state.objects[0].end[0] += 200;
  const before = JSON.stringify(state);
  const context = selectionDrawingContext(state, ['a']);
  assert.equal(context.drawings.find((link) => link.record.id === old.id).valid, false);
  assert.equal(JSON.stringify(state), before);
  const { actions, calls } = actionsFor(state);
  await actions.openForSelection(old, ['a']);
  assert.deepEqual(calls.number, [{ parts: true, assemblies: false }]);
  assert.equal(calls.open.length, 1);
  assert.equal(calls.open[0].partKey, state.parts.assignments.a.key);
  assert.equal(calls.open[0].sourceId, 'a');
  assert.equal(calls.batch.length, 0);
});
test('empty or helper-only selection cannot fall back to creating drawings for the entire model', async () => {
  const state = fixture(false),
    { actions, calls } = actionsFor(state);
  await actions.createForSelection('SP', []);
  await actions.createForSelection('AS', ['helper']);
  assert.equal(calls.number.length, 0);
  assert.equal(calls.batch.length, 0);
  assert.equal(calls.message.length, 2);
});
