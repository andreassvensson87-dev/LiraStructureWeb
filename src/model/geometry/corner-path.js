import * as THREE from 'three';
const vector = (point) => new THREE.Vector3(point[0], point[1], point[2] || 0);
/** Tangent circular corners shared by open sweep paths and closed plate contours. */
export function cornerPath(
  points,
  radii = points.map(() => 0),
  closed = false,
  { minEdgeLength = 1 } = {},
) {
  if (!Array.isArray(points) || points.length < (closed ? 3 : 2) || points.length > 1000)
    throw Error('Välj en giltig punktkedja.');
  if (
    !Array.isArray(radii) ||
    radii.length !== points.length ||
    radii.some((r) => !Number.isFinite(r) || r < 0 || r > 1e7)
  )
    throw Error('Ange en giltig radie för varje punkt.');
  const vertices = points.map((p) => {
    if (
      !Array.isArray(p) ||
      ![2, 3].includes(p.length) ||
      p.some((v) => !Number.isFinite(v) || Math.abs(v) > 1e7)
    )
      throw Error('Ogiltiga insättningspunkter.');
    return vector(p);
  });
  if (!closed && (radii[0] !== 0 || radii.at(-1) !== 0))
    throw Error('Ändpunkter kan inte ha hörnradie.');
  const corners = vertices.map((p, i) => {
    const previous = vertices[(i + vertices.length - 1) % vertices.length],
      next = vertices[(i + 1) % vertices.length];
    if (!closed && (i === 0 || i === vertices.length - 1))
      return { entry: p, exit: p, trim: 0, radius: 0 };
    const incoming = p.clone().sub(previous).normalize(),
      outgoing = next.clone().sub(p).normalize();
    const angle = Math.acos(THREE.MathUtils.clamp(incoming.dot(outgoing), -1, 1));
    if (angle > Math.PI - 1e-6) throw Error('Punktkedjan får inte vända tillbaka över sig själv.');
    if (!radii[i]) return { entry: p, exit: p, trim: 0, radius: 0, incoming, outgoing };
    if (angle < 1e-6) throw Error('Radie kräver ett hörn mellan två riktningar.');
    const radius = radii[i],
      trim = radius * Math.tan(angle / 2);
    const entry = p.clone().addScaledVector(incoming, -trim),
      exit = p.clone().addScaledVector(outgoing, trim);
    const normal = incoming.clone().cross(outgoing).normalize(),
      radial = normal.clone().cross(incoming);
    const center = entry.clone().addScaledVector(radial, radius);
    return { entry, exit, trim, radius, angle, normal, center, incoming, outgoing };
  });
  let length = 0;
  for (let i = 0; i < vertices.length - (closed ? 0 : 1); i++) {
    const next = (i + 1) % vertices.length,
      edge = vertices[i].distanceTo(vertices[next]);
    if (edge < minEdgeLength) throw Error('Intilliggande punkter måste ligga minst 1 mm isär.');
    if (corners[i].trim + corners[next].trim > edge + 1e-6)
      throw Error('Radierna får inte plats mellan insättningspunkterna.');
    length += edge - corners[i].trim - corners[next].trim;
  }
  const samples = [];
  for (const [index, corner] of corners.entries()) {
    if (!corner.radius) {
      const incoming = corner.incoming || vertices[1].clone().sub(vertices[0]).normalize();
      const outgoing = corner.outgoing || vertices.at(-1).clone().sub(vertices.at(-2)).normalize();
      const tangent =
        !closed && index === 0
          ? incoming
          : !closed && index === corners.length - 1
            ? outgoing
            : incoming.clone().add(outgoing).normalize();
      samples.push({
        point: corner.entry,
        tangent,
        incoming: corner.incoming,
        outgoing: corner.outgoing,
        corner: index,
      });
    } else {
      length += corner.radius * corner.angle;
      const steps = Math.min(
        128,
        Math.max(
          2,
          Math.ceil(
            corner.angle /
              Math.min(Math.PI / 36, 2 * Math.acos(Math.max(-1, 1 - 0.1 / corner.radius))),
          ),
        ),
      );
      const radial = corner.entry.clone().sub(corner.center);
      for (let step = 0; step <= steps; step++) {
        const r = radial.clone().applyAxisAngle(corner.normal, (corner.angle * step) / steps);
        samples.push({
          point: corner.center.clone().add(r),
          tangent: corner.normal.clone().cross(r).normalize(),
          center: corner.center,
          radius: corner.radius,
          corner: index,
        });
      }
    }
  }
  const distinct = samples.filter(
    (sample, index) => !index || sample.point.distanceToSquared(samples[index - 1].point) > 1e-12,
  );
  if (
    closed &&
    distinct.length > 1 &&
    distinct[0].point.distanceToSquared(distinct.at(-1).point) < 1e-12
  )
    distinct.pop();
  return { samples: distinct, corners, length };
}
