import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { objectGeometry } from '../src/model-object.js';
import { chainGeometry } from '../src/dimension-chain.js';
import {
  referenceCandidates,
  resolveReference,
  updateAnnotationReferences,
  gridReference,
  surfaceReference,
} from '../src/annotation-references.js';
const rectangle = [
  [0, 0],
  [100, 0],
  [100, 50],
  [0, 50],
];

test('references survive translation, resizing, vertex reordering and JSON roundtrip', () => {
  const initial = referenceCandidates(rectangle, 'beam');
  const item = JSON.parse(
    JSON.stringify({
      kind: 'horizontal',
      points: [initial[0], initial[1]],
      references: [initial[0].reference, initial[1].reference],
      line: [0, -20],
    }),
  );
  const next = referenceCandidates(
    rectangle.map(([x, y]) => [2 * x + 30, y + 40]).reverse(),
    'beam',
  );
  assert.deepEqual(
    updateAnnotationReferences(item, (ref) => resolveReference(ref, next)),
    [],
  );
  assert.deepEqual(item.points, [
    [30, 40],
    [230, 40],
  ]);
  assert.equal(chainGeometry(item).segments[0].length, 200);
});

test('deleted objects and changed topology retain last points and report broken references', () => {
  const points = referenceCandidates(rectangle, 'beam');
  const item = { points: [[100, 50]], references: [points[2].reference] };
  for (const candidates of [
    referenceCandidates(rectangle, 'other'),
    referenceCandidates(rectangle.slice(1), 'beam'),
    [],
  ]) {
    assert.deepEqual(
      updateAnnotationReferences(item, (ref) => resolveReference(ref, candidates)),
      [0],
    );
    assert.deepEqual(item.points, [[100, 50]]);
  }
});

test('leader surface attachment follows size and position, but refuses invalid attachment', () => {
  const initial = referenceCandidates(rectangle, 'beam');
  const ref = surfaceReference([50, 25], 'beam', initial);
  const candidates = referenceCandidates(
    rectangle.map(([x, y]) => [x * 2 + 10, y + 20]),
    'beam',
  );
  assert.deepEqual(resolveReference(ref, candidates), [110, 45]);
  const item = { points: [[50, 25]], references: [ref] };
  assert.deepEqual(
    updateAnnotationReferences(
      item,
      (r) => resolveReference(r, candidates),
      () => false,
    ),
    [0],
  );
  assert.deepEqual(item.points, [[50, 25]]);
});

test('grid intersection and single grid line follow coordinates and flag removed lines', () => {
  const grid = { x: [0, 100], y: [0, 200] };
  const intersection = gridReference([100, 200], grid);
  const line = gridReference([100, 30], grid);
  const next = { x: [10, 150], y: [0, 250] };
  assert.deepEqual(resolveReference(intersection, [], next), [150, 250]);
  assert.deepEqual(resolveReference(line, [], next), [150, 30]);
  assert.equal(resolveReference(line, [], { x: [0], y: [0, 200] }), null);
});

test('real sweep edge references follow length changes without depending on triangle ordering', () => {
  const sweep = {
    id: 'beam',
    profile: 'rect',
    width: 200,
    height: 300,
    thickness: 12,
    rotation: 0,
    start: [0, 0, 0],
    end: [3000, 0, 0],
  };
  function candidates(object) {
    const geometry = objectGeometry(object, [object]);
    const edges = new THREE.EdgesGeometry(geometry, 5),
      pos = edges.attributes.position,
      points = [];
    for (let i = 0; i < pos.count; i++) points.push([pos.getX(i), pos.getY(i)]);
    edges.dispose();
    geometry.dispose();
    return referenceCandidates(points, object.id);
  }
  const before = candidates(sweep);
  const end = before.find((p) => p[0] === 3000);
  assert.ok(end);
  const after = candidates({ ...sweep, end: [4500, 0, 0] });
  assert.deepEqual(resolveReference(end.reference, after), [4500, end[1]]);
});

test('unlinked legacy points stay unchanged; restored source resolves again', () => {
  const candidates = referenceCandidates(rectangle, 'part');
  const item = {
    points: [
      [100, 50],
      [25, 25],
    ],
    references: [candidates[2].reference, null],
  };
  assert.deepEqual(
    updateAnnotationReferences(item, (r) => resolveReference(r, [])),
    [0],
  );
  assert.deepEqual(
    updateAnnotationReferences(item, (r) => resolveReference(r, candidates)),
    [],
  );
  assert.deepEqual(item.points, [
    [100, 50],
    [25, 25],
  ]);
});

test('local corner identity follows rotation of the projected view', () => {
  const local = [
    [0, 0, 0],
    [100, 0, 0],
    [100, 50, 0],
    [0, 50, 0],
  ];
  const before = referenceCandidates(rectangle, 'beam', local);
  const after = referenceCandidates(
    rectangle.map(([x, y]) => [-y + 200, x + 100]),
    'beam',
    local,
  );
  assert.deepEqual(resolveReference(before[1].reference, after), [200, 200]);
});

test('free dimension direction follows its referenced endpoints after rotation', () => {
  const item = {
    kind: 'free',
    axis: [1, 0],
    points: [
      [0, 0],
      [100, 0],
    ],
    line: [0, 20],
    references: [0, 1].map((index) => ({ index })),
  };
  assert.deepEqual(
    updateAnnotationReferences(
      item,
      (ref) =>
        [
          [0, 0],
          [0, 100],
        ][ref.index],
    ),
    [],
  );
  assert.equal(chainGeometry(item).segments[0].length, 100);
  assert.deepEqual(item.axis, [0, 1]);
});
