import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { displayedSelectionHit, modelSelectionEntry } from '../src/model/selection-hit.js';
import { createModelPicking } from '../src/model/ui/model-picking.js';
import { installModelHover } from '../src/model/ui/model-hover.js';
import { ReferenceModels } from '../src/references/reference-models.js';
import { edgeIndex } from '../src/edge-index.js';

function fixture(perspective = false) {
  const camera = perspective
    ? new THREE.PerspectiveCamera(45, 1, 1, 10000)
    : new THREE.OrthographicCamera(-200, 200, 200, -200, 1, 10000);
  camera.position.set(0, 0, 1000);
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
  const raycaster = new THREE.Raycaster();
  const context = { camera, width: 800, height: 800, pointer: [400, 400] };
  const point = (world, dx = 0, dy = 0) => {
    const p = new THREE.Vector3(...world).project(camera);
    context.pointer = [(p.x + 1) * 400 + dx, (1 - p.y) * 400 + dy];
    raycaster.setFromCamera(
      new THREE.Vector2(context.pointer[0] / 400 - 1, 1 - context.pointer[1] / 400),
      camera,
    );
  };
  const box = (id, z = 0, transparent = true) => {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(100, 100, 40),
      new THREE.MeshStandardMaterial({
        opacity: transparent ? 0.3 : 1,
        transparent,
        side: THREE.DoubleSide,
      }),
    );
    mesh.userData.id = id;
    mesh.position.z = z;
    mesh.add(
      new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry), new THREE.LineBasicMaterial()),
    );
    mesh.updateMatrixWorld(true);
    return mesh;
  };
  const pick = (meshes) =>
    displayedSelectionHit(
      meshes.filter((m) => m.visible).map((m) => modelSelectionEntry(m, camera)),
      raycaster,
      context,
    );
  return { camera, raycaster, context, point, box, pick };
}

test('transparent faces pass through; geometric edges use six screen pixels at every zoom and projection', () => {
  for (const perspective of [false, true]) {
    const f = fixture(perspective),
      front = f.box('front', 200),
      rear = f.box('rear', 0, false);
    for (const zoom of [1, 2]) {
      f.camera.zoom = zoom;
      f.camera.updateProjectionMatrix();
      f.point([0, 0, 220]);
      assert.equal(f.pick([front]), null, 'face and triangulation diagonal cannot select');
      assert.equal(f.pick([front, rear]).object, rear, 'transparent face passes to opaque object');
      f.point([50, 0, 220], 5.9);
      assert.equal(f.pick([front]).object, front);
      f.point([50, 0, 220], 6.1);
      assert.equal(f.pick([front]), null);
      front.material.opacity = 1;
      front.material.transparent = false;
      f.point([0, 0, 220]);
      assert.equal(f.pick([front]).object, front, 'opaque objects retain face picking');
      front.material.opacity = 0.3;
      front.material.transparent = true;
    }
  }
});

test('edge picks respect work area, transformed geometry, occlusion and original instanced owners', () => {
  const f = fixture(),
    front = f.box('front', 200),
    rear = f.box('rear');
  f.point([50, 0, 220]);
  assert.equal(f.pick([rear, front]).object, front, 'coincident edges break ties by depth');
  const cover = f.box('cover', 400, false);
  cover.scale.set(2, 2, 1);
  cover.updateMatrixWorld(true);
  assert.equal(f.pick([front, cover]).object, cover, 'opaque surface blocks rear edges');
  f.context.workArea = new THREE.Box3(
    new THREE.Vector3(-100, -100, -100),
    new THREE.Vector3(0, 100, 500),
  );
  assert.equal(f.pick([front]), null, 'clipped edge cannot select');
  f.context.workArea = null;
  const parent = new THREE.Group();
  parent.rotation.z = 0.4;
  parent.scale.set(1.3, 0.7, 1);
  parent.position.set(20, 10, 0);
  parent.add(front);
  parent.updateMatrixWorld(true);
  const edgePoint = new THREE.Vector3(50, 0, 20).applyMatrix4(front.matrixWorld).toArray();
  front.userData.instanced = true;
  front.children[0].layers.set(3);
  f.point(edgePoint);
  assert.equal(f.pick([front]).object, front, 'batch layers retain original object identity');
  front.visible = false;
  assert.equal(f.pick([front]), null);
});

function referencesFor(mesh) {
  delete mesh.userData.id;
  mesh.userData.ifcId = 42;
  const edges = mesh.children[0].geometry.attributes.position.array;
  const group = new THREE.Group(),
    root = new THREE.Group();
  group.add(mesh);
  root.add(group);
  root.updateMatrixWorld(true);
  const parts = [{ mesh, edges, index: edgeIndex(edges) }];
  return Object.assign(Object.create(ReferenceModels.prototype), {
    group: root,
    parts,
    models: [{ id: 'ref', format: 'IFC', group, parts, transparent: true }],
    selectionMode: 'object',
  });
}

test('native hover and click share IFC edge hits in both reference modes, while orbit keeps surface hits', () => {
  const f = fixture(),
    native = f.box('native', -200, false),
    imported = f.box('ifc', 200);
  const refs = referencesFor(imported),
    objects = new THREE.Group();
  objects.add(native);
  objects.updateMatrixWorld(true);
  const tools = {},
    ui = {},
    hovered = [],
    pivots = [];
  const picking = createModelPicking({
    camera: f.camera,
    host: {
      clientWidth: 800,
      clientHeight: 800,
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 800 }),
    },
    objects,
    tools,
    ui,
    getRenderedById: () => new Map([['native', { source: { id: 'native', type: 'sweep' } }]]),
    getReferences: () => refs,
    navigation: {
      controls: { mouseButtons: { MIDDLE: THREE.MOUSE.PAN } },
      movePivot: (p) => pivots.push(p.toArray()),
    },
  });
  const event = (p) => {
    f.point(p);
    return {
      clientX: f.context.pointer[0],
      clientY: f.context.pointer[1],
      button: 1,
      ctrlKey: true,
      pointerType: 'mouse',
    };
  };
  const actions = { ...picking, userSelection: (ids) => ids };
  installModelHover({
    actions,
    controllers: { referenceModels: refs },
    objectFeedback: {
      sources: new Map(),
      setHover: (ids) => hovered.push(ids),
      invalidate: () => {},
    },
    objects,
    project: { objects: [] },
    renderState: { renderedById: new Map() },
    renderer: { domElement: { style: {} } },
    tools,
    ui,
  });
  for (const mode of ['reference', 'object']) {
    refs.selectionMode = mode;
    const e = event([50, 0, 220]);
    actions.updateObjectHover(e);
    assert.equal(refs.hoverParts.length, 1);
    assert.equal(imported.material.emissive.getHex(), 0xe1b84d);
    picking.ray(e);
    assert.equal(picking.selectionHit(), null);
    assert.deepEqual(picking.referenceSelectionHit(), {
      modelId: 'ref',
      ifcId: mode === 'object' ? 42 : null,
    });
    actions.updateObjectHover(event([0, 0, 220]));
    assert.equal(refs.hoverParts.length, 0, 'hover clears when pointer leaves edge');
    assert.equal(imported.material.emissive.getHex(), 0);
    assert.equal(picking.selectionHit(), 'native');
    picking.orbitAroundHit(event([0, 0, 220]));
    assert.deepEqual(pivots.at(-1), [0, 0, 220], 'orbit still hits transparent face');
  }
  native.visible = false;
  picking.ray(event([0, 0, 220]));
  assert.equal(picking.selectionHit(), null);
  assert.equal(
    picking.referenceSelectionHit(),
    null,
    'empty transparent face cannot select reference',
  );
  refs.models[0].group.visible = false;
  picking.ray(event([50, 0, 220]));
  assert.equal(picking.referenceSelectionHit(), null);
});

test('IFC hover restores selection colour and clears when hidden or disposed', () => {
  const f = fixture(),
    imported = f.box('ifc'),
    refs = referencesFor(imported);
  imported.material.emissive.setHex(0x176b53);
  const selection = { modelId: 'ref', ifcId: 42 };
  assert.equal(refs.setHoverSelection(selection), true);
  assert.equal(
    refs.setHoverSelection(selection),
    false,
    'stationary hover does not invalidate every frame',
  );
  refs.setHoverSelection(null);
  assert.equal(imported.material.emissive.getHex(), 0x176b53);
  refs.setHoverSelection(selection);
  refs.models[0].group.visible = false;
  refs.setHoverSelection(selection);
  assert.equal(imported.material.emissive.getHex(), 0x176b53);
  assert.equal(refs.hoverParts.length, 0);
  refs.models[0].group.visible = true;
  refs.setHoverSelection(selection);
  refs.dispose(refs.parts);
  assert.equal(refs.hoverParts.length, 0);
  assert.equal(imported.material.emissive.getHex(), 0x176b53);
});

test('changing outline geometry invalidates the edge cache and near-plane clipping stays finite', () => {
  const f = fixture(),
    mesh = f.box('native');
  f.point([50, 0, 20]);
  assert.ok(f.pick([mesh]));
  const positions = mesh.children[0].geometry.attributes.position;
  for (let i = 0; i < positions.count; i++) positions.setX(i, positions.getX(i) + 200);
  positions.needsUpdate = true;
  assert.equal(f.pick([mesh]), null);
  const camera = new THREE.PerspectiveCamera(60, 1, 1, 100);
  camera.updateMatrixWorld();
  const line = new THREE.LineSegments(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(0, 0, -20),
    ]),
  );
  mesh.remove(mesh.children[0]);
  mesh.add(line);
  const ray = new THREE.Raycaster();
  ray.setFromCamera(new THREE.Vector2(0, 0), camera);
  const hit = displayedSelectionHit([modelSelectionEntry(mesh, camera)], ray, {
    camera,
    pointer: [400, 400],
    width: 800,
    height: 800,
  });
  assert.ok(hit);
  assert.ok(hit.point.toArray().every(Number.isFinite));
  assert.ok(hit.distance >= camera.near && hit.distance <= camera.far);
});
