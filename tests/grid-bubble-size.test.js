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

test('model bubbles stay readable at extreme zoom and grow gradually in between', () => {
  const editor = Object.create(GridLines.prototype);
  const camera = new THREE.OrthographicCamera(-5000, 5000, 5000, -5000, 1, 100000);
  camera.position.z = 10000;
  camera.updateMatrixWorld();
  const el = { textContent: 'A', style: {} };
  editor.labels = [
    { position: new THREE.Vector3(), opposite: new THREE.Vector3(1000, 0, 0), index: 0, el },
  ];
  const sizes = [0.01, 0.5, 1, 100].map((zoom) => {
    camera.zoom = zoom;
    camera.updateProjectionMatrix();
    editor.updateLabels(camera, 800, 800);
    assert.equal(el.hidden, false);
    const size = parseFloat(el.style.height);
    assert.ok(size >= 20 && size <= 36);
    assert.equal(parseFloat(el.style.width), size);
    assert.ok(parseFloat(el.style.fontSize) >= (12 * 20) / 28);
    return size;
  });
  assert.equal(sizes[0], 20);
  assert.equal(sizes[3], 36);
  assert.ok(sizes[1] > sizes[0] && sizes[1] < sizes[2]);
});

test('perspective model bubbles are bounded and long text expands width rather than height', () => {
  const editor = Object.create(GridLines.prototype);
  const camera = new THREE.PerspectiveCamera(45, 1, 1, 1e8);
  const el = { textContent: 'STOMLINJE-12', style: {} };
  editor.labels = [
    { position: new THREE.Vector3(), opposite: new THREE.Vector3(1000, 0, 0), index: 0, el },
  ];
  for (const distance of [1000, 10000, 1000000]) {
    camera.position.z = distance;
    camera.updateMatrixWorld();
    editor.updateLabels(camera, 800, 800);
    const height = parseFloat(el.style.height),
      width = parseFloat(el.style.width);
    assert.ok(height >= 20 && height <= 36);
    assert.ok(width > height);
    assert.equal(el.style.whiteSpace, 'nowrap');
    assert.ok(width > el.textContent.length * parseFloat(el.style.fontSize) * 0.6);
    assert.equal(el.hidden, false);
  }
});
