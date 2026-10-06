import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveFit, updateComponents } from '../src/components/fit.js';
import { applyObjectBatch } from '../src/model/tools/transform-tool.js';
import { geometryForModel } from '../src/model-object.js';
import { meshVolume } from '../src/model/object-quantities.js';
const sweep = (id, start, end) => ({
  id,
  type: 'sweep',
  profile: 'rect',
  width: 100,
  height: 100,
  thickness: 0,
  rotation: 0,
  start,
  end,
});
const a = sweep('a', [-1000, 0, 0], [100, 0, 0]);
const b = sweep('b', [0, -1000, 0], [0, 100, 0]);
const fit = (mode = 'miter') =>
  resolveFit(
    {
      id: 'fit',
      type: 'component',
      kind: 'fit',
      mode,
      references: ['a', 'b'],
      endA: 'end',
      endB: 'end',
      gap: 0,
    },
    [a, b],
  );
test('miter cuts both members on opposite sides of a shared plane', () => {
  const c = fit();
  assert.deepEqual(c.targets, ['a', 'b']);
  const model = [a, b, c];
  for (const s of [a, b]) {
    const g = geometryForModel(s, model);
    assert.ok(Math.abs(meshVolume(g) - 10000000) < 100);
    g.dispose();
  }
});
test('through Fit preserves first member and caps second on its outside face', () => {
  const c = fit('abut');
  assert.deepEqual(c.targets, ['b']);
  const g = geometryForModel(b, [a, b, c]);
  g.computeBoundingBox();
  assert.ok(Math.abs(g.boundingBox.max.y + 50) < 0.001);
  g.dispose();
});
test('profile changes regenerate cuts; deleting a reference removes component', () => {
  const c = fit('abut'),
    before = [a, b, c];
  const result = applyObjectBatch(before, [{ ...a, width: 200 }]).objects;
  assert.notEqual(result[2], c);
  const g = geometryForModel(b, result);
  g.computeBoundingBox();
  assert.ok(Math.abs(g.boundingBox.max.y + 100) < 0.001);
  g.dispose();
  assert.deepEqual(updateComponents(before, [b, c]), [b]);
});
test('copy remaps component references to copied members', () => {
  const c = fit();
  const { objects } = applyObjectBatch([a, b, c], [a, b, c], {
    copy: true,
    newId: (() => {
      let i = 0;
      return () => `new-${++i}`;
    })(),
  });
  assert.deepEqual(objects.at(-1).references, ['new-1', 'new-2']);
});
test('reject invalid, parallel, and skew references', () => {
  const c = fit();
  assert.throws(() => resolveFit({ ...c, gap: -1 }, [a, b]));
  assert.throws(() => resolveFit(c, [a, { ...b, start: [0, 0, 100], end: [0, 100, 100] }]));
  assert.throws(() => resolveFit(c, [a, { ...b, start: [0, 100, 0], end: [1000, 100, 0] }]));
});
test('members ending at the junction are extended to fill the entire miter face', () => {
  const shortA = { ...a, end: [0, 0, 0] },
    shortB = { ...b, end: [0, 0, 0] };
  const c = resolveFit(fit(), [shortA, shortB]);
  for (const s of [shortA, shortB]) {
    const g = geometryForModel(s, [shortA, shortB, c]);
    assert.ok(Math.abs(meshVolume(g) - 10000000) < 100);
    g.dispose();
  }
});
test('positive gap leaves clearance on the outside face', () => {
  const c = resolveFit({ ...fit('abut'), gap: 10 }, [a, b]);
  const g = geometryForModel(b, [a, b, c]);
  g.computeBoundingBox();
  assert.ok(Math.abs(g.boundingBox.max.y + 60) < 0.001);
  g.dispose();
});

test('project round trip preserves Fit references and rebuilds derived planes', async () => {
  const { createProject } = await import('../src/project/project-state.js');
  const { serializeProject, parseProjectFile } = await import('../src/project/project-file.js');
  const project = createProject({
    grid: { x: [0, 1000], y: [0, 1000] },
    levels: { active: 'l', items: [{ id: 'l', name: 'Plan', elevation: 0 }] },
  });
  project.objects = [a, b, fit('abut')];
  const loaded = parseProjectFile(serializeProject(project));
  assert.deepEqual(loaded.objects[2], project.objects[2]);
  const file = JSON.parse(serializeProject(project));
  file.project.objects[2].references[0] = 'missing';
  assert.throws(() => parseProjectFile(JSON.stringify(file)), /refererad sweep/);
});
