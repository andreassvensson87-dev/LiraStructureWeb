import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { enclosedSweeps } from '../src/selection.js';
import { selectionGeometry } from '../src/model-object.js';
const camera = new THREE.OrthographicCamera(-1000, 1000, 1000, -1000, 1, 10000);
camera.up.set(0, 1, 0);
camera.position.set(0, 0, 5000);
camera.lookAt(0, 0, 0);
camera.updateMatrixWorld();
const s = {
  id: 'one',
  profile: 'rect',
  width: 200,
  height: 300,
  rotation: 0,
  thickness: 12,
  start: [-500, 0, 0],
  end: [500, 0, 0],
};
test('fully enclosed and disjoint objects are selected without cloning or projecting their triangles', () => {
  const source = { ...s, id: 'cached-selection' };
  const geometry = selectionGeometry(source, [source]);
  const attribute = geometry.attributes.position;
  const original = attribute.array,
    clone = geometry.clone;
  geometry.clone = () => {
    throw new Error('Selection must not clone geometry');
  };
  attribute.array = new Proxy(original, {
    get: (target, key) => {
      if (key === 'subarray') throw new Error('Broad phase must not project triangles');
      return Reflect.get(target, key, target);
    },
  });
  try {
    assert.deepEqual(
      enclosedSweeps([source], camera, 1000, 1000, { x: 0, y: 0 }, { x: 1000, y: 1000 }),
      [source.id],
    );
    assert.deepEqual(
      enclosedSweeps([source], camera, 1000, 1000, { x: 0, y: 0 }, { x: 100, y: 100 }),
      [],
    );
  } finally {
    attribute.array = original;
    geometry.clone = clone;
  }
});
test('window selection requires whole sweep and works in either drag direction', () => {
  const a = { x: 200, y: 400 },
    b = { x: 800, y: 600 };
  assert.deepEqual(enclosedSweeps([s], camera, 1000, 1000, a, b), ['one']);
  assert.deepEqual(enclosedSweeps([s], camera, 1000, 1000, b, a), ['one']);
  assert.deepEqual(enclosedSweeps([s], camera, 1000, 1000, a, { x: 600, y: 600 }), []);
});

test('partial overlap only selects with right-to-left crossing', () => {
  const a = { x: 450, y: 475 },
    b = { x: 550, y: 525 };
  assert.deepEqual(enclosedSweeps([s], camera, 1000, 1000, a, b), []);
  assert.deepEqual(enclosedSweeps([s], camera, 1000, 1000, b, a), ['one']);
});
test('crossing avoids empty space in diagonal sweep bounding box', () => {
  const diagonal = { ...s, start: [-500, -500, 0], end: [500, 500, 0], width: 50 };
  assert.deepEqual(
    enclosedSweeps([diagonal], camera, 1000, 1000, { x: 330, y: 330 }, { x: 270, y: 270 }),
    [],
  );
});
test('crossing does not select through the open center of an end-on hollow profile', () => {
  const hollow = {
    ...s,
    profile: 'rhs',
    width: 800,
    height: 800,
    thickness: 40,
    start: [0, 0, 0],
    end: [0, 0, 1000],
  };
  assert.deepEqual(
    enclosedSweeps([hollow], camera, 1000, 1000, { x: 520, y: 520 }, { x: 480, y: 480 }),
    [],
  );
  assert.deepEqual(
    enclosedSweeps([hollow], camera, 1000, 1000, { x: 710, y: 510 }, { x: 690, y: 490 }),
    ['one'],
  );
});
test('window contains the full rotated circle, not only its quadrant snap points', () => {
  const round = {
    ...s,
    profile: 'circle',
    width: 800,
    height: 800,
    rotation: 45,
    start: [0, 0, 0],
    end: [0, 0, 1000],
  };
  // The rotated quadrants fit in ±283 mm, but the circle extends to ±400 mm.
  const a = { x: 350, y: 350 },
    b = { x: 650, y: 650 };
  assert.deepEqual(enclosedSweeps([round], camera, 1000, 1000, a, b), []);
  assert.deepEqual(enclosedSweeps([round], camera, 1000, 1000, b, a), ['one']);
  assert.deepEqual(
    enclosedSweeps([round], camera, 1000, 1000, { x: 290, y: 290 }, { x: 710, y: 710 }),
    ['one'],
  );
});
test('crossing catches a thin edge touch and all overlapping objects', () => {
  const second = { ...s, id: 'two', start: [-500, 50, 0], end: [500, 50, 0] };
  assert.deepEqual(
    enclosedSweeps([s, second], camera, 1000, 1000, { x: 800, y: 530 }, { x: 749, y: 480 }),
    ['one', 'two'],
  );
  assert.deepEqual(
    enclosedSweeps([s, second], camera, 1000, 1000, { x: 749, y: 480 }, { x: 800, y: 530 }),
    [],
  );
});

test('bulk selection uses the simple body consistently before and after hole removal', () => {
  const plate = {
    id: 'drilled',
    type: 'plate',
    frame: { origin: [0, 0, 0], u: [1, 0, 0], v: [0, 1, 0] },
    polygon: [
      [-200, -200],
      [200, -200],
      [200, 200],
      [-200, 200],
    ],
    thickness: 20,
    side: 'positive',
  };
  const screw = {
    id: 'screw',
    type: 'fastener',
    spec: {
      kind: 'wood',
      length: 200,
      diameter: 20,
      head: { kind: 'cylinder', diameter: 30, height: 10 },
    },
    start: [0, 0, 100],
    end: [0, 0, -100],
    holes: [{ targetId: plate.id, kind: 'clearance', diameter: 100, offset: 80, depth: 20 }],
  };
  const a = { x: 510, y: 510 },
    b = { x: 490, y: 490 };
  assert.deepEqual(enclosedSweeps([plate], camera, 1000, 1000, a, b, [plate, screw]), [plate.id]);
  assert.deepEqual(
    enclosedSweeps([plate], camera, 1000, 1000, a, b, [plate, { ...screw, holes: [] }]),
    [plate.id],
  );
});
