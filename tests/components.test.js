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
test('reject invalid and parallel references', () => {
  const c = fit();
  assert.throws(() => resolveFit({ ...c, gap: -1 }, [a, b]));
  assert.throws(() => resolveFit(c, [a, { ...b, start: [0, 100, 0], end: [1000, 100, 0] }]));
});
test('skew members with overlapping profiles support miter and through Fit', () => {
  const skew = { ...b, start: [0, -1000, 40], end: [0, 0, 40] };
  const original = structuredClone([a, skew]);
  for (const mode of ['miter', 'abut']) {
    const c = resolveFit({ ...fit(), mode }, [a, skew]);
    assert.equal(c.profileOverlap, true);
    assert.deepEqual(c.position, [0, 0, 20]);
    for (const source of [a, skew]) {
      const geometry = geometryForModel(source, [a, skew, c]);
      assert.ok(meshVolume(geometry) > 0);
      geometry.computeBoundingBox();
      if (source.id === 'b') {
        assert.ok(Math.abs(geometry.boundingBox.min.z + 10) < 0.001);
        assert.ok(Math.abs(geometry.boundingBox.max.z - 90) < 0.001);
        if (mode === 'abut') assert.ok(Math.abs(geometry.boundingBox.max.y + 50) < 0.001);
      }
      geometry.dispose();
    }
  }
  assert.deepEqual([a, skew], original);
});
test('3D through Fit uses the actual side of a rotated first profile', () => {
  const rotated = { ...a, rotation: 45 };
  const skew = { ...b, start: [0, -1000, 30], end: [0, 0, 30] };
  const c = resolveFit({ ...fit(), mode: 'abut', gap: 10 }, [rotated, skew]);
  const coplanar = resolveFit({ ...fit(), mode: 'abut', gap: 10 }, [rotated, b]);
  assert.deepEqual(c.cuts[0].frame, coplanar.cuts[0].frame);
});
test('round profile overlap is independent of profile rotation', () => {
  const roundA = { ...a, profile: 'chs', thickness: 5, rotation: 45 };
  const roundB = {
    ...b,
    profile: 'chs',
    thickness: 5,
    rotation: 45,
    start: [0, -1000, 90],
    end: [0, 0, 90],
  };
  assert.doesNotThrow(() => resolveFit(fit(), [roundA, roundB]));
});
test('overlap uses actual profile placement and works after a 3D rotation', () => {
  const shifted = {
    ...b,
    start: [0, -1000, 120],
    end: [0, 0, 120],
    placement: { verticalAlignment: 'top' },
  };
  assert.doesNotThrow(() => resolveFit(fit(), [a, shifted]));
  const separated = { ...shifted, start: [0, -1000, 160], end: [0, 0, 160] };
  assert.equal(resolveFit(fit(), [a, separated]).profileOverlap, false);
  const rotate = (point) => [point[2], point[0], point[1]];
  const skew = { ...b, start: [0, -1000, 40], end: [0, 0, 40] };
  const rotated = [a, skew].map((s) => ({
    ...s,
    start: rotate(s.start),
    end: rotate(s.end),
    profileUp: [1, 0, 0],
  }));
  assert.doesNotThrow(() => resolveFit(fit(), rotated));
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
