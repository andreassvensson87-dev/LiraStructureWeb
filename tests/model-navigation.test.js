import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { ModelNavigation } from '../src/model/navigation.js';
import { VIEW_AXES, viewOrientation } from '../src/model/view-orientation.js';
function setup() {
  const camera = new THREE.OrthographicCamera(-5000, 5000, 5000, -5000, 1, 1e8);
  camera.up.set(0, 0, 1);
  camera.position.set(6500, -8000, 6500);
  const created = [];
  const createControls = () => {
    const controls = {
      target: new THREE.Vector3(1500, 0, 0),
      enabled: true,
      enableDamping: true,
      zoomToCursor: true,
      minZoom: 0.001,
      maxZoom: 1000,
      mouseButtons: { LEFT: null, MIDDLE: THREE.MOUSE.PAN },
      touches: { ONE: null },
      update() {
        camera.lookAt(this.target);
        camera.updateMatrixWorld();
      },
      dispose() {
        this.disposed = true;
      },
    };
    created.push(controls);
    return controls;
  };
  const navigation = new ModelNavigation({
    camera,
    controls: createControls(),
    createControls,
    getSize: () => [1200, 600],
  });
  navigation.updateProjection();
  navigation.controls.update();
  return { camera, navigation, created };
}
test('axis views preserve zoom and orbit center and remain stable at all six poles', () => {
  for (const axis of ['X', 'Y', 'Z']) {
    for (const sign of [1, -1]) {
      const { camera, navigation, created } = setup();
      camera.zoom = 3;
      const target = navigation.controls.target.clone();
      const height = navigation.viewHeight;
      navigation.lookAlongAxis(axis, sign);
      const direction = camera.position.clone().sub(target).normalize();
      assert.ok(
        direction.distanceTo(new THREE.Vector3(...VIEW_AXES[axis]).multiplyScalar(sign)) < 1e-10,
      );
      assert.equal(camera.zoom, 3);
      assert.equal(navigation.viewHeight, height);
      assert.ok(navigation.controls.target.equals(target));
      assert.equal(created[0].disposed, true);
      assert.equal(navigation.controls.mouseButtons.LEFT, null);
      assert.equal(navigation.controls.mouseButtons.MIDDLE, THREE.MOUSE.PAN);
      const projected = viewOrientation(camera).find(
        (entry) => entry.axis === axis && entry.sign === sign,
      );
      assert.ok(Math.abs(projected.x) < 1e-10 && Math.abs(projected.y) < 1e-10);
      assert.ok(Math.abs(projected.depth - 1) < 1e-10);
      assert.ok(camera.matrixWorld.elements.every(Number.isFinite));
    }
  }
});

test('orientation widget follows rotation but is independent of translation and zoom', () => {
  const { camera, navigation } = setup();
  const before = viewOrientation(camera);
  navigation.movePivot(new THREE.Vector3(100, 200, 500));
  camera.zoom = 4;
  camera.updateProjectionMatrix();
  const after = viewOrientation(camera);
  after.forEach((entry, index) => {
    assert.ok(Math.abs(entry.x - before[index].x) < 1e-10);
    assert.ok(Math.abs(entry.y - before[index].y) < 1e-10);
    const opposite = after.find((other) => other.axis === entry.axis && other.sign === -entry.sign);
    assert.ok(Math.abs(entry.x + opposite.x) < 1e-10);
    assert.ok(Math.abs(entry.y + opposite.y) < 1e-10);
  });
  navigation.lookAlongAxis('X');
  assert.notDeepEqual(viewOrientation(camera), before);
});
test('changing orbit pivot preserves projected geometry at different zoom levels', () => {
  for (const zoom of [1, 4]) {
    const { camera, navigation } = setup();
    camera.zoom = zoom;
    navigation.updateProjection();
    const points = [
      [0, 0, 0],
      [1000, 2000, 3000],
    ].map((p) => new THREE.Vector3(...p));
    const before = points.map((p) => p.clone().project(camera));
    navigation.movePivot(new THREE.Vector3(1200, 800, 100));
    points.forEach((p, i) => {
      const after = p.clone().project(camera);
      assert.ok(Math.hypot(after.x - before[i].x, after.y - before[i].y) < 1e-10);
    });
  }
});
test('workplane view replaces controls, preserving tool locks and zoom options', () => {
  const { camera, navigation, created } = setup();
  const center = new THREE.Vector3(20, 30, 40),
    normal = new THREE.Vector3(0, -1, 1).normalize();
  const up = new THREE.Vector3(0, 1, 1).normalize();
  navigation.lookAtPlane(center, normal, up);
  assert.equal(created[0].disposed, true);
  assert.equal(navigation.controls, created[1]);
  assert.equal(navigation.controls.mouseButtons.LEFT, null);
  assert.equal(navigation.controls.mouseButtons.MIDDLE, THREE.MOUSE.PAN);
  assert.equal(navigation.controls.touches.ONE, null);
  assert.equal(navigation.controls.zoomToCursor, true);
  assert.ok(camera.position.clone().sub(center).normalize().distanceTo(normal) < 1e-10);
  assert.ok(camera.up.distanceTo(up) < 1e-10);
});
test('fit frames supplied bounds and clears previous orbit offset', () => {
  const { camera, navigation } = setup();
  navigation.movePivot(new THREE.Vector3(500, 200, 100));
  const bounds = new THREE.Box3(new THREE.Vector3(-100, -200, 0), new THREE.Vector3(100, 200, 600));
  navigation.fit(bounds, new THREE.Vector3(1, -1, 1).normalize());
  assert.deepEqual(navigation.controls.target.toArray(), [0, 0, 300]);
  assert.equal(navigation.projectionOffset.length(), 0);
  assert.equal(camera.zoom, 1);
  for (const x of [-100, 100])
    for (const y of [-200, 200])
      for (const z of [0, 600]) {
        const p = new THREE.Vector3(x, y, z).project(camera);
        assert.ok(Math.abs(p.x) < 1 && Math.abs(p.y) < 1);
      }
});

test('orbit picks the nearest visible native or reference surface without depending on selection mode', async () => {
  const { createModelPicking } = await import('../src/model/ui/model-picking.js');
  const { ReferenceModels } = await import('../src/references/reference-models.js');
  const { camera, navigation } = setup();
  camera.position.set(0, 0, 1000);
  camera.up.set(0, 1, 0);
  navigation.controls.target.set(0, 0, 0);
  navigation.controls.update();
  const objects = new THREE.Group();
  const native = new THREE.Mesh(
    new THREE.BoxGeometry(100, 100, 100),
    new THREE.MeshBasicMaterial(),
  );
  native.position.z = 100;
  objects.add(native);
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(100, 100, 100),
    new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }),
  );
  const modelGroup = new THREE.Group();
  modelGroup.position.set(20, 10, 300);
  modelGroup.rotation.z = 0.3;
  modelGroup.add(mesh);
  const group = new THREE.Group();
  group.add(modelGroup);
  objects.updateMatrixWorld(true);
  group.updateMatrixWorld(true);
  const references = Object.assign(Object.create(ReferenceModels.prototype), {
    group,
    models: [{ id: 'ifc', format: 'IFC', locked: true, group: modelGroup, parts: [{ mesh }] }],
  });
  const picking = createModelPicking({
    camera,
    navigation,
    objects,
    getReferences: () => references,
    host: {
      clientWidth: 1200,
      clientHeight: 600,
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 1200, height: 600 }),
    },
  });
  const event = { clientX: 600, clientY: 300, button: 1, ctrlKey: true, pointerType: 'mouse' };
  const reset = () => {
    camera.position.set(0, 0, 1000);
    navigation.controls.target.set(0, 0, 0);
    navigation.projectionOffset.set(0, 0);
    navigation.updateProjection();
    navigation.controls.update();
  };
  const orbit = () => {
    reset();
    picking.orbitAroundHit(event);
    return navigation.controls.target.toArray().map((v) => Math.round(v * 1e8) / 1e8);
  };
  for (const mode of ['reference', 'object']) {
    references.selectionMode = mode;
    assert.deepEqual(orbit(), [0, 0, 350]);
  }
  native.position.z = 500;
  objects.updateMatrixWorld(true);
  assert.deepEqual(
    orbit(),
    [0, 0, 550],
    'a reference behind native geometry cannot steal the pivot',
  );
  native.visible = false;
  assert.deepEqual(orbit(), [0, 0, 350]);
  for (const hidden of [mesh, modelGroup, group]) {
    hidden.visible = false;
    assert.deepEqual(orbit(), [0, 0, 0], 'hidden surfaces leave the pivot unchanged');
    hidden.visible = true;
  }
  references.workAreaBounds = new THREE.Box3(
    new THREE.Vector3(-200, -200, 0),
    new THREE.Vector3(200, 200, 320),
  );
  assert.deepEqual(
    orbit(),
    [0, 0, 250],
    'clipped front surface is skipped for the visible rear surface',
  );
  references.workAreaBounds = new THREE.Box3(
    new THREE.Vector3(-200, -200, 0),
    new THREE.Vector3(200, 200, 200),
  );
  assert.deepEqual(orbit(), [0, 0, 0]);
  references.workAreaBounds = null;
  reset();
  picking.orbitAroundHit({ ...event, ctrlKey: false });
  assert.deepEqual(
    navigation.controls.target.toArray(),
    [0, 0, 0],
    'plain pan must not change the orbit center',
  );
  picking.orbitAroundHit({ ...event, button: 0, pointerType: 'touch', isPrimary: true });
  assert.deepEqual(
    navigation.controls.target.toArray(),
    [0, 0, 0],
    'disabled touch rotation must not change the orbit center',
  );
  navigation.controls.touches.ONE = THREE.TOUCH.ROTATE;
  picking.orbitAroundHit({ ...event, button: 0, pointerType: 'touch', isPrimary: true });
  assert.ok(navigation.controls.target.distanceTo(new THREE.Vector3(0, 0, 350)) < 1e-8);
  for (const part of [native, mesh]) {
    part.geometry.dispose();
    part.material.dispose();
  }
});
