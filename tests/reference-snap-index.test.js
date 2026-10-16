import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { referenceSnapFixture } from '../scripts/reference-snap-fixture.js';
import { createReferencePartSnapIndex } from '../src/references/snap-part-index.js';
import { referenceCandidates } from '../src/references/edge-index.js';
import { ReferenceModels } from '../src/references/reference-models.js';

test('reference part culling preserves snap candidates across camera, placement, scale, visibility and work area changes', () => {
  const f = referenceSnapFixture({ references: 2, partsPerReference: 180, overlap: true });
  try {
    for (const m of f.models) m.snapIndex = createReferencePartSnapIndex(m.parts, m.group);
    for (const perspective of [false, true]) {
      const camera = perspective
        ? new THREE.PerspectiveCamera(50, 1280 / 720, 1, 100000)
        : f.queries[0].camera;
      camera.position.set(6000, 6000, 10000);
      camera.lookAt(6000, 3000, 0);
      camera.updateMatrixWorld();
      for (const mode of [0, 1, 2]) {
        const m = f.models[0];
        m.group.position.set(mode * 800, mode * 300, 100 * mode);
        m.group.rotation.z = mode * 0.28;
        m.group.scale.setScalar(mode === 2 ? 1.7 : 1);
        m.group.updateMatrixWorld(true);
        m.parts[25].mesh.visible = mode !== 1;
        const bounds =
          mode === 2
            ? new THREE.Box3(new THREE.Vector3(0, 0, -1000), new THREE.Vector3(12000, 12000, 1000))
            : null;
        for (let i = 0; i < 90; i++) {
          const target = new THREE.Vector3(1500 + i * 67, 2000 + (i % 9) * 73, 300).project(camera),
            raycaster = new THREE.Raycaster();
          raycaster.setFromCamera(new THREE.Vector2(target.x, target.y), camera);
          const options = {
            camera,
            ray: raycaster.ray,
            pointer: [(target.x + 1) * 640, (1 - target.y) * 360],
            width: 1280,
            height: 720,
            start: [3000, 4000, 300],
            nearest: true,
            perpendicular: true,
            workArea: bounds,
          };
          assert.deepEqual(
            referenceCandidates(m.snapIndex.query(options), options),
            referenceCandidates(m.parts, options),
          );
        }
      }
    }
    const m = f.models[0];
    m.group.visible = false;
    assert.deepEqual(m.snapIndex.query(f.queries[0]), []);
  } finally {
    f.dispose();
  }
});

test('production reference candidate path prunes distant parts and preserves flags and rebuilds on replacement', () => {
  const f = referenceSnapFixture({ references: 10, partsPerReference: 1000 });
  const refs = Object.assign(Object.create(ReferenceModels.prototype), {
    models: f.models,
    group: f.root,
    setWorkArea() {},
  });
  try {
    refs.syncParts();
    const old = f.models[0].snapIndex,
      stats = {};
    old.query(f.queries[0], stats);
    assert.ok(stats.parts < 100, 'local query must avoid visiting all 1000 part bounds');
    const q = { ...f.queries[0], nearest: true, perpendicular: true };
    const exhaustive = f.models.flatMap((m) => referenceCandidates(m.parts, q));
    assert.deepEqual(refs.candidates(q), exhaustive);
    refs.syncParts();
    assert.equal(f.models[0].snapIndex, old);
    f.models[0].parts = f.models[0].parts.slice(0, 100);
    refs.syncParts();
    assert.notEqual(f.models[0].snapIndex, old);
    f.models.forEach((m) => {
      m.corners = false;
      m.edges = false;
    });
    assert.deepEqual(refs.candidates(q), []);
    refs.group.visible = false;
    assert.deepEqual(refs.candidates({}), []);
  } finally {
    f.dispose();
  }
});

test('real IFC tessellation keeps Nearest behind model Polar and drawing Polar/Otrack', async () => {
  const { IfcAPI } = await import('web-ifc');
  const { readFileSync } = await import('node:fs');
  const { ifcPlacement } = await import('../src/references/ifc-coordinates.js');
  const { edgeIndex } = await import('../src/edge-index.js');
  const { resolveSnap } = await import('../src/snap.js');
  const { locateDrawingPoint } = await import('../src/drawing-point-placement.js');
  const { CadTracking } = await import('../src/cad-tracking.js');
  const { defaultCadSettings } = await import('../src/cad-statusbar.js');
  const api = new IfcAPI();
  await api.Init();
  const id = api.OpenModel(readFileSync(new URL('./fixtures/reference-box.ifc', import.meta.url)), {
    COORDINATE_TO_ORIGIN: false,
  });
  const parts = [];
  try {
    api.StreamAllMeshes(id, (flat) => {
      for (let i = 0; i < flat.geometries.size(); i++) {
        const placement = flat.geometries.get(i),
          raw = api.GetGeometry(id, placement.geometryExpressID);
        try {
          const vertex = api.GetVertexArray(raw.GetVertexData(), raw.GetVertexDataSize()),
            positions = new Float32Array(vertex.length / 2);
          for (let j = 0; j < vertex.length / 6; j++)
            positions.set(vertex.subarray(j * 6, j * 6 + 3), j * 3);
          const geometry = new THREE.BufferGeometry();
          geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
          geometry.setIndex(
            Array.from(api.GetIndexArray(raw.GetIndexData(), raw.GetIndexDataSize())),
          );
          geometry.applyMatrix4(ifcPlacement(placement.flatTransformation));
          const mesh = new THREE.Mesh(geometry),
            edgeGeometry = new THREE.EdgesGeometry(geometry, 20),
            edges = edgeGeometry.attributes.position.array.slice();
          edgeGeometry.dispose();
          mesh.updateMatrixWorld();
          parts.push({ mesh, edges, index: edgeIndex(edges) });
        } finally {
          raw.delete();
        }
      }
    });
  } finally {
    api.CloseModel(id);
  }
  try {
    const segments = parts.flatMap((p) =>
      Array.from({ length: p.edges.length / 6 }, (_, i) => [
        Array.from(p.edges.slice(i * 6, i * 6 + 3)),
        Array.from(p.edges.slice(i * 6 + 3, i * 6 + 6)),
      ]),
    );
    const edge = segments.find(
      ([a, b]) =>
        Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[1] - b[1]) > 100 && Math.abs(a[2] - b[2]) < 1e-6,
    );
    assert.ok(edge);
    const x = edge[0][0],
      y = (edge[0][1] + edge[1][1]) / 2,
      z = edge[0][2],
      raw = [x + 2, y + 1, z],
      base = [x - 100, y - 101, z];
    const camera = new THREE.OrthographicCamera(-500, 500, 500, -500, 1, 100000);
    camera.position.set(x, y, z + 10000);
    camera.lookAt(x, y, z);
    camera.updateMatrixWorld();
    const clip = new THREE.Vector3(...raw).project(camera),
      caster = new THREE.Raycaster();
    caster.setFromCamera(new THREE.Vector2(clip.x, clip.y), camera);
    const query = {
      camera,
      ray: caster.ray,
      pointer: [(clip.x + 1) * 500, (1 - clip.y) * 500],
      width: 1000,
      height: 1000,
      corners: false,
    };
    const referencePoints = referenceCandidates(parts, query);
    assert.ok(referencePoints.some((p) => p.edge));
    const options = {
      ...query,
      start: base,
      z,
      sweeps: [],
      grid: { x: [], y: [] },
      referencePoints,
      axisSnap: false,
      polar: 45,
    };
    assert.match(resolveSnap(options).label, /Polar 45/);
    assert.equal(resolveSnap({ ...options, polar: 0 }).label, 'Närmaste');
    const settings = {
      ...defaultCadSettings,
      endpoints: false,
      midpoints: false,
      intersections: false,
      centers: false,
      perpendicular: false,
      polar: 45,
      otrack: true,
    };
    const editor = {
      items: [],
      mode: 'line',
      cad: { get: () => settings, coordinates() {} },
      tracking: new CadTracking(),
      transform: { active: () => true, base: base.slice(0, 2) },
      adapter: {
        locate: () => ({ view: 'ifc', point: raw.slice(0, 2) }),
        project: (p) => p,
        pixelScale: () => 1,
        candidates: () => [],
        snapEntities: () => [{ type: 'line', points: edge.map((p) => p.slice(0, 2)) }],
      },
    };
    const hit = () => locateDrawingPoint(editor, { clientX: 0, clientY: 0 }, 'ifc');
    assert.equal(hit().kind, 'Polar');
    settings.polar = 0;
    assert.equal(hit().kind, 'Närmaste');
    editor.tracking.points = [[x, y - 200]];
    settings.polar = 45;
    const corner = hit();
    assert.equal(corner.kind, 'Skärning');
    assert.ok(Math.hypot(corner.point[0] - x, corner.point[1] - (y - 1)) < 1e-6);
  } finally {
    for (const p of parts) {
      p.mesh.geometry.dispose();
      p.mesh.material.dispose();
    }
  }
});
