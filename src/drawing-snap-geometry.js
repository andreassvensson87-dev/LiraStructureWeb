import { segments } from './frame-model.js';

// Only segments that can produce a nearby hit enter the pairwise intersection search.
// This retains exact midpoint/perpendicular/intersection geometry on large drawings.
export function nearbySnapEntities(entities, point, tolerance) {
  return segments(entities)
    .filter(([a, b]) => {
      const dx = b[0] - a[0],
        dy = b[1] - a[1],
        length = dx * dx + dy * dy;
      const t = length
        ? Math.max(0, Math.min(1, ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / length))
        : 0;
      return Math.hypot(point[0] - a[0] - t * dx, point[1] - a[1] - t * dy) <= tolerance;
    })
    .map((points) => ({ type: 'line', points }));
}
