import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { cornerPath } from '../src/model/geometry/corner-path.js';
import { polysweepGeometry, polysweepPath, validatePolysweep } from '../src/model/polysweep.js';
import {
  plateArea,
  plateContour,
  plateVertices,
  plateGeometry,
  validatePlate,
} from '../src/plate.js';
import { pointRadiusBatch, editPolysweepPoint } from '../src/model/insertion-point-edit.js';
import { moveGripPoints, selectionGrips } from '../src/model/grips.js';
import { transformObject } from '../src/transform.js';
import { rotateObject } from '../src/rotation.js';
import { objectAnchors, objectSegments } from '../src/model-object.js';
import { meshVolume, objectQuantities, sweepArea } from '../src/model/object-quantities.js';
import { createProject } from '../src/project/project-state.js';
import { ProjectHistory } from '../src/project/project-history.js';
import { createModelEditor } from '../src/app/model-editor.js';
import { parseProjectFile, serializeProject } from '../src/project/project-file.js';
import { partKey, numberParts } from '../src/part-marks.js';
import { defaultNumberingSettings } from '../src/numbering/plan.js';
import { buildPlanObjects } from '../src/plan-view-geometry.js';
import { editPlateVertex } from '../src/plate-vertices.js';
const poly = () => ({
  id: 'poly',
  type: 'polysweep',
  name: 'Polysweep',
  prefix: 'B',
  number: 1,
  profile: 'rhs',
  width: 100,
  height: 100,
  thickness: 5,
  rotation: 0,
  points: [
    [0, 0, 0],
    [2000, 0, 0],
    [2000, 1500, 0],
    [3500, 1500, 0],
    [3500, 1500, 1000],
  ],
  radii: [0, 150, 150, 0, 0],
  material: { id: 'steel', revision: 1, name: 'S355', density: 7850 },
  partSeries: { prefix: 'PS', start: 100 },
});
const plate = () => ({
  id: 'plate',
  type: 'plate',
  name: 'Plate',
  prefix: 'P',
  number: 1,
  frame: { origin: [4500, 0, 0], u: [1, 0, 0], v: [0, 1, 0] },
  polygon: [
    [0, 0],
    [2000, 0],
    [2000, 1200],
    [0, 1200],
  ],
  radii: [0, 0, 100, 100],
  thickness: 10,
  side: 'positive',
  partSeries: { prefix: 'PL', start: 200 },
});
test('open and closed paths have true tangent radii, retain control vertices and reject invalid adjacent radii', () => {
  const source = [
      [0, 0, 0],
      [1000, 0, 0],
      [1000, 1000, 0],
    ],
    original = structuredClone(source);
  const path = cornerPath(source, [0, 100, 0]);
  assert.ok(Math.abs(path.length - (1800 + Math.PI * 50)) < 1e-8);
  assert.deepEqual(path.corners[1].entry.toArray(), [900, 0, 0]);
  assert.ok(path.corners[1].exit.distanceTo(new THREE.Vector3(1000, 100, 0)) < 1e-8);
  assert.deepEqual(source, original);
  for (const sample of path.samples.filter((s) => s.center))
    assert.ok(Math.abs(sample.point.distanceTo(sample.center) - 100) < 1e-6);
  assert.throws(() => cornerPath(source, [10, 0, 0]), /Ändpunkter/);
  assert.throws(() => cornerPath(source, [0, 1100, 0]), /plats/);
  assert.throws(() => cornerPath(source, [0, -1, 0]), /radie/);
  assert.throws(
    () =>
      cornerPath(
        [
          [0, 0, 0],
          [100, 0, 0],
          [0, 0, 0],
        ],
        [0, 0, 0],
      ),
    /tillbaka/,
  );
  assert.throws(
    () =>
      cornerPath(
        [
          [0, 0],
          [100, 0],
          [100, 100],
          [0, 100],
        ],
        [60, 60, 0, 0],
        true,
      ),
    /plats/,
  );
});
test('polysweep keeps a hollow closed solid through sharp and radiused 3D turns and uses path length for quantities', () => {
  const s = poly();
  assert.equal(validatePolysweep(s), '');
  const g = polysweepGeometry(s),
    expected = sweepArea(s) * polysweepPath(s).length;
  assert.ok(Math.abs(meshVolume(g) - expected) / expected < 0.001);
  assert.equal(g.attributes.position.array.every(Number.isFinite), true);
  g.dispose();
  assert.deepEqual(objectAnchors(s), s.points);
  assert.ok(objectSegments(s, [s]).length > 4);
  const quantities = objectQuantities(s, [s]);
  assert.equal(quantities.lengthMm, polysweepPath(s).length);
  assert.ok(quantities.massKg > 0);
  assert.equal(quantities.areaMm2, 1900);
  const invalid = { ...s, radii: [0, 20, 150, 0, 0] };
  assert.match(validatePolysweep(invalid), /för liten/);
  const two = {
    ...s,
    points: [
      [0, 0, 0],
      [2000, 0, 0],
    ],
    radii: [0, 0],
  };
  const straight = polysweepGeometry(two);
  assert.ok(Math.abs(meshVolume(straight) - 3800000) < 1);
  straight.dispose();
});
test('plate radii change only its real contour, area, snap and solid, including reversed winding', () => {
  const s = plate(),
    original = plateVertices(s);
  assert.equal(validatePlate(s), '');
  const expected = 2400000 - 2 * 10000 * (1 - Math.PI / 4);
  assert.ok(Math.abs(plateArea(s) - expected) < 5);
  assert.deepEqual(plateVertices(s), original);
  assert.ok(plateContour(s).length > 4);
  const g = plateGeometry(s);
  assert.ok(Math.abs(meshVolume(g) - plateArea(s) * 10) / (plateArea(s) * 10) < 0.00001);
  g.dispose();
  const reversed = { ...s, polygon: [...s.polygon].reverse(), radii: [...s.radii].reverse() };
  assert.equal(validatePlate(reversed), '');
  assert.ok(Math.abs(plateArea(reversed) - plateArea(s)) < 1e-6);
  assert.match(validatePlate({ ...s, radii: [0, 0, 1500, 1500] }), /plats/);
  const capsule = { ...s, radii: [600, 600, 600, 600] };
  assert.equal(validatePlate(capsule), '');
  assert.ok(Math.abs(plateArea(capsule) - (800 * 1200 + Math.PI * 600 ** 2)) < 1e-6);
  const sampled = plateContour(capsule);
  assert.ok(
    sampled.every(
      (p, i) => Math.hypot(...p.map((v, j) => v - sampled[(i + 1) % sampled.length][j])) > 1e-6,
    ),
  );
  const added = editPlateVertex(s, 0);
  assert.equal(added.radii.length, 5);
  assert.equal(added.radii[1], 0);
  assert.deepEqual(editPlateVertex(added, 1, true).radii, s.radii);
});
test('mixed plate and polysweep point radii commit once, reject invalid groups atomically, undo and persist', () => {
  const project = createProject({
    grid: { x: [], y: [] },
    levels: { active: 'l', items: [{ id: 'l', name: 'Plan 1', elevation: 0 }] },
  });
  project.objects = [poly(), plate()];
  const before = structuredClone(project),
    history = new ProjectHistory();
  let count = 0;
  const editor = createModelEditor({
    project,
    checkpoint: () => {
      history.checkpoint(project);
      count++;
    },
  });
  const refs = [
    { id: 'poly', kind: 1 },
    { id: 'poly', kind: 2 },
    { id: 'plate', kind: 2 },
  ];
  editor.update(pointRadiusBatch(project.objects, refs, 200));
  assert.equal(count, 1);
  assert.deepEqual(project.objects[0].radii, [0, 200, 200, 0, 0]);
  assert.deepEqual(project.objects[1].radii, [0, 0, 200, 100]);
  const changed = structuredClone(project);
  assert.throws(() => pointRadiusBatch(project.objects, refs, 1500), /plats/);
  assert.equal(count, 1);
  assert.deepEqual(project, changed);
  assert.throws(
    () => pointRadiusBatch(project.objects, [{ id: 'poly', kind: 0 }], 50),
    /Ändpunkter/,
  );
  Object.assign(project, history.undo(project));
  assert.deepEqual(project, before);
  Object.assign(project, history.redo(project));
  assert.deepEqual(project, changed);
  assert.deepEqual(parseProjectFile(serializeProject(project)).objects, project.objects);
  const marks = numberParts(project.objects, undefined, {}, defaultNumberingSettings()).assignments;
  assert.match(marks.poly.mark, /^PS/);
  assert.match(marks.plate.mark, /^PL/);
});
test('native transform, multi-point movement and drawing geometry preserve radii and manufacturing identity', () => {
  const s = poly(),
    before = structuredClone(s);
  const moved = transformObject(s, 'move', [0, 0, 0], [700, 800, 900]),
    rotated = rotateObject(moved, [700, 800, 900], 'Y', 37);
  assert.deepEqual(rotated.radii, s.radii);
  assert.equal(validatePolysweep(rotated), '');
  assert.equal(partKey(rotated, [rotated]), partKey(s, [s]));
  assert.deepEqual(s, before);
  const inserted = editPolysweepPoint(s, 0);
  assert.deepEqual(inserted.points[1], [1000, 0, 0]);
  assert.deepEqual(inserted.radii, [0, 0, ...s.radii.slice(1)]);
  assert.deepEqual(editPolysweepPoint(inserted, 1, true), s);
  const withoutEndpoint = editPolysweepPoint(s, 0, true);
  assert.equal(withoutEndpoint.radii[0], 0);
  assert.equal(validatePolysweep(withoutEndpoint), '');
  assert.throws(
    () => editPolysweepPoint({ ...s, points: s.points.slice(0, 2), radii: [0, 0] }, 0, true),
    /minst två/,
  );
  assert.throws(() => editPolysweepPoint(s, 4), /segment/);
  assert.deepEqual(s, before);
  const grips = selectionGrips([s], new Set(['poly']));
  assert.deepEqual(
    grips.map((g) => g.refs[0].kind),
    [0, 1, 2, 3, 4],
  );
  const [stretched] = moveGripPoints(
    [s],
    [
      { id: 'poly', kind: 1 },
      { id: 'poly', kind: 2 },
    ],
    [2100, 0, 0],
    [2000, 0, 0],
  );
  assert.deepEqual(stretched.points[1], [2100, 0, 0]);
  assert.deepEqual(stretched.points[2], [2100, 1500, 0]);
  assert.deepEqual(stretched.radii, s.radii);
  const output = {
    group: new THREE.Group(),
    bounds: new THREE.Box3(),
    annotationCandidates: [],
    sections: [],
    hatchSurfaces: [],
  };
  buildPlanObjects({
    ...output,
    objects: [s, plate()],
    detail: 'exact',
    hiddenLines: false,
    h: { lower: -100, cut: 50, upper: 1100 },
    planes: () => [],
  });
  assert.ok(!output.bounds.isEmpty());
  assert.ok(output.group.children.length > 0);
  output.group.traverse((o) => {
    o.geometry?.dispose();
    if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
    else o.material?.dispose();
  });
});

test('point selection retains a group for dragging without requiring double-click', async (t) => {
  const { installInsertionPointEditor } = await import(
    '../src/model/ui/insertion-point-controller.js'
  );
  const previous = globalThis.document;
  const element = (tag) => ({
    tag,
    dataset: {},
    children: [],
    handlers: {},
    classList: { remove() {}, toggle() {} },
    append(...children) {
      this.children.push(...children);
    },
    setAttribute() {},
    addEventListener(name, callback) {
      this.handlers[name] = callback;
    },
    querySelector(tag) {
      return this.children.find((child) => child.tag === tag);
    },
  });
  globalThis.document = { createElement: element };
  t.after(() => {
    globalThis.document = previous;
  });
  const source = poly(),
    root = element('aside'),
    controllers = { inspector: { rollback() {}, show() {} } };
  let moving;
  installInsertionPointEditor({
    $: () => root,
    project: { objects: [source] },
    controllers,
    ui: { selectedIds: new Set([source.id]) },
    tools: {},
    frameGate: { invalidate() {} },
    actions: {
      cancelInspectorPreview() {},
      render() {},
      startGrip(grip) {
        moving = grip;
      },
    },
  });
  const grip = (index) => ({ point: source.points[index], refs: [{ id: source.id, kind: index }] });
  controllers.pointUI.activate(grip(1), { detail: 1 });
  controllers.pointUI.activate(grip(2), { detail: 1, shiftKey: true });
  controllers.pointUI.activate(grip(1), { detail: 1 });
  moving = controllers.pointUI.moving(grip(1));
  assert.deepEqual(moving.refs, [grip(1).refs[0], grip(2).refs[0]]);
  const [moved] = moveGripPoints([source], moving.refs, [2100, 0, 0], moving.point);
  assert.deepEqual(moved.points[1], [2100, 0, 0]);
  assert.deepEqual(moved.points[2], [2100, 1500, 0]);
  assert.deepEqual(moved.radii, source.radii);
  controllers.pointUI.activate(grip(2), { altKey: true });
  assert.equal(controllers.pointUI.selected().length, 1);
  const panel = root.children[0];
  panel.handlers.keydown({ key: 'Escape', stopPropagation() {}, preventDefault() {} });
  assert.deepEqual(controllers.pointUI.selected(), []);
  assert.equal(panel.hidden, true);
});

test('asymmetric profile orientation survives 3D rotation and invalid profile enlargement is atomic', () => {
  const source = {
    ...poly(),
    profile: 'triangle',
    width: 100,
    height: 80,
    thickness: 0,
    rotation: 35,
    placement: { horizontalAlignment: 'right', verticalAlignment: 'top' },
  };
  assert.equal(validatePolysweep(source), '');
  const rotated = rotateObject(source, [0, 0, 0], 'Y', 37),
    original = polysweepGeometry(source),
    result = polysweepGeometry(rotated),
    turn = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 1, 0),
      (37 * Math.PI) / 180,
    );
  assert.equal(original.attributes.position.count, result.attributes.position.count);
  for (let i = 0; i < original.attributes.position.count; i++) {
    const expected = new THREE.Vector3()
        .fromBufferAttribute(original.attributes.position, i)
        .applyQuaternion(turn),
      actual = new THREE.Vector3().fromBufferAttribute(result.attributes.position, i);
    assert.ok(
      actual.distanceTo(expected) < 0.002,
      'Profile offset and rotation must follow the whole 3D object',
    );
  }
  original.dispose();
  result.dispose();
  const project = createProject({
    grid: { x: [], y: [] },
    levels: { active: 'l', items: [{ id: 'l', name: 'Plan', elevation: 0 }] },
  });
  project.objects = [poly()];
  let checkpoints = 0;
  const editor = createModelEditor({ project, checkpoint: () => checkpoints++ });
  const before = structuredClone(project.objects);
  assert.throws(() => editor.update([{ ...poly(), width: 1000 }]), /för liten/);
  assert.deepEqual(project.objects, before);
  assert.equal(checkpoints, 0);
  editor.update([{ ...poly(), width: 110, rotation: 35, placement: source.placement }]);
  assert.deepEqual(project.objects[0].points, before[0].points);
  assert.deepEqual(project.objects[0].radii, before[0].radii);
  assert.equal(checkpoints, 1);
});

test('Backspace in a polysweep draft keeps exact length available until the last point is removed', async (t) => {
  const { installPolysweepTools } = await import('../src/model/ui/polysweep-controller.js');
  const previous = globalThis.document,
    fields = new Map();
  const $ = (id) => {
    if (!fields.has(id)) fields.set(id, { hidden: true, value: '', textContent: '' });
    return fields.get(id);
  };
  globalThis.document = { getElementById: $ };
  t.after(() => {
    globalThis.document = previous;
  });
  const tools = { first: null },
    controllers = {},
    project = { objects: [] };
  let added = 0;
  installPolysweepTools({
    $,
    tools,
    controllers,
    project,
    ui: { selected: null },
    renderer: { domElement: { focus() {} } },
    modelEditor: {
      add() {
        added++;
      },
    },
    actions: {
      startDrawing() {
        tools.first = null;
      },
      syncOperationUI() {},
      syncLocks() {},
      clearPreview() {},
      resetLength() {
        $('draw-length-form').hidden = true;
        $('draw-length').value = '';
      },
      readForm: () => ({
        profile: 'rect',
        width: 100,
        height: 100,
        rotation: 0,
        start: [0, 0, 0],
        end: [0, 0, 0],
      }),
    },
  });
  const c = controllers.polysweepUI;
  c.start();
  assert.equal($('draw-length-form').hidden, true);
  c.pick([0, 0, 0]);
  c.pick([1000, 0, 0]);
  $('draw-length').value = '500';
  c.removePoint();
  assert.deepEqual(tools.first, [0, 0, 0]);
  assert.equal($('draw-length-form').hidden, false);
  assert.equal($('draw-length').value, '');
  assert.match($('status').textContent, /1 punkter/);
  c.removePoint();
  assert.equal(tools.first, null);
  assert.equal($('draw-length-form').hidden, true);
  c.finish();
  assert.equal(added, 0, 'an unfinished draft must not create a model object');
});

test('projected add-corner controls never intercept actual corner hit areas at small zoom or along a vertical edge', async (t) => {
  const { InsertionPoints } = await import('../src/insertion-points.js');
  const previous = globalThis.document;
  const element = (tag) => ({
    tagName: tag.toUpperCase(),
    style: {},
    children: [],
    attributes: {},
    append(...nodes) {
      this.children.push(...nodes);
    },
    setAttribute(key, value) {
      this.attributes[key] = value;
    },
    addEventListener() {},
    remove() {},
    contains() {
      return false;
    },
  });
  globalThis.document = { createElement: element };
  t.after(() => {
    globalThis.document = previous;
  });
  const source = {
    ...poly(),
    points: [
      [0, 0, 0],
      [200, 0, 0],
      [200, 0, 100],
      [400, 0, 100],
    ],
    radii: [0, 0, 0, 0],
  };
  const camera = new THREE.OrthographicCamera(-500, 500, 500, -500, 1, 100000);
  camera.position.set(0, 0, 10000);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  const selected = new Set([source.id]),
    overlay = new InsertionPoints(element('div'), () => {});
  overlay.update(camera, 1000, 1000, [source], selected, false);
  assert.equal([...overlay.markers.keys()].filter((key) => key.includes(':edge:')).length, 2);
  assert.ok(!overlay.markers.has(`${source.id}:edge:1`), 'vertical segment projects onto corner');
  assert.equal(
    [...overlay.markers.keys()].filter((key) => !key.includes(':edge:')).length,
    4,
    'different depths keep separate grips',
  );
  camera.zoom = 0.1;
  camera.updateProjectionMatrix();
  overlay.update(camera, 1000, 1000, [source], selected, false);
  assert.equal([...overlay.markers.keys()].filter((key) => key.includes(':edge:')).length, 0);
  assert.equal(overlay.markers.size, 4);
});
