import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  initialReferencePlacement,
  moveReferencePlacement,
  rotateReferencePlacement,
  applyReferencePlacement,
} from '../src/references/reference-placement.js';
import { ReferenceModels } from '../src/references/reference-models.js';
import { validateReferences, encodeReference } from '../src/references/reference-state.js';
import { readFileSync } from 'node:fs';
import { parseProjectFile, serializeProject } from '../src/project/project-file.js';
const near = (a, b) => a.forEach((v, i) => assert.ok(Math.abs(v - b[i]) < 1e-8, `${a} != ${b}`));
test('IFC and CAD import with zero offset preserves original geometry coordinates', () => {
  for (const format of ['IFC', 'DXF', 'DWG']) {
    const model = {
      format,
      placement: initialReferencePlacement(),
      unitFactor: 1,
      group: new THREE.Group(),
    };
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    mesh.position.set(1000, 2000, 3000);
    model.group.add(mesh);
    applyReferencePlacement(model);
    near(mesh.getWorldPosition(new THREE.Vector3()).toArray(), [1000, 2000, 3000]);
    model.placement = moveReferencePlacement(model.placement, [50, 60, 70], [150, 260, 370]);
    applyReferencePlacement(model);
    near(mesh.getWorldPosition(new THREE.Vector3()).toArray(), [1100, 2200, 3300]);
    mesh.geometry.dispose();
    mesh.material.dispose();
  }
});
test('rotation around a picked pivot composes arbitrary axes and movement without changing scale', () => {
  let p = moveReferencePlacement(initialReferencePlacement(), [0, 0, 0], [100, 200, 300]);
  p = rotateReferencePlacement(p, [100, 200, 300], [0, 0, 1], 90);
  p = rotateReferencePlacement(p, [100, 200, 300], [1, 0, 0], 90);
  const m = { format: 'IFC', placement: p, group: new THREE.Group() };
  applyReferencePlacement(m);
  near(new THREE.Vector3(10, 0, 0).applyMatrix4(m.group.matrixWorld).toArray(), [100, 200, 310]);
  assert.equal(p.scale, 1);
  const off = rotateReferencePlacement(initialReferencePlacement(), [10, 0, 0], [0, 0, 1], 90);
  near(off.offset, [10, -10, 0]);
});
test('reference preview cancels back to original and commits publish the transformed placement', () => {
  const m = {
    id: 'r',
    format: 'IFC',
    placement: initialReferencePlacement(),
    group: new THREE.Group(),
    parts: [],
  };
  let changed = 0;
  const refs = Object.assign(Object.create(ReferenceModels.prototype), {
    models: [m],
    selectedId: null,
    changed() {
      changed++;
    },
  });
  const next = moveReferencePlacement(m.placement, [0, 0, 0], [400, 500, 600]);
  refs.previewPlacement('r', next);
  near(m.group.position.toArray(), [400, 500, 600]);
  assert.equal(changed, 0);
  refs.clearPlacementPreview();
  near(m.group.position.toArray(), [0, 0, 0]);
  refs.previewPlacement('r', next);
  refs.setPlacement('r', next);
  refs.clearPlacementPreview();
  near(m.group.position.toArray(), [400, 500, 600]);
  assert.equal(changed, 1);
  assert.notEqual(m.placement, next);
});
test('IFC placement can be persisted with a normalized quaternion while old files remain valid', () => {
  const m = {
    id: 'r',
    format: 'IFC',
    fileName: 'r.ifc',
    title: 'r',
    folder: 'Standard',
    source: encodeReference(new Uint8Array([1]).buffer),
    visible: true,
    transparent: false,
    corners: true,
    edges: true,
  };
  const state = { folders: ['Standard'], models: [m] };
  validateReferences(state);
  m.placement = rotateReferencePlacement(initialReferencePlacement(), [10, 20, 30], [1, 0, 0], 30);
  validateReferences(state);
  const project = parseProjectFile(
    readFileSync(new URL('../examples/assemblytest.lira.json', import.meta.url), 'utf8'),
  );
  project.references = state;
  assert.deepEqual(
    parseProjectFile(serializeProject(project)).references.models[0].placement,
    m.placement,
  );
  m.placement.quaternion = [0, 0, 0, 0];
  assert.throws(() => validateReferences(state), /referenser/);
});
test('locking cancels a preview and rejects move, rotate and reset until unlocked', () => {
  const placement = {
    ...initialReferencePlacement(),
    offset: [100, 200, 300],
    rotation: 45,
    scale: 2,
  };
  const model = {
    id: 'cad',
    format: 'DXF',
    unitFactor: 1000,
    placement,
    group: new THREE.Group(),
    parts: [],
  };
  let changes = 0,
    checkpoints = 0;
  const refs = Object.assign(Object.create(ReferenceModels.prototype), {
    models: [model],
    selectedId: null,
    changed() {
      changes++;
    },
    syncPlacementLock() {},
    message() {},
    beforePlacementChange() {
      checkpoints++;
    },
  });
  refs.previewPlacement('cad', moveReferencePlacement(placement, [0, 0, 0], [500, 0, 0]));
  refs.setLocked(model, true);
  near(model.placement.offset, [100, 200, 300]);
  refs.setPlacement('cad', initialReferencePlacement());
  refs.previewPlacement('cad', initialReferencePlacement());
  refs.resetPlacement(model);
  assert.deepEqual(model.placement, placement);
  assert.equal(checkpoints, 0);
  refs.setLocked(model, false);
  refs.resetPlacement(model);
  near(model.placement.offset, [0, 0, 0]);
  assert.equal(model.placement.rotation, 0);
  assert.equal(model.placement.scale, 2);
  assert.equal(model.unitFactor, 1000);
  assert.equal(checkpoints, 1);
  assert.equal(changes, 3);
});
