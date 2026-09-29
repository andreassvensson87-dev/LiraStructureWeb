export const FRAME_LIBRARY_KEY = 'lirastructure.drawing-frames.v1';
export { ATTRIBUTE_KEY, builtInAttributes, attributeValue } from './drawing-attributes.js';
export function blankFrame() {
  return {
    id: crypto.randomUUID(),
    kind: 'block',
    name: 'Nytt ramblock',
    origin: [0, 0],
    width: 420,
    height: 297,
    entities: [],
  };
}
export const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]],
  cross = (a, b) => a[0] * b[1] - a[1] * b[0];
export function segments(entities) {
  return entities
    .filter((e) => e.type === 'line')
    .flatMap((e) => e.points.slice(1).map((p, i) => [e.points[i], p]));
}
export function intersection(a, b, c, d) {
  const r = sub(b, a),
    s = sub(d, c),
    den = cross(r, s);
  if (Math.abs(den) < 1e-10) return null;
  const t = cross(sub(c, a), s) / den,
    u = cross(sub(c, a), r) / den;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? [a[0] + t * r[0], a[1] + t * r[1]] : null;
}
export function snapFrame(
  raw,
  {
    entities,
    base = null,
    tolerance = 2,
    endpoints = true,
    midpoints = true,
    intersections = true,
    perpendicular = true,
    ortho = false,
    polar = 0,
    grid = false,
    step = 5,
    bounds = null,
  },
) {
  const border = bounds
    ? [
        [0, 0],
        [bounds[0], 0],
        [bounds[0], bounds[1]],
        [0, bounds[1]],
        [0, 0],
      ]
    : null;
  const snapEntities = border ? [...entities, { type: 'line', points: border }] : entities;
  const lines = segments(snapEntities),
    candidates = [];
  if (endpoints)
    for (const e of snapEntities)
      for (const p of e.type === 'line' ? e.points : [e.point])
        candidates.push({ point: p, kind: 'Ändpunkt' });
  if (midpoints)
    for (const [a, b] of lines)
      candidates.push({ point: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], kind: 'Mittpunkt' });
  if (intersections)
    for (let i = 0; i < lines.length; i++)
      for (let j = i + 1; j < lines.length; j++) {
        const p = intersection(...lines[i], ...lines[j]);
        if (p) candidates.push({ point: p, kind: 'Korsning' });
      }
  if (perpendicular && base)
    for (const [a, b] of lines) {
      const d = sub(b, a),
        l = d[0] ** 2 + d[1] ** 2,
        t = l ? ((base[0] - a[0]) * d[0] + (base[1] - a[1]) * d[1]) / l : -1;
      if (t >= 0 && t <= 1)
        candidates.push({ point: [a[0] + t * d[0], a[1] + t * d[1]], kind: 'Vinkelrät' });
    }
  let closest = null,
    best = tolerance;
  for (const candidate of candidates) {
    if (
      ortho &&
      base &&
      Math.min(Math.abs(candidate.point[0] - base[0]), Math.abs(candidate.point[1] - base[1])) >
        1e-7
    )
      continue;
    const d = distance(raw, candidate.point);
    if (d < best) {
      best = d;
      closest = candidate;
    }
  }
  if (closest) return closest;
  let point = [...raw],
    kind = 'Fritt';
  if (base && (ortho || polar)) {
    const d = sub(raw, base),
      angle = Math.atan2(d[1], d[0]),
      stepAngle = ((ortho ? 90 : polar) * Math.PI) / 180,
      target = Math.round(angle / stepAngle) * stepAngle,
      dir = [Math.cos(target), Math.sin(target)],
      length = d[0] * dir[0] + d[1] * dir[1],
      tracked = [base[0] + length * dir[0], base[1] + length * dir[1]];
    if (ortho || distance(raw, tracked) < tolerance) {
      point = tracked;
      kind = ortho ? 'Ortho' : 'Polar';
    }
  }
  if (border) {
    // Point snaps above take priority over the nearest point along a boundary.
    const edgePoints = [];
    for (let i = 0; i < 4; i++) {
      const a = border[i],
        b = border[i + 1],
        d = sub(b, a),
        l = d[0] ** 2 + d[1] ** 2;
      if (l === 0) continue;
      if (base && (ortho || kind === 'Polar')) {
        const tracking = sub(point, base),
          den = cross(tracking, d);
        if (Math.abs(den) > 1e-10) {
          const t = cross(sub(a, base), d) / den,
            u = cross(sub(a, base), tracking) / den;
          if (u >= 0 && u <= 1)
            edgePoints.push([base[0] + t * tracking[0], base[1] + t * tracking[1]]);
        }
      } else {
        const t = Math.max(0, Math.min(1, ((raw[0] - a[0]) * d[0] + (raw[1] - a[1]) * d[1]) / l));
        edgePoints.push([a[0] + t * d[0], a[1] + t * d[1]]);
      }
    }
    let best = tolerance,
      edge = null;
    for (const p of edgePoints) {
      const d = distance(raw, p);
      if (d < best) {
        best = d;
        edge = p;
      }
    }
    if (edge) return { point: edge, kind: 'Arbetsytans kant' };
  }
  if (grid && kind === 'Fritt') {
    point = point.map((v) => Math.round(v / step) * step);
    kind = 'Rutsteg';
  }
  return { point, kind };
}
export function transformFrameEntity(e, base, target, degrees = 0) {
  const radians = (degrees * Math.PI) / 180,
    c = Math.cos(radians),
    s = Math.sin(radians),
    turn = (p) => {
      const [x, y] = sub(p, base);
      return [target[0] + x * c - y * s, target[1] + x * s + y * c];
    };
  return e.type === 'line'
    ? { ...e, points: e.points.map(turn) }
    : { ...e, point: turn(e.point), angle: (e.angle || 0) + degrees };
}
export function lengthPoint(base, cursor, value) {
  const n = Number(String(value).replace(',', '.')),
    d = distance(base, cursor);
  if (!Number.isFinite(n) || n <= 0 || d < 1e-9)
    throw Error('Ange en positiv längd och peka ut riktningen.');
  return base.map((v, i) => v + ((cursor[i] - v) * n) / d);
}
