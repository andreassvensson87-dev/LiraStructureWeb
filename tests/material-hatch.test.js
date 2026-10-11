import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  materialHatch,
  validateHatch,
  sectionContours,
  hatchSegments,
  clipContours,
} from '../src/material-hatch.js';
import { sectionDrawing } from '../src/drawing-sections.js';
import { validateMaterialLibrary } from '../src/materials.js';
const ring = [
    [0, 0],
    [20, 0],
    [20, 20],
    [0, 20],
  ],
  hole = [
    [5, 5],
    [15, 5],
    [15, 15],
    [5, 15],
  ];
const hatch = { pattern: 'diagonal', angle: 0, spacing: 2, lineWidth: 0.18 };
test('material hatch persists, legacy materials have defaults and invalid imports fail', () => {
  const m = {
    id: 'test',
    revision: 1,
    category: 'steel',
    name: 'Test',
    density: 7850,
    color: '#688391',
    hatch,
  };
  assert.deepEqual(
    validateMaterialLibrary(JSON.parse(JSON.stringify({ schema: 1, materials: [m] })))[0].hatch,
    hatch,
  );
  assert.equal(materialHatch({ category: 'steel' }).pattern, 'diagonal');
  assert.equal(materialHatch({ category: 'concrete' }).pattern, 'concrete');
  assert.equal(materialHatch(null).pattern, 'none');
  for (const patch of [
    { pattern: 'invalid' },
    { spacing: 0 },
    { angle: Infinity },
    { lineWidth: -1 },
  ])
    assert.throws(() => validateHatch({ ...hatch, ...patch }));
});
test('all patterns stay inside material, leave holes empty, and none is empty', () => {
  for (const pattern of ['diagonal', 'cross', 'concrete', 'wood', 'insulation']) {
    const lines = hatchSegments([ring, hole], { ...hatch, pattern });
    assert.ok(lines.length);
    for (const [a, b] of lines) {
      const p = a.map((n, i) => (n + b[i]) / 2);
      assert.ok(p.every((n) => n >= -1e-8 && n <= 20 + 1e-8));
      assert.ok(!(p[0] > 5 && p[0] < 15 && p[1] > 5 && p[1] < 15));
    }
  }
  assert.deepEqual(hatchSegments([ring], { ...hatch, pattern: 'none' }), []);
  assert.equal(hatchSegments([ring], hatch).length, 10);
  assert.equal(hatchSegments([ring.map((p) => p.map((n) => n / 2))], hatch).length, 5);
});
test('real hollow section yields separate closed boundaries and finite section width closes clipped faces', () => {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(20, 0);
  shape.lineTo(20, 20);
  shape.lineTo(0, 20);
  shape.closePath();
  const inner = new THREE.Path();
  inner.moveTo(5, 5);
  inner.lineTo(5, 15);
  inner.lineTo(15, 15);
  inner.lineTo(15, 5);
  inner.closePath();
  shape.holes.push(inner);
  const g = new THREE.ExtrudeGeometry(shape, { depth: 10, bevelEnabled: false });
  const frame = {
    origin: [0, 0, 5],
    x: [1, 0, 0],
    y: [0, 1, 0],
    normal: [0, 0, 1],
    span: { direction: [1, 0], length: 12 },
  };
  const data = sectionDrawing([g], frame, 5);
  assert.equal(data.faces[0].length, 2);
  assert.ok(data.faces[0].flat().every((p) => p[0] >= 0 && p[0] <= 12));
  assert.ok(hatchSegments(data.faces[0], hatch).length);
  assert.deepEqual(
    sectionContours([
      [
        [0, 0],
        [1, 0],
      ],
      [
        [1, 0],
        [1, 1],
      ],
    ]),
    [],
  );
  assert.equal(clipContours([ring], frame.span)[0].length, 4);
  g.dispose();
});
