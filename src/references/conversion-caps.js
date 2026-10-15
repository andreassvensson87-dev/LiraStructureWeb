import * as THREE from 'three';
import { sweepFrame } from '../sweep.js';
import { sectionProperties, validateContours } from '../section-profile.js';
import { CONVERSION_TOLERANCE as tolerance, edgeKey } from './conversion-mesh.js';

function contour(cap, x, y, coordinates) {
  const edges = new Map();
  function key(p) {
    const uv = [p.dot(x), p.dot(y)];
    const found = coordinates.findIndex((q) => Math.hypot(q[0] - uv[0], q[1] - uv[1]) <= tolerance);
    if (found >= 0) return found;
    coordinates.push(uv);
    return coordinates.length - 1;
  }
  for (const { vertices } of cap.triangles) {
    const keys = vertices.map(key);
    for (let i = 0; i < 3; i++) {
      const a = keys[i],
        b = keys[(i + 1) % 3];
      if (a === b) continue;
      const k = edgeKey(a, b);
      const e = edges.get(k) || { ends: [a, b], count: 0 };
      e.count++;
      edges.set(k, e);
    }
  }
  if ([...edges.values()].some((e) => e.count > 2)) return null;
  const boundary = [...edges].filter(([, e]) => e.count === 1);
  const neighbours = new Map();
  for (const [
    ,
    {
      ends: [a, b],
    },
  ] of boundary)
    for (const [p, q] of [
      [a, b],
      [b, a],
    ]) {
      if (!neighbours.has(p)) neighbours.set(p, []);
      neighbours.get(p).push(q);
    }
  if (!boundary.length || [...neighbours.values()].some((a) => a.length !== 2)) return null;
  const unseen = new Set(neighbours.keys()),
    loops = [];
  while (unseen.size) {
    let current = unseen.values().next().value,
      previous = null;
    const first = current,
      loop = [];
    do {
      if (!unseen.delete(current)) return null;
      loop.push(coordinates[current]);
      const next = neighbours.get(current).find((k) => k !== previous);
      previous = current;
      current = next;
    } while (current !== first);
    loops.push(loop);
  }
  const area = (loop) =>
    Math.abs(
      loop.reduce((s, p, i) => {
        const q = loop[(i + 1) % loop.length];
        return s + p[0] * q[1] - q[0] * p[1];
      }, 0),
    );
  loops.sort((a, b) => area(b) - area(a));
  return {
    loops,
    boundary: boundary
      .map(([k]) => k)
      .sort()
      .join(';'),
  };
}

/** Recover only two planar end faces and longitudinal sides, including hollow sections.
 * Interior holes/notches introduce additional transverse faces and are rejected. */
export function cappedExtrusion({ points, triangles, origin, volume }) {
  const edges = triangles
    .flatMap(({ vertices }) => vertices.map((p, i) => vertices[(i + 1) % 3].clone().sub(p)))
    .sort((a, b) => b.lengthSq() - a.lengthSq());
  const longest = edges[0]?.length() || 0,
    axes = [];
  for (const edge of edges.filter((e) => e.length() >= longest / 2).reverse()) {
    const axis = edge.clone().normalize();
    if (!axes.some((a) => a.clone().cross(axis).length() * longest <= tolerance)) axes.push(axis);
    if (axes.length >= 16) break;
  }
  for (const axis of axes) {
    const { x, y } = sweepFrame({ start: [0, 0, 0], end: axis.toArray(), rotation: 0 });
    const caps = [];
    let valid = true;
    // Largest triangles define planes; tiny Float32 triangles must not set a cap normal.
    const ordered = [...triangles].sort((a, b) => b.area - a.area);
    for (const triangle of ordered) {
      const { vertices, normal } = triangle;
      const projected = vertices.map((p) => new THREE.Vector2(p.dot(x), p.dot(y)));
      const uvEdges = projected.map((p, i) => projected[(i + 1) % 3].clone().sub(p));
      const span = Math.max(...uvEdges.map((p) => p.length()));
      if (span <= tolerance || Math.abs(uvEdges[0].cross(uvEdges[1])) / span <= tolerance) continue;
      let cap = caps.find((c) =>
        vertices.every((p) => Math.abs(p.clone().sub(c.point).dot(c.normal)) <= tolerance),
      );
      if (!cap) {
        if (caps.length === 2 || Math.abs(normal.dot(axis)) < 0.05) {
          valid = false;
          break;
        }
        cap = { point: vertices[0], normal, triangles: [] };
        caps.push(cap);
      }
      cap.triangles.push(triangle);
    }
    if (!valid || caps.length !== 2) continue;
    const coordinates = [],
      a = contour(caps[0], x, y, coordinates),
      b = contour(caps[1], x, y, coordinates);
    if (!a || !b || a.boundary !== b.boundary) continue;
    try {
      validateContours(a.loops);
      const properties = sectionProperties(a.loops);
      const at = (cap, u, v) =>
        cap.normal.dot(cap.point.clone().addScaledVector(x, -u).addScaledVector(y, -v)) /
        cap.normal.dot(axis);
      caps.sort(
        (a, b) => at(a, properties.cx, properties.cy) - at(b, properties.cx, properties.cy),
      );
      const depthAtCenter =
        at(caps[1], properties.cx, properties.cy) - at(caps[0], properties.cx, properties.cy);
      if (
        depthAtCenter < 1 ||
        a.loops.flat().some(([u, v]) => at(caps[1], u, v) - at(caps[0], u, v) < 1)
      )
        continue;
      const expected = properties.A * depthAtCenter;
      if (Math.abs(Math.abs(volume) - expected) > expected * 1e-4) continue;
      const levels = points.map((p) => p.dot(axis)),
        min = Math.min(...levels),
        max = Math.max(...levels);
      const planes = caps.map((cap, i) => {
        const normal = cap.normal.clone();
        if ((i === 0 ? -1 : 1) * normal.dot(axis) < 0) normal.negate();
        return { point: cap.point.clone().add(origin), normal };
      });
      const oblique = caps.some((cap) => {
        const levels = cap.triangles.flatMap((t) => t.vertices.map((p) => p.dot(axis)));
        return Math.max(...levels) - Math.min(...levels) > tolerance;
      });
      // Extend the blank slightly so CSG never cuts tangentially at its extreme corner.
      // Both end planes trim that allowance, including a perpendicular opposite end.
      const margin = oblique ? 10 : 0;
      return {
        axis,
        x,
        y,
        origin,
        min: min - margin,
        depth: max - min + margin * 2,
        loops: a.loops,
        properties,
        endPlanes: oblique ? planes : [],
      };
    } catch {
      /* Another candidate direction may be a valid extrusion. */
    }
  }
  return null;
}
