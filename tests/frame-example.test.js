import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createFrameExample,
  FRAME_EXAMPLE_SIZES,
  frameExampleCounts,
} from '../src/project/frame-example.js';
import { validateObject, geometryForModel, edgesForModel } from '../src/model-object.js';
import { validateFastenerTargets } from '../src/fasteners/relations.js';
import { automaticPlacement } from '../src/fasteners/placement.js';

test('all frame sizes have unique identities, valid objects and complete selected-target connections', () => {
  for (const size of FRAME_EXAMPLE_SIZES) {
    const project = createFrameExample(size.id);
    const counts = frameExampleCounts(size);
    assert.equal(project.objects.length, counts.objects);
    assert.equal(new Set(project.objects.map((o) => o.id)).size, counts.objects);
    assert.equal(
      new Set(project.objects.map((o) => `${o.prefix}-${o.number}`)).size,
      counts.objects,
    );
    assert.equal(project.objects.filter((o) => o.type === 'fastener').length, counts.screws);
    const boreIds = new Set();
    for (const object of project.objects) {
      assert.equal(validateObject(object), '', object.name);
      if (object.type === 'fastener') {
        validateFastenerTargets(object, project.objects);
        assert.deepEqual(object.washers, { head: true, nut: true });
        for (const hole of object.holes) {
          assert.ok(!boreIds.has(hole.id));
          boreIds.add(hole.id);
        }
      }
    }
    assert.equal(boreIds.size, counts.holes);
    assert.equal(project.levels.items.length, size.floors + 1);
  }
  assert.throws(() => createFrameExample('invalid'), /storlek/);
});

test('prepared assemblies retain drilled geometry and invalidate it when a screw hole changes', () => {
  const project = createFrameExample('small', { prepareGeometry: true });
  const beam = project.objects.find((o) => o.profile === 'i' && o.name.includes('Y-balk'));
  const before = geometryForModel(beam, project.objects);
  const edges = edgesForModel(beam, project.objects);
  assert.ok(edges.attributes.position.count > 0);
  assert.ok([...edges.attributes.position.array].every(Number.isFinite));
  const changed = project.objects.map((o) =>
    o.holes?.some((h) => h.targetId === beam.id)
      ? { ...o, holes: o.holes.map((h) => ({ ...h, kind: 'none' })) }
      : o,
  );
  const after = geometryForModel(beam, changed);
  assert.ok(before.attributes.position.count > after.attributes.position.count);
  assert.ok(after.attributes.position.count < 200);
  before.dispose();
  edges.dispose();
  after.dispose();
});

test('repeated X and Y beam joints retain real bore positions after rotation and translation', () => {
  const project = createFrameExample('small');
  for (const axis of ['X', 'Y']) {
    const screw = project.objects.find(
      (o) => o.type === 'fastener' && o.name.includes(`${axis}-balk`),
    );
    const parts = project.objects.filter((o) => screw.holes.some((h) => h.targetId === o.id));
    const recalculated = automaticPlacement(
      screw,
      screw.insertion.start,
      screw.insertion.direction,
      parts,
    );
    assert.deepEqual(recalculated.start, screw.start);
    assert.equal(recalculated.nutOffset, screw.nutOffset);
    assert.deepEqual(
      recalculated.holes.map((h) => [h.offset, h.depth]),
      screw.holes.map((h) => [h.offset, h.depth]),
    );
    for (const part of parts) {
      const related = project.objects.filter((o) => o.holes?.some((h) => h.targetId === part.id));
      const geometry = geometryForModel(part, [...parts, ...related]);
      assert.ok(geometry.attributes.position.count > 0);
      assert.ok([...geometry.attributes.position.array].every(Number.isFinite));
      geometry.dispose();
    }
  }
});
