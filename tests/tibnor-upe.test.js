import test from 'node:test';
import assert from 'node:assert/strict';
import { TIBNOR_PROFILES } from '../src/tibnor-catalog.js';
import { evaluateSection, profileSnapshot, validateContours } from '../src/section-profile.js';
import { schematicProfileLoops, profileDisplayObject } from '../src/profile-detail.js';
import { createSnapGeometryContext, displayGeometry } from '../src/model-object.js';
import { partKey } from '../src/part-marks.js';
import { libraryGroups } from '../src/profile-tree.js';
import { validatePlate } from '../src/plate.js';

const profiles = TIBNOR_PROFILES.filter((p) => p.family === 'UPE');
test('all 14 UPE sizes match table 003 including asymmetric centroid and both elastic section moduli', () => {
  assert.deepEqual(
    profiles.map((p) => p.name),
    [80, 100, 120, 140, 160, 180, 200, 220, 240, 270, 300, 330, 360, 400].map(
      (size) => 'UPE ' + size,
    ),
  );
  for (const definition of profiles) {
    const { properties: p } = evaluateSection(definition);
    const c = definition.catalog;
    assert.ok(Math.abs(p.cy) < 1e-8);
    assert.ok(Math.abs(p.cx - c.cx) < 0.1, definition.name + ' centroid');
    for (const key of ['A', 'WyPlus', 'WyMinus'])
      assert.ok(Math.abs(p[key] / c[key] - 1) < 0.01, definition.name + ' ' + key);
    // UPE moments are printed as whole cm4, so rounding alone can exceed 1%
    // for the smallest weak-axis value (25 cm4).
    for (const key of ['Ix', 'Iy'])
      assert.ok(
        Math.abs(p[key] - c[key]) < Math.max(c[key] * 0.01, 0.5 * 1e4),
        definition.name + ' ' + key,
      );
    assert.equal(c.Wy, c.WyPlus); // Conservative extreme fibre on the open side.
  }
  const snapshot = profileSnapshot(profiles.find((p) => p.name === 'UPE 200'));
  assert.deepEqual({ ...snapshot.parameters }, { B: 80, H: 200, tw: 6, tf: 11, R1: 13, R2: 3 });
  assert.equal(snapshot.catalog.cx, 25.6 - 40);
  assert.equal(snapshot.catalog.WyMinus, 73200);
  assert.equal(snapshot.catalog.WyPlus, 34400);
  assert.equal(snapshot.catalog.J, 94300);
});

test('UPE uses one contour with inner and outer radii, sharp snap corners and independent display modes', () => {
  const section = profileSnapshot(profiles.find((p) => p.name === 'UPE 200'));
  const object = {
    id: 'upe',
    type: 'sweep',
    profile: 'custom',
    section,
    width: 80,
    height: 200,
    thickness: 11,
    rotation: 0,
    start: [0, 0, 0],
    end: [1000, 0, 0],
  };
  const key = partKey(object, [object]),
    before = JSON.stringify(object);
  assert.deepEqual(section.contourDefinition.radiusParameters, ['R1', 'R2']);
  assert.equal(section.schematicLoops, undefined);
  assert.equal(section.loops[0].length, 32);
  assert.equal(schematicProfileLoops(section)[0].length, 8);
  assert.ok(section.loops[0].some(([x, y]) => Math.abs(x + 37) < 1e-8 && Math.abs(y + 100) < 1e-8));
  const schematic = profileDisplayObject(object);
  assert.ok(schematic.section.loops[0].some(([x, y]) => x === -40 && y === -100));
  const snap = createSnapGeometryContext([object]);
  assert.equal(snap.objectCorners(object).length, 16);
  const exact = displayGeometry(object, [object], 'exact'),
    sharp = displayGeometry(object, [object]);
  assert.ok(exact.attributes.position.count > sharp.attributes.position.count);
  assert.deepEqual(
    snap.objectCorners(object),
    createSnapGeometryContext([object], { profileDetail: 'exact' }).objectCorners(object),
  );
  assert.equal(partKey(object, [object]), key);
  assert.equal(JSON.stringify(object), before);
  exact.dispose();
  sharp.dispose();
  const tree = libraryGroups(TIBNOR_PROFILES, 'upe200');
  assert.equal(tree[0].label, 'Balkar');
  assert.equal(tree[0].families[0].label, 'UPE');
  assert.equal(tree[0].families[0].sizes.length, 1);
});

test('UPE radii are editable and validated; fine arc segments do not weaken plate validation', () => {
  const definition = structuredClone(profiles[0]);
  definition.parameters.find((p) => p.name === 'R1').value = 0;
  definition.parameters.find((p) => p.name === 'R2').value = 0;
  assert.equal(evaluateSection(definition).loops[0].length, 8);
  definition.parameters.find((p) => p.name === 'R2').value = 5;
  assert.throws(() => evaluateSection(definition), /radier måste rymmas/);
  definition.parameters.find((p) => p.name === 'R2').value = 2;
  definition.parameters.find((p) => p.name === 'R1').value = 40;
  assert.throws(() => evaluateSection(definition), /radier måste rymmas/);
  const polygon = [
    [0, 0],
    [0.5, 0],
    [2, 0],
    [2, 2],
    [0, 2],
  ];
  assert.doesNotThrow(() => validateContours([polygon]));
  assert.match(
    validatePlate({
      frame: { origin: [0, 0, 0], u: [1, 0, 0], v: [0, 1, 0] },
      polygon,
      thickness: 1,
      side: 'center',
    }),
    /minst 1 mm/,
  );
  assert.throws(
    () =>
      validateContours([
        [
          [0, 0],
          [0, 0],
          [2, 0],
          [0, 2],
        ],
      ]),
    /intilliggande hörn/,
  );
});
