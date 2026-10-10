import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  placeItem,
  itemMatrix,
  validateItemObject,
  moveItemAnchor,
  setItemRoll,
} from '../src/items/geometry.js';
import {
  validateItemDefinition,
  packItems,
  unpackItems,
  combineStepMeshes,
} from '../src/items/data.js';
import {
  validateItemLibrary,
  emptyItemLibrary,
  mergeBundledItems,
  organizeWeland,
  folderPath,
  editItemFolder,
  findLibraryItems,
} from '../src/items/store.js';
import { helperIntersection, helperSnapPoints, addHelperLine } from '../src/items/guides.js';
import { applyObjectBatch } from '../src/model/tools/transform-tool.js';
import { transformObject } from '../src/transform.js';
import { rotateObject } from '../src/rotation.js';
import {
  objectGeometry,
  objectAnchors,
  objectSegments,
  createSnapGeometryContext,
} from '../src/model-object.js';
import { partKey } from '../src/part-marks.js';
import { createProject } from '../src/project/project-state.js';
import { defaultGrid } from '../src/grid-lines.js';
import { initialLevels } from '../src/levels.js';
import { serializeProject, parseProjectFile } from '../src/project/project-file.js';
const box = new THREE.BoxGeometry(20, 30, 100);
const item = {
  id: 'shape',
  revision: 1,
  name: 'Stolpe',
  article: '123',
  supplier: 'Test',
  sourceName: 'test.step',
  geometryId: 'mesh-123',
  start: [0, 0, -50],
  end: [0, 0, 50],
  snap: 'anchors',
  mesh: {
    positions: Array.from(box.attributes.position.array),
    normals: Array.from(box.attributes.normal.array),
    indices: Array.from(box.index.array),
  },
};
const near = (a, b) => a.forEach((v, i) => assert.ok(Math.abs(v - b[i]) < 1e-6, `${a} ≠ ${b}`));
test('rigid item placement maps the reference points without scaling, including rolled and vertical directions', () => {
  for (const target of [
    [1000, 0, 0],
    [0, 1000, 0],
    [0, 0, 1000],
    [0, 0, -1000],
    [123, 234, 345],
  ])
    for (const rotation of [0, 45, 90]) {
      const object = placeItem(item, [10, 20, 30], target, rotation),
        matrix = itemMatrix(object);
      assert.equal(validateItemObject(object), '');
      near(new THREE.Vector3(...item.start).applyMatrix4(matrix).toArray(), object.start);
      near(new THREE.Vector3(...item.end).applyMatrix4(matrix).toArray(), object.end);
      assert.ok(
        Math.abs(
          new THREE.Vector3(...object.end).distanceTo(new THREE.Vector3(...object.start)) - 100,
        ) < 1e-6,
      );
      const scale = new THREE.Vector3();
      matrix.decompose(new THREE.Vector3(), new THREE.Quaternion(), scale);
      near(scale.toArray(), [1, 1, 1]);
    }
});
test('items implement immutable geometry, transforms, numbering and simple snap', () => {
  const object = { ...placeItem(item, [0, 0, 0], [1000, 0, 0]), id: 'a', name: 'Stolpe' },
    before = structuredClone(object);
  const moved = transformObject(object, 'move', [0, 0, 0], [10, 20, 30]),
    turned = rotateObject(object, [0, 0, 0], 'Z', 90);
  near(objectAnchors(moved)[0], [10, 20, 30]);
  near(objectAnchors(turned)[1], [0, 100, 0]);
  assert.equal(partKey(object, []), partKey(moved, []));
  assert.equal(partKey(object, []), partKey(turned, []));
  assert.equal(objectSegments(object).length, 1);
  assert.deepEqual(createSnapGeometryContext([object]).objectCorners(object), []);
  const geometry = objectGeometry(object);
  geometry.computeBoundingBox();
  near(geometry.boundingBox.getSize(new THREE.Vector3()).toArray(), [100, 20, 30]);
  geometry.dispose();
  assert.deepEqual(object, before);
});
test('moving item start translates the whole solid and moving end only reorients it', () => {
  const object = placeItem(item, [0, 0, 0], [100, 0, 0]);
  const moved = moveItemAnchor(object, 'start', [10, 20, 30]);
  near(moved.end, [110, 20, 30]);
  const turned = moveItemAnchor(object, 'end', [0, 999, 0]);
  near(turned.end, [0, 100, 0]);
  assert.equal(
    validateItemObject({ ...object, end: [200, 0, 0] }),
    'Itemets storlek får inte ändras vid placering.',
  );
  assert.throws(() => placeItem(item, [0, 0, 0], [0, 0, 0]), /olika punkter/);
});
test('project files include one definition for repeated items and reload without the browser library', () => {
  const project = createProject({ grid: defaultGrid, levels: initialLevels() });
  project.objects = [
    { ...placeItem(item, [0, 0, 0], [100, 0, 0]), id: 'a', name: 'A' },
    { ...placeItem(item, [0, 100, 0], [100, 100, 0]), id: 'b', name: 'B' },
  ];
  const text = serializeProject(project),
    data = JSON.parse(text).project;
  assert.equal(data.itemDefinitions.length, 1);
  assert.equal(data.objects[0].item, undefined);
  const loaded = parseProjectFile(text);
  assert.equal(loaded.objects[0].item, loaded.objects[1].item);
  assert.deepEqual(loaded.objects, project.objects);
  data.itemDefinitions = [];
  assert.throws(() => unpackItems(data), /saknas/);
  const changed = { ...item, name: 'Different' };
  assert.throws(
    () =>
      packItems([
        { type: 'item', item },
        { type: 'item', item: changed },
      ]),
    /samma identitet/,
  );
});
test('definition and library validation rejects malformed geometry, duplicate revisions and cyclic folders', () => {
  validateItemDefinition(item);
  assert.throws(() => validateItemDefinition({ ...item, end: item.start }), /olika/);
  assert.throws(
    () => validateItemDefinition({ ...item, mesh: { ...item.mesh, indices: [0, 1, 99999] } }),
    /geometri/,
  );
  const library = emptyItemLibrary(),
    entry = { definition: item, folder: 'standard', starred: false };
  library.items = [entry];
  validateItemLibrary(library);
  assert.throws(() => validateItemLibrary({ ...library, items: [entry, entry] }), /bibliotekspost/);
  assert.throws(
    () =>
      validateItemLibrary({
        ...library,
        folders: [{ id: 'standard', name: 'A', parent: 'standard' }],
      }),
    /mappträd/,
  );
});
test('temporary helper snap includes midpoints and 3D segment intersections, excludes skew or extended lines', () => {
  const a = [
      [0, 0, 0],
      [100, 100, 0],
    ],
    b = [
      [0, 100, 0],
      [100, 0, 0],
    ];
  near(helperIntersection(a, b), [50, 50, 0]);
  assert.ok(helperSnapPoints([a, b]).some((p) => p.every((v) => v === 50 || v === 0)));
  assert.equal(
    helperIntersection(
      a,
      b.map((p) => [p[0], p[1], 10]),
    ),
    null,
  );
  assert.equal(
    helperIntersection(a, [
      [200, 0, 0],
      [200, 100, 0],
    ]),
    null,
  );
  assert.throws(() => addHelperLine([], a[0], a[0]), /olika/);
});
test('STEP submeshes are merged using independent vertex offsets', () => {
  const mesh = {
    attributes: {
      position: { array: [0, 0, 0, 1, 0, 0, 0, 1, 0] },
      normal: { array: [0, 0, 1, 0, 0, 1, 0, 0, 1] },
    },
    index: { array: [0, 1, 2] },
  };
  const combined = combineStepMeshes({ success: true, meshes: [mesh, mesh] });
  assert.deepEqual(combined.indices, [0, 1, 2, 3, 4, 5]);
  assert.throws(() => combineStepMeshes({ success: false }), /ingen läsbar/);
});

test('copied items share immutable meshes and rolling preserves a previously rotated axis', () => {
  const source = { ...placeItem(item, [10.000123, 20, 30], [123, 456, 789]), id: 'a', name: 'A' };
  const turned = rotateObject(source, [0, 0, 0], 'X', 37);
  const rolled = setItemRoll(turned, 90);
  near(rolled.start, turned.start);
  near(rolled.end, turned.end);
  assert.equal(validateItemObject(rolled), '');
  const restored = setItemRoll(rolled, 0);
  near(restored.quaternion, turned.quaternion);
  const copy = applyObjectBatch([turned], [turned], { copy: true, newId: () => 'b' }).objects[1];
  assert.equal(copy.item, source.item);
  const reoriented = moveItemAnchor(rolled, 'end', [500, 600, 700]);
  assert.equal(validateItemObject(reoriented), '');
});

test('Sectional Railing includes all 68 shapes in the original folder hierarchy', () => {
  const catalog = JSON.parse(
    gunzipSync(
      readFileSync(new URL('../src/items/catalog/sectional-railing.bin', import.meta.url)),
    ),
  );
  validateItemLibrary(catalog);
  assert.equal(catalog.items.length, 68);
  assert.equal(catalog.folders.length, 13);
  assert.equal(new Set(catalog.items.map((e) => e.definition.geometryId)).size, 68);
  const paths = new Map();
  const path = (f) =>
    f.parent ? path(catalog.folders.find((p) => p.id === f.parent)) + '/' + f.name : f.name;
  for (const folder of catalog.folders)
    paths.set(path(folder), catalog.items.filter((e) => e.folder === folder.id).length);
  assert.equal(paths.get('Sectional Railing/Gate'), 6);
  assert.equal(paths.get('Sectional Railing/Handrail'), 15);
  assert.equal(paths.get('Sectional Railing/Kick strip'), 5);
  assert.equal(paths.get('Sectional Railing/Round Bar Filling'), 14);
  for (const mount of ['Top Mounted', 'Side Mounted'])
    for (const kind of ['Intermediate', 'Round Bar'])
      assert.equal(paths.get('Sectional Railing/' + mount + '/' + kind), 7);
});
test('bundled catalog seeds once, reuses folders and preserves edited existing items without duplicates', () => {
  const library = emptyItemLibrary();
  library.folders.push({ id: 'existing-root', name: 'Vendor', parent: null });
  const edited = { ...item, name: 'Edited', revision: 2 };
  library.items = [{ definition: edited, folder: 'existing-root', starred: true }];
  const catalog = {
    version: 1,
    folders: [
      { id: 'seed-root', name: 'Vendor', parent: null },
      { id: 'seed-child', name: 'Posts', parent: 'seed-root' },
    ],
    items: [{ definition: item, folder: 'seed-child', starred: false }],
  };
  const merged = mergeBundledItems(library, catalog, 'vendor-v1');
  assert.equal(merged.items.length, 1);
  assert.equal(merged.items[0].definition, edited);
  assert.equal(merged.items[0].starred, true);
  assert.equal(merged.items[0].folder, 'seed-child');
  assert.equal(merged.folders.find((f) => f.id === 'seed-child').parent, 'existing-root');
  assert.equal(library.items[0].folder, 'existing-root');
  const removed = { ...merged, items: [] };
  assert.equal(mergeBundledItems(removed, catalog, 'vendor-v1'), removed);
  const fresh = mergeBundledItems(emptyItemLibrary(), catalog, 'vendor-v1');
  assert.equal(fresh.items.length, 1);
});

test('an existing vendor folder under Standard is reused instead of creating a second vendor root', () => {
  const library = emptyItemLibrary();
  library.folders.push(
    { id: 'legacy', name: 'Vendor', parent: 'standard' },
    { id: 'vendor-root', name: 'Vendor', parent: null },
    { id: 'posts', name: 'Posts', parent: 'vendor-root' },
  );
  const catalog = {
    version: 1,
    folders: [
      { id: 'vendor-root', name: 'Vendor', parent: null },
      { id: 'posts', name: 'Posts', parent: 'vendor-root' },
    ],
    items: [{ definition: item, folder: 'posts', starred: false }],
  };
  const merged = mergeBundledItems(library, catalog, 'v2');
  assert.equal(merged.folders.filter((f) => f.name === 'Vendor').length, 1);
  assert.equal(merged.folders.find((f) => f.id === 'posts').parent, 'legacy');
  assert.equal(merged.items.length, 1);
});

test('Weland migration nests the existing catalog once and preserves edited item versions', () => {
  const original = {
    ...emptyItemLibrary(),
    folders: [
      { id: 'standard', name: 'Standard', parent: null },
      { id: 'sectional-folder-root', name: 'Sectional Railing', parent: 'standard' },
      { id: 'gate', name: 'Gate', parent: 'sectional-folder-root' },
    ],
    items: [{ definition: item, folder: 'gate', starred: true }],
  };
  const next = organizeWeland(original);
  assert.equal(folderPath(next, 'gate'), 'Weland / Sectional Railing / Gate');
  assert.equal(next.items[0], original.items[0]);
  assert.equal(organizeWeland(next), next);
  assert.equal(original.folders.length, 3);
});
test('folder moves reject cycles and duplicate siblings; search covers ancestors and latest revisions', () => {
  const library = {
    ...emptyItemLibrary(),
    folders: [
      { id: 'weland', name: 'Weland', parent: null },
      { id: 'rail', name: 'Räcken', parent: 'weland' },
      { id: 'gate', name: 'Gate', parent: 'rail' },
      { id: 'hand', name: 'Handrail', parent: 'rail' },
    ],
    items: [
      { definition: item, folder: 'gate', starred: false },
      { definition: { ...item, revision: 2 }, folder: 'gate', starred: true },
    ],
  };
  assert.throws(() => editItemFolder(library, 'weland', 'Weland', 'gate'), /undermapp/);
  assert.throws(() => editItemFolder(library, 'gate', 'Handrail', 'rail'), /redan/);
  const moved = editItemFolder(library, 'gate', 'Grindar', 'weland');
  assert.equal(folderPath(moved, 'gate'), 'Weland / Grindar');
  assert.equal(findLibraryItems(library, 'weland', 'weland gate 123')[0].definition.revision, 2);
  assert.equal(findLibraryItems(library, 'hand').length, 0);
  assert.equal(findLibraryItems(library, 'weland', '', { recursive: false }).length, 0);
  assert.equal(findLibraryItems(library, 'gate', '', { recursive: false }).length, 1);
  assert.equal(findLibraryItems(library, '', '', { recursive: false }).length, 0);
  assert.equal(findLibraryItems(library, 'starred').length, 1);
  assert.equal(findLibraryItems(library, 'all', 'saknas').length, 0);
});
test('search filters a library with thousands of items without duplicate revisions', () => {
  const library = {
    ...emptyItemLibrary(),
    items: Array.from({ length: 5000 }, (_, i) => ({
      definition: { ...item, id: `shape-${i}`, article: `${i}` },
      folder: 'standard',
      starred: false,
    })),
  };
  assert.equal(findLibraryItems(library, 'all').length, 5000);
  assert.equal(findLibraryItems(library, 'standard', '4999').length, 1);
});
