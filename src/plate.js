import { offsetPlate } from './plate-offset.js';
import * as THREE from 'three';
const vec = (p) => new THREE.Vector3(...p);
export function planeFrame(mode, points) {
  const origin = points[0];
  let u, v;
  if (mode === 'three') {
    u = vec(points[1]).sub(vec(origin));
    const normal = u.clone().cross(vec(points[2]).sub(vec(origin)));
    if (u.length() < 1 || normal.length() / u.length() < 1)
      throw new Error('Välj tre punkter som inte ligger på samma linje.');
    u.normalize();
    v = normal.normalize().cross(u).normalize();
  } else {
    [u, v] = {
      XY: [
        [1, 0, 0],
        [0, 1, 0],
      ],
      XZ: [
        [1, 0, 0],
        [0, 0, 1],
      ],
      YZ: [
        [0, 1, 0],
        [0, 0, 1],
      ],
    }[mode].map(vec);
  }
  return { origin: [...origin], u: u.toArray(), v: v.toArray() };
}
export function plateNormal(s) {
  return vec(s.frame.u).cross(vec(s.frame.v)).normalize();
}
export function platePoint(s, p, z = 0) {
  return vec(s.frame.origin)
    .addScaledVector(vec(s.frame.u), p[0])
    .addScaledVector(vec(s.frame.v), p[1])
    .addScaledVector(plateNormal(s), z)
    .toArray();
}
export function plateLocal(s, p) {
  const d = vec(p).sub(vec(s.frame.origin));
  return [d.dot(vec(s.frame.u)), d.dot(vec(s.frame.v))];
}
export function plateVertices(s) {
  return s.polygon.map((p) => platePoint(s, p));
}
export function plateOffsets(s) {
  return s.side === 'positive'
    ? [0, s.thickness]
    : s.side === 'negative'
      ? [-s.thickness, 0]
      : [-s.thickness / 2, s.thickness / 2];
}
export function plateContour(s) {
  return s.contourOffset
    ? offsetPlate({ ...s, contourOffset: 0 }, s.contourOffset).polygon
    : s.polygon;
}
export function plateCorners(s) {
  return plateOffsets(s).flatMap((z) => plateContour(s).map((p) => platePoint(s, p, z)));
}
export function plateArea(s) {
  const polygon = plateContour(s);
  return (
    Math.abs(
      polygon.reduce((sum, a, i) => {
        const b = polygon[(i + 1) % polygon.length];
        return sum + a[0] * b[1] - b[0] * a[1];
      }, 0),
    ) / 2
  );
}
function cross(a, b, c) {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}
function onSegment(a, b, c) {
  return (
    Math.abs(cross(a, b, c)) < 1e-6 &&
    c[0] >= Math.min(a[0], b[0]) - 1e-6 &&
    c[0] <= Math.max(a[0], b[0]) + 1e-6 &&
    c[1] >= Math.min(a[1], b[1]) - 1e-6 &&
    c[1] <= Math.max(a[1], b[1]) + 1e-6
  );
}
function intersects(a, b, c, d) {
  const x = cross(a, b, c),
    y = cross(a, b, d),
    z = cross(c, d, a),
    w = cross(c, d, b);
  return (
    (x * y < 0 && z * w < 0) ||
    onSegment(a, b, c) ||
    onSegment(a, b, d) ||
    onSegment(c, d, a) ||
    onSegment(c, d, b)
  );
}
export function validatePlate(s, { minEdgeLength = 1 } = {}) {
  if (s.contourOffset !== undefined && !Number.isFinite(s.contourOffset))
    return 'Ange en giltig konturoffset.';
  if (s.contourOffset) {
    try {
      offsetPlate({ ...s, contourOffset: 0 }, s.contourOffset);
      return '';
    } catch (e) {
      return e.message;
    }
  }
  if (!s.frame || !s.polygon || s.polygon.length < 3) return 'En Plate behöver minst tre hörn.';
  if (
    ![...s.frame.origin, ...s.frame.u, ...s.frame.v, ...s.polygon.flat(), s.thickness].every(
      Number.isFinite,
    )
  )
    return 'Ange giltiga koordinater och tjocklek.';
  if (
    Math.abs(vec(s.frame.u).length() - 1) > 1e-6 ||
    Math.abs(vec(s.frame.v).length() - 1) > 1e-6 ||
    Math.abs(vec(s.frame.u).dot(vec(s.frame.v))) > 1e-6
  )
    return 'Ogiltigt arbetsplan.';
  if (s.thickness < 1 || s.thickness > 10000) return 'Tjockleken måste vara 1–10 000 mm.';
  if (!['center', 'positive', 'negative'].includes(s.side)) return 'Välj tjocklekens placering.';
  const p = s.polygon,
    n = p.length;
  for (let i = 0; i < n; i++) {
    const a = p[i],
      b = p[(i + 1) % n];
    if (Math.hypot(a[0] - b[0], a[1] - b[1]) < minEdgeLength)
      return 'Två intilliggande hörn måste ligga minst ' + minEdgeLength + ' mm isär.';
    const c = p[(i + 2) % n];
    if (
      Math.abs(cross(a, b, c)) < 1e-6 &&
      (b[0] - a[0]) * (c[0] - b[0]) + (b[1] - a[1]) * (c[1] - b[1]) < 0
    )
      return 'Polygonens kanter får inte överlappa.';
    for (let j = i + 1; j < n; j++) {
      if (j === i + 1 || (i === 0 && j === n - 1)) continue;
      if (intersects(a, b, p[j], p[(j + 1) % n]))
        return 'Polygonens kanter får inte korsa eller beröra varandra.';
    }
  }
  if (plateArea(s) < 1) return 'Polygonen behöver en yta större än 1 mm².';
  if (
    plateCorners(s)
      .flat()
      .some((v) => Math.abs(v) > 1e7)
  )
    return 'Koordinater måste ligga inom ±10 000 000 mm.';
  return '';
}
export function plateGeometry(s) {
  const shape = new THREE.Shape(plateContour(s).map((p) => new THREE.Vector2(...p)));
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: s.thickness,
    bevelEnabled: false,
    steps: 1,
  });
  const matrix = new THREE.Matrix4().makeBasis(vec(s.frame.u), vec(s.frame.v), plateNormal(s));
  matrix.setPosition(vec(platePoint(s, [0, 0], plateOffsets(s)[0])));
  geometry.applyMatrix4(matrix);
  return geometry;
}
