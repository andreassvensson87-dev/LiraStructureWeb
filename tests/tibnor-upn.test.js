import test from 'node:test';
import assert from 'node:assert/strict';
import { TIBNOR_PROFILES } from '../src/tibnor-catalog.js';
import { evaluateSection, profileSnapshot } from '../src/section-profile.js';
import { schematicProfileLoops } from '../src/profile-detail.js';
import { createSnapGeometryContext, displayGeometry } from '../src/model-object.js';
import { libraryGroups } from '../src/profile-tree.js';
const profiles = TIBNOR_PROFILES.filter((p) => p.family === 'U/UPN');

test('all 23 U/UPN rows agree with table 002, retaining its dimensions, radii and centroid', () => {
  assert.deepEqual(
    profiles.map((p) => p.name),
    [
      '30',
      '40x20',
      '40',
      '50x25',
      '50',
      '60',
      '65',
      '80',
      '100',
      '120',
      '140',
      '160',
      '180',
      '200',
      '220',
      '240',
      '260',
      '280',
      '300',
      '320',
      '350',
      '380',
      '400',
    ].map((s) => 'U ' + s),
  );
  for (const def of profiles) {
    const { properties: p } = evaluateSection(def);
    for (const key of ['A', 'Ix', 'Iy'])
      assert.ok(Math.abs(p[key] / def.catalog[key] - 1) < 0.01, def.name + ' ' + key);
    assert.ok(Math.abs(p.WxPlus / def.catalog.Wx - 1) < 0.01, def.name + ' Wx');
    assert.ok(Math.abs(p.WyPlus / def.catalog.Wy - 1) < 0.01, def.name + ' Wy');
    // U400's rounded tabulated centroid differs by 0.26 mm from this contour.
    assert.ok(Math.abs(p.cx - def.catalog.cx) < 0.3, def.name + ' centroid');
    assert.ok(Math.abs(p.cy) < 1e-8);
    assert.equal(def.flangeSlope, p.bounds.height <= 300 ? 8 : 5);
  }
  const p = profileSnapshot(profiles.find((p) => p.name === 'U 300'));
  assert.deepEqual({ ...p.parameters }, { B: 100, H: 300, tw: 10, tf: 16, Rk: 16, Rf: 8.5 });
  assert.equal(p.catalog.J, 374000);
  assert.equal(profiles.find((p) => p.name === 'U 320').flangeThicknessReference, '(B-tw)/2');
  assert.equal(
    libraryGroups(TIBNOR_PROFILES, 'upn200')[0].families[0].sizes[0].latest.name,
    'U 200',
  );
});

test('tapered channels share one contour and keep flange slope but zero radii for display and snaps', () => {
  const section = profileSnapshot(profiles.find((p) => p.name === 'U 200'));
  assert.deepEqual(section.contourDefinition.radiusParameters, ['Rk', 'Rf']);
  assert.equal(section.schematicLoops, undefined);
  const sharp = schematicProfileLoops(section)[0];
  assert.equal(sharp.length, 8);
  assert.ok(sharp.some(([x, y]) => Math.abs(x + 29) < 1e-8 && Math.abs(y + 86.18) < 1e-8));
  assert.ok(section.loops[0].length > sharp.length);
  const object = {
    id: 'upn',
    type: 'sweep',
    profile: 'custom',
    section,
    width: 75,
    height: 200,
    thickness: 11.5,
    rotation: 0,
    start: [0, 0, 0],
    end: [1000, 0, 0],
  };
  const before = JSON.stringify(object);
  const context = createSnapGeometryContext([object]);
  assert.equal(context.objectCorners(object).length, 16);
  assert.deepEqual(
    context.objectCorners(object),
    createSnapGeometryContext([object], { profileDetail: 'exact' }).objectCorners(object),
  );
  const exact = displayGeometry(object, [object], 'exact'),
    schematic = displayGeometry(object, [object]);
  assert.ok(exact.attributes.position.count > schematic.attributes.position.count);
  assert.equal(JSON.stringify(object), before);
  exact.dispose();
  schematic.dispose();
});

test('tapered radii respond to dimension edits and reject overlapping fillets and thin flange tips', () => {
  const p = structuredClone(profiles.find((p) => p.name === 'U 200'));
  const set = (name, value) => (p.parameters.find((v) => v.name === name).value = value);
  set('Rk', 0);
  set('Rf', 0);
  assert.equal(evaluateSection(p).loops[0].length, 8);
  set('Rk', 70);
  assert.throws(() => evaluateSection(p), /radier måste rymmas/);
  set('Rk', 11.5);
  set('Rf', 6);
  set('tf', 7);
  assert.throws(() => evaluateSection(p), /radier måste rymmas/);
  set('tf', 11.5);
  set('B', 80);
  assert.equal(evaluateSection(p).properties.bounds.width, 80);
});
