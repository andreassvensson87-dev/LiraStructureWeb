import test from 'node:test';
import assert from 'node:assert/strict';
import { createProject } from '../src/project/project-state.js';
import { ProjectHistory } from '../src/project/project-history.js';
import { serializeProject, parseProjectFile } from '../src/project/project-file.js';
import { createAssembly, createAssemblyDrawing } from '../src/project/assemblies.js';
import { numberParts, partStatus } from '../src/part-marks.js';
import { assemblyNumberStatus, planAssemblyNumbering } from '../src/assembly-numbering.js';
import {
  defaultNumberingSettings,
  planNumbering,
  applyNumbering,
  validateNumberingSettings,
} from '../src/numbering/plan.js';
const beam = (id, y = 0, x = 0) => ({
  id,
  name: 'IPE-liknande balk',
  type: 'sweep',
  profile: 'rect',
  width: 100,
  height: 200,
  thickness: 0,
  rotation: 0,
  start: [x, y, 0],
  end: [x + 1000, y, 0],
});
function fixture() {
  const state = createProject({
    grid: { x: [0, 1000], y: [0, 1000] },
    levels: { active: 'l', items: [{ id: 'l', name: 'Plan 1', elevation: 0 }] },
  });
  state.objects = [beam('a'), beam('b', 300), beam('c', 0, 3000), beam('d', 300, 3000)];
  state.assemblies = [createAssembly(state, ['a', 'b'], 'a', 'Balkpar', () => 'assembly-1')];
  state.assemblies.push(createAssembly(state, ['c', 'd'], 'c', 'Kopia', () => 'assembly-2'));
  return state;
}
const run = (state, settings) =>
  Object.assign(state, applyNumbering(planNumbering(state, settings), state));
const drawing = (state, id, number) => ({
  id: number,
  number,
  type: 'SP',
  name: number,
  sourceId: id,
  mark: state.parts.assignments[id].mark,
  partKey: state.parts.assignments[id].key,
  annotations: [],
});
test('preview groups equal parts and assemblies and does not assign numbers before confirmation', () => {
  const state = fixture(),
    before = structuredClone(state);
  const plan = planNumbering(state);
  assert.deepEqual(state, before);
  assert.deepEqual(
    plan.rows.map((r) => [r.kind, r.status, r.count]),
    [
      ['part', 'new', 4],
      ['assembly', 'new', 2],
    ],
  );
  assert.equal(plan.rows[0].previous, '—');
  assert.equal(plan.rows[0].proposed, 'B-001');
  const patch = applyNumbering(plan, state);
  assert.deepEqual(state, before);
  Object.assign(state, patch);
  assert.ok(state.objects.every((o) => partStatus(o, state.objects, state.parts).valid));
  assert.ok(state.assemblies.every((a) => assemblyNumberStatus(a, state).valid));
  assert.ok(planNumbering(state).rows.every((r) => r.status === 'unchanged'));
});
test('new series settings apply only to new types and preserve historical numbers', () => {
  const state = fixture();
  run(state);
  state.objects.push({ ...beam('new'), width: 150 });
  const settings = defaultNumberingSettings();
  settings.series.sweep = { prefix: 'SB', start: 101 };
  const plan = planNumbering(state, settings);
  assert.equal(plan.rows.find((r) => r.status === 'new').proposed, 'SB-101');
  assert.equal(
    plan.rows.find((r) => r.kind === 'part' && r.status === 'unchanged').proposed,
    'B-001',
  );
  const fresh = fixture();
  settings.series.assembly = { prefix: 'AS', start: 20 };
  assert.equal(
    planNumbering(fresh, settings).rows.find((r) => r.kind === 'assembly').proposed,
    'AS-020',
  );
});
test('existing assembly callers preserve provisional custom marks when no series is supplied', () => {
  const state = fixture();
  state.assemblies[0].mark = 'CUSTOM-010';
  assert.equal(planAssemblyNumbering(state).groups[0].mark, 'CUSTOM-010');
  assert.equal(planAssemblyNumbering(state, { prefix: 'AS', start: 101 }).groups[0].mark, 'AS-101');
});
test('changed geometry produces changed rows and a split drawing while preserving the old drawing', () => {
  const state = fixture();
  run(state);
  state.drawings = [drawing(state, 'a', 'SP-001')];
  state.objects[0].width = 140;
  const plan = planNumbering(state);
  assert.equal(
    plan.rows.find((r) => r.kind === 'part' && r.status === 'changed').previous,
    'B-001',
  );
  const next = applyNumbering(plan, state, undefined, () => 'cloned-drawing');
  assert.equal(next.drawings.length, 2);
  assert.equal(next.drawings.find((d) => d.id === 'SP-001').sourceId, 'b');
  assert.equal(next.drawings.find((d) => d.id === 'cloned-drawing').needsReview, true);
});
test('detail merge requires a drawing choice and preserves selected drawing content', () => {
  const state = fixture();
  state.objects[1].width = 140;
  state.parts = numberParts(state.objects);
  state.drawings = [drawing(state, 'a', 'SP-001'), drawing(state, 'b', 'SP-002')];
  state.drawings[1].annotations = [{ text: 'Behåll mig' }];
  state.objects[1].width = 100;
  const settings = { ...defaultNumberingSettings(), assemblies: false };
  const plan = planNumbering(state, settings);
  assert.equal(plan.conflicts.length, 1);
  assert.throws(() => applyNumbering(plan, state), /Välj ritning/);
  const next = applyNumbering(plan, state, {
    part: { [plan.conflicts[0].key]: 'SP-002' },
    assembly: {},
  });
  assert.equal(next.drawings.length, 1);
  assert.equal(next.drawings[0].id, 'SP-002');
  assert.deepEqual(next.drawings[0].annotations, [{ text: 'Behåll mig' }]);
});
test('assembly merge requires an explicit drawing choice', () => {
  const state = fixture();
  state.objects[2].width = 140;
  run(state);
  state.drawings = state.assemblies.map((a, i) =>
    createAssemblyDrawing(state, a.id, undefined, () => `as-${i}`),
  );
  state.objects[2].width = 100;
  const plan = planNumbering(state);
  const conflict = plan.conflicts.find((g) => g.kind === 'assembly');
  assert.ok(conflict);
  assert.throws(() => applyNumbering(plan, state), /Välj assemblyritning/);
  const next = applyNumbering(plan, state, { part: {}, assembly: { [conflict.key]: 'as-1' } });
  assert.equal(next.drawings.length, 1);
  assert.equal(next.drawings[0].id, 'as-1');
  assert.equal(next.drawings[0].needsReview, true);
});
test('detail-only and assembly-only runs preserve the other numbering state', () => {
  const state = fixture();
  const partsOnly = { ...defaultNumberingSettings(), assemblies: false };
  const next = applyNumbering(planNumbering(state, partsOnly), state);
  assert.deepEqual(next.assemblies, state.assemblies);
  assert.deepEqual(next.assemblyNumbering, state.assemblyNumbering);
  const assembliesOnly = { ...defaultNumberingSettings(), parts: false };
  assert.deepEqual(applyNumbering(planNumbering(state, assembliesOnly), state).parts, state.parts);
});
test('stale previews and invalid settings cannot be applied', () => {
  const state = fixture(),
    plan = planNumbering(state);
  state.objects[0].width = 150;
  assert.throws(() => applyNumbering(plan, state), /Förhandsgranska/);
  const settings = defaultNumberingSettings();
  settings.parts = settings.assemblies = false;
  assert.throws(() => validateNumberingSettings(settings), /Välj/);
  settings.parts = true;
  settings.series.sweep.start = 1.5;
  assert.throws(() => validateNumberingSettings(settings), /Startnummer/);
  settings.series.sweep.start = 1;
  settings.series.plate.prefix = '<script>';
  assert.throws(() => validateNumberingSettings(settings), /Prefix/);
});
test('numbering is a single reversible project change and survives save/load', () => {
  const state = fixture();
  Object.assign(state, applyNumbering(planNumbering(state), state));
  state.objects[0].width = 150;
  const before = structuredClone(state),
    history = new ProjectHistory(),
    plan = planNumbering(state);
  assert.ok(plan.rows.some((row) => row.status === 'changed' && row.ids.includes('a')));
  assert.deepEqual(state, before);
  history.prime(state);
  const patch = applyNumbering(plan, state);
  history.checkpoint(state);
  Object.assign(state, patch);
  const loaded = parseProjectFile(serializeProject(state));
  assert.deepEqual(loaded.parts, state.parts);
  assert.deepEqual(loaded.assemblyNumbering, state.assemblyNumbering);
  assert.deepEqual(loaded.objects, state.objects);
  assert.deepEqual(history.undo(state), before);
});
