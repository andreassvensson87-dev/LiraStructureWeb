import { gridLabel } from './grid-labels.js';

/** Legacy coordinate grids remain readable; edited lines own their endpoints and stable identity. */
export function gridSegments(grid) {
  return ['x', 'y'].flatMap((axis) =>
    grid[axis].map((position, index) => {
      const line = grid.lines?.[axis]?.[index];
      const other = grid[axis === 'x' ? 'y' : 'x'];
      return {
        axis,
        index,
        id: line?.id ?? `${axis}:${index}`,
        pickId: `${axis}:${index}`,
        label: gridLabel(grid, axis, index),
        start:
          line?.start ?? (axis === 'x' ? [position, other[0] - 1500] : [other[0] - 1500, position]),
        end:
          line?.end ??
          (axis === 'x' ? [position, other.at(-1) + 1500] : [other.at(-1) + 1500, position]),
      };
    }),
  );
}
export function gridWithGeometry(grid) {
  const next = structuredClone(grid);
  if (!next.lines)
    next.lines = Object.fromEntries(
      ['x', 'y'].map((axis) => [
        axis,
        gridSegments(grid)
          .filter((line) => line.axis === axis)
          .map(({ id, start, end }) => ({ id, start: [...start], end: [...end] })),
      ]),
    );
  return next;
}
export function lineIntersection(a, b, c, d, finite = true) {
  const u = [b[0] - a[0], b[1] - a[1]],
    v = [d[0] - c[0], d[1] - c[1]],
    w = [c[0] - a[0], c[1] - a[1]],
    den = u[0] * v[1] - u[1] * v[0];
  if (Math.abs(den) < 1e-9) return null;
  const t = (w[0] * v[1] - w[1] * v[0]) / den,
    s = (w[0] * u[1] - w[1] * u[0]) / den;
  if (finite && (t < -1e-9 || t > 1 + 1e-9 || s < -1e-9 || s > 1 + 1e-9)) return null;
  return [a[0] + t * u[0], a[1] + t * u[1]];
}
export function gridCrossings(grid) {
  const lines = gridSegments(grid),
    result = [];
  for (let i = 0; i < lines.length; i++)
    for (let j = i + 1; j < lines.length; j++) {
      const point = lineIntersection(lines[i].start, lines[i].end, lines[j].start, lines[j].end);
      if (point) result.push({ point, lines: [lines[i], lines[j]] });
    }
  return result;
}
export function gridProjection(point, line) {
  const [a, b] = [line.start, line.end],
    dx = b[0] - a[0],
    dy = b[1] - a[1];
  const t = ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / (dx * dx + dy * dy);
  return { t, point: [a[0] + t * dx, a[1] + t * dy] };
}
export function validateGridGeometry(grid) {
  if (grid.bubbleEnds !== undefined && !['both', 'start', 'end'].includes(grid.bubbleEnds))
    throw Error('Ogiltig bubbelvisning.');
  if (grid.bubbleScale !== undefined && ![0.8, 1, 1.25].includes(grid.bubbleScale))
    throw Error('Ogiltig bubbelstorlek.');
  if (
    grid.nextLineId !== undefined &&
    (!Number.isSafeInteger(grid.nextLineId) || grid.nextLineId < 1 || grid.nextLineId > 1000000000)
  )
    throw Error('Ogiltig stomlinjeidentitet.');
  if (grid.lines === undefined) return;
  const ids = new Set();
  if (!grid.lines || typeof grid.lines !== 'object' || Array.isArray(grid.lines))
    throw Error('Ogiltiga stomlinjer.');
  for (const axis of ['x', 'y']) {
    const lines = grid.lines[axis];
    if (!Array.isArray(lines) || lines.length !== grid[axis].length)
      throw Error('Stomlinjernas geometri och beteckningar stämmer inte överens.');
    for (const line of lines) {
      if (
        !line ||
        typeof line.id !== 'string' ||
        !line.id ||
        line.id.length > 100 ||
        ids.has(line.id) ||
        ![line.start, line.end].every(
          (p) =>
            Array.isArray(p) &&
            p.length === 2 &&
            p.every((v) => Number.isFinite(v) && Math.abs(v) <= 1000000),
        ) ||
        Math.hypot(line.end[0] - line.start[0], line.end[1] - line.start[1]) < 0.001
      )
        throw Error('Ange två olika ändpunkter inom ±1 000 000 mm.');
      ids.add(line.id);
    }
  }
}
