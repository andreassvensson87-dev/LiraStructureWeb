import test from 'node:test';
import assert from 'node:assert/strict';
import {
  packDrawingProjection,
  unpackDrawingProjection,
  drawingProjectionBuffers,
} from '../src/drawing-projection-result.js';

test('worker result transfer preserves all coordinates, hidden edges and metadata exactly', () => {
  const original = {
    faces: [
      [
        [1 / 3, -200000.123456789],
        [0, 0],
        [Number.EPSILON, 4],
      ],
    ],
    edges: [
      {
        visible: [
          [
            [1 / 7, 2, 3],
            [4, 5, -0],
          ],
        ],
        hidden: [
          [
            [7, 8, 9],
            [10, 11, 12],
          ],
        ],
        referenceId: 'ifc',
        sourceId: undefined,
        showHidden: false,
        referenceSnap: true,
        dashed: false,
        color: '#abcd01',
      },
      { visible: [], hidden: [], overlay: true },
    ],
  };
  const packed = packDrawingProjection(original);
  const buffers = drawingProjectionBuffers(packed);
  const received = structuredClone(packed, { transfer: buffers });
  assert.ok(buffers.every((b) => b.byteLength === 0));
  assert.deepEqual(unpackDrawingProjection(received), original);
  assert.equal(original.faces[0][0][0], 1 / 3);
  assert.deepEqual(unpackDrawingProjection(packDrawingProjection({ faces: [], edges: [] })), {
    faces: [],
    edges: [],
  });
});
