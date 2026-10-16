/** Shared screen-space policy. Geometry adapters supply candidates; no UI or project state. */
export const SNAP_PIXELS = Object.freeze({ exact: 12, tracking: 8, nearest: 5, retention: 2 });
const priorities = {
  endpoint: 0,
  center: 0,
  intersection: 0,
  midpoint: 1,
  quadrant: 1,
  perpendicular: 1,
  trackingIntersection: 2,
  tracking: 3,
  nearest: 4,
  grid: 5,
  free: 6,
};
export function snapType(kind = '') {
  if (kind in priorities) return kind;
  const text = String(kind).toLowerCase();
  if (/närmaste|nearest|^line$/.test(text)) return 'nearest';
  if (/mittpunkt|midpoint/.test(text)) return 'midpoint';
  if (/kvadrant|diamond/.test(text)) return 'quadrant';
  if (/vinkelrät|perpendicular/.test(text)) return 'perpendicular';
  if (/ändpunkt|hörn|square/.test(text)) return 'endpoint';
  if (/korsning|skärning/.test(text)) return 'intersection';
  if (/polar|riktning|låst|ortho|otrack|stomlinje|arbetsytans kant/.test(text)) return 'tracking';
  if (/rutsteg/.test(text)) return 'grid';
  if (/fritt|free|arbetsplanet/.test(text)) return 'free';
  if (/centrum|center/.test(text)) return 'center';
  return 'endpoint';
}
export const snapPriority = (type) => priorities[snapType(type)];
export const isTrackingAnchor = (kind) => snapPriority(kind) <= 1;
export function snapTolerance(type) {
  const priority = snapPriority(type);
  return priority <= 1
    ? SNAP_PIXELS.exact
    : priority <= 3
      ? SNAP_PIXELS.tracking
      : priority === 4
        ? SNAP_PIXELS.nearest
        : 0;
}
const samePoint = (a, b) => a?.length === b?.length && a.every((v, i) => Math.abs(v - b[i]) < 1e-7);
function nearer(a, b) {
  if (a.distance < b.distance - 1e-6) return true;
  if (Math.abs(a.distance - b.distance) > 1e-6) return false;
  // A named machining datum keeps its reference when a shaft projects onto the same point.
  if (!!a.featureId !== !!b.featureId) return !!a.featureId;
  return (a.depth ?? Infinity) < (b.depth ?? Infinity);
}
/** Retain only existing fixed candidates; higher-priority hits always win immediately. */
export function chooseSnap(candidates, previous = null) {
  let best = null,
    retained = null;
  for (const candidate of candidates) {
    const type = snapType(candidate.type || candidate.kind);
    const priority = snapPriority(type);
    const same =
      priority <= 1 &&
      previous &&
      snapType(previous.type || previous.label || previous.kind) === type &&
      samePoint(candidate.point, previous.point);
    if (
      !Number.isFinite(candidate.distance) ||
      candidate.distance >= snapTolerance(type) + (same ? SNAP_PIXELS.retention : 0)
    )
      continue;
    if (same) retained = candidate;
    if (
      !best ||
      priority < snapPriority(best.type || best.kind) ||
      (priority === snapPriority(best.type || best.kind) && nearer(candidate, best))
    )
      best = candidate;
  }
  return retained &&
    best &&
    snapPriority(retained.type || retained.kind) === snapPriority(best.type || best.kind) &&
    retained.distance <= best.distance + SNAP_PIXELS.retention
    ? retained
    : best;
}
