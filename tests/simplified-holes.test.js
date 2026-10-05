import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { createObjectMesh, updateObjectMeshTransparency } from '../src/model/object-mesh.js';
import {
  cachedGeometryIdentity,
  displayGeometry,
  geometryForModel,
  createSnapGeometryContext,
} from '../src/model-object.js';
import { holesForPart } from '../src/fasteners/relations.js';
import { simplifiedHoleGeometry } from '../src/fasteners/display.js';
import { resolveSnap } from '../src/snap.js';
import { SnapIndex } from '../src/model/snap-index.js';
import { createFrameExample } from '../src/project/frame-example.js';
import { PartSections } from '../src/part-sections.js';
import { partMatrix } from '../src/part-marks.js';
import { partHoleSchedule } from '../src/fasteners/drawing.js';

const joint = () =>
  JSON.parse(readFileSync(new URL('../examples/forbandstest.lira.json', import.meta.url))).project
    .objects;
const dispose = (mesh) =>
  mesh.traverse((child) => {
    child.geometry?.dispose();
    child.material?.dispose();
  });

test('model meshes, selection and snap do not evaluate exact bores; drawing geometry remains drilled', () => {
  const model = joint();
  for (const part of model.slice(0, 2)) {
    const mesh = createObjectMesh(part, { model, selectedIds: new Set() });
    const context = createSnapGeometryContext(model);
    context.objectCorners(part);
    context.objectSegments(part);
    assert.equal(cachedGeometryIdentity(part), undefined, 'exact CSG stays lazy');
    assert.equal(context.holeCenters(part).length, 1);
    assert.ok(mesh.children[1].userData.holeMarker);
    const exact = geometryForModel(part, model);
    assert.ok(exact.attributes.position.count > mesh.geometry.attributes.position.count * 5);
    assert.equal(
      context.geometry(part),
      mesh.userData.geometryIdentity,
      'exact requests leave display cache intact',
    );
    const changed = model.map((o) => (o.holes ? { ...o, holes: [] } : o));
    const plain = displayGeometry(part, changed);
    assert.deepEqual(plain.attributes.position.array, mesh.geometry.attributes.position.array);
    const removed = createObjectMesh(part, { model: changed, selectedIds: new Set() });
    assert.equal(removed.children.filter((child) => child.userData.holeMarker).length, 0);
    updateObjectMeshTransparency(mesh, true);
    assert.equal(mesh.children[1].material.depthWrite, false);
    updateObjectMeshTransparency(mesh, false);
    assert.equal(mesh.children[1].material.opacity, 1);
    exact.dispose();
    plain.dispose();
    dispose(mesh);
    dispose(removed);
  }
});

test('simple bore solids are finite and stay within both I-profile flanges, leaving the cavity open', () => {
  const model = joint(),
    part = model[1];
  const g = simplifiedHoleGeometry(part, model, holesForPart(part, model));
  const p = g.attributes.position;
  assert.equal(p.count, 24 * 12 * 2);
  for (let i = 0; i < p.count; i += 3) {
    const z = (p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2)) / 3;
    assert.ok((z >= 3350 && z <= 3362) || (z >= 3638 && z <= 3650));
  }
  assert.ok([...p.array].every(Number.isFinite));
  g.dispose();
});

test('bore centre outranks screw endpoints and survives diameter edits with no rim snaps', () => {
  const model = joint(),
    part = model[0],
    hole = holesForPart(part, model)[0];
  const [x, y, z] = hole.frame.origin;
  const camera = new THREE.OrthographicCamera(-50, 50, 50, -50, 1, 1000);
  camera.position.set(x, y, z + 100);
  camera.lookAt(x, y, z);
  camera.updateMatrixWorld();
  const snap = (objects, pointer) => {
    const index = new SnapIndex(objects);
    return resolveSnap({
      pointer,
      camera,
      width: 1000,
      height: 1000,
      ray: new THREE.Ray(new THREE.Vector3(x, y, z + 100), new THREE.Vector3(0, 0, -1)),
      z,
      model: objects,
      sweeps: index.query(camera, 1000, 1000, pointer),
      geometryContext: index.nearbyContext(camera, 1000, 1000, pointer, null, true, false),
      grid: { x: [], y: [] },
      midpointSnap: true,
      axisSnap: false,
    });
  };
  const first = snap(model, [500, 500]);
  assert.equal(first.label, 'Hålcentrum');
  assert.equal(first.featureId, hole.id);
  assert.deepEqual(first.point, hole.frame.origin);
  const changed = model.map((o) =>
    o.holes ? { ...o, holes: o.holes.map((h) => ({ ...h, diameter: 30 })) } : o,
  );
  assert.deepEqual(snap(changed, [500, 500]), first);
  assert.equal(snap(model, [610, 500]).kind, 'free', 'no snap to the old bore rim');
});

test('preparing example display templates does not eagerly calculate drilled geometry', () => {
  const model = createFrameExample('small', { prepareGeometry: true }).objects;
  for (const part of model.filter((o) => o.type !== 'fastener'))
    assert.equal(cachedGeometryIdentity(part), undefined);
});

test('Single Part draws exact bores but exposes only their centres as snap references', () => {
  const model = joint(),
    part = model[0],
    matrix = partMatrix(part);
  const config = {
    sectionOrientation: 'source-up',
    views: [{ id: 'top', standard: true, projection: 'top' }],
  };
  const editor = {
    geometry: geometryForModel(part, model).applyMatrix4(matrix),
    snapGeometry: displayGeometry(part, model).applyMatrix4(matrix),
    config,
    record: { sheet: config },
    annotationCandidates: {},
    holeSchedule: partHoleSchedule(part, model, matrix),
  };
  const sections = Object.create(PartSections.prototype);
  sections.e = editor;
  sections.cache = new Map();
  sections.build();
  const candidates = editor.annotationCandidates.top;
  assert.equal(candidates.filter((p) => p.reference.kind === 'bore').length, 1);
  const [x, y] = editor.holeSchedule[0].center;
  assert.ok(candidates.filter((p) => p.reference.kind === 'corner').length > 0);
  for (const p of candidates.filter((p) => p.reference.kind === 'corner'))
    assert.ok(Math.hypot(p[0] - x, p[1] - y) > 12, 'no bore contour snap points');
  assert.ok(sections.cache.get('top').vectors[0].visible.length > 4, 'hole contour is still drawn');
  editor.geometry.dispose();
  editor.snapGeometry.dispose();
});
