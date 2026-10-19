import { validateShape } from './drawing-shapes.js';

/** Insert on the nearest existing edge; the ordinary vertex grip edits its position. */
export function insertDrawingVertex(item, point) {
  const next = structuredClone(item);
  const closed = item.shape === 'polygon' || item.closed;
  let best = null;
  for (let i = 0; i < item.points.length - (closed ? 0 : 1); i++) {
    const a = item.points[i],
      b = item.points[(i + 1) % item.points.length];
    const delta = b.map((v, k) => v - a[k]);
    const length2 = delta.reduce((sum, v) => sum + v * v, 0);
    if (!length2) continue;
    const t = Math.max(
      0,
      Math.min(1, point.reduce((sum, v, k) => sum + (v - a[k]) * delta[k], 0) / length2),
    );
    const projected = a.map((v, k) => v + t * delta[k]);
    const distance = Math.hypot(...point.map((v, k) => v - projected[k]));
    if (!best || distance < best.distance) best = { index: i + 1, projected, distance };
  }
  if (
    !best ||
    item.points.some((p) => Math.hypot(...p.map((v, k) => v - best.projected[k])) < 1e-7)
  )
    throw Error('Välj en punkt mellan två befintliga hörn.');
  next.points.splice(best.index, 0, best.projected);
  validateShape(next.shape, next.points, closed);
  return next;
}

export function removeDrawingVertex(item, index) {
  const next = structuredClone(item);
  if (!Number.isInteger(index) || index < 0 || index >= next.points.length)
    throw Error('Välj ett hörn.');
  next.points.splice(index, 1);
  validateShape(next.shape, next.points, next.closed);
  return next;
}
