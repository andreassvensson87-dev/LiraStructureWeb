import test from 'node:test';
import assert from 'node:assert/strict';
import { TIBNOR_PROFILES } from '../src/tibnor-catalog.js';
import { evaluateSection, profileSnapshot, parameterValues } from '../src/section-profile.js';
import { schematicProfileLoops } from '../src/profile-detail.js';
import { createSnapGeometryContext, displayGeometry } from '../src/model-object.js';
import { partKey } from '../src/part-marks.js';
const profiles = TIBNOR_PROFILES.filter((p) => p.profileType === 'rhs');
const find = (name) => profiles.find((p) => p.name === name);
test('every VKR/KKR square and rectangular row reproduces the source area, moments and moduli', () => {
  assert.equal(profiles.length, 264);
  assert.equal(profiles.filter((p) => p.family.startsWith('VKR')).length, 142);
  assert.equal(profiles.filter((p) => p.family.startsWith('KKR')).length, 122);
  for (const def of profiles) {
    const { properties: s, loops } = evaluateSection(def);
    assert.equal(loops.length, 2);
    for (const key of ['A', 'Ix', 'Iy', 'massPerMeter'])
      assert.ok(Math.abs(s[key] / def.catalog[key] - 1) < 0.01, def.name + ' ' + key);
    for (const [key, calculated] of [
      ['Wx', 'WxPlus'],
      ['Wy', 'WyPlus'],
    ])
      assert.ok(Math.abs(s[calculated] / def.catalog[key] - 1) < 0.01, def.name + ' ' + key);
    assert.ok(Math.abs(s.cx) < 1e-8 && Math.abs(s.cy) < 1e-8, def.name);
  }
  assert.deepEqual(profileSnapshot(find('VKR 40x40x3')).catalog, {
    A: 434,
    massPerMeter: 3.41,
    Ix: 97800,
    Iy: 97800,
    Wx: 4890,
    Wy: 4890,
    J: 157000,
  });
  const p = profileSnapshot(find('KKR 200x100x8'));
  assert.deepEqual({ ...p.parameters }, { B: 100, H: 200, t: 8, Ro: 20, Ri: 12 });
  assert.equal(p.catalog.Ix, 20910000);
  assert.equal(p.catalog.Iy, 7050000);
  assert.equal(p.catalog.J, 18110000);
});
test('VKR and KKR use verified nominal corner rules at all thickness bands and scale parametrically', () => {
  for (const [name, Ro, Ri] of [
    ['VKR 200x200x6.3', 9.45, 6.3],
    ['VKR 400x400x16', 24, 16],
    ['KKR 100x100x6', 12, 6],
    ['KKR 100x100x8', 20, 12],
    ['KKR 200x200x10', 25, 15],
    ['KKR 200x200x12.5', 37.5, 25],
  ]) {
    const p = parameterValues(find(name).parameters);
    assert.ok(Math.abs(p.Ro - Ro) < 1e-9);
    assert.ok(Math.abs(p.Ri - Ri) < 1e-9);
  }
  const definition = structuredClone(find('VKR 40x40x3'));
  definition.parameters.find((p) => p.name === 't').value = 4;
  assert.deepEqual(
    { ...profileSnapshot(definition).parameters },
    { B: 40, H: 40, t: 4, Ro: 6, Ri: 4 },
  );
  assert.ok(Math.abs(evaluateSection(definition).properties.A - 559) < 2);
});
test('hollow sections preserve the physical hole and one contour definition with sharp display and snaps', () => {
  for (const name of ['VKR 200x100x8', 'KKR 200x100x8']) {
    const section = profileSnapshot(find(name)),
      loops = schematicProfileLoops(section);
    assert.deepEqual(section.contourDefinition.radiusParameters, ['Ro', 'Ri']);
    assert.equal(section.schematicLoops, undefined);
    assert.deepEqual(
      section.loops.map((l) => l.length),
      [28, 28],
    );
    assert.deepEqual(
      loops.map((l) => l.length),
      [4, 4],
    );
    assert.ok(loops[1].some(([x, y]) => Math.abs(x) === 42 && Math.abs(y) === 92));
    const object = {
      id: name,
      type: 'sweep',
      profile: 'custom',
      section,
      width: 100,
      height: 200,
      thickness: 8,
      rotation: 17,
      start: [0, 0, 0],
      end: [1000, 0, 0],
    };
    const before = JSON.stringify(object),
      key = partKey(object, [object]);
    const snap = createSnapGeometryContext([object]);
    assert.equal(snap.objectCorners(object).length, 16);
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
test('hollow radius validation rejects oversized corners, negative radii and holes outside the wall', () => {
  const p = structuredClone(find('KKR 200x100x8'));
  const set = (name, value) => (p.parameters.find((v) => v.name === name).value = value);
  set('Ro', 0);
  set('Ri', 0);
  assert.deepEqual(
    evaluateSection(p).loops.map((l) => l.length),
    [4, 4],
  );
  set('Ro', 51);
  assert.throws(() => evaluateSection(p), /Rörets radier/);
  set('Ro', 20);
  set('Ri', 43);
  assert.throws(() => evaluateSection(p), /Rörets radier/);
  set('Ro', 30);
  set('Ri', 0);
  assert.throws(() => evaluateSection(p), /Rörets radier/);
  set('Ro', 20);
  set('Ri', -1);
  assert.throws(() => evaluateSection(p), /Rörets radier/);
  set('Ri', 12);
  set('t', 50);
  assert.throws(() => evaluateSection(p), /Godstjockleken/);
});
