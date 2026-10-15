import * as THREE from 'three';
import { sweepFrame } from '../sweep.js';
import { sectionProperties, validateContours } from '../section-profile.js';
import { conversionMesh, CONVERSION_TOLERANCE, edgeKey } from './conversion-mesh.js';
import { cappedExtrusion } from './conversion-caps.js';
const tolerance = CONVERSION_TOLERANCE;
const pointKey = (p) => p.map((v) => Math.round(v / tolerance)).join(',');
const area = (loop) =>
  Math.abs(
    loop.reduce((sum, p, i) => {
      const q = loop[(i + 1) % loop.length];
      return sum + p[0] * q[1] - q[0] * p[1];
    }, 0) / 2,
  );

// Accept closed, straight prisms only. Never substitute a bounding box for the source solid.
export function extrusionFromMesh(mesh, kind = 'sweep') {
  const data = conversionMesh(mesh);
  const { points, triangles, axes, origin, volume } = data;
  const edges = triangles.flatMap(({ vertices }) =>
    vertices.map((p, i) => vertices[(i + 1) % 3].clone().sub(p)),
  );
  const directions = [...axes];
  if (kind !== 'plate')
    for (const candidate of axes) {
      const parallel = edges
        .filter(
          (edge) =>
            edge.length() > 1 && Math.abs(edge.clone().normalize().dot(candidate)) > 1 - 1e-7,
        )
        .sort((a, b) => a.lengthSq() - b.lengthSq());
      // Prefer true longitudinal edges to nearly parallel long face diagonals.
      if (parallel.length) directions.push(parallel[0].normalize(), parallel.at(-1).normalize());
    }
  const candidates = [];
  for (const axis of directions) {
    const levels = points.map((p) => p.dot(axis)),
      min = Math.min(...levels),
      max = Math.max(...levels),
      depth = max - min;
    if (depth < 1 || levels.some((v) => Math.min(Math.abs(v - min), Math.abs(v - max)) > tolerance))
      continue;
    const { x, y } = sweepFrame({ start: [0, 0, 0], end: axis.toArray(), rotation: 0 });
    const caps = [new Map(), new Map()],
      coordinates = new Map();
    let valid = true;
    for (const { vertices } of triangles) {
      const cap = vertices.every((p) => Math.abs(p.dot(axis) - min) <= tolerance)
        ? 0
        : vertices.every((p) => Math.abs(p.dot(axis) - max) <= tolerance)
          ? 1
          : -1;
      if (cap < 0) {
        const projected = vertices.map((p) => new THREE.Vector2(p.dot(x), p.dot(y)));
        const edges = projected.map((p, i) => projected[(i + 1) % 3].clone().sub(p));
        const span = Math.max(...edges.map((e) => e.length()));
        if (span > tolerance && Math.abs(edges[0].cross(edges[1])) / span > tolerance)
          valid = false;
        continue;
      }
      const keys = vertices.map((p) => {
        const uv = [p.dot(x), p.dot(y)];
        const [u, v] = uv.map((value) => Math.round(value / tolerance));
        for (let du = -1; du <= 1; du++)
          for (let dv = -1; dv <= 1; dv++) {
            const key = `${u + du},${v + dv}`,
              previous = coordinates.get(key);
            if (previous && Math.hypot(previous[0] - uv[0], previous[1] - uv[1]) <= tolerance)
              return key;
          }
        const key = pointKey(uv);
        coordinates.set(key, uv);
        return key;
      });
      for (let j = 0; j < 3; j++) {
        const key = edgeKey(keys[j], keys[(j + 1) % 3]);
        const entry = caps[cap].get(key) || { count: 0, ends: [keys[j], keys[(j + 1) % 3]] };
        entry.count++;
        caps[cap].set(key, entry);
      }
    }
    const boundary = caps.map((cap) => [...cap].filter(([, e]) => e.count === 1));
    if (
      !valid ||
      !boundary[0].length ||
      boundary[0]
        .map(([key]) => key)
        .sort()
        .join(';') !==
        boundary[1]
          .map(([key]) => key)
          .sort()
          .join(';')
    )
      continue;
    const neighbours = new Map();
    for (const [
      ,
      {
        ends: [a, b],
      },
    ] of boundary[0]) {
      for (const [p, q] of [
        [a, b],
        [b, a],
      ]) {
        if (!neighbours.has(p)) neighbours.set(p, []);
        neighbours.get(p).push(q);
      }
    }
    if ([...neighbours.values()].some((list) => list.length !== 2)) continue;
    const unseen = new Set(neighbours.keys()),
      loops = [];
    while (unseen.size) {
      const first = unseen.values().next().value,
        loop = [];
      let current = first,
        previous = null;
      do {
        if (!unseen.delete(current)) {
          valid = false;
          break;
        }
        loop.push(coordinates.get(current));
        const next = neighbours.get(current).find((p) => p !== previous);
        previous = current;
        current = next;
      } while (current !== first);
      loops.push(loop);
      if (!valid) break;
    }
    loops.sort((a, b) => area(b) - area(a));
    try {
      if (!valid) continue;
      validateContours(loops);
      const properties = sectionProperties(loops);
      if (Math.abs(Math.abs(volume) - properties.A * depth) > properties.A * depth * 1e-4) continue;
      candidates.push({ axis, x, y, min, depth, loops, properties, origin });
    } catch {
      /* Other orientations may still produce a valid extrusion. */
    }
  }
  candidates.sort((a, b) => (kind === 'plate' ? a.depth - b.depth : b.depth - a.depth));
  const result = candidates[0] || (kind === 'sweep' ? cappedExtrusion(data) : null);
  if (!result)
    throw Error(
      'Kräver ett konstant tvärsnitt med två plana ändar; urtag, flera kapplan och böjda former stöds inte ännu.',
    );
  if (kind === 'plate' && result.loops.length !== 1)
    throw Error('Plate med genomgående hål stöds inte ännu.');
  return result;
}
