import { expression } from './section-expression.js';

export const PROFILE_RADIUS_STEP = 15;
/** Shared arc expressions for every parametric profile family. */
export function profileArc(cx, cy, radius, start, end) {
  const segments = Math.ceil(Math.abs(end - start) / PROFILE_RADIUS_STEP);
  return Array.from({ length: segments + 1 }, (_, i) => {
    const angle = ((start + ((end - start) * i) / segments) * Math.PI) / 180;
    return [
      cx + '+(' + Math.cos(angle).toFixed(12) + ')*' + radius,
      cy + '+(' + Math.sin(angle).toFixed(12) + ')*' + radius,
    ];
  });
}

/** One expression contour; display modes differ only in the radius values. */
export function contourDefinition(definition) {
  return {
    schema: 1,
    radiusParameters: [...(definition.radiusParameters || (definition.roundedRoots ? ['R'] : []))],
    radiusSegmentAngle: definition.radiusSegmentAngle || (definition.roundedRoots ? 15 : 0),
    loops: definition.loops.map((loop) => loop.vertices.map((v) => [v.x, v.y])),
  };
}
export function evaluateProfileContours(contour, parameters, detail = 'exact') {
  if (
    contour.schema !== 1 ||
    !Array.isArray(contour.radiusParameters) ||
    contour.radiusParameters.length > 64 ||
    new Set(contour.radiusParameters).size !== contour.radiusParameters.length
  )
    throw new Error('Ogiltig parametrisk profilkontur.');
  const radii = new Set(contour.radiusParameters);
  for (const name of radii)
    if (
      !Object.hasOwn(parameters, name) ||
      !Number.isFinite(parameters[name]) ||
      parameters[name] < 0
    )
      throw new Error('Profilradier måste vara noll eller positiva tal.');
  if (
    !Number.isFinite(contour.radiusSegmentAngle) ||
    contour.radiusSegmentAngle < 0 ||
    contour.radiusSegmentAngle > 45
  )
    throw new Error('Ogiltig segmentering av profilradier.');
  if (
    !Array.isArray(contour.loops) ||
    !contour.loops.length ||
    contour.loops.length > 32 ||
    contour.loops.some((loop) => !Array.isArray(loop)) ||
    contour.loops.flat().length > 1000
  )
    throw new Error('Ogiltigt antal profilkonturer eller hörn.');
  const resolve = (name) => {
    if (!Object.hasOwn(parameters, name)) throw new Error('Okänd parameter: ' + name);
    return detail === 'schematic' && radii.has(name) ? 0 : parameters[name];
  };
  // Parametric fillets can meet an existing corner (toe radius = thickness).
  const collapsedRadii = radii.size > 0;
  const same = (a, b) => a && Math.hypot(a[0] - b[0], a[1] - b[1]) < 1e-8;
  return contour.loops.map((loop) => {
    const points = [];
    for (const vertex of loop) {
      if (!Array.isArray(vertex) || vertex.length !== 2) throw new Error('Ogiltig profilpunkt.');
      const point = vertex.map((value) => expression(value, resolve));
      // With R=0, an arc collapses to its theoretical sharp corner.
      if (!collapsedRadii || !same(points.at(-1), point)) points.push(point);
    }
    if (collapsedRadii && same(points[0], points.at(-1))) points.pop();
    return points;
  });
}
