import test from 'node:test';
import assert from 'node:assert/strict';
import { planeFrame } from '../src/plate.js';
import { createGeometryContext, geometryForModel } from '../src/model-object.js';
const { objectGeometry, setModel: setGeometryModel } = createGeometryContext();
test('preview geometry never changes the active models cut context', () => {
  const s = {
      id: 's',
      profile: 'rect',
      width: 200,
      height: 300,
      thickness: 12,
      rotation: 0,
      start: [0, 0, 0],
      end: [3000, 0, 0],
    },
    cut = {
      id: 'l',
      type: 'linecut',
      targets: ['s'],
      frame: planeFrame('XY', [[1000, -1000, 0]]),
      polygon: [
        [0, 0],
        [0, 2000],
      ],
      side: 'positive',
    };
  setGeometryModel([s]);
  const before = objectGeometry(s),
    preview = geometryForModel(s, [s, cut]),
    after = objectGeometry(s);
  for (const g of [before, preview, after]) g.computeBoundingBox();
  assert.deepEqual(after.boundingBox, before.boundingBox);
  assert.notDeepEqual(preview.boundingBox, before.boundingBox);
  for (const g of [before, preview, after]) g.dispose();
  setGeometryModel([]);
});
