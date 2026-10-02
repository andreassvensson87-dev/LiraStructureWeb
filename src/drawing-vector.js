import * as THREE from 'three';
import { geometryEdges } from './fasteners/edges.js';
import { clipSectionSegment } from './section-extents.js';

const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const distance = (p, plane) =>
  plane.normal.x * p[0] + plane.normal.y * p[1] + plane.normal.z * p[2] + plane.constant;
function clipPolygon(points, planes) {
  for (const plane of planes) {
    const result = [];
    for (let i = 0; i < points.length; i++) {
      const a = points[i],
        b = points[(i + 1) % points.length];
      const da = distance(a, plane),
        db = distance(b, plane);
      if (da >= 0) result.push(a);
      if (da >= 0 !== db >= 0) result.push(mix(a, b, da / (da - db)));
    }
    points = result;
  }
  return points;
}

// Orthographic hidden-line removal in view coordinates, looking from positive Z.
// Split edges analytically at triangle boundaries and depth crossings; no pixels.
export function vectorDrawing(surfaces, edgeSets) {
  const triangles = [];
  for (const { geometry, planes = [] } of surfaces) {
    const p = geometry.attributes.position,
      index = geometry.index;
    const count = index ? index.count : p.count;
    for (let i = 0; i < count; i += 3) {
      const polygon = clipPolygon(
        [0, 1, 2].map((j) => {
          const n = index ? index.getX(i + j) : i + j;
          return [p.getX(n), p.getY(n), p.getZ(n)];
        }),
        planes,
      );
      for (let j = 1; j + 1 < polygon.length; j++) {
        const a = polygon[0],
          b = polygon[j],
          c = polygon[j + 1];
        const det = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
        if (Math.abs(det) < 1e-10) continue;
        const zx = ((b[2] - a[2]) * (c[1] - a[1]) - (c[2] - a[2]) * (b[1] - a[1])) / det;
        const zy = ((b[0] - a[0]) * (c[2] - a[2]) - (c[0] - a[0]) * (b[2] - a[2])) / det;
        triangles.push({
          points: det > 0 ? [a, b, c] : [a, c, b],
          zx,
          zy,
          z0: a[2] - zx * a[0] - zy * a[1],
          box: [
            Math.min(a[0], b[0], c[0]),
            Math.min(a[1], b[1], c[1]),
            Math.max(a[0], b[0], c[0]),
            Math.max(a[1], b[1], c[1]),
          ],
        });
      }
    }
  }
  // A projected spatial grid avoids comparing each edge with every model face.
  const bounds = [Infinity, Infinity, -Infinity, -Infinity];
  for (const t of triangles)
    for (let i = 0; i < 4; i++)
      bounds[i] = i < 2 ? Math.min(bounds[i], t.box[i]) : Math.max(bounds[i], t.box[i]);
  const n = Math.max(1, Math.min(64, Math.ceil(Math.sqrt(triangles.length / 8))));
  const cell = (v, axis) =>
    Math.max(
      0,
      Math.min(
        n - 1,
        Math.floor(((v - bounds[axis]) / (bounds[axis + 2] - bounds[axis] || 1)) * n),
      ),
    );
  const bins = new Map();
  const visit = (box, action) => {
    for (let x = cell(box[0], 0); x <= cell(box[2], 0); x++)
      for (let y = cell(box[1], 1); y <= cell(box[3], 1); y++) action(x + y * n);
  };
  triangles.forEach((t, i) =>
    visit(t.box, (k) => {
      if (!bins.has(k)) bins.set(k, []);
      bins.get(k).push(i);
    }),
  );
  const result = [];
  for (const {
    geometry,
    planes = [],
    dashed = false,
    overlay = false,
    color = '#53666d',
    sourceId,
  } of edgeSets) {
    const visible = [],
      hidden = [],
      p = geometry.attributes.position;
    for (let i = 0; i + 1 < p.count; i += 2) {
      const line = clipSectionSegment(
        [p.getX(i), p.getY(i), p.getZ(i)],
        [p.getX(i + 1), p.getY(i + 1), p.getZ(i + 1)],
        planes,
      );
      if (!line) continue;
      const [a, b] = line;
      if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 1e-8) continue;
      const intervals = [],
        box = [
          Math.min(a[0], b[0]),
          Math.min(a[1], b[1]),
          Math.max(a[0], b[0]),
          Math.max(a[1], b[1]),
        ];
      const candidates = new Set();
      if (!overlay)
        visit(box, (k) => {
          for (const t of bins.get(k) || []) candidates.add(t);
        });
      for (const k of candidates) {
        const t = triangles[k];
        if (box[0] > t.box[2] || box[2] < t.box[0] || box[1] > t.box[3] || box[3] < t.box[1])
          continue;
        let lo = 0,
          hi = 1;
        const constrain = (u, v) => {
          const d = v - u;
          if (Math.abs(d) < 1e-12) {
            if (u < 0) hi = -1;
          } else if (d > 0) lo = Math.max(lo, -u / d);
          else hi = Math.min(hi, -u / d);
        };
        for (let j = 0; j < 3; j++) {
          const u = t.points[j],
            v = t.points[(j + 1) % 3];
          const side = (p) => (v[0] - u[0]) * (p[1] - u[1]) - (v[1] - u[1]) * (p[0] - u[0]);
          constrain(side(a), side(b));
        }
        const above = (p) => t.zx * p[0] + t.zy * p[1] + t.z0 - p[2] - 0.001;
        constrain(above(a), above(b));
        if (hi > lo + 1e-9) intervals.push([lo, hi]);
      }
      intervals.sort((a, b) => a[0] - b[0]);
      const merged = [];
      for (const range of intervals) {
        const last = merged.at(-1);
        if (last && range[0] <= last[1] + 1e-9) last[1] = Math.max(last[1], range[1]);
        else merged.push([...range]);
      }
      let start = 0;
      for (const [lo, hi] of merged) {
        if (lo > start + 1e-9) visible.push([mix(a, b, start), mix(a, b, lo)]);
        hidden.push([mix(a, b, lo), mix(a, b, hi)]);
        start = hi;
      }
      if (start < 1 - 1e-9) visible.push([mix(a, b, start), b]);
    }
    result.push({ visible, hidden, dashed, color, sourceId });
  }
  return result;
}

export function geometryVectors(geometry, planes = []) {
  const edges = geometryEdges(geometry, 5);
  const result = vectorDrawing([{ geometry, planes }], [{ geometry: edges, planes }]);
  edges.dispose();
  return result;
}

export function appendVectorDrawing(
  parent,
  data,
  project,
  { hidden = false, width = 0.18, dash = 2, gap = 1 } = {},
) {
  const append = (lines, color, dashed) => {
    if (!lines.length) return;
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', lines.map(([a, b]) => `M${project(a)}L${project(b)}`).join(''));
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', color);
    path.setAttribute('stroke-width', width);
    if (dashed) path.setAttribute('stroke-dasharray', `${dash} ${gap}`);
    parent.append(path);
  };
  if (hidden) for (const set of data) append(set.hidden, '#849399', true);
  for (const set of data) append(set.visible, set.color, set.dashed);
}
