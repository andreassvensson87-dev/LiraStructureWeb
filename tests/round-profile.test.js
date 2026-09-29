import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { sectionTemplate } from '../src/section-templates.js';
import { profileSnapshot } from '../src/section-profile.js';
import { roundProfile, roundGeometryTemplate } from '../src/round-profile.js';
import { sweepGeometry, sweepCorners } from '../src/sweep.js';
const base = {
  profile: 'chs',
  width: 200,
  height: 200,
  thickness: 8,
  rotation: 0,
  start: [0, 0, 0],
  end: [1000, 0, 0],
};
test('library and quick tubes share geometry template and exact quadrant snaps', () => {
  const section = profileSnapshot({
    id: 'round',
    revision: 1,
    name: 'Tube',
    ...sectionTemplate('chs'),
  });
  const custom = { ...base, profile: 'custom', section };
  assert.deepEqual(roundProfile(custom), roundProfile(base));
  assert.equal(sweepCorners(custom).length, 16);
  assert.deepEqual(sweepCorners(custom), sweepCorners(base));
  assert.equal(
    roundGeometryTemplate(roundProfile(custom)),
    roundGeometryTemplate(roundProfile(base)),
  );
  const modified = structuredClone(custom);
  modified.section.loops[0][0][0] += 1;
  assert.equal(roundProfile(modified), null);
  assert.equal(sweepCorners(modified).length, 384);
});
test('smooth radial side normals, opposite bore normals and sharp cap normals', () => {
  const g = roundGeometryTemplate(roundProfile(base)),
    p = g.attributes.position,
    n = g.attributes.normal;
  let cap = 0,
    outer = 0,
    inner = 0;
  for (let i = 0; i < p.count; i++) {
    if (Math.abs(n.getZ(i)) > 0.5) {
      cap++;
      assert.equal(Math.abs(n.getZ(i)), 1);
      continue;
    }
    const x = p.getX(i),
      y = p.getY(i),
      r = Math.hypot(x, y),
      sign = r < 96 ? -1 : 1;
    assert.ok(Math.abs(n.getX(i) - (sign * x) / r) < 1e-6);
    assert.ok(Math.abs(n.getY(i) - (sign * y) / r) < 1e-6);
    sign < 0 ? inner++ : outer++;
  }
  assert.ok(cap && outer && inner);
});
test('render edges omit all longitudinal tessellation lines; clones cannot change template', () => {
  const template = roundGeometryTemplate(roundProfile(base)),
    before = template.attributes.position.array.slice();
  const g = sweepGeometry(base),
    edges = new THREE.EdgesGeometry(g, 5),
    p = edges.attributes.position;
  assert.equal(p.count, 96 * 2 * 2 * 2);
  for (let i = 0; i < p.count; i += 2) assert.equal(p.getX(i), p.getX(i + 1));
  const other = sweepGeometry({ ...base, end: [3000, 0, 0], rotation: 23 });
  g.translate(100, 100, 100);
  g.dispose();
  other.dispose();
  edges.dispose();
  assert.deepEqual(template.attributes.position.array, before);
});
test('cutting a smooth tube preserves half its volume and restores the source', async () => {
  const { createGeometryContext } = await import('../src/model-object.js');
  const { objectGeometry, setModel: setGeometryModel } = createGeometryContext();
  const { planeFrame } = await import('../src/plate.js');
  const s = { ...base, id: 'tube' },
    cut = {
      id: 'cut',
      type: 'polygoncut',
      targets: ['tube'],
      frame: planeFrame('XY', [[500, -500, 0]]),
      polygon: [
        [0, 0],
        [1000, 0],
        [1000, 1000],
        [0, 1000],
      ],
      thickness: 1000,
      side: 'center',
    };
  const volume = () => {
    const g = objectGeometry(s),
      p = g.attributes.position;
    let sum = 0;
    for (let i = 0; i < p.count; i += 3) {
      const a = new THREE.Vector3().fromBufferAttribute(p, i),
        b = new THREE.Vector3().fromBufferAttribute(p, i + 1),
        c = new THREE.Vector3().fromBufferAttribute(p, i + 2);
      sum += a.dot(b.cross(c)) / 6;
    }
    g.dispose();
    return sum;
  };
  setGeometryModel([s]);
  const full = volume();
  setGeometryModel([s, cut]);
  assert.ok(Math.abs(volume() / full - 0.5) < 1e-5);
  setGeometryModel([s]);
  assert.ok(Math.abs(volume() - full) < 0.001);
  setGeometryModel([]);
});
