import test from 'node:test';
import assert from 'node:assert/strict';
import { createModelEditor } from '../src/app/model-editor.js';
import { createProject } from '../src/project/project-state.js';
import { ProjectHistory } from '../src/project/project-history.js';
import { initialLevels } from '../src/levels.js';
import { defaultGrid } from '../src/grid-lines.js';
import { syncGridObjects } from '../src/model/grid-objects.js';
import { transformCandidates } from '../src/model/tools/transform-tool.js';

function fixture() {
  const project = createProject({ grid: defaultGrid, levels: initialLevels() });
  syncGridObjects(project);
  const history = new ProjectHistory();
  let checkpoints = 0;
  const editor = createModelEditor({
    project,
    checkpoint() {
      checkpoints++;
      history.checkpoint(project);
    },
  });
  return { project, history, editor, count: () => checkpoints };
}
test('model commands prepare without mutation and commit one undo step for a complete batch', () => {
  const f = fixture(),
    before = structuredClone(f.project);
  const sources = f.project.objects.slice(0, 2);
  const result = f.editor.prepare(
    transformCandidates({ mode: 'move', sources }, [0, 0, 0], [500, 200, 0]),
  );
  assert.deepEqual(f.project, before);
  assert.equal(f.count(), 0);
  f.editor.replace(result.objects);
  assert.equal(f.count(), 1);
  assert.equal(f.project.objects[0].start[0], 500);
  assert.equal(f.project.objects[1].start[0], 3500);
  const committed = structuredClone(f.project);
  Object.assign(f.project, f.history.undo(f.project));
  assert.deepEqual(f.project, before);
  Object.assign(f.project, f.history.redo(f.project));
  assert.deepEqual(f.project, committed);
});
test('invalid or stale commands leave both model and undo/redo untouched', () => {
  const f = fixture(),
    source = f.project.objects[0];
  f.editor.update([{ ...source, name: 'S1' }]);
  Object.assign(f.project, f.history.undo(f.project));
  const before = structuredClone(f.project),
    count = f.count();
  assert.throws(() => f.editor.update([{ ...source, end: source.start }]), /minst 1 mm/);
  assert.throws(() => f.editor.update([{ ...source, id: 'missing' }]), /finns inte/);
  assert.throws(() => f.editor.add([source]), /unika/);
  assert.deepEqual(f.project, before);
  assert.equal(f.count(), count);
  assert.equal(f.history.canRedo, true);
  assert.equal(f.editor.replace(f.project.objects), false);
  assert.equal(f.count(), count);
});

test('copy series prepares every batch before one commit; a later invalid copy leaves project and history intact', () => {
  const f = fixture(),
    before = structuredClone(f.project),
    source = f.project.objects[0];
  const batch = (x) =>
    transformCandidates({ mode: 'copy', sources: [source] }, [0, 0, 0], [x, 0, 0]);
  assert.throws(
    () => f.editor.prepareCopySeries([batch(100), [{ ...source, end: source.start }]]),
    /minst 1 mm/,
  );
  assert.deepEqual(f.project, before);
  assert.equal(f.count(), 0);
  const result = f.editor.prepareCopySeries([batch(100), batch(200), batch(300)]);
  assert.equal(f.count(), 0);
  assert.deepEqual(f.project, before);
  assert.equal(new Set(result.ids).size, 3);
  assert.equal(result.objects.length, before.objects.length + 3);
  f.editor.replace(result.objects);
  assert.equal(f.count(), 1);
  assert.deepEqual(f.history.undo(f.project), before);
});
