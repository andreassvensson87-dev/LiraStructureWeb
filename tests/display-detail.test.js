import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import {
  createObjectMesh,
  updateObjectMeshTransparency,
  updateObjectMeshSelection,
} from '../src/model/object-mesh.js';
import { updateDisplayDetail } from '../src/model/display-detail.js';
import { InstanceBatches } from '../src/model/instance-batches.js';
import { cachedGeometryIdentity, createSnapGeometryContext } from '../src/model-object.js';

const model = () =>
  JSON.parse(readFileSync(new URL('../examples/forbandstest.lira.json', import.meta.url))).project
    .objects;
const camera = () => new THREE.OrthographicCamera(-50000, 50000, 50000, -50000, 1, 1e6);
const dispose = (objects, batches) => {
  batches?.clear();
  for (const object of objects)
    object.traverse((child) => {
      child.geometry?.dispose();
      child.material?.dispose();
    });
};

test('small sections switch to local envelopes with hysteresis, retaining real picking and snap geometry', () => {
  const sources = model();
  const part = sources.find((s) => s.type === 'sweep');
  const object = createObjectMesh(part, { model: sources, selectedIds: new Set() });
  const proxy = object.userData.overviewMesh;
  assert.ok(proxy);
  assert.equal(proxy.geometry.index.count / 3, 12);
  const view = camera();
  const geometry = object.geometry;
  const context = createSnapGeometryContext(sources);
  const before = context.objectCorners(part);
  updateDisplayDetail([object], view, 600, new Set());
  assert.equal(object.userData.detailVisible, false);
  assert.equal(object.layers.mask, 1 << 3);
  assert.equal(proxy.layers.mask, 1);
  assert.deepEqual(context.objectCorners(part), before);
  assert.equal(context.geometry(part), object.userData.geometryIdentity);
  assert.equal(cachedGeometryIdentity(part), undefined);
  assert.equal(object.geometry, geometry);
  const setPixels = (pixels) => {
    view.zoom = (pixels * (view.top - view.bottom)) / (600 * object.userData.sectionSize);
    updateDisplayDetail([object], view, 600, new Set());
  };
  setPixels(8);
  assert.equal(object.userData.detailVisible, false);
  setPixels(10);
  assert.equal(object.userData.detailVisible, true);
  assert.equal(object.layers.mask, 1);
  setPixels(7);
  assert.equal(object.userData.detailVisible, true);
  setPixels(5);
  assert.equal(object.userData.detailVisible, false);
  updateDisplayDetail([object], view, 600, new Set([part.id]));
  assert.equal(object.userData.detailVisible, true);
  assert.equal(proxy.userData.detailVisible, false);
  assert.equal(proxy.layers.mask, 1 << 2);
  let proxyHits = [];
  proxy.raycast(new THREE.Raycaster(), proxyHits);
  assert.equal(proxyHits.length, 0);
  dispose([object]);
});

test('grouped holes submit no triangles when small and return on zoom or individual selection', () => {
  const sources = model();
  const objects = sources
    .slice(0, 2)
    .map((s) => createObjectMesh(s, { model: sources, selectedIds: new Set() }));
  const batches = new InstanceBatches(new THREE.Scene(), { minimumObjects: 0 });
  batches.rebuild(objects);
  const view = camera();
  updateDisplayDetail(objects, view, 600, new Set());
  batches.sync(view);
  const holes = batches.holes.batch;
  assert.equal(holes.mesh.visible, false);
  assert.equal(holes.mesh.geometry.drawRange.count, 0);
  const geometry = holes.mesh.geometry;
  updateDisplayDetail(objects, view, 600, new Set([sources[0].id]));
  batches.sync(view);
  assert.equal(holes.mesh.visible, true);
  assert.equal(
    holes.mesh.geometry.drawRange.count,
    objects[0].children[1].geometry.attributes.position.count,
  );
  objects[0].visible = false;
  batches.sync(view);
  assert.equal(holes.mesh.visible, false);
  objects[0].visible = true;
  view.zoom = 100;
  updateDisplayDetail(objects, view, 600, new Set());
  batches.sync(view);
  assert.equal(holes.mesh.geometry.drawRange.count, holes.mesh.geometry.index.count);
  assert.equal(holes.mesh.geometry, geometry);
  const diameter = objects[0].userData.holeMesh.userData.detailDiameter;
  const holePixels = (pixels) => {
    view.zoom = (pixels * (view.top - view.bottom)) / (600 * diameter);
    updateDisplayDetail(objects, view, 600, new Set());
    batches.sync(view);
  };
  holePixels(1);
  assert.equal(objects[0].userData.holeMesh.userData.detailVisible, false);
  holePixels(2);
  assert.equal(objects[0].userData.holeMesh.userData.detailVisible, false);
  holePixels(3);
  assert.equal(objects[0].userData.holeMesh.userData.detailVisible, true);
  holePixels(1);
  const changed = sources.map((source) =>
    source.holes
      ? {
          ...source,
          holes: source.holes.map((hole) =>
            hole.targetId === sources[0].id ? { ...hole, diameter: 24 } : hole,
          ),
        }
      : source,
  );
  const original = objects[0];
  batches.prepareRebuild();
  objects[0] = createObjectMesh(sources[0], { model: changed, selectedIds: new Set() });
  batches.update(objects);
  updateDisplayDetail(objects, view, 600, new Set());
  batches.sync(view);
  assert.equal(
    objects[0].userData.holeMesh.userData.detailVisible,
    false,
    'same array and camera still refresh after a model edit',
  );
  assert.equal(holes.mesh.visible, false);
  dispose([...objects, original], batches);
});

test('batched envelopes inherit selection, transparency and owner visibility without double drawing', () => {
  const sources = model();
  const source = sources.find((s) => s.type === 'sweep');
  const copy = {
    ...source,
    id: 'copy',
    start: source.start.map((n, i) => n + (i === 0 ? 1000 : 0)),
    end: source.end.map((n, i) => n + (i === 0 ? 1000 : 0)),
  };
  const objects = [source, copy].map((s) =>
    createObjectMesh(s, { model: [source, copy], selectedIds: new Set() }),
  );
  const batches = new InstanceBatches(new THREE.Scene(), { minimumObjects: 0 });
  batches.rebuild(objects);
  const view = camera();
  updateDisplayDetail(objects, view, 600, new Set());
  batches.sync(view);
  const detailed = batches.batches.find((batch) => !batch.entries[0].object.userData.overviewProxy);
  const coarse = batches.batches.find((batch) => batch.entries[0].object.userData.overviewProxy);
  assert.equal(detailed.mesh.count, 0);
  assert.equal(coarse.mesh.count, 2);
  assert.equal(objects[0].userData.overviewMesh.layers.mask, 1 << 3);
  objects[0].visible = false;
  batches.sync();
  assert.equal(coarse.mesh.count, 1);
  objects[0].visible = true;
  updateObjectMeshSelection(objects[0], source, new Set([source.id]));
  updateDisplayDetail(objects, view, 600, new Set([source.id]));
  batches.sync();
  assert.equal(detailed.mesh.count, 1);
  assert.equal(coarse.mesh.count, 1);
  for (const object of objects) updateObjectMeshTransparency(object, true);
  batches.setTransparentView(true);
  assert.equal(coarse.mesh.material.opacity, 0.3);
  assert.equal(objects[1].userData.overviewMesh.material.depthWrite, false);
  dispose(objects, batches);
});

test('ordinary cuts retain detailed geometry at any zoom; previews retain full detail', () => {
  const sources = model();
  const source = sources.find((s) => s.type === 'sweep');
  const cut = {
    ...sources.find((s) => s.type === 'plate'),
    id: 'cut',
    type: 'polygoncut',
    targets: [source.id],
  };
  const object = createObjectMesh(source, { model: [source, cut], selectedIds: new Set() });
  assert.ok(!object.userData.overviewMesh);
  const ghost = createObjectMesh(source, { model: [source], selectedIds: new Set(), ghost: true });
  updateDisplayDetail([ghost], camera(), 600, new Set());
  assert.ok(!ghost.userData.overviewMesh);
  assert.equal(ghost.layers.mask, 1);
  dispose([object, ghost]);
});
