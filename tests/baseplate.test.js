import { updateAutomaticJoints } from '../src/fasteners/update-joints.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { baseplateDefaults, resolveBaseplate } from '../src/components/baseplate.js';
import { updateComponents } from '../src/components/fit.js';
import { componentDeletion, componentTransformSources } from '../src/components/ownership.js';
import { applyObjectBatch } from '../src/model/tools/transform-tool.js';
import { transformObject } from '../src/transform.js';
import { rotateObject } from '../src/rotation.js';
import { geometryForModel, validateObject } from '../src/model-object.js';
import { holesForPart } from '../src/fasteners/relations.js';
import { groupPoint, validateFastenerGroups } from '../src/fasteners/group-data.js';
import { axisPoint } from '../src/fasteners/geometry.js';
import { createProject } from '../src/project/project-state.js';
import { serializeProject, parseProjectFile } from '../src/project/project-file.js';
import { meshVolume } from '../src/model/object-quantities.js';
import { numberParts, partStatus } from '../src/part-marks.js';
const column = {
  id: 'column',
  type: 'sweep',
  name: 'Pelare',
  profile: 'rhs',
  width: 100,
  height: 100,
  thickness: 5,
  rotation: 0,
  start: [0, 0, 0],
  end: [0, 0, 1500],
};
const rod = {
  id: 'm20-400',
  revision: 1,
  name: 'M20 × 400',
  kind: 'rod',
  diameter: 20,
  length: 400,
  thread: { length: 400 },
  nut: { acrossFlats: 30, thickness: 16 },
  washer: { innerDiameter: 22, outerDiameter: 40, thickness: 3 },
};
const concrete = {
  id: 'c16-200',
  revision: 1,
  name: 'Betongskruv 16 × 200',
  kind: 'concrete',
  diameter: 16,
  length: 200,
  head: { kind: 'hex', diameter: 24, height: 10 },
  washer: { innerDiameter: 18, outerDiameter: 32, thickness: 3 },
  anchor: { embedment: 140, drillDiameter: 16, drillDepth: 150 },
};
const draft = (changes = {}) => ({
  id: 'foot',
  type: 'component',
  kind: 'baseplate',
  name: 'Fotplåt',
  ...baseplateDefaults,
  references: ['column'],
  ...changes,
});
const model = (changes = {}, member = column) => updateComponents([], [member, draft(changes)]);
const member = (objects, role) => objects.find((s) => s.componentRole === role);
const close = (actual, expected) =>
  assert.ok(Math.abs(actual - expected) < 0.001, `${actual} vs ${expected}`);
function bounds(s, objects) {
  const g = geometryForModel(s, objects);
  g.computeBoundingBox();
  const result = g.boundingBox.clone();
  g.dispose();
  return result;
}
test('baseplate follows the lower column end, sizes by profile, and cuts only below its top face', () => {
  for (const c of [column, { ...column, start: column.end, end: column.start }]) {
    const objects = model({ endA: c === column ? 'start' : 'end', elevationOffset: 50 }, c);
    objects.forEach((s) => assert.equal(validateObject(s), '', s.name));
    const plate = member(objects, 'plate');
    close(bounds(plate, objects).min.z, 30);
    close(bounds(plate, objects).max.z, 50);
    close(bounds(c, objects).min.z, 50);
    close(bounds(c, objects).max.z, 1500);
    assert.equal(objects.find((s) => s.id === 'foot').plateWidth, 250);
  }
  const below = model({ elevationOffset: -100 });
  close(bounds(column, below).min.z, -100);
});
test('inclined columns meet a horizontal plate without losing the complete end face', () => {
  const c = { ...column, end: [500, 300, 1500] };
  const objects = model({}, c);
  close(bounds(c, objects).min.z, 0);
  close(bounds(member(objects, 'plate'), objects).max.z, 0);
  assert.ok(objects.find((s) => s.kind === 'baseplate').profileWidth >= 100);
  assert.throws(() => model({ width: 30, sizeMode: 'manual' }), /rymma pelarens/);
  assert.throws(() => model({}, { ...column, end: [1000, 0, 0] }), /nedre ände/);
});
test('rod grid creates stable independent steel bores and hardware above the plate', () => {
  const objects = model({ anchorKind: 'rod', anchorSpec: rod, doubleNut: true });
  validateFastenerGroups(objects);
  const plate = member(objects, 'plate'),
    screws = objects.filter((s) => s.componentRole === 'anchor');
  assert.equal(screws.length, 4);
  assert.equal(holesForPart(plate, objects).length, 4);
  for (const s of screws) {
    assert.equal(validateObject(s), '');
    close(s.end[2], -170);
    assert.deepEqual(s.start, groupPoint(s.group, s.group.row, s.group.column));
    for (const item of s.accessories)
      assert.ok(axisPoint(s, item.offset + rod[item.kind].thickness)[2] >= -0.001);
  }
  const g = geometryForModel(plate, objects);
  assert.ok(meshVolume(g) < 250 * 250 * 20 - 25000);
  g.dispose();
  assert.equal(column.start[2], 0);
});
test('concrete anchors respect product embedment, and make holes only in the steel plate', () => {
  const objects = model({ anchorKind: 'concrete', anchorSpec: concrete, holeDiameter: 18 });
  for (const s of objects.filter((s) => s.componentRole === 'anchor')) {
    close(s.start[2], 3);
    close(s.end[2], -197);
    assert.deepEqual(
      s.holes.map((h) => h.targetId),
      ['foot:plate'],
    );
    assert.equal(s.spec.anchor.drillDepth, 150);
  }
  assert.throws(
    () =>
      model({ anchorKind: 'concrete', anchorSpec: { ...concrete, length: 150 }, holeDiameter: 18 }),
    /för kort/,
  );
});
test('invalid anchor patterns fail before replacing the saved component', () => {
  const config = { anchorKind: 'rod', anchorSpec: rod };
  for (const invalid of [
    { spacingX: 300 },
    { spacingX: 10 },
    { spacingX: 60, spacingY: 60 },
    { embedment: 370 },
    { holeDiameter: 10 },
    { rows: 0 },
  ])
    assert.throws(() => model({ ...config, ...invalid }));
  assert.throws(
    () => updateComponents([], [column, draft(), draft({ id: 'second' })]),
    /redan en fotplåt/,
  );
});
test('column and component edits update children with stable identities and numbering invalidation', () => {
  const before = model({ anchorKind: 'rod', anchorSpec: rod });
  assert.ok(
    updateComponents(before, before).every((s) => s === before.find((old) => old.id === s.id)),
  );
  const numbered = numberParts(before);
  const plate = member(before, 'plate');
  const after = applyObjectBatch(before, [
    { ...before.find((s) => s.id === 'foot'), thickness: 30, spacingX: 180 },
  ]).objects;
  const newPlate = member(after, 'plate');
  assert.equal(plate.id, newPlate.id);
  assert.equal(plate.number, newPlate.number);
  assert.equal(partStatus(newPlate, after, numbered).valid, false);
  close(member(after, 'anchor').start[2], 220);
  assert.equal(plate.thickness, 20);
  const wider = applyObjectBatch(before, [{ ...column, width: 150 }]).objects;
  assert.equal(wider.find((s) => s.id === 'foot').plateWidth, 300);
});
test('move, rotate, and copy operate through the column reference and regenerate separate children', () => {
  const before = model({ anchorKind: 'rod', anchorSpec: rod });
  const sources = componentTransformSources(before, new Set(['foot:plate']));
  assert.deepEqual(
    sources.map((s) => s.id),
    ['column', 'foot'],
  );
  const moved = applyObjectBatch(
    before,
    sources.map((s) => transformObject(s, 'move', [0, 0, 0], [1000, 0, 100])),
  ).objects;
  close(member(moved, 'plate').frame.origin[0], 1000);
  close(member(moved, 'plate').frame.origin[2], 100);
  close(member(moved, 'anchor').end[2], -70);
  const rotated = applyObjectBatch(before, [
    rotateObject(column, [0, 0, 0], [0, 0, 1], 30),
  ]).objects;
  assert.notDeepEqual(member(rotated, 'plate').frame.u, member(before, 'plate').frame.u);
  let n = 0;
  const copied = applyObjectBatch(
    before,
    [transformObject(column, 'copy', [0, 0, 0], [1000, 0, 0])],
    { copy: true, newId: () => `copy-${++n}` },
  ).objects;
  const copy = copied.find((s) => s.kind === 'baseplate' && s.id !== 'foot');
  assert.deepEqual(copy.references, ['copy-1']);
  const children = copied.filter((s) => s.generatedBy === copy.id);
  assert.equal(children.length, 5);
  assert.equal(children[1].holes[0].targetId, children[0].id);
  assert.notEqual(children[1].group.id, member(before, 'anchor').group.id);
});
test('deletion restores the uncut column and removes all owned parts, including deletion via a child', () => {
  const before = model({ elevationOffset: 50, anchorKind: 'rod', anchorSpec: rod });
  const ids = componentDeletion(before, ['foot:anchor:0:0']);
  const after = updateComponents(
    before,
    before.filter((s) => !ids.has(s.id)),
  );
  assert.deepEqual(after, [column]);
  close(bounds(column, after).min.z, 0);
  assert.deepEqual(
    updateComponents(
      before,
      before.filter((s) => s.id !== 'column'),
    ),
    [],
  );
});
test('project reload regenerates physical members and rejects missing references or orphan parts', () => {
  const project = createProject({
    grid: { x: [0, 1000], y: [0, 1000] },
    levels: { active: 'l', items: [{ id: 'l', name: 'Plan', elevation: 0 }] },
  });
  project.objects = model({ anchorKind: 'rod', anchorSpec: rod });
  const encoded = serializeProject(project),
    loaded = parseProjectFile(encoded);
  assert.deepEqual(loaded.objects, project.objects);
  const file = JSON.parse(encoded);
  file.project.objects = file.project.objects.filter((s) => !s.generatedBy);
  assert.equal(parseProjectFile(JSON.stringify(file)).objects.length, 7);
  file.project.objects[1].references = ['missing'];
  assert.throws(() => parseProjectFile(JSON.stringify(file)), /pelare/);
  const orphan = JSON.parse(encoded);
  orphan.project.objects = orphan.project.objects.filter((s) => s.id !== 'foot');
  assert.throws(() => parseProjectFile(JSON.stringify(orphan)), /saknar sin koppling/);
});

test('separately placed fasteners follow generated plate movement and lose bores when the owner disappears', () => {
  const before = model();
  const extra = {
    id: 'extra',
    type: 'fastener',
    name: 'Extra skruv',
    spec: rod,
    start: [120, 0, 30],
    end: [120, 0, -370],
    accessories: [],
    anchorId: 'foot:plate',
    holes: [
      {
        id: 'extra-hole',
        targetId: 'foot:plate',
        kind: 'clearance',
        extent: 'manual',
        offset: 30,
        depth: 20,
        diameter: 22,
      },
    ],
  };
  before.push(extra);
  const moved = applyObjectBatch(before, [
    transformObject(column, 'move', [0, 0, 0], [1000, 0, 100]),
  ]).objects;
  assert.deepEqual(moved.find((s) => s.id === 'extra').start, [1120, 0, 130]);
  const removed = updateAutomaticJoints(
    before,
    before.filter((s) => s.id !== 'column'),
  );
  assert.equal(removed.length, 1);
  assert.deepEqual(removed[0].holes, []);
  assert.equal(removed[0].anchorId, null);
  const sources = componentTransformSources(before, ['foot:plate', 'extra']);
  let n = 0;
  const copied = applyObjectBatch(
    before,
    sources.map((s) => transformObject(s, 'copy', [0, 0, 0], [1000, 0, 0])),
    { copy: true, newId: () => `new-${++n}` },
  ).objects;
  const owner = copied.find((s) => s.kind === 'baseplate' && s.id !== 'foot');
  const screw = copied.find((s) => s.type === 'fastener' && s.id !== 'extra');
  assert.equal(screw.anchorId, `${owner.id}:plate`);
  assert.equal(screw.holes[0].targetId, `${owner.id}:plate`);
});
