import { parsePositions } from './grid-lines.js';
import { gridLabel, GRID_LABEL_MAX_LENGTH } from './grid-labels.js';

function rows(grid, axis) {
  if (!['x', 'y'].includes(axis)) throw Error('Välj X- eller Y-linjer.');
  return grid[axis].map((position, index) => ({ position, label: gridLabel(grid, axis, index) }));
}
function result(grid, axis, entries, selected) {
  parsePositions(entries.map((entry) => entry.position).join(' '));
  entries.sort((a, b) => a.position - b.position);
  const next = structuredClone(grid);
  next.labels = Object.fromEntries(
    ['x', 'y'].map((key) => [key, rows(grid, key).map((r) => r.label)]),
  );
  next[axis] = entries.map((r) => r.position);
  next.labels[axis] = entries.map((r) => r.label);
  return { grid: next, index: entries.indexOf(selected) };
}
export function changeGridLine(grid, axis, index, patch) {
  const entries = rows(grid, axis),
    entry = entries[index];
  if (!entry) throw Error('Markera en stomlinje.');
  if (patch.position !== undefined) entry.position = Number(patch.position);
  if (patch.label !== undefined) {
    const label = patch.label.trim();
    if (!label || label.length > GRID_LABEL_MAX_LENGTH)
      throw Error(`Ange en beteckning på 1–${GRID_LABEL_MAX_LENGTH} tecken.`);
    entry.label = label;
  }
  return result(grid, axis, entries, entry);
}
export function addGridLine(grid, axis, position) {
  const entries = rows(grid, axis),
    used = new Set(entries.map((r) => r.label));
  let index = 0,
    label;
  do {
    label = gridLabel({}, axis, index++);
  } while (used.has(label));
  const entry = { position: Number(position), label };
  return result(grid, axis, [...entries, entry], entry);
}
export function removeGridLine(grid, axis, index) {
  const entries = rows(grid, axis);
  if (!entries[index]) throw Error('Markera en stomlinje.');
  if (entries.length <= 2) throw Error('Behåll minst två stomlinjer per riktning.');
  entries.splice(index, 1);
  return result(grid, axis, entries, null);
}

export function gridSegmentDistance(point, a, b) {
  const dx = b[0] - a[0],
    dy = b[1] - a[1],
    length = dx * dx + dy * dy;
  const t = length
    ? Math.max(0, Math.min(1, ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / length))
    : 0;
  return Math.hypot(point[0] - a[0] - t * dx, point[1] - a[1] - t * dy);
}
