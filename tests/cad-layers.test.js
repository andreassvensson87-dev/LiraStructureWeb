import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { cadReferenceParts } from '../src/references/cad-geometry.js';
import { cadLayers, applyLayerVisibility } from '../src/references/cad-layers.js';
import { ReferenceModels } from '../src/references/reference-models.js';
import { referenceCandidates } from '../src/references/edge-index.js';
import { cadReferenceData } from '../src/references/cad-data.js';
const line = (layer, x) => ({
  type: 'line',
  layer,
  color: '#333333',
  points: [
    [x, 0],
    [x + 100, 0],
  ],
});
test('equal colors on different CAD layers remain separate for visibility, bounds and snapping', () => {
  const entities = [line('Stomme', 0), line('Mått', 1000), line('Stomme', 200)],
    parts = cadReferenceParts(entities);
  const model = { group: new THREE.Group(), parts, layerVisibility: { Mått: false } };
  parts.forEach((p) => model.group.add(p.mesh));
  applyLayerVisibility(model);
  assert.equal(parts.length, 2);
  assert.equal(parts.find((p) => p.layer === 'Mått').mesh.visible, false);
  assert.deepEqual(
    cadLayers(entities).map((l) => [l.name, l.count]),
    [
      ['Mått', 1],
      ['Stomme', 2],
    ],
  );
  const refs = Object.assign(Object.create(ReferenceModels.prototype), { models: [model] });
  assert.equal(refs.bounds().max.x, 300);
  const camera = new THREE.OrthographicCamera(900, 1100, 100, -100, 1, 10000);
  camera.position.z = 5000;
  camera.updateMatrixWorld();
  const options = {
    ray: new THREE.Ray(new THREE.Vector3(1000, 0, 5000), new THREE.Vector3(0, 0, -1)),
    camera,
    pointer: [400, 400],
    width: 800,
    height: 800,
  };
  assert.deepEqual(referenceCandidates(parts, options), []);
  model.layerVisibility['Mått'] = true;
  applyLayerVisibility(model);
  assert.ok(referenceCandidates(parts, options).length);
  assert.equal(refs.bounds().max.x, 1100);
  parts.forEach((p) => {
    p.mesh.geometry.dispose();
    p.mesh.material.dispose();
  });
});
test('layer zero inside blocks inherits insertion layer for both text and lines', () => {
  const source = [
    '0',
    'SECTION',
    '2',
    'BLOCKS',
    '0',
    'BLOCK',
    '2',
    'B',
    '10',
    '0',
    '20',
    '0',
    '0',
    'LINE',
    '8',
    '0',
    '10',
    '0',
    '20',
    '0',
    '11',
    '100',
    '21',
    '0',
    '0',
    'TEXT',
    '8',
    '0',
    '10',
    '0',
    '20',
    '10',
    '40',
    '3',
    '1',
    'Test',
    '0',
    'ENDBLK',
    '0',
    'ENDSEC',
    '0',
    'SECTION',
    '2',
    'ENTITIES',
    '0',
    'INSERT',
    '8',
    'Stomme',
    '2',
    'B',
    '10',
    '0',
    '20',
    '0',
    '0',
    'ENDSEC',
    '0',
    'EOF',
  ].join('\n');
  const data = cadReferenceData(source);
  assert.deepEqual(
    data.layers.map((l) => [l.name, l.count]),
    [['Stomme', 2]],
  );
  assert.ok(data.entities.every((e) => e.layer === 'Stomme'));
});
