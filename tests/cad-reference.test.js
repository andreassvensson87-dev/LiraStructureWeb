import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { cadReferenceData } from '../src/references/cad-data.js';
import { cadReferenceParts, applyCADPlacement } from '../src/references/cad-geometry.js';
import { referenceCandidates } from '../src/references/edge-index.js';
import { readFileSync } from 'node:fs';
const dxf = (entities, unit = 4) =>
  [
    '0',
    'SECTION',
    '2',
    'HEADER',
    '9',
    '$INSUNITS',
    '70',
    unit,
    '0',
    'ENDSEC',
    '0',
    'SECTION',
    '2',
    'ENTITIES',
    ...entities,
    '0',
    'ENDSEC',
    '0',
    'EOF',
  ].join('\n');
test('CAD reference keeps site coordinates and detects drawing units without frame size limits', () => {
  const data = cadReferenceData(
    dxf(
      ['0', 'LINE', '8', 'Walls', '10', '-100000', '20', '200000', '11', '100000', '21', '200000'],
      6,
    ),
  );
  assert.equal(data.unitFactor, 1000);
  assert.equal(data.unitKnown, true);
  assert.deepEqual(data.entities[0].points, [
    [-100000, 200000],
    [100000, 200000],
  ]);
  assert.equal(data.entities[0].layer, 'Walls');
  const unknown = cadReferenceData(
    dxf(['0', 'LINE', '10', '0', '20', '0', '11', '100', '21', '0'], 0),
  );
  assert.equal(unknown.unitFactor, 1);
  assert.equal(unknown.unitKnown, false);
});
test('CAD lines preserve endpoints, snapping follows scale, rotation, and insertion', () => {
  const parts = cadReferenceParts([
    {
      type: 'line',
      color: '#333333',
      points: [
        [0, 0],
        [100, 0],
      ],
    },
  ]);
  const model = {
    format: 'DXF',
    group: new THREE.Group(),
    parts,
    unitFactor: 10,
    placement: { scale: 2, rotation: 90, offset: [500, 300, 25] },
  };
  for (const p of parts) model.group.add(p.mesh);
  applyCADPlacement(model);
  const bounds = new THREE.Box3().setFromObject(model.group);
  assert.ok(Math.abs(bounds.min.x - 500) < 1e-8);
  assert.equal(bounds.min.y, 300);
  assert.equal(bounds.max.y, 2300);
  assert.equal(bounds.min.z, 25);
  const camera = new THREE.OrthographicCamera(-1000, 1000, 1500, -1500, 1, 10000);
  camera.position.set(500, 1300, 5000);
  camera.updateMatrixWorld();
  const endpoint = new THREE.Vector3(500, 300, 25),
    p = endpoint.clone().project(camera);
  const ray = new THREE.Ray(new THREE.Vector3(500, 300, 5000), new THREE.Vector3(0, 0, -1));
  const candidates = referenceCandidates(parts, {
    ray,
    camera,
    pointer: [(p.x + 1) * 400, (1 - p.y) * 400],
    width: 800,
    height: 800,
    labelPrefix: 'DXF',
  });
  assert.ok(
    candidates.some(
      (c) =>
        c.label === 'DXF-hörn' &&
        Math.hypot(...c.coords.map((v, i) => v - endpoint.getComponent(i))) < 1e-7,
    ),
  );
  for (const part of parts) {
    part.mesh.geometry.dispose();
    part.mesh.material.dispose();
  }
});
test('bundled DXF block references expand to finite lines and text for CAD underlays', () => {
  const data = cadReferenceData(
    readFileSync(
      new URL('../assets/drawing-templates/Rithuvud_A3_A4.dxf', import.meta.url),
      'utf8',
    ),
  );
  assert.ok(data.entities.some((e) => e.type === 'line'));
  assert.ok(data.entities.some((e) => e.type === 'text'));
  assert.ok(
    data.entities
      .filter((e) => e.type === 'line')
      .every((e) => e.points.flat().every(Number.isFinite)),
  );
});
test('CAD excludes paper space and invisible entities while retaining model-space layers', () => {
  const data = cadReferenceData(
    dxf([
      '0',
      'LINE',
      '10',
      '0',
      '20',
      '0',
      '11',
      '10',
      '21',
      '0',
      '0',
      'LINE',
      '67',
      '1',
      '10',
      '0',
      '20',
      '20',
      '11',
      '10',
      '21',
      '20',
      '0',
      'LINE',
      '60',
      '1',
      '10',
      '0',
      '20',
      '30',
      '11',
      '10',
      '21',
      '30',
    ]),
  );
  assert.equal(data.entities.length, 1);
  assert.deepEqual(data.entities[0].points, [
    [0, 0],
    [10, 0],
  ]);
});
