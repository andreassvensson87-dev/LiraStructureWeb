import test from 'node:test';
import assert from 'node:assert/strict';
import { createProject } from '../src/project/project-state.js';
import { ProjectHistory } from '../src/project/project-history.js';
import { serializeProject, parseProjectFile } from '../src/project/project-file.js';
import { createAssembly } from '../src/project/assemblies.js';
import { defaultNumberingSettings, planNumbering, applyNumbering } from '../src/numbering/plan.js';
import { planMarkChange, applyMarkChange } from '../src/numbering/mark-change.js';
import { assemblyNumberStatus, resolveAssemblyDrawing } from '../src/assembly-numbering.js';
import { partStatus } from '../src/part-marks.js';
import { drawingCreationGroups, createSelectedDrawings } from '../src/drawing-creation.js';
import { normalizePreset } from '../src/drawing-presets.js';
import { pdfFileName } from '../src/drawing-pdf.js';

function fixture() {
  const state = createProject({
    grid: { x: [], y: [] },
    levels: {
      active: 'l',
      items: [{ id: 'l', name: 'Plan', elevation: 0 }],
    },
  });
  const beam = (id, x, y, width = 100) => ({
    id,
    type: 'sweep',
    name: 'Balk',
    prefix: 'B',
    number: Number(id.slice(1)),
    profile: 'rect',
    width,
    height: 200,
    thickness: 0,
    rotation: 0,
    start: [x, y, 0],
    end: [x + 1000, y, 0],
    partSeries: { prefix: 'P', start: 100 },
    assemblySeries: { prefix: 'A', start: 200 },
  });
  state.objects = [
    beam('b1', 0, 0),
    beam('b2', 0, 300, 120),
    beam('b3', 3000, 0),
    beam('b4', 3000, 300, 120),
    beam('b5', 0, 3000, 150),
  ];
  state.assemblies = [
    createAssembly(state, ['b1', 'b2'], 'b1', 'Assembly', () => 'a1'),
    createAssembly(state, ['b3', 'b4'], 'b3', 'Assembly', () => 'a2'),
  ];
  number(state);
  const selected = new Set(state.objects.map((o) => o.id));
  let id = 0;
  state.drawings = createSelectedDrawings(
    state,
    selected,
    new Set(drawingCreationGroups(state, selected).map((g) => g.key)),
    normalizePreset({}),
    null,
    () => `d${++id}`,
  );
  for (const d of state.drawings) {
    d.annotations = [{ id: 'note', comment: 'Behåll', sourceId: d.sourceId, points: [[1, 2]] }];
    d.sheet = { views: [{ id: 'view', name: 'Front', scale: 10 }] };
    d.revision = 'B';
  }
  return state;
}
function number(state, options = {}) {
  Object.assign(
    state,
    applyNumbering(planNumbering(state, { ...defaultNumberingSettings(), ...options }), state),
  );
}
function rename(state, kind, id, mark) {
  const plan = planMarkChange(state, { kind, id }, mark);
  Object.assign(state, applyMarkChange(plan, state));
  return plan;
}
test('part rename moves the entire type and rekeys assembly identities without changing their marks or drawing contents', () => {
  const state = fixture(),
    before = structuredClone(state);
  const plan = planMarkChange(state, { kind: 'part', id: 'b1' }, 'P150');
  assert.equal(plan.count, 2);
  assert.deepEqual(state, before, 'preview is read only');
  Object.assign(state, applyMarkChange(plan, state));
  assert.deepEqual(state.objects, before.objects);
  assert.equal(state.parts.assignments.b1.mark, 'P150');
  assert.equal(state.parts.assignments.b3.mark, 'P150');
  assert.equal(state.parts.assignments.b2.mark, before.parts.assignments.b2.mark);
  assert.ok(state.assemblies.every((a) => assemblyNumberStatus(a, state).valid));
  for (const a of state.assemblies)
    assert.equal(a.mark, before.assemblies.find((old) => old.id === a.id).mark);
  const partDrawing = state.drawings.find((d) => d.type === 'SP' && d.sourceId === 'b1');
  assert.equal(partDrawing.name, 'P150');
  assert.equal(partDrawing.number, 'P150');
  assert.equal(pdfFileName([partDrawing]), 'P150.pdf');
  for (const d of state.drawings) {
    const old = before.drawings.find((o) => o.id === d.id);
    assert.deepEqual(d.annotations, old.annotations);
    assert.deepEqual(d.sheet, old.sheet);
    assert.equal(d.revision, 'B');
    if (d.type === 'AS') assert.ok(resolveAssemblyDrawing(d, state));
  }
  number(state);
  assert.equal(state.parts.assignments.b1.mark, 'P150');
  assert.deepEqual(state.drawings.map((d) => d.id).sort(), before.drawings.map((d) => d.id).sort());
  assert.ok(state.assemblies.every((a) => assemblyNumberStatus(a, state).valid));
});
test('manual part and assembly marks persist through normal/full numbering, file roundtrip and a single undo/redo', () => {
  let state = fixture();
  rename(state, 'part', 'b1', 'P150');
  const before = structuredClone(state),
    history = new ProjectHistory();
  history.prime(state);
  const plan = planMarkChange(state, { kind: 'assembly', id: 'a1' }, 'A250');
  assert.equal(plan.count, 2);
  history.checkpoint(state);
  Object.assign(state, applyMarkChange(plan, state));
  const changed = structuredClone(state);
  state = history.undo(state);
  assert.deepEqual(state, before);
  state = history.redo(state);
  assert.deepEqual(state, changed);
  state = parseProjectFile(serializeProject(state));
  assert.equal(state.assemblies.find((a) => a.id === 'a2').mark, 'A250');
  for (const options of [
    {},
    { renumberAll: true, reuseOldNumbers: true },
    { newParts: 'new', modifiedParts: 'new' },
  ]) {
    number(state, options);
    assert.equal(state.parts.assignments.b1.mark, 'P150');
    if (options.renumberAll) assert.equal(state.parts.assignments.b2.mark, 'P100');
    assert.equal(state.assemblies.find((a) => a.id === 'a1').mark, 'A250');
    const d = state.drawings.find((d) => d.type === 'AS' && d.assemblyId === 'a1');
    assert.equal(d.name, 'A250');
    assert.equal(pdfFileName([d]), 'A250.pdf');
  }
});
test('a part rename after manual assembly numbering preserves its reservation and subsequent drawing resolution', () => {
  const state = fixture();
  rename(state, 'assembly', 'a1', 'A250');
  rename(state, 'part', 'b2', 'P180');
  number(state, { renumberAll: true, reuseOldNumbers: true });
  assert.equal(state.assemblies.find((a) => a.id === 'a1').mark, 'A250');
  assert.ok(state.assemblies.every((a) => assemblyNumberStatus(a, state).valid));
  const loaded = parseProjectFile(serializeProject(state));
  assert.ok(
    loaded.drawings.filter((d) => d.type === 'AS').every((d) => resolveAssemblyDrawing(d, loaded)),
  );
});
test('occupied, malformed and stale marks are blocked without mutations; unchanged mark creates no transaction', () => {
  const state = fixture(),
    before = structuredClone(state);
  const target = { kind: 'part', id: 'b1' };
  for (const mark of ['', 'P 150', 'P', state.parts.assignments.b2.mark, state.assemblies[0].mark])
    assert.throws(() => planMarkChange(state, target, mark));
  assert.deepEqual(state, before);
  assert.equal(
    applyMarkChange(planMarkChange(state, target, state.parts.assignments.b1.mark), state),
    null,
  );
  const plan = planMarkChange(state, target, 'P150');
  state.objects[0].width++;
  assert.throws(() => applyMarkChange(plan, state), /ändrats/);
  assert.throws(() => planMarkChange(state, target, 'P150'), /Numrera/);
});
test('manual marks remain with unchanged owners when another occurrence changes', () => {
  const state = fixture();
  rename(state, 'part', 'b1', 'P150');
  rename(state, 'assembly', 'a1', 'A250');
  state.objects[0].width = 160;
  number(state, { reuseOldNumbers: true });
  assert.notEqual(state.parts.assignments.b1.mark, 'P150');
  assert.equal(state.parts.assignments.b3.mark, 'P150');
  assert.equal(state.assemblies.find((a) => a.id === 'a2').mark, 'A250');
  assert.throws(() => planMarkChange(state, { kind: 'part', id: 'b5' }, 'P150'), /upptagen/);
  assert.throws(
    () =>
      planMarkChange(
        state,
        { kind: 'assembly', id: state.assemblies.find((a) => a.mainId === 'b5').id },
        'A250',
      ),
    /upptagen/,
  );
  assert.ok(state.objects.every((o) => partStatus(o, state.objects, state.parts).valid));
});
