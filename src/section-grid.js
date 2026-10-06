import { gridLabel } from './grid-labels.js';
// Intersect a world coordinate plane with the visible rectangle of a section.
function planeLine(frame, axis, value, [left, bottom, right, top]) {
  const a = frame.x[axis],
    b = frame.y[axis],
    c = value - frame.origin[axis];
  if (Math.hypot(a, b) < 1e-9) return null;
  const points = [],
    add = (x, y) => {
      if (
        x >= left - 1e-6 &&
        x <= right + 1e-6 &&
        y >= bottom - 1e-6 &&
        y <= top + 1e-6 &&
        !points.some((p) => Math.hypot(p[0] - x, p[1] - y) < 1e-6)
      )
        points.push([x, y]);
    };
  if (Math.abs(b) > 1e-9) {
    add(left, (c - a * left) / b);
    add(right, (c - a * right) / b);
  }
  if (Math.abs(a) > 1e-9) {
    add((c - b * bottom) / a, bottom);
    add((c - b * top) / a, top);
  }
  return points.length >= 2 ? points.slice(0, 2) : null;
}
export function sectionGridLines(grid, frame, bounds) {
  const lines = [];
  for (const [axis, values] of [
    [0, grid.x],
    [1, grid.y],
  ])
    for (const [index, value] of values.entries()) {
      const points = planeLine(frame, axis, value, bounds);
      if (!points) continue;
      const label = gridLabel(grid, axis === 0 ? 'x' : 'y', index);
      const same = lines.find((line) =>
        points.every((p) => line.points.some((q) => Math.hypot(p[0] - q[0], p[1] - q[1]) < 1e-6)),
      );
      if (same) same.label += ' / ' + label;
      else lines.push({ label, points });
    }
  return lines;
}
export function sectionLevelLines(levels, frame, bounds) {
  return levels.flatMap((level) => {
    const points = planeLine(frame, 2, level.elevation, bounds);
    return points ? [{ id: level.id, name: level.name, elevation: level.elevation, points }] : [];
  });
}
