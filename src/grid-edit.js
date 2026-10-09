import { gridWithGeometry, validateGridGeometry } from './grid-geometry.js';
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
  if (
    grid.lines ||
    ['start', 'end', 'angle', 'translation'].some((key) => patch[key] !== undefined)
  ) {
    const next = gridWithGeometry(grid),
      line = next.lines[axis]?.[index];
    if (!line) throw Error('Markera en stomlinje.');
    next.labels = Object.fromEntries(
      ['x', 'y'].map((key) => [key, rows(grid, key).map((row) => row.label)]),
    );
    if (patch.label !== undefined) {
      const label = patch.label.trim();
      if (!label || label.length > GRID_LABEL_MAX_LENGTH)
        throw Error(`Ange en beteckning på 1–${GRID_LABEL_MAX_LENGTH} tecken.`);
      next.labels[axis][index] = label;
    }
    if (patch.start) line.start = patch.start.map(Number);
    if (patch.end) line.end = patch.end.map(Number);
    if (patch.angle !== undefined) {
      const radians = (Number(patch.angle) * Math.PI) / 180,
        length = Math.hypot(line.end[0] - line.start[0], line.end[1] - line.start[1]),
        center = line.start.map((v, i) => (v + line.end[i]) / 2),
        offset = [(Math.cos(radians) * length) / 2, (Math.sin(radians) * length) / 2];
      line.start = center.map((v, i) => v - offset[i]);
      line.end = center.map((v, i) => v + offset[i]);
    }
    const translation =
      patch.translation ??
      (patch.position !== undefined
        ? axis === 'x'
          ? [Number(patch.position) - line.start[0], 0]
          : [0, Number(patch.position) - line.start[1]]
        : null);
    if (translation) {
      line.start = line.start.map((v, i) => v + translation[i]);
      line.end = line.end.map((v, i) => v + translation[i]);
      const component = axis === 'x' ? 0 : 1,
        value = next[axis][index] + translation[component];
      if (
        Number.isFinite(value) &&
        Math.abs(value) <= 1000000 &&
        !next[axis].some((v, i) => i !== index && v === value)
      )
        next[axis][index] = value;
    }
    validateGridGeometry(next);
    return { grid: next, index };
  }
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
export function addGridLine(grid, axis, position, endpoints) {
  if (grid.lines || endpoints) {
    const next = gridWithGeometry(grid);
    if (next[axis].length >= 20) throw Error('Högst 20 stomlinjer per grupp.');
    const used = new Set(rows(grid, axis).map((row) => row.label));
    let n = 0,
      label;
    do {
      label = gridLabel({}, axis, n++);
    } while (used.has(label));
    const ids = new Set([...next.lines.x, ...next.lines.y].map((line) => line.id));
    let sequence = next.nextLineId ?? 1;
    while (ids.has(`grid:${sequence}`)) sequence++;
    const id = `grid:${sequence}`;
    next.nextLineId = sequence + 1;
    let value = Number(position);
    while (next[axis].includes(value)) value += 1;
    if (value > 1000000) {
      value = -1000000;
      while (next[axis].includes(value)) value += 1;
    }
    parsePositions([...next[axis], value].join(' '));
    next[axis].push(value);
    next.labels = Object.fromEntries(
      ['x', 'y'].map((key) => [key, rows(grid, key).map((row) => row.label)]),
    );
    next.labels[axis].push(label);
    next.lines[axis].push({
      id,
      start:
        endpoints?.start ?? (axis === 'x' ? [value, grid.y[0] - 1500] : [grid.x[0] - 1500, value]),
      end:
        endpoints?.end ??
        (axis === 'x' ? [value, grid.y.at(-1) + 1500] : [grid.x.at(-1) + 1500, value]),
    });
    validateGridGeometry(next);
    return { grid: next, index: next[axis].length - 1 };
  }
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
  if (grid.lines) {
    if (!grid.lines[axis]?.[index]) throw Error('Markera en stomlinje.');
    if (grid[axis].length <= 2) throw Error('Behåll minst två stomlinjer per grupp.');
    const next = structuredClone(grid);
    next.labels = Object.fromEntries(
      ['x', 'y'].map((key) => [key, rows(grid, key).map((row) => row.label)]),
    );
    next[axis].splice(index, 1);
    next.labels[axis].splice(index, 1);
    next.lines[axis].splice(index, 1);
    return { grid: next, index: -1 };
  }
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

export function parallelGridLine(grid, axis, index, distance) {
  const source = gridWithGeometry(grid).lines[axis]?.[index];
  if (!source) throw Error('Markera en stomlinje.');
  const dx = source.end[0] - source.start[0],
    dy = source.end[1] - source.start[1],
    length = Math.hypot(dx, dy),
    offset = [(-dy / length) * Number(distance), (dx / length) * Number(distance)];
  if (!Number.isFinite(Number(distance)) || Math.abs(Number(distance)) < 0.001)
    throw Error('Ange ett avstånd från den markerade linjen.');
  return addGridLine(grid, axis, grid[axis][index], {
    start: source.start.map((v, i) => v + offset[i]),
    end: source.end.map((v, i) => v + offset[i]),
  });
}
