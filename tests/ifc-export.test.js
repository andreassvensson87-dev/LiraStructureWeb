import test from 'node:test';
import assert from 'node:assert/strict';
import {
  IfcAPI,
  IFCRELAGGREGATES,
  IFCRELDEFINESBYPROPERTIES,
  IFCRELASSOCIATESMATERIAL,
  IFCBUILDINGELEMENTPROXY,
  IFCMECHANICALFASTENER,
  IFCBEAM,
  IFCREPRESENTATIONMAP,
  IFCPRODUCT,
  IFCPRODUCTDEFINITIONSHAPE,
  IFCCOLUMN,
  IFCPLATE,
} from 'web-ifc';
import * as THREE from 'three';
import { ifcExportFixture } from './helpers/ifc-export-fixture.js';
import { exportIFC } from '../src/ifc/export.js';
import { defaultIFCOptions, prepareIFCExport } from '../src/ifc/export-plan.js';
import { objectGeometry, isPhysical, validateObject } from '../src/model-object.js';
import { ifcPlacement } from '../src/references/ifc-coordinates.js';
import { readIFCGeoreferencing } from '../src/coordinates/ifc-georeferencing.js';
import { referenceLocalPoint } from '../src/coordinates/reference-frame.js';
import { localToMap, mapToLocal, activeBasePoint } from '../src/coordinates/coordinates.js';
import { objectColor } from '../src/materials.js';
import { ProjectHistory } from '../src/project/project-history.js';
import { serializeProject, parseProjectFile } from '../src/project/project-file.js';
import { readFileSync } from 'node:fs';
import { meshVolume } from '../src/model/object-quantities.js';
import { createModelEditor } from '../src/app/model-editor.js';
import { applyObjectDraft } from '../src/model/object-draft.js';
import { createFrameExample } from '../src/project/frame-example.js';
const near = (a, b, e = 0.05) =>
  a.forEach((v, i) => assert.ok(Math.abs(v - b[i]) < e, `${a} != ${b}`));
async function read(file, run) {
  const api = new IfcAPI();
  await api.Init();
  const model = api.OpenModel(file, { COORDINATE_TO_ORIGIN: false, CIRCLE_SEGMENTS: 96 });
  try {
    return await run(api, model);
  } finally {
    api.CloseModel(model);
  }
}
function geometryBounds(api, model) {
  const result = new Map();
  api.StreamAllMeshes(model, (mesh) => {
    const entity = api.GetLine(model, mesh.expressID),
      box = new THREE.Box3();
    for (let i = 0; i < mesh.geometries.size(); i++) {
      const part = mesh.geometries.get(i),
        raw = api.GetGeometry(model, part.geometryExpressID),
        vertices = api.GetVertexArray(raw.GetVertexData(), raw.GetVertexDataSize());
      const matrix = ifcPlacement(part.flatTransformation);
      for (let j = 0; j < vertices.length; j += 6)
        box.expandByPoint(
          new THREE.Vector3(vertices[j], vertices[j + 1], vertices[j + 2]).applyMatrix4(matrix),
        );
      raw.delete();
    }
    result.set(entity.Name.value, { box, id: entity.GlobalId.value, tag: entity.Tag?.value });
  });
  return result;
}
test('IFC4 export preserves final geometry, class, marks, assembly membership and materials without editing the project', async () => {
  const project = ifcExportFixture(),
    before = structuredClone(project),
    options = { ...defaultIFCOptions(), fasteners: true };
  const { file, report } = await exportIFC(project, options);
  assert.ok(file);
  assert.equal(report.parts, 7);
  assert.ok(report.extrusions >= 1);
  assert.ok(report.meshes >= 1);
  assert.deepEqual(project, before);
  await read(file, (api, model) => {
    assert.equal(api.GetModelSchema(model), 'IFC4');
    assert.equal(api.GetLineIDsWithType(model, IFCBEAM).size(), 1);
    assert.equal(api.GetLineIDsWithType(model, IFCCOLUMN).size(), 1);
    assert.equal(api.GetLineIDsWithType(model, IFCPLATE).size(), 1);
    assert.equal(api.GetLineIDsWithType(model, IFCMECHANICALFASTENER).size(), 1);
    assert.equal(api.GetLineIDsWithType(model, IFCBUILDINGELEMENTPROXY).size(), 2);
    assert.equal(api.GetLineIDsWithType(model, IFCREPRESENTATIONMAP).size(), 1);
    const products = api.GetLineIDsWithType(model, IFCPRODUCT, true),
      owners = new Set();
    for (let i = 0; i < products.size(); i++) {
      const value = api.GetLine(model, products.get(i));
      if (value.Representation) owners.add(value.Representation.value);
    }
    const definitions = api.GetLineIDsWithType(model, IFCPRODUCTDEFINITIONSHAPE);
    for (let i = 0; i < definitions.size(); i++)
      assert.ok(
        owners.has(definitions.get(i)),
        'no orphan product shape alongside a mapped source',
      );

    const bounds = geometryBounds(api, model);
    assert.equal(bounds.size, 7);
    api.StreamAllMeshes(model, (mesh) => {
      const name = api.GetLine(model, mesh.expressID).Name.value,
        source = project.objects.find((o) => o.name === name);
      const color = mesh.geometries.get(0).color;
      near([color.x, color.y, color.z], new THREE.Color(objectColor(source)).toArray(), 1e-8);
    });
    for (const object of project.objects.filter(isPhysical)) {
      const actual = bounds.get(object.name);
      assert.ok(actual, object.name);
      const expected = objectGeometry(object, project.objects, 'exact');
      expected.computeBoundingBox();
      near(actual.box.min.toArray(), expected.boundingBox.min.toArray(), 1);
      near(actual.box.max.toArray(), expected.boundingBox.max.toArray(), 1);
      expected.dispose();
      assert.equal(actual.tag, project.parts.assignments[object.id].mark);
    }
    assert.ok(api.GetLineIDsWithType(model, IFCRELAGGREGATES).size() >= 3);
    assert.equal(api.GetLineIDsWithType(model, IFCRELASSOCIATESMATERIAL).size(), 7);
    assert.ok(api.GetLineIDsWithType(model, IFCRELDEFINESBYPROPERTIES).size() >= 7);
    assert.equal(readIFCGeoreferencing(api, model), null);
  });
});
test('IFC georeferencing reuses base-point math, roundtrips local geometry and keeps GlobalIds through edits, reordering and file save', async () => {
  const project = ifcExportFixture(),
    options = { ...defaultIFCOptions(), coordinates: 'map' };
  const first = await exportIFC(project, options);
  let firstIds;
  await read(first.file, (api, model) => {
    const source = readIFCGeoreferencing(api, model),
      base = activeBasePoint(project.coordinates);
    near(source.map, localToMap([0, 0, 0], base), 1e-8);
    assert.equal(source.scale, 1);
    for (const p of [
      [0, 0, 0],
      [1234, -5678, 900],
    ])
      near(referenceLocalPoint(p, 'map', source, project.coordinates), p, 1e-5);
    near(mapToLocal(localToMap([1, 2, 3], base), base), [1, 2, 3], 1e-5);
    firstIds = geometryBounds(api, model);
  });
  const persisted = parseProjectFile(serializeProject(project));
  assert.equal(persisted.id, project.id);
  persisted.objects = persisted.objects
    .reverse()
    .map((o) => (o.id === 'cut-beam' ? { ...o, width: 250 } : o));
  const second = await exportIFC(persisted, options);
  await read(second.file, (api, model) => {
    const next = geometryBounds(api, model);
    for (const [name, row] of firstIds) assert.equal(next.get(name).id, row.id);
    assert.notEqual(next.get('Item Å').id, next.get('Item B').id);
  });
});
test('scope and option controls are explicit, stale numbering is warned, and any invalid object blocks the file', async () => {
  const p = ifcExportFixture();
  const selected = await exportIFC(p, {
    ...defaultIFCOptions(),
    scope: 'selected',
    ids: ['plate'],
    assemblies: false,
    properties: false,
    materials: false,
  });
  const final = await exportIFC(p, {
    ...defaultIFCOptions(),
    scope: 'visible',
    ids: ['round-column'],
    geometry: 'final',
  });
  assert.equal(final.report.parts, 1);
  assert.equal(final.report.extrusions, 0);
  assert.equal(final.report.meshes, 1);
  assert.ok(final.file);
  assert.equal(selected.report.parts, 1);
  assert.equal(selected.report.assemblies, 0);
  assert.ok(selected.file);
  await read(selected.file, (api, m) => {
    assert.equal(api.GetLineIDsWithType(m, IFCRELASSOCIATESMATERIAL).size(), 0);
    assert.equal(api.GetLineIDsWithType(m, IFCRELDEFINESBYPROPERTIES).size(), 0);
    assert.equal(geometryBounds(api, m).size, 1);
  });
  assert.equal(
    (await exportIFC(p, { ...defaultIFCOptions(), scope: 'selected', ids: [] })).file,
    null,
  );
  p.objects = p.objects.map((o) => (o.id === 'cut-beam' ? { ...o, width: 201 } : o));
  const stale = await exportIFC(p, defaultIFCOptions());
  assert.ok(stale.report.issues.some((i) => i.code === 'part-number'));
  assert.ok(stale.file);
  p.objects = p.objects.map((o) => (o.id === 'plate' ? { ...o, thickness: -1 } : o));
  const invalid = await exportIFC(p, defaultIFCOptions());
  assert.equal(invalid.file, null);
  assert.ok(invalid.report.issues.some((i) => i.severity === 'error'));
});
test('shared IFC class drafts validate, commit once and undo while classification does not renumber or move the object', () => {
  const p = ifcExportFixture(),
    history = new ProjectHistory(),
    editor = createModelEditor({ project: p, checkpoint: () => history.checkpoint(p) }),
    source = p.objects.find((o) => o.id === 'round-column');
  const candidate = applyObjectDraft(source, { ifcClass: 'IfcMember' });
  assert.equal(source.ifcClass, 'IfcColumn');
  editor.update([candidate]);
  assert.equal(history.past.length, 1);
  assert.deepEqual(candidate.start, source.start);
  assert.equal(history.undo(p).objects.find((o) => o.id === source.id).ifcClass, 'IfcColumn');
  assert.throws(() => applyObjectDraft(source, { ifcClass: 'MadeUp' }));
  assert.ok(validateObject({ ...source, ifcClass: 'MadeUp' }));
  assert.equal(prepareIFCExport(ifcExportFixture(), defaultIFCOptions()).parts.length, 6);
});

test('export retains linked bores in final part geometry even when fasteners are excluded', async () => {
  const p = ifcExportFixture();
  p.objects = JSON.parse(
    readFileSync(new URL('../examples/forbandstest.lira.json', import.meta.url), 'utf8'),
  ).project.objects;
  p.assemblies = [];
  p.parts = { registry: [], assignments: {} };
  const plan = prepareIFCExport(p, defaultIFCOptions());
  assert.ok(plan.parts.length >= 2);
  assert.ok(plan.parts.every((part) => part.object.type !== 'fastener'));
  for (const part of plan.parts) {
    assert.equal(part.geometry.kind, 'mesh', 'linked bores require evaluated geometry');
    const shape = part.geometry,
      g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(shape.points.flat(), 3));
    g.setIndex(shape.triangles.flat().map((i) => i - 1));
    const actual = meshVolume(g),
      reference = objectGeometry(part.object, p.objects);
    assert.ok(Math.abs(actual / meshVolume(reference) - 1) < 1e-5);
    g.dispose();
    reference.dispose();
  }
  const result = await exportIFC(p, defaultIFCOptions());
  assert.ok(result.file);
  await read(result.file, (api, m) =>
    assert.equal(api.GetLineIDsWithType(m, IFCMECHANICALFASTENER).size(), 0),
  );
});

test('drilled frame beam exports without kernel-scale sliver faces while preserving volume and bounds', async () => {
  const project = createFrameExample('small', { prepareGeometry: false }),
    options = { ...defaultIFCOptions(), scope: 'selected', ids: ['frame-joint-7-beam'] },
    plan = prepareIFCExport(project, options);
  assert.equal(plan.parts.length, 1);
  const { object, geometry: shape } = plan.parts[0],
    native = objectGeometry(object, project.objects, 'exact'),
    exported = new THREE.BufferGeometry(),
    a = new THREE.Vector3(),
    b = new THREE.Vector3(),
    c = new THREE.Vector3();
  exported.setAttribute('position', new THREE.Float32BufferAttribute(shape.points.flat(), 3));
  exported.setIndex(shape.triangles.flat().map((i) => i - 1));
  assert.ok(Math.abs(meshVolume(exported) / meshVolume(native) - 1) < 1e-5);
  for (const triangle of shape.triangles) {
    a.fromArray(shape.points[triangle[0] - 1]);
    b.fromArray(shape.points[triangle[1] - 1]).sub(a);
    c.fromArray(shape.points[triangle[2] - 1]).sub(a);
    const longest = Math.max(b.length(), c.length(), b.distanceTo(c));
    assert.ok(b.cross(c).length() / longest > 0.0001);
  }
  native.computeBoundingBox();
  const expected = native.boundingBox.clone();
  native.dispose();
  exported.dispose();
  const { file } = await exportIFC(project, options);
  assert.ok(file);
  await read(file, (api, model) => {
    const actual = geometryBounds(api, model).get(object.name).box;
    near(actual.min.toArray(), expected.min.toArray(), 0.001);
    near(actual.max.toArray(), expected.max.toArray(), 0.001);
  });
});
