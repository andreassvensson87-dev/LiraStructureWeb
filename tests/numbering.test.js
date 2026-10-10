import test from 'node:test';
import assert from 'node:assert/strict';
import { createProject } from '../src/project/project-state.js';
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
  assert.equal(plan.rows[0].proposed, 'B1');
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
  state.objects.at(-1).partSeries = { prefix: 'SB', start: 101 };
  const plan = planNumbering(state, settings);
  assert.equal(plan.rows.find((r) => r.status === 'new').proposed, 'SB101');
  assert.equal(plan.rows.find((r) => r.kind === 'part' && r.status === 'unchanged').proposed, 'B1');
  const fresh = fixture();
  for (const object of fresh.objects) object.assemblySeries = { prefix: 'AS', start: 20 };
  assert.equal(
    planNumbering(fresh, settings).rows.find((r) => r.kind === 'assembly').proposed,
    'AS20',
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
  assert.equal(plan.rows.find((r) => r.kind === 'part' && r.status === 'changed').previous, 'B1');
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
  assert.throws(() => planNumbering(state, assembliesOnly), /Numrera detaljerna först/);
  Object.assign(state, next);
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

test('per-object series separate equal parts and feed assembly part marks', () => {
  const state = fixture();
  for (const object of state.objects)
    object.partSeries = { prefix: 'P', start: object.id === 'c' || object.id === 'd' ? 200 : 100 };
  run(state);
  assert.equal(state.parts.assignments.a.mark, 'P100');
  assert.equal(state.parts.assignments.c.mark, 'P200');
  assert.notEqual(state.assemblies[0].mark, state.assemblies[1].mark);
  assert.ok(state.assemblies.every((a) => assemblyNumberStatus(a, state).valid));
  state.objects[0].partSeries.start = 300;
  assert.equal(partStatus(state.objects[0], state.objects, state.parts).valid, false);
  assert.equal(assemblyNumberStatus(state.assemblies[0], state).valid, false);
  const plan = planNumbering(state);
  assert.ok(plan.rows.some((r) => r.kind === 'assembly' && r.status === 'changed'));
});
test('tolerances compare to a representative and preserve assembly marks', () => {
  const state = fixture(),
    settings = { ...defaultNumberingSettings(), tolerance: 1, assemblyTolerance: 1 };
  run(state, settings);
  const original = state.assemblies[0].mark;
  state.objects[0].end[0] += 0.5;
  assert.ok(partStatus(state.objects[0], state.objects, state.parts).valid);
  assert.ok(assemblyNumberStatus(state.assemblies[0], state).valid);
  run(state, settings);
  assert.equal(state.assemblies[0].mark, original);
  state.objects[0].end[0] += 1;
  assert.equal(partStatus(state.objects[0], state.objects, state.parts).valid, false);
});
test('recycling, new-only allocation and renumber-all have distinct effects', () => {
  const state = fixture();
  state.assemblies = [];
  state.objects = [beam('a'), { ...beam('b'), width: 140 }];
  run(state);
  state.assemblies = [];
  state.objects = [
    { ...beam('b'), width: 140 },
    { ...beam('c'), width: 180 },
  ];
  const recycled = planNumbering(state, { ...defaultNumberingSettings(), reuseOldNumbers: true });
  assert.equal(recycled.parts.parts.assignments.c.mark, 'B1');
  assert.equal(planNumbering(state).parts.parts.assignments.c.mark, 'B3');
  const reset = planNumbering(state, { ...defaultNumberingSettings(), renumberAll: true });
  assert.equal(reset.parts.parts.assignments.b.mark, 'B1');
  assert.equal(reset.parts.parts.assignments.c.mark, 'B2');
});
test('overlapping series never allocate duplicate marks', () => {
  const state = fixture();
  state.assemblies = [];
  state.objects = [beam('a'), { ...beam('b'), width: 140 }];
  state.objects[0].partSeries = { prefix: 'P', start: 100 };
  state.objects[1].partSeries = { prefix: 'P', start: 100 };
  run(state);
  assert.deepEqual(
    Object.values(state.parts.assignments).map((a) => a.mark),
    ['P100', 'P101'],
  );
  const loaded = parseProjectFile(serializeProject(state));
  assert.deepEqual(loaded.objects[0].partSeries, { prefix: 'P', start: 100 });
});

test('new-only policy avoids historical types but keeps active equal parts together', () => {
  const state = fixture();
  state.assemblies = [];
  state.objects = [beam('a')];
  run(state);
  state.objects = [{ ...beam('b'), width: 150 }];
  state.assemblies = [];
  run(state);
  state.objects.push(beam('c'), beam('d', 200));
  const compare = planNumbering(state);
  assert.equal(compare.parts.parts.assignments.c.mark, 'B1');
  const fresh = planNumbering(state, { ...defaultNumberingSettings(), newParts: 'new' });
  assert.equal(fresh.parts.parts.assignments.c.mark, 'B3');
  assert.equal(fresh.parts.parts.assignments.d.mark, 'B3');
  Object.assign(state, applyNumbering(fresh, state));
  run(state);
  assert.equal(state.parts.assignments.c.mark, 'B3');
});
test('cross-section tolerances and optional name comparison affect part groups', () => {
  const state = fixture();
  state.assemblies = [];
  state.objects = [beam('a'), { ...beam('b'), width: 100.5, name: 'Annat namn' }];
  const settings = { ...defaultNumberingSettings(), tolerance: 1 };
  const equal = planNumbering(state, settings);
  assert.equal(equal.parts.parts.assignments.a.mark, equal.parts.parts.assignments.b.mark);
  const named = planNumbering(state, { ...settings, compareNames: true });
  assert.notEqual(named.parts.parts.assignments.a.mark, named.parts.parts.assignments.b.mark);
});
test('assembly series comes from the main part and survives save/load', () => {
  const state = fixture();
  state.objects[0].assemblySeries = { prefix: 'AS', start: 3000 };
  state.objects[2].assemblySeries = { prefix: 'AS', start: 4000 };
  run(state);
  assert.deepEqual(
    state.assemblies.map((a) => a.mark),
    ['AS3000', 'AS4000'],
  );
  const loaded = parseProjectFile(serializeProject(state));
  assert.ok(loaded.assemblies.every((a) => assemblyNumberStatus(a, loaded).valid));
});

test('legacy drawing workflows respect the saved object numbering rules', () => {
  const state = fixture();
  state.objects[0].partSeries = { prefix: 'P', start: 100 };
  run(state);
  const parts = numberParts(state.objects, state.parts);
  assert.equal(parts.assignments.a.mark, 'P100');
  assert.ok(state.objects.every((o) => partStatus(o, state.objects, parts).valid));
  const assemblies = planAssemblyNumbering(state);
  assert.deepEqual(
    assemblies.groups.map((g) => g.mark),
    state.assemblies.map((a) => a.mark),
  );
});
