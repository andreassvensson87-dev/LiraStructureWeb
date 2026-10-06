import test from 'node:test';
import assert from 'node:assert/strict';
import { gridLabel, gridLabelsAtPositions, validateGridLabels } from '../src/grid-labels.js';
import { sectionGridLines } from '../src/section-grid.js';
import { createProject } from '../src/project/project-state.js';
import { serializeProject, parseProjectFile } from '../src/project/project-file.js';
import { ProjectHistory } from '../src/project/project-history.js';

const grid = { x: [0, 3000], y: [0, 4000], labels: { x: ['X-01', 'X-02'], y: ['Entré', 'Tak'] } };
test('custom bubble text and legacy defaults share one label lookup', () => {
  assert.equal(gridLabel(grid, 'x', 0), 'X-01');
  assert.equal(gridLabel(grid, 'y', 0), 'Entré');
  assert.equal(gridLabel({}, 'x', 1), '2');
  assert.equal(gridLabel({}, 'y', 1), 'B');
  assert.equal(gridLabel({ labels: { x: ['  '] } }, 'x', 0), '1');
  assert.deepEqual(gridLabelsAtPositions(grid, 'x', [-1000, 0, 3000]), ['1', 'X-01', 'X-02']);
  assert.deepEqual(gridLabelsAtPositions(grid, 'x', [3000, 0]), ['X-02', 'X-01']);
  assert.deepEqual(
    gridLabelsAtPositions({ x: [0, 3000], labels: { x: ['', '  E  '] } }, 'x', [3000, 0]),
    ['E', '2'],
  );
});

test('section bubbles use custom labels including coincident grid lines', () => {
  const r = Math.SQRT1_2;
  const lines = sectionGridLines(
    grid,
    { origin: [0, 0, 0], x: [r, r, 0], y: [0, 0, 1] },
    [-10, 0, 8000, 200],
  );
  assert.equal(lines[0].label, 'X-01 / Entré');
  assert.ok(lines.some((line) => line.label === 'X-02'));
  assert.ok(lines.some((line) => line.label === 'Tak'));
});

test('bubble text survives project files and undo/redo; malformed label arrays are rejected', () => {
  const project = createProject({
    grid,
    levels: { active: 'l', items: [{ id: 'l', name: 'Plan', elevation: 0 }] },
  });
  const history = new ProjectHistory();
  history.checkpoint(project);
  project.grid.labels.x[0] = 'Fasad';
  const reopened = parseProjectFile(serializeProject(project));
  assert.equal(gridLabel(reopened.grid, 'x', 0), 'Fasad');
  const restored = history.undo(project);
  assert.equal(gridLabel(restored.grid, 'x', 0), 'X-01');
  assert.equal(gridLabel(history.redo(restored).grid, 'x', 0), 'Fasad');
  for (const labels of [
    { x: ['one'] },
    { x: ['one', 2] },
    { x: ['', 'two'] },
    { x: ['a'.repeat(41), 'two'] },
  ]) {
    assert.throws(() => validateGridLabels({ ...grid, labels }), /beteckning/);
    project.grid.labels = labels;
    assert.throws(() => serializeProject(project), /beteckning/);
  }
  assert.doesNotThrow(() => validateGridLabels({ x: [0, 3000], y: [0, 4000] }));
});
