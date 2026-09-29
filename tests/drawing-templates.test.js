import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createDrawingTemplate, instantiateDrawingTemplate } from '../src/drawing-templates.js';
test('template strips object identities and annotations, and rebuilds views for new geometry', () => {
  const bounds = new THREE.Box3(new THREE.Vector3(-50, -10, -10), new THREE.Vector3(50, 10, 10));
  const record = {
    type: 'SP',
    annotations: [{ comment: 'Must not copy' }],
    sheet: {
      paper: { id: 'A3', width: 297, height: 420 },
      landscape: true,
      views: [
        {
          id: 'front',
          name: 'Front',
          standard: true,
          projection: 'front',
          scale: 10,
          position: [20, 30],
          size: [50, 50],
          camera: { center: [999, 999] },
          source: { objectId: 'old' },
          settings: { hiddenLines: true },
        },
        {
          id: 'cut',
          name: 'A–A',
          kind: 'section',
          scale: 5,
          position: [80, 30],
          source: { objectId: 'old', parentViewId: 'front' },
          section: {
            points: [
              [0, -20],
              [0, 20],
            ],
            side: 1,
            depth: 100,
            label: 'A',
          },
          settings: { hiddenLines: true },
        },
      ],
    },
  };
  const template = createDrawingTemplate(record, bounds, 'Stål', 't');
  assert.equal(template.annotations, undefined);
  assert.equal(template.views[0].source.objectId, undefined);
  const geometry = new THREE.BoxGeometry(200, 40, 40);
  const sheet = instantiateDrawingTemplate(template, geometry, 'new');
  assert.deepEqual(sheet.views[0].position, [20, 30]);
  assert.equal(sheet.views[0].scale, 10);
  assert.equal(sheet.views[1].scale, 5);
  assert.equal(sheet.views[1].source.parentViewId, 'front');
  assert.ok(
    sheet.views.every((v) => v.source.objectId === 'new' && v.camera.center.every(Number.isFinite)),
  );
  assert.equal(sheet.views[1].section.depth, 200);
  assert.deepEqual(sheet.views[1].section.points, [
    [0, -40],
    [0, 40],
  ]);
  assert.equal(template.views[1].section.depth, 100);
  geometry.dispose();
});
