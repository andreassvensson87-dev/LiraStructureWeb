import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { gridSegments, gridCrossings } from '../src/grid-geometry.js';
import { syncGridObjects } from '../src/model/grid-objects.js';
import { applyObjectBatch, transformCandidates } from '../src/model/tools/transform-tool.js';
import { gridReference, resolveReference } from '../src/annotation-references.js';
import { snapDrawingGrid } from '../src/drawing-grid-snap.js';
import { sectionGridLines } from '../src/section-grid.js';
import { resolveSnap } from '../src/snap.js';
import { createProject } from '../src/project/project-state.js';
const original = { x: [0, 3000, 6000], y: [0, 4000, 8000] };
const close = (actual, expected) =>
  actual.forEach((v, i) => assert.ok(Math.abs(v - expected[i]) < 1e-6, `${actual} ≠ ${expected}`));
function model() {
  const p = createProject({
    grid: original,
    levels: { active: 'l', items: [{ id: 'l', name: 'Plan', elevation: 0 }] },
  });
  syncGridObjects(p);
  p.objects = p.objects.map((s, i) =>
    i === 1 ? { ...s, start: [0, 0, 0], end: [8000, 8000, 0], name: 'Sned' } : s,
  );
  syncGridObjects(p);
  return p;
}
function oblique() {
  return model().grid;
}
test('sloping intersections, line snaps and section drawings use actual endpoints', () => {
  const grid = oblique();
  assert.ok(
    gridCrossings(grid).some(
      (hit) =>
        hit.lines.some((line) => line.label === 'Sned') &&
        hit.point[0] === 4000 &&
        hit.point[1] === 4000,
    ),
  );
  close(snapDrawingGrid([2000, 2010], grid, 20), [2005, 2005]);
  const section = sectionGridLines(
    grid,
    { origin: [0, 0, 0], x: [1, 0, 0], y: [0, 1, 0] },
    [-1000, -1000, 9000, 9000],
  );
  const line = section.find((line) => line.label === 'Sned');
  assert.ok(line.points.every((point) => Math.abs(point[0] - point[1]) < 1e-6));
  const camera = new THREE.OrthographicCamera(-10000, 10000, 10000, -10000, 0.1, 50000);
  camera.position.set(0, 0, 10000);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  const screen = (p) => {
    const v = new THREE.Vector3(...p).project(camera);
    return [(v.x + 1) * 500, (1 - v.y) * 500];
  };
  const args = {
    camera,
    width: 1000,
    height: 1000,
    ray: new THREE.Ray(new THREE.Vector3(2000, 2010, 10000), new THREE.Vector3(0, 0, -1)),
    sweeps: [],
    grid,
    z: 0,
    axisSnap: false,
    polar: 0,
  };
  const snap = resolveSnap({ ...args, pointer: screen([2000, 2010, 0]) });
  close(snap.point, [2005, 2005, 0]);
  assert.equal(snap.symbol, 'line');
  const locked = resolveSnap({
    ...args,
    pointer: screen([2005, 1998, 0]),
    start: [0, 2000, 0],
    lock: 'X',
    gridIntersections: false,
  });
  close(locked.point, [2000, 2000, 0]);
});
test('dimension references follow object identities through normal move and delete', () => {
  const p = model();
  const source = p.objects[1];
  const crossing = gridReference([4000, 4000], p.grid),
    along = gridReference([2000, 2000], p.grid);
  p.objects = applyObjectBatch(
    p.objects,
    transformCandidates({ mode: 'move', sources: [source] }, [0, 0, 0], [1000, 0, 0]),
  ).objects;
  syncGridObjects(p);
  close(resolveReference(crossing, [], p.grid), [5000, 4000]);
  close(resolveReference(along, [], p.grid), [3000, 2000]);
  p.objects = p.objects.filter((s) => s.id !== p.objects[0].id);
  syncGridObjects(p);
  close(resolveReference(crossing, [], p.grid), [5000, 4000]);
  p.objects = p.objects.filter((s) => s.id !== source.id);
  syncGridObjects(p);
  assert.equal(resolveReference(crossing, [], p.grid), null);
  assert.equal(resolveReference(along, [], p.grid), null);
});
