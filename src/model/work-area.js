import * as THREE from 'three';

export const defaultWorkArea = () => ({ rectangle: null, lower: -500, upper: 3000 });
export function validateWorkArea(area) {
  if (
    !area ||
    !Number.isFinite(area.lower) ||
    !Number.isFinite(area.upper) ||
    area.lower >= area.upper
  )
    throw Error('Övre plushöjd måste vara högre än nedre plushöjd.');
  if (
    area.rectangle !== null &&
    (!Array.isArray(area.rectangle) ||
      area.rectangle.length !== 4 ||
      !area.rectangle.every(Number.isFinite) ||
      area.rectangle[0] >= area.rectangle[2] ||
      area.rectangle[1] >= area.rectangle[3])
  )
    throw Error('Välj två motstående hörn med olika X- och Y-lägen.');
  return area;
}
export function workAreaFromCorners(area, a, b) {
  const rectangle = [
    Math.min(a[0], b[0]),
    Math.min(a[1], b[1]),
    Math.max(a[0], b[0]),
    Math.max(a[1], b[1]),
  ];
  return validateWorkArea({ ...area, rectangle });
}
export function workAreaBounds(area) {
  if (!area?.rectangle) return null;
  validateWorkArea(area);
  const [x0, y0, x1, y1] = area.rectangle;
  return new THREE.Box3(
    new THREE.Vector3(x0, y0, area.lower),
    new THREE.Vector3(x1, y1, area.upper),
  );
}
/** Fit a fresh box to complete geometry, independent of the previous crop. */
export function workAreaFromBounds(bounds, padding = 100) {
  if (!bounds || bounds.isEmpty()) return null;
  return validateWorkArea({
    rectangle: [
      bounds.min.x - padding,
      bounds.min.y - padding,
      bounds.max.x + padding,
      bounds.max.y + padding,
    ],
    lower: bounds.min.z - padding,
    upper: bounds.max.z + padding,
  });
}
export function withinWorkArea(bounds, point) {
  return (
    !bounds ||
    point.every(
      (v, i) => v >= bounds.min.getComponent(i) - 1e-6 && v <= bounds.max.getComponent(i) + 1e-6,
    )
  );
}
export function expandWorkArea(area, referenceBounds) {
  const current = workAreaBounds(area);
  if (!current || referenceBounds.isEmpty() || current.containsBox(referenceBounds)) return null;
  const box = current.clone().union(referenceBounds);
  return validateWorkArea({
    rectangle: [box.min.x, box.min.y, box.max.x, box.max.y],
    lower: box.min.z,
    upper: box.max.z,
  });
}
export function parseElevation(text) {
  const normalized = String(text).trim().replace(',', '.').replace('−', '-');
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalized))
    throw Error('Ange en giltig plushöjd i meter.');
  const value = Number(normalized) * 1000;
  if (!Number.isFinite(value) || Math.abs(value) > 1e9) throw Error('Plushöjden är för stor.');
  return value;
}
export const formatElevation = (value) =>
  (value >= 0 ? '+' : '') +
  (value / 1000).toLocaleString('sv-SE', {
    minimumFractionDigits: 3,
    maximumFractionDigits: 6,
    useGrouping: false,
  });

/** Clip geometry for selection only; never change model vertices or manufacture cut faces. */
export function clipPolygonToBox(polygon, box) {
  if (!box) return polygon;
  let points = polygon;
  for (let axis = 0; axis < 3; axis++)
    for (const side of ['min', 'max']) {
      const limit = box[side].getComponent(axis),
        inside = (p) => (side === 'min' ? p[axis] >= limit : p[axis] <= limit);
      const next = [];
      for (let i = 0; i < points.length; i++) {
        const a = points[i],
          b = points[(i + 1) % points.length],
          ai = inside(a),
          bi = inside(b);
        if (ai) next.push(a);
        if (ai !== bi) {
          const t = (limit - a[axis]) / (b[axis] - a[axis]);
          next.push(a.map((v, j) => v + (b[j] - v) * t));
        }
      }
      points = next;
    }
  return points;
}
export function clipSegmentToBox(a, b, box) {
  if (!box) return [a, b];
  let lo = 0,
    hi = 1;
  for (let i = 0; i < 3; i++) {
    const d = b[i] - a[i],
      min = box.min.getComponent(i),
      max = box.max.getComponent(i);
    if (Math.abs(d) < 1e-12) {
      if (a[i] < min || a[i] > max) return null;
      continue;
    }
    const t0 = (min - a[i]) / d,
      t1 = (max - a[i]) / d;
    lo = Math.max(lo, Math.min(t0, t1));
    hi = Math.min(hi, Math.max(t0, t1));
    if (lo > hi) return null;
  }
  return [lo, hi].map((t) => a.map((v, i) => v + (b[i] - v) * t));
}
