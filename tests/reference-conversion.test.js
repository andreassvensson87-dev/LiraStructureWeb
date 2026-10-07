import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { IFCBEAM, IFCPLATE, IfcAPI } from 'web-ifc';
import { readFileSync } from 'node:fs';
import { sweepGeometry, validateSweep } from '../src/sweep.js';
import { plateGeometry } from '../src/plate.js';
import {
  conversionObjects,
  convertReferencePart,
  planReferenceConversion,
} from '../src/references/conversion.js';
import { ifcPlacement } from '../src/references/ifc-coordinates.js';
import { createProject } from '../src/project/project-state.js';
import { ProjectHistory } from '../src/project/project-history.js';
import { serializeProject, parseProjectFile } from '../src/project/project-file.js';
import { numberParts } from '../src/part-marks.js';
const model = { title: 'Test', fileName: 'test.ifc' };
const beam = {
  type: 'sweep',
  profile: 'i',
  width: 200,
  height: 300,
  thickness: 20,
  rotation: 31,
  start: [1000, 2000, 3000],
  end: [2500, 3500, 6000],
};
function part(geometry, type = IFCBEAM) {
  const mesh = new THREE.Mesh(geometry);
  mesh.userData = { ifcId: 20, ifcType: type, globalId: 'source-guid', name: 'Balk' };
  return { mesh };
}
function bounds(geometry) {
  geometry.computeBoundingBox();
  return [...geometry.boundingBox.min.toArray(), ...geometry.boundingBox.max.toArray()];
}
function nearBounds(a, b) {
  a.forEach((v, i) => assert.ok(Math.abs(v - b[i]) < 0.03, `${v} != ${b[i]}`));
}
test('inclined rotated IFC I profiles become editable sweeps with matching geometry', () => {
  const source = part(sweepGeometry(beam)),
    object = convertReferencePart(source, model, 'sweep');
  assert.equal(validateSweep(object), '');
  assert.equal(object.profile, 'custom');
  nearBounds(bounds(source.mesh.geometry), bounds(sweepGeometry(object)));
  assert.equal(object.ifcSource.globalId, 'source-guid');
  assert.equal(object.material, undefined);
});
test('constant hollow profiles retain their holes', () => {
  const source = part(sweepGeometry({ ...beam, profile: 'rhs' }));
  const object = convertReferencePart(source, model, 'sweep');
  assert.equal(object.section.loops.length, 2);
  nearBounds(bounds(source.mesh.geometry), bounds(sweepGeometry(object)));
});
test('inclined plates retain their outline, thickness and placement', () => {
  const source = part(
    plateGeometry({
      type: 'plate',
      frame: { origin: [1000, 2000, 3000], u: [Math.SQRT1_2, Math.SQRT1_2, 0], v: [0, 0, 1] },
      polygon: [
        [0, 0],
        [600, 0],
        [600, 700],
        [250, 500],
        [0, 700],
      ],
      thickness: 12,
      side: 'positive',
    }),
    IFCPLATE,
  );
  const object = convertReferencePart(source, model, 'plate');
  assert.ok(Math.abs(object.thickness - 12) < 0.02);
  nearBounds(bounds(source.mesh.geometry), bounds(plateGeometry(object)));
});
test('unsupported, open and multiple solids are reported without approximation or mutation', () => {
  const source = part(new THREE.SphereGeometry(100, 12, 8));
  const rows = planReferenceConversion({ ...model, parts: [source] }, []);
  assert.equal(rows[0].object, null);
  assert.match(rows[0].reason, /extrusion/);
  const open = part(new THREE.PlaneGeometry(100, 100));
  assert.match(planReferenceConversion({ ...model, parts: [open] }, [])[0].reason, /sluten/);
  assert.match(
    planReferenceConversion({ ...model, parts: [source, source] }, [])[0].reason,
    /flera/,
  );
});
test('real IFC millimetres and local placement survive conversion', async () => {
  const api = new IfcAPI();
  await api.Init();
  const id = api.OpenModel(readFileSync(new URL('./fixtures/reference-box.ifc', import.meta.url)), {
    COORDINATE_TO_ORIGIN: false,
  });
  try {
    api.StreamAllMeshes(id, (flat) => {
      const p = flat.geometries.get(0),
        raw = api.GetGeometry(id, p.geometryExpressID),
        vertices = api.GetVertexArray(raw.GetVertexData(), raw.GetVertexDataSize()),
        positions = [];
      for (let i = 0; i < vertices.length; i += 6) positions.push(...vertices.slice(i, i + 3));
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geometry.setIndex(Array.from(api.GetIndexArray(raw.GetIndexData(), raw.GetIndexDataSize())));
      geometry.applyMatrix4(ifcPlacement(p.flatTransformation));
      const object = convertReferencePart(part(geometry), model, 'sweep');
      nearBounds(bounds(sweepGeometry(object)), [900, 1800, 3000, 1100, 2200, 3600]);
      raw.delete();
    });
  } finally {
    api.CloseModel(id);
  }
});
test('conversion allocates unique identities, prevents duplicates, numbers, undoes and reloads', () => {
  const state = createProject({
      grid: { x: [0, 1000], y: [0, 1000] },
      levels: { active: 'l', items: [{ id: 'l', name: 'Plan 1', elevation: 0 }] },
    }),
    rows = planReferenceConversion({ ...model, parts: [part(sweepGeometry(beam))] }, []);
  const before = structuredClone(state),
    history = new ProjectHistory();
  history.prime(state);
  const added = conversionObjects(rows, state.objects, () => 'converted-1');
  assert.equal(added[0].number, 1);
  const other = conversionObjects(
    rows,
    [{ id: 'other', prefix: 'B', number: 1 }],
    () => 'converted-2',
  );
  assert.equal(other[0].number, 2);
  assert.deepEqual(state, before);
  history.checkpoint(state);
  state.objects.push(...added);
  assert.throws(() => conversionObjects(rows, state.objects), /redan/);
  assert.match(
    planReferenceConversion({ ...model, parts: [part(sweepGeometry(beam))] }, state.objects)[0]
      .reason,
    /Redan/,
  );
  assert.deepEqual(parseProjectFile(serializeProject(state)).objects, state.objects);
  assert.ok(numberParts(state.objects, state.parts).assignments['converted-1']);
  assert.deepEqual(history.undo(state), before);
});

test('conversion preview includes only the picked IFC object, including all its geometry parts', () => {
  const first = part(sweepGeometry(beam)),
    other = part(sweepGeometry(beam));
  other.mesh.userData = {
    ...other.mesh.userData,
    ifcId: 21,
    globalId: 'other-guid',
    name: 'Other',
  };
  const source = { ...model, parts: [first, other] };
  const rows = planReferenceConversion(source, [], [20]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, 20);
  assert.ok(rows[0].object);
  assert.deepEqual(planReferenceConversion(source, [], []), []);
  const multipart = planReferenceConversion({ ...source, parts: [first, first, other] }, [], [20]);
  assert.equal(multipart.length, 1);
  assert.match(multipart[0].reason, /flera/);
  assert.equal(conversionObjects(rows, [], () => 'only-picked').length, 1);
});

test('all HEA sizes are recognized from inclined rotated IFC contours without assigning material', async () => {
  const { TIBNOR_PROFILES } = await import('../src/tibnor-catalog.js');
  const { profileSnapshot } = await import('../src/section-profile.js');
  for (const definition of TIBNOR_PROFILES.filter((p) => p.family === 'HEA')) {
    const section = profileSnapshot(definition),
      input = {
        ...beam,
        profile: 'custom',
        section,
        width: section.properties.bounds.width,
        height: section.properties.bounds.height,
      };
    const source = part(sweepGeometry(input)),
      converted = convertReferencePart(source, model, 'sweep');
    assert.equal(converted.section.id, section.id, definition.name);
    assert.equal(converted.section.name, definition.name);
    assert.equal(converted.material, undefined);
    nearBounds(bounds(source.mesh.geometry), bounds(sweepGeometry(converted)));
  }
});

test('a HEA label or matching outside dimensions cannot replace a different contour', async () => {
  const { TIBNOR_PROFILES } = await import('../src/tibnor-catalog.js');
  const { profileSnapshot } = await import('../src/section-profile.js');
  const section = profileSnapshot(TIBNOR_PROFILES.find((p) => p.name === 'HEA 200'));
  const source = part(
    sweepGeometry({
      ...beam,
      profile: 'i',
      width: section.properties.bounds.width,
      height: section.properties.bounds.height,
      thickness: 15,
    }),
  );
  source.mesh.userData.name = 'HEA 200';
  const object = convertReferencePart(source, model, 'sweep');
  assert.notEqual(object.section.id, section.id);
  nearBounds(bounds(source.mesh.geometry), bounds(sweepGeometry(object)));
});
