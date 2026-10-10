import test from 'node:test';
import assert from 'node:assert/strict';
import { syncGridObjects } from '../src/model/grid-objects.js';
import { gridSegments } from '../src/grid-geometry.js';
import { createProject } from '../src/project/project-state.js';
import { initialLevels } from '../src/levels.js';
import { defaultGrid } from '../src/grid-lines.js';
import { isPhysical, validateObject, objectAnchors } from '../src/model-object.js';
import { applyObjectBatch, transformCandidates } from '../src/model/tools/transform-tool.js';
import { moveGripPoints } from '../src/model/grips.js';
import { serializeProject, parseProjectFile } from '../src/project/project-file.js';
import { ProjectHistory } from '../src/project/project-history.js';

const fixture = () => {
  const p = createProject({ grid: defaultGrid, levels: initialLevels() });
  syncGridObjects(p);
  return p;
};
test('legacy grids become independent nonphysical objects without changing endpoints or labels', () => {
  const p = createProject({ grid: defaultGrid, levels: initialLevels() });
  const old = gridSegments(p.grid);
  syncGridObjects(p);
  assert.equal(p.objects.length, 6);
  for (const [i, object] of p.objects.entries()) {
    assert.equal(object.name, old[i].label);
    assert.deepEqual(
      objectAnchors(object).map((p) => p.slice(0, 2)),
      [old[i].start, old[i].end],
    );
    assert.equal(isPhysical(object), false);
    assert.equal(validateObject(object), '');
  }
  const snapshot = JSON.stringify(p);
  syncGridObjects(p);
  assert.equal(JSON.stringify(p), snapshot);
});
test('regular move, copy and grip tools update the owning grid objects', () => {
  const p = fixture(),
    s = p.objects[0];
  const batch = transformCandidates({ mode: 'move', sources: [s] }, [0, 0, 0], [1234, 567, 0]);
  p.objects = applyObjectBatch(p.objects, batch).objects;
  syncGridObjects(p);
  assert.deepEqual(p.grid.lines.x[0].start, [1234, -933]);
  const result = applyObjectBatch(p.objects, [p.objects[0]], {
    copy: true,
    newId: () => 'copied-grid',
  });
  p.objects = result.objects;
  syncGridObjects(p);
  assert.equal(p.objects.at(-1).name, '4');
  assert.equal(p.grid.lines.x.at(-1).id, 'copied-grid');
  p.objects = applyObjectBatch(
    p.objects,
    moveGripPoints([p.objects[0]], [{ id: s.id, kind: 'end' }], [2000, 9000, 0]),
  ).objects;
  syncGridObjects(p);
  assert.deepEqual(p.grid.lines.x[0].end, [2000, 9000]);
  assert.equal(validateObject(p.objects[0]), '');
});
test('deleted lines stay deleted including the last line of a series; save/load keeps identities', () => {
  const p = fixture();
  p.objects = p.objects.filter((s) => s.gridAxis !== 'x');
  syncGridObjects(p);
  assert.equal(p.grid.x.length, 0);
  const loaded = parseProjectFile(serializeProject(p));
  syncGridObjects(loaded);
  assert.equal(loaded.objects.length, 3);
  assert.deepEqual(loaded.grid, p.grid);
});
test('grid object edits undo and redo through ordinary project history', () => {
  const p = fixture(),
    history = new ProjectHistory();
  history.prime(p);
  history.checkpoint(p);
  p.objects = p.objects.map((s, i) => (i === 0 ? { ...s, name: 'S1', end: [4500, 9500, 0] } : s));
  syncGridObjects(p);
  const edited = structuredClone(p);
  const previous = history.undo(p);
  Object.assign(p, previous);
  syncGridObjects(p);
  assert.equal(p.objects[0].name, '1');
  Object.assign(p, history.redo(p));
  syncGridObjects(p);
  assert.deepEqual(p, edited);
});
