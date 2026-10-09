import { gridSegments } from './grid-geometry.js';
export function snapDrawingGrid(point, grid, tolerance) {
  if (grid.lines)
    return snapDrawingLines(
      point,
      gridSegments(grid).map((line) => [line.start, line.end]),
      tolerance,
    );
  const nearest = (values, value) =>
      values.reduce(
        (best, v) => (Math.abs(v - value) < Math.abs(best - value) ? v : best),
        Infinity,
      ),
    x = nearest(grid.x, point[0]),
    y = nearest(grid.y, point[1]);
  const sx =
      Math.abs(x - point[0]) <= tolerance &&
      point[1] >= grid.y[0] - 1500 &&
      point[1] <= grid.y.at(-1) + 1500,
    sy =
      Math.abs(y - point[1]) <= tolerance &&
      point[0] >= grid.x[0] - 1500 &&
      point[0] <= grid.x.at(-1) + 1500;
  return sx || sy ? [sx ? x : point[0], sy ? y : point[1]] : null;
}
export function snapDrawingLines(point, lines, tolerance) {
  let best = null,
    distance = tolerance;
  const consider = (p) => {
    const d = Math.hypot(p[0] - point[0], p[1] - point[1]);
    if (d <= distance) {
      distance = d;
      best = p;
    }
  };
  // Prefer intersections before nearest points on individual reference lines.
  for (let i = 0; i < lines.length; i++)
    for (let j = i + 1; j < lines.length; j++) {
      const [a, b] = lines[i],
        [c, d] = lines[j],
        u = [b[0] - a[0], b[1] - a[1]],
        v = [d[0] - c[0], d[1] - c[1]],
        den = u[0] * v[1] - u[1] * v[0];
      if (Math.abs(den) < 1e-9) continue;
      const w = [c[0] - a[0], c[1] - a[1]],
        t = (w[0] * v[1] - w[1] * v[0]) / den,
        s = (w[0] * u[1] - w[1] * u[0]) / den;
      if (t >= 0 && t <= 1 && s >= 0 && s <= 1) consider([a[0] + t * u[0], a[1] + t * u[1]]);
    }
  if (best) return best;
  for (const [a, b] of lines) {
    const x = b[0] - a[0],
      y = b[1] - a[1],
      length = x * x + y * y;
    if (!length) continue;
    const t = Math.max(0, Math.min(1, ((point[0] - a[0]) * x + (point[1] - a[1]) * y) / length));
    consider([a[0] + t * x, a[1] + t * y]);
  }
  return best;
}
