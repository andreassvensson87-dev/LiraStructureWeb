export const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
export function dimensionAxis(kind, points) {
  if (kind === 'horizontal') return [1, 0];
  if (kind === 'vertical') return [0, 1];
  const d = sub(points[1], points[0]),
    length = Math.hypot(...d);
  if (length < 1e-7) throw Error('Välj två olika punkter.');
  return d.map((v) => v / length);
}
export function orderedPoints(points, axis) {
  const sorted = points
    .map((point, index) => ({ point, index, t: dot(point, axis) }))
    .sort((a, b) => a.t - b.t);
  return sorted.filter((p, i) => i === 0 || Math.abs(p.t - sorted[i - 1].t) > 1e-5);
}
export function chainGeometry(item) {
  const axis = item.axis || dimensionAxis(item.kind, item.points),
    normal = [-axis[1], axis[0]],
    offset = dot(item.line, normal),
    points = orderedPoints(item.points, axis).map((p) => ({
      ...p,
      end: [axis[0] * p.t + normal[0] * offset, axis[1] * p.t + normal[1] * offset],
    }));
  return {
    axis,
    normal,
    points,
    segments: points
      .slice(1)
      .map((p, i) => ({ a: points[i].end, b: p.end, length: p.t - points[i].t })),
  };
}
export function insertDimensionPoint(item, point) {
  const axis = item.axis || dimensionAxis(item.kind, item.points);
  if (item.points.some((p) => Math.abs(dot(sub(p, point), axis)) < 1e-5)) return false;
  item.points.push(point);
  return true;
}
export function moveDimensionPoint(item, index, point) {
  const axis = item.axis || dimensionAxis(item.kind, item.points);
  if (item.points.some((p, i) => i !== index && Math.abs(dot(sub(p, point), axis)) < 1e-5))
    return false;
  item.points[index] = [...point];
  return true;
}

export function formatDimension(length, precision) {
  if (precision === undefined) return Number(length.toFixed(1)).toLocaleString('sv-SE');
  if (!Number.isInteger(precision) || precision < 0 || precision > 3)
    throw Error('Välj 0–3 decimaler.');
  return length.toLocaleString('sv-SE', {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  });
}
export function holeDimensionPoints(candidates, reference, kind) {
  if (reference?.kind !== 'bore') return [];
  const points = candidates.filter(
    (p) => p.reference?.kind === 'bore' && p.reference.source === reference.source,
  );
  const axis = dimensionAxis(kind, points);
  return orderedPoints(points, axis).map((p) => p.point);
}
export function dimensionPaperOffset(item, project, unit) {
  const axis = item.axis || dimensionAxis(item.kind, item.points),
    normal = [-axis[1], axis[0]];
  const a = project(item.points[0]),
    b = project(item.points[0].map((v, i) => v + normal[i]));
  const factor = Math.hypot(b[0] - a[0], b[1] - a[1]) / unit;
  return { value: dot(sub(item.line, item.points[0]), normal) * factor, factor, normal };
}
export function setDimensionPaperOffset(item, value, project, unit) {
  const { factor, normal } = dimensionPaperOffset(item, project, unit);
  if (!Number.isFinite(value) || Math.abs(value) > 500 || !(factor > 0))
    throw Error('Ange ett avstånd mellan −500 och 500 mm.');
  return item.points[0].map((v, i) => v + (normal[i] * value) / factor);
}
