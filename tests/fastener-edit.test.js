import { withFastenerLength, fastenerFitWarnings } from '../src/fasteners/manual-length.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseBoltDistances,
  parseBoltCoordinates,
  patternPositions,
} from '../src/fasteners/pattern.js';
import { prepareFastenerPlacement } from '../src/fasteners/placement-draft.js';
import { resizeFastenerHoles, changeHoleSettings } from '../src/fasteners/hole-edit.js';
import { replaceFastenerGroup } from '../src/fasteners/groups.js';
import { holesForPart } from '../src/fasteners/relations.js';
import { validateFastenerGroups } from '../src/fasteners/group-data.js';
import { updateAutomaticJoints } from '../src/fasteners/update-joints.js';
import { fastenerGeometry } from '../src/fasteners/geometry.js';
import { isPhysical } from '../src/model-object.js';
import { transformObject } from '../src/transform.js';
import { fastenerType } from '../src/fasteners/object-type.js';
import { createModelEditor } from '../src/app/model-editor.js';
import { createProject } from '../src/project/project-state.js';
import { ProjectHistory } from '../src/project/project-history.js';
import { serializeProject, parseProjectFile } from '../src/project/project-file.js';

const records = [20, 24].flatMap((d) =>
  [70, 80, 90, 100, 120, 140].map((length) => ({
    id: `m${d}-${length}`,
    revision: 1,
    name: `Test M${d} × ${length}`,
    kind: 'bolt',
    standard: 'ISO 4017',
    diameter: d,
    length,
    grade: '8.8',
    coating: 'Test',
    thread: { length },
    head: { kind: 'hex', diameter: d * 1.5, height: d * 0.625 },
    nut: { acrossFlats: d * 1.5, thickness: d * 0.8 },
    washer: { innerDiameter: d + 2, outerDiameter: d * 2, thickness: 3 },
  })),
);
function fixture() {
  const project = createProject({
    grid: { x: [], y: [] },
    levels: { active: 'l', items: [{ id: 'l', name: 'Plan', elevation: 0 }] },
  });
  const a = {
    id: 'a',
    type: 'plate',
    frame: { origin: [0, 0, 0], u: [1, 0, 0], v: [0, 1, 0] },
    polygon: [
      [-180, -120],
      [180, -120],
      [180, 120],
      [-180, 120],
    ],
    thickness: 20,
    side: 'positive',
  };
  const b = { ...structuredClone(a), id: 'b', frame: { ...a.frame, origin: [0, 0, 20] } };
  const input = {
    type: 'fastener',
    spec: records.find((s) => s.diameter === 24 && s.length === 80),
    start: [-100, 30, 100],
    end: [-100, 30, 20],
    assembly: { bolt: true, nearWasher: true, farWasher: true, nut: true, extraNut: false },
    lengthMode: 'manual',
    anchorId: a.id,
    holes: [a, b].map((p) => ({
      id: `hole-${p.id}`,
      type: 'bore',
      targetId: p.id,
      kind: 'clearance',
      extent: 'profile',
      diameter: 26,
      depth: 20,
      offset: 0,
    })),
    group: {
      id: 'joint',
      shape: 'array',
      rows: 2,
      columns: 4,
      distancesX: [60, 80, 60],
      distancesY: [60],
      rotation: 0,
      origin: [-100, 30, 100],
      direction: [-100, 30, 0],
      u: [1, 0, 0],
      row: 0,
      column: 0,
    },
  };
  const prepare = (draft, model = project.objects, extra = {}) =>
    prepareFastenerPlacement(draft, {
      model,
      records,
      start: draft.group?.origin || draft.start,
      direction: draft.group?.direction || draft.end,
      ...extra,
    });
  project.objects = [a, b];
  const { batch } = prepare(input);
  project.objects.push(...batch);
  return { project, prepare, a, b, input };
}

test('spacing syntax has explicit zero and repetition semantics and rejects malformed or oversized grids', () => {
  assert.deepEqual(parseBoltDistances('60 80 60'), [60, 80, 60]);
  assert.deepEqual(parseBoltDistances('3*60'), [60, 60, 60]);
  assert.deepEqual(parseBoltDistances('0'), []);
  assert.deepEqual(parseBoltDistances('60,5 80'), [60.5, 80]);
  for (const value of ['', '0 60', '-60', '2**60', '101*60', '0*60', '1e300', '60x80'])
    assert.throws(() => parseBoltDistances(value));
  assert.deepEqual(parseBoltCoordinates('0 -60 80,5'), [0, -60, 80.5]);
  assert.throws(() => parseBoltCoordinates('NaN 1'));
  assert.throws(
    () =>
      patternPositions({
        shape: 'list',
        rows: 1,
        columns: 2,
        positions: [
          [0, 0],
          [0, 0],
        ],
      }),
    /samma position/,
  );
});

test('hardware, diameter and clearance edits refit every bolt and bore while retaining group identities', () => {
  const { project, prepare, a, b } = fixture(),
    before = structuredClone(project.objects);
  const old = project.objects.slice(2);
  const { batch: extra } = prepare({ ...old[0], assembly: { ...old[0].assembly, extraNut: true } });
  assert.ok(extra.every((s) => s.spec.length === 80));
  for (let i = 0; i < old.length; i++) {
    assert.equal(extra[i].id, old[i].id);
    assert.deepEqual(
      extra[i].holes.map((h) => h.id),
      old[i].holes.map((h) => h.id),
    );
    assert.equal(extra[i].accessories.filter((x) => x.kind === 'nut').length, 2);
    assert.deepEqual(extra[i].start.slice(0, 2), old[i].start.slice(0, 2));
  }
  const spec = records.find((s) => s.diameter === 20 && s.length === 80);
  const holes = resizeFastenerHoles(extra[0].holes, extra[0].spec, spec);
  assert.ok(holes.every((h) => h.diameter === 22));
  const { batch: smaller } = prepare({ ...extra[0], spec, holes });
  assert.ok(smaller.every((s) => s.spec.length === 80));
  const changed = changeHoleSettings(smaller[0].holes, spec, 'clearance', 4);
  const { batch: clearance } = prepare({ ...smaller[0], holes: changed });
  assert.ok(clearance.every((s) => s.holes.every((h) => h.diameter === 24)));
  assert.equal(holesForPart(a, [a, b, ...clearance]).length, 8);
  assert.equal(holesForPart(b, [a, b, ...clearance]).length, 8);
  assert.deepEqual(project.objects, before, 'proposals do not mutate the project');
});

test('pattern and hardware commits are atomic, undoable and recalculate after target thickness changes', () => {
  const { project, prepare, a } = fixture();
  const history = new ProjectHistory();
  const editor = createModelEditor({ project, checkpoint: () => history.checkpoint(project) });
  const before = structuredClone(project.objects);
  const source = project.objects[2];
  const group = { ...source.group, columns: 3, distancesX: [65, 85] };
  const { batch } = prepare({ ...source, group, assembly: { ...source.assembly, extraNut: true } });
  editor.replace(
    updateAutomaticJoints(project.objects, replaceFastenerGroup(project.objects, batch)),
  );
  assert.equal(project.objects.length, 8);
  assert.equal(holesForPart(a, project.objects).length, 6);
  assert.ok(project.objects.slice(2).every((s) => s.spec.length === 80));
  const edited = structuredClone(project.objects);
  Object.assign(project, history.undo(project));
  assert.deepEqual(project.objects, before);
  Object.assign(project, history.redo(project));
  assert.deepEqual(project.objects, edited);
  editor.update([
    { ...project.objects[0], thickness: 35 },
    { ...project.objects[1], frame: { ...project.objects[1].frame, origin: [0, 0, 35] } },
  ]);
  assert.ok(project.objects.slice(2).every((s) => s.spec.length === 80));
  assert.ok(
    project.objects.slice(2).every((s) => s.holes.find((h) => h.targetId === 'a').depth === 35),
  );
  const stable = structuredClone(project.objects),
    checkpoints = history.past.length;
  assert.throws(() => {
    const failed = prepare({ ...project.objects[2], group: { ...group, distancesX: [65, -1000] } });
    editor.replace(replaceFastenerGroup(project.objects, failed.batch));
  });
  assert.deepEqual(project.objects, stable);
  assert.equal(history.past.length, checkpoints);
  const loaded = parseProjectFile(serializeProject(project));
  assert.deepEqual(loaded.objects, JSON.parse(JSON.stringify(project.objects)));
});

test('turning bolts reverses heads and hole axes without reflecting a rotated grid or losing bore links', () => {
  const { project, prepare } = fixture();
  const { batch: initial } = prepare({
    ...project.objects[2],
    group: { ...project.objects[2].group, rotation: 20 },
  });
  const source = initial[0],
    group = source.group;
  const reversed = {
    ...group,
    reversed: true,
    direction: group.origin.map((v, i) => 2 * v - group.direction[i]),
  };
  const { batch } = prepare({ ...source, group: reversed }, [
    ...project.objects.slice(0, 2),
    ...initial,
  ]);
  for (let i = 0; i < batch.length; i++) {
    assert.equal(batch[i].id, initial[i].id);
    assert.deepEqual(
      batch[i].holes.map((h) => h.id),
      initial[i].holes.map((h) => h.id),
    );
    for (let j = 0; j < 2; j++) assert.ok(Math.abs(batch[i].start[j] - initial[i].start[j]) < 1e-6);
    assert.ok(batch[i].end[2] > batch[i].start[2]);
    assert.ok(initial[i].end[2] < initial[i].start[2]);
    assert.ok(batch[i].holes.every((h) => h.depth === 20));
  }
});

test('circle and free patterns survive edits, project reload and reject duplicate or mismatched coordinates', () => {
  const { project, prepare } = fixture();
  const source = project.objects[2];
  for (const shape of [
    { shape: 'circle', rows: 1, columns: 6, diameter: 100 },
    {
      shape: 'list',
      rows: 1,
      columns: 3,
      positions: [
        [0, 0],
        [60, 0],
        [90, 40],
      ],
    },
  ]) {
    const { batch } = prepare({ ...source, group: { ...source.group, ...shape } });
    validateFastenerGroups(batch);
    assert.equal(batch.length, shape.columns);
    const next = { ...project, objects: replaceFastenerGroup(project.objects, batch) };
    assert.deepEqual(
      parseProjectFile(serializeProject(next)).objects,
      JSON.parse(JSON.stringify(next.objects)),
    );
  }
  assert.throws(
    () =>
      prepare({
        ...source,
        group: { ...source.group, shape: 'list', rows: 1, columns: 2, positions: [[0, 0]] },
      }),
    /koordinater/,
  );
});

test('holes-only keeps all machining while omitting bolt solids; disabling holes restores material relations', () => {
  const { project, prepare, a } = fixture();
  const source = project.objects[2];
  const { batch } = prepare({
    ...source,
    assembly: {
      bolt: false,
      nearWasher: false,
      nearNut: false,
      farWasher: false,
      nut: false,
      extraNut: false,
    },
  });
  for (const screw of batch) {
    assert.equal(isPhysical(screw), false);
    const geometry = fastenerGeometry(screw);
    assert.equal(geometry.attributes.position.count, 0);
    geometry.dispose();
  }
  assert.equal(holesForPart(a, [a, ...batch]).length, 8);
  assert.throws(
    () =>
      prepare({
        ...source,
        assembly: batch[0].assembly,
        holes: changeHoleSettings(source.holes, source.spec, 'kind', 'none'),
      }),
    /minst ett hål/,
  );
  const { batch: hardwareOnly } = prepare({
    ...source,
    assembly: { ...source.assembly, bolt: false },
  });
  assert.notDeepEqual(fastenerType.partShape(hardwareOnly[0]), fastenerType.partShape(source));
  const none = changeHoleSettings(source.holes, source.spec, 'kind', 'none');
  const { batch: solid } = prepare({ ...source, holes: none });
  assert.equal(holesForPart(a, [a, ...solid]).length, 0);
  assert.ok(solid.every(isPhysical));
});

test('short manual lengths warn without blocking edits; invalid holes and incompatible hardware still reject', () => {
  const { project, prepare } = fixture(),
    source = project.objects[2],
    before = structuredClone(project.objects);
  const short = prepare({
    ...source,
    spec: withFastenerLength(source.spec, 67),
    assembly: { ...source.assembly, extraNut: true },
  });
  assert.ok(short.batch.every((s) => s.spec.length === 67 && fastenerFitWarnings(s).length));
  assert.throws(() => changeHoleSettings(source.holes, source.spec, 'clearance', -1), /Hålspel/);
  assert.throws(
    () =>
      prepare({
        ...source,
        spec: {
          ...source.spec,
          washer: { ...source.spec.washer, innerDiameter: 40, outerDiameter: 50 },
        },
      }),
    /Brickans hål/,
  );
  const corrected = prepare({ ...source, assembly: { ...source.assembly, extraNut: true } });
  assert.ok(corrected.batch.every((s) => s.spec.length === 80));
  assert.deepEqual(project.objects, before);
});

test('outside joints can be created, moved in and out, undone and reloaded without stale holes', () => {
  for (const grouped of [false, true]) {
    const { project, input, prepare, a, b } = fixture();
    const source = structuredClone(input);
    source.id = 'outside';
    source.start = [1000, 30, 100];
    source.end = [1000, 30, 0];
    if (grouped) {
      source.group.origin = [...source.start];
      source.group.direction = [...source.end];
    } else delete source.group;
    project.objects = [a, b];
    const proposal = prepare(source);
    const initial = proposal.batch || [proposal.draft];
    const history = new ProjectHistory();
    const editor = createModelEditor({ project, checkpoint: () => history.checkpoint(project) });
    editor.add(initial);
    assert.ok(initial.every((s) => s.layerCount === 0));
    assert.equal(holesForPart(a, project.objects).length, 0);
    const ids = initial.map((s) => s.id);
    const boreIds = initial.map((s) => s.holes.map((h) => h.id));
    const shift = (dx) =>
      editor.update(
        project.objects
          .filter((s) => ids.includes(s.id))
          .map((s) => transformObject(s, 'move', [0, 0, 0], [dx, 0, 0])),
      );
    shift(-1100);
    assert.equal(holesForPart(a, project.objects).length, initial.length);
    assert.equal(holesForPart(b, project.objects).length, initial.length);
    assert.ok(
      project.objects.slice(2).every((s) => s.layerCount === 2 && s.holes.every((h) => h.active)),
    );
    assert.deepEqual(
      project.objects.slice(2).map((s) => s.holes.map((h) => h.id)),
      boreIds,
    );
    shift(1100);
    assert.equal(holesForPart(a, project.objects).length, 0);
    const outside = parseProjectFile(serializeProject(project));
    assert.equal(holesForPart(outside.objects[0], outside.objects).length, 0);
    Object.assign(project, history.undo(project));
    assert.equal(holesForPart(a, project.objects).length, initial.length);
    Object.assign(project, history.redo(project));
    assert.equal(holesForPart(a, project.objects).length, 0);
    shift(-1100);
    assert.equal(holesForPart(a, project.objects).length, initial.length);
  }
});

test('a custom group length commits once, retains bores, and survives undo, redo and project files', () => {
  const { project, prepare } = fixture();
  const original = structuredClone(project.objects);
  const source = project.objects[2];
  const library = structuredClone(source.spec);
  const history = new ProjectHistory();
  const editor = createModelEditor({ project, checkpoint: () => history.checkpoint(project) });
  const { batch } = prepare({ ...source, spec: withFastenerLength(source.spec, 103) });
  editor.replace(replaceFastenerGroup(project.objects, batch));
  assert.equal(history.past.length, 1);
  assert.ok(
    project.objects.slice(2).every((s) => s.spec.length === 103 && s.spec.thread.length === 103),
  );
  assert.deepEqual(
    batch.map((s) => s.holes.map((h) => h.id)),
    original.slice(2).map((s) => s.holes.map((h) => h.id)),
  );
  assert.deepEqual(source.spec, library);
  const restored = parseProjectFile(serializeProject(project));
  assert.ok(restored.objects.slice(2).every((s) => s.spec.length === 103));
  Object.assign(project, history.undo(project));
  assert.deepEqual(project.objects, original);
  Object.assign(project, history.redo(project));
  assert.ok(project.objects.slice(2).every((s) => s.spec.length === 103));
});
