import { baseplateDefaults } from '../src/components/baseplate.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  boltedEndplateDefaults,
  resolveBoltedEndplate,
} from '../src/components/bolted-endplate.js';
import { updateComponents } from '../src/components/fit.js';
import { applyObjectBatch } from '../src/model/tools/transform-tool.js';
import { componentDeletion, componentTransformSources } from '../src/components/ownership.js';
import { resolveComponentDraft } from '../src/components/definitions.js';
import { geometryForModel, validateObject } from '../src/model-object.js';
import { plateCorners } from '../src/plate.js';
import { meshVolume } from '../src/model/object-quantities.js';
import { rotateObject } from '../src/rotation.js';
import { transformObject } from '../src/transform.js';
import { createProject } from '../src/project/project-state.js';
import { serializeProject, parseProjectFile } from '../src/project/project-file.js';
import { TIBNOR_PROFILES } from '../src/tibnor-catalog.js';
import { profileSnapshot } from '../src/section-profile.js';
import { numberParts, partStatus } from '../src/part-marks.js';
import { endplateDefaults } from '../src/components/endplate.js';
const column = {
  id: 'column',
  type: 'sweep',
  name: 'Pelare',
  profile: 'i',
  width: 300,
  height: 300,
  thickness: 15,
  rotation: 90,
  start: [0, 0, 0],
  end: [0, 0, 3000],
};
const beam = {
  ...column,
  id: 'beam',
  name: 'Balk',
  width: 200,
  rotation: 0,
  start: [1000, 0, 1500],
  end: [0, 0, 1500],
};
const spec = (length = 60, standard = 'ISO 4017') => ({
  id: `m16-${standard}-${length}`,
  revision: 1,
  name: `${standard} M16×${length}`,
  kind: 'bolt',
  standard,
  diameter: 16,
  length,
  head: { kind: 'hex', diameter: 24, height: 10 },
  nut: { acrossFlats: 24, thickness: 13 },
  washer: { innerDiameter: 18, outerDiameter: 30, thickness: 3 },
  thread: { length: standard === 'ISO 4014' ? 38 : length, pitch: 2 },
});
const draft = (changes = {}) => ({
  id: 'joint',
  type: 'component',
  kind: 'boltedEndplate',
  ...boltedEndplateDefaults,
  endB: 'end',
  boltSpec: spec(),
  references: ['column', 'beam'],
  ...changes,
});
const model = (changes = {}, refs = [column, beam]) =>
  updateComponents([], [...refs, draft(changes)]);
const bolts = (objects) => objects.filter((o) => o.componentRole === 'bolt');
const close = (a, b) => assert.ok(Math.abs(a - b) < 0.003, `${a} != ${b}`);
const volume = (object, objects) => {
  const g = geometryForModel(object, objects);
  const result = meshVolume(g);
  g.dispose();
  return result;
};

test('plate, cut and through bolts form a flush flange connection without modifying nominal endpoints', () => {
  const objects = model({ gap: 3 }),
    joint = objects.find((o) => o.kind === 'boltedEndplate'),
    plate = objects.find((o) => o.type === 'plate');
  assert.deepEqual(objects[1].end, beam.end);
  close(joint.position[0], 153);
  const xs = plateCorners(plate).map((p) => p[0]);
  close(Math.min(...xs), 153);
  close(Math.max(...xs), 168);
  assert.equal(bolts(objects).length, 4);
  for (const b of bolts(objects)) {
    assert.equal(validateObject(b), '');
    assert.deepEqual(
      b.holes.map((h) => h.targetId),
      [plate.id, column.id],
    );
    close(b.holes[0].depth, 15);
    close(b.holes[1].depth, 15);
    close(b.holes[1].offset, 21);
    assert.equal(b.accessories.length, 3);
  }
  const cutOnly = objects.filter((o) => o.type !== 'fastener');
  close(volume(beam, cutOnly) / volume(beam, [beam]), 832 / 1000);
  assert.ok(
    Math.abs(
      joint.plateWidth * joint.plateLength * 15 -
        volume(plate, objects) -
        4 * Math.PI * 9 ** 2 * 15,
    ) < 20,
  );
  assert.ok(
    Math.abs(volume(column, [column]) - volume(column, objects) - 4 * Math.PI * 9 ** 2 * 15) < 25,
  );
});
test('both flange faces and reversed beam end identities retain outward thickness and inward bolts', () => {
  for (const sign of [-1, 1])
    for (const reversed of [false, true]) {
      const b = { ...beam, start: [sign * 1000, 0, 1500], end: [0, 0, 1500] };
      if (reversed) [b.start, b.end] = [b.end, b.start];
      const objects = model({ endB: reversed ? 'start' : 'end' }, [column, b]);
      const joint = objects.find((o) => o.kind === 'boltedEndplate'),
        plate = objects.find((o) => o.type === 'plate');
      close(joint.position[0], sign * 150);
      for (const p of plateCorners(plate)) assert.ok(sign * p[0] >= 150 - 0.001);
      for (const bolt of bolts(objects)) assert.ok(sign * (bolt.end[0] - bolt.start[0]) < 0);
      close(
        volume(
          b,
          objects.filter((o) => o.type !== 'fastener'),
        ) / volume(b, [b]),
        835 / 1000,
      );
    }
});
test('automatic library length follows grip and ISO 4014 threaded nut seating', () => {
  const objects = model({ boltSpec: spec(40), lengthOptions: [spec(40), spec(50), spec(60)] });
  assert.ok(bolts(objects).every((b) => b.spec.length === 60));
  const thick = applyObjectBatch(objects, [
    {
      ...objects.find((o) => o.kind === 'boltedEndplate'),
      thickness: 30,
      lengthOptions: [spec(40), spec(60), spec(70)],
    },
  ]).objects;
  assert.ok(bolts(thick).every((b) => b.spec.length === 70 && b.name === b.spec.name));
  const partial = model({
    boltSpec: spec(80, 'ISO 4014'),
    lengthOptions: [spec(60, 'ISO 4014'), spec(80, 'ISO 4014')],
  });
  assert.ok(bolts(partial).every((b) => b.spec.length === 60));
  assert.throws(() => model({ boltSpec: spec(40), lengthMode: 'manual' }), /Muttrar|kort/);
  assert.throws(() => model({ boltSpec: spec(40) }), /Ingen passande/);
  assert.throws(() => model({ boltSpec: spec(500), lengthMode: 'manual' }), /lång/);
});
test('invalid patterns, plate sizes, edges and hardware collision are blocked before transactions', () => {
  for (const changes of [
    { rows: 0 },
    { columns: 101 },
    { spacingX: 0 },
    { gap: -1 },
    { holeDiameter: 10 },
    { offsetX: 1000 },
    { sizeMode: 'manual', width: 20 },
    { edgeDistance: 200 },
    { boltSpec: null },
    { clearance: -1 },
  ])
    assert.throws(() => model(changes));
  assert.throws(() => model({ spacingX: 20 }), /överlappar/);
  assert.throws(() => model({ columns: 1 }), /plan flänsyta|liv/);
  assert.throws(() => model({ spacingY: 280 }), /balkens liv eller fläns/);
  assert.throws(() => model({}, [column, { ...beam, profile: 'rhs', thickness: 5 }]), /H- eller I/);
  assert.throws(() => model({}, [{ ...column, rotation: 0 }, beam]), /vinkelrätt/);
  assert.throws(() => model({ endB: 'start' }), /hela balken/);
  assert.throws(
    () => model({}, [column, { ...beam, start: [1000, 0, 30], end: [0, 0, 30] }]),
    /kantavståndet/,
  );
});
test('actual catalog flange radii and eccentric section anchors are respected', () => {
  const catalog = (name, source) => {
    const record = TIBNOR_PROFILES.find((o) => o.name === name);
    const section = profileSnapshot(record);
    return {
      ...source,
      profile: 'custom',
      section,
      width: section.properties.bounds.width,
      height: section.properties.bounds.height,
    };
  };
  const c = catalog('HEB 300', column),
    b = catalog('HEA 300', beam);
  const objects = model({ spacingX: 150 }, [c, b]);
  assert.equal(bolts(objects).length, 4);
  for (const bolt of bolts(objects)) close(bolt.holes[1].depth, c.section.parameters.tf);
  assert.throws(() => model({ spacingX: 100 }, [c, b]), /radier/);
  const eccentric = {
    ...b,
    start: [1000, -150, 1645],
    end: [0, -150, 1645],
    placement: { horizontalAlignment: 'left', verticalAlignment: 'top' },
  };
  const resolved = resolveBoltedEndplate(draft({ spacingX: 150 }), [c, eccentric]);
  close(resolved.frame.origin[1], 0);
  close(resolved.frame.origin[2], 1500);
});
test('detached inspector drafts preserve source and selected length snapshots without the external library', () => {
  const objects = model(),
    joint = objects.find((o) => o.kind === 'boltedEndplate'),
    saved = structuredClone(objects);
  const staged = resolveComponentDraft(
    joint,
    { gap: 4, rows: 3, spacingY: 70, lengthOptions: [spec(60), spec(70)] },
    objects,
  );
  assert.equal(staged.boltLayout.length, 6);
  assert.deepEqual(objects, saved);
  const after = applyObjectBatch(objects, [staged]).objects;
  assert.equal(bolts(after).length, 6);
  assert.equal(bolts(after)[0].id, bolts(objects)[0].id);
  assert.ok(
    updateComponents(after, after).every(
      (o) => o === after.find((previous) => previous.id === o.id),
    ),
  );
});
test('owned transformations and copied reference pairs regenerate independent bolts, plate and bores', () => {
  const objects = model(),
    ids = [objects.find((o) => o.type === 'plate').id];
  const sources = componentTransformSources(objects, ids);
  assert.deepEqual(new Set(sources.map((o) => o.id)), new Set(['column', 'beam', 'joint']));
  const move = sources.map((o) => transformObject(o, 'move', [0, 0, 0], [100, 200, 300]));
  const moved = applyObjectBatch(objects, move).objects;
  const p = moved.find((o) => o.type === 'plate');
  close(p.frame.origin[0], 250);
  close(p.frame.origin[1], 200);
  close(p.frame.origin[2], 1800);
  const rotated = applyObjectBatch(
    objects,
    sources.map((o) => rotateObject(o, [0, 0, 0], [1, 1, 1], 40)),
  ).objects;
  const q = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(1, 1, 1).normalize(),
    (40 * Math.PI) / 180,
  );
  for (let i = 0; i < 4; i++)
    assert.ok(
      new THREE.Vector3(...bolts(rotated)[i].start).distanceTo(
        new THREE.Vector3(...bolts(objects)[i].start).applyQuaternion(q),
      ) < 0.002,
    );
  let n = 0;
  const copied = applyObjectBatch(objects, objects.slice(0, 2), {
    copy: true,
    newId: () => `copy${++n}`,
  }).objects;
  const owner = copied.find((o) => o.kind === 'boltedEndplate' && o.id !== 'joint');
  assert.ok(owner.references.every((id) => id.startsWith('copy')));
  const copiedBolts = bolts(copied).filter((o) => o.generatedBy === owner.id);
  assert.equal(copiedBolts.length, 4);
  assert.ok(
    copiedBolts.every((o) =>
      o.holes.every((h) => h.targetId !== 'column' && h.targetId !== 'joint:plate'),
    ),
  );
});
test('conflicting caps and Fit on the same beam end are rejected in either creation order', () => {
  const objects = model(),
    cap = {
      id: 'cap',
      type: 'component',
      kind: 'endplate',
      ...endplateDefaults,
      endA: 'end',
      references: ['beam'],
    };
  assert.throws(() => updateComponents(objects, [...objects, cap]), /redan/);
  const old = updateComponents([], [column, beam, cap]);
  assert.throws(() => updateComponents(old, [...old, draft()]), /redan/);
  const other = { ...beam, id: 'other', start: [0, -1000, 1500], end: [0, 0, 1500] };
  const fit = {
    id: 'fit',
    type: 'component',
    kind: 'fit',
    references: ['beam', 'other'],
    mode: 'miter',
    endA: 'end',
    endB: 'end',
    gap: 0,
  };
  assert.throws(() => updateComponents(objects, [...objects, other, fit]), /redan/);
});
test('deletion removes owned bores and restores beam end and column volume; numbering tracks changed physical parts', () => {
  const objects = model();
  const ids = componentDeletion(objects, [bolts(objects)[0].id]);
  const after = updateComponents(
    objects,
    objects.filter((o) => !ids.has(o.id)),
  );
  assert.equal(after.length, 2);
  close(volume(column, after), volume(column, [column]));
  close(volume(beam, after), volume(beam, [beam]));
  const noColumn = updateComponents(
    objects,
    objects.filter((o) => o.id !== 'column'),
  );
  assert.deepEqual(
    noColumn.map((o) => o.id),
    ['beam'],
  );
  const numbering = numberParts(objects);
  assert.equal(
    partStatus(
      objects.find((o) => o.type === 'plate'),
      objects,
      numbering,
    ).valid,
    true,
  );
  const changed = applyObjectBatch(objects, [
    { ...objects.find((o) => o.kind === 'boltedEndplate'), thickness: 16 },
  ]).objects;
  assert.equal(
    partStatus(
      changed.find((o) => o.type === 'plate'),
      changed,
      numbering,
    ).valid,
    false,
  );
});
test('project roundtrip and missing-child repair preserve complete editable joint without library state', () => {
  const objects = model({ lengthOptions: [spec(60), spec(70)] });
  const project = createProject({
    grid: { x: [0, 1000], y: [0, 1000] },
    levels: { active: 'l', items: [{ id: 'l', name: 'Plan', elevation: 0 }] },
  });
  project.objects = objects;
  const parsed = parseProjectFile(serializeProject(project)).objects;
  assert.deepEqual(JSON.parse(JSON.stringify(parsed)), JSON.parse(JSON.stringify(objects)));
  const file = JSON.parse(serializeProject(project));
  file.project.objects = file.project.objects.filter((o) => !o.generatedBy);
  assert.equal(bolts(parseProjectFile(JSON.stringify(file)).objects).length, 4);
});

test('new and edited column caps are checked using the proposed cut plane before holes lose material', () => {
  const foot = {
    id: 'foot',
    type: 'component',
    kind: 'baseplate',
    ...baseplateDefaults,
    references: ['column'],
  };
  assert.throws(
    () => updateComponents([], [column, beam, draft(), { ...foot, elevationOffset: 1460 }]),
    /befintlig kapning/,
  );
  const objects = updateComponents([], [column, beam, draft(), foot]);
  const existing = objects.find((o) => o.id === 'foot');
  assert.throws(
    () => applyObjectBatch(objects, [{ ...existing, elevationOffset: 1460 }]),
    /befintlig kapning/,
  );
  assert.ok(
    updateComponents(objects, objects).every((o) => o === objects.find((old) => old.id === o.id)),
  );
});
