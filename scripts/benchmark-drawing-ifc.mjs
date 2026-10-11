// Run with: node scripts/benchmark-drawing-ifc.mjs /absolute/path/model.ifc
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { IfcAPI } from 'web-ifc';
import * as THREE from 'three';
import { snapFrame } from '../src/frame-model.js';
import { nearbySnapEntities } from '../src/drawing-snap-geometry.js';
import { ifcPlacement } from '../src/references/ifc-coordinates.js';
import {
  drawingReferenceGeometry,
  drawingReferenceSnapIndex,
} from '../src/references/drawing-reference-geometry.js';
import {
  drawingProjectionData,
  calculateDrawingProjection,
} from '../src/drawing-projection-data.js';

// Hash incrementally so verification does not allocate one model-sized JSON string.
function projectionHash(projected) {
  const hash = createHash('sha256');
  for (const face of projected.faces) hash.update(JSON.stringify(face));
  for (const edge of projected.edges) hash.update(JSON.stringify(edge));
  return hash.digest('hex');
}

import {
  packDrawingProjection,
  unpackDrawingProjection,
  drawingProjectionBuffers,
} from '../src/drawing-projection-result.js';

const file = process.argv[2];
if (!file) throw Error('Ange en IFC-fil som argument.');
const copies = Number(process.argv[3] || 1);
if (!Number.isInteger(copies) || copies < 1 || copies > 16)
  throw Error('Antal testkopior måste vara 1–16.');
const memory = () => {
  globalThis.gc?.();
  globalThis.gc?.();
  return process.memoryUsage();
};
const bytes = await readFile(file);
const api = new IfcAPI();
await api.Init();
const start = performance.now();
const id = api.OpenModel(bytes, { COORDINATE_TO_ORIGIN: false, CIRCLE_SEGMENTS: 32 });
if (id < 0) throw Error('IFC-filen kunde inte öppnas.');
const parts = [],
  bounds = new THREE.Box3();
let triangles = 0;
try {
  api.StreamAllMeshes(id, (mesh) => {
    for (let j = 0; j < mesh.geometries.size(); j++) {
      const part = mesh.geometries.get(j),
        raw = api.GetGeometry(id, part.geometryExpressID);
      const vertices = api.GetVertexArray(raw.GetVertexData(), raw.GetVertexDataSize());
      const positions = new Float32Array(vertices.length / 2);
      for (let k = 0; k < vertices.length / 6; k++)
        positions.set(vertices.subarray(k * 6, k * 6 + 3), k * 3);
      const indices = api.GetIndexArray(raw.GetIndexData(), raw.GetIndexDataSize()).slice();
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setIndex(new THREE.BufferAttribute(indices, 1));
      geometry.applyMatrix4(ifcPlacement(part.flatTransformation));
      geometry.computeVertexNormals();
      const edgeGeometry = new THREE.EdgesGeometry(geometry, 20);
      const loaded = new THREE.Mesh(geometry);
      parts.push({ mesh: loaded, edges: edgeGeometry.attributes.position.array.slice() });
      geometry.computeBoundingBox();
      bounds.union(geometry.boundingBox);
      triangles += indices.length / 3;
      edgeGeometry.dispose();
      raw.delete();
    }
  });
} finally {
  api.CloseModel(id);
}
const importMs = performance.now() - start;
const sourceParts = [...parts],
  sourceBounds = bounds.clone();
const spacing = sourceBounds.max.x - sourceBounds.min.x;
for (let copy = 1; copy < copies; copy++) {
  const offset = copy * spacing * 1.2;
  for (const part of sourceParts) {
    const mesh = part.mesh.clone();
    mesh.position.x += offset;
    parts.push({ ...part, mesh });
  }
  bounds.union(sourceBounds.clone().translate(new THREE.Vector3(offset, 0, 0)));
}
triangles *= copies;
const importedMemory = memory();
const center = bounds.getCenter(new THREE.Vector3());
const size = bounds.getSize(new THREE.Vector3());
const results = [];
function measureView(section) {
  const matrix = section
    ? new THREE.Matrix4().set(1, 0, 0, 0, 0, 0, 1, 0, 0, -1, 0, center.y, 0, 0, 0, 1)
    : new THREE.Matrix4();
  const heights = section
    ? { lower: -size.y / 2, cut: 0, upper: 0 }
    : { lower: bounds.min.z, cut: bounds.min.z + size.z * 0.4, upper: bounds.max.z };
  const prepareStart = performance.now();
  const selected = drawingReferenceGeometry(
    [{ id: 'benchmark', format: 'IFC', parts }],
    { ifcReferences: { benchmark: { visible: true, snap: true } } },
    { matrix, heights },
  );
  const planes = [
    new THREE.Plane(new THREE.Vector3(0, 0, 1), -heights.lower),
    new THREE.Plane(new THREE.Vector3(0, 0, -1), heights.cut),
  ];
  const surfaces = selected.map((p) => ({ geometry: p.geometry, planes }));
  const edges = selected.flatMap((p) => [
    { geometry: p.edges, planes, referenceId: 'benchmark', referenceSnap: true },
    {
      geometry: new THREE.BufferGeometry().setFromPoints(
        p.cut.flatMap((pair) => pair.map((p) => new THREE.Vector3(p[0], p[1], heights.cut))),
      ),
      overlay: true,
      referenceId: 'benchmark',
      referenceSnap: true,
    },
  ]);
  const preparationMs = performance.now() - prepareStart;
  const transferStart = performance.now();
  const payload = drawingProjectionData(surfaces, edges);
  const transferMs = performance.now() - transferStart;
  const projectionStart = performance.now();
  const projected = calculateDrawingProjection(payload.data);
  const projectionMs = performance.now() - projectionStart;
  const snapStart = performance.now();
  const query = drawingReferenceSnapIndex(projected.edges);
  const indexMs = performance.now() - snapStart;
  const timings = [];
  let candidates = 0;
  for (let i = 0; i < 1000; i++) {
    const point = [
      bounds.min.x + size.x * (((i * 97) % 1000) / 999),
      section
        ? bounds.min.z + size.z * (((i * 71) % 1000) / 999)
        : bounds.min.y + size.y * (((i * 71) % 1000) / 999),
    ];
    const before = performance.now();
    candidates += query(point, 50).length;
    timings.push(performance.now() - before);
  }
  timings.sort((a, b) => a - b);
  const crossingTimes = [],
    localTimes = [];
  let maxLocalSegments = 0;
  const visible = projected.edges.flatMap((set) => set.visible);
  for (let i = 0; i < 100; i++) {
    const point =
      i < 50 && visible.length
        ? visible[Math.floor((i * visible.length) / 50)][0].slice(0, 2)
        : [
            bounds.min.x + size.x * (((i * 97) % 100) / 99),
            section
              ? bounds.min.z + size.z * (((i * 71) % 100) / 99)
              : bounds.min.y + size.y * (((i * 71) % 100) / 99),
          ];
    const before = performance.now();
    const entities = nearbySnapEntities(
      query(point, 667).map((points) => ({ type: 'line', points })),
      point,
      667,
    );
    localTimes.push(performance.now() - before);
    maxLocalSegments = Math.max(maxLocalSegments, entities.length);
    const crossingStart = performance.now();
    snapFrame(point, {
      entities,
      tolerance: 667,
      endpoints: false,
      midpoints: false,
      perpendicular: false,
    });
    crossingTimes.push(performance.now() - crossingStart);
  }
  crossingTimes.sort((a, b) => a - b);
  localTimes.sort((a, b) => a - b);
  const metrics = {
    view: section ? 'section' : 'plan',
    selectedParts: selected.length,
    preparationMs,
    transferMs,
    transferBytes: payload.buffers.reduce((n, b) => n + b.byteLength, 0),
    projectionMs,
    projectionHash: projectionHash(projected),
    faces: projected.faces.length,
    visibleSegments: projected.edges.reduce((n, e) => n + e.visible.length, 0),
    hiddenSegments: projected.edges.reduce((n, e) => n + e.hidden.length, 0),
    indexMs,
    queryP95Ms: timings[949],
    queryMaxMs: timings.at(-1),
    averageCandidates: candidates / 1000,
    crossingSamples: crossingTimes.length,
    crossingTolerance: 667,
    maxLocalSegments,
    projectedMemory: memory(),
    localSearchP95Ms: localTimes[94],
    crossingP95Ms: crossingTimes[94],
    crossingMaxMs: crossingTimes.at(-1),
  };
  selected.forEach((p) => {
    p.geometry.dispose();
    p.edges.dispose();
  });
  edges.filter((e) => e.overlay).forEach((e) => e.geometry.dispose());
  return { metrics, projected };
}
let retainedResults = [false, true].map(measureView);
results.push(...retainedResults.map((m) => m.metrics));
retainedResults = retainedResults.map((m) => m.projected);
const legacyCachedMemory = memory();
let packedResults = retainedResults.map(packDrawingProjection);
const packedBytes = packedResults.reduce(
  (n, r) => n + drawingProjectionBuffers(r).reduce((sum, b) => sum + b.byteLength, 0),
  0,
);
retainedResults = null;
const packedCachedMemory = memory();
function switchViews(packed) {
  let active = null;
  const samples = [];
  for (let i = 0; i < 6; i++) {
    active = unpackDrawingProjection(packed[i % packed.length]);
    samples.push(memory());
  }
  return { samples, hash: projectionHash(active) };
}
const { samples: viewSwitchMemory, hash: activeProjectionHash } = switchViews(packedResults);
packedResults = null;
const releasedMemory = memory();
console.log(
  JSON.stringify(
    {
      bytes: bytes.length,
      copies,
      importedMemory,
      cacheMemory: {
        legacyCachedMemory,
        packedCachedMemory,
        packedBytes,
        viewSwitchMemory,
        activeProjectionHash,
        releasedMemory,
      },
      parts: parts.length,
      triangles,
      importMs,
      bounds: [bounds.min.toArray(), bounds.max.toArray()],
      results,
    },
    null,
    2,
  ),
);
parts.forEach((p) => p.mesh.geometry.dispose());
