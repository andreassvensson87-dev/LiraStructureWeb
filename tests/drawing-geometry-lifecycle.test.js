import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { PlanView } from '../src/plan-view.js';
import { SinglePartSheet } from '../src/single-part-sheet.js';

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
