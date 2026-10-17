import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { defaultFasteners } from '../src/fasteners/default-catalog.js';
import { defaultHoleForSpec } from '../src/fasteners/library.js';
import {
  preparePickedFasteners,
  prepareFastenerPlacement,
} from '../src/fasteners/placement-draft.js';
import { fastenerFrame } from '../src/fasteners/geometry.js';
import { fastenerLayoutAnchors } from '../src/fasteners/placement-frame.js';
import { validateFastenerGroups } from '../src/fasteners/group-data.js';
import { selectionGrips, moveGripPoints, gripWorkPlane } from '../src/model/grips.js';
import { rotateObject } from '../src/rotation.js';
import { createModelEditor } from '../src/app/model-editor.js';
import { createProject } from '../src/project/project-state.js';
import { ProjectHistory } from '../src/project/project-history.js';
import { serializeProject, parseProjectFile } from '../src/project/project-file.js';
import { fastenerPreviewOverlay } from '../src/fasteners/preview.js';

const frame = { origin: [0, 0, 0], u: [1, 0, 0], v: [0, 1, 0] };
const plate = {
  id: 'p',
  type: 'plate',
  name: 'Plåt',
  frame,
  polygon: [
    [-300, -300],
    [300, -300],
    [300, 300],
    [-300, 300],
  ],
  thickness: 20,
  side: 'positive',
};
const spec = defaultFasteners().find((s) => s.standard === 'ISO 4017' && s.diameter === 12);
function fixture(single = false) {
  const draft = {
    type: 'fastener',
    spec,
    assembly: { bolt: true, nearWasher: true, farWasher: true, nut: true },
    anchorId: 'p',
    holes: [defaultHoleForSpec(spec, 'p')],
    group: {
      id: 'g',
      shape: 'array',
      rows: single ? 1 : 2,
      columns: single ? 1 : 3,
      distancesX: single ? [] : [60, 80],
      distancesY: single ? [] : [50],
      rotation: 0,
    },
  };
  const batch = preparePickedFasteners(draft, {
    start: [0, 0, 20],
    xPoint: [200, 0, 20],
    frame,
    model: [plate],
  }).map((s, i) => ({ ...s, prefix: 'SK', number: i + 1, name: `Skruv ${i + 1}` }));
  const project = createProject({
    grid: { x: [], y: [] },
    levels: { active: 'level', items: [{ id: 'level', name: 'Plan', elevation: 0 }] },
  });
  project.objects = [plate, ...batch];
  const history = new ProjectHistory();
  const editor = createModelEditor({ project, checkpoint: () => history.checkpoint(project) });
  return { batch, project, history, editor };
}
const close = (a, b) => a.forEach((v, i) => assert.ok(Math.abs(v - b[i]) < 1e-6, `${a} ≠ ${b}`));
const identities = (batch) =>
  batch.map((s) => [s.id, s.prefix, s.number, s.holes.map((h) => h.id)]);

test('one and many screws expose two shared pattern grips and retain identity through direction, move and history', () => {
  for (const single of [true, false]) {
    const f = fixture(single),
      before = structuredClone(f.project.objects);
    const grips = selectionGrips(f.project.objects, new Set(f.batch.map((s) => s.id)));
    assert.equal(grips.length, 2);
    assert.equal(grips[0].refs.length, f.batch.length);
    close(grips[0].point, [0, 0, 20]);
    close(grips[1].point, [200, 0, 20]);
    const edited = moveGripPoints(
      f.batch,
      grips[1].refs,
      [0, 200, 20],
      grips[1].point,
      f.project.objects,
    );
    assert.deepEqual(f.project.objects, before, 'grip preview never mutates the project');
    assert.deepEqual(identities(edited), identities(f.batch));
    for (const s of edited) {
      close(fastenerFrame(s).z.toArray(), [0, 0, -1]);
      assert.equal(s.spec.length, spec.length);
      close(s.layout.frame.u, [0, 1, 0]);
      assert.equal(s.holes[0].active, true);
    }
    if (!single) close(edited.at(-1).group.origin, [0, 0, 20]);
    validateFastenerGroups(edited);
    f.editor.update(edited);
    const rotated = structuredClone(f.project.objects);
    const movedGrips = selectionGrips(rotated, new Set(edited.map((s) => s.id)));
    const moved = moveGripPoints(
      edited,
      movedGrips[0].refs,
      [1030, 2040, 0],
      [1000, 2000, 0],
      rotated,
    );
    f.editor.update(moved);
    close(fastenerLayoutAnchors(f.project.objects[1])[0], [30, 40, 20]);
    assert.deepEqual(identities(f.project.objects.slice(1)), identities(f.batch));
    const loaded = parseProjectFile(serializeProject(f.project));
    assert.deepEqual(loaded.objects, f.project.objects);
    assert.deepEqual(f.history.undo(f.project).objects, rotated);
    assert.deepEqual(f.history.redo(f.project).objects, f.project.objects);
  }
});

test('X grips follow inclined pattern planes; invalid directions cannot enter a transaction', () => {
  const f = fixture();
  const axis = new THREE.Vector3(0, 1, 0),
    turn = (s) => rotateObject(s, [0, 0, 0], axis.toArray(), 35);
  f.project.objects = f.project.objects.map(turn);
  const batch = f.project.objects.slice(1),
    source = batch[0];
  const grips = selectionGrips(f.project.objects, new Set(batch.map((s) => s.id)));
  const plane = gripWorkPlane(batch, grips[1].refs, grips[1].point);
  close(plane.u, source.layout.frame.u);
  const origin = source.layout.frame.origin;
  const target = origin.map((v, i) => v + source.layout.frame.v[i] * 150);
  const edited = moveGripPoints(batch, grips[1].refs, target, grips[1].point, f.project.objects);
  close(edited[0].layout.frame.u, source.layout.frame.v);
  close(fastenerFrame(edited[0]).z.toArray(), fastenerFrame(source).z.toArray());
  assert.equal(edited[0].layout.xLength, 150);
  assert.deepEqual(identities(edited), identities(batch));
  assert.deepEqual(f.project.objects.slice(1), batch);
  assert.throws(
    () => moveGripPoints(batch, grips[1].refs, origin, grips[1].point, f.project.objects),
    /X-riktning/,
  );
  assert.equal(f.history.canUndo, false);
});

test('a one-position group keeps the original screw and bore when its pattern is expanded or reduced', () => {
  const f = fixture(true);
  const source = f.batch[0];
  const larger = prepareFastenerPlacement(
    { ...source, group: { ...source.group, columns: 3, distancesX: [60, 80] } },
    { model: f.project.objects },
  ).batch;
  assert.equal(larger.length, 3);
  assert.deepEqual(identities(larger.slice(0, 1)), identities([source]));
  f.editor.replace([plate, ...larger]);
  const smaller = prepareFastenerPlacement(
    { ...larger[0], group: { ...larger[0].group, columns: 1, distancesX: [] } },
    { model: f.project.objects },
  ).batch;
  f.editor.replace([plate, ...smaller]);
  assert.deepEqual(identities(smaller), identities([source]));
  assert.equal(f.project.objects.length, 2);
  assert.equal(f.history.undo(f.project).objects.length, 4);
});

test('preview marks only reached layer surfaces and frees its independent graphics', () => {
  const f = fixture(true),
    source = f.batch[0];
  const snapshot = structuredClone(source);
  const overlay = fastenerPreviewOverlay([source]);
  const rings = overlay.getObjectByName('Nådda materiallager');
  const p = rings.geometry.attributes.position;
  assert.ok(p.count > 0);
  for (let i = 0; i < p.count; i++)
    assert.ok(
      Math.abs(p.getZ(i)) < 0.03 || Math.abs(p.getZ(i) - 20) < 0.03,
      'only entry and exit faces are highlighted',
    );
  const inactive = fastenerPreviewOverlay([
    { ...source, holes: source.holes.map((h) => ({ ...h, active: false })) },
  ]);
  assert.equal(
    inactive.getObjectByName('Nådda materiallager').geometry.attributes.position.count,
    0,
  );
  assert.deepEqual(source, snapshot);
  for (const root of [overlay, inactive])
    root.traverse((child) => {
      child.geometry?.dispose();
      child.material?.dispose();
    });
});
