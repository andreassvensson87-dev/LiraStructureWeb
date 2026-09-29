import test from 'node:test';
import assert from 'node:assert/strict';
import { expandLayout, instancePoint, transformInstance } from '../src/frame-layout.js';
const block = {
  id: 'b',
  origin: [10, 20],
  entities: [
    {
      id: 'l',
      type: 'line',
      points: [
        [10, 20],
        [30, 20],
      ],
      stroke: 0.25,
    },
  ],
};
const layout = {
  width: 420,
  height: 297,
  entities: [
    { id: 'i', type: 'block', blockId: 'b', anchor: 'bottom-right', point: [-40, 10], angle: 0 },
  ],
};
test('layout references resolve live block geometry relative to insertion point', () => {
  assert.deepEqual(expandLayout(layout, [block])[0].points, [
    [380, 10],
    [400, 10],
  ]);
  const edited = {
    ...block,
    entities: [
      {
        ...block.entities[0],
        points: [
          [10, 20],
          [40, 20],
        ],
      },
    ],
  };
  assert.deepEqual(expandLayout(layout, [edited])[0].points, [
    [380, 10],
    [410, 10],
  ]);
  assert.equal(layout.entities[0].entities, undefined);
});
test('paper corner anchors preserve offsets when paper changes', () => {
  assert.deepEqual(instancePoint(layout.entities[0], { width: 594, height: 420 }), [554, 10]);
  assert.deepEqual(
    instancePoint({ ...layout.entities[0], anchor: 'top-right' }, { width: 594, height: 420 }),
    [554, 430],
  );
});
test('moving anchored instance retains its anchor and reference', () => {
  const moved = transformInstance(layout.entities[0], layout, [380, 10], [370, 25], 0);
  assert.deepEqual(moved.point, [-50, 25]);
  assert.equal(moved.blockId, 'b');
  assert.equal(moved.anchor, 'bottom-right');
  assert.deepEqual(layout.entities[0].point, [-40, 10]);
});
