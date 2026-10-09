import test from 'node:test';
import assert from 'node:assert/strict';
import { createProject } from '../src/project/project-state.js';
import { serializeProject, parseProjectFile } from '../src/project/project-file.js';
import { ProjectHistory } from '../src/project/project-history.js';
import {
  createAssembly,
  createAssemblyDrawing,
  updateAssembly,
  removeAssembly,
} from '../src/project/assemblies.js';
import {
  assemblyKey,
  planAssemblyNumbering,
  applyAssemblyNumbering,
  drawingAssemblies,
  resolveAssemblyDrawing,
} from '../src/assembly-numbering.js';
import { numberParts } from '../src/part-marks.js';
import { rotateObject } from '../src/rotation.js';
import { drawingAttributeContext } from '../src/drawing-attributes.js';

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
function fixture() {
  const state = createProject({
    grid: { x: [0, 1000], y: [0, 1000] },
    levels: { active: 'l', items: [{ id: 'l', name: 'Plan', elevation: 0 }] },
  });
  state.objects = [beam('a', 0, 0), beam('b', 0, 300), beam('c', 3000, 0), beam('d', 3000, 300)];
  state.parts = numberParts(state.objects);
  state.assemblies.push(createAssembly(state, ['a', 'b'], 'a', 'Balkpar', () => 'one'));
  state.assemblies.push(createAssembly(state, ['c', 'd'], 'c', 'Kopia', () => 'two'));
  return state;
}
const number = (state, choices) =>
  Object.assign(
    state,
    applyAssemblyNumbering(planAssemblyNumbering(state), choices, () => 'copy'),
  );
const draw = (state, id = 'one') =>
  state.drawings.push(createAssemblyDrawing(state, id, {}, () => 'drawing'));

test('assembly identity ignores IDs, order, translation and whole-group rotation', () => {
  const state = fixture(),
    key = assemblyKey(state.assemblies[0], state.objects);
  assert.equal(assemblyKey(state.assemblies[1], state.objects), key);
  state.assemblies[1].memberIds.reverse();
  state.objects = state.objects.map((o) =>
    ['c', 'd'].includes(o.id) ? rotateObject(o, [3000, 0, 0], [0, 0, 1], 37) : o,
  );
  assert.equal(assemblyKey(state.assemblies[1], state.objects), key);
  for (const axis of [
    [1, 0, 0],
    [0, 1, 0],
  ]) {
    state.objects = state.objects.map((o) =>
      ['c', 'd'].includes(o.id) ? rotateObject(o, [3000, 0, 0], axis, 51) : o,
    );
    assert.equal(assemblyKey(state.assemblies[1], state.objects), key);
  }
  state.objects[3].width += 1;
  assert.notEqual(assemblyKey(state.assemblies[1], state.objects), key);
});
test('relative placement, main part and member orientation distinguish assembly types', () => {
  const state = fixture(),
    before = assemblyKey(state.assemblies[1], state.objects);
  state.objects[3].start[1] += 10;
  state.objects[3].end[1] += 10;
  assert.notEqual(assemblyKey(state.assemblies[1], state.objects), before);
  const other = fixture();
  other.assemblies[1].mainId = 'd';
  assert.notEqual(assemblyKey(other.assemblies[1], other.objects), before);
  const rotated = fixture();
  rotated.objects[3].rotation = 90;
  assert.notEqual(assemblyKey(rotated.assemblies[1], rotated.objects), before);
});
test('equal assemblies share number, name, drawing and quantity through file/history', () => {
  const state = fixture();
  number(state);
  draw(state);
  assert.equal(state.assemblies[0].mark, state.assemblies[1].mark);
  assert.equal(state.assemblies[1].name, 'Balkpar');
  assert.throws(() => createAssemblyDrawing(state, 'two', {}), /redan/);
  assert.equal(drawingAttributeContext(state.drawings[0], state).drawing.assemblyQuantity, 2);
  const loaded = parseProjectFile(serializeProject(state));
  assert.deepEqual(loaded.assemblyNumbering, state.assemblyNumbering);
  assert.equal(loaded.drawings.length, 1);
  const history = new ProjectHistory();
  history.checkpoint(state);
  Object.assign(state, removeAssembly(state, 'one'));
  assert.equal(state.drawings[0].assemblyId, 'two');
  assert.equal(history.undo(state).assemblies.length, 2);
});
test('split keeps unchanged drawing and copies edits independently to a new reserved number', () => {
  const state = fixture();
  number(state);
  draw(state);
  state.drawings[0].annotations = [
    { sourceId: 'b', references: [{ source: 'b' }], points: [[1, 2]] },
  ];
  state.drawings[0].reviewed = 'reviewed';
  state.objects[3].width = 150;
  state.parts = numberParts(state.objects, state.parts);
  number(state);
  assert.equal(state.assemblies[0].mark, 'A-001');
  assert.equal(state.assemblies[1].mark, 'A-002');
  assert.equal(state.drawings.length, 2);
  assert.equal(state.drawings[0].id, 'drawing');
  assert.equal(state.drawings[1].id, 'copy');
  assert.equal(state.drawings[1].needsReview, true);
  assert.equal(state.drawings[1].reviewed, undefined);
  state.drawings[1].annotations[0].points[0][0] = 50;
  assert.equal(state.drawings[0].annotations[0].points[0][0], 1);
  parseProjectFile(serializeProject(state));
});
test('merging edited drawings requires an explicit choice and retains chosen edits', () => {
  const state = fixture();
  state.drawings = state.assemblies.map((a, i) =>
    createAssemblyDrawing(state, a.id, {}, () => `d${i}`),
  );
  state.drawings[1].annotations = [{ comment: 'Keep this', points: [[3, 4]] }];
  const before = JSON.stringify(state),
    plan = planAssemblyNumbering(state);
  assert.throws(() => applyAssemblyNumbering(plan), /Välj/);
  assert.equal(JSON.stringify(state), before);
  Object.assign(state, applyAssemblyNumbering(plan, { [plan.groups[0].key]: 'd1' }));
  assert.equal(state.drawings.length, 1);
  assert.equal(state.drawings[0].id, 'd1');
  assert.equal(state.drawings[0].annotations[0].comment, 'Keep this');
  assert.equal(state.drawings[0].number, state.assemblies[0].mark);
});
test('shared drawing follows surviving representative and member references', () => {
  const state = fixture();
  number(state);
  draw(state);
  state.drawings[0].annotations = [
    { sourceId: 'b', references: [{ source: 'a' }, { source: 'b' }] },
  ];
  Object.assign(state, removeAssembly(state, 'one'));
  assert.equal(state.drawings[0].sourceId, 'c');
  assert.equal(state.drawings[0].annotations[0].sourceId, 'd');
  assert.deepEqual(state.drawings[0].annotations[0].references, [{ source: 'c' }, { source: 'd' }]);
  Object.assign(state, removeAssembly(state, 'two'));
  assert.equal(state.drawings.length, 0);
});
test('renaming a shared type updates all names; editing representative preserves shared drawing', () => {
  const state = fixture();
  number(state);
  draw(state);
  Object.assign(state, updateAssembly(state, 'one', { ...state.assemblies[0], name: 'Nytt namn' }));
  assert.ok(state.assemblies.every((a) => a.name === 'Nytt namn'));
  assert.equal(state.drawings[0].name, state.assemblies[0].mark);
  Object.assign(state, updateAssembly(state, 'one', { ...state.assemblies[0], mainId: 'b' }));
  assert.equal(state.drawings[0].assemblyId, 'two');
  parseProjectFile(serializeProject(state));
  number(state);
  assert.equal(state.drawings.length, 2);
});
test('stale and missing assemblies are not counted as valid instances', () => {
  const state = fixture();
  number(state);
  draw(state);
  state.objects[1].width = 140;
  assert.equal(drawingAssemblies(state.drawings[0], state).length, 1);
  assert.equal(resolveAssemblyDrawing(state.drawings[0], state).assemblyId, 'two');
  state.objects = state.objects.filter((o) => o.id !== 'd');
  assert.equal(resolveAssemblyDrawing(state.drawings[0], state), null);
  assert.equal(planAssemblyNumbering(state).groups.length, 1);
});
test('files reject duplicate assembly numbers across distinct types and duplicate type drawings', () => {
  const state = fixture();
  state.objects[3].width = 150;
  state.parts = numberParts(state.objects);
  number(state);
  state.assemblies[1].mark = state.assemblies[0].mark;
  assert.throws(() => serializeProject(state), /assembly/);
  const duplicate = fixture();
  number(duplicate);
  draw(duplicate);
  duplicate.drawings.push({ ...duplicate.drawings[0], id: 'duplicate' });
  assert.throws(() => serializeProject(duplicate), /assemblyritning/);
});

test('a split with a different main preserves existing paper projection and maps instance references', async () => {
  const { Vector3 } = await import('three');
  const { assemblyDrawingMatrix } = await import('../src/assembly-frames.js');
  const { frameMatrix } = await import('../src/drawing-sections.js');
  const { partViewFrame } = await import('../src/part-view-frame.js');
  const state = fixture();
  number(state);
  draw(state, 'two');
  state.drawings[0].sheet = {
    views: [{ id: 'front', projection: 'front', source: { objectId: 'c' } }],
  };
  state.drawings[0].annotations = [{ sourceId: 'c', references: [{ source: 'd' }] }];
  const oldPoint = new Vector3(200, 50, 100)
    .applyMatrix4(assemblyDrawingMatrix(state.objects[0]))
    .applyMatrix4(frameMatrix(partViewFrame('front')));
  Object.assign(state, updateAssembly(state, 'one', { ...state.assemblies[0], mainId: 'b' }));
  number(state);
  const split = state.drawings.find((d) => d.assemblyId === 'one');
  assert.equal(split.annotations[0].sourceId, 'a');
  assert.equal(split.annotations[0].references[0].source, 'b');
  const projected = new Vector3(200, 50, 100)
    .applyMatrix4(assemblyDrawingMatrix(state.objects[1]))
    .applyMatrix4(frameMatrix(split.sheet.views[0].assemblyFrame));
  assert.ok(projected.distanceTo(oldPoint) < 1e-8);
});

test('legacy assembly renaming keeps drawing names equal to assembly marks', () => {
  const state = fixture();
  state.drawings = state.assemblies.map((a, i) =>
    createAssemblyDrawing(state, a.id, {}, () => `d${i}`),
  );
  Object.assign(state, updateAssembly(state, 'one', { ...state.assemblies[0], name: 'Ny' }));
  assert.equal(state.drawings[0].name, state.assemblies[0].mark);
  assert.equal(state.drawings[1].name, state.assemblies[1].mark);
});
test('assembly numbering and drawing merges undo and redo atomically', () => {
  let state = fixture();
  state.drawings = state.assemblies.map((a, i) =>
    createAssemblyDrawing(state, a.id, {}, () => `d${i}`),
  );
  const history = new ProjectHistory();
  history.checkpoint(state);
  const plan = planAssemblyNumbering(state);
  Object.assign(state, applyAssemblyNumbering(plan, { [plan.groups[0].key]: 'd0' }));
  state = history.undo(state);
  assert.equal(state.drawings.length, 2);
  assert.deepEqual(state.assemblyNumbering.registry, []);
  assert.equal(state.assemblies[1].mark, 'A-002');
  state = history.redo(state);
  assert.equal(state.drawings.length, 1);
  assert.equal(state.assemblyNumbering.registry.length, 1);
  assert.equal(state.assemblies[1].mark, 'A-001');
});
