import { arcGeometry } from './drawing-shapes.js';

// Analytic curve points: no tessellation edges or hatch lines enter snapping.
export function curveSnapCandidates(item, raw, base, settings) {
  if (!['circle', 'arc'].includes(item.shape)) return [];
  let geometry;
  try {
    geometry =
      item.shape === 'arc'
        ? arcGeometry(item.points)
        : {
            center: item.points[0],
            radius: Math.hypot(
              item.points[1][0] - item.points[0][0],
              item.points[1][1] - item.points[0][1],
            ),
          };
  } catch {
    return [];
  }
  const { center, radius } = geometry;
  const wrap = (angle) => ((angle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  const within = (angle) =>
    item.shape === 'circle' ||
    (geometry.sweep >= 0
      ? wrap(angle - geometry.start) <= geometry.sweep + 1e-9
      : wrap(geometry.start - angle) <= -geometry.sweep + 1e-9);
  const result = [];
  const add = (angle, kind) => {
    if (within(angle))
      result.push({
        point: [center[0] + radius * Math.cos(angle), center[1] + radius * Math.sin(angle)],
        kind,
      });
  };
  if (settings.nearest !== false && Math.hypot(raw[0] - center[0], raw[1] - center[1]) > 1e-8) {
    const angle = Math.atan2(raw[1] - center[1], raw[0] - center[0]);
    if (within(angle)) add(angle, 'Närmaste');
    else {
      const endpoints = [item.points[0], item.points[2]];
      endpoints.sort(
        (a, b) =>
          Math.hypot(a[0] - raw[0], a[1] - raw[1]) - Math.hypot(b[0] - raw[0], b[1] - raw[1]),
      );
      result.push({ point: [...endpoints[0]], kind: 'Närmaste' });
    }
  }
  if (
    settings.perpendicular &&
    base &&
    Math.hypot(base[0] - center[0], base[1] - center[1]) > 1e-8
  ) {
    const angle = Math.atan2(base[1] - center[1], base[0] - center[0]);
    add(angle, 'Vinkelrät');
    add(angle + Math.PI, 'Vinkelrät');
  }
  return result.filter(
    (hit) =>
      hit.kind !== 'Vinkelrät' || Math.hypot(hit.point[0] - base[0], hit.point[1] - base[1]) > 1e-8,
  );
}
