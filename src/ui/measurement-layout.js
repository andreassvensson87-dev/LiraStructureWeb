/** Screen-space layout shared by model and drawing feedback. Source values stay in mm. */
export function measurementLayout(measure, project, pixelScale = 1) {
  const a = project(measure.a, measure),
    b = project(measure.b, measure);
  if (![a, b].every((p) => p?.length >= 2 && p.every(Number.isFinite)) || pixelScale <= 0)
    return null;
  const dx = (b[0] - a[0]) * pixelScale,
    dy = (b[1] - a[1]) * pixelScale,
    length = Math.hypot(dx, dy);
  if (length < 12) return null;
  const u = [dx / length, dy / length],
    n = [-u[1], u[0]],
    k = 1 / pixelScale,
    offset = measure.kind === 'radius' ? 14 : 24,
    q = a.map((v, i) => v + n[i] * offset * k),
    r = b.map((v, i) => v + n[i] * offset * k),
    center = q.map((v, i) => (v + r[i]) / 2),
    angle = (Math.atan2(dy, dx) * 180) / Math.PI,
    label =
      (measure.kind === 'radius' ? 'R ' : '') +
      measure.value.toLocaleString('sv-SE', { maximumFractionDigits: 0 }),
    gap = (label.length * 6 + 12) / 2;
  const point = (p, along = 0, across = 0) =>
    p.map((v, i) => v + (u[i] * along + n[i] * across) * k);
  const lines = [
    [point(a, 0, 4), point(q, 0, 4)],
    [point(b, 0, 4), point(r, 0, 4)],
  ];
  if (length > gap * 2 + 12) lines.push([q, point(center, -gap)], [point(center, gap), r]);
  else lines.push([q, r]);
  // Fine ticks read clearly on short spans without large arrowheads.
  lines.push([point(q, -3, -3), point(q, 3, 3)], [point(r, -3, -3), point(r, 3, 3)]);
  return {
    lines,
    center: length > gap * 2 + 12 ? center : point(center, 0, -9),
    label,
    angle: angle > 90 ? angle - 180 : angle < -90 ? angle + 180 : angle,
    fontSize: 11 * k,
    bounds: [
      center[0] * pixelScale - gap,
      center[1] * pixelScale - 9,
      center[0] * pixelScale + gap,
      center[1] * pixelScale + 9,
    ],
  };
}
