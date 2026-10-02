import * as THREE from 'three';

/** CSG can leave T-junctions: split collinear triangle edges before comparing adjacent faces. */
export function geometryEdges(geometry, threshold = 1) {
  if (!geometry.userData.linkedHoles) return new THREE.EdgesGeometry(geometry, threshold);
  const p = geometry.attributes.position,
    index = geometry.index,
    directions = new Map(),
    planes = new Map();
  const count = index?.count ?? p.count;
  for (let i = 0; i < count; i += 3) {
    const triangle = [0, 1, 2].map((j) =>
      new THREE.Vector3().fromBufferAttribute(p, index ? index.getX(i + j) : i + j),
    );
    const normal = triangle[1].clone().sub(triangle[0]).cross(triangle[2].clone().sub(triangle[0]));
    if (normal.length() < 1e-7) continue;
    normal.normalize();
    const planeKey = [
      ...normal.toArray().map((v) => Math.round(v * 10000)),
      Math.round(normal.dot(triangle[0]) * 100),
    ].join(',');
    if (!planes.has(planeKey)) planes.set(planeKey, []);
    planes.get(planeKey).push(new THREE.Triangle(...triangle));
    for (let j = 0; j < 3; j++) {
      const a = triangle[j],
        b = triangle[(j + 1) % 3],
        d = b.clone().sub(a);
      if (d.length() < 1e-5) continue;
      d.normalize();
      const sign = d.toArray().find((v) => Math.abs(v) > 1e-6);
      if (sign < 0) d.negate();
      const key = d
        .toArray()
        .map((v) => Math.round(v * 10000))
        .join(',');
      if (!directions.has(key)) directions.set(key, []);
      const lines = directions.get(key);
      let line = lines.find(
        (g) =>
          a.clone().sub(g.origin).cross(g.d).length() < 0.002 &&
          b.clone().sub(g.origin).cross(g.d).length() < 0.002,
      );
      if (!line) {
        line = { origin: a.clone(), d, spans: [] };
        lines.push(line);
      }
      const start = a.clone().sub(line.origin).dot(line.d),
        end = b.clone().sub(line.origin).dot(line.d);
      line.spans.push({ lo: Math.min(start, end), hi: Math.max(start, end), normal, planeKey });
    }
  }
  const points = [],
    cosine = Math.cos((Math.max(5, threshold) * Math.PI) / 180);
  for (const lines of directions.values())
    for (const line of lines) {
      const sorted = line.spans.flatMap((s) => [s.lo, s.hi]).sort((a, b) => a - b);
      const breaks = sorted.filter((v, i) => i === 0 || v - sorted[i - 1] > 0.00001);
      for (let i = 0; i + 1 < breaks.length; i++) {
        const lo = breaks[i],
          hi = breaks[i + 1],
          mid = (lo + hi) / 2;
        const faces = line.spans.filter((s) => s.lo < mid && s.hi > mid);
        if (
          faces.length !== 1 &&
          !faces.some((a) => faces.some((b) => a.normal.dot(b.normal) < cosine))
        )
          continue;
        const center = line.origin.clone().addScaledVector(line.d, mid);
        const internal = faces.some((f) => {
          const lateral = f.normal
            .clone()
            .cross(line.d)
            .normalize()
            .multiplyScalar(Math.min(0.02, (hi - lo) * 0.1));
          const left = center.clone().add(lateral),
            right = center.clone().sub(lateral);
          const neighbors = planes.get(f.planeKey);
          return (
            neighbors.some((t) => t.containsPoint(left)) &&
            neighbors.some((t) => t.containsPoint(right))
          );
        });
        if (internal) continue;
        points.push(
          ...line.origin.clone().addScaledVector(line.d, lo).toArray(),
          ...line.origin.clone().addScaledVector(line.d, hi).toArray(),
        );
      }
    }
  return new THREE.BufferGeometry().setAttribute(
    'position',
    new THREE.Float32BufferAttribute(points, 3),
  );
}
