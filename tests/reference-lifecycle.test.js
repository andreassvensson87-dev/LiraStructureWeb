import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { ReferenceModels } from '../src/references/reference-models.js';
import { IfcAPI } from 'web-ifc';
import { readFileSync } from 'node:fs';
import { createReferenceFixture } from '../scripts/ifc-memory-fixture.js';

function referenceFixture() {
  const controls = new Map();
  const references = Object.assign(Object.create(ReferenceModels.prototype), {
    models: [],
    folders: ['Standard'],
    selectedId: null,
    showList() {
      this.$('[data-model]').hidden = true;
    },
    showModel(id) {
      this.selectedId = id;
    },
    parts: [],
    pending: [],
    group: new THREE.Group(),
    status: () => {},
    fit: () => {},
    $: (selector) => {
      if (!controls.has(selector)) controls.set(selector, {});
      return controls.get(selector);
    },
  });
  return references;
}
function part() {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial());
  const disposed = { geometry: 0, material: 0 };
  mesh.geometry.addEventListener('dispose', () => disposed.geometry++);
  mesh.material.addEventListener('dispose', () => disposed.material++);
  return { mesh, disposed };
}
function fakeWorkers(run) {
  const previous = globalThis.Worker;
  const workers = [];
  globalThis.Worker = class {
    constructor() {
      workers.push(this);
      this.terminated = 0;
      this.posts = [];
    }
    terminate() {
      this.terminated++;
    }
    postMessage(data) {
      this.posts.push(data);
    }
  };
  return Promise.resolve()
    .then(() => run(workers))
    .finally(() => {
      globalThis.Worker = previous;
    });
}

test('removing during import terminates the worker and disposes current and pending resources', async () => {
  await fakeWorkers(async (workers) => {
    const references = referenceFixture(),
      current = part(),
      pending = part();
    references.parts = [current];
    const group = new THREE.Group();
    group.add(current.mesh);
    references.models = [{ id: 'existing', group, parts: [current] }];
    references.selectedId = 'existing';
    references.group.add(group);
    await references.load({ name: 'replacement.ifc', arrayBuffer: async () => new ArrayBuffer(8) });
    references.pending.push(pending);
    references.remove();
    assert.equal(workers[0].terminated, 1);
    assert.equal(references.worker, null);
    assert.deepEqual(references.pending, []);
    assert.deepEqual(references.parts, []);
    assert.equal(references.group.children.length, 0);
    assert.equal(references.$('[data-model]').hidden, true);
    for (const p of [current, pending]) assert.deepEqual(p.disposed, { geometry: 1, material: 1 });
    workers[0].onmessage({ data: { type: 'done', count: 1, schema: 'IFC4' } });
    assert.equal(references.parts.length, 0, 'A late result must not restore a removed reference');
  });
});

test('late errors and meshes from a superseded worker cannot cancel the current import', async () => {
  await fakeWorkers(async (workers) => {
    const references = referenceFixture();
    await references.load({ name: 'old.ifc', arrayBuffer: async () => new ArrayBuffer(8) });
    const old = workers[0],
      pending = part();
    references.pending.push(pending);
    await references.load({ name: 'new.ifc', arrayBuffer: async () => new ArrayBuffer(8) });
    const active = workers[1];
    old.onerror();
    old.onmessage({ data: { type: 'error', message: 'late old error' } });
    old.onmessage({ data: { type: 'mesh' } });
    assert.equal(references.worker, active);
    assert.equal(active.terminated, 0);
    assert.deepEqual(pending.disposed, { geometry: 1, material: 1 });
    assert.deepEqual(references.pending, []);
    references.cancel();
  });
});

test('a superseded delayed file read cannot post its bytes to an old worker', async () => {
  await fakeWorkers(async (workers) => {
    const references = referenceFixture();
    let resolve;
    const oldRead = references.load({
      name: 'slow.ifc',
      arrayBuffer: () =>
        new Promise((r) => {
          resolve = r;
        }),
    });
    await references.load({ name: 'new.ifc', arrayBuffer: async () => new ArrayBuffer(8) });
    resolve(new ArrayBuffer(8));
    await oldRead;
    assert.equal(workers[0].posts.length, 0);
    assert.equal(workers[0].terminated, 1);
    assert.equal(workers[1].posts.length, 1);
    references.cancel();
  });
});

test('synthetic load fixture imports boxes and circular extrusions with unique placements', async () => {
  const template = readFileSync(new URL('./fixtures/reference-box.ifc', import.meta.url), 'utf8');
  const api = new IfcAPI();
  await api.Init();
  const model = api.OpenModel(new TextEncoder().encode(createReferenceFixture(template, 20)), {
    COORDINATE_TO_ORIGIN: false,
  });
  let count = 0;
  const geometryIds = new Set(),
    origins = new Set();
  try {
    api.StreamAllMeshes(model, (mesh) => {
      const p = mesh.geometries.get(0);
      geometryIds.add(p.geometryExpressID);
      origins.add(p.flatTransformation.slice(12, 15).join(','));
      count++;
    });
    assert.equal(count, 20);
    assert.equal(origins.size, 20);
    assert.equal(geometryIds.size, 2);
  } finally {
    api.CloseModel(model);
  }
});

test('multiple reference imports coexist and removing one preserves the other resources', async () => {
  await fakeWorkers(async (workers) => {
    const references = referenceFixture();
    for (const name of ['first.ifc', 'second.ifc']) {
      await references.load({ name, arrayBuffer: async () => new ArrayBuffer(8) });
      references.pending.push(part());
      workers.at(-1).onmessage({ data: { type: 'done', count: 1, schema: 'IFC4' } });
    }
    assert.equal(references.models.length, 2);
    assert.equal(references.parts.length, 2);
    const [first, second] = references.models;
    references.remove(first.id);
    assert.deepEqual(first.parts[0].disposed, { geometry: 1, material: 1 });
    assert.deepEqual(second.parts[0].disposed, { geometry: 0, material: 0 });
    assert.deepEqual(references.parts, second.parts);
    assert.equal(references.group.children[0], second.group);
    references.clear();
  });
});

test('replacement disposes only its target after successful import and preserves its group and title', async () => {
  await fakeWorkers(async (workers) => {
    const references = referenceFixture();
    await references.load({ name: 'old.ifc', arrayBuffer: async () => new ArrayBuffer(8) });
    references.pending.push(part());
    workers[0].onmessage({ data: { type: 'done', schema: 'IFC4' } });
    const previous = references.models[0];
    previous.folder = 'Building A';
    previous.title = 'Custom title';
    previous.group.visible = false;
    previous.transparent = true;
    previous.corners = false;
    await references.load(
      { name: 'new.ifc', arrayBuffer: async () => new ArrayBuffer(8) },
      { replaceId: previous.id },
    );
    assert.equal(references.models[0], previous);
    references.pending.push(part());
    workers[1].onmessage({ data: { type: 'done', schema: 'IFC4' } });
    const model = references.models[0];
    assert.equal(references.models.length, 1);
    assert.equal(model.id, previous.id);
    assert.equal(model.title, 'Custom title');
    assert.equal(model.folder, 'Building A');
    assert.equal(model.fileName, 'new.ifc');
    assert.equal(model.group.visible, false);
    assert.equal(model.transparent, true);
    assert.equal(model.parts[0].mesh.material.opacity, 0.3);
    assert.equal(model.corners, false);
    assert.deepEqual(previous.parts[0].disposed, { geometry: 1, material: 1 });
    references.clear();
  });
});

test('hidden reference models do not contribute to scene bounds or snapping', () => {
  const references = referenceFixture(),
    shown = part(),
    hidden = part();
  shown.mesh.position.set(10, 0, 0);
  hidden.mesh.position.set(1000, 0, 0);
  for (const [p, visible] of [
    [shown, true],
    [hidden, false],
  ]) {
    const group = new THREE.Group();
    group.add(p.mesh);
    group.visible = visible;
    references.models.push({ group, parts: [p], corners: !visible, edges: !visible });
    references.group.add(group);
  }
  assert.equal(references.bounds().max.x, 10.5);
  assert.deepEqual(references.candidates({}), []);
  references.syncParts();
  references.clear();
});
