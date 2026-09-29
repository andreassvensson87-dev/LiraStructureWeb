import test from 'node:test';
import assert from 'node:assert/strict';
import {
  expression,
  parameterValues,
  evaluateSection,
  sectionProperties,
  validateContours,
  profileSnapshot,
  validateLibrary,
  mergeLibrary,
} from '../src/section-profile.js';
import { sweepGeometry, sweepCorners, validateSweep, profileAnchor } from '../src/sweep.js';
const rect = (w, h, x = 0, y = 0) => [
  [x, y],
  [x + w, y],
  [x + w, y + h],
  [x, y + h],
];
const definition = () => ({
  id: 'test-profile',
  revision: 1,
  name: 'Test',
  parameters: [
    { name: 'B', value: 200 },
    { name: 'H', value: 'B*1.5' },
  ],
  loops: [
    {
      id: 'outer',
      vertices: [
        ['0', '0'],
        ['B', '0'],
        ['B', 'H'],
        ['0', 'H'],
      ].map(([x, y], i) => ({ id: String(i), x, y })),
    },
  ],
  anchor: ['B/2', 'H/2'],
  density: 7850,
  catalog: { A: 60100 },
});
const near = (a, b) =>
  assert.ok(Math.abs(a - b) < Math.max(1e-6, Math.abs(b) * 1e-8), `${a} != ${b}`);
test('arithmetic expressions and dependent parameters; rejects code and cycles', () => {
  near(expression('-(2+3)*4 + 1,5e2 / 2'), 55);
  assert.equal(
    parameterValues([
      { name: 'H', value: 'B*2' },
      { name: 'B', value: 50 },
    ]).H,
    100,
  );
  for (const e of ['Math.random()', '1/0', '1;2', '2**3', '']) assert.throws(() => expression(e));
  assert.throws(() =>
    parameterValues([
      { name: 'A', value: 'B' },
      { name: 'B', value: 'A' },
    ]),
  );
  assert.throws(() =>
    parameterValues([
      { name: 'A', value: 1 },
      { name: 'A', value: 2 },
    ]),
  );
});
test('rectangle properties use centroid axes and mm units', () => {
  const p = sectionProperties([rect(200, 300, 100, 50)]);
  near(p.A, 60000);
  near(p.cx, 200);
  near(p.cy, 200);
  near(p.Ix, (200 * 300 ** 3) / 12);
  near(p.Iy, (300 * 200 ** 3) / 12);
  near(p.Ixy, 0);
  near(p.WxPlus, (200 * 300 ** 2) / 6);
  near(p.massPerMeter, 471);
});
test('holes subtract area and moments regardless of winding', () => {
  const loops = [rect(200, 300), rect(180, 280, 10, 10)];
  validateContours(loops);
  const p = sectionProperties(loops);
  near(p.A, 9600);
  near(p.Ix, (200 * 300 ** 3 - 180 * 280 ** 3) / 12);
  near(p.Iy, (300 * 200 ** 3 - 280 * 180 ** 3) / 12);
  near(p.cx, 100);
  near(p.cy, 150);
  near(sectionProperties(loops.map((l) => l.toReversed())).A, p.A);
});
test('rejects invalid and intersecting contours', () => {
  for (const loops of [
    [
      [
        [0, 0],
        [100, 100],
        [0, 100],
        [100, 0],
      ],
    ],
    [rect(100, 100), rect(10, 10, 100, 50)],
    [rect(100, 100), rect(20, 20, 20, 20), rect(20, 20, 30, 30)],
    [rect(100, 100), rect(50, 50, 10, 10), rect(10, 10, 20, 20)],
  ])
    assert.throws(() => validateContours(loops));
});
test('snapshots are independent of future parameter and catalog edits', () => {
  const d = definition(),
    snap = profileSnapshot(d);
  d.parameters[0].value = 400;
  d.catalog.A = 9;
  near(snap.properties.A, 60000);
  near(snap.catalog.A, 60100);
  near(evaluateSection(d).properties.A, 240000);
  assert.deepEqual(snap.anchor, [100, 150]);
});
test('library roundtrip preserves expressions, merges revisions, rejects conflicts', () => {
  const d = definition(),
    loaded = validateLibrary(JSON.parse(JSON.stringify({ schema: 1, profiles: [d] })));
  assert.deepEqual(loaded, [d]);
  const next = { ...structuredClone(d), revision: 2, name: 'Test v2' };
  assert.equal(mergeLibrary(loaded, [next]).length, 2);
  assert.equal(mergeLibrary(loaded, [d]).length, 1);
  assert.throws(() => mergeLibrary(loaded, [{ ...d, name: 'conflict' }]));
  assert.throws(() => validateLibrary({ schema: 1, profiles: [d, d] }));
  assert.throws(() => validateLibrary({ schema: 2, profiles: [] }));
});
test('custom holed sweeps have correct volume and rotated snap corners', () => {
  const d = definition();
  d.loops.push({
    id: 'hole',
    vertices: rect(180, 280, 10, 10).map(([x, y], i) => ({ id: 'h' + i, x, y })),
  });
  const section = profileSnapshot(d);
  const s = {
    profile: 'custom',
    section,
    width: 200,
    height: 300,
    thickness: 10,
    rotation: 37,
    start: [100, 200, 300],
    end: [100, 200, 1300],
  };
  assert.equal(validateSweep(s), '');
  assert.deepEqual(profileAnchor(s), [100, 150]);
  const g = sweepGeometry(s),
    p = g.attributes.position;
  let volume = 0;
  for (let i = 0; i < p.count; i += 3) {
    const a = [p.getX(i), p.getY(i), p.getZ(i)],
      b = [p.getX(i + 1), p.getY(i + 1), p.getZ(i + 1)],
      c = [p.getX(i + 2), p.getY(i + 2), p.getZ(i + 2)];
    volume +=
      (a[0] * (b[1] * c[2] - b[2] * c[1]) +
        a[1] * (b[2] * c[0] - b[0] * c[2]) +
        a[2] * (b[0] * c[1] - b[1] * c[0])) /
      6;
  }
  assert.ok(Math.abs(volume - 9600000) < 20);
  const corners = sweepCorners(s);
  assert.equal(corners.length, 16);
  for (const a of corners) {
    let distance = Infinity;
    for (let i = 0; i < p.count; i++)
      distance = Math.min(
        distance,
        Math.hypot(a[0] - p.getX(i), a[1] - p.getY(i), a[2] - p.getZ(i)),
      );
    assert.ok(distance < 0.002);
  }
  g.dispose();
});
test('custom section participates in non-destructive polygon cutting', async () => {
  const { createGeometryContext } = await import('../src/model-object.js');
  const { objectGeometry, setModel: setGeometryModel } = createGeometryContext();
  const { planeFrame } = await import('../src/plate.js');
  const s = {
    id: 'section-beam',
    profile: 'custom',
    section: profileSnapshot(definition()),
    width: 200,
    height: 300,
    thickness: 10,
    rotation: 0,
    start: [0, 0, 0],
    end: [3000, 0, 0],
  };
  const cut = {
    id: 'cut',
    type: 'polygoncut',
    targets: [s.id],
    frame: planeFrame('XY', [[1000, -500, 0]]),
    polygon: [
      [0, 0],
      [1000, 0],
      [1000, 1000],
      [0, 1000],
    ],
    thickness: 1000,
    side: 'center',
  };
  const volume = () => {
    const g = objectGeometry(s),
      p = g.attributes.position;
    let sum = 0;
    for (let i = 0; i < p.count; i += 3) {
      const a = [p.getX(i), p.getY(i), p.getZ(i)],
        b = [p.getX(i + 1), p.getY(i + 1), p.getZ(i + 1)],
        c = [p.getX(i + 2), p.getY(i + 2), p.getZ(i + 2)];
      sum +=
        (a[0] * (b[1] * c[2] - b[2] * c[1]) +
          a[1] * (b[2] * c[0] - b[0] * c[2]) +
          a[2] * (b[0] * c[1] - b[1] * c[0])) /
        6;
    }
    g.dispose();
    return sum;
  };
  setGeometryModel([s, cut]);
  near(volume(), 120000000);
  setGeometryModel([s]);
  near(volume(), 180000000);
  setGeometryModel([]);
});
