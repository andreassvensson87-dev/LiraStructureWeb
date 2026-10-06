import test from 'node:test';
import assert from 'node:assert/strict';
import { TIBNOR_PROFILES } from '../src/tibnor-catalog.js';
import { evaluateSection, profileSnapshot } from '../src/section-profile.js';
import { schematicProfileLoops } from '../src/profile-detail.js';
import { createSnapGeometryContext, displayGeometry } from '../src/model-object.js';
import { partKey } from '../src/part-marks.js';
const angles = TIBNOR_PROFILES.filter((p) => p.profileType === 'l');
const find = (name) => angles.find((p) => p.name === name);
test('all 108 equal and unequal angles reproduce table 011 within recorded source precision', () => {
  assert.equal(angles.length, 108);
  assert.equal(angles.filter((p) => p.family === 'L liksidig').length, 59);
  assert.equal(angles.filter((p) => p.family === 'L oliksidig').length, 49);
  for (const def of angles) {
    const { properties: p } = evaluateSection(def);
    assert.ok(Math.abs(p.A / def.catalog.A - 1) < 0.015, def.name + ' A');
    for (const key of ['Ix', 'Iy'])
      assert.ok(
        Math.abs(p[key] - def.catalog[key]) < Math.max(def.catalog[key] * 0.035, 50),
        def.name + ' ' + key,
      );
    assert.ok(
      Math.abs(p.cx - def.catalog.cx) < 0.35 && Math.abs(p.cy - def.catalog.cy) < 0.35,
      def.name + ' centroid',
    );
    assert.ok(p.Ixy < 0, def.name + ' product moment');
    if (def.family === 'L liksidig') assert.ok(Math.abs(p.Ix - p.Iy) < 1e-7);
  }
  const p = profileSnapshot(find('L 100x65x8'));
  assert.deepEqual({ ...p.parameters }, { B: 65, H: 100, t: 8, Rk: 10, Rf: 5 });
  assert.deepEqual(p.catalog, {
    A: 1270,
    massPerMeter: 9.9,
    Ix: 1270000,
    Iy: 425000,
    Wx: 18900,
    Wy: 8580,
    cx: 15.5 - 32.5,
    cy: 32.8 - 50,
  });
});
test('source discrepancies stay explicit, nominal geometry is consistent and toe radii fit thin legs', () => {
  assert.deepEqual(find('L 25x25x4').sourceDimensionConflict, { H: 25, B: 25, t: 5 });
  assert.equal(profileSnapshot(find('L 25x25x4')).parameters.t, 4);
  assert.deepEqual(find('L 35x35x3').sourceDimensionConflict, { H: 36, B: 36, t: 3 });
  assert.equal(profileSnapshot(find('L 35x35x3')).parameters.H, 35);
  const p = profileSnapshot(find('L 50x50x3'));
  assert.equal(p.parameters.Rf, 3);
  assert.equal(p.catalog.massPerMeter, 2.45);
  assert.equal(find('L 80x40x8').catalog.Wy, 9680);
  assert.equal(find('L 150x75x11').catalog.massPerMeter, 15.3);
  assert.ok(p.loops[0].every(([x, y]) => x >= -25 && x <= 25 && y >= -25 && y <= 25));
});
test('angle display keeps one physical profile, six theoretical corners and independent exact mode', () => {
  for (const name of ['L 75x75x6', 'L 100x65x8', 'L 50x50x3']) {
    const section = profileSnapshot(find(name));
    assert.deepEqual(section.contourDefinition.radiusParameters, ['Rk', 'Rf']);
    assert.equal(section.schematicLoops, undefined);
    assert.equal(schematicProfileLoops(section)[0].length, 6);
    const object = {
      id: name,
      type: 'sweep',
      profile: 'custom',
      section,
      width: section.parameters.B,
      height: section.parameters.H,
      thickness: section.parameters.t,
      rotation: 23,
      start: [0, 0, 0],
      end: [1000, 0, 0],
    };
    const before = JSON.stringify(object),
      key = partKey(object, [object]);
    const snap = createSnapGeometryContext([object]);
    assert.equal(snap.objectCorners(object).length, 12);
    assert.deepEqual(
      snap.objectCorners(object),
      createSnapGeometryContext([object], { profileDetail: 'exact' }).objectCorners(object),
    );
    const exact = displayGeometry(object, [object], 'exact'),
      sharp = displayGeometry(object, [object]);
    assert.ok(exact.attributes.position.count > sharp.attributes.position.count);
    assert.equal(partKey(object, [object]), key);
    assert.equal(JSON.stringify(object), before);
    exact.dispose();
    sharp.dispose();
  }
});
test('angle dimension and radius edits remain parametric and invalid fillets are rejected', () => {
  const p = structuredClone(find('L 75x75x6'));
  const set = (name, value) => (p.parameters.find((v) => v.name === name).value = value);
  set('B', 90);
  assert.equal(evaluateSection(p).properties.bounds.width, 90);
  set('Rk', 0);
  set('Rf', 0);
  assert.equal(evaluateSection(p).loops[0].length, 6);
  set('Rk', 10);
  set('Rf', 7);
  assert.throws(() => evaluateSection(p), /radier måste rymmas/);
  set('Rf', 3);
  set('Rk', 70);
  assert.throws(() => evaluateSection(p), /radier måste rymmas/);
});
