import test from 'node:test';
import assert from 'node:assert/strict';
import { TIBNOR_PROFILES } from '../src/tibnor-catalog.js';
import { evaluateSection, profileSnapshot } from '../src/section-profile.js';
import { schematicProfileLoops } from '../src/profile-detail.js';
import { createSnapGeometryContext, displayGeometry } from '../src/model-object.js';
import { partKey } from '../src/part-marks.js';
import { roundedTeeTemplate } from '../src/section-templates.js';

const find = (name) => TIBNOR_PROFILES.find((p) => p.name === name);
test('all HEM rows retain actual heavy-beam dimensions, root radii and tabulated units', () => {
  const profiles = TIBNOR_PROFILES.filter((p) => p.family === 'HEM');
  assert.equal(profiles.length, 24);
  for (const definition of profiles) {
    const { properties: s } = evaluateSection(definition);
    for (const key of ['A', 'Ix', 'Iy', 'massPerMeter'])
      assert.ok(Math.abs(s[key] / definition.catalog[key] - 1) < 0.01, definition.name + ' ' + key);
    assert.ok(Math.abs(s.cx) < 1e-8 && Math.abs(s.cy) < 1e-8);
    assert.match(definition.standard, /S235JR\/S355J2/);
    assert.match(definition.source, /tabell 007/);
  }
  const p = profileSnapshot(find('HEM 200'));
  assert.deepEqual({ ...p.parameters }, { B: 206, H: 220, tw: 15, tf: 25, R: 18 });
  assert.deepEqual(p.catalog, {
    A: 13130,
    massPerMeter: 103,
    Ix: 106400000,
    Iy: 36510000,
    Wx: 967000,
    Wy: 354000,
    J: 2600000,
  });
  assert.equal(profileSnapshot(find('HEM 1000')).properties.bounds.height, 1008);
  assert.equal(find('HEM 700').catalog.J, 15590000);
});

test('all T rows use source radii, 2% taper and the reflected catalog centroid and conservative modulus', () => {
  const profiles = TIBNOR_PROFILES.filter((p) => p.family === 'T');
  assert.equal(profiles.length, 11);
  for (const definition of profiles) {
    const { properties: s, parameters: v } = evaluateSection(definition),
      c = definition.catalog;
    assert.equal(definition.teeSlope, 2);
    assert.equal(v.tw, v.tf);
    assert.equal(s.bounds.width, v.B);
    assert.equal(s.bounds.height, v.H);
    assert.ok(Math.abs(s.A / c.A - 1) < 0.005, definition.name + ' area');
    for (const [key, calculated] of [
      ['Ix', 'Ix'],
      ['Iy', 'Iy'],
      ['Wx', 'WxMinus'],
      ['Wy', 'WyPlus'],
    ])
      assert.ok(Math.abs(s[calculated] / c[key] - 1) < 0.035, definition.name + ' ' + key);
    assert.ok(Math.abs(s.cx) < 1e-8);
    assert.ok(Math.abs(s.cy - c.cy) < 0.2, definition.name + ' centroid');
    assert.ok(s.WxMinus < s.WxPlus);
    assert.equal(c.Wx, c.WxMinus);
    assert.match(definition.source, /tabell 012/);
  }
  const p = profileSnapshot(find('T 100x100'));
  assert.deepEqual({ ...p.parameters }, { B: 100, H: 100, tw: 11, tf: 11, Rk: 11, Rf: 5.5, R1: 3 });
  assert.equal(p.catalog.cy, 22.6);
  assert.equal(p.catalog.Ix, 1790000);
  assert.equal(p.catalog.Iy, 883000);
  assert.equal(p.catalog.WxMinus, 24600);
  assert.equal(p.catalog.J, undefined);
  const sharp = schematicProfileLoops(p)[0];
  assert.ok(sharp.some(([x, y]) => Math.abs(x - 4.5) < 1e-8 && y === -50));
  assert.ok(sharp.some(([x, y]) => x === 50 && Math.abs(y - 39.5) < 1e-8));
});

test('T and HEM retain one physical profile, stable sharp snaps and manufacturing identity in both displays', () => {
  for (const name of ['T 100x100', 'HEM 200']) {
    const section = profileSnapshot(find(name)),
      schematic = schematicProfileLoops(section);
    assert.equal(schematic[0].length, name.startsWith('T ') ? 8 : 12);
    assert.deepEqual(
      section.contourDefinition.radiusParameters,
      name.startsWith('T ') ? ['Rk', 'Rf', 'R1'] : ['R'],
    );
    assert.equal(section.schematicLoops, undefined);
    const object = {
      id: name,
      type: 'sweep',
      profile: 'custom',
      section,
      width: section.properties.bounds.width,
      height: section.properties.bounds.height,
      thickness: 11,
      rotation: 23,
      start: [0, 0, 0],
      end: [1500, 0, 0],
    };
    const before = JSON.stringify(object),
      key = partKey(object, [object]),
      snaps = createSnapGeometryContext([object]).objectCorners(object);
    assert.equal(snaps.length, schematic[0].length * 2);
    assert.deepEqual(
      snaps,
      createSnapGeometryContext([object], { profileDetail: 'exact' }).objectCorners(object),
    );
    const exact = displayGeometry(object, [object], 'exact'),
      sharp = displayGeometry(object, [object]);
    assert.ok(exact.attributes.position.count > sharp.attributes.position.count);
    exact.dispose();
    sharp.dispose();
    assert.equal(partKey(object, [object]), key);
    assert.equal(JSON.stringify(object), before);
  }
});

test('tee radii and tapered thickness are validated after independent edits', () => {
  for (const [parameter, value] of [
    ['Rk', 50],
    ['Rf', 12],
    ['R1', 5],
    ['tw', 1],
    ['tf', 1],
    ['R1', -1],
  ]) {
    const definition = structuredClone(find('T 40x40'));
    definition.parameters.find((p) => p.name === parameter).value = value;
    assert.throws(() => evaluateSection(definition), /T-profilens/);
  }
  const definition = structuredClone(find('T 40x40'));
  for (const p of definition.parameters)
    if (definition.radiusParameters.includes(p.name)) p.value = 0;
  assert.equal(evaluateSection(definition).loops[0].length, 8);
  const parallel = { ...roundedTeeTemplate({ slope: 0 }), id: 'tee', revision: 1, name: 'T' };
  assert.doesNotThrow(() => profileSnapshot(parallel));
  const invalid = { ...roundedTeeTemplate({ slope: 25 }), id: 'bad', revision: 1, name: 'T' };
  assert.throws(() => evaluateSection(invalid), /T-profilens/);
  const beam = structuredClone(find('HEM 100'));
  beam.parameters.find((p) => p.name === 'R').value = 41;
  assert.throws(() => evaluateSection(beam), /Hålkälsradien/);
});
