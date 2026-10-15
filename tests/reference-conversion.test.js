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
    object = convertReferencePart(source, model, 'sweep').object;
  assert.equal(validateSweep(object), '');
  assert.equal(object.profile, 'custom');
  nearBounds(bounds(source.mesh.geometry), bounds(sweepGeometry(object)));
  assert.equal(object.ifcSource.globalId, 'source-guid');
  assert.equal(object.material, undefined);
});
test('constant hollow profiles retain their holes', () => {
  const source = part(sweepGeometry({ ...beam, profile: 'rhs' }));
  const object = convertReferencePart(source, model, 'sweep').object;
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
  const object = convertReferencePart(source, model, 'plate').object;
  assert.ok(Math.abs(object.thickness - 12) < 0.02);
  nearBounds(bounds(source.mesh.geometry), bounds(plateGeometry(object)));
});
test('unsupported, open and multiple solids are reported without approximation or mutation', () => {
  const source = part(new THREE.SphereGeometry(100, 12, 8));
  const rows = planReferenceConversion({ ...model, parts: [source] }, []);
  assert.equal(rows[0].object, null);
  assert.match(rows[0].reason, /tvärsnitt/);
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
      const object = convertReferencePart(part(geometry), model, 'sweep').object;
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
      converted = convertReferencePart(source, model, 'sweep').object;
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
  const object = convertReferencePart(source, model, 'sweep').object;
  assert.notEqual(object.section.id, section.id);
  nearBounds(bounds(source.mesh.geometry), bounds(sweepGeometry(object)));
});

test('library suggestions recognize IPE and hollow profiles; manual replacement preserves source axis and undo', async () => {
  const { TIBNOR_PROFILES } = await import('../src/tibnor-catalog.js');
  const { profileSnapshot } = await import('../src/section-profile.js');
  const { conversionProfile } = await import('../src/references/conversion.js');
  const { createModelEditor } = await import('../src/app/model-editor.js');
  for (const definition of [
    TIBNOR_PROFILES.find((p) => p.name === 'IPE 200'),
    TIBNOR_PROFILES.find((p) => p.name === 'VKR 200x200x8'),
  ]) {
    const section = profileSnapshot(definition);
    const source = part(
      sweepGeometry({
        ...beam,
        profile: 'custom',
        section,
        width: section.properties.bounds.width,
        height: section.properties.bounds.height,
      }),
    );
    const converted = convertReferencePart(source, model, 'sweep', [definition]).object;
    assert.equal(converted.section.id, section.id);
    nearBounds(bounds(source.mesh.geometry), bounds(sweepGeometry(converted)));
    const before = structuredClone(converted);
    const replacement = profileSnapshot(TIBNOR_PROFILES.find((p) => p.name === 'HEA 220'));
    const updated = conversionProfile(converted, replacement);
    assert.deepEqual(updated.start, converted.start);
    assert.deepEqual(updated.end, converted.end);
    assert.equal(updated.rotation, converted.rotation);
    assert.deepEqual(updated.ifcSource, converted.ifcSource);
    assert.equal(updated.section.id, replacement.id);
    assert.equal(updated.width, replacement.properties.bounds.width);
    assert.deepEqual(converted, before, 'profile selection edits only a detached draft');
    const project = createProject({
      grid: { x: [], y: [] },
      levels: { active: 'l', items: [{ id: 'l', name: 'Plan 1', elevation: 0 }] },
    });
    const history = new ProjectHistory();
    const editor = createModelEditor({ project, checkpoint: () => history.checkpoint(project) });
    editor.add(conversionObjects([{ object: updated }], project.objects));
    assert.equal(project.objects.length, 1);
    assert.equal(project.objects[0].section.id, replacement.id);
    assert.equal(history.past.length, 1);
    assert.equal(history.undo(project).objects.length, 0);
    assert.throws(() => conversionProfile({ ...converted, type: 'plate' }, replacement), /Sweep/);
    assert.throws(() => conversionProfile(converted, { ...replacement, loops: [] }));
    source.mesh.geometry.dispose();
  }
});

// Small anonymised meshes retain Revit's Float32 tessellation, with generic placement/identity.
test('real Revit rounded sections and oblique ends preserve surfaces through the ordinary model geometry path', async () => {
  const { MeshBVH } = await import('three-mesh-bvh');
  const { geometryForModel } = await import('../src/model-object.js');
  const { solidMeasures, compareSolids } = await import(
    '../src/references/conversion-verification.js'
  );
  const fixtures = JSON.parse(
    readFileSync(new URL('./fixtures/revit-conversion-meshes.json', import.meta.url)),
  );
  for (const fixture of fixtures) {
    for (const placement of [fixture.origin, [23000, -12000, 6000], [158000, 103000, 140000]]) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(fixture.positions, 3));
      geometry.setIndex(fixture.indices);
      const source = part(geometry);
      source.mesh.position.set(...placement);
      const before = Array.from(geometry.attributes.position.array);
      const draft = convertReferencePart(source, model, 'sweep', []);
      assert.equal(draft.cuts.length, fixture.key === 'oblique-i-end' ? 2 : 0, fixture.key);
      let id = 0;
      const objects = conversionObjects([draft], [], () => `converted-${id++}`);
      const target = geometryForModel(objects[0], objects);
      const original = geometry.clone().applyMatrix4(source.mesh.matrixWorld);
      const sourceMeasures = solidMeasures(original),
        targetMeasures = solidMeasures(target);
      nearBounds(sourceMeasures.bounds, targetMeasures.bounds);
      assert.ok(compareSolids(sourceMeasures, targetMeasures).comparisonPassed);
      // Check both directions: equal volume/bounds alone could conceal a lost opening or wrong shape.
      for (const [from, to] of [
        [original, target],
        [target, original],
      ]) {
        const bvh = new MeshBVH(to, { indirect: true });
        const a = from.attributes.position,
          indices = from.index?.array;
        const count = indices?.length ?? a.count;
        for (let i = 0; i < count; i += 3) {
          const points = [0, 1, 2].map((k) =>
            new THREE.Vector3().fromBufferAttribute(a, indices?.[i + k] ?? i + k),
          );
          points.push(
            points[0]
              .clone()
              .add(points[1])
              .add(points[2])
              .multiplyScalar(1 / 3),
          );
          for (const p of points)
            assert.ok(bvh.closestPointToPoint(p).distance < 0.05, fixture.key);
        }
      }
      assert.deepEqual(Array.from(geometry.attributes.position.array), before);
      assert.equal(draft.object.id, undefined);
      assert.ok(draft.cuts.every((c) => !c.id && c.targets.length === 0));
      original.dispose();
      target.dispose();
      geometry.dispose();
      source.mesh.material.dispose();
    }
  }
});

test('converted end cuts commit atomically with their sweep, survive files, and undo together', async () => {
  const { createModelEditor } = await import('../src/app/model-editor.js');
  const { conversionProfile } = await import('../src/references/conversion.js');
  const fixtures = JSON.parse(
    readFileSync(new URL('./fixtures/revit-conversion-meshes.json', import.meta.url)),
  );
  const fixture = fixtures.find((f) => f.key === 'oblique-i-end');
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(fixture.positions, 3));
  geometry.setIndex(fixture.indices);
  const source = part(geometry);
  source.mesh.position.set(...fixture.origin);
  const rows = planReferenceConversion({ ...model, parts: [source] }, [], null, []);
  assert.ok(rows[0].object, rows[0].reason);
  assert.equal(rows[0].cuts.length, 2);
  const before = structuredClone(rows[0].cuts);
  rows[0].object = conversionProfile(rows[0].object, rows[0].object.section);
  assert.deepEqual(rows[0].cuts, before, 'profile selection keeps recovered cuts');
  const project = createProject({
    grid: { x: [], y: [] },
    levels: { active: 'l', items: [{ id: 'l', name: 'Plan', elevation: 0 }] },
  });
  const history = new ProjectHistory();
  const editor = createModelEditor({ project, checkpoint: () => history.checkpoint(project) });
  let id = 0;
  editor.add(conversionObjects(rows, [], () => `converted-${id++}`));
  assert.equal(project.objects.length, 3);
  assert.equal(history.past.length, 1);
  for (const cut of project.objects.slice(1))
    assert.deepEqual(cut.targets, [project.objects[0].id]);
  assert.deepEqual(parseProjectFile(serializeProject(project)).objects, project.objects);
  const restored = history.undo(project);
  assert.equal(restored.objects.length, 0);
  assert.equal(history.redo(restored).objects.length, 3);
  geometry.dispose();
  source.mesh.material.dispose();
});

test('tapered solids and missing faces cannot be accepted as constant profiles', () => {
  const tapered = part(new THREE.CylinderGeometry(50, 100, 2000, 24));
  const row = planReferenceConversion({ ...model, parts: [tapered] }, [], null, [])[0];
  assert.equal(row.object, null);
  assert.match(row.reason, /tvärsnitt/);
  const fixture = JSON.parse(
    readFileSync(new URL('./fixtures/revit-conversion-meshes.json', import.meta.url)),
  )[0];
  const open = new THREE.BufferGeometry();
  open.setAttribute('position', new THREE.Float32BufferAttribute(fixture.positions, 3));
  open.setIndex(fixture.indices.slice(3));
  const rejected = planReferenceConversion({ ...model, parts: [part(open)] }, [], null, [])[0];
  assert.equal(rejected.object, null);
  assert.match(rejected.reason, /sluten/);
  open.dispose();
  tapered.mesh.geometry.dispose();
  tapered.mesh.material.dispose();
});

test('converted cuts follow ordinary move, copy and rotate, including copied target identities', async () => {
  const { modelTransformSources } = await import('../src/model/tools/transform-sources.js');
  const { applyObjectBatch, transformCandidates, rotationCandidates } = await import(
    '../src/model/tools/transform-tool.js'
  );
  const { geometryForModel } = await import('../src/model-object.js');
  const fixture = JSON.parse(
    readFileSync(new URL('./fixtures/revit-conversion-meshes.json', import.meta.url)),
  ).find((f) => f.key === 'oblique-i-end');
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(fixture.positions, 3));
  geometry.setIndex(fixture.indices);
  const source = part(geometry);
  source.mesh.position.set(...fixture.origin);
  const draft = convertReferencePart(source, model, 'sweep', []);
  let id = 0;
  const objects = conversionObjects([draft], [], () => `part-${id++}`);
  const sources = modelTransformSources(objects, new Set([objects[0].id]));
  assert.equal(sources.length, 3);
  const moved = transformCandidates({ sources, mode: 'move' }, [0, 0, 0], [500, -300, 700]);
  const afterMove = applyObjectBatch(objects, moved).objects;
  const original = geometryForModel(objects[0], objects);
  const expected = original.clone().translate(500, -300, 700);
  nearBounds(bounds(expected), bounds(geometryForModel(afterMove[0], afterMove)));
  const copied = applyObjectBatch(objects, moved, { copy: true, newId: () => `copy-${id++}` });
  const copies = copied.objects.filter((o) => copied.ids.includes(o.id));
  assert.equal(copies.length, 3);
  for (const cut of copies.slice(1)) assert.deepEqual(cut.targets, [copies[0].id]);
  nearBounds(bounds(expected), bounds(geometryForModel(copies[0], copied.objects)));
  const rotated = rotationCandidates({ sources, pivot: [0, 0, 0], axis: [0, 0, 1], angle: 90 });
  const afterRotate = applyObjectBatch(objects, rotated).objects;
  const rotatedExpected = original.clone().rotateZ(Math.PI / 2);
  nearBounds(bounds(rotatedExpected), bounds(geometryForModel(afterRotate[0], afterRotate)));
  original.dispose();
  expected.dispose();
  rotatedExpected.dispose();
  geometry.dispose();
  source.mesh.material.dispose();
});
