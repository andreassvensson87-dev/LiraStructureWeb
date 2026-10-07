import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  projectedGridBubbleDiameter,
  gridBubbleMetrics,
  DRAWING_GRID_BUBBLE_DIAMETER,
} from '../src/grid-bubble-size.js';
import { GridLines } from '../src/grid-lines.js';

test('model bubble halves with orthographic zoom and perspective distance', () => {
  const p = new THREE.Vector3();
  const ortho = new THREE.OrthographicCamera(-5000, 5000, 5000, -5000, 1, 100000);
  ortho.position.z = 10000;
  ortho.updateMatrixWorld();
  const large = projectedGridBubbleDiameter(ortho, p, 1000, 1000);
  ortho.zoom = 0.5;
  ortho.updateProjectionMatrix();
  assert.ok(Math.abs(projectedGridBubbleDiameter(ortho, p, 1000, 1000) / large - 0.5) < 1e-10);
  const perspective = new THREE.PerspectiveCamera(45, 1, 1, 100000);
  perspective.position.z = 10000;
  perspective.updateMatrixWorld();
  const near = projectedGridBubbleDiameter(perspective, p, 1000, 1000);
  perspective.position.z = 20000;
  perspective.updateMatrixWorld();
  assert.ok(Math.abs(projectedGridBubbleDiameter(perspective, p, 1000, 1000) / near - 0.5) < 1e-10);
});

test('drawing bubble, text and stroke shrink together without a pixel-size floor', () => {
  const editor = Object.create(GridLines.prototype);
  const camera = new THREE.OrthographicCamera(-1000, 1000, 1000, -1000, 1, 10000);
  camera.position.z = 5000;
  camera.updateMatrixWorld();
  const el = { textContent: 'A', style: {} };
  editor.labels = [
    {
      position: new THREE.Vector3(-500, 0, 0),
      opposite: new THREE.Vector3(500, 0, 0),
      index: 0,
      el,
    },
  ];
  editor.updateLabels(camera, 800, 800, {
    keepVisible: true,
    diameter: DRAWING_GRID_BUBBLE_DIAMETER * 2,
  });
  const before = { ...el.style };
  editor.updateLabels(camera, 800, 800, {
    keepVisible: true,
    diameter: DRAWING_GRID_BUBBLE_DIAMETER * 0.2,
  });
  for (const key of ['width', 'height', 'fontSize', 'borderWidth'])
    assert.ok(Math.abs(parseFloat(el.style[key]) / parseFloat(before[key]) - 0.1) < 1e-10);
  assert.equal(el.hidden, false);
  const longLabel = gridBubbleMetrics('STOMLINJE-12', 8);
  assert.ok(longLabel.radius > 4);
  assert.equal(longLabel.height, 8);
});
