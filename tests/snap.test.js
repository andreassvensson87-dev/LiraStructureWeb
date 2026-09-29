import { sweepCorners } from '../src/sweep.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { resolveSnap } from '../src/snap.js';
const camera = new THREE.OrthographicCamera(-6000, 6000, 6000, -6000, 1, 100000);
camera.up.set(0, 0, 1);
camera.position.set(10000, -14000, 12000);
camera.lookAt(0, 0, 0);
camera.updateMatrixWorld();
function run(target, options = {}) {
  const c = options.camera || camera,
    p = new THREE.Vector3(...target).project(c);
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(new THREE.Vector2(p.x, p.y), c);
  return resolveSnap({
    pointer: [(p.x + 1) * 500, (1 - p.y) * 500],
    camera: c,
    width: 1000,
    height: 1000,
    ray: raycaster.ray,
    start: [0, 0, 0],
    z: 0,
    sweeps: [],
    grid: { x: [], y: [] },
    ...options,
    sweeps: (options.sweeps || []).map((s) => ({
      profile: 'rect',
      width: 200,
      height: 300,
      thickness: 12,
      rotation: 0,
      ...s,
    })),
  });
}
test('automatic X Y Z tracking creates exact world axes', () => {
  for (const point of [
    [2500, 0, 0],
    [0, -2500, 0],
    [0, 0, 2500],
  ]) {
    assert.ok(Math.hypot(...run(point).point.map((v, i) => v - point[i])) < 1e-8);
    assert.equal(run(point).kind, 'direction');
  }
});
test('polar 45 degrees maintains equal components', () => {
  const result = run([2200, 2200, 0]);
  assert.match(result.label, /Polar 45/);
  assert.ok(Math.abs(result.point[0] - result.point[1]) < 1e-8);
});
test('endpoint keeps its exact elevation and wins over tracking', () => {
  const end = [1234, 2345, 3456];
  assert.deepEqual(run(end, { sweeps: [{ start: [0, 0, 0], end }] }).point, end);
});
test('explicit axis lock cannot be overridden by off-axis endpoint', () => {
  const end = [2000, 400, 500];
  const r = run(end, { lock: 'X', sweeps: [{ start: [0, 0, 0], end }] });
  assert.equal(r.point[1], 0);
  assert.equal(r.point[2], 0);
  assert.match(r.label, /X låst/);
});
test('Z lock viewed end-on refuses ambiguous mouse height', () => {
  const top = camera.clone();
  top.position.set(0, 0, 10000);
  top.up.set(0, 1, 0);
  top.lookAt(0, 0, 0);
  top.updateMatrixWorld();
  assert.equal(run([1000, 1000, 0], { camera: top, lock: 'Z' }).point, null);
});
test('disabled tracking leaves point on working plane', () => {
  const r = run([2100, 2100, 0], { axisSnap: false, polar: 0 });
  assert.equal(r.kind, 'free');
  assert.deepEqual(r.point, [2100, 2100, 0]);
});

test('nearest corner wins over nearby center endpoint', () => {
  const s = {
    profile: 'rect',
    width: 200,
    height: 300,
    rotation: 37,
    thickness: 12,
    start: [321, 456, 789],
    end: [2321, 3456, 5789],
  };
  const target = sweepCorners(s)[0];
  const result = run(target, { sweeps: [s] });
  assert.equal(result.label, 'Hörn');
  assert.deepEqual(result.point, target);
  assert.notEqual(run(target, { sweeps: [s], endpoints: false }).label, 'Hörn');
});
test('corner snapping respects explicit axis lock', () => {
  const s = {
    profile: 'rect',
    width: 200,
    height: 300,
    rotation: 0,
    thickness: 12,
    start: [0, 0, 0],
    end: [3000, 0, 0],
  };
  const result = run(sweepCorners(s)[4], { sweeps: [s], lock: 'X' });
  assert.equal(result.point[1], 0);
  assert.equal(result.point[2], 0);
});

const structuralGrid = { x: [0, 3150, 6300], y: [0, 4150, 8300] };
test('line snap uses exact position along finite line, including elevated workplane', () => {
  const r = run([3150, 1234.5, 0], { start: null, z: 750, grid: structuralGrid });
  assert.match(r.label, /Stomlinje 2/);
  assert.ok(Math.hypot(...r.point.map((v, i) => v - [3150, 1234.5, 0][i])) < 1e-7);
  assert.deepEqual(r.gridIds, ['x:1']);
});
test('grid intersections outrank lines and provide both highlight IDs', () => {
  const r = run([3150, 4150, 0], { start: null, grid: structuralGrid });
  assert.deepEqual(r.point, [3150, 4150, 0]);
  assert.deepEqual(r.gridIds, ['x:1', 'y:1']);
});
test('explicit X lock intersects grid without rounding or leaving the axis', () => {
  const r = run([3150, 1220, 0], { start: [1000, 1234, 0], z: 0, lock: 'X', grid: structuralGrid });
  assert.deepEqual(r.point, [3150, 1234, 0]);
  assert.match(r.label, /X låst/);
});
test('polar tracking intersects grid exactly and preserves angle', () => {
  const r = run([3150, 3150, 0], { grid: structuralGrid });
  assert.match(r.label, /Polar 45/);
  assert.ok(Math.abs(r.point[0] - 3150) < 1e-7);
  assert.ok(Math.abs(r.point[1] - 3150) < 1e-7);
});
test('line snapping does not extend beyond drawn extents', () => {
  const r = run([3150, 12000, 0], { start: null, grid: structuralGrid });
  assert.equal(r.kind, 'free');
});

test('grid snapping uses real ground XYZ despite elevated start and working plane', () => {
  const r = run([3150, 1700, 0], {
    start: [1000, 1000, 2500],
    z: 2500,
    grid: structuralGrid,
    axisSnap: false,
    polar: 0,
  });
  assert.match(r.label, /Stomlinje 2/);
  assert.ok(Math.abs(r.point[0] - 3150) < 1e-7);
  assert.ok(Math.abs(r.point[1] - 1700) < 1e-7);
  assert.equal(r.point[2], 0);
  const cross = run([3150, 4150, 0], { start: null, z: 2500, grid: structuralGrid });
  assert.deepEqual(cross.point, [3150, 4150, 0]);
});
test('automatic parallel tracking does not block a grid line, explicit lock remains binding', () => {
  const top = camera.clone();
  top.position.set(0, 0, 10000);
  top.up.set(0, 1, 0);
  top.lookAt(0, 0, 0);
  top.updateMatrixWorld();
  const options = { camera: top, start: [3070, 0, 0], grid: structuralGrid };
  assert.match(run([3150, 2000, 0], options).label, /Stomlinje 2/);
  assert.equal(run([3150, 2000, 0], { ...options, lock: 'Y' }).point[0], 3070);
});

test('horizontal locks cannot snap to another elevation; vertical lock can meet a grid line', () => {
  const r = run([3150, 1700, 0], {
    start: [1000, 1700, 2500],
    z: 2500,
    lock: 'X',
    grid: structuralGrid,
  });
  assert.equal(r.point[2], 2500);
  assert.equal(r.gridIds, undefined);
  const vertical = run([3150, 1700, 0], {
    start: [3150, 1700, 2500],
    z: 2500,
    lock: 'Z',
    grid: structuralGrid,
  });
  assert.ok(Math.hypot(...vertical.point.map((v, i) => v - [3150, 1700, 0][i])) < 1e-7);
  assert.deepEqual(vertical.gridIds, ['x:1']);
});
test('free placement and locked distances are continuous by default; optional grid rounds them', () => {
  const target = [1234.56, 2789.12, 0],
    off = { start: null, axisSnap: false, polar: 0 };
  assert.ok(Math.hypot(...run(target, off).point.map((v, i) => v - target[i])) < 1e-8);
  assert.deepEqual(
    run(target, { ...off, gridStepEnabled: true, gridStep: 50 }).point,
    [1250, 2800, 0],
  );
  const locked = run([1234.56, 0, 0], { lock: 'X' });
  assert.ok(Math.abs(locked.point[0] - 1234.56) < 1e-8);
  assert.equal(
    run([1234.56, 0, 0], { lock: 'X', gridStepEnabled: true, gridStep: 50 }).point[0],
    1250,
  );
});
test('object anchors, corners and quadrants can be switched independently', () => {
  const s = {
      profile: 'rect',
      width: 1000,
      height: 1000,
      thickness: 12,
      rotation: 0,
      start: [0, 0, 0],
      end: [3000, 0, 0],
    },
    point = sweepCorners(s)[4];
  assert.equal(run(point, { sweeps: [s], endpoints: false, cornerSnap: true }).label, 'Hörn');
  assert.notEqual(run(point, { sweeps: [s], endpoints: true, cornerSnap: false }).label, 'Hörn');
  assert.equal(run(s.end, { sweeps: [s], endpoints: true, cornerSnap: false }).label, 'Ändpunkt');
  const tube = { ...s, profile: 'chs' },
    q = sweepCorners(tube)[4];
  assert.equal(
    run(q, { sweeps: [tube], endpoints: false, cornerSnap: false, quadrantSnap: true }).label,
    'Kvadrant',
  );
  assert.notEqual(run(q, { sweeps: [tube], quadrantSnap: false }).label, 'Kvadrant');
});
test('structural lines and intersections have independent switches and exact points ignore grid rounding', () => {
  const options = { start: null, grid: structuralGrid, axisSnap: false, polar: 0 };
  assert.equal(
    run([3150, 4150, 0], { ...options, gridLines: false, gridIntersections: false }).kind,
    'free',
  );
  assert.equal(
    run([3150, 4150, 0], { ...options, gridLines: false, gridIntersections: true }).gridIds.length,
    2,
  );
  assert.equal(
    run([3150, 4150, 0], { ...options, gridLines: true, gridIntersections: false }).gridIds.length,
    1,
  );
  assert.deepEqual(
    run([3150, 4150, 0], { ...options, gridStepEnabled: true, gridStep: 1000 }).point,
    [3150, 4150, 0],
  );
});
test('optional grid respects the active workplane', () => {
  const frame = { origin: [100, 200, 500], u: [1, 0, 0], v: [0, 1, 0] },
    target = [1334.56, 2989.12, 500];
  const opts = { start: null, z: 500, workPlane: frame, axisSnap: false, polar: 0 };
  assert.ok(Math.hypot(...run(target, opts).point.map((v, i) => v - target[i])) < 1e-8);
  assert.deepEqual(
    run(target, { ...opts, gridStepEnabled: true, gridStep: 50 }).point,
    [1350, 3000, 500],
  );
});
test('midpoint snap finds sweep axis and edge centers independently of endpoint switch', () => {
  const s = { start: [0, 0, 0], end: [3000, 0, 0] },
    options = {
      sweeps: [s],
      endpoints: false,
      cornerSnap: false,
      midpointSnap: true,
      axisSnap: false,
      polar: 0,
    };
  const r = run([1500, 0, 0], options);
  assert.equal(r.label, 'Mittpunkt');
  assert.deepEqual(r.point, [1500, 0, 0]);
  assert.equal(r.symbol, 'midpoint');
  const edge = run([1500, -100, 150], options);
  assert.equal(edge.label, 'Mittpunkt');
  assert.deepEqual(edge.point, [1500, -100, 150]);
  assert.equal(run([1500, 0, 0], { ...options, midpointSnap: false }).kind, 'free');
});
test('perpendicular snap computes a finite-segment 3D foot from the start point', () => {
  const s = { start: [0, 0, 0], end: [3000, 0, 0] },
    options = {
      sweeps: [s],
      start: [1234, 1000, 0],
      endpoints: false,
      cornerSnap: false,
      perpendicularSnap: true,
      axisSnap: false,
      polar: 0,
    };
  const r = run([1234, 0, 0], options);
  assert.equal(r.label, 'Vinkelrät');
  assert.deepEqual(r.point, [1234, 0, 0]);
  assert.equal(r.symbol, 'perpendicular');
  assert.equal(run([1234, 0, 0], { ...options, perpendicularSnap: false }).kind, 'free');
  assert.equal(run([4000, 0, 0], { ...options, start: [4000, 1000, 0] }).kind, 'free');
  assert.equal(run([1234, 0, 0], { ...options, start: null }).kind, 'free');
  assert.notEqual(run([1234, 0, 0], { ...options, lock: 'X' }).label, 'Vinkelrät');
  assert.notEqual(
    run([1234, 0, 0], {
      ...options,
      workPlane: { origin: [0, 0, 500], u: [1, 0, 0], v: [0, 1, 0] },
    }).label,
    'Vinkelrät',
  );
});
test('new segment targets cache and round profiles expose axis without facet midpoints', async () => {
  const { objectSegments } = await import('../src/model-object.js');
  const s = {
    profile: 'chs',
    width: 200,
    height: 200,
    thickness: 12,
    rotation: 0,
    start: [0, 0, 0],
    end: [3000, 0, 0],
  };
  const segments = objectSegments(s);
  assert.equal(segments.length, 1);
  assert.equal(objectSegments(s), segments);
  const r = run([1500, 0, 0], {
    sweeps: [s],
    midpointSnap: true,
    endpoints: false,
    cornerSnap: false,
  });
  assert.equal(r.label, 'Mittpunkt');
});
test('elevated level grid intersections and grid lines use visible elevation', () => {
  const grid = { x: [0, 3000], y: [0, 4000], z: 3500 };
  assert.deepEqual(
    run([3000, 4000, 3500], { start: null, z: 3500, grid }).point,
    [3000, 4000, 3500],
  );
  const r = run([3000, 1800, 3500], { start: null, z: 3500, grid });
  assert.ok(Math.abs(r.point[2] - 3500) < 1e-7);
  assert.equal(r.point[0], 3000);
});
test('free drawing uses active level and explicit work plane overrides it', () => {
  assert.equal(run([1200, 1600, 3500], { start: null, z: 3500 }).point[2], 3500);
  const r = run([1200, 1600, 6000], {
    start: null,
    z: 3500,
    workPlane: { origin: [0, 0, 6000], u: [1, 0, 0], v: [0, 1, 0] },
  });
  assert.ok(Math.abs(r.point[2] - 6000) < 1e-7);
});

test('temporary drawing plane allows exact 3D endpoints and corners away from the plane', () => {
  const workPlane = { origin: [0, 0, 0], u: [1, 0, 0], v: [0, Math.SQRT1_2, Math.SQRT1_2] },
    s = {
      profile: 'rect',
      width: 200,
      height: 300,
      thickness: 12,
      rotation: 0,
      start: [500, 700, 900],
      end: [3200, 700, 900],
    };
  for (const target of [s.end, sweepCorners(s)[4]]) {
    const snap = run(target, { start: null, sweeps: [s], workPlane, constrainToPlane: false });
    assert.equal(snap.kind, 'point');
    assert.deepEqual(snap.point, target);
  }
  const strict = run(s.end, { start: null, sweeps: [s], workPlane });
  assert.equal(strict.kind, 'free');
});
test('free copy placement follows a parallel workplane through the picked base point', () => {
  const workPlane = { origin: [0, 0, 0], u: [1, 0, 0], v: [0, Math.SQRT1_2, Math.SQRT1_2] },
    start = [500, 700, 900],
    target = [2100, 1900, 2100];
  const snap = run(target, {
    start,
    workPlane,
    constrainToPlane: false,
    axisSnap: false,
    polar: 0,
  });
  assert.equal(snap.kind, 'free');
  assert.ok(Math.hypot(...snap.point.map((v, i) => v - target[i])) < 1e-7);
});
test('temporary plane does not filter visible structural intersections', () => {
  const workPlane = { origin: [0, 0, 1500], u: [1, 0, 0], v: [0, 1, 0] };
  const snap = run([3150, 4150, 0], {
    start: null,
    workPlane,
    constrainToPlane: false,
    grid: structuralGrid,
  });
  assert.deepEqual(snap.point, [3150, 4150, 0]);
  assert.deepEqual(snap.gridIds, ['x:1', 'y:1']);
});
