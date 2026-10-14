/** Transient measurement descriptors in source coordinates; no rendering or project state. */
export function distanceMeasure(a, b, value = null, kind = 'length') {
  if (!a || !b || a.length !== b.length || ![a, b].every((p) => p.every(Number.isFinite)))
    return [];
  value ??= Math.hypot(...a.map((v, i) => b[i] - v));
  return Number.isFinite(value) && value > 1e-7 ? [{ a: [...a], b: [...b], value, kind }] : [];
}
export function edgeMeasures(points, closed = false) {
  return points
    .slice(0, closed ? points.length : -1)
    .flatMap((p, i) => distanceMeasure(p, points[(i + 1) % points.length]));
}
export function boundsMeasures(points) {
  if (!points.length) return [];
  const min = points[0].map((_, i) => Math.min(...points.map((p) => p[i]))),
    max = points[0].map((_, i) => Math.max(...points.map((p) => p[i])));
  return min.flatMap((_, i) =>
    distanceMeasure(
      min,
      min.map((v, axis) => (axis === i ? max[i] : v)),
    ),
  );
}
export function cornerMeasures(path, closed = false, project = (p) => p.toArray()) {
  const result = path.corners
    .slice(0, closed ? path.corners.length : -1)
    .flatMap((corner, i) =>
      distanceMeasure(
        project(corner.exit),
        project(path.corners[(i + 1) % path.corners.length].entry),
      ),
    );
  for (const [index, corner] of path.corners.entries()) {
    if (!corner.radius) continue;
    const samples = path.samples.filter((p) => p.corner === index && p.center);
    if (samples.length)
      result.push(
        ...distanceMeasure(
          project(corner.center),
          project(samples[Math.floor(samples.length / 2)].point),
          corner.radius,
          'radius',
        ),
      );
  }
  return result;
}
