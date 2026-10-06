import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { TIBNOR_PROFILES } from '../src/tibnor-catalog.js';
import { profileSnapshot } from '../src/section-profile.js';
import { contours, profileAnchor, sweepFrame } from '../src/sweep.js';
import {
  stiffenerDefaults,
  resolveStiffener,
  stiffenerDistance,
} from '../src/components/stiffener.js';
import { updateComponents } from '../src/components/fit.js';
import { componentDefinition, resolveComponentDraft } from '../src/components/definitions.js';
import { componentDeletion, componentTransformSources } from '../src/components/ownership.js';
import { applyObjectBatch } from '../src/model/tools/transform-tool.js';
import { transformObject } from '../src/transform.js';
import { rotateObject } from '../src/rotation.js';
import { geometryForModel, validateObject } from '../src/model-object.js';
import { plateCorners, plateArea } from '../src/plate.js';
import { meshVolume } from '../src/model/object-quantities.js';
import { numberParts, partStatus } from '../src/part-marks.js';
import { createProject } from '../src/project/project-state.js';
import { serializeProject, parseProjectFile } from '../src/project/project-file.js';
function beam(name = 'HEA 200') {
  const section = profileSnapshot(TIBNOR_PROFILES.find((p) => p.name === name));
  return {
    id: 'beam',
    type: 'sweep',
    name,
    profile: 'custom',
    section,
    width: section.properties.bounds.width,
    height: section.properties.bounds.height,
    thickness: 0,
    rotation: 0,
    start: [0, 0, 0],
    end: [2000, 0, 0],
  };
}
const draft = (changes = {}) => ({
  id: 'st',
  type: 'component',
  kind: 'stiffener',
  name: 'Avstyvning',
  ...stiffenerDefaults,
  references: ['beam'],
  ...changes,
});
const model = (b = beam(), changes = {}) => updateComponents([], [b, draft(changes)]);
const plates = (objects) => objects.filter((s) => s.generatedBy === 'st');
const close = (a, b) => assert.ok(Math.abs(a - b) < 0.001, `${a} != ${b}`);
const vec = (p) => new THREE.Vector3(...p);
function inside(point, loop) {
  let yes = false;
  for (let i = 0, j = loop.length - 1; i < loop.length; j = i++) {
    const a = loop[i],
      b = loop[j];
    if (
      a[1] > point[1] !== b[1] > point[1] &&
      point[0] < ((b[0] - a[0]) * (point[1] - a[1])) / (b[1] - a[1]) + a[0]
    )
      yes = !yes;
  }
  return yes;
}
function edgeDistance(p, a, b) {
  const dx = b[0] - a[0],
    dy = b[1] - a[1],
    t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}
test('all 127 H/I/U catalog profiles produce valid plates with clearance from actual radii and sloping flanges', () => {
  const profiles = TIBNOR_PROFILES.filter((p) => ['h', 'i', 'u'].includes(p.profileType));
  assert.equal(profiles.length, 127);
  for (const def of profiles) {
    const b = beam(def.name),
      objects = model(b),
      loop = contours(b)[0],
      anchor = profileAnchor(b);
    assert.equal(plates(objects).length, def.profileType === 'u' ? 1 : 2, def.name);
    for (const plate of plates(objects)) {
      assert.equal(validateObject(plate), '', def.name);
      for (let i = 0; i < plate.polygon.length; i++)
        for (let t = 0; t <= 1; t += 0.25) {
          const p = plate.polygon[i],
            q = plate.polygon[(i + 1) % plate.polygon.length];
          const sample = [
            p[0] * (1 - t) + q[0] * t + anchor[0],
            p[1] * (1 - t) + q[1] * t + anchor[1],
          ];
          assert.equal(inside(sample, loop), false, def.name);
          const clearance = Math.min(
            ...loop.map((a, j) => edgeDistance(sample, a, loop[(j + 1) % loop.length])),
          );
          assert.ok(clearance >= 1.999, `${def.name} clearance ${clearance}`);
        }
    }
  }
});
test('single side and paired plates use independent identities; U always fills its inner pocket', () => {
  for (const sides of ['positive', 'negative', 'both']) {
    const objects = model(beam(), { sides });
    assert.equal(plates(objects).length, sides === 'both' ? 2 : 1);
  }
  const u = model(beam('U 200'), { sides: 'negative' });
  assert.equal(plates(u).length, 1);
  const simple = {
    ...beam(),
    profile: 'i',
    section: undefined,
    width: 200,
    height: 300,
    thickness: 12,
  };
  assert.equal(plates(model(simple)).length, 2);
});
test('placement measures along the axis, supports either reference end, and follows reversed, inclined and eccentric sweeps', () => {
  let b = {
    ...beam(),
    start: [100, 200, 300],
    end: [1100, 900, 1000],
    rotation: 37,
    placement: { horizontalAlignment: 'left', verticalAlignment: 'top' },
  };
  for (const reversed of [false, true]) {
    if (reversed) b = { ...b, start: b.end, end: b.start };
    const objects = model(b, { distance: 200, referenceEnd: 'end' }),
      frame = sweepFrame(b);
    for (const plate of plates(objects))
      for (const corner of plateCorners(plate))
        close(
          vec(corner).sub(frame.end).dot(frame.axis),
          -200 + vec(corner).sub(vec(plate.frame.origin)).dot(frame.axis),
        );
    const p = frame.start
      .clone()
      .addScaledVector(frame.axis, 600)
      .addScaledVector(frame.x, 25)
      .toArray();
    close(stiffenerDistance(b, p), 600);
    const old = plates(objects)[0],
      rotated = applyObjectBatch(objects, [rotateObject(b, [0, 0, 0], [0, 1, 0], 40)]).objects;
    assert.notDeepEqual(plates(rotated)[0].frame, old.frame);
  }
});
test('stiffeners do not cut their reference; relief and gap reduce plate material and invalidate plate numbering', () => {
  const b = beam(),
    before = model(b),
    plate = plates(before)[0];
  const state = numberParts(before);
  const g = geometryForModel(b, before),
    raw = geometryForModel(b, [b]);
  close(meshVolume(g), meshVolume(raw));
  g.dispose();
  raw.dispose();
  const changed = applyObjectBatch(before, [
    resolveComponentDraft(before[1], { gap: 4, cornerRelief: 30 }, before),
  ]).objects;
  assert.ok(plateArea(plates(changed)[0]) < plateArea(plate));
  assert.equal(partStatus(plates(changed)[0], changed, state).valid, false);
  assert.equal(partStatus(b, changed, state).valid, true);
  assert.equal(plate.id, plates(changed)[0].id);
  assert.equal(plate.number, plates(changed)[0].number);
});
test('profile changes regenerate contours and shrinking to one side removes obsolete children', () => {
  const before = model(),
    b = beam('HEA 300');
  const after = applyObjectBatch(before, [b]).objects;
  assert.ok(plateArea(plates(after)[0]) > plateArea(plates(before)[0]));
  const single = applyObjectBatch(after, [{ ...after[1], sides: 'positive' }]).objects;
  assert.equal(plates(single).length, 1);
  assert.ok(
    updateComponents(single, single).every((s) => s === single.find((old) => old.id === s.id)),
  );
});
test('invalid profiles, references, dimensions and end positions fail before changing the saved model', () => {
  const before = model(),
    source = before[1],
    saved = structuredClone(before);
  for (const invalid of [
    { gap: 1000 },
    { thickness: -1 },
    { distance: 0 },
    { distance: 2000 },
    { cornerRelief: 1000 },
    { sides: 'bad' },
    { referenceEnd: 'bad' },
  ])
    assert.throws(() => resolveComponentDraft(source, invalid, before));
  assert.throws(() => model({ ...beam(), profile: 'rect' }), /H-, I- eller U/);
  assert.throws(() => resolveStiffener(source, []), /saknar/);
  assert.equal(JSON.stringify(before), JSON.stringify(saved));
  assert.equal(componentDefinition('stiffener').label, 'Avstyvning');
});
test('move and copy through the reference produce independent components, children and local frames', () => {
  const before = model(),
    sources = componentTransformSources(before, ['st:plate:positive']);
  assert.deepEqual(
    sources.map((s) => s.id),
    ['beam', 'st'],
  );
  const moved = applyObjectBatch(
    before,
    sources.map((s) => transformObject(s, 'move', [0, 0, 0], [100, 200, 300])),
  ).objects;
  assert.deepEqual(plates(moved)[0].frame.origin, [600, 200, 300]);
  let n = 0;
  const copied = applyObjectBatch(
    before,
    [transformObject(before[0], 'copy', [0, 0, 0], [0, 1000, 0])],
    { copy: true, newId: () => `copy-${++n}` },
  ).objects;
  const component = copied.find((s) => s.kind === 'stiffener' && s.id !== 'st');
  assert.deepEqual(component.references, ['copy-1']);
  const children = copied.filter((s) => s.generatedBy === component.id);
  assert.equal(children.length, 2);
  assert.equal(children[0].frame.origin[1], 1000);
  assert.equal(new Set(copied.map((s) => s.id)).size, copied.length);
});
test('deleting a child deletes its owning pair; deleting the reference removes the component and all plates', () => {
  const before = model(),
    removed = componentDeletion(before, ['st:plate:negative']);
  assert.deepEqual(
    updateComponents(
      before,
      before.filter((s) => !removed.has(s.id)),
    ),
    [before[0]],
  );
  assert.deepEqual(
    updateComponents(
      before,
      before.filter((s) => s.id !== 'beam'),
    ),
    [],
  );
});
test('project roundtrip stores parameters and regenerates plates, rejecting orphan children and unsupported replacement profiles', () => {
  const project = createProject({
    grid: { x: [0, 1000], y: [0, 1000] },
    levels: { active: 'l', items: [{ id: 'l', name: 'Plan', elevation: 0 }] },
  });
  project.objects = model(beam('U 200'), { cornerRelief: 10, referenceEnd: 'end', distance: 250 });
  const encoded = serializeProject(project);
  assert.deepEqual(parseProjectFile(encoded).objects, JSON.parse(JSON.stringify(project.objects)));
  const file = JSON.parse(encoded);
  file.project.objects = file.project.objects.filter((s) => !s.generatedBy);
  assert.equal(parseProjectFile(JSON.stringify(file)).objects.length, 3);
  const unsupported = JSON.parse(encoded);
  unsupported.project.objects[0].profile = 'rect';
  assert.throws(() => parseProjectFile(JSON.stringify(unsupported)), /H-, I- eller U/);
  const orphan = JSON.parse(encoded);
  orphan.project.objects = orphan.project.objects.filter((s) => s.id !== 'st');
  assert.throws(() => parseProjectFile(JSON.stringify(orphan)), /saknar sin koppling/);
});
