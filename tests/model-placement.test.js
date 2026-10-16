import { createPlaneTransformController } from '../src/model/ui/plane-transform-controller.js';
import { planeTransformCandidates } from '../src/model/tools/plane-transform.js';
import { createLinearTransformController } from '../src/model/ui/linear-transform-controller.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createPlacementController } from '../src/model/ui/placement-controller.js';
import { createModelPreview } from '../src/model/ui/model-preview.js';
import { createModelEditor } from '../src/app/model-editor.js';
import { createModelEditorState } from '../src/model/editor-state.js';
import { createToolSession, resetToolInteraction } from '../src/model/tool-session.js';
import { ProjectHistory } from '../src/project/project-history.js';
import { createProject } from '../src/project/project-state.js';
import { modelBlockDefinition, modelBlockMembers } from '../src/blocks/model-adapter.js';
import { placeItem, itemTemplate } from '../src/items/geometry.js';

function fixture(t) {
  const previous = globalThis.document;
  const fields = new Map();
  globalThis.document = {
    getElementById: (id) => {
      if (!fields.has(id))
        fields.set(id, { value: '', textContent: '', hidden: true, addEventListener() {} });
      return fields.get(id);
    },
    querySelectorAll: () => [],
  };
  t.after(() => {
    globalThis.document = previous;
  });
  const project = createProject({
    grid: { x: [0, 1000], y: [0, 1000] },
    levels: { active: 'l', items: [{ id: 'l', name: 'Plan', elevation: 0 }] },
  });
  project.objects = [
    { id: 'line', type: 'helperline', prefix: 'H', number: 1, start: [0, 0, 0], end: [1000, 0, 0] },
  ];
  const ui = createModelEditorState(),
    tools = createToolSession(),
    history = new ProjectHistory(),
    gripSelection = [],
    scene = new THREE.Scene(),
    objects = new THREE.Group();
  ui.selectedIds = new Set(['line']);
  ui.selected = 'line';
  const modelEditor = createModelEditor({ project, checkpoint: () => history.checkpoint(project) });
  const preview = createModelPreview({
    project,
    ui,
    tools,
    scene,
    objects,
    objectFeedback: { setModel() {} },
    isVisible: () => true,
    getReferences: () => null,
  });
  const originalMesh = preview.mesh(project.objects[0]);
  objects.add(originalMesh);
  scene.add(objects);
  t.after(() => {
    preview.clearPreview();
    preview.dispose(objects);
  });
  const guide = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
    new THREE.LineDashedMaterial(),
  );
  t.after(() => preview.dispose(guide));
  const workPlanePreviews = [];
  const controller = createPlacementController({
    project,
    ui,
    tools,
    modelEditor,
    scene,
    objects,
    guide,
    workPlaneGuide: { show: (...args) => workPlanePreviews.push(args) },
    preview,
    renderer: { domElement: { focus() {} } },
    frameGate: { invalidate() {} },
    setDrawing: (value) => resetToolInteraction(tools, value),
    syncOperationUI() {},
    render() {},
    checkpoint: () => history.checkpoint(project),
    updateSnapOverlay() {},
    getReferences: () => null,
    getPointSelection: () => gripSelection,
    getItem: () => null,
    getInspector: () => ({ focusGeometry() {} }),
    fillForm() {},
    updateForm() {},
    point: () => [100, 0, 0],
  });
  return {
    workPlanePreviews,
    controller,
    project,
    ui,
    tools,
    history,
    preview,
    originalMesh,
    scene,
    fields,
    gripSelection,
  };
}

test('typed placement previews without changing the model, rejects invalid distances and commits one reversible move/copy', (t) => {
  const f = fixture(t),
    original = structuredClone(f.project.objects);
  f.controller.startTransform('move');
  f.tools.first = [0, 0, 0];
  f.controller.toggleLock('X');
  f.fields.get('draw-length').value = '100';
  f.controller.updateTypedLength();
  assert.deepEqual(f.project.objects, original);
  assert.equal(f.history.canUndo, false);
  assert.equal(f.originalMesh.visible, true, 'preview must preserve original snap targets');
  assert.ok(f.ui.preview && f.scene.children.includes(f.ui.preview));
  f.fields.get('draw-length').value = '-1';
  f.controller.updateTypedLength();
  assert.equal(f.tools.typedPoint, null);
  assert.equal(f.ui.preview, null);
  assert.ok(f.fields.get('draw-length-error').textContent);
  assert.equal(f.history.canUndo, false);
  f.fields.get('draw-length').value = '100';
  f.controller.updateTypedLength();
  assert.equal(f.controller.commitPoint(f.tools.typedPoint), true);
  assert.deepEqual(f.project.objects[0].start, [100, 0, 0]);
  assert.equal(f.history.past.length, 1);
  f.controller.startTransform('copy');
  f.tools.first = [100, 0, 0];
  assert.equal(f.controller.commitPoint([300, 0, 0]), true);
  assert.equal(f.project.objects.length, 2);
  assert.deepEqual(f.project.objects[0].start, [100, 0, 0]);
  assert.deepEqual(f.project.objects[1].start, [300, 0, 0]);
  assert.deepEqual([...f.ui.selectedIds], [f.project.objects[1].id]);
  assert.equal(f.history.past.length, 2);
  const undone = f.history.undo(f.project);
  assert.equal(undone.objects.length, 1);
  assert.deepEqual(f.history.undo(undone).objects, original);
});
test('native endpoint commands route a parametric part through parameter grips with one reversible commit', (t) => {
  const f = fixture(t),
    source = {
      ...f.project.objects[0],
      type: 'sweep',
      profile: 'rect',
      width: 100,
      height: 200,
      thickness: 0,
      rotation: 0,
    },
    { definition, placement } = modelBlockDefinition([source]);
  f.project.objects = modelBlockMembers(definition, {}, placement, 'block', [
    { ...source, parametricBlock: { memberId: source.id } },
  ]);
  const before = structuredClone(f.project.objects);
  f.controller.startTransform('end');
  assert.equal(f.tools.operation.mode, 'grip');
  assert.equal(f.controller.commitPoint([2000, 0, 0]), true);
  assert.equal(f.project.objects[0].parametricBlock.values.B, 2000);
  assert.deepEqual(f.project.objects[0].end, [2000, 0, 0]);
  assert.equal(f.history.past.length, 1);
  assert.deepEqual(f.history.undo(f.project).objects, before);
});

test('item endpoint previews share library buffers without changing the source and commit once', (t) => {
  const f = fixture(t),
    box = new THREE.BoxGeometry(100, 100, 100);
  const item = {
    id: 'shape',
    revision: 1,
    name: 'Item',
    article: '',
    supplier: '',
    sourceName: 'test.step',
    geometryId: 'mesh',
    start: [0, 0, 0],
    end: [100, 0, 0],
    snap: 'box',
    mesh: {
      positions: Array.from(box.attributes.position.array),
      indices: Array.from(box.index.array),
    },
  };
  box.dispose();
  const source = { ...placeItem(item, [0, 0, 0], [100, 0, 0]), id: 'line', name: 'Item' };
  f.project.objects = [source];
  const before = structuredClone(source),
    template = itemTemplate(item);
  f.controller.startGrip({ point: source.end, refs: [{ id: source.id, kind: 'end' }] });
  assert.equal(f.tools.operation.sources[0].item, item);
  assert.notEqual(f.tools.operation.sources[0].start, source.start);
  for (const target of [
    [100, 20, 0],
    [0, 200, 0],
    [0, 0, 200],
  ]) {
    f.tools.activeSnap = { kind: 'endpoint', label: '', point: target };
    assert.equal(f.controller.previewLinear(target), true);
    assert.equal(f.ui.previewSweep.item, item);
    const mesh = f.ui.preview.children[0];
    assert.equal(
      mesh.geometry.attributes.position.array,
      template.geometry.attributes.position.array,
    );
    assert.equal(
      mesh.children[0].geometry.attributes.position.array,
      template.edges.attributes.position.array,
    );
    assert.deepEqual(source, before);
    assert.equal(f.history.canUndo, false);
  }
  assert.equal(f.controller.commitPoint([0, 200, 0]), true);
  assert.equal(f.history.past.length, 1);
  assert.equal(f.project.objects[0].item, item);
  assert.ok(Math.abs(f.project.objects[0].end[1] - 100) < 1e-6);
  assert.deepEqual(f.history.undo(f.project).objects, [before]);
});

function linearFixture(t) {
  const f = fixture(t),
    rows = [];
  let linear;
  linear = createLinearTransformController({
    tools: f.tools,
    placement: f.controller,
    setDrawing(value) {
      linear?.suspend();
      f.preview.clearPreview();
      resetToolInteraction(f.tools, value);
    },
    createHUD(draft, callbacks) {
      const row = { draft, callbacks, state: null, removed: false };
      rows.push(row);
      return {
        sync: (state) => {
          row.state = state;
        },
        remove: () => {
          row.removed = true;
        },
      };
    },
    status() {},
    focus() {},
  });
  return { ...f, linear, rows };
}

test('linear HUD keeps axis drafts, rejects invalid/zero moves, commits once and reuses current selection after copy', (t) => {
  const f = linearFixture(t),
    before = structuredClone(f.project.objects);
  f.linear.open('move');
  const row = f.rows[0];
  assert.equal(f.ui.preview, null);
  row.callbacks.change(0, '-250,5');
  row.callbacks.change(1, 'bad');
  assert.equal(row.state.ready, false);
  assert.equal(f.ui.preview, null);
  row.callbacks.confirm();
  assert.deepEqual(f.project.objects, before);
  assert.equal(f.history.canUndo, false);
  row.callbacks.enable(1, false);
  assert.equal(row.draft.values[1], 'bad');
  assert.equal(row.state.ready, true);
  row.callbacks.confirm();
  assert.deepEqual(f.project.objects[0].start, [-250.5, 0, 0]);
  assert.equal(f.history.past.length, 1);
  assert.equal(row.state.active, false);
  assert.equal(row.draft.values[0], '-250,5');
  assert.equal(f.tools.operation, null);
  f.linear.open('copy');
  const copy = f.rows[1];
  copy.callbacks.change(2, '400');
  copy.callbacks.confirm();
  const firstCopy = f.project.objects[1];
  assert.deepEqual(firstCopy.start, [-250.5, 0, 400]);
  assert.notEqual(firstCopy.id, before[0].id);
  copy.callbacks.activate();
  assert.equal(copy.state.ready, true);
  copy.callbacks.confirm();
  assert.deepEqual(f.project.objects[2].start, [-250.5, 0, 800]);
  assert.equal(f.history.past.length, 3);
  assert.deepEqual(f.history.undo(f.history.undo(f.history.undo(f.project))).objects, before);
});

test('stacked linear drafts isolate preview; picker only sets vector and closing/cancel never commits', (t) => {
  const f = linearFixture(t),
    before = structuredClone(f.project.objects);
  f.linear.open('move');
  const move = f.rows[0];
  move.callbacks.change(0, '100');
  f.linear.open('copy');
  const copy = f.rows[1];
  copy.callbacks.change(1, '200');
  assert.equal(move.state.active, false);
  assert.equal(copy.state.active, true);
  assert.deepEqual(f.ui.previewSweep.start, [0, 200, 0]);
  move.callbacks.activate();
  assert.equal(copy.state.active, false);
  assert.deepEqual(f.ui.previewSweep.start, [100, 0, 0]);
  copy.callbacks.close();
  assert.equal(copy.removed, true);
  assert.deepEqual(
    f.ui.previewSweep.start,
    [100, 0, 0],
    'closing inactive row must not disturb active preview',
  );
  move.callbacks.pick();
  assert.equal(move.state.picking, true);
  assert.equal(move.state.ready, false);
  f.linear.pickPoint([40, 50, 60]);
  f.tools.activeSnap = { point: [340, 150, 80], kind: 'endpoint', label: 'Ändpunkt' };
  f.linear.pointerPreview([340, 150, 80]);
  assert.deepEqual(f.ui.previewSweep.start, [300, 100, 20]);
  move.callbacks.confirm();
  assert.equal(
    f.history.canUndo,
    false,
    'Enter/confirmation before picker ends cannot use old vector',
  );
  f.linear.pickPoint([340, 150, 80]);
  assert.deepEqual(move.draft.values, ['300', '100', '20']);
  assert.equal(move.state.picking, false);
  assert.deepEqual(f.project.objects, before);
  move.callbacks.cancel();
  assert.equal(f.ui.preview, null);
  assert.equal(move.state.active, false);
  assert.deepEqual(move.draft.values, ['300', '100', '20']);
  move.callbacks.activate();
  move.callbacks.change(0, '0');
  move.callbacks.change(1, '0');
  move.callbacks.change(2, '0');
  assert.equal(f.ui.preview, null, 'zero vector clears earlier preview');
  move.callbacks.close();
  assert.equal(move.removed, true);
  assert.equal(f.tools.operation, null);
  assert.equal(f.history.canUndo, false);
});

test('native plate grips retain the plate plane and commit one reversible diagonal corner edit', (t) => {
  const f = fixture(t),
    plate = {
      id: 'line',
      type: 'plate',
      thickness: 10,
      side: 'center',
      frame: { origin: [100, 200, 300], u: [1, 0, 0], v: [0, 0, 1] },
      polygon: [
        [0, 0],
        [1000, 0],
        [1000, 1000],
        [0, 1000],
      ],
      radii: [0, 0, 100, 0],
    };
  f.project.objects = [plate];
  const before = structuredClone(f.project.objects);
  f.controller.startGrip({ point: [1100, 200, 1300], refs: [{ id: plate.id, kind: 2 }] });
  assert.deepEqual(f.tools.operation.frame, {
    origin: [1100, 200, 1300],
    u: [1, 0, 0],
    v: [0, 0, 1],
  });
  assert.equal(f.controller.commitPoint([1400, 200, 1600]), true);
  assert.deepEqual(f.project.objects[0].polygon[2], [1300, 1300]);
  assert.deepEqual(f.project.objects[0].radii, plate.radii);
  assert.equal(f.history.past.length, 1);
  assert.deepEqual(f.history.undo(f.project).objects, before);
});

function planeFixture(t) {
  const f = fixture(t),
    rows = [];
  const plane = createPlaneTransformController({
    tools: f.tools,
    placement: f.controller,
    setDrawing(value) {
      f.preview.clearPreview();
      resetToolInteraction(f.tools, value);
    },
    guides: { clear() {}, show() {} },
    status() {},
    focus() {},
    createHUD(draft, callbacks) {
      const row = { draft, callbacks };
      rows.push(row);
      return {
        sync: (state) => {
          row.state = state;
        },
        remove: () => {
          row.removed = true;
        },
      };
    },
  });
  return { ...f, plane, rows };
}
const sourcePlane = [
  [0, 0, 0],
  [1000, 0, 0],
  [0, 1000, 0],
];
const targetPlane = [
  [100, 200, 300],
  [100, 200, 500],
  [100, 600, 300],
];

test('six snapped plane points require explicit confirmation, rotate and translate rigidly, copy and undo once', (t) => {
  const f = planeFixture(t),
    before = structuredClone(f.project.objects);
  f.plane.open('move');
  const row = f.rows[0];
  sourcePlane.forEach((p) => f.plane.pickPoint(p));
  targetPlane.slice(0, 2).forEach((p) => f.plane.pickPoint(p));
  f.plane.pointerPreview(targetPlane[2]);
  f.plane.confirmActive();
  assert.equal(f.history.canUndo, false);
  assert.deepEqual(f.project.objects, before);
  assert.equal(f.originalMesh.visible, true);
  assert.ok(f.ui.preview);
  f.plane.pickPoint(targetPlane[2]);
  assert.equal(row.state.ready, true);
  assert.deepEqual(f.project.objects, before);
  f.plane.confirmActive();
  assert.deepEqual(f.project.objects[0].start, [100, 200, 300]);
  assert.deepEqual(f.project.objects[0].end, [100, 200, 1300]);
  assert.equal(f.history.past.length, 1);
  assert.equal(row.state.active, false);
  assert.deepEqual(f.history.undo(f.project).objects, before);
  f.plane.open('copy');
  targetPlane.forEach((p) => f.plane.pickPoint(p));
  sourcePlane.forEach((p) => f.plane.pickPoint(p));
  f.plane.confirmActive();
  assert.equal(f.project.objects.length, 2);
  assert.deepEqual(f.project.objects[1].start, [0, 0, 0]);
  assert.deepEqual(f.project.objects[1].end, [1000, 0, 0]);
  assert.notEqual(f.project.objects[0].id, f.project.objects[1].id);
  assert.deepEqual([...f.ui.selectedIds], [f.project.objects[1].id]);
  assert.equal(f.history.past.length, 1);
  assert.equal(f.history.undo(f.project).objects.length, 1);
});

test('invalid plane points preserve picking, backspace and repicking clear preview, cancellation never commits', (t) => {
  const f = planeFixture(t),
    before = structuredClone(f.project.objects);
  f.plane.open('move');
  const row = f.rows[0];
  f.plane.pickPoint(sourcePlane[0]);
  f.plane.pickPoint(sourcePlane[0]);
  assert.equal(row.state.start, 1);
  f.plane.pickPoint(sourcePlane[1]);
  f.plane.pickPoint([2000, 0, 0]);
  assert.equal(row.state.start, 2);
  assert.equal(row.state.ready, false);
  f.plane.pickPoint(sourcePlane[2]);
  targetPlane.forEach((p) => f.plane.pickPoint(p));
  assert.equal(row.state.ready, true);
  f.plane.removePoint();
  assert.equal(row.state.target, 2);
  assert.equal(f.ui.preview, null);
  f.plane.confirmActive();
  assert.equal(f.history.canUndo, false);
  f.plane.pickPoint(targetPlane[2]);
  row.callbacks.pick('start');
  assert.equal(row.state.start, 0);
  assert.equal(row.state.target, 0);
  assert.equal(f.ui.preview, null);
  sourcePlane.forEach((p) => f.plane.pickPoint(p));
  targetPlane.forEach((p) => f.plane.pickPoint(p));
  row.callbacks.close();
  assert.equal(row.removed, true);
  assert.equal(f.tools.operation, null);
  assert.deepEqual(f.project.objects, before);
  assert.equal(f.history.canUndo, false);
});

test('plane mapping preserves plate radii, eccentric profiles and block coordinate frames without scaling', () => {
  const sweep = {
    id: 's',
    type: 'sweep',
    start: [0, 0, 0],
    end: [1000, 0, 0],
    profile: 'rect',
    width: 100,
    height: 200,
    thickness: 0,
    rotation: 35,
    placement: { horizontalAlignment: 'right', verticalAlignment: 'top' },
  };
  const { definition, placement } = modelBlockDefinition([sweep]);
  const block = modelBlockMembers(definition, {}, placement, 'block', [
    { ...sweep, parametricBlock: { memberId: sweep.id } },
  ])[0];
  const plate = {
    id: 'p',
    type: 'plate',
    frame: { origin: [0, 0, 0], u: [1, 0, 0], v: [0, 1, 0] },
    polygon: [
      [0, 0],
      [1000, 0],
      [1000, 1000],
    ],
    radii: [0, 50, 0],
    thickness: 10,
    side: 'center',
  };
  const original = structuredClone([block, plate]);
  const moved = planeTransformCandidates(original, sourcePlane, targetPlane);
  const back = planeTransformCandidates(moved, targetPlane, sourcePlane);
  assert.deepEqual(original, [block, plate]);
  assert.deepEqual(moved[1].polygon, plate.polygon);
  assert.deepEqual(moved[1].radii, plate.radii);
  assert.deepEqual(moved[0].end, [100, 200, 1300]);
  assert.deepEqual(back[0].start, block.start);
  assert.deepEqual(back[0].end, block.end);
  for (const key of ['origin', 'u', 'v'])
    back[1].frame[key].forEach((value, i) =>
      assert.ok(Math.abs(value - plate.frame[key][i]) < 1e-8),
    );
  assert.deepEqual(
    back[0].parametricBlock.placement.origin,
    block.parametricBlock.placement.origin,
  );
  assert.throws(() =>
    planeTransformCandidates(original, sourcePlane, [
      [0, 0, 0],
      [1, 0, 0],
      [2, 0, 0],
    ]),
  );
  assert.throws(() =>
    planeTransformCandidates(original, sourcePlane, [
      [NaN, 0, 0],
      [1, 0, 0],
      [0, 1, 0],
    ]),
  );
});

test('Move uses selected endpoints and a picked base; linear move reuses that point selection and commits once', (t) => {
  const f = linearFixture(t);
  f.project.objects.push({
    ...structuredClone(f.project.objects[0]),
    id: 'other',
    start: [0, 1000, 0],
    end: [1000, 1000, 0],
  });
  f.ui.selectedIds.add('other');
  f.gripSelection.push({ id: 'line', kind: 'end' }, { id: 'other', kind: 'end' });
  const before = structuredClone(f.project.objects);
  f.controller.startTransform('move');
  assert.equal(f.tools.first, null);
  assert.equal(f.tools.operation.gripRefs.length, 2);
  f.tools.first = [300, 400, 0];
  assert.equal(f.controller.commitPoint([800, 400, 0]), true);
  assert.deepEqual(
    f.project.objects.map((o) => o.start),
    before.map((o) => o.start),
  );
  assert.deepEqual(
    f.project.objects.map((o) => o.end),
    [
      [1500, 0, 0],
      [1500, 1000, 0],
    ],
  );
  assert.equal(f.history.past.length, 1);
  f.linear.open('move');
  const row = f.rows[0];
  row.callbacks.change(0, '250');
  assert.equal(row.state.ready, true);
  assert.deepEqual(
    f.project.objects.map((o) => o.end),
    [
      [1500, 0, 0],
      [1500, 1000, 0],
    ],
    'HUD preview is detached',
  );
  row.callbacks.confirm();
  assert.deepEqual(
    f.project.objects.map((o) => o.end),
    [
      [1750, 0, 0],
      [1750, 1000, 0],
    ],
  );
  assert.deepEqual(
    f.project.objects.map((o) => o.start),
    before.map((o) => o.start),
  );
  assert.equal(f.history.past.length, 2);
  assert.deepEqual(
    f.history.undo(f.project).objects.map((o) => o.end),
    [
      [1500, 0, 0],
      [1500, 1000, 0],
    ],
  );
});

test('an invalid linear endpoint edit cannot partially change a group or add history', (t) => {
  const f = linearFixture(t);
  f.gripSelection.push({ id: 'line', kind: 'end' });
  const before = structuredClone(f.project.objects);
  f.linear.open('move');
  const row = f.rows[0];
  row.callbacks.change(0, '-1000');
  assert.equal(row.state.ready, false);
  row.callbacks.confirm();
  assert.deepEqual(f.project.objects, before);
  assert.equal(f.history.canUndo, false);
});

test('invalid fastener settings block canvas confirmation instead of placing the last valid draft', (t) => {
  const f = fixture(t),
    before = structuredClone(f.project.objects);
  const draft = { spec: { length: 70 }, placementMode: 'range' };
  f.tools.first = [0, 0, 0];
  f.tools.operation = { mode: 'fastenerCreate', draft, error: 'Ogiltigt skruvmönster' };
  assert.equal(f.controller.commitPoint([0, 0, 100]), false);
  assert.equal(f.tools.operation.draft, draft);
  assert.deepEqual(f.tools.first, [0, 0, 0]);
  assert.deepEqual(f.project.objects, before);
  assert.equal(f.history.canUndo, false);
  assert.match(f.fields.get('status').textContent, /Ogiltigt skruvmönster/);
});

test('two-point workplane previews the same frame without changing the active plane or model', async (t) => {
  const { workPlaneFromTwoPoints } = await import('../src/work-plane.js');
  const f = fixture(t),
    reference = { origin: [0, 0, 0], u: [1, 0, 0], v: [0, 0, 1] };
  f.tools.temporaryPlane = reference;
  f.tools.drawing = true;
  f.tools.operation = {
    mode: 'workPlane',
    pointCount: 2,
    points: [[0, 0, 0]],
    referenceFrame: reference,
  };
  const before = structuredClone(f.project.objects);
  f.controller.updatePointer({ clientX: 50, clientY: 60 });
  const [points, frame] = f.workPlanePreviews.at(-1);
  assert.deepEqual(points, [
    [0, 0, 0],
    [100, 0, 0],
  ]);
  assert.deepEqual(frame, workPlaneFromTwoPoints(points, reference));
  assert.equal(f.tools.temporaryPlane, reference);
  assert.deepEqual(f.project.objects, before);
});
