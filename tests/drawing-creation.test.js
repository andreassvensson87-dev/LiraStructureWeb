import test from 'node:test';
import assert from 'node:assert/strict';
import { createProject } from '../src/project/project-state.js';
import { createAssembly } from '../src/project/assemblies.js';
import { numberParts } from '../src/part-marks.js';
import { planAssemblyNumbering, applyAssemblyNumbering } from '../src/assembly-numbering.js';
import { drawingCreationGroups, createSelectedDrawings } from '../src/drawing-creation.js';
import { normalizePreset } from '../src/drawing-presets.js';
const preset = normalizePreset({ font: 'Georgia, serif', dimensionSize: 3 });
function fixture(numbered = true) {
  const state = createProject({
    grid: { x: [0, 1000], y: [0, 1000] },
    levels: { active: 'l', items: [{ id: 'l', name: 'Plan', elevation: 0 }] },
  });
  const beam = (id, x, y) => ({
    id,
    name: id,
    type: 'sweep',
    profile: 'rect',
    width: 100,
    height: 200,
    thickness: 10,
    rotation: 0,
    start: [x, y, 0],
    end: [x + 1000, y, 0],
  });
  state.objects = [beam('a', 0, 0), beam('b', 0, 300), beam('c', 2000, 0), beam('d', 2000, 300)];
  state.assemblies.push(createAssembly(state, ['a', 'b'], 'a', 'Par', () => 'one'));
  state.assemblies.push(createAssembly(state, ['c', 'd'], 'c', 'Kopia', () => 'two'));
  if (numbered) {
    state.parts = numberParts(state.objects);
    Object.assign(state, applyAssemblyNumbering(planAssemblyNumbering(state)));
  }
  return state;
}
test('common creation list has one row per type and independent type filters', () => {
  const state = fixture(),
    selection = new Set(state.objects.map((o) => o.id)),
    rows = drawingCreationGroups(state, selection);
  assert.deepEqual(
    rows.map((r) => r.type),
    ['SP', 'AS'],
  );
  assert.equal(rows[0].objects.length, 4);
  assert.equal(rows[1].all.length, 2);
  assert.equal(rows[1].assemblyIds.length, 2);
  assert.ok(rows.every((r) => r.valid));
  assert.equal(new Set(rows.map((r) => r.key)).size, 2);
  assert.deepEqual(
    drawingCreationGroups(state, selection, 'AS').map((r) => r.type),
    ['AS'],
  );
  assert.deepEqual(
    drawingCreationGroups(state, selection, 'SP').map((r) => r.type),
    ['SP'],
  );
});
test('selected member includes its assembly and counts selected instances separately from model', () => {
  const state = fixture(),
    rows = drawingCreationGroups(state, new Set(['b']));
  assert.equal(rows[0].objects.length, 1);
  assert.equal(rows[0].all.length, 4);
  assert.deepEqual(rows[1].assemblyIds, ['one']);
  assert.equal(rows[1].objects.length, 2);
  assert.equal(rows[1].all.length, 2);
  assert.deepEqual(drawingCreationGroups(state, new Set()), []);
});
test('mixed batch creates one drawing of each type, keeps preset and avoids duplicates atomically', () => {
  const state = fixture(),
    selection = new Set(state.objects.map((o) => o.id)),
    keys = new Set(drawingCreationGroups(state, selection).map((g) => g.key));
  const before = JSON.stringify(state);
  let id = 0;
  const drawings = createSelectedDrawings(state, selection, keys, preset, null, () => String(++id));
  assert.equal(JSON.stringify(state), before);
  assert.deepEqual(
    drawings.map((d) => d.type),
    ['SP', 'AS'],
  );
  assert.equal(drawings[1].number, state.assemblies[0].mark);
  assert.ok(drawings.every((d) => d.typography.font === 'Georgia, serif'));
  state.drawings = drawings;
  assert.ok(drawingCreationGroups(state, selection).every((g) => g.drawing));
  assert.equal(createSelectedDrawings(state, selection, keys, preset).length, 2);
});
test('filtered keys create only requested types; unnumbered or missing assemblies cannot create drawings', () => {
  const state = fixture(),
    selection = new Set(['a', 'b']);
  const keys = new Set(drawingCreationGroups(state, selection, 'AS').map((g) => g.key));
  assert.deepEqual(
    createSelectedDrawings(state, selection, keys, preset).map((d) => d.type),
    ['AS'],
  );
  const stale = fixture(false),
    groups = drawingCreationGroups(stale, selection);
  assert.ok(groups.every((g) => !g.valid));
  assert.deepEqual(
    createSelectedDrawings(stale, selection, new Set(groups.map((g) => g.key)), preset),
    [],
  );
  state.objects = state.objects.filter((o) => o.id !== 'b');
  assert.equal(drawingCreationGroups(state, new Set(['a']), 'AS')[0].valid, false);
});
test('single-part templates never attach to assembly records in a mixed batch', () => {
  const state = fixture(),
    selection = new Set(['a']),
    keys = new Set(drawingCreationGroups(state, selection).map((g) => g.key));
  const template = {
    id: 'template',
    typography: { font: 'Arial, sans-serif' },
    drawingPreset: preset,
  };
  let id = 0;
  const drawings = createSelectedDrawings(state, selection, keys, preset, template, () =>
    String(++id),
  );
  assert.equal(drawings[0].template.id, 'template');
  assert.equal(drawings[0].typography.font, 'Arial, sans-serif');
  assert.equal(drawings[1].template, undefined);
  assert.equal(drawings[1].typography.font, 'Georgia, serif');
});
