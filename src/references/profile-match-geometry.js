const distance = (p, a, b) => {
  const dx = b[0] - a[0],
    dy = b[1] - a[1],
    den = dx * dx + dy * dy;
  const t = den ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / den)) : 0;
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
};
const error = (a, b) =>
  Math.max(...a.map((p) => Math.min(...b.map((q, i) => distance(p, q, b[(i + 1) % b.length])))));
/** Compare contours in their centroid frames; report rotation and actual deviations. */
export function profileGeometryMatch(
  geometry,
  section,
  { linear = 0.03, area = 1e-4, bounds: boundsTolerance = linear } = {},
) {
  if (!geometry?.loops?.length || geometry.loops.length !== section.loops.length) return null;
  const { loops, properties } = geometry;
  const areaError = Math.abs(properties.A - section.properties.A) / section.properties.A;
  if (!Number.isFinite(areaError) || areaError > area) return null;
  const centered = loops.map((loop) =>
    loop.map(([x, y]) => [x - properties.cx, y - properties.cy]),
  );
  const target = section.loops.map((loop) =>
    loop.map(([x, y]) => [x - section.properties.cx, y - section.properties.cy]),
  );
  const angles = [0];
  for (let i = 0; i < centered[0].length; i++) {
    const p = centered[0][i],
      q = centered[0][(i + 1) % centered[0].length];
    if (Math.hypot(q[0] - p[0], q[1] - p[1]) < 5) continue;
    const angle = ((Math.atan2(q[1] - p[1], q[0] - p[0]) % Math.PI) + Math.PI) % Math.PI;
    if (!angles.some((a) => Math.abs(a - angle) < 1e-5)) angles.push(angle);
  }
  let best = null;
  for (const angle of angles) {
    const c = Math.cos(angle),
      s = Math.sin(angle),
      aligned = centered.map((loop) => loop.map(([x, y]) => [c * x + s * y, -s * x + c * y]));
    const xs = aligned[0].map((p) => p[0]),
      ys = aligned[0].map((p) => p[1]);
    const bounds = section.properties.bounds;
    if (
      Math.abs(Math.max(...xs) - Math.min(...xs) - bounds.width) > boundsTolerance ||
      Math.abs(Math.max(...ys) - Math.min(...ys) - bounds.height) > boundsTolerance
    )
      continue;
    // Match holes independently of the order in which the exporter wrote them.
    const remaining = new Set(target.map((_, i) => i));
    let deviation = 0;
    for (let i = 0; i < aligned.length; i++) {
      let selected = -1,
        smallest = Infinity;
      for (const j of remaining) {
        if ((i === 0) !== (j === 0)) continue;
        const d = Math.max(error(aligned[i], target[j]), error(target[j], aligned[i]));
        if (d < smallest) {
          smallest = d;
          selected = j;
        }
      }
      deviation = Math.max(deviation, smallest);
      remaining.delete(selected);
    }
    if (deviation <= linear && (!best || deviation < best.contourError))
      best = { rotation: (-angle * 180) / Math.PI, contourError: deviation, areaError };
  }
  return best;
}
