import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { IfcAPI } from 'web-ifc';
import { readFileSync } from 'node:fs';
import {
  defaultCoordinates,
  validateCoordinates,
  localToMap,
  mapToLocal,
  parseCoordinate,
} from '../src/coordinates/coordinates.js';
import { referenceLocalPoint, validateReferenceCRS } from '../src/coordinates/reference-frame.js';
import { readIFCGeoreferencing } from '../src/coordinates/ifc-georeferencing.js';
import {
  applyReferencePlacement,
  initialReferencePlacement,
  moveReferencePlacement,
  rotateReferencePlacement,
} from '../src/references/reference-placement.js';
import { ReferenceModels } from '../src/references/reference-models.js';
import { edgeIndex, referenceCandidates } from '../src/references/edge-index.js';
import { createProject } from '../src/project/project-state.js';
import { serializeProject, parseProjectFile } from '../src/project/project-file.js';
import { ProjectHistory } from '../src/project/project-history.js';
import { createCoordinatePicker } from '../src/model/ui/coordinate-pick-controller.js';
import { pointerCommand } from '../src/model/pointer-controller.js';
import { modelKeyboardCommand } from '../src/model/keyboard-command.js';
const near = (a, b, e = 1e-5) =>
  a.forEach((v, i) => assert.ok(Math.abs(v - b[i]) < e, `${a} != ${b}`));
const base = {
  id: 'a',
  name: 'Hus A',
  local: [1000, 2000, 3000],
  map: [674250, 6580120, 32.5],
  rotation: 30,
};
const coordinates = () => ({
  ...defaultCoordinates(),
  crs: 'EPSG:3006',
  verticalDatum: 'RH2000',
  activeId: 'a',
  basePoints: [structuredClone(base)],
});
test('multiple bases transform local mm to map metres with inverse, height, rotation and no input mutation', () => {
  const c = coordinates();
  c.basePoints.push({ ...structuredClone(base), id: 'b', name: 'Hus B', rotation: -90 });
  validateCoordinates(c);
  const snapshot = structuredClone(c);
  for (const p of [
    [0, 0, 0],
    [1, 2, 3],
    [-1234.567, 98765.432, -9999],
  ]) {
    for (const b of c.basePoints) near(mapToLocal(localToMap(p, b), b), p);
    near(mapToLocal(localToMap(p, null), null), p);
  }
  near(localToMap(base.local, base), base.map);
  near(localToMap([2000, 2000, 3000], base), [674250 + Math.cos(Math.PI / 6), 6580120 + 0.5, 32.5]);
  assert.deepEqual(c, snapshot);
  assert.equal(parseCoordinate('6 580 120,125'), 6580120.125);
  assert.equal(parseCoordinate('−236,574'), -236.574);
  for (const text of ['', '   ', 'abc', '1,2,3', 'Infinity'])
    assert.throws(() => parseCoordinate(text));
  for (const patch of [
    { activeId: 'unknown' },
    { basePoints: [base, base] },
    { basePoints: [{ ...base, local: [0, NaN, 0] }] },
    { basePoints: [{ ...base, name: ' ' }] },
    { basePoints: [base, { ...base, id: 'b' }] },
  ])
    assert.throws(() => validateCoordinates({ ...c, ...patch }));
});
test('reference frames preserve relative distances, manual transforms, local override, snap and bounds on base switch', () => {
  const c = coordinates(),
    model = {
      id: 'r',
      format: 'IFC',
      coordinateMode: 'map',
      projectCoordinates: c,
      placement: initialReferencePlacement(),
      group: new THREE.Group(),
      parts: [],
    };
  const p = localToMap([4000, 5000, 3000], base).map((v) => v * 1000);
  const edges = new Float64Array([0, 0, 0, 1000, 0, 0]);
  const geometry = new THREE.BufferGeometry().setAttribute(
    'position',
    new THREE.Float32BufferAttribute([0, 0, 0, 1000, 0, 0], 3),
  );
  const mesh = new THREE.Line(geometry, new THREE.LineBasicMaterial());
  mesh.position.fromArray(p);
  model.group.add(mesh);
  model.parts = [{ mesh, edges, index: edgeIndex(edges) }];
  applyReferencePlacement(model);
  near(mesh.getWorldPosition(new THREE.Vector3()).toArray(), [4000, 5000, 3000]);
  model.placement = moveReferencePlacement(model.placement, [0, 0, 0], [200, 300, 400]);
  applyReferencePlacement(model);
  near(mesh.getWorldPosition(new THREE.Vector3()).toArray(), [4200, 5300, 3400]);
  model.placement = rotateReferencePlacement(model.placement, [0, 0, 0], [0, 0, 1], 90);
  applyReferencePlacement(model);
  near(mesh.getWorldPosition(new THREE.Vector3()).toArray(), [-5300, 4200, 3400]);
  const other = {
    ...structuredClone(base),
    id: 'b',
    name: 'Hus B',
    map: [base.map[0] + 10, ...base.map.slice(1)],
  };
  const next = { ...c, basePoints: [base, other], activeId: 'b' };
  const refs = Object.assign(Object.create(ReferenceModels.prototype), { models: [model] });
  refs.setCoordinates(next);
  const expected = referenceLocalPoint(p, 'map', null, next);
  const placement = new THREE.Matrix4().compose(
    new THREE.Vector3().fromArray(model.placement.offset),
    new THREE.Quaternion().fromArray(model.placement.quaternion),
    new THREE.Vector3(1, 1, 1),
  );
  near(
    mesh.getWorldPosition(new THREE.Vector3()).toArray(),
    new THREE.Vector3().fromArray(expected).applyMatrix4(placement).toArray(),
  );
  const box = refs.modelBounds(model);
  assert.ok(box.containsPoint(mesh.getWorldPosition(new THREE.Vector3())));
  const world = mesh.getWorldPosition(new THREE.Vector3());
  const camera = new THREE.OrthographicCamera(
    world.x - 2000,
    world.x + 2000,
    world.y + 2000,
    world.y - 2000,
    1,
    20000,
  );
  camera.position.z = 10000;
  camera.updateMatrixWorld();
  const hits = referenceCandidates(model.parts, {
    camera,
    ray: new THREE.Ray(new THREE.Vector3(world.x, world.y, 10000), new THREE.Vector3(0, 0, -1)),
    pointer: [200, 200],
    width: 400,
    height: 400,
    corners: true,
    edges: true,
  });
  assert.ok(hits.some((h) => h.coords.every((v, i) => Math.abs(v - world.toArray()[i]) < 1e-5)));
  model.coordinateMode = 'local';
  applyReferencePlacement(model);
  near(
    mesh.getWorldPosition(new THREE.Vector3()).toArray(),
    new THREE.Vector3().fromArray(p).applyMatrix4(placement).toArray(),
  );
  geometry.dispose();
  mesh.material.dispose();
});
test('coordinate state persists, validates and undoes without rebasing the model objects', () => {
  let project = createProject({
    grid: { x: [], y: [] },
    levels: { active: 'l', items: [{ id: 'l', name: 'Plan', elevation: 0 }] },
  });
  const h = new ProjectHistory();
  const objects = project.objects;
  h.checkpoint(project);
  project.coordinates = coordinates();
  const text = serializeProject(project),
    loaded = parseProjectFile(text);
  assert.deepEqual(loaded.coordinates, project.coordinates);
  assert.strictEqual(project.objects, objects);
  project = h.undo(project);
  assert.deepEqual(project.coordinates, defaultCoordinates());
  project = h.redo(project);
  assert.equal(project.coordinates.activeId, 'a');
  const invalid = JSON.parse(text);
  invalid.project.coordinates.activeId = 'missing';
  assert.throws(() => parseProjectFile(JSON.stringify(invalid)));
  assert.throws(() =>
    validateReferenceCRS({ crs: 'EPSG:25832', verticalDatum: '' }, 'map', coordinates()),
  );
  assert.doesNotThrow(() => validateReferenceCRS({ crs: 'EPSG:25832' }, 'local', coordinates()));
});
test('real IFC4 map conversion keeps engineering geometry local and converts map units exactly once', async () => {
  const api = new IfcAPI();
  await api.Init();
  const file = readFileSync(new URL('./fixtures/reference-box.ifc', import.meta.url), 'utf8');
  const added = `#30=IFCSIUNIT(*,.LENGTHUNIT.,$,.METRE.);\n#31=IFCPROJECTEDCRS('EPSG:3006',$,$,'RH2000',$,$,#30);\n#32=IFCMAPCONVERSION(#5,#31,674250.,6580120.,32.5,0.,1.,0.001);\n`;
  const bytes = new TextEncoder().encode(
    file.replace('ENDSEC;\nEND-ISO', added + 'ENDSEC;\nEND-ISO'),
  );
  const model = api.OpenModel(bytes, { COORDINATE_TO_ORIGIN: false });
  try {
    const source = readIFCGeoreferencing(api, model);
    near(source.map, [674250, 6580120, 32.5]);
    assert.equal(source.scale, 1);
    assert.equal(source.rotation, 90);
    const c = { ...coordinates(), basePoints: [{ ...base, local: [0, 0, 0], rotation: 90 }] };
    near(referenceLocalPoint([1000, 2000, 3000], 'map', source, c), [1000, 2000, 3000]);
    api.StreamAllMeshes(model, (m) => {
      const t = m.geometries.get(0).flatTransformation;
      // web-ifc does not apply map conversion to its mesh placement.
      assert.ok(Math.max(...t.map(Math.abs)) < 100);
    });
  } finally {
    api.CloseModel(model);
  }
});
test('base point picker uses ordinary model routing and resolves pick/cancel without model transactions', async () => {
  const tools = { operation: null };
  let drawings = 0;
  const picker = createCoordinatePicker({
    tools,
    setDrawing() {
      drawings++;
      picker.suspend();
    },
    syncOperationUI() {},
    focus() {},
    status() {},
  });
  const pending = picker.start();
  assert.equal(pointerCommand({ mode: tools.operation.mode, drawing: true }), 'coordinate-point');
  assert.equal(modelKeyboardCommand({ key: 'Enter' }, { mode: 'coordinatePoint' }), null);
  assert.equal(
    modelKeyboardCommand(
      { key: 'm', ctrlKey: true },
      { mode: 'coordinatePoint', hasSelection: true },
    ),
    null,
  );
  assert.equal(
    modelKeyboardCommand({ key: 'Delete' }, { mode: 'coordinatePoint', hasSelection: true }),
    null,
  );
  picker.pickPoint([1, 2, 3]);
  assert.deepEqual(await pending, [1, 2, 3]);
  const cancel = picker.start();
  picker.cancel();
  assert.equal(await cancel, null);
  const external = picker.start();
  picker.suspend();
  assert.equal(await external, null);
  assert.equal(drawings, 8);
});
