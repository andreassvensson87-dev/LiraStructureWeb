import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { PlanView } from '../src/plan-view.js';
import { SinglePartSheet } from '../src/single-part-sheet.js';
import { GAViews } from '../src/ga-views.js';

test('GA view inspection is safe before the first view exists and releases selection between drawings', () => {
  let removed = 0;
  const views = Object.assign(Object.create(GAViews.prototype), {
    e: { record: {} },
    snapshots: new Map([['old', { remove: () => removed++ }]]),
    active: null,
    selectedIds: new Set(['old']),
    selected: true,
    ready: true,
  });
  assert.deepEqual(
    views.items,
    [],
    'The selection dock can inspect a new GA before its sheet exists',
  );
  views.e.record.sheet = {};
  assert.deepEqual(views.items, []);
  assert.deepEqual(views.selectedViews(), [], 'Initial paper layout precedes ensureGAViews');
  const first = { id: 'first' };
  views.e.record.sheet.views = [first];
  views.active = first;
  views.selectedIds = new Set(['first']);
  assert.deepEqual(views.selectedViews(), [first]);
  views.reset();
  assert.equal(removed, 1);
  assert.equal(views.snapshots.size, 0);
  assert.equal(views.selectedIds.size, 0);
  assert.equal(views.selected, false);
  assert.equal(views.ready, false);
  views.e.record = { sheet: {} };
  assert.deepEqual(
    views.selectedViews(),
    [],
    'Reopening a new drawing has no stale view selection',
  );
});

test('clearing a drawing releases projected faces, snap, geometry and temporary section data', () => {
  const group = new THREE.Group(),
    geometry = new THREE.BoxGeometry(),
    material = new THREE.MeshBasicMaterial();
  const mesh = new THREE.Mesh(geometry, material);
  group.add(mesh);
  let geometries = 0,
    materials = 0,
    cleared = 0;
  geometry.addEventListener('dispose', () => geometries++);
  material.addEventListener('dispose', () => materials++);
  const editor = {
    group,
    vectorCache: [{}],
    modelFaces: [
      [
        [1, 2],
        [3, 4],
        [5, 6],
      ],
    ],
    referenceSnapQuery: () => [],
    annotationCandidates: [[1, 2]],
    sections: [{}],
    hatchSurfaces: [{}],
    svg: { replaceChildren: () => cleared++ },
  };
  PlanView.prototype.clear.call(editor);
  assert.equal(editor.modelFaces, null);
  assert.equal(editor.vectorCache, null);
  assert.equal(editor.referenceSnapQuery, null);
  assert.equal(group.children.length, 0);
  assert.deepEqual(editor.annotationCandidates, []);
  assert.deepEqual(editor.sections, []);
  assert.deepEqual(editor.hatchSurfaces, []);
  assert.equal(geometries, 1);
  assert.equal(materials, 1);
  assert.equal(cleared, 1);
});

test('closing a part sheet releases base, assembly and profile geometry and section references', () => {
  let disposed = 0,
    cleared = 0;
  const geometry = () => {
    const value = new THREE.BoxGeometry();
    value.addEventListener('dispose', () => disposed++);
    return value;
  };
  const editor = Object.assign(Object.create(SinglePartSheet.prototype), {
    geometry: geometry(),
    snapGeometry: geometry(),
    assemblyEntries: [{ geometry: geometry(), snapGeometry: geometry() }],
    assembly: {},
    profileVariants: new Map([
      [
        'schematic',
        {
          geometry: geometry(),
          snapGeometry: geometry(),
          entries: [{ geometry: geometry(), snapGeometry: geometry() }],
        },
      ],
    ]),
    extraSections: { cache: new Map([['front', { behind: [[0, 1]], candidates: [[2, 3]] }]]) },
    annotationCandidates: { front: [[0, 1]] },
    profileGeometryModel: [{}],
    profileGeometrySource: {},
    profileGeometryAssembly: {},
    profileLocalMatrix: {},
    drawingReflection: {},
    svg: { replaceChildren: () => cleared++ },
  });
  editor.releaseDrawingGeometry();
  assert.equal(disposed, 8);
  assert.equal(cleared, 1);
  assert.equal(editor.extraSections.cache.size, 0);
  assert.equal(editor.profileVariants.size, 0);
  assert.deepEqual(editor.annotationCandidates, {});
  for (const key of [
    'geometry',
    'snapGeometry',
    'assemblyEntries',
    'assembly',
    'profileGeometryModel',
    'profileGeometrySource',
    'profileGeometryAssembly',
    'profileLocalMatrix',
    'drawingReflection',
  ])
    assert.equal(editor[key], null);
  editor.releaseDrawingGeometry();
  assert.equal(disposed, 8, 'Repeated cleanup must not dispose an old resource again');
});
