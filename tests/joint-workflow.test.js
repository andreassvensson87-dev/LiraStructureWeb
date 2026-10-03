import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createFrameExample } from '../src/project/frame-example.js';
import { createProject } from '../src/project/project-state.js';
import { ProjectHistory } from '../src/project/project-history.js';
import {
  serializeProject,
  parseProjectFile,
  projectFilename,
} from '../src/project/project-file.js';
import { automaticPlacement } from '../src/fasteners/placement.js';
import { fastenerFrame } from '../src/fasteners/geometry.js';
import { holesForPart, removeFastenerRelations } from '../src/fasteners/relations.js';
import { applyObjectBatch } from '../src/model/tools/transform-tool.js';
import { transformObject } from '../src/transform.js';
import { rotateObject } from '../src/rotation.js';
import { numberParts, partMatrix, partStatus } from '../src/part-marks.js';
import { createBatchDrawings, batchDrawingGroups } from '../src/single-part-drawings.js';
import { partHoleSchedule, partHoleCandidates } from '../src/fasteners/drawing.js';
import { resolveReference } from '../src/annotation-references.js';
import { partViewFrame } from '../src/part-view-frame.js';
import { drawingViewAtPoint } from '../src/drawing-views.js';
import { geometryForModel } from '../src/model-object.js';
import { geometryVectors } from '../src/drawing-vector.js';
import { defaultGrid } from '../src/grid-lines.js';
import { updateAutomaticJoints } from '../src/fasteners/update-joints.js';
import { initialLevels } from '../src/levels.js';

const fixture = () => {
  const project = createProject({ grid: defaultGrid, levels: initialLevels() });
  const plate = (id, z, thickness) => ({
    id,
    name: id,
    type: 'plate',
    frame: { origin: [0, 0, z], u: [1, 0, 0], v: [0, 1, 0] },
    polygon: [
      [0, 0],
      [200, 0],
      [200, 200],
      [0, 200],
    ],
    thickness,
    side: 'positive',
  });
  const a = plate('a', 0, 20),
    b = plate('b', -40, 40),
    other = plate('other', 0, 20);
  const spec = {
    id: 'M10',
    revision: 1,
    kind: 'bolt',
    name: 'M10 × 100',
    diameter: 10,
    length: 100,
    head: { kind: 'hex', diameter: 17, height: 6 },
    nut: { acrossFlats: 17, thickness: 8 },
    washer: { innerDiameter: 11, outerDiameter: 24, thickness: 2 },
  };
  const screw = automaticPlacement(
    {
      id: 's',
      name: 'Förband',
      type: 'fastener',
      spec,
      anchorId: 'a',
      washers: { head: true, nut: true },
      holes: [a, b].map((s) => ({
        id: `hole-${s.id}`,
        type: 'bore',
        targetId: s.id,
        kind: 'clearance',
        extent: 'profile',
        offset: 0,
        depth: 1,
        diameter: 12,
      })),
    },
    [100, 100, 10000],
    [100, 100, 9000],
    [a, b, other],
  );
  project.objects = [a, b, other, screw];
  project.info.name = 'Förbandstest';
  return project;
};
const makeDrawings = (project) => {
  project.parts = numberParts(project.objects, project.parts);
  const selection = new Set(project.objects.filter((o) => o.type !== 'fastener').map((o) => o.id));
  const keys = new Set(batchDrawingGroups(project, selection).map((g) => g.key));
  let id = 0;
  project.drawings = createBatchDrawings(project, selection, keys, () => `drawing-${++id}`);
};
const schedule = (project, id) => {
  const source = project.objects.find((s) => s.id === id);
  return partHoleSchedule(source, project.objects, partMatrix(source));
};

test('selected layers seat both washers and nut outside material, then refit after thickness edits', () => {
  const project = fixture();
  const original = structuredClone(project);
  const screw = project.objects.at(-1);
  assert.deepEqual(screw.start, [100, 100, 22]);
  assert.equal(screw.nutOffset, 64);
  assert.deepEqual(
    screw.holes.map((h) => [h.offset, h.depth]),
    [
      [2, 20],
      [22, 40],
    ],
  );
  assert.equal(holesForPart(project.objects[2], project.objects).length, 0);
  const history = new ProjectHistory();
  history.checkpoint(project);
  const a = { ...project.objects[0], thickness: 30 };
  project.objects = applyObjectBatch(project.objects, [a]).objects;
  const next = project.objects.at(-1);
  assert.ok(new THREE.Vector3(...next.start).distanceTo(new THREE.Vector3(100, 100, 32)) < 1e-6);
  assert.equal(next.nutOffset, 74);
  assert.deepEqual(
    next.holes.map((h) => [h.offset, h.depth]),
    [
      [2, 30],
      [32, 40],
    ],
  );
  assert.deepEqual(
    next.holes.map((h) => h.id),
    screw.holes.map((h) => h.id),
  );
  const f = fastenerFrame(next);
  const nut = f.origin.clone().addScaledVector(f.z, next.nutOffset);
  assert.ok(Math.abs(nut.z + 42) < 1e-6);
  assert.deepEqual(history.undo(project), original);
  assert.deepEqual(history.redo(original), project);
  assert.throws(
    () => applyObjectBatch(project.objects, [{ ...a, thickness: 80 }]),
    /för kort|Muttern/,
  );
  assert.equal(project.objects[0].thickness, 30, 'failed edit leaves live objects unchanged');
});

test('drawn bore contours and local machining dimensions survive moving, rotation, file reopening and undo', () => {
  let project = fixture();
  makeDrawings(project);
  const baseline = schedule(project, 'a');
  project.drawings.find((d) => d.sourceId === 'a').annotations = [
    {
      id: 'hole-dimension',
      type: 'dimension',
      kind: 'horizontal',
      view: 'top',
      points: [
        [0, 100],
        [100, 100],
      ],
      line: [0, 220],
      references: [null, partHoleCandidates(baseline, partViewFrame('top'))[0].point.reference],
    },
  ];
  assert.deepEqual(baseline[0].center, [100, 100, 20]);
  assert.match(baseline[0].label, /Ø12/);
  const drilled = geometryForModel(project.objects[0], project.objects);
  drilled.applyMatrix4(partMatrix(project.objects[0]));
  const plain = geometryForModel(project.objects[0], [project.objects[0]]);
  plain.applyMatrix4(partMatrix(project.objects[0]));
  assert.ok(geometryVectors(drilled)[0].visible.length > geometryVectors(plain)[0].visible.length);
  drilled.dispose();
  plain.dispose();
  const history = new ProjectHistory();
  history.checkpoint(project);
  project.objects = applyObjectBatch(
    project.objects,
    project.objects.map((s) => transformObject(s, 'move', [0, 0, 0], [500, 20, 30])),
  ).objects;
  project.objects = applyObjectBatch(
    project.objects,
    project.objects.map((s) => rotateObject(s, [500, 20, 30], 'Y', 35)),
  ).objects;
  const current = schedule(project, 'a');
  assert.equal(current[0].id, baseline[0].id);
  current[0].center.forEach((v, i) => assert.ok(Math.abs(v - baseline[0].center[i]) < 1e-5));
  assert.ok(partStatus(project.objects[0], project.objects, project.parts).valid);
  const text = serializeProject(project);
  const reopened = parseProjectFile(text);
  assert.deepEqual(reopened, project);
  assert.deepEqual(schedule(reopened, 'a'), current);
  const annotation = reopened.drawings.find((d) => d.sourceId === 'a').annotations[0];
  const referencePoint = resolveReference(
    annotation.references[1],
    partHoleCandidates(current, partViewFrame('top')).map((h) => h.point),
  );
  assert.ok(referencePoint.every((v) => Math.abs(v - 100) < 1e-5));
  assert.equal(projectFilename(reopened), 'Förbandstest.lira.json');
  reopened.objects.at(-1).spec.length = 200;
  assert.equal(project.objects.at(-1).spec.length, 100, 'file data is detached');
  const undone = history.undo(project);
  assert.deepEqual(schedule(undone, 'a'), baseline);
  assert.deepEqual(history.redo(undone), project);
  const screw = project.objects.at(-1);
  const changed = { ...screw, holes: screw.holes.map((h) => ({ ...h, diameter: 14 })) };
  project.objects = applyObjectBatch(project.objects, [changed]).objects;
  assert.equal(partStatus(project.objects[0], project.objects, project.parts).valid, false);
  assert.match(schedule(project, 'a')[0].label, /Ø14/);
  project.objects = removeFastenerRelations(project.objects, new Set([screw.id]));
  assert.equal(schedule(project, 'a').length, 0);
});

test('hole centre dimensions follow bore identity across diameter and position edits and report a deleted bore', () => {
  const project = fixture();
  const initial = partHoleCandidates(schedule(project, 'a'), partViewFrame('top'));
  assert.deepEqual([...initial[0].point], [100, 100]);
  const ref = JSON.parse(JSON.stringify(initial[0].point.reference));
  const screw = project.objects.at(-1);
  const moved = transformObject(
    { ...screw, holes: screw.holes.map((h) => ({ ...h, diameter: 14 })) },
    'move',
    [0, 0, 0],
    [20, 10, 0],
  );
  project.objects = applyObjectBatch(project.objects, [moved]).objects;
  const next = partHoleCandidates(schedule(project, 'a'), partViewFrame('top'));
  assert.deepEqual(
    resolveReference(
      ref,
      next.map((h) => h.point),
    ),
    [120, 110],
  );
  assert.equal(next[0].diameter, 14);
  assert.equal(resolveReference(ref, []), null);
  assert.equal(partHoleCandidates(schedule(project, 'a'), partViewFrame('front')).length, 0);
});

test('dimensions can start in an unpainted bore centre and overlapping views respect the selected view', () => {
  const a = { id: 'a', position: [10, 20], size: [50, 50] },
    b = { ...a, id: 'b', position: [40, 40] };
  assert.equal(drawingViewAtPoint([a, b], [20, 30], 'b'), a);
  assert.equal(drawingViewAtPoint([a, b], [50, 50], 'a'), a);
  assert.equal(drawingViewAtPoint([a, b], [50, 50]), b);
  assert.equal(drawingViewAtPoint([a, b], [0, 0]), null);
});

test('an isolated real frame joint retains editable drawings, selected target identities and embedded libraries after reopening', () => {
  const frame = createFrameExample('small');
  const screw = frame.objects.find((s) => s.type === 'fastener');
  frame.objects = frame.objects.filter(
    (s) => s.id === screw.id || screw.holes.some((h) => h.targetId === s.id),
  );
  makeDrawings(frame);
  assert.ok(frame.drawings.length >= 2);
  const opened = parseProjectFile(serializeProject(frame));
  assert.deepEqual(opened, frame);
  for (const part of opened.objects.filter((s) => s.type !== 'fastener')) {
    assert.equal(schedule(opened, part.id).length, 1);
    assert.deepEqual(schedule(opened, part.id), schedule(frame, part.id));
    assert.ok(partStatus(part, opened.objects, opened.parts).valid);
  }
  assert.deepEqual(opened.objects.find((s) => s.id === screw.id).spec, screw.spec);
});

test('project imports reject damaged files, duplicate objects, dangling bore targets and unsupported versions', () => {
  const original = fixture(),
    file = JSON.parse(serializeProject(original));
  assert.throws(() => parseProjectFile('{oops'), /kunde inte läsas/);
  assert.throws(() => parseProjectFile(JSON.stringify({ ...file, fileVersion: 2 })), /version/);
  for (const damage of [
    (p) => p.objects.push(structuredClone(p.objects[0])),
    (p) => (p.objects.at(-1).holes[0].targetId = 'missing'),
    (p) => (p.objects.at(-1).anchorId = 'missing'),
    (p) => (p.levels.active = 'missing'),
    (p) => (p.schemaVersion = 999),
    (p) => (p.snap.gridStep = 0),
  ]) {
    const modified = structuredClone(file);
    damage(modified.project);
    assert.throws(() => parseProjectFile(JSON.stringify(modified)));
  }
  assert.equal(original.objects.length, 4);
});

test('copying an automatic joint remaps bore ownership and deleting a layer refits the remaining hardware', () => {
  const project = fixture();
  const sources = project.objects.filter((s) => s.id !== 'other');
  const copied = applyObjectBatch(
    project.objects,
    sources.map((s) => transformObject(s, 'copy', [0, 0, 0], [500, 0, 0])),
    { copy: true },
  ).objects;
  const newScrew = copied.at(-1);
  assert.notEqual(newScrew.id, sources.at(-1).id);
  assert.ok(newScrew.holes.every((h) => !sources.some((s) => s.id === h.targetId)));
  assert.ok(newScrew.holes.every((h) => !sources.at(-1).holes.some((old) => old.id === h.id)));
  for (const part of copied.slice(project.objects.length, -1)) {
    const holes = holesForPart(part, copied);
    assert.equal(holes.length, 1);
    assert.equal(holes[0].ownerId, newScrew.id);
  }
  const remaining = updateAutomaticJoints(
    project.objects,
    removeFastenerRelations(project.objects, new Set(['a'])),
  );
  const screw = remaining.at(-1);
  assert.equal(screw.anchorId, 'b');
  assert.ok(Math.abs(screw.start[2] - 2) < 1e-6);
  assert.equal(screw.nutOffset, 44);
  assert.deepEqual(
    screw.holes.map((h) => [h.offset, h.depth]),
    [[2, 40]],
  );
});
