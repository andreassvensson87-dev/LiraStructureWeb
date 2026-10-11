import test from 'node:test';
import assert from 'node:assert/strict';
import {
  snapFrame,
  intersection,
  transformFrameEntity,
  lengthPoint,
  attributeValue,
} from '../src/frame-model.js';
const entities = [
  {
    id: 'a',
    type: 'line',
    points: [
      [0, 0],
      [100, 0],
    ],
  },
  {
    id: 'b',
    type: 'line',
    points: [
      [20, -30],
      [20, 40],
    ],
  },
];
test('frame snaps to endpoints, midpoints, intersections and perpendicular feet', () => {
  assert.deepEqual(snapFrame([0.2, 0.1], { entities }).point, [0, 0]);
  assert.equal(snapFrame([50, 0.2], { entities }).kind, 'Mittpunkt');
  assert.equal(snapFrame([20, 0.2], { entities }).kind, 'Korsning');
  assert.deepEqual(snapFrame([36, 0.1], { entities, base: [36, 30] }).point, [36, 0]);
});
test('frame ortho stays on axis and free points do not round without grid', () => {
  assert.deepEqual(snapFrame([14.2, 12.3], { entities: [], polar: 0 }).point, [14.2, 12.3]);
  const p = snapFrame([30, 4], { entities: [], base: [0, 0], ortho: true }).point;
  assert.deepEqual(p, [30, 0]);
  assert.deepEqual(snapFrame([14.2, 12.3], { entities: [], grid: true, step: 5 }).point, [15, 10]);
});
test('exact frame lengths and rigid transformations preserve entities', () => {
  assert.deepEqual(lengthPoint([0, 0], [3, 4], '10'), [6, 8]);
  assert.throws(() => lengthPoint([0, 0], [0, 0], '10'));
  const turned = transformFrameEntity(entities[0], [0, 0], [10, 20], 90);
  assert.ok(Math.abs(turned.points[1][0] - 10) < 1e-9);
  assert.equal(turned.points[1][1], 120);
  assert.deepEqual(entities[0].points[1], [100, 0]);
  const text = transformFrameEntity(
    { type: 'text', point: [10, 0], angle: 30 },
    [0, 0],
    [0, 0],
    90,
  );
  assert.equal(text.angle, 120);
});
test('attribute text resolves fresh drawing information and missing values stay blank', () => {
  assert.equal(attributeValue('drawing.name', { drawing: { name: 'Ny titel' } }), 'Ny titel');
  assert.equal(attributeValue('project.client', {}), '');
  assert.equal(attributeValue('custom.designer', { custom: { designer: 'AS' } }), 'AS');
});

test('work area corners and midpoints take priority over its edges', () => {
  const options = { entities: [], bounds: [420, 297] };
  assert.deepEqual(snapFrame([419.5, 296.5], options).point, [420, 297]);
  assert.equal(snapFrame([209.9, 0.2], options).kind, 'Mittpunkt');
  const edge = snapFrame([0.4, 83.25], options);
  assert.equal(edge.kind, 'Arbetsytans kant');
  assert.deepEqual(edge.point, [0, 83.25]);
  assert.deepEqual(snapFrame([419.5, 296.5], { entities: [] }).point, [419.5, 296.5]);
});
test('boundary snap preserves ortho and polar direction and respects finite edges', () => {
  const options = { entities: [], bounds: [420, 297], base: [100, 100] };
  assert.deepEqual(snapFrame([419, 100.4], { ...options, ortho: true }).point, [420, 100]);
  const p = snapFrame([296.5, 296.5], { ...options, polar: 45 }).point;
  assert.ok(Math.abs(p[0] - 297) < 1e-9);
  assert.equal(p[1], 297);
  assert.equal(snapFrame([-0.5, 310], { entities: [], bounds: [420, 297] }).kind, 'Fritt');
});

test('local crossing search matches exhaustive finite-segment snap, including ortho and duplicates', () => {
  let seed = 457;
  const random = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
  const lines = Array.from({ length: 80 }, () => ({
    type: 'line',
    points: Array.from({ length: 2 }, () => [
      Math.floor(random() * 200) - 100,
      Math.floor(random() * 200) - 100,
    ]),
  }));
  lines.push(
    {
      type: 'line',
      points: [
        [-10000, 0],
        [10000, 0],
      ],
    },
    {
      type: 'line',
      points: [
        [0, -10000],
        [0, 10000],
      ],
    },
    {
      type: 'line',
      points: [
        [0, 0],
        [0, 0],
      ],
    },
    ...lines.slice(0, 10),
  );
  for (let trial = 0; trial < 200; trial++) {
    const raw = [random() * 300 - 150, random() * 300 - 150],
      tolerance = 0.5 + random() * 40,
      base = [0, 0],
      ortho = trial % 3 === 0;
    let expected = null,
      best = tolerance;
    for (let i = 0; i < lines.length; i++)
      for (let j = i + 1; j < lines.length; j++) {
        const point = intersection(...lines[i].points, ...lines[j].points);
        if (!point || (ortho && Math.min(Math.abs(point[0]), Math.abs(point[1])) > 1e-7)) continue;
        const d = Math.hypot(raw[0] - point[0], raw[1] - point[1]);
        if (d < best) {
          expected = point;
          best = d;
        }
      }
    const hit = snapFrame(raw, {
      entities: lines,
      tolerance,
      base,
      ortho,
      endpoints: false,
      midpoints: false,
      perpendicular: false,
    });
    assert.equal(hit.kind === 'Korsning', !!expected);
    if (expected)
      assert.ok(Math.hypot(hit.point[0] - expected[0], hit.point[1] - expected[1]) < 1e-8);
  }
});
test('crossing snap retains pair tie order, endpoint precedence and finite extents', () => {
  const lines = [
    [
      [-1, -10],
      [-1, 10],
    ],
    [
      [1, -10],
      [1, 10],
    ],
    [
      [-10, 0],
      [10, 0],
    ],
  ].map((points) => ({ type: 'line', points }));
  const options = {
    entities: lines,
    tolerance: 2,
    endpoints: false,
    midpoints: false,
    perpendicular: false,
  };
  assert.deepEqual(snapFrame([0, 0], options), { kind: 'Korsning', point: [-1, 0] });
  assert.equal(snapFrame([0, 0], { ...options, intersections: false }).kind, 'Fritt');
  assert.equal(snapFrame([0, 12], options).kind, 'Fritt');
  assert.equal(snapFrame([-1, 10], { ...options, endpoints: true }).kind, 'Ändpunkt');
});
