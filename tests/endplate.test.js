import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { endplateDefaults, resolveEndplate } from '../src/components/endplate.js';
import { updateComponents } from '../src/components/fit.js';
import { resolveComponentDraft } from '../src/components/definitions.js';
import { componentDeletion, componentTransformSources } from '../src/components/ownership.js';
import { applyObjectBatch } from '../src/model/tools/transform-tool.js';
import { transformObject } from '../src/transform.js';
import { rotateObject } from '../src/rotation.js';
import { TIBNOR_PROFILES } from '../src/tibnor-catalog.js';
import { profileSnapshot } from '../src/section-profile.js';
import { sweepFrame, sweepCorners } from '../src/sweep.js';
import { plateCorners, plateArea } from '../src/plate.js';
import { geometryForModel, validateObject } from '../src/model-object.js';
import { meshVolume } from '../src/model/object-quantities.js';
import { numberParts, partStatus } from '../src/part-marks.js';
import { baseplateDefaults } from '../src/components/baseplate.js';
import { stiffenerDefaults } from '../src/components/stiffener.js';
import { createProject } from '../src/project/project-state.js';
import { serializeProject, parseProjectFile } from '../src/project/project-file.js';
const vec = (p) => new THREE.Vector3(...p);
const close = (actual, expected) =>
  assert.ok(Math.abs(actual - expected) < 0.002, `${actual} != ${expected}`);
const plain = {
  id: 'beam',
  type: 'sweep',
  name: 'Balk',
  profile: 'rhs',
  width: 100,
  height: 150,
  thickness: 5,
  rotation: 0,
  start: [0, 0, 0],
  end: [2000, 0, 0],
};
const draft = (changes = {}) => ({
  id: 'cap',
  type: 'component',
  kind: 'endplate',
  name: 'Ändplåt',
  ...endplateDefaults,
  references: ['beam'],
  ...changes,
});
const model = (beam = plain, changes = {}) => updateComponents([], [beam, draft(changes)]);
const plate = (objects) => objects.find((s) => s.generatedBy === 'cap');
function catalogBeam(name) {
  const section = profileSnapshot(TIBNOR_PROFILES.find((p) => p.name === name));
  return {
    ...plain,
    profile: 'custom',
    section,
    width: section.properties.bounds.width,
    height: section.properties.bounds.height,
    thickness: 0,
  };
}
function covers(beam, component) {
  const u = vec(component.frame.u),
    v = vec(component.frame.v),
    center = vec(component.frame.origin);
  for (const p of sweepCorners(beam)) {
    const d = vec(p).sub(center);
    assert.ok(Math.abs(d.dot(u)) <= component.plateWidth / 2 + 0.001);
    assert.ok(Math.abs(d.dot(v)) <= component.plateLength / 2 + 0.001);
  }
}
test('both endplates extend outwards, leave the requested gap and preserve the uncut beam', () => {
  for (const beam of [
    plain,
    { ...plain, start: plain.end, end: plain.start },
    { ...plain, start: [100, 200, 300], end: [900, 750, 1500], rotation: 47, profileUp: [0, 1, 0] },
  ])
    for (const endA of ['start', 'end']) {
      const objects = model(beam, { endA, gap: 7, thickness: 18 }),
        component = objects[1],
        p = plate(objects),
        frame = sweepFrame(beam),
        outward = frame.axis.clone().multiplyScalar(endA === 'end' ? 1 : -1);
      objects.forEach((s) => assert.equal(validateObject(s), ''));
      const distances = plateCorners(p).map((point) =>
        vec(point).sub(vec(beam[endA])).dot(outward),
      );
      close(Math.min(...distances), 7);
      close(Math.max(...distances), 25);
      covers(beam, component);
      const g = geometryForModel(beam, objects),
        raw = geometryForModel(beam, [beam]);
      close(meshVolume(g), meshVolume(raw));
      g.dispose();
      raw.dispose();
    }
});
test('rotated plates cover centered, eccentric, round and actual catalog profiles', () => {
  const beams = [
    plain,
    { ...plain, profile: 'circle', width: 200, height: 200, thickness: 0 },
    catalogBeam('HEA 300'),
    catalogBeam('U 200'),
  ];
  for (const original of beams)
    for (const plateRotation of [0, 35, 90]) {
      const beam = {
        ...original,
        rotation: 31,
        placement: { horizontalAlignment: 'left', verticalAlignment: 'top' },
      };
      const objects = model(beam, { plateRotation });
      covers(beam, objects[1]);
      close(plateArea(plate(objects)), objects[1].plateWidth * objects[1].plateLength);
    }
});
test('profile-sized and fixed plates update through detached inspector drafts without changing saved objects', () => {
  const before = model(),
    source = before[1],
    saved = structuredClone(before);
  assert.equal(source.plateWidth, 150);
  assert.equal(source.plateLength, 200);
  const changed = resolveComponentDraft(
    source,
    { sizeMode: 'manual', width: 250, length: 300, plateRotation: 30 },
    before,
  );
  assert.equal(changed.plateWidth, 250);
  assert.equal(changed.plateLength, 300);
  assert.deepEqual(before, saved);
  const after = applyObjectBatch(before, [{ ...plain, width: 180 }]).objects;
  assert.equal(after[1].plateWidth, 230);
  assert.equal(plate(after).id, plate(before).id);
  assert.equal(plate(after).number, plate(before).number);
  assert.ok(
    updateComponents(after, after).every((s) => s === after.find((old) => old.id === s.id)),
  );
});
test('invalid dimensions, missing references and too-small fixed plates fail before a transaction', () => {
  for (const changes of [
    { width: 10, sizeMode: 'manual' },
    { endA: 'bad' },
    { gap: -1 },
    { thickness: 0 },
    { plateRotation: NaN },
    { outstandX: 10001 },
    { references: 'x' },
  ])
    assert.throws(() => model(plain, changes));
  assert.throws(() => resolveEndplate(draft(), []), /saknar/);
  assert.throws(
    () => resolveEndplate(draft({ references: ['plate'] }), [{ id: 'plate', type: 'plate' }]),
    /saknar/,
  );
});
test('endplate, baseplate and cutting Fit cannot occupy the same end; another end and stiffeners remain valid', () => {
  const existing = model();
  assert.throws(() => updateComponents(existing, [...existing, draft({ id: 'second' })]), /redan/);
  const both = updateComponents(existing, [...existing, draft({ id: 'second', endA: 'start' })]);
  assert.equal(both.filter((s) => s.generatedBy).length, 2);
  const column = { ...plain, start: [0, 0, 0], end: [0, 0, 2000] };
  const foot = {
    id: 'foot',
    type: 'component',
    kind: 'baseplate',
    ...baseplateDefaults,
    references: ['beam'],
  };
  assert.throws(() => updateComponents([], [column, draft({ endA: 'start' }), foot]), /redan/);
  const other = { ...plain, id: 'other', start: [2000, -1000, 0], end: [2000, 0, 0] };
  const fit = {
    id: 'fit',
    type: 'component',
    kind: 'fit',
    references: ['beam', 'other'],
    endA: 'end',
    endB: 'end',
    mode: 'miter',
    gap: 0,
  };
  assert.throws(() => updateComponents(existing, [...existing, other, fit]), /redan/);
  const through = updateComponents(existing, [...existing, other, { ...fit, mode: 'abut' }]);
  assert.ok(through.some((s) => s.id === 'cap'));
  const beam = catalogBeam('HEA 300');
  const stiff = {
    id: 'st',
    type: 'component',
    kind: 'stiffener',
    ...stiffenerDefaults,
    references: ['beam'],
  };
  assert.equal(updateComponents([], [beam, draft(), stiff]).filter((s) => s.generatedBy).length, 3);
});
test('move, rotation and copy regenerate the plate frame and separate owned references', () => {
  const before = model(),
    sources = componentTransformSources(before, ['cap:plate']);
  assert.deepEqual(
    sources.map((s) => s.id),
    ['beam', 'cap'],
  );
  const moved = applyObjectBatch(
    before,
    sources.map((s) => transformObject(s, 'move', [0, 0, 0], [100, 200, 300])),
  ).objects;
  assert.deepEqual(plate(moved).frame.origin, [2100, 200, 300]);
  const rotated = applyObjectBatch(before, [rotateObject(plain, [0, 0, 0], [0, 1, 0], 35)]).objects;
  const q = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(0, 1, 0),
    (35 * Math.PI) / 180,
  );
  plateCorners(plate(before)).forEach((p, i) =>
    close(
      vec(p)
        .applyQuaternion(q)
        .distanceTo(vec(plateCorners(plate(rotated))[i])),
      0,
    ),
  );
  let n = 0;
  const copied = applyObjectBatch(
    before,
    [transformObject(plain, 'copy', [0, 0, 0], [0, 1000, 0])],
    { copy: true, newId: () => `new-${++n}` },
  ).objects;
  const cap = copied.find((s) => s.kind === 'endplate' && s.id !== 'cap'),
    p = copied.find((s) => s.generatedBy === cap.id);
  assert.deepEqual(cap.references, ['new-1']);
  assert.equal(p.id, `${cap.id}:plate`);
  assert.equal(p.frame.origin[1], 1000);
});
test('plate changes require new part numbering, while the reference part keeps its mark', () => {
  const before = model(),
    numbering = numberParts(before),
    after = applyObjectBatch(before, [{ ...before[1], thickness: 20 }]).objects;
  assert.equal(partStatus(plate(after), after, numbering).valid, false);
  assert.equal(partStatus(after[0], after, numbering).valid, true);
  const removed = componentDeletion(after, ['cap:plate']);
  assert.deepEqual(
    updateComponents(
      after,
      after.filter((s) => !removed.has(s.id)),
    ),
    [plain],
  );
  assert.deepEqual(
    updateComponents(
      after,
      after.filter((s) => s.id !== 'beam'),
    ),
    [],
  );
});
test('project files preserve editable endplate parameters and regenerate missing physical plates', () => {
  const project = createProject({
    grid: { x: [0, 1000], y: [0, 1000] },
    levels: { active: 'l', items: [{ id: 'l', name: 'Plan', elevation: 0 }] },
  });
  project.objects = model(catalogBeam('U 200'), { endA: 'start', gap: 3, plateRotation: 15 });
  const encoded = serializeProject(project);
  assert.deepEqual(parseProjectFile(encoded).objects, JSON.parse(JSON.stringify(project.objects)));
  const file = JSON.parse(encoded);
  file.project.objects = file.project.objects.filter((s) => !s.generatedBy);
  assert.equal(parseProjectFile(JSON.stringify(file)).objects.length, 3);
  file.project.objects[1].references = ['missing'];
  assert.throws(() => parseProjectFile(JSON.stringify(file)), /saknar/);
});
