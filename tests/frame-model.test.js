import test from 'node:test';
import assert from 'node:assert/strict';
import {
  snapFrame,
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
