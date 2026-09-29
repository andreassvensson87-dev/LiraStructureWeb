import * as THREE from 'three';
export const ROUND_SEGMENTS = 96;
const recognized = new WeakMap();
// Recognize legacy library circles only when the actual contour still matches a circle.
export function roundProfile(s) {
  if (s.profile === 'circle' || s.profile === 'chs')
    return { outer: s.width / 2, inner: s.profile === 'chs' ? s.width / 2 - s.thickness : 0 };
  if (s.profile !== 'custom' || !s.section) return null;
  const section = s.section;
  if (recognized.has(section)) return recognized.get(section);
  const loops = section.loops;
  let result = null;
  if (
    ['circle', 'chs'].includes(section.profileType) &&
    loops?.length === (section.profileType === 'chs' ? 2 : 1)
  ) {
    const radii = loops.map((loop) => {
      if (loop.length !== ROUND_SEGMENTS) return NaN;
      const r = Math.hypot(...loop[0]),
        tolerance = Math.max(1e-7, r * 1e-9);
      // All samples must be the expected regular polygon, allowing either winding.
      const match = (sign) =>
        loop.every(
          (p, i) =>
            Math.hypot(
              p[0] - r * Math.cos((sign * i * 2 * Math.PI) / ROUND_SEGMENTS),
              p[1] - r * Math.sin((sign * i * 2 * Math.PI) / ROUND_SEGMENTS),
            ) < tolerance,
        );
      return r > 0 && (match(1) || match(-1)) ? r : NaN;
    });
    if (radii.every(Number.isFinite) && (radii.length === 1 || radii[1] < radii[0]))
      result = { outer: radii[0], inner: radii[1] || 0 };
  }
  recognized.set(section, result);
  return result;
}
export function roundContours({ outer, inner }) {
  const ring = (r) =>
    Array.from({ length: ROUND_SEGMENTS }, (_, i) => [
      r * Math.cos((i * 2 * Math.PI) / ROUND_SEGMENTS),
      r * Math.sin((i * 2 * Math.PI) / ROUND_SEGMENTS),
    ]);
  return inner ? [ring(outer), ring(inner).reverse()] : [ring(outer)];
}
// Reuse triangulation and local normals across diameter-identical instances of any length.
// Callers own clones, so mesh disposal and CSG cannot invalidate cached geometry.
const templates = new Map();
export function roundGeometryTemplate(profile) {
  const key = `${profile.outer}:${profile.inner}`;
  if (templates.has(key)) {
    const g = templates.get(key);
    templates.delete(key);
    templates.set(key, g);
    return g;
  }
  const loops = roundContours(profile),
    shape = new THREE.Shape(loops[0].map((p) => new THREE.Vector2(...p)));
  loops
    .slice(1)
    .forEach((loop) => shape.holes.push(new THREE.Path(loop.map((p) => new THREE.Vector2(...p)))));
  const g = new THREE.ExtrudeGeometry(shape, { depth: 1, bevelEnabled: false, steps: 1 }),
    p = g.attributes.position,
    n = g.attributes.normal;
  for (let i = 0; i < p.count; i++) {
    if (Math.abs(n.getZ(i)) > 0.5) continue; // End faces keep their axial normals.
    const x = p.getX(i),
      y = p.getY(i),
      r = Math.hypot(x, y),
      inner = profile.inner && Math.abs(r - profile.inner) < Math.abs(r - profile.outer),
      sign = inner ? -1 : 1;
    n.setXYZ(i, (sign * x) / r, (sign * y) / r, 0);
  }
  n.needsUpdate = true;
  templates.set(key, g);
  if (templates.size > 32) {
    const oldest = templates.keys().next().value;
    templates.get(oldest).dispose();
    templates.delete(oldest);
  }
  return g;
}
