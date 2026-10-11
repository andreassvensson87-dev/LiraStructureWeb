import { validateShape } from './drawing-shapes.js';
import { insulationFrame } from './drawing-insulation.js';
import { lengthPoint } from './frame-model.js';

/** Point collection only; the controller owns style, snap, history and confirmation. */
export function pickShapePoint(draft, mode, hit, uuid = () => crypto.randomUUID()) {
  const current = draft || { id: uuid(), type: 'shape', shape: mode, view: hit.view, points: [] };
  if (
    current.points.length >= 3 &&
    ['polyline', 'polygon'].includes(mode) &&
    Math.hypot(current.points[0][0] - hit.point[0], current.points[0][1] - hit.point[1]) < 1e-7
  )
    return { draft: current, finish: 'closed' };
  if (current.points.some((p) => Math.hypot(p[0] - hit.point[0], p[1] - hit.point[1]) < 1e-7))
    return { draft: current, duplicate: true };
  const next = { ...current, points: [...current.points, [...hit.point]] };
  const required = mode === 'arc' ? 3 : ['polyline', 'polygon'].includes(mode) ? Infinity : 2;
  return { draft: next, finish: next.points.length === required ? 'open' : null };
}
export function completeShape(draft, close = false) {
  const closed = close || draft.shape === 'polygon';
  validateShape(draft.shape, draft.points, closed);
  if (draft.shape === 'insulation') insulationFrame(draft);
  return { ...draft, closed };
}
export function shapeLengthPoint(draft, hover, value) {
  const base = draft.points.at(-1);
  return lengthPoint(base, draft.shape === 'circle' ? [base[0] + 1, base[1]] : hover, value);
}
