import {
  packDrawingProjection,
  unpackDrawingProjection,
  drawingProjectionBuffers,
} from '../src/drawing-projection-result.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  drawingReferenceGeometry,
  drawingReferenceOptions,
  drawingReferenceSnapIndex,
  drawingReferenceSectionBounds,
} from '../src/references/drawing-reference-geometry.js';
import { projectedDrawing, appendVectorDrawing } from '../src/drawing-vector.js';
import { duplicateDrawingView } from '../src/drawing-views.js';
import { DrawingIFCReferences } from '../src/drawing-ifc-references.js';
import {
  drawingProjectionData,
  calculateDrawingProjection,
} from '../src/drawing-projection-data.js';

function reference() {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(100, 100, 100));
  mesh.position.set(200, 300, 50);
  const edges = new THREE.EdgesGeometry(mesh.geometry).attributes.position.array;
  return { id: 'ifc', format: 'IFC', parts: [{ mesh, edges }] };
}
test('IFC drawing clips by view bounds, applies placement and leaves imported geometry unchanged', () => {
  const model = reference(),
    original = model.parts[0].mesh.geometry.attributes.position.array.slice();
  const settings = { ifcReferences: { ifc: { visible: true, snap: true } } };
  const context = {
    matrix: new THREE.Matrix4(),
    heights: { lower: 0, cut: 50, upper: 100 },
    crop: [100, 200, 300, 400],
  };
  const parts = drawingReferenceGeometry([model], settings, context);
  assert.equal(parts.length, 1);
  assert.deepEqual(parts[0].bounds.min.toArray(), [150, 250, 0]);
  assert.ok(parts[0].cut.length >= 4);
  assert.deepEqual(model.parts[0].mesh.geometry.attributes.position.array, original);
  assert.equal(drawingReferenceGeometry([model], {}, context).length, 0);
  assert.equal(
    drawingReferenceGeometry([model], settings, { ...context, crop: [1000, 1000, 1100, 1100] })
      .length,
    0,
  );
  assert.equal(
    drawingReferenceGeometry([model], settings, {
      ...context,
      heights: { lower: 200, cut: 250, upper: 300 },
    }).length,
    0,
  );
  parts.forEach((p) => {
    p.geometry.dispose();
    p.edges.dispose();
  });
});
test('section reference uses the same view frame and intersects the section plane', () => {
  const model = reference();
  const matrix = new THREE.Matrix4().makeRotationY(Math.PI / 2);
  matrix.setPosition(0, -300, 200);
  const [part] = drawingReferenceGeometry(
    [model],
    { ifcReferences: { ifc: { visible: true } } },
    {
      matrix,
      heights: { lower: -100, cut: 0, upper: 0 },
      crop: [-100, -100, 200, 100],
    },
  );
  assert.ok(part.cut.length > 0);
  assert.ok(Math.abs(part.bounds.max.z - 50) < 1e-8);
  part.geometry.dispose();
  part.edges.dispose();
});
test('IFC-only section framing respects depth and width before the paper crop exists', () => {
  const model = reference();
  const matrix = new THREE.Matrix4().makeRotationY(Math.PI / 2);
  matrix.setPosition(0, -300, 200);
  const context = {
    matrix,
    depth: 100,
    planes: [
      new THREE.Plane(new THREE.Vector3(0, 0, 1), 100),
      new THREE.Plane(new THREE.Vector3(0, 0, -1), 0),
      new THREE.Plane(new THREE.Vector3(1, 0, 0), -20),
      new THREE.Plane(new THREE.Vector3(-1, 0, 0), 80),
    ],
  };
  const bounds = drawingReferenceSectionBounds(
    [model],
    { ifcReferences: { ifc: { visible: true } } },
    context,
  );
  assert.deepEqual(bounds.min.toArray().map(Math.round), [20, -50]);
  assert.deepEqual(bounds.max.toArray().map(Math.round), [80, 50]);
  assert.ok(drawingReferenceSectionBounds([model], {}, context).isEmpty());
  assert.deepEqual(model.parts[0].mesh.position.toArray(), [200, 300, 50]);
});
test('IFC options survive drawing serialization and duplicated views can diverge', () => {
  const view = {
    id: 'v',
    name: 'Plan',
    position: [0, 0],
    size: [100, 100],
    camera: { center: [0, 0] },
    scale: 100,
    settings: { ifcReferences: { ifc: { visible: true, hiddenLines: false, snap: true } } },
  };
  const { view: copy } = duplicateDrawingView(view, [view], [], { copyAnnotations: false });
  copy.settings.ifcReferences.ifc.visible = false;
  assert.equal(drawingReferenceOptions(view.settings, 'ifc').visible, true);
  assert.equal(
    drawingReferenceOptions(JSON.parse(JSON.stringify(copy)).settings, 'ifc').visible,
    false,
  );
});
test('snap index includes only nearby visible edges of references enabled for snap', () => {
  const line = (x) => [
    [x, 0, 0],
    [x + 10, 0, 0],
  ];
  const query = drawingReferenceSnapIndex([
    { referenceId: 'a', referenceSnap: true, visible: [line(0), line(1000)], hidden: [line(500)] },
    { referenceId: 'b', referenceSnap: false, visible: [line(10)] },
    { sourceId: 'own', visible: [line(20)] },
  ]);
  assert.deepEqual(query([5, 0], 10), [line(0).map((p) => p.slice(0, 2))]);
  assert.deepEqual(query([500, 0], 10), []);
});
test('projection cache invalidates on reference placement, view settings and model revisions', () => {
  const model = reference();
  model.placement = { offset: [0, 0, 0] };
  let objects = [];
  const editor = {
    getState: () => ({ objects }),
    record: { id: 'ga', settings: {} },
    views: { active: { id: 'v', size: [100, 100], scale: 100, settings: {} } },
    heights: { lower: 0, cut: 50, upper: 100 },
    center: new THREE.Vector2(),
    sectionSource: () => null,
  };
  const controller = Object.assign(Object.create(DrawingIFCReferences.prototype), {
    editor,
    getModels: () => [model],
    versions: new WeakMap(),
    nextVersion: 0,
    projections: new Map(),
    viewKeys: new Map(),
  });
  const first = controller.projection([], []);
  assert.equal(controller.projection([], []), first);
  model.placement.offset[0] = 100;
  const moved = controller.projection([], []);
  assert.notEqual(moved, first);
  editor.record.settings.profileDetail = 'exact';
  const exact = controller.projection([], []);
  assert.notEqual(exact, moved);
  objects = [{}];
  assert.notEqual(controller.projection([], []), exact);
});
test('background projection transfers copies and preserves clipping, occlusion and IFC flags', () => {
  const cover = new THREE.BoxGeometry(2, 2, 2),
    edge = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-2, 0, 0),
      new THREE.Vector3(2, 0, 0),
    ]);
  const surfaces = [{ geometry: cover }],
    edges = [
      {
        geometry: edge,
        referenceId: 'ifc',
        referenceSnap: true,
        showHidden: false,
        planes: [new THREE.Plane(new THREE.Vector3(-1, 0, 0), 1)],
      },
    ];
  const expected = projectedDrawing(surfaces, edges);
  const payload = drawingProjectionData(surfaces, edges);
  const received = structuredClone(payload.data, { transfer: payload.buffers });
  const packed = packDrawingProjection(calculateDrawingProjection(received));
  const workerResult = structuredClone(packed, { transfer: drawingProjectionBuffers(packed) });
  assert.deepEqual(unpackDrawingProjection(workerResult), expected);
  assert.ok(cover.attributes.position.array.length > 0);
  assert.equal(edge.attributes.position.array.length, 6);
  assert.ok(expected.edges[0].hidden.length > 0);
  cover.dispose();
  edge.dispose();
});
test('PDF readiness waits for all background views and reports calculation failures', async () => {
  const controller = Object.assign(Object.create(DrawingIFCReferences.prototype), {
    pending: new Map(),
  });
  let finish;
  controller.pending.set('view', {
    promise: new Promise((resolve) => {
      finish = resolve;
    }),
  });
  let ready = false;
  const waiting = controller.ready().then(() => {
    ready = true;
  });
  await Promise.resolve();
  assert.equal(ready, false);
  controller.pending.delete('view');
  finish();
  await waiting;
  assert.equal(ready, true);
  controller.error = 'Fel i IFC-vyn';
  await assert.rejects(controller.ready(), /Fel i IFC-vyn/);
});
test('reference hidden-line setting is independent of the model setting and export uses the same flags', () => {
  const geometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(1, 0, 0),
  ]);
  const [projected] = projectedDrawing(
    [],
    [{ geometry, referenceId: 'ifc', showHidden: false, referenceSnap: true }],
  ).edges;
  assert.equal(projected.referenceId, 'ifc');
  assert.equal(projected.showHidden, false);
  const paths = [];
  const prior = globalThis.document;
  globalThis.document = {
    createElementNS: () => ({
      setAttribute(k, v) {
        this[k] = v;
      },
    }),
  };
  try {
    const set = {
      visible: [],
      hidden: [
        [
          [0, 0],
          [1, 0],
        ],
      ],
    };
    appendVectorDrawing(
      { append: (p) => paths.push(p) },
      [
        { ...set, showHidden: false },
        { ...set, showHidden: true },
      ],
      (p) => p,
      { hidden: true },
    );
    assert.equal(paths.length, 1);
    paths.length = 0;
    appendVectorDrawing(
      { append: (p) => paths.push(p) },
      [{ ...set, showHidden: true }],
      (p) => p,
      { hidden: false },
    );
    assert.equal(paths.length, 1);
  } finally {
    globalThis.document = prior;
    geometry.dispose();
  }
});

test('closing GA terminates projection work, settles pending export and releases cached views', async () => {
  const prior = globalThis.document;
  globalThis.document = { createElement: () => ({}) };
  let controller;
  const dialog = new EventTarget();
  try {
    controller = new DrawingIFCReferences({ dialog }, { append() {} }, () => []);
  } finally {
    globalThis.document = prior;
  }
  let terminated = 0,
    finish;
  controller.worker = { terminate: () => terminated++ };
  const promise = new Promise((resolve) => {
    finish = resolve;
  });
  controller.pending.set('view', { promise, finish });
  controller.projections.set('view', { faces: Array(100).fill([0, 0]) });
  controller.viewKeys.set('plan', 'view');
  controller.error = 'prior error';
  controller.activeProjection = { key: 'view', result: { faces: [[1, 2]] } };
  dialog.dispatchEvent(new Event('close'));
  await promise;
  assert.equal(terminated, 1);
  assert.equal(controller.worker, null);
  assert.equal(controller.pending.size, 0);
  assert.equal(controller.projections.size, 0);
  assert.equal(controller.viewKeys.size, 0);
  assert.equal(controller.error, null);
  assert.equal(controller.activeProjection, null);
});

test('inactive views keep packed results, removed views release cache and pending work', () => {
  const result = {
    faces: [
      [
        [1, 2],
        [3, 4],
        [5, 6],
      ],
    ],
    edges: [],
  };
  let finished = 0;
  const controller = Object.assign(Object.create(DrawingIFCReferences.prototype), {
    editor: { record: { sheet: { views: [{ id: 'plan' }] } } },
    projections: new Map(),
    viewKeys: new Map(),
    pending: new Map(),
  });
  controller.store('plan-key', packDrawingProjection(result), 'plan');
  controller.store('section-key', packDrawingProjection(result), 'section');
  assert.ok(controller.projections.get('plan-key').faces instanceof Float64Array);
  controller.activeProjection = { key: 'section-key', result };
  controller.pending.set('section-job', { viewId: 'section', finish: () => finished++ });
  controller.pruneViews();
  assert.equal(controller.projections.size, 1);
  assert.equal(controller.viewKeys.size, 1);
  assert.equal(controller.pending.size, 0);
  assert.equal(controller.activeProjection, null);
  assert.equal(finished, 1);
  assert.deepEqual(unpackDrawingProjection(controller.projections.get('plan-key')), result);
});
