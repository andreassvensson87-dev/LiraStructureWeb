import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { modelNearestFeedback } from '../src/model/nearest-feedback.js';
import { paintCadNearestEdge } from '../src/ui/cad-feedback.js';
const camera = new THREE.OrthographicCamera(-100, 100, 100, -100, 1, 10000);
camera.position.set(0, 0, 1000);
camera.lookAt(0, 0, 0);
camera.updateMatrixWorld();

test('model edge feedback clips the winning edge to the viewport and never mutates snap geometry', () => {
  const snap = {
    label: 'Närmaste',
    point: [0, 20, 0],
    snapEdge: {
      points: [
        [-500, 20, 0],
        [500, 20, 0],
      ],
    },
  };
  const before = structuredClone(snap);
  const result = modelNearestFeedback(snap, camera, 1000, 1000);
  assert.deepEqual(result.snapEdge.points, [
    [0, 400],
    [1000, 400],
  ]);
  assert.deepEqual(snap, before);
  assert.equal(modelNearestFeedback({ ...snap, label: 'Polar 45°' }, camera, 1000, 1000), null);
  assert.equal(modelNearestFeedback(null, camera, 1000, 1000), null);
  assert.equal(
    modelNearestFeedback(
      {
        ...snap,
        snapEdge: {
          points: [
            [200, 0, 0],
            [300, 0, 0],
          ],
        },
      },
      camera,
      1000,
      1000,
    ),
    null,
  );
});
test('shared edge painter follows supplied projection, supports curves and ignores non-Nearest results', (t) => {
  const old = globalThis.document;
  t.after(() => {
    globalThis.document = old;
  });
  globalThis.document = {
    createElementNS: () => ({
      attrs: {},
      setAttribute(key, value) {
        this.attrs[key] = value;
      },
    }),
  };
  const nodes = [],
    root = { append: (node) => nodes.push(node) };
  const edge = {
    points: [
      [10, 20],
      [50, 20],
    ],
  };
  paintCadNearestEdge(root, { kind: 'Närmaste', snapEdge: edge }, ([x, y]) => [2 * x, -2 * y]);
  assert.equal(nodes[0].attrs.d, 'M20,-40L100,-40');
  for (const kind of ['Otrack', 'Polar', 'Ändpunkt', 'Fritt'])
    assert.equal(paintCadNearestEdge(root, { kind, snapEdge: edge }), null);
  assert.equal(nodes.length, 1);
  const curve = paintCadNearestEdge(root, {
    kind: 'Närmaste',
    snapEdge: { center: [0, 0], radius: 10, start: 0, sweep: Math.PI },
  });
  assert.ok(curve.attrs.d.startsWith('M10,0L'));
  assert.equal(nodes.length, 2);
});
