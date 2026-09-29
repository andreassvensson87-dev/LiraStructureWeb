import test from 'node:test';
import assert from 'node:assert/strict';
import { sectionTemplate } from '../src/section-templates.js';
import { evaluateSection, validateLibrary } from '../src/section-profile.js';
const def = (type) => ({
  id: 'test',
  revision: 1,
  name: 'Test',
  family: 'Min serie',
  ...sectionTemplate(type),
});
test('H I L U and lipped C templates form valid solids of expected area', () => {
  const areas = {
    h: 7008,
    i: 7008,
    l: 3936,
    u: 7008,
    c: 300 * 8 + 2 * (200 - 8) * 8 + 2 * (25 - 8) * 8,
  };
  for (const type of Object.keys(areas)) {
    const d = def(type),
      s = evaluateSection(d);
    assert.equal(s.properties.A, areas[type]);
    d.parameters.find((p) => p.name === 'B').value = 250;
    assert.equal(evaluateSection(d).properties.bounds.width, 250);
    assert.deepEqual(
      validateLibrary(JSON.parse(JSON.stringify({ schema: 1, profiles: [d] })))[0],
      d,
    );
  }
});
test('rejects collapsed thicknesses and overlapping lips', () => {
  for (const [type, key, value] of [
    ['h', 'tw', 200],
    ['i', 'tf', 150],
    ['u', 'tf', 150],
    ['l', 't', 200],
    ['c', 'lip', 150],
    ['c', 'lip', 4],
  ]) {
    const d = def(type);
    d.parameters.find((p) => p.name === key).value = value;
    assert.throws(() => evaluateSection(d));
  }
  assert.equal(sectionTemplate('custom'), null);
});
test('every preset type creates distinct evaluable geometry and applicable dimensions', async () => {
  const { PROFILE_TYPES } = await import('../src/profile-tree.js');
  for (const [type] of PROFILE_TYPES.filter(([type]) => type !== 'custom'))
    assert.ok(sectionTemplate(type), type);
  for (const [type, area, loops] of [
    ['t', 200 * 12 + 8 * (300 - 12), 1],
    ['rect', 60000, 1],
    ['rhs', 60000 - 184 * 284, 2],
    ['triangle', 30000, 1],
    ['circle', Math.PI * 100 ** 2, 1],
    ['chs', Math.PI * (100 ** 2 - 92 ** 2), 2],
  ]) {
    const d = def(type),
      s = evaluateSection(d);
    assert.equal(s.loops.length, loops);
    assert.ok(Math.abs(s.properties.A / area - 1) < 0.001, type);
    const key = type === 'circle' || type === 'chs' ? 'D' : 'B';
    d.parameters.find((p) => p.name === key).value = 240;
    assert.equal(evaluateSection(d).properties.bounds.width, 240);
  }
  for (const [type, key, value] of [
    ['t', 'tf', 300],
    ['rhs', 't', 100],
    ['chs', 't', 100],
    ['circle', 'D', 0],
  ]) {
    const d = def(type);
    d.parameters.find((p) => p.name === key).value = value;
    assert.throws(() => evaluateSection(d));
  }
});
