import test from 'node:test';
import assert from 'node:assert/strict';
import { offsetPlate } from '../src/plate-offset.js';
import { plateArea } from '../src/plate.js';
const plate = {
  type: 'plate',
  polygon: [
    [0, 0],
    [2000, 0],
    [2000, 3000],
    [0, 3000],
  ],
  frame: { origin: [0, 0, 3500], u: [1, 0, 0], v: [0, 0, 1] },
  thickness: 200,
  side: 'center',
};
test('offset preserves plane thickness and source with exact rectangle distances', () => {
  const result = offsetPlate(plate, 100);
  assert.deepEqual(result.polygon, [
    [-100, -100],
    [2100, -100],
    [2100, 3100],
    [-100, 3100],
  ]);
  assert.deepEqual(result.frame, plate.frame);
  assert.equal(result.thickness, 200);
  assert.equal(plate.polygon[0][0], 0);
  assert.equal(plateArea(offsetPlate(plate, -100)), 1800 * 2800);
});
test('clockwise and collinear contours offset outward', () => {
  assert.equal(
    plateArea(offsetPlate({ ...plate, polygon: [...plate.polygon].reverse() }, 100)),
    2200 * 3200,
  );
  assert.equal(
    plateArea(
      offsetPlate(
        {
          ...plate,
          polygon: [
            [0, 0],
            [1000, 0],
            [2000, 0],
            [2000, 3000],
            [0, 3000],
          ],
        },
        100,
      ),
    ),
    2200 * 3200,
  );
});
test('reject collapsed or inverted edges and invalid input', () => {
  for (const d of [-1000, -2000, NaN, Infinity]) assert.throws(() => offsetPlate(plate, d));
});
test('concave contour retains valid inset and rejects disappearing notch', () => {
  const p = {
    ...plate,
    polygon: [
      [0, 0],
      [3000, 0],
      [3000, 1000],
      [1000, 1000],
      [1000, 3000],
      [0, 3000],
    ],
  };
  assert.ok(plateArea(offsetPlate(p, 100)) > plateArea(p));
  assert.ok(plateArea(offsetPlate(p, -100)) < plateArea(p));
  assert.throws(() => offsetPlate(p, -600));
});
test('offset property keeps insertion points fixed while moving solid and corner snaps', async () => {
  const { plateVertices, plateCorners, plateGeometry, validatePlate } = await import(
    '../src/plate.js'
  );
  const source = { ...plate, contourOffset: 50 };
  assert.deepEqual(plateVertices(source), plateVertices(plate));
  assert.equal(plateArea(source), 2100 * 3100);
  assert.notDeepEqual(plateCorners(source), plateCorners(plate));
  const geometry = plateGeometry(source);
  geometry.computeBoundingBox();
  assert.equal(geometry.boundingBox.min.x, -50);
  geometry.dispose();
  assert.equal(validatePlate(source), '');
  assert.ok(validatePlate({ ...source, contourOffset: -2000 }));
  assert.deepEqual(plateCorners({ ...source, contourOffset: 0 }), plateCorners(plate));
  assert.deepEqual(source.polygon, plate.polygon);
});
