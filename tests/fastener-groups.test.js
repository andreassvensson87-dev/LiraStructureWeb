import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fastenerGroupBatch, replaceFastenerGroup } from '../src/fasteners/groups.js';
import {
  groupSelection,
  selectedFastenerGroup,
  validateFastenerGroups,
} from '../src/fasteners/group-data.js';
import { holesForPart, removeFastenerRelations } from '../src/fasteners/relations.js';
import { applyObjectBatch } from '../src/model/tools/transform-tool.js';
import { transformObject } from '../src/transform.js';
import { rotateObject } from '../src/rotation.js';
import { updateAutomaticJoints } from '../src/fasteners/update-joints.js';
import { serializeProject, parseProjectFile } from '../src/project/project-file.js';
import { numberParts, partStatus } from '../src/part-marks.js';

const spec = (length) => ({
  id: `m12-${length}`,
  revision: 1,
  name: `M12 × ${length}`,
  kind: 'bolt',
  standard: 'ISO 4017',
  diameter: 12,
  length,
  thread: { length },
  head: { kind: 'hex', diameter: 18, height: 7.5 },
  nut: { acrossFlats: 18, thickness: 10 },
  washer: { innerDiameter: 13, outerDiameter: 24, thickness: 2.5 },
});
const plate = {
  id: 'p',
  type: 'plate',
  name: 'Plåt',
  frame: { origin: [0, 0, 0], u: [1, 0, 0], v: [0, 1, 0] },
  polygon: [
    [-160, -160],
    [160, -160],
    [160, 160],
    [-160, 160],
  ],
  thickness: 20,
  side: 'positive',
};
const draft = {
  type: 'fastener',
  spec: spec(40),
  start: [-60, 60, 40],
  end: [-60, 60, 0],
  holes: [
    {
      id: 'template-hole',
      targetId: 'p',
      kind: 'clearance',
      extent: 'profile',
      offset: 0,
      depth: 20,
      diameter: 14,
    },
  ],
  anchorId: 'p',
  assembly: { nearWasher: true, farWasher: true, nut: true },
  lengthMode: 'auto',
  extraLength: 5,
  lengthOptions: [spec(40), spec(50), spec(60)],
  group: {
    id: 'grid',
    rows: 2,
    columns: 2,
    spacingX: 60,
    spacingY: 60,
    rotation: 0,
    origin: [-60, 60, 40],
    direction: [-60, 60, 0],
    u: [1, 0, 0],
    row: 0,
    column: 0,
  },
};
const close = (a, b) => a.forEach((v, i) => assert.ok(Math.abs(v - b[i]) < 1e-6, `${a} != ${b}`));
test('grid creates independent screws and bores with common surface-fitted hardware', () => {
  const input = structuredClone(draft);
  const batch = fastenerGroupBatch(draft, [plate]);
  assert.equal(batch.length, 4);
  assert.equal(new Set(batch.map((s) => s.id)).size, 4);
  assert.equal(new Set(batch.map((s) => s.holes[0].id)).size, 4);
  close(batch[0].start, [-60, 60, 22.5]);
  close(batch[3].start, [0, 0, 22.5]);
  assert.ok(batch.every((s) => s.spec.length === 40));
  assert.equal(holesForPart(plate, [plate, ...batch]).length, 4);
  assert.deepEqual(draft, input);
  validateFastenerGroups(batch);
});
test('rotated grid uses its local plane, including inclined screw axes', () => {
  const rotated = fastenerGroupBatch(
    { ...draft, group: { ...draft.group, rotation: 90 } },
    [plate],
    { fit: false },
  );
  close(rotated[1].start, [-60, 0, 40]);
  close(rotated[2].start, [-120, 60, 40]);
  const inclined = {
    ...draft,
    group: { ...draft.group, origin: [0, 0, 0], direction: [0, 10, 10], u: [1, 0, 0] },
  };
  const batch = fastenerGroupBatch(inclined, [], { fit: false });
  close(batch[3].start, [60, 60 / Math.sqrt(2), -60 / Math.sqrt(2)]);
});
test('grid edits preserve existing cells and bore references, remove obsolete cells atomically', () => {
  const batch = fastenerGroupBatch(draft, [plate]);
  const edited = fastenerGroupBatch({ ...batch[0], group: { ...batch[0].group, columns: 3 } }, [
    plate,
    ...batch,
  ]);
  for (const s of batch) {
    const same = edited.find(
      (n) => n.group.row === s.group.row && n.group.column === s.group.column,
    );
    assert.equal(same.id, s.id);
    assert.equal(same.holes[0].id, s.holes[0].id);
  }
  const small = fastenerGroupBatch(
    { ...edited[0], group: { ...edited[0].group, rows: 1, columns: 1 } },
    [plate, ...edited],
  );
  const model = replaceFastenerGroup([plate, ...edited], small);
  assert.equal(model.length, 2);
  assert.equal(holesForPart(plate, model).length, 1);
  assert.equal(model[1].id, batch[0].id);
});
test('each cell adapts to the material it intersects and updates after thickness changes', () => {
  const packing = {
    ...plate,
    id: 'packing',
    name: 'Distansplåt',
    frame: { ...plate.frame, origin: [0, 0, 20] },
    polygon: [
      [-10, -160],
      [20, -160],
      [20, 160],
      [-10, 160],
    ],
    thickness: 10,
  };
  const d = {
    ...draft,
    holes: [...draft.holes, { ...draft.holes[0], id: 'packing-hole', targetId: 'packing' }],
  };
  const batch = fastenerGroupBatch(d, [plate, packing]);
  assert.deepEqual(
    batch.map((s) => s.spec.length),
    [40, 50, 40, 50],
  );
  assert.equal(holesForPart(packing, batch).length, 2);
  assert.equal(batch[0].holes[1].active, false);
  const updated = updateAutomaticJoints(
    [plate, packing, ...batch],
    [
      { ...plate, thickness: 30 },
      { ...packing, frame: { ...packing.frame, origin: [0, 0, 30] } },
      ...batch,
    ],
  );
  assert.deepEqual(
    updated.slice(2).map((s) => s.spec.length),
    [50, 60, 50, 60],
  );
});
test('group selection, move, rotation and reference following retain a shared frame', () => {
  const batch = fastenerGroupBatch(draft, [plate]);
  const model = [plate, ...batch];
  assert.equal(groupSelection(model, [batch[2].id]).size, 4);
  assert.equal(selectedFastenerGroup(batch), batch[0]);
  assert.equal(selectedFastenerGroup([plate, ...batch]), null);
  const rotated = applyObjectBatch(
    model,
    [plate, ...batch].map((s) => rotateObject(s, [0, 0, 0], 'Z', 20)),
  ).objects;
  validateFastenerGroups(rotated);
  const followed = applyObjectBatch(model, [
    transformObject(plate, 'move', [0, 0, 0], [5, 7, 9]),
  ]).objects;
  close(followed[1].group.origin, [-55, 67, 49]);
  validateFastenerGroups(followed);
  const moved = applyObjectBatch(
    model,
    batch.map((s) => transformObject(s, 'move', [0, 0, 0], [10, 0, 0])),
  ).objects;
  close(moved[1].group.origin, [-50, 60, 40]);
  validateFastenerGroups(moved);
});
test('copy creates a separate grid and remaps copied target parts and bore identities', () => {
  const batch = fastenerGroupBatch(draft, [plate]);
  const model = [plate, ...batch];
  const copied = applyObjectBatch(model, model, { copy: true }).objects.slice(model.length);
  assert.notEqual(copied[1].group.id, 'grid');
  assert.equal(new Set(copied.slice(1).map((s) => s.group.id)).size, 1);
  assert.ok(copied.slice(1).every((s) => s.anchorId === copied[0].id));
  assert.notEqual(copied[1].holes[0].id, batch[0].holes[0].id);
  validateFastenerGroups([...model, ...copied]);
});
test('group settings survive project reload; missing cells and impossible placements fail', () => {
  const batch = fastenerGroupBatch(draft, [plate]);
  const project = JSON.parse(
    readFileSync(new URL('../examples/forbandstest.lira.json', import.meta.url)),
  ).project;
  Object.assign(project, {
    objects: [plate, ...batch],
    parts: { registry: [], assignments: {} },
    drawings: [],
    assemblies: [],
  });
  const loaded = parseProjectFile(serializeProject(project));
  assert.deepEqual(loaded.objects[1].group, batch[0].group);
  assert.throws(() => validateFastenerGroups(batch.slice(1)), /saknar skruvar/);
  assert.throws(
    () =>
      fastenerGroupBatch({ ...draft, group: { ...draft.group, columns: 11, rows: 10 } }, [plate]),
    /1–100/,
  );
  assert.throws(
    () => fastenerGroupBatch({ ...draft, group: { ...draft.group, spacingX: 0 } }, [plate]),
    /positivt skruvavstånd/,
  );
  assert.throws(
    () => fastenerGroupBatch({ ...draft, group: { ...draft.group, spacingX: 500 } }, [plate]),
    /rad 1, kolumn 2/,
  );
});
test('grid edits invalidate machined plate numbering; removing a group restores all its bores', () => {
  const batch = fastenerGroupBatch(draft, [plate]);
  const model = [plate, ...batch];
  const numbered = numberParts(model);
  const changed = fastenerGroupBatch(
    { ...batch[0], group: { ...batch[0].group, spacingX: 70 } },
    model,
  );
  const after = replaceFastenerGroup(model, changed);
  assert.equal(partStatus(plate, after, numbered).valid, false);
  const removed = removeFastenerRelations(model, groupSelection(model, [batch[0].id]));
  assert.equal(removed.length, 1);
  assert.equal(holesForPart(plate, removed).length, 0);
});
