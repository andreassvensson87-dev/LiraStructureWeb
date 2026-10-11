import { shapeSnapPoints } from './drawing-shapes.js';
import { dimensionAxis } from './dimension-chain.js';

export function transformableDrawingObject(item) {
  return ['shape', 'dimension', 'leader', 'richtext'].includes(item?.type);
}

function selection(items, ids) {
  const chosen = items.filter((item) => ids.includes(item.id));
  if (
    !chosen.length ||
    chosen.some((item) => !transformableDrawingObject(item) || item.view !== chosen[0].view)
  )
    throw Error('Välj ritobjekt i samma vy eller text på bladet.');
  return chosen;
}

function transformed(items, ids, point, angle = 0, copy = false) {
  const chosen = selection(items, ids),
    links = new Map();
  return chosen.map((item) => {
    const next = structuredClone(item);
    if (copy) next.id = crypto.randomUUID();
    const points = angle && item.shape === 'rectangle' ? shapeSnapPoints(item) : item.points;
    next.points = points.map(point);
    if (angle && item.shape === 'rectangle')
      Object.assign(next, { shape: 'polyline', closed: true });
    if (item.line) next.line = point(item.line);
    if (item.type === 'richtext') next.rotation = (item.rotation || 0) + (angle * 180) / Math.PI;
    if (item.type === 'dimension') {
      const axis = item.axis || dimensionAxis(item.kind, item.points);
      next.axis = [
        axis[0] * Math.cos(angle) - axis[1] * Math.sin(angle),
        axis[0] * Math.sin(angle) + axis[1] * Math.cos(angle),
      ];
      if (angle) next.kind = 'free';
      // A transformed annotation has new anchors; stale model references must not pull it back.
      next.references = next.points.map(() => null);
      delete next.sourceId;
      if (next.dimensionLinkId) {
        if (!links.has(next.dimensionLinkId)) links.set(next.dimensionLinkId, crypto.randomUUID());
        next.dimensionLinkId = links.get(next.dimensionLinkId);
      }
    }
    if (item.type === 'leader') {
      next.references = next.points.map(() => null);
    }
    return next;
  });
}

export function translatedShapes(items, ids, from, to, copy = false) {
  if (![from, to].every((p) => p?.length === 2 && p.every(Number.isFinite)))
    throw Error('Ange giltiga punkter.');
  const delta = to.map((v, i) => v - from[i]);
  if (Math.hypot(...delta) < 1e-7) throw Error('Välj en annan tillpunkt.');
  return transformed(items, ids, (p) => p.map((v, i) => v + delta[i]), 0, copy);
}

export function rotatedShapes(items, ids, center, angle) {
  if (
    !center?.every(Number.isFinite) ||
    center.length !== 2 ||
    !Number.isFinite(angle) ||
    Math.abs(angle % (2 * Math.PI)) < 1e-9
  )
    throw Error('Ange en vinkel som ändrar objektens riktning.');
  const c = Math.cos(angle),
    s = Math.sin(angle);
  return transformed(
    items,
    ids,
    ([x, y]) => [
      center[0] + (x - center[0]) * c - (y - center[1]) * s,
      center[1] + (x - center[0]) * s + (y - center[1]) * c,
    ],
    angle,
  );
}

export function rotationAngle(center, reference, target) {
  if ([reference, target].some((p) => Math.hypot(p[0] - center[0], p[1] - center[1]) < 1e-7))
    throw Error('Välj en riktning en bit från rotationscentrum.');
  const a =
    Math.atan2(target[1] - center[1], target[0] - center[0]) -
    Math.atan2(reference[1] - center[1], reference[0] - center[0]);
  return Math.atan2(Math.sin(a), Math.cos(a));
}
