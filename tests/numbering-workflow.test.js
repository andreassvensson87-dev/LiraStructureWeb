import test from 'node:test';
import assert from 'node:assert/strict';
import { createProject } from '../src/project/project-state.js';
import { ProjectHistory } from '../src/project/project-history.js';
import { parseProjectFile, serializeProject } from '../src/project/project-file.js';
import {
  createAssembly,
  updateAssembly,
  syncAssemblyDrawingIdentity,
} from '../src/project/assemblies.js';
import { defaultNumberingSettings, planNumbering, applyNumbering } from '../src/numbering/plan.js';
import { partStatus } from '../src/part-marks.js';
import { assemblyNumberStatus } from '../src/assembly-numbering.js';
import { drawingCreationGroups, createSelectedDrawings } from '../src/drawing-creation.js';
import { normalizePreset } from '../src/drawing-presets.js';
const preset = normalizePreset({});
function beam(id, start = 100, width = 100, x = 0, y = 0) {
  return {
    id,
    type: 'sweep',
    name: 'Balk',
    prefix: 'B',
    number: Number(id.replace(/\D/g, '')) + 1,
    profile: 'rect',
    width,
    height: 200,
    thickness: 0,
    rotation: 0,
    start: [x, y, 0],
    end: [x + 1000, y, 0],
    partSeries: { prefix: 'P', start },
    assemblySeries: { prefix: 'A', start: 1000 },
  };
}
function project(objects) {
  const state = createProject({
    grid: { x: [0, 6000], y: [0, 6000] },
    levels: { active: 'l', items: [{ id: 'l', name: 'Plan 1', elevation: 0 }] },
  });
  state.objects = objects;
  return state;
}
let uuid = 0;
function number(state, options = {}, choices = { part: {}, assembly: {} }) {
  const before = structuredClone(state),
    plan = planNumbering(state, { ...defaultNumberingSettings(), ...options });
  assert.deepEqual(state, before, 'preview must be read-only');
  Object.assign(
    state,
    applyNumbering(plan, state, choices, () => `drawing-${++uuid}`),
  );
  assert.ok(state.objects.every((o) => partStatus(o, state.objects, state.parts).valid));
  if (options.assemblies !== false)
    assert.ok(state.assemblies.every((a) => assemblyNumberStatus(a, state).valid));
  return plan;
}
function drawings(state) {
  const selected = new Set(state.objects.map((o) => o.id)),
    keys = new Set(drawingCreationGroups(state, selected).map((row) => row.key));
  state.drawings = createSelectedDrawings(
    state,
    selected,
    keys,
    preset,
    null,
    () => `drawing-${++uuid}`,
  );
  assert.ok(
    state.drawings.every((d) => d.name === d.mark),
    'drawing name must be the manufacturing mark',
  );
  assert.equal(
    new Set(state.drawings.map((d) => `${d.type}:${d.partKey ?? d.assemblyKey}`)).size,
    state.drawings.length,
  );
}
test('series start and progression are independent of model order and higher series', () => {
  for (const reverse of [false, true]) {
    const objects = [beam('o1', 100), beam('o2', 200), beam('o3', 3000)];
    const state = project(reverse ? objects.reverse() : objects);
    number(state);
    assert.equal(state.parts.assignments.o1.mark, 'P100');
    assert.equal(state.parts.assignments.o2.mark, 'P200');
    assert.equal(state.parts.assignments.o3.mark, 'P3000');
    state.objects.push(beam('o4', 100, 120), beam('o5', 200, 120), beam('o6', 3000, 120));
    number(state);
    assert.equal(state.parts.assignments.o4.mark, 'P101');
    assert.equal(state.parts.assignments.o5.mark, 'P201');
    assert.equal(state.parts.assignments.o6.mark, 'P3001');
  }
});
test('assembly series progress separately and equal parts and assemblies share marks', () => {
  const state = project([
    beam('o1'),
    beam('o2', 100, 100, 3000),
    beam('o3', 100, 120),
    beam('o4', 100, 140),
  ]);
  state.objects[0].assemblySeries.start = 2000;
  number(state);
  assert.equal(state.parts.assignments.o1.mark, state.parts.assignments.o2.mark);
  assert.equal(state.assemblies.find((a) => a.mainId === 'o1').mark, 'A2000');
  assert.equal(state.assemblies.find((a) => a.mainId === 'o2').mark, 'A1000');
  assert.equal(state.assemblies.find((a) => a.mainId === 'o3').mark, 'A1001');
  assert.equal(state.assemblies.find((a) => a.mainId === 'o4').mark, 'A1002');
  assert.ok(number(state).rows.every((row) => row.status === 'unchanged'));
});
test('assembly identity includes part marks, main part, count and placement', () => {
  const state = project([
    beam('o1'),
    beam('o2', 100, 120, 0, 300),
    beam('o3', 100, 100, 3000),
    beam('o4', 100, 120, 3000, 300),
  ]);
  state.assemblies = [
    createAssembly(state, ['o1', 'o2'], 'o1', 'Första', () => 'a1'),
    createAssembly(state, ['o3', 'o4'], 'o3', 'Andra', () => 'a2'),
  ];
  number(state);
  assert.equal(state.assemblies[0].mark, state.assemblies[1].mark);
  state.objects[3].partSeries.start = 200;
  assert.equal(assemblyNumberStatus(state.assemblies[1], state).valid, false);
  number(state);
  assert.notEqual(state.assemblies[0].mark, state.assemblies[1].mark);
  Object.assign(state, updateAssembly(state, 'a2', { ...state.assemblies[1], mainId: 'o4' }));
  assert.equal(assemblyNumberStatus(state.assemblies[1], state).valid, false);
  number(state);
  state.objects[3].start[1] += 10;
  state.objects[3].end[1] += 10;
  assert.equal(assemblyNumberStatus(state.assemblies[1], state).valid, false);
  number(state);
  Object.assign(state, updateAssembly(state, 'a2', { ...state.assemblies[1], memberIds: ['o4'] }));
  number(state);
  assert.equal(state.assemblies.length, 3, 'removed part becomes a singleton assembly');
});
test('drawing names track marks through creation, split, explicit merge and renumbering', () => {
  const state = project([beam('o1'), beam('o2', 100, 100, 3000)]);
  number(state);
  drawings(state);
  assert.equal(state.drawings.length, 2);
  const original = structuredClone(state.drawings);
  state.drawings.forEach((d) => (d.annotations = [{ comment: `Keep ${d.id}` }]));
  state.objects[0].width = 120;
  number(state);
  assert.equal(state.drawings.length, 4);
  assert.ok(state.drawings.every((d) => d.name === d.mark));
  assert.equal(new Set(state.drawings.map((d) => d.id)).size, 4);
  assert.ok(
    original.every((old) => state.drawings.some((d) => d.id === old.id && d.mark === old.mark)),
  );
  const split = state.drawings.find((d) => d.type === 'SP' && d.sourceId === 'o1');
  split.annotations[0].comment = 'Keep chosen split';
  state.objects[0].width = 100;
  const options = defaultNumberingSettings(),
    plan = planNumbering(state, options);
  assert.equal(plan.conflicts.length, 2);
  assert.throws(() => applyNumbering(plan, state), /Välj ritning/);
  const choices = { part: {}, assembly: {} };
  for (const conflict of plan.conflicts)
    choices[conflict.kind][conflict.key] = conflict.candidates.find((d) => d.sourceId === 'o1').id;
  Object.assign(state, applyNumbering(plan, state, choices));
  assert.equal(state.drawings.length, 2);
  assert.ok(state.drawings.every((d) => d.name === d.mark));
  assert.equal(
    state.drawings.find((d) => d.type === 'SP').annotations[0].comment,
    'Keep chosen split',
  );
  state.objects.forEach((o) => {
    o.partSeries.start = 500;
    o.assemblySeries.start = 600;
  });
  state.assemblies.forEach((a) => (a.series = { prefix: 'A', start: 600 }));
  number(state, { renumberAll: true });
  assert.deepEqual(state.drawings.map((d) => d.name).sort(), ['A600', 'P500']);
});
test('free numbers, historical matching and force-new modified parts behave differently', () => {
  const base = project([beam('o1'), beam('o2', 100, 120)]);
  number(base, { assemblies: false });
  base.objects = [beam('o2', 100, 120), beam('o3', 100, 140)];
  const recycled = structuredClone(base);
  number(recycled, { assemblies: false, reuseOldNumbers: true });
  assert.equal(recycled.parts.assignments.o3.mark, 'P100');
  const fresh = structuredClone(base);
  number(fresh, { assemblies: false });
  assert.equal(fresh.parts.assignments.o3.mark, 'P102');
  fresh.objects = [beam('o3')];
  const compare = structuredClone(fresh);
  number(compare, { assemblies: false });
  assert.equal(compare.parts.assignments.o3.mark, 'P100');
  number(fresh, { assemblies: false, modifiedParts: 'new' });
  assert.equal(fresh.parts.assignments.o3.mark, 'P103');
});
test('dimension tolerance does not combine distinct material or series, and does not drift', () => {
  const state = project([
    beam('o1'),
    beam('o2', 100, 100.8),
    beam('o3', 100, 102.4),
    beam('o4', 200, 100.1),
    beam('o5', 100, 100.1),
  ]);
  state.objects[4].material = { name: 'Annat stål', density: 7850 };
  number(state, { tolerance: 1, assemblyTolerance: 1 });
  assert.equal(state.parts.assignments.o1.mark, state.parts.assignments.o2.mark);
  const marks = ['o1', 'o3', 'o4', 'o5'].map((id) => state.parts.assignments[id].mark);
  assert.equal(new Set(marks).size, 4);
});
test('marks and drawing names survive project files and undo/redo without mutating preview', () => {
  const state = project([beam('o1'), beam('o2', 200)]);
  number(state);
  drawings(state);
  const before = structuredClone(state),
    history = new ProjectHistory();
  history.prime(state);
  history.checkpoint(state);
  state.objects.forEach((o) => (o.partSeries.start += 500));
  number(state);
  const loaded = parseProjectFile(serializeProject(state));
  assert.deepEqual(loaded.drawings, state.drawings);
  const undone = history.undo(state);
  assert.deepEqual(undone, before);
  assert.deepEqual(history.redo(undone), state);
});
test('legacy drawing names upgrade to marks and assembly descriptive names remain separate', () => {
  const state = project([beam('o1')]);
  number(state);
  drawings(state);
  state.drawings.forEach((d) => (d.name = 'Old descriptive drawing name'));
  state.drawings = syncAssemblyDrawingIdentity(state);
  assert.ok(state.drawings.every((d) => d.name === d.mark));
  Object.assign(
    state,
    updateAssembly(state, state.assemblies[0].id, {
      ...state.assemblies[0],
      name: 'Fasad i byggnad 1',
    }),
  );
  assert.equal(state.assemblies[0].name, 'Fasad i byggnad 1');
  assert.equal(state.drawings.find((d) => d.type === 'AS').name, state.assemblies[0].mark);
});
