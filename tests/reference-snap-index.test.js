import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { referenceSnapFixture } from '../scripts/reference-snap-fixture.js';
import { createReferencePartSnapIndex } from '../src/references/snap-part-index.js';
import { referenceCandidates } from '../src/references/edge-index.js';
import { ReferenceModels } from '../src/references/reference-models.js';

test('reference part culling preserves snap candidates across camera, placement, scale, visibility and work area changes', () => {
  const f = referenceSnapFixture({ references: 2, partsPerReference: 180, overlap: true });
  try {
    for (const m of f.models) m.snapIndex = createReferencePartSnapIndex(m.parts, m.group);
    for (const perspective of [false, true]) {
      const camera = perspective
        ? new THREE.PerspectiveCamera(50, 1280 / 720, 1, 100000)
        : f.queries[0].camera;
      camera.position.set(6000, 6000, 10000);
      camera.lookAt(6000, 3000, 0);
      camera.updateMatrixWorld();
      for (const mode of [0, 1, 2]) {
        const m = f.models[0];
        m.group.position.set(mode * 800, mode * 300, 100 * mode);
        m.group.rotation.z = mode * 0.28;
        m.group.scale.setScalar(mode === 2 ? 1.7 : 1);
        m.group.updateMatrixWorld(true);
        m.parts[25].mesh.visible = mode !== 1;
        const bounds =
          mode === 2
            ? new THREE.Box3(new THREE.Vector3(0, 0, -1000), new THREE.Vector3(12000, 12000, 1000))
            : null;
        for (let i = 0; i < 90; i++) {
          const target = new THREE.Vector3(1500 + i * 67, 2000 + (i % 9) * 73, 300).project(camera),
            raycaster = new THREE.Raycaster();
          raycaster.setFromCamera(new THREE.Vector2(target.x, target.y), camera);
          const options = {
            camera,
            ray: raycaster.ray,
            pointer: [(target.x + 1) * 640, (1 - target.y) * 360],
            width: 1280,
            height: 720,
            start: [3000, 4000, 300],
            nearest: true,
            perpendicular: true,
            workArea: bounds,
          };
          assert.deepEqual(
            referenceCandidates(m.snapIndex.query(options), options),
            referenceCandidates(m.parts, options),
          );
        }
      }
    }
    const m = f.models[0];
    m.group.visible = false;
    assert.deepEqual(m.snapIndex.query(f.queries[0]), []);
  } finally {
    f.dispose();
  }
});

test('production reference candidate path prunes distant parts and preserves flags and rebuilds on replacement', () => {
  const f = referenceSnapFixture({ references: 10, partsPerReference: 1000 });
  const refs = Object.assign(Object.create(ReferenceModels.prototype), {
    models: f.models,
    group: f.root,
    setWorkArea() {},
  });
  try {
    refs.syncParts();
    const old = f.models[0].snapIndex,
      stats = {};
    old.query(f.queries[0], stats);
    assert.ok(stats.parts < 100, 'local query must avoid visiting all 1000 part bounds');
    const q = { ...f.queries[0], nearest: true, perpendicular: true };
    const exhaustive = f.models.flatMap((m) => referenceCandidates(m.parts, q));
    assert.deepEqual(refs.candidates(q), exhaustive);
    refs.syncParts();
    assert.equal(f.models[0].snapIndex, old);
    f.models[0].parts = f.models[0].parts.slice(0, 100);
    refs.syncParts();
    assert.notEqual(f.models[0].snapIndex, old);
    f.models.forEach((m) => {
      m.corners = false;
      m.edges = false;
    });
    assert.deepEqual(refs.candidates(q), []);
    refs.group.visible = false;
    assert.deepEqual(refs.candidates({}), []);
  } finally {
    f.dispose();
  }
});
