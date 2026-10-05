import test from 'node:test';
import assert from 'node:assert/strict';
import { createProject, captureProject } from '../src/project/project-state.js';
import { ProjectHistory } from '../src/project/project-history.js';

const fixture = () => {
  const project = createProject({ grid: {}, levels: {} });
  const spec = { diameter: 20, head: { height: 12 } };
  project.objects = [
    { id: 'a', start: [1, 2, 3], spec, holes: [{ id: 'h', diameter: 22 }] },
    { id: 'b', start: [4, 5, 6], spec },
  ];
  return project;
};

test('history reuses owned unchanged records and keeps live data mutable and detached', () => {
  let project = fixture();
  const history = new ProjectHistory();
  history.prime(project);
  assert.equal(history.canUndo, false);
  history.checkpoint(project);
  const untouched = project.objects[1];
  project.objects = [{ ...project.objects[0], start: [10, 2, 3] }, untouched];
  history.checkpoint(project);
  assert.equal(history.past[0].objects[1], history.past[1].objects[1]);
  assert.notEqual(history.past[0].objects[1], untouched);
  assert.ok(Object.isFrozen(history.past[0].objects[1].start));
  project.objects[0].holes[0].diameter = 24;
  project = history.undo(project);
  assert.equal(project.objects[0].holes[0].diameter, 22);
  assert.equal(project.objects[1], untouched);
  assert.ok(!Object.isFrozen(project.objects[0]));
  project = history.redo(project);
  assert.equal(project.objects[0].holes[0].diameter, 24);
  assert.equal(project.objects[1], untouched);
  project.objects[1].start[0] = 90;
  assert.equal(history.past[0].objects[1].start[0], 4);
});

test('in-place nested edits and shared specification changes produce independent snapshots', () => {
  const project = fixture(),
    history = new ProjectHistory();
  const original = captureProject(project);
  history.checkpoint(project);
  project.objects[0].spec.head.height = 14;
  project.objects[0].holes[0].diameter = 25;
  project.objects[0].extra = undefined;
  history.checkpoint(project);
  assert.equal(history.past[0].objects[0].spec.head.height, 12);
  assert.equal(history.past[1].objects[0].spec.head.height, 14);
  assert.equal(history.past[1].objects[1].spec.head.height, 14);
  delete project.objects[0].extra;
  const restored = history.undo(project);
  assert.ok(Object.hasOwn(restored.objects[0], 'extra'));
  const before = history.undo(restored);
  assert.deepEqual(before, original);
  assert.equal(before.objects[0].spec, before.objects[1].spec);
});

test('fingerprints distinguish undefined, sparse arrays, numeric edge cases and marker strings', () => {
  const project = fixture(),
    history = new ProjectHistory();
  const values = [undefined, null, NaN, Infinity, -Infinity, -0, 0, 1n, '\0undefined'];
  for (const value of values) {
    project.objects[0].value = value;
    history.checkpoint(project);
  }
  assert.equal(new Set(history.past.map((step) => step.objects[0])).size, values.length);
  project.objects[0].value = [undefined];
  history.checkpoint(project);
  delete project.objects[0].value[0];
  history.checkpoint(project);
  assert.ok(Object.hasOwn(history.past.at(-2).objects[0].value, 0));
  assert.ok(!Object.hasOwn(history.past.at(-1).objects[0].value, 0));
});

test('unusual cloneable values bypass reuse without leaving a stale cached record', () => {
  const project = fixture(),
    history = new ProjectHistory();
  history.checkpoint(project);
  project.objects[0].date = new Date('2026-10-04');
  project.objects[0].bytes = new Uint8Array([1, 2]);
  const restored = history.undo(project);
  assert.equal(restored.objects[0].date, undefined);
  const redone = history.redo(restored);
  assert.equal(redone.objects[0].date.toISOString(), '2026-10-04T00:00:00.000Z');
  assert.deepEqual([...redone.objects[0].bytes], [1, 2]);
  redone.objects[0].bytes[0] = 9;
  assert.equal(history.past[0].objects[0].bytes, undefined);
  redone.objects[0].custom = { toJSON: () => null };
  assert.throws(() => history.checkpoint(redone), { name: 'DataCloneError' });
});

test('long sessions preserve model order, history bounds and every undo/redo state', () => {
  let project = fixture();
  project.objects = Array.from({ length: 350 }, (_, i) => ({
    id: String(i),
    name: `Part ${i}`,
    value: 0,
  }));
  const history = new ProjectHistory(20);
  const before = [],
    after = [];
  for (let step = 0; step < 60; step++) {
    before.push(captureProject(project));
    history.checkpoint(project);
    const index = [0, 127, 128, 255, 256, 349][step % 6];
    project.objects = project.objects.map((s, i) => (i === index ? { ...s, value: step + 1 } : s));
    if (step === 45) project.objects = [...project.objects.slice(1), project.objects[0]];
    if (step === 50) project.objects = project.objects.slice(1);
    if (step === 55) project.objects = [...project.objects, { id: 'added', value: 0 }];
    after.push(captureProject(project));
  }
  assert.equal(history.past.length, 20);
  const snapshot = history.past.at(-1);
  assert.ok(Array.isArray(snapshot.objects));
  assert.ok(Object.isFrozen(snapshot.objects));
  assert.deepEqual(structuredClone(snapshot), before.at(-1));
  for (let step = 59; step >= 40; step--) {
    project = history.undo(project);
    assert.deepEqual(project, before[step]);
  }
  assert.equal(history.canUndo, false);
  assert.equal(history.future.length, 20);
  for (let step = 40; step < 60; step++) {
    project = history.redo(project);
    assert.deepEqual(project, after[step]);
  }
  project = history.undo(project);
  history.checkpoint(project);
  assert.equal(history.canRedo, false);
});

test('cycles through shared specification data retain their graph when restored', () => {
  let project = fixture();
  project.objects[0].spec.owner = project.objects[0];
  const history = new ProjectHistory();
  history.checkpoint(project);
  project.objects[0].holes[0].diameter = 24;
  project = history.undo(project);
  assert.equal(project.objects[0].holes[0].diameter, 22);
  assert.equal(project.objects[0].spec.owner, project.objects[0]);
  assert.equal(project.objects[0].spec, project.objects[1].spec);
  project = history.redo(project);
  assert.equal(project.objects[0].holes[0].diameter, 24);
  assert.equal(project.objects[0].spec.owner, project.objects[0]);
});
