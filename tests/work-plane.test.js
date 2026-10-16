import { WorkPlaneGuide } from '../src/model/work-plane-guide.js';
import { gripWorkPlane, moveGripPoints } from '../src/model/grips.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { workPlaneFromPoints, drawingWorkPlane } from '../src/work-plane.js';
import { resolveSnap } from '../src/snap.js';
test('three model points define an orthonormal inclined plane through all points', () => {
  const points = [
      [100, 200, 300],
      [2100, 200, 2300],
      [100, 3200, 3300],
    ],
    frame = workPlaneFromPoints(points),
    u = new THREE.Vector3(...frame.u),
    v = new THREE.Vector3(...frame.v),
    normal = u.clone().cross(v);
  assert.deepEqual(frame.origin, points[0]);
  assert.ok(Math.abs(u.length() - 1) < 1e-10);
  assert.ok(Math.abs(v.length() - 1) < 1e-10);
  assert.ok(Math.abs(u.dot(v)) < 1e-10);
  for (const p of points)
    assert.ok(
      Math.abs(new THREE.Vector3(...p).sub(new THREE.Vector3(...frame.origin)).dot(normal)) < 1e-8,
    );
  const target = new THREE.Vector3(...frame.origin)
      .addScaledVector(u, 1234)
      .addScaledVector(v, 987),
    camera = new THREE.OrthographicCamera(-5000, 5000, 5000, -5000, 1, 100000);
  camera.position.copy(target).addScaledVector(normal, 10000);
  camera.up.copy(v);
  camera.lookAt(target);
  camera.updateMatrixWorld();
  const caster = new THREE.Raycaster();
  caster.setFromCamera(new THREE.Vector2(0, 0), camera);
  const result = resolveSnap({
    pointer: [500, 500],
    camera,
    width: 1000,
    height: 1000,
    ray: caster.ray,
    start: null,
    z: 0,
    sweeps: [],
    grid: { x: [], y: [] },
    workPlane: frame,
  });
  assert.ok(target.distanceTo(new THREE.Vector3(...result.point)) < 1e-8);
});
test('duplicate and collinear workplane points are rejected', () => {
  for (const points of [
    [
      [0, 0, 0],
      [0, 0, 0],
      [0, 100, 0],
    ],
    [
      [0, 0, 0],
      [100, 100, 100],
      [200, 200, 200],
    ],
  ])
    assert.throws(() => workPlaneFromPoints(points), /samma linje/);
});

test('copy and move use the active inclined plane for target snapping', () => {
  const frame = workPlaneFromPoints([
    [0, 0, 0],
    [2000, 0, 2000],
    [0, 2000, 0],
  ]);
  const normal = new THREE.Vector3(...frame.u).cross(new THREE.Vector3(...frame.v)),
    target = new THREE.Vector3(...frame.u)
      .multiplyScalar(1234)
      .addScaledVector(new THREE.Vector3(...frame.v), 789);
  const camera = new THREE.OrthographicCamera(-5000, 5000, 5000, -5000, 1, 100000);
  camera.position.copy(target).addScaledVector(normal, 10000);
  camera.up.fromArray(frame.v);
  camera.lookAt(target);
  camera.updateMatrixWorld();
  const caster = new THREE.Raycaster();
  caster.setFromCamera(new THREE.Vector2(0, 0), camera);
  for (const mode of ['copy', 'move']) {
    const workPlane = drawingWorkPlane({ mode }, frame);
    assert.equal(workPlane, frame);
    const snap = resolveSnap({
      pointer: [500, 500],
      camera,
      width: 1000,
      height: 1000,
      ray: caster.ray,
      start: [0, 0, 0],
      z: 0,
      sweeps: [],
      grid: { x: [], y: [] },
      axisSnap: false,
      polar: 0,
      workPlane,
    });
    assert.ok(target.distanceTo(new THREE.Vector3(...snap.point)) < 1e-8);
  }
  assert.equal(drawingWorkPlane({ mode: 'copy' }, null), null);
  assert.equal(drawingWorkPlane({ mode: 'workPlane' }, frame), null);
});

test('plate grip placement resolves a diagonal pointer in the plate plane and filters off-plane snap targets', () => {
  const plate = {
    id: 'p',
    type: 'plate',
    frame: { origin: [100, 200, 300], u: [1, 0, 0], v: [0, 0, 1] },
    polygon: [
      [0, 0],
      [1000, 0],
      [1000, 1000],
      [0, 1000],
    ],
  };
  const refs = [{ id: 'p', kind: 2 }],
    base = [1100, 200, 1300];
  const frame = gripWorkPlane([plate], refs, base);
  assert.deepEqual(frame.origin, base);
  assert.equal(drawingWorkPlane({ mode: 'grip', frame }, null), frame);
  const target = [1400, 200, 1600],
    camera = new THREE.OrthographicCamera(-2500, 2500, 2500, -2500, 1, 100000);
  camera.position.set(1400, 10000, 1600);
  camera.up.set(0, 0, 1);
  camera.lookAt(...target);
  camera.updateMatrixWorld();
  const caster = new THREE.Raycaster();
  caster.setFromCamera(new THREE.Vector2(0, 0), camera);
  const snap = resolveSnap({
    pointer: [500, 500],
    camera,
    width: 1000,
    height: 1000,
    ray: caster.ray,
    start: base,
    z: base[2],
    workPlane: frame,
    constrainToPlane: true,
    sweeps: [{ id: 'off', type: 'helperpoint', start: [1400, 400, 1600] }],
    grid: { x: [], y: [] },
    axisSnap: false,
    polar: 0,
  });
  assert.ok(new THREE.Vector3(...target).distanceTo(new THREE.Vector3(...snap.point)) < 1e-8);
  const moved = moveGripPoints([plate], refs, snap.point, base)[0];
  assert.ok(Math.hypot(...moved.polygon[2].map((v) => v - 1300)) < 1e-8);
  assert.deepEqual(plate.polygon[2], [1000, 1000]);
  const parallel = { ...plate, id: 'parallel', frame: { ...plate.frame, origin: [100, 500, 300] } };
  assert.ok(gripWorkPlane([plate, parallel], [...refs, { id: 'parallel', kind: 2 }], base));
  const perpendicular = { ...plate, id: 'perpendicular', frame: { ...plate.frame, v: [0, 1, 0] } };
  assert.equal(
    gripWorkPlane([plate, perpendicular], [...refs, { id: 'perpendicular', kind: 2 }], base),
    null,
  );
  assert.equal(
    gripWorkPlane(
      [{ id: 's', type: 'helperline', start: base, end: target }],
      [{ id: 's', kind: 'end' }],
      base,
    ),
    null,
  );
});

test('work plane guides keep screen size through zoom, face the camera and release replaced graphics', () => {
  const scene = new THREE.Scene(),
    guide = new WorkPlaneGuide(scene),
    camera = new THREE.OrthographicCamera(-500, 500, 500, -500, 1, 10000);
  camera.position.set(1000, 1000, 1000);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  const points = [
      [0, 0, 0],
      [100, 0, 0],
      [0, 100, 0],
    ],
    frame = workPlaneFromPoints(points);
  guide.show(points, frame);
  guide.update(camera, 800, 800);
  const tip = () =>
    new THREE.Vector3()
      .fromBufferAttribute(guide.axes[0].head.geometry.attributes.position, 0)
      .project(camera);
  const first = tip(),
    scale = guide.ring.scale.x;
  assert.equal(guide.axes.length, 3);
  assert.ok(
    guide.axes.every(
      (axis) => axis.head.visible && axis.label.quaternion.equals(camera.quaternion),
    ),
  );
  camera.zoom = 4;
  camera.updateProjectionMatrix();
  guide.update(camera, 800, 800);
  assert.ok(Math.hypot(first.x - tip().x, first.y - tip().y) < 1e-10);
  assert.equal(guide.ring.scale.x, scale / 4);
  assert.deepEqual(frame.origin, [0, 0, 0]);
  let disposed = 0;
  for (const child of guide.group.children)
    child.geometry.addEventListener('dispose', () => disposed++);
  const count = guide.group.children.length;
  guide.group.visible = false;
  guide.show(points.slice(0, 2));
  assert.equal(disposed, count);
  assert.equal(guide.group.visible, true);
  assert.equal(guide.group.children.length, 1);
  guide.clear();
  assert.equal(guide.group.children.length, 0);
});

test('two picked points define X and reuse previous Y with an orthonormal, right-handed frame', async () => {
  const { workPlaneFromTwoPoints } = await import('../src/work-plane.js');
  const previous = workPlaneFromPoints([
    [10, 20, 30],
    [110, 20, 130],
    [10, 120, 30],
  ]);
  const origin = [300, 400, 500];
  for (const reference of [null, previous]) {
    for (const offset of [
      [1000, 0, 300],
      [0, 1000, 0],
      [0, -1000, 0],
      [-1000, 0, 0],
      [300, 400, 500],
    ]) {
      const points = [origin, origin.map((v, i) => v + offset[i])];
      const frame = workPlaneFromTwoPoints(points, reference);
      const u = new THREE.Vector3(...frame.u),
        v = new THREE.Vector3(...frame.v),
        n = u.clone().cross(v);
      assert.deepEqual(frame.origin, origin);
      assert.ok(u.distanceTo(new THREE.Vector3(...offset).normalize()) < 1e-10);
      assert.ok(Math.abs(u.dot(v)) < 1e-10);
      assert.ok(Math.abs(u.length() - 1) < 1e-10);
      assert.ok(Math.abs(v.length() - 1) < 1e-10);
      assert.ok(Math.abs(n.length() - 1) < 1e-10);
      const oldY = new THREE.Vector3(...(reference?.v || [0, 1, 0]));
      const projectedY = oldY.clone().addScaledVector(u, -oldY.dot(u));
      if (projectedY.length() > 1e-8) assert.ok(v.distanceTo(projectedY.normalize()) < 1e-10);
    }
  }
  for (const points of [
    [
      [0, 0, 0],
      [0, 0, 0],
    ],
    [
      [0, 0, 0],
      [0.9, 0, 0],
    ],
    [
      [0, 0, 0],
      [NaN, 0, 0],
    ],
    [[0, 0, 0]],
  ])
    assert.throws(() => workPlaneFromTwoPoints(points));
});

test('two-point workplane controller finishes only after two valid picks, preserves existing plane on failure/cancel and resets', async (t) => {
  const { createWorkplaneController } = await import('../src/model/ui/workplane-controller.js');
  const { createToolSession, resetToolInteraction } = await import('../src/model/tool-session.js');
  const previousDocument = globalThis.document,
    elements = [];
  const make = () => ({ classList: { toggle() {} }, setAttribute() {}, hidden: false });
  const status = { textContent: '' };
  globalThis.document = {
    createElement: () => {
      const e = make();
      elements.push(e);
      return e;
    },
    getElementById: () => status,
    querySelector: () => ({ prepend() {} }),
  };
  t.after(() => {
    globalThis.document = previousDocument;
  });
  const tools = createToolSession(),
    scene = new THREE.Scene();
  const original = workPlaneFromPoints([
    [0, 0, 100],
    [100, 0, 200],
    [0, 100, 100],
  ]);
  tools.temporaryPlane = original;
  tools.workPlanePoints = [
    [0, 0, 100],
    [100, 0, 200],
    [0, 100, 100],
  ];
  let controller;
  controller = createWorkplaneController({
    scene,
    tools,
    renderer: { domElement: { focus() {} } },
    getInspector: () => ({ finish() {} }),
    setDrawing: (value) => {
      resetToolInteraction(tools, value);
      controller?.syncWorkPlane();
    },
    syncOperationUI() {},
  });
  t.after(() => controller.workPlaneGuide.clear());
  const two = elements.find((e) => e.id === 'work-plane-two'),
    three = elements.find((e) => e.id === 'work-plane'),
    reset = elements.find((e) => e.id === 'work-plane-reset');
  two.onclick();
  assert.equal(tools.operation.pointCount, 2);
  assert.match(status.textContent, /1\/2/);
  assert.notEqual(tools.operation.referenceFrame, original, 'orientation is a detached snapshot');
  controller.pickWorkPlane([300, 400, 500]);
  assert.match(status.textContent, /2\/2/);
  controller.pickWorkPlane([300, 400, 500]);
  assert.equal(tools.operation.points.length, 1);
  assert.equal(tools.temporaryPlane, original);
  assert.match(status.textContent, /minst 1 mm/);
  controller.pickWorkPlane([1300, 400, 1500]);
  assert.equal(tools.drawing, false);
  assert.equal(tools.operation, null);
  assert.equal(tools.workPlanePoints.length, 2);
  assert.deepEqual(tools.temporaryPlane.origin, [300, 400, 500]);
  const retained = tools.temporaryPlane;
  three.onclick();
  controller.pickWorkPlane([10, 20, 30]);
  controller.pickWorkPlane([110, 20, 30]);
  assert.equal(tools.drawing, true, 'three-point path still needs a third pick');
  controller.pickWorkPlane([10, 120, 30]);
  assert.equal(tools.drawing, false);
  assert.equal(tools.workPlanePoints.length, 3);
  two.onclick();
  controller.pickWorkPlane([0, 0, 0]);
  resetToolInteraction(tools, false);
  controller.syncWorkPlane();
  assert.deepEqual(
    tools.temporaryPlane.origin,
    [10, 20, 30],
    'Escape/reset preserves last completed plane',
  );
  reset.onclick();
  assert.equal(tools.temporaryPlane, null);
  assert.deepEqual(tools.workPlanePoints, []);
  assert.notEqual(retained, original);
});
