import { drawingReferenceGeometry } from '../src/references/drawing-reference-geometry.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  defaultWorkArea,
  workAreaFromCorners,
  workAreaBounds,
  workAreaFromBounds,
  withinWorkArea,
  expandWorkArea,
  parseElevation,
  formatElevation,
} from '../src/model/work-area.js';
import { createWorkAreaController } from '../src/model/ui/work-area-controller.js';
import { createWorkAreaDisplay } from '../src/model/work-area-display.js';
import { createProject } from '../src/project/project-state.js';
import { parseProjectFile, serializeProject } from '../src/project/project-file.js';
import { ProjectHistory } from '../src/project/project-history.js';
import { resolveSnap } from '../src/snap.js';
import { enclosedSweeps } from '../src/selection.js';
import { ReferenceModels } from '../src/references/reference-models.js';
import { edgeIndex, referenceCandidates } from '../src/references/edge-index.js';

function camera() {
  const cam = new THREE.OrthographicCamera(-100, 100, 100, -100, 1, 10000);
  cam.position.set(0, 0, 1000);
  cam.lookAt(0, 0, 0);
  cam.updateMatrixWorld();
  return cam;
}
function project() {
  return createProject({
    grid: { x: [], y: [] },
    levels: { active: 'l', items: [{ id: 'l', name: 'Plan', elevation: 9000 }] },
  });
}

test('opposite XY corners use absolute signed elevations, persist in files and expand only by union', () => {
  const area = workAreaFromCorners(
    { ...defaultWorkArea(), lower: parseElevation('−0,500'), upper: parseElevation('+3,000') },
    [500, 800, 9000],
    [-500, -800, -999],
  );
  const box = workAreaBounds(area);
  assert.equal(workAreaFromBounds(new THREE.Box3()), null);
  assert.deepEqual(workAreaFromBounds(box), {
    rectangle: [-600, -900, 600, 900],
    lower: -600,
    upper: 3100,
  });
  assert.deepEqual(box.min.toArray(), [-500, -800, -500]);
  assert.deepEqual(box.max.toArray(), [500, 800, 3000]);
  assert.equal(formatElevation(-500), '−0,500');
  assert.equal(parseElevation('+12.345'), 12345);
  for (const value of ['', 'NaN', '1e3', 'Infinity', '1,2,3'])
    assert.throws(() => parseElevation(value));
  assert.throws(() => workAreaFromCorners(area, [0, 0], [0, 10]));
  assert.equal(
    expandWorkArea(area, new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(20, 20, 20))),
    null,
  );
  const expanded = expandWorkArea(
    area,
    new THREE.Box3(new THREE.Vector3(200, -20, -1000), new THREE.Vector3(2000, 20, 5000)),
  );
  assert.deepEqual(workAreaBounds(expanded).min.toArray(), [-500, -800, -1000]);
  assert.deepEqual(workAreaBounds(expanded).max.toArray(), [2000, 800, 5000]);
  const p = project();
  p.workArea = area;
  const loaded = parseProjectFile(serializeProject(p));
  assert.deepEqual(loaded.workArea, area);
  const withoutArea = JSON.parse(serializeProject(p));
  delete withoutArea.project.workArea;
  assert.deepEqual(parseProjectFile(JSON.stringify(withoutArea)).workArea, defaultWorkArea());
  withoutArea.project.workArea = { ...area, upper: area.lower };
  assert.throws(() => parseProjectFile(JSON.stringify(withoutArea)), /plushöjd/);
});

test('corner preview ignores picked Z, rejects collapsed rectangles and commits one reversible view change', () => {
  const p = project(),
    tools = {},
    ui = { selectedIds: new Set() },
    history = new ProjectHistory(),
    scene = new THREE.Scene(),
    renderer = {};
  let state, callbacks;
  const ctl = createWorkAreaController({
    project: p,
    tools,
    ui,
    renderState: { renderedById: new Map() },
    setDrawing(value) {
      tools.operation = null;
      tools.drawing = value;
    },
    createHUD(c) {
      callbacks = c;
      return {
        sync(s) {
          state = s;
        },
        remove() {},
      };
    },
    display: createWorkAreaDisplay(scene, renderer),
    commit(next) {
      history.checkpoint(p);
      p.workArea = next;
      ctl.sync();
    },
    render() {},
    fit() {},
    status() {},
    focus() {},
  });
  const before = structuredClone(p);
  ctl.open();
  ctl.pickPoint([50, 50, 50000]);
  ctl.pickPoint([50, 100, -50000]);
  assert.equal(state.count, 1);
  assert.equal(state.ready, false);
  ctl.confirm();
  assert.equal(history.canUndo, false);
  ctl.pointerPreview([100, 100, 20000]);
  assert.equal(renderer.clippingPlanes.length, 0);
  assert.deepEqual(p, before);
  ctl.pickPoint([100, 100, -100000]);
  assert.equal(state.ready, true);
  ctl.confirm();
  assert.deepEqual(p.workArea.rectangle, [50, 50, 100, 100]);
  assert.equal(p.workArea.upper, 3000);
  assert.equal(p.workArea.lower, -500);
  assert.equal(history.past.length, 1);
  assert.equal(renderer.clippingPlanes.length, 6);
  assert.equal(ctl.allowsPoint([75, 75, 0]), true);
  assert.equal(ctl.allowsPoint([75, 75, 4000]), false);
  ctl.open();
  ctl.pickPoint([200, 200, 0]);
  callbacks.cancel();
  assert.equal(history.past.length, 1);
  assert.deepEqual(history.undo(p), before);
});

test('snap rejects clipped endpoints and marquee selection operates on the visible geometry', () => {
  const cam = camera(),
    caster = new THREE.Raycaster();
  caster.setFromCamera(new THREE.Vector2(0.02, 0), cam);
  const box = new THREE.Box3(new THREE.Vector3(-100, -100, -100), new THREE.Vector3(0, 100, 100));
  const result = resolveSnap({
    pointer: [102, 100],
    camera: cam,
    width: 200,
    height: 200,
    ray: caster.ray,
    z: 0,
    sweeps: [
      { type: 'helperpoint', start: [2, 0, 0] },
      { type: 'helperpoint', start: [-2, 0, 0] },
    ],
    grid: { x: [], y: [] },
    cornerSnap: false,
    workArea: box,
  });
  assert.deepEqual(result.point, [-2, 0, 0]);
  const beam = {
    id: 'beam',
    type: 'sweep',
    start: [-80, 0, 0],
    end: [80, 0, 0],
    profile: 'rect',
    width: 10,
    height: 10,
    thickness: 0,
    rotation: 0,
  };
  assert.deepEqual(
    enclosedSweeps([beam], cam, 200, 200, { x: 15, y: 90 }, { x: 102, y: 110 }, [beam], {
      workArea: box,
    }),
    ['beam'],
  );
  assert.deepEqual(
    enclosedSweeps([beam], cam, 200, 200, { x: 185, y: 90 }, { x: 160, y: 110 }, [beam], {
      workArea: box,
    }),
    [],
  );
  assert.equal(withinWorkArea(box, [1, 0, 0]), false);
});

test('reference culling preserves full expansion bounds, visible edges and CAD layer choices', () => {
  const refs = Object.create(ReferenceModels.prototype),
    group = new THREE.Group();
  const nearMesh = new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10)),
    farMesh = new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10));
  farMesh.position.x = 1000;
  const hiddenMesh = new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10));
  hiddenMesh.position.x = 500;
  group.add(nearMesh, farMesh, hiddenMesh);
  const model = {
    group,
    parts: [{ mesh: nearMesh }, { mesh: farMesh }, { mesh: hiddenMesh, layer: 'off' }],
    layerVisibility: { off: false },
  };
  refs.models = [model];
  const box = new THREE.Box3(new THREE.Vector3(-100, -100, -100), new THREE.Vector3(100, 100, 100));
  refs.setWorkArea(box);
  assert.equal(nearMesh.visible, true);
  assert.equal(farMesh.visible, false);
  assert.equal(hiddenMesh.visible, false);
  assert.equal(
    refs.modelBounds(model).max.x,
    1005,
    'bounds for expansion must include currently clipped parts',
  );
  const drawing = drawingReferenceGeometry(
    [
      {
        ...model,
        id: 'ifc',
        format: 'IFC',
        parts: model.parts.slice(0, 2).map((part) => ({ ...part, edges: new Float64Array() })),
      },
    ],
    { ifcReferences: { ifc: { visible: true } } },
    { matrix: new THREE.Matrix4(), heights: { lower: -100, upper: 100, cut: 0 } },
  );
  assert.equal(
    drawing.length,
    2,
    'GA geometry must retain the reference part hidden by model work area',
  );
  for (const part of drawing) {
    part.geometry.dispose();
    part.edges.dispose();
  }
  refs.setWorkArea(null);
  assert.equal(farMesh.visible, true);
  assert.equal(hiddenMesh.visible, false);
  const edges = new Float64Array([-1000, 0, 0, 1000, 0, 0]);
  const mesh = new THREE.LineSegments(
    new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(edges, 3)),
    new THREE.LineBasicMaterial(),
  );
  const cam = camera(),
    caster = new THREE.Raycaster();
  caster.setFromCamera(new THREE.Vector2(0.5, 0), cam);
  const candidates = referenceCandidates([{ mesh, edges, index: edgeIndex(edges) }], {
    ray: caster.ray,
    camera: cam,
    pointer: [150, 100],
    width: 200,
    height: 200,
    workArea: box,
  });
  assert.ok(candidates.some((c) => c.edge && Math.abs(c.coords[0] - 50) < 1e-6));
  for (const c of candidates) assert.equal(withinWorkArea(box, c.coords), true);
  for (const m of [nearMesh, farMesh, hiddenMesh, mesh]) {
    m.geometry.dispose();
    m.material.dispose();
  }
});

test('clipping retains complete assembly and block selections while hiding their outside grips', () => {
  const p = project(),
    inside = new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10)),
    outside = new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10));
  outside.position.set(1000, 0, 0);
  p.objects = [
    { id: 'a', type: 'helperpoint', start: [0, 0, 0] },
    { id: 'b', type: 'helperpoint', start: [1000, 0, 0] },
  ];
  p.assemblies = [{ id: 'assembly', memberIds: ['a', 'b'] }];
  p.workArea = { rectangle: [-100, -100, 100, 100], lower: -100, upper: 100 };
  const ui = { selectedIds: new Set(['a', 'b']), selectionMode: 'assembly' },
    ctl = createWorkAreaController({
      project: p,
      tools: {},
      ui,
      renderState: {
        renderedById: new Map([
          ['a', { child: inside }],
          ['b', { child: outside }],
        ]),
      },
      display: { set() {} },
      setDrawing() {},
      render() {},
      status() {},
      focus() {},
      fit() {},
      commit() {},
    });
  ctl.sync();
  assert.equal(ctl.allowsObject('b'), false);
  assert.deepEqual(ui.selectedIds, new Set(['a', 'b']));
  ui.selectionMode = 'part';
  p.objects = p.objects.map((o) => ({ ...o, parametricBlock: { instanceId: 'block' } }));
  ctl.sync();
  assert.deepEqual(ui.selectedIds, new Set(['a', 'b']));
  for (const m of [inside, outside]) {
    m.geometry.dispose();
    m.material.dispose();
  }
});

test('fit all includes cropped model objects and complete visible reference bounds in one undoable change', () => {
  const p = project(),
    history = new ProjectHistory();
  p.workArea = { rectangle: [0, 0, 10, 10], lower: 0, upper: 10 };
  const before = structuredClone(p.workArea),
    child = new THREE.Mesh(new THREE.BoxGeometry(200, 400, 600));
  child.position.set(1000, 2000, 3000);
  child.visible = false;
  p.objects = [{ id: 'outside' }];
  const reference = new THREE.Box3(
    new THREE.Vector3(-4000, -5000, -6000),
    new THREE.Vector3(-3000, -4000, -5000),
  );
  let fits = 0;
  const ctl = createWorkAreaController({
    project: p,
    tools: {},
    ui: { selectedIds: new Set() },
    renderState: { renderedById: new Map([['outside', { child }]]) },
    setDrawing() {},
    createHUD() {},
    display: { set() {} },
    render() {},
    fit: () => fits++,
    status() {},
    focus() {},
    referenceBounds: () => reference,
    commit(next) {
      history.checkpoint(p);
      p.workArea = next;
    },
  });
  ctl.fitAll();
  assert.deepEqual(p.workArea, {
    rectangle: [-4100, -5100, 1200, 2300],
    lower: -6100,
    upper: 3400,
  });
  assert.equal(fits, 1);
  assert.equal(history.past.length, 1);
  assert.deepEqual(history.undo(p).workArea, before);
  child.geometry.dispose();
  child.material.dispose();
});
