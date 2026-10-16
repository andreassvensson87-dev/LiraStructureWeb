// Tracking is scoped to a drawing view; retained points never cross view boundaries.
export class CadTracking {
  reset() {
    this.view = null;
    this.points = [];
    this.hover = null;
  }
  constructor() {
    this.reset();
  }
  locate(
    raw,
    { view = 'frame', snapped = false, point = raw, now = Date.now(), tolerance = 1 } = {},
  ) {
    if (view !== this.view) {
      this.reset();
      this.view = view;
    }
    if (this.hover && now - this.hover.since >= 350) {
      if (
        !this.points.some(
          (p) => Math.hypot(p[0] - this.hover.point[0], p[1] - this.hover.point[1]) < 1e-7,
        )
      )
        this.points = [...this.points.slice(-1), [...this.hover.point]];
    }
    if (snapped) {
      if (
        !this.hover ||
        Math.hypot(point[0] - this.hover.point[0], point[1] - this.hover.point[1]) > 1e-7
      )
        this.hover = { point: [...point], since: now };
      return { point: [...point], guides: [], anchors: this.points };
    }
    this.hover = null;
    const result = [...raw],
      guides = [];
    for (const axis of [0, 1]) {
      let best = tolerance,
        anchor = null;
      for (const p of this.points) {
        const d = Math.abs(raw[axis] - p[axis]);
        if (d < best) {
          best = d;
          anchor = p;
        }
      }
      if (anchor) {
        result[axis] = anchor[axis];
        guides.push({ anchor: [...anchor], axis });
      }
    }
    return { point: result, guides, anchors: this.points };
  }
}
export function cadDirectionSnap(point, base, { ortho = false, polar = 0, tolerance = 1 } = {}) {
  if (!base || (!ortho && !polar)) return null;
  const dx = point[0] - base[0],
    dy = point[1] - base[1];
  if (Math.hypot(dx, dy) < 1e-9) return null;
  const step = ((ortho ? 90 : polar) * Math.PI) / 180;
  const angle = Math.round(Math.atan2(dy, dx) / step) * step;
  const c = Math.cos(angle),
    s = Math.sin(angle),
    length = dx * c + dy * s;
  if (!ortho && Math.abs(dx * s - dy * c) > tolerance) return null;
  return { point: [base[0] + length * c, base[1] + length * s], kind: ortho ? 'Ortho' : 'Polar' };
}
export function constrainCadPoint(point, base, settings = {}) {
  return cadDirectionSnap(point, base, settings)?.point || [...point];
}

// Intersect the acquired tracking axis with the polar ray, rather than
// successively projecting onto two constraints and losing the first one.
export function polarTrackingIntersection(raw, base, tracking, { polar = 0, tolerance = 1 } = {}) {
  if (!base || !polar || tracking?.guides.length !== 1) return null;
  const { anchor, axis } = tracking.guides[0];
  const step = (polar * Math.PI) / 180;
  const angle = Math.round(Math.atan2(raw[1] - base[1], raw[0] - base[0]) / step) * step;
  const direction = [Math.cos(angle), Math.sin(angle)];
  if (Math.abs(direction[axis]) < 1e-9) return null;
  const distance = (anchor[axis] - base[axis]) / direction[axis];
  if (distance < 0) return null;
  const point = base.map((value, i) => value + distance * direction[i]);
  point[axis] = anchor[axis];
  return Math.hypot(point[0] - raw[0], point[1] - raw[1]) <= tolerance * 1.5 ? point : null;
}
