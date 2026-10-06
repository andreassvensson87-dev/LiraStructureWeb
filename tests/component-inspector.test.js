import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  componentDefinition,
  resolveComponentDraft,
  componentDraftChanged,
} from '../src/components/definitions.js';
import { componentMarkerProjection, componentMarkerAppearance } from '../src/components/markers.js';
import { createObjectMesh, updateObjectMeshSelection } from '../src/model/object-mesh.js';
const a = {
  id: 'a',
  type: 'sweep',
  start: [-1000, 0, 0],
  end: [0, 0, 0],
  profile: 'rect',
  width: 100,
  height: 100,
  thickness: 0,
  rotation: 0,
};
const b = { ...a, id: 'b', start: [0, -1000, 0], end: [0, 0, 0] };
const source = componentDefinition('fit').resolve(
  {
    id: 'fit',
    type: 'component',
    kind: 'fit',
    ...componentDefinition('fit').defaults,
    references: ['a', 'b'],
  },
  [a, b],
);
test('component inspector resolves a detached draft and leaves saved parameters and geometry unchanged', () => {
  const saved = structuredClone(source);
  const draft = resolveComponentDraft(source, { mode: 'abut', gap: 10 }, [a, b, source]);
  assert.deepEqual(source, saved);
  assert.equal(draft.mode, 'abut');
  assert.equal(draft.gap, 10);
  assert.ok(componentDraftChanged(source, draft));
  assert.equal(componentDraftChanged(source, structuredClone(source)), false);
  assert.throws(() => resolveComponentDraft(source, { gap: -1 }, [a, b]), /Spalt/);
  assert.throws(() => resolveComponentDraft(source, { width: 100 }, [a, b]), /parameter/);
  assert.deepEqual(source, saved);
});
test('a connection has a non-material scene placeholder instead of a cutting plane display', () => {
  const object = createObjectMesh(source, { model: [a, b, source], selectedIds: new Set() });
  assert.ok(object.isGroup);
  assert.equal(object.userData.component, true);
  assert.equal(object.userData.id, 'fit');
  assert.equal(object.children.length, 0);
  updateObjectMeshSelection(object, source, new Set(['fit']));
  assert.equal(object.userData.selected, true);
});
test('connection marker stays at the junction and hides outside the camera clip volume', () => {
  const camera = new THREE.OrthographicCamera(-100, 100, 100, -100, 1, 1000);
  camera.position.set(0, 0, 200);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  assert.deepEqual(componentMarkerProjection([0, 0, 0], camera, 800, 600), { x: 400, y: 300 });
  assert.equal(componentMarkerProjection([500, 0, 0], camera, 800, 600), null);
  assert.equal(componentMarkerProjection([0, 0, 500], camera, 800, 600), null);
});
test('connection markers shrink, fade and disappear with orthographic zoom', () => {
  const camera = new THREE.OrthographicCamera(-5000, 5000, 5000, -5000, 1, 10000);
  camera.position.z = 1000;
  camera.updateMatrixWorld();
  const normal = componentMarkerAppearance([0, 0, 0], camera, 600);
  assert.equal(normal.size, 12);
  assert.equal(normal.opacity, 0.5);
  camera.zoom = 0.5;
  camera.updateProjectionMatrix();
  assert.equal(componentMarkerAppearance([0, 0, 0], camera, 600).visible, false);
  camera.zoom = 10;
  camera.updateProjectionMatrix();
  assert.equal(componentMarkerAppearance([0, 0, 0], camera, 600).size, 28);
});
test('perspective connection markers shrink with distance', () => {
  const camera = new THREE.PerspectiveCamera(60, 1, 1, 100000);
  camera.updateMatrixWorld();
  const near = componentMarkerAppearance([0, 0, -5000], camera, 600);
  const far = componentMarkerAppearance([0, 0, -10000], camera, 600);
  assert.ok(Math.abs(near.size / far.size - 2) < 1e-10);
  assert.ok(near.opacity > far.opacity);
  assert.equal(componentMarkerAppearance([0, 0, -20000], camera, 600).visible, false);
});
