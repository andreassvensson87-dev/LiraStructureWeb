import { updateDisplayDetail } from '../src/model/display-detail.js';
// Shared by the Node benchmark and the browser renderer benchmark.
import * as THREE from 'three';
import { createFrameExample } from '../src/project/frame-example.js';
import { createObjectMesh } from '../src/model/object-mesh.js';
import { InstanceBatches } from '../src/model/instance-batches.js';
import { reconcileChildren } from '../src/model/reconcile-children.js';
import { updateFastenerDetail } from '../src/model/fastener-detail.js';
import { SnapIndex } from '../src/model/snap-index.js';
import { resolveSnap } from '../src/snap.js';
import { applyObjectBatch } from '../src/model/tools/transform-tool.js';
import { holesByTarget } from '../src/fasteners/relations.js';
import {
  displayGeometryIdentityReader,
  createDisplayGeometryContext,
} from '../src/model-object.js';

export const summarize = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  return {
    samples: sorted.length,
    median: sorted[Math.floor(sorted.length / 2)],
    p95: sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)],
    max: sorted.at(-1),
  };
};

export function disposeMesh(mesh) {
  mesh.traverse((child) => {
    child.geometry?.dispose();
    child.material?.dispose();
  });
}

export function buildExample(size) {
  const started = performance.now();
  let model = createFrameExample(size, { prepareGeometry: true }).objects;
  const generated = performance.now();
  const selectedIds = new Set();
  const scene = new THREE.Scene();
  const group = new THREE.Group();
  scene.add(group);
  const buildByTypeMs = {};
  const geometryContext = createDisplayGeometryContext(model);
  let meshes = model.map((s) => {
    const before = performance.now();
    const mesh = createObjectMesh(s, { model, selectedIds, geometryContext });
    buildByTypeMs[s.type] = (buildByTypeMs[s.type] || 0) + performance.now() - before;
    group.add(mesh);
    return mesh;
  });
  const built = performance.now();
  const batches = new InstanceBatches(scene);
  batches.rebuild(meshes);
  const batched = performance.now();
  const bounds = new THREE.Box3().setFromObject(group);
  const center = bounds.getCenter(new THREE.Vector3());
  const height = bounds.getSize(new THREE.Vector3()).length() * 1.35;
  const camera = new THREE.OrthographicCamera(
    -height * 0.75,
    height * 0.75,
    height / 2,
    -height / 2,
    1,
    1e8,
  );
  camera.up.set(0, 0, 1);
  const view = (angle = 0) => {
    camera.position
      .copy(center)
      .add(new THREE.Vector3(Math.cos(angle) * height, -Math.sin(angle) * height, height));
    camera.lookAt(center);
    camera.updateMatrixWorld();
  };
  view(Math.PI / 4);
  const geometryBuffers = new Set();
  let geometryBytes = 0;
  scene.traverse((child) => {
    if (!child.geometry) return;
    for (const attribute of Object.values(child.geometry.attributes)) {
      const buffer = (attribute.array || attribute.data.array).buffer;
      if (!geometryBuffers.has(buffer)) {
        geometryBuffers.add(buffer);
        geometryBytes += buffer.byteLength;
      }
    }
  });
  const load = {
    size,
    objects: model.length,
    screws: model.filter((s) => s.type === 'fastener').length,
    holes: model.reduce((sum, s) => sum + (s.holes?.length || 0), 0),
    markerMeshes: meshes.filter((m) => m.children.some((c) => c.userData.holeMarker)).length,
    bodyBatches: batches.batches.filter(
      (b) =>
        !b.entries[0].object.userData.detailDiameter && !b.entries[0].object.userData.overviewProxy,
    ).length,
    overviewBatches: batches.batches.filter((b) => b.entries[0].object.userData.overviewProxy)
      .length,
    fastenerBatches: batches.batches.filter((b) => b.entries[0].object.userData.detailDiameter)
      .length,
    holeBatches: batches.holes.batch ? 1 : 0,
    generationMs: generated - started,
    meshesMs: built - generated,
    buildByTypeMs,
    batchesMs: batched - built,
    geometryBufferMiB: geometryBytes / 1024 / 1024,
  };
  return {
    load,
    scene,
    group,
    batches,
    camera,
    center,
    height,
    view,
    get model() {
      return model;
    },
    get meshes() {
      return meshes;
    },
    frame(angle) {
      view(angle);
      updateFastenerDetail(meshes, camera, 800, selectedIds);
      updateDisplayDetail(meshes, camera, 800, selectedIds);
      batches.sync(camera);
    },
    editJoint(diameter) {
      const screw = model.find((s) => s.type === 'fastener');
      const started = performance.now();
      const next = applyObjectBatch(model, [
        { ...screw, holes: screw.holes.map((h) => ({ ...h, diameter })) },
      ]).objects;
      const transaction = performance.now();
      batches.prepareRebuild();
      const old = new Map(model.map((s, i) => [s.id, { source: s, mesh: meshes[i] }]));
      const geometry = displayGeometryIdentityReader(next);
      const holes = holesByTarget(next);
      const geometryContext = createDisplayGeometryContext(next);
      let rebuilt = 0;
      const replacements = next.map((s) => {
        const entry = old.get(s.id);
        const linked = holes.get(s.id) || [];
        const previous = entry.mesh.userData.holes || [];
        if (
          entry.source === s &&
          entry.mesh.userData.geometryIdentity === geometry(s) &&
          previous.length === linked.length &&
          previous.every((h, i) => h === linked[i])
        )
          return entry.mesh;
        const mesh = createObjectMesh(s, { model: next, selectedIds, geometryContext });
        disposeMesh(entry.mesh);
        rebuilt++;
        return mesh;
      });
      const replaced = performance.now();
      reconcileChildren(group, replacements);
      batches.update(replacements);
      const done = performance.now();
      model = next;
      meshes = replacements;
      return {
        transactionMs: transaction - started,
        replacementMs: replaced - transaction,
        batchesMs: done - replaced,
        totalMs: done - started,
        rebuilt,
      };
    },
    dispose() {
      batches.clear();
      meshes.forEach(disposeMesh);
      scene.clear();
    },
  };
}

export function measureInteraction(example) {
  const { camera, model } = example;
  const indexStarted = performance.now();
  const index = new SnapIndex(model);
  const indexSetupMs = performance.now() - indexStarted;
  const cameraReindex = [],
    frameUpdate = [],
    stableSnap = [],
    candidateCounts = [];
  const ray = new THREE.Ray(new THREE.Vector3(0, 0, 1e5), new THREE.Vector3(0, 0, -1));
  for (let i = 0; i < 30; i++) {
    let started = performance.now();
    example.frame(Math.PI / 4 + i * 0.003);
    frameUpdate.push(performance.now() - started);
    started = performance.now();
    index.query(camera, 1200, 800, [600, 400]);
    cameraReindex.push(performance.now() - started);
  }
  // Test a close joint as well as the overview; overview alone misses detail snaps.
  const screw = model.find((s) => s.type === 'fastener');
  camera.zoom = example.height / 1200;
  camera.updateProjectionMatrix();
  camera.position.copy(new THREE.Vector3(...screw.start)).add(new THREE.Vector3(1000, -1000, 1000));
  camera.lookAt(new THREE.Vector3(...screw.start));
  camera.updateMatrixWorld();
  const closeIndexStarted = performance.now();
  index.query(camera, 1200, 800, [600, 400]);
  const closeReindexMs = performance.now() - closeIndexStarted;
  for (let i = 0; i < 100; i++) {
    const pointer = [600 + Math.cos(i * 0.17) * 80, 400 + Math.sin(i * 0.17) * 80];
    const started = performance.now();
    const nearby = index.query(camera, 1200, 800, pointer);
    resolveSnap({
      pointer,
      camera,
      width: 1200,
      height: 800,
      ray,
      start: screw.start,
      z: screw.start[2],
      sweeps: nearby,
      model,
      geometryContext: index.nearbyContext(camera, 1200, 800, pointer, screw.start, true, true),
      grid: { x: [], y: [] },
      midpointSnap: true,
      perpendicularSnap: true,
    });
    stableSnap.push(performance.now() - started);
    candidateCounts.push(nearby.length);
  }
  camera.zoom = 1;
  camera.updateProjectionMatrix();
  example.view(Math.PI / 4);
  const edits = Array.from({ length: 5 }, (_, i) => example.editJoint(i % 2 ? 22 : 24));
  return {
    indexSetupMs,
    closeReindexMs,
    cameraReindexMs: summarize(cameraReindex),
    frameUpdateCpuMs: summarize(frameUpdate),
    stableSnapMs: summarize(stableSnap),
    nearbyObjects: summarize(candidateCounts),
    jointEditMs: summarize(edits.map((e) => e.totalMs)),
    jointEditStages: edits,
  };
}
