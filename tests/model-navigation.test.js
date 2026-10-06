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
