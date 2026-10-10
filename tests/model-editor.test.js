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
