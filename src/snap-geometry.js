// Finite geometric projections shared by model and drawing snapping.
export function segmentParameter(point, a, b) {
  const delta = b.map((v, i) => v - a[i]);
  const length = delta.reduce((sum, v) => sum + v * v, 0);
  return length > 1e-12
    ? delta.reduce((sum, v, i) => sum + (point[i] - a[i]) * v, 0) / length
    : null;
}
export function segmentPoint(a, b, t) {
  return a.map((v, i) => v + (b[i] - v) * t);
}
export function perpendicularPoint(base, a, b) {
  const t = segmentParameter(base, a, b);
  if (t === null || t < 0 || t > 1) return null;
  const point = segmentPoint(a, b, t);
  return Math.hypot(...point.map((v, i) => v - base[i])) > 1e-8 ? point : null;
}
export function nearestSegmentPoint(raw, a, b) {
  const t = segmentParameter(raw, a, b);
  return t === null ? null : segmentPoint(a, b, Math.max(0, Math.min(1, t)));
}
