import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createStandardPartView, standardPartViews } from '../src/part-standard-view.js';
import { partViewFrame } from '../src/part-view-frame.js';
import { PartSections } from '../src/part-sections.js';
import { ensurePartViews, resizeDrawingView } from '../src/drawing-views.js';
import { createDetailView } from '../src/drawing-details.js';
import { createSectionView } from '../src/drawing-sections.js';

test('six standard views have right-handed frames and opposite viewing directions', () => {
  for (const name of Object.keys(standardPartViews)) {
    const f = partViewFrame(name);
    assert.deepEqual(
      new THREE.Vector3(...f.x)
        .cross(new THREE.Vector3(...f.y))
        .toArray()
        .map((v) => v || 0),
      f.normal,
    );
  }
  for (const [a, b] of [
    ['top', 'bottom'],
    ['front', 'back'],
    ['left', 'right'],
  ]) {
    assert.equal(
      new THREE.Vector3(...partViewFrame(a).normal).dot(
        new THREE.Vector3(...partViewFrame(b).normal),
      ),
      -1,
    );
  }
});
test('extra view has independent identity, scale and crop and survives view normalization', () => {
  const bounds = new THREE.Box3(
    new THREE.Vector3(0, -100, -150),
    new THREE.Vector3(3000, 100, 150),
  );
  const a = createStandardPartView('right', bounds, 10, 'beam');
  const b = createStandardPartView('right', bounds, 20, 'beam');
  assert.notEqual(a.id, b.id);
  assert.deepEqual(a.size, [32, 42]);
  assert.equal(a.name, 'Right');
  const record = { sourceId: 'beam', sheet: { scale: 10, views: [a, b] } };
  ensurePartViews(record);
  assert.ok(record.sheet.views.includes(a));
  const resized = resizeDrawingView(a, 'se', [10, 5]);
  assert.notDeepEqual(resized.size, a.size);
  assert.equal(b.scale, 20);
});
test('sections and details inherit an extra standard view orientation', () => {
  const bounds = new THREE.Box3(
    new THREE.Vector3(0, -100, -150),
    new THREE.Vector3(3000, 100, 150),
  );
  const parent = createStandardPartView('back', bounds, 10, 'beam');
  const detail = createDetailView(
    parent,
    [
      [-100, -50],
      [0, 50],
    ],
    [0, 0],
    [parent],
  );
  const section = createSectionView(
    parent,
    [
      [-100, -50],
      [-100, 50],
    ],
    1,
    [0, 0],
    [parent],
  );
  const tool = Object.create(PartSections.prototype);
  tool.e = { config: { views: [parent, detail, section] }, selectedView: parent.id };
  assert.equal(tool.selected(), parent);
  assert.deepEqual(tool.frame(detail), partViewFrame('back'));
  assert.deepEqual(tool.frame(section).y, [0, 0, 1]);
  assert.deepEqual(tool.markers(parent.id), [section]);
});
