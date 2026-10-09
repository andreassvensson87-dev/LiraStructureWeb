import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { gridSegments, gridCrossings, gridWithGeometry } from '../src/grid-geometry.js';
import { changeGridLine, parallelGridLine, removeGridLine } from '../src/grid-edit.js';
import { gridReference, resolveReference } from '../src/annotation-references.js';
import { snapDrawingGrid } from '../src/drawing-grid-snap.js';
import { sectionGridLines } from '../src/section-grid.js';
import { resolveSnap } from '../src/snap.js';
import { createProject } from '../src/project/project-state.js';
import { serializeProject, parseProjectFile } from '../src/project/project-file.js';
import { ProjectHistory } from '../src/project/project-history.js';
const original = { x: [0, 3000, 6000], y: [0, 4000, 8000] };
const close = (actual, expected) =>
  actual.forEach((v, i) => assert.ok(Math.abs(v - expected[i]) < 1e-6, `${actual} ≠ ${expected}`));
function oblique() {
  return changeGridLine(original, 'x', 1, { start: [0, 0], end: [8000, 8000], label: 'Sned' }).grid;
}
test('free endpoints, rotation and parallel copies retain labels and other lines', () => {
  const grid = oblique(),
    source = structuredClone(grid.lines.x[1]);
  assert.equal(grid.labels.x[1], 'Sned');
  assert.deepEqual(grid.lines.y, gridWithGeometry(original).lines.y);
  const rotated = changeGridLine(grid, 'x', 1, { angle: 0 }).grid;
  close(rotated.lines.x[1].start, [4000 - Math.sqrt(32000000), 4000]);
  close(rotated.lines.x[1].end, [4000 + Math.sqrt(32000000), 4000]);
  const parallel = parallelGridLine(grid, 'x', 1, 1000).grid;
  close(parallel.lines.x[3].start, [-Math.SQRT1_2 * 1000, Math.SQRT1_2 * 1000]);
  assert.notEqual(parallel.lines.x[3].id, source.id);
  assert.deepEqual(grid.lines.x[1], source);
  assert.throws(() => changeGridLine(grid, 'x', 1, { end: [0, 0] }));
  assert.throws(() => changeGridLine(grid, 'x', 1, { angle: NaN }));
});
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
test('dimension references follow stable line identities after moving, adding and removing lines', () => {
  let grid = oblique();
  const crossing = gridReference([4000, 4000], grid),
    along = gridReference([2000, 2000], grid);
  grid = changeGridLine(grid, 'x', 1, { translation: [1000, 0] }).grid;
  close(resolveReference(crossing, [], grid), [5000, 4000]);
  close(resolveReference(along, [], grid), [3000, 2000]);
  grid = removeGridLine(grid, 'x', 0).grid;
  close(resolveReference(crossing, [], grid), [5000, 4000]);
  grid = parallelGridLine(grid, 'x', 0, 500).grid;
  grid = removeGridLine(grid, 'x', 0).grid;
  assert.equal(resolveReference(crossing, [], grid), null);
  assert.equal(resolveReference(along, [], grid), null);
});
test('geometry survives save and undo; corrupt identities and endpoints fail validation', () => {
  const project = createProject({
    grid: oblique(),
    levels: { active: 'l', items: [{ id: 'l', name: 'Plan', elevation: 0 }] },
  });
  const history = new ProjectHistory();
  history.checkpoint(project);
  const before = structuredClone(project.grid);
  project.grid = changeGridLine(project.grid, 'x', 1, { angle: 30 }).grid;
  const saved = parseProjectFile(serializeProject(project));
  assert.deepEqual(saved.grid, project.grid);
  assert.deepEqual(history.undo(project).grid, before);
  saved.grid.lines.x[1].id = saved.grid.lines.x[0].id;
  assert.throws(() => serializeProject(saved), /ändpunkter/);
  saved.grid = structuredClone(before);
  saved.grid.lines.x[1].start[0] = Infinity;
  assert.throws(() => serializeProject(saved), /ogiltiga tal/);
  assert.equal(gridSegments(original).length, 6);
});
