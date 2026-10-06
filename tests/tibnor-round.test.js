import test from 'node:test';
import assert from 'node:assert/strict';
import { TIBNOR_PROFILES } from '../src/tibnor-catalog.js';
import { evaluateSection, profileSnapshot } from '../src/section-profile.js';
import { profileDisplayObject, hasExactProfile } from '../src/profile-detail.js';
import { roundProfile, roundGeometryTemplate } from '../src/round-profile.js';
import { createSnapGeometryContext, displayGeometry } from '../src/model-object.js';
import { libraryGroups } from '../src/profile-tree.js';

const profiles = TIBNOR_PROFILES.filter((p) => p.profileType === 'chs');
const discrepancies = new Map([
  ['CHS 20x4:massPerMeter', 1.5],
  ['CHS 25x2:Ix', 9230],
  ['CHS 60.3x5:Ix', 355000],
  ['CHS 193.7x16:Ix', 25540000],
  ['CHS 193.7x17.5:A', 8990],
  ['CHS 559x16:Wx', 3800000],
  ['CHS 622x25:A', 36900],
]);

test('every circular tube has valid annular geometry and independently retained source properties', () => {
  assert.equal(profiles.length, 391);
  const found = new Set();
  for (const p of profiles) {
    const {
      properties: s,
      parameters: { D, t },
      loops,
    } = evaluateSection(p);
    assert.deepEqual(
      loops.map((l) => l.length),
      [96, 96],
    );
    const A = Math.PI * t * (D - t),
      I = (Math.PI / 64) * (D ** 4 - (D - 2 * t) ** 4),
      W = (2 * I) / D;
    for (const [key, value] of Object.entries({ A, Ix: I, Wx: W, massPerMeter: A * 0.00785 })) {
      const geometric = key === 'Wx' ? s.WxPlus : s[key];
      assert.ok(Math.abs(geometric / value - 1) < 0.002, p.name + ' geometry ' + key);
      const label = p.name + ':' + key;
      if (discrepancies.has(label)) {
        assert.equal(p.catalog[key], discrepancies.get(label), label);
        found.add(label);
      } else assert.ok(Math.abs(p.catalog[key] / value - 1) < 0.015, label);
    }
    assert.equal(p.catalog.Ix, p.catalog.Iy);
    assert.equal(p.catalog.Wx, p.catalog.Wy);
    assert.equal(s.bounds.width, D);
    assert.equal(s.bounds.height, D);
    const snapshot = profileSnapshot(p);
    assert.deepEqual(snapshot.catalog, p.catalog);
    assert.equal(snapshot.contourDefinition, undefined);
    assert.deepEqual(roundProfile({ profile: 'custom', section: snapshot }), {
      outer: D / 2,
      inner: D / 2 - t,
    });
  }
  assert.deepEqual(found, new Set(discrepancies.keys()));
});

test('round display modes share geometry, theoretical snaps and cached quick-tube meshes', () => {
  for (const name of ['KCKR 139.7x8', 'CHS 139.7x8']) {
    const section = profileSnapshot(profiles.find((p) => p.name === name));
    const object = {
      id: name,
      type: 'sweep',
      profile: 'custom',
      section,
      width: 139.7,
      height: 139.7,
      thickness: 8,
      rotation: 17,
      start: [0, 0, 0],
      end: [1000, 0, 0],
    };
    assert.equal(hasExactProfile(object), false);
    assert.equal(profileDisplayObject(object, 'schematic'), object);
    assert.equal(profileDisplayObject(object, 'exact'), object);
    const snaps = createSnapGeometryContext([object]).objectCorners(object);
    assert.equal(snaps.length, 16);
    assert.deepEqual(
      snaps,
      createSnapGeometryContext([object], { profileDetail: 'exact' }).objectCorners(object),
    );
    const exact = displayGeometry(object, [object], 'exact'),
      schematic = displayGeometry(object, [object]);
    assert.deepEqual(exact.attributes.position.array, schematic.attributes.position.array);
    exact.dispose();
    schematic.dispose();
    assert.equal(
      roundGeometryTemplate(roundProfile(object)),
      roundGeometryTemplate(roundProfile({ profile: 'chs', width: 139.7, thickness: 8 })),
    );
  }
});

test('manufacturing series remain distinct and Swedish diameter searches find the same record', () => {
  const welded = profiles.find((p) => p.name === 'KCKR 139.7x8'),
    seamless = profiles.find((p) => p.name === 'CHS 139.7x8');
  assert.notEqual(welded.id, seamless.id);
  assert.match(welded.standard, /10219/);
  assert.match(seamless.standard, /10210/);
  assert.equal(profiles.filter((p) => p.catalog.J !== undefined).length, 38);
  assert.equal(welded.catalog.J, 14410000);
  assert.equal(
    libraryGroups(TIBNOR_PROFILES, 'KCKR 139,7x8')[0].families[0].sizes[0].latest.id,
    welded.id,
  );
  const edited = structuredClone(seamless);
  edited.parameters.find((p) => p.name === 'D').value = 160;
  edited.parameters.find((p) => p.name === 't').value = 10;
  assert.equal(evaluateSection(edited).properties.bounds.width, 160);
  edited.parameters.find((p) => p.name === 't').value = 80;
  assert.throws(() => evaluateSection(edited), /Godstjockleken/);
});
