import { TIBNOR_PROFILES } from '../tibnor-catalog.js';
import { profileSnapshot } from '../section-profile.js';
let catalog;
const tolerance = 0.03;
function segmentDistance(p, a, b) {
  const dx = b[0] - a[0],
    dy = b[1] - a[1];
  const t = Math.max(
    0,
    Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy)),
  );
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}
function fits(a, b) {
  return a.every((p) =>
    b.some((q, i) => segmentDistance(p, q, b[(i + 1) % b.length]) <= tolerance),
  );
}
/** Identify only contour matches, never infer a HEA size from its name or bounding box. */
export function matchHeaProfile(loops, properties) {
  if (loops.length !== 1) return null;
  catalog ||= TIBNOR_PROFILES.filter((p) => p.family === 'HEA').map(profileSnapshot);
  const points = loops[0].map(([x, y]) => [x - properties.cx, y - properties.cy]);
  const angles = [];
  for (let i = 0; i < points.length; i++) {
    const p = points[i],
      q = points[(i + 1) % points.length];
    if (Math.hypot(q[0] - p[0], q[1] - p[1]) < 5) continue;
    const angle = ((Math.atan2(q[1] - p[1], q[0] - p[0]) % Math.PI) + Math.PI) % Math.PI;
    if (!angles.some((value) => Math.abs(value - angle) < 1e-5)) angles.push(angle);
  }
  for (const angle of angles) {
    const c = Math.cos(angle),
      s = Math.sin(angle);
    const aligned = points.map(([x, y]) => [c * x + s * y, -s * x + c * y]);
    const width = Math.max(...aligned.map((p) => p[0])) - Math.min(...aligned.map((p) => p[0]));
    const height = Math.max(...aligned.map((p) => p[1])) - Math.min(...aligned.map((p) => p[1]));
    for (const section of catalog) {
      const bounds = section.properties.bounds;
      if (
        Math.abs(width - bounds.width) > tolerance ||
        Math.abs(height - bounds.height) > tolerance ||
        Math.abs(properties.A - section.properties.A) > section.properties.A * 1e-4
      )
        continue;
      const target = section.loops[0].map(([x, y]) => [
        x - section.properties.cx,
        y - section.properties.cy,
      ]);
      if (fits(aligned, target) && fits(target, aligned))
        return { section: structuredClone(section), rotation: (-angle * 180) / Math.PI };
    }
  }
  return null;
}
