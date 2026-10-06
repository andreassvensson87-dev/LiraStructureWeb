import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { beamSpliceDefaults } from '../src/components/beam-splice.js';
import { updateComponents } from '../src/components/fit.js';
import { resolveComponentDraft } from '../src/components/definitions.js';
import { componentInspectorSections } from '../src/components/inspector-layout.js';
import { applyObjectBatch } from '../src/model/tools/transform-tool.js';
import { componentTransformSources, componentDeletion } from '../src/components/ownership.js';
import { geometryForModel, validateObject } from '../src/model-object.js';
import { plateCorners } from '../src/plate.js';
import { meshVolume } from '../src/model/object-quantities.js';
import { transformObject } from '../src/transform.js';
import { rotateObject } from '../src/rotation.js';
import { createProject } from '../src/project/project-state.js';
import { serializeProject, parseProjectFile } from '../src/project/project-file.js';
import { profileSnapshot } from '../src/section-profile.js';
import { TIBNOR_PROFILES } from '../src/tibnor-catalog.js';
import { endplateDefaults } from '../src/components/endplate.js';
const a = {
  id: 'a',
  type: 'sweep',
  profile: 'i',
  width: 200,
  height: 300,
  thickness: 15,
  rotation: 0,
  start: [-1000, 0, 0],
  end: [0, 0, 0],
};
const b = { ...a, id: 'b', start: [0, 0, 0], end: [1000, 0, 0] };
const spec = (length = 60, standard = 'ISO 4017') => ({
  id: `${standard}-${length}`,
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
  id: 'splice',
  type: 'component',
  kind: 'beamSplice',
  ...beamSpliceDefaults,
  references: ['a', 'b'],
  boltSpec: spec(),
  ...changes,
});
const model = (changes = {}, refs = [a, b]) => updateComponents([], [...refs, draft(changes)]);
const close = (a, b) => assert.ok(Math.abs(a - b) < 0.01, `${a} != ${b}`);
const volume = (s, objects) => {
  const g = geometryForModel(s, objects),
    v = meshVolume(g);
  g.dispose();
  return v;
};
const bolts = (m) => m.filter((o) => o.componentRole === 'bolt');
test('two endplates cut both ends without rewriting nominal beams and have one through bolt group', () => {
  const m = model({ gap: 4 }),
    joint = m.find((o) => o.id === 'splice'),
    plates = m.filter((o) => o.type === 'plate');
  assert.deepEqual(m[0].end, a.end);
  assert.deepEqual(m[1].start, b.start);
  assert.equal(plates.length, 2);
  assert.equal(bolts(m).length, 4);
  close(Math.min(...plateCorners(plates[0]).map((p) => p[0])), -17);
  close(Math.max(...plateCorners(plates[0]).map((p) => p[0])), -2);
  close(Math.min(...plateCorners(plates[1]).map((p) => p[0])), 2);
  close(Math.max(...plateCorners(plates[1]).map((p) => p[0])), 17);
  for (const bolt of bolts(m)) {
    assert.equal(validateObject(bolt), '');
    assert.deepEqual(
      bolt.holes.map((h) => h.targetId),
      [plates[1].id, plates[0].id],
    );
    close(bolt.holes[0].offset, 3);
    close(bolt.holes[1].offset, 22);
    close(bolt.holes[1].depth, 15);
  }
  for (const beam of [a, b]) close(volume(beam, m) / volume(beam, [beam]), 983 / 1000);
  for (const plate of plates)
    assert.ok(
      Math.abs(
        joint.plateWidth * joint.plateLength * 15 - volume(plate, m) - 4 * Math.PI * 9 ** 2 * 15,
      ) < 20,
    );
  assert.equal(componentInspectorSections('beamSplice').flatMap((s) => s.parameters).length, 23);
});
test('end identities, reversed drawing directions and whole-model rotation retain plate and hole geometry', () => {
  for (const reverseA of [false, true])
    for (const reverseB of [false, true]) {
      const aa = structuredClone(a),
        bb = structuredClone(b);
      if (reverseA) [aa.start, aa.end] = [aa.end, aa.start];
      if (reverseB) [bb.start, bb.end] = [bb.end, bb.start];
      const m = model({ endA: reverseA ? 'start' : 'end', endB: reverseB ? 'end' : 'start' }, [
        aa,
        bb,
      ]);
      for (const beam of [aa, bb]) close(volume(beam, m) / volume(beam, [beam]), 985 / 1000);
    }
  const m = model(),
    sources = componentTransformSources(m, ['splice:plate:0']);
  const rotated = applyObjectBatch(
    m,
    sources.map((o) => rotateObject(o, [0, 0, 0], [1, 1, 1], 35)),
  ).objects;
  const q = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(1, 1, 1).normalize(),
    (35 * Math.PI) / 180,
  );
  for (let i = 0; i < 4; i++)
    assert.ok(
      new THREE.Vector3(...bolts(rotated)[i].start).distanceTo(
        new THREE.Vector3(...bolts(m)[i].start).applyQuaternion(q),
      ) < 0.003,
    );
});
test('different catalog profiles and eccentric anchors are covered, with hardware clearance checked against both', () => {
  const catalog = (name, beam) => {
    const section = profileSnapshot(TIBNOR_PROFILES.find((p) => p.name === name));
    return {
      ...beam,
      profile: 'custom',
      section,
      width: section.properties.bounds.width,
      height: section.properties.bounds.height,
    };
  };
  const refs = [catalog('HEB 300', a), catalog('HEA 300', b)];
  const m = model({}, refs);
  assert.equal(bolts(m).length, 4);
  close(m.find((o) => o.id === 'splice').plateWidth, 350);
  assert.throws(() => model({ spacingY: 280 }, refs), /liv eller flänsar/);
  const eccentric = { ...b, placement: { horizontalAlignment: 'left', verticalAlignment: 'top' } };
  const shifted = model(
    { rows: 1, columns: 1, outstandX: 200, outstandY: 200, offsetX: 100, offsetY: 300 },
    [a, eccentric],
  );
  const j = shifted.find((o) => o.id === 'splice');
  assert.ok(j.plateWidth > 250);
  assert.ok(j.plateLength > 350);
});
test('automatic length responds to plate thickness and gap; manual length and thread seating are validated', () => {
  const m = model({ boltSpec: spec(40), lengthOptions: [spec(40), spec(60), spec(80)] });
  assert.ok(bolts(m).every((o) => o.spec.length === 60));
  const changed = applyObjectBatch(m, [
    { ...m.find((o) => o.id === 'splice'), thickness: 25, gap: 4 },
  ]).objects;
  assert.ok(bolts(changed).every((o) => o.spec.length === 80));
  assert.throws(() => model({ boltSpec: spec(40), lengthMode: 'manual' }), /Muttrar|kort/);
  assert.throws(() => model({ boltSpec: spec(40) }), /Ingen passande/);
  const partial = model({
    boltSpec: spec(80, 'ISO 4014'),
    lengthOptions: [spec(60, 'ISO 4014'), spec(80, 'ISO 4014')],
  });
  assert.ok(bolts(partial).every((o) => o.spec.length === 60));
});
test('invalid alignments, wrong ends, incomplete profiles and conflicting caps are rejected transactionally', () => {
  assert.throws(() => model({}, [a, { ...b, end: [1000, 100, 0] }]), /parallella/);
  assert.throws(
    () => model({}, [a, { ...b, start: [0, 100, 0], end: [1000, 100, 0] }]),
    /samma raka/,
  );
  assert.throws(() => model({ endA: 'start' }), /mötande/);
  assert.throws(() => model({}, [a, { ...b, profile: 'rhs' }]), /H- eller I/);
  for (const c of [
    { sizeMode: 'manual', width: 20 },
    { rows: 0 },
    { holeDiameter: 12 },
    { spacingX: 20 },
    { columns: 1 },
    { offsetY: 1000 },
    { gap: -1 },
    { endA: 'x' },
  ])
    assert.throws(() => model(c));
  const cap = {
    id: 'cap',
    type: 'component',
    kind: 'endplate',
    ...endplateDefaults,
    references: ['a'],
    endA: 'end',
  };
  assert.throws(() => updateComponents([], [a, b, cap, draft()]), /redan/);
  const m = model();
  assert.throws(() => updateComponents(m, [...m, cap]), /redan/);
  const saved = structuredClone(m);
  assert.throws(() =>
    resolveComponentDraft(
      m.find((o) => o.id === 'splice'),
      { spacingX: 20 },
      m,
    ),
  );
  assert.deepEqual(m, saved);
});
test('moving references, changing profile and copying regenerate independent stable members; deletion restores ends', () => {
  const m = model(),
    sources = componentTransformSources(m, ['splice:bolt:0:0']);
  assert.equal(sources.length, 3);
  const moved = applyObjectBatch(
    m,
    sources.map((o) => transformObject(o, 'move', [0, 0, 0], [100, 200, 300])),
  ).objects;
  close(moved.find((o) => o.id === 'splice').position[0], 100);
  const changed = applyObjectBatch(m, [{ ...m[1], width: 240 }]).objects;
  close(changed.find((o) => o.id === 'splice').plateWidth, 290);
  assert.equal(bolts(changed)[0].id, bolts(m)[0].id);
  let n = 0;
  const copied = applyObjectBatch(m, [m[0], m[1]], {
    copy: true,
    newId: () => `copy${++n}`,
  }).objects;
  const owner = copied.find((o) => o.kind === 'beamSplice' && o.id !== 'splice');
  assert.ok(owner.references.every((id) => id.startsWith('copy')));
  assert.equal(copied.filter((o) => o.generatedBy === owner.id).length, 6);
  assert.ok(
    bolts(copied)
      .filter((o) => o.generatedBy === owner.id)
      .every((o) => o.holes.every((h) => h.targetId.startsWith(owner.id))),
  );
  assert.ok(updateComponents(m, m).every((o) => o === m.find((p) => p.id === o.id)));
  const remove = componentDeletion(m, ['splice:plate:0']),
    after = updateComponents(
      m,
      m.filter((o) => !remove.has(o.id)),
    );
  assert.equal(after.length, 2);
  for (const beam of [a, b]) close(volume(beam, after), volume(beam, [beam]));
  assert.deepEqual(
    updateComponents(
      m,
      m.filter((o) => o.id !== 'a'),
    ).map((o) => o.id),
    ['b'],
  );
});
test('saved joint snapshots roundtrip and missing generated children are repaired without library state', () => {
  const m = model({ lengthOptions: [spec(60), spec(80)] }),
    p = createProject({
      grid: { x: [0, 1000], y: [0, 1000] },
      levels: { active: 'l', items: [{ id: 'l', name: 'Plan', elevation: 0 }] },
    });
  p.objects = m;
  assert.deepEqual(
    JSON.parse(JSON.stringify(parseProjectFile(serializeProject(p)).objects)),
    JSON.parse(JSON.stringify(m)),
  );
  const file = JSON.parse(serializeProject(p));
  file.project.objects = file.project.objects.filter((o) => !o.generatedBy);
  assert.equal(parseProjectFile(JSON.stringify(file)).objects.length, 9);
});

test('axial endpoint changes move the joint station and extend both beams to their plate faces', () => {
  const refs = [a, { ...b, start: [100, 0, 0], end: [1100, 0, 0] }];
  const m = model({}, refs),
    joint = m.find((o) => o.id === 'splice');
  close(joint.position[0], 50);
  close(volume(refs[0], m) / volume(refs[0], [refs[0]]), 1035 / 1000);
  close(volume(refs[1], m) / volume(refs[1], [refs[1]]), 1035 / 1000);
  assert.throws(
    () => model({}, [a, { ...b, start: [-2500, 0, 0], end: [-1500, 0, 0] }]),
    /hela balken/,
  );
});
test('independent cuts removing a welding face block new and edited joints', () => {
  const cut = {
    id: 'cut',
    type: 'linecut',
    targets: ['a'],
    frame: { origin: [-100, 0, 0], u: [0, 1, 0], v: [-1, 0, 0] },
    polygon: [
      [-150, 0],
      [150, 0],
    ],
    side: 'positive',
  };
  assert.throws(() => updateComponents([], [a, b, draft(), cut]), /befintlig kapning/);
  const m = model();
  assert.throws(() => updateComponents(m, [...m, cut]), /befintlig kapning/);
});
