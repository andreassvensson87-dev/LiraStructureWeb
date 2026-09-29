import { validatePlate } from './plate.js';
const cross = (a, b) => a[0] * b[1] - a[1] * b[0];
// Intersect adjacent parallel-shifted edges. Preserve winding and reject topology changes.
export function offsetPlate(source, distance) {
  if (!Number.isFinite(distance)) throw Error('Ange ett giltigt avstånd i mm.');
  const invalid = validatePlate(source);
  if (invalid) throw Error(invalid);
  const result = structuredClone(source);
  if (distance === 0) return result;
  const points = source.polygon,
    n = points.length;
  const sign = Math.sign(points.reduce((sum, p, i) => sum + cross(p, points[(i + 1) % n]), 0));
  const edges = points.map((p, i) => {
    const q = points[(i + 1) % n],
      length = Math.hypot(q[0] - p[0], q[1] - p[1]),
      d = [(q[0] - p[0]) / length, (q[1] - p[1]) / length];
    return { d, p: [p[0] + sign * d[1] * distance, p[1] - sign * d[0] * distance] };
  });
  result.polygon = edges.map((edge, i) => {
    const previous = edges[(i + n - 1) % n],
      denom = cross(previous.d, edge.d);
    if (Math.abs(denom) < 1e-10) {
      if (previous.d[0] * edge.d[0] + previous.d[1] * edge.d[1] < 0)
        throw Error('Konturen kan inte förskjutas vid ett överlappande hörn.');
      return edge.p;
    }
    const t = cross([edge.p[0] - previous.p[0], edge.p[1] - previous.p[1]], edge.d) / denom;
    return [previous.p[0] + previous.d[0] * t, previous.p[1] + previous.d[1] * t];
  });
  for (let i = 0; i < n; i++) {
    const a = result.polygon[i],
      b = result.polygon[(i + 1) % n],
      d = edges[i].d;
    if ((b[0] - a[0]) * d[0] + (b[1] - a[1]) * d[1] < 1)
      throw Error('Offseten är för stor: en kant kollapsar. Välj ett mindre avstånd.');
  }
  const error = validatePlate(result);
  if (error) throw Error(error);
  return result;
}
