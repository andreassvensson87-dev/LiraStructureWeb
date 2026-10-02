import { geometryVectors } from './drawing-vector.js';
import { sectionClipPlanes, clipSectionSegment } from './section-extents.js';
import * as THREE from 'three';
import { geometryEdges } from './fasteners/edges.js';
import { sectionSegments } from './plan-section.js';
const vec = (a) => new THREE.Vector3(...a);
export function sectionFrame(parent, points, side = 1, orientation = 'upright') {
  const [a, b] = points,
    dx = b[0] - a[0],
    dy = b[1] - a[1],
    length = Math.hypot(dx, dy);
  if (length < 0.01) throw Error('Välj två olika snittpunkter.');
  const along = vec(parent.x)
      .multiplyScalar((dx / length) * side)
      .addScaledVector(vec(parent.y), (dy / length) * side),
    normal = along.clone().cross(vec(parent.normal)).normalize();
  // Keep the section upright while preserving the viewing side chosen in its parent.
  let y =
    orientation === 'source'
      ? vec(parent.y)
      : orientation === 'source-line'
        ? vec(parent.normal)
        : new THREE.Vector3(0, 0, 1);
  y.addScaledVector(normal, -y.dot(normal));
  if (y.lengthSq() < 1e-10) {
    y = vec(parent.y).addScaledVector(normal, -vec(parent.y).dot(normal));
    if (y.lengthSq() < 1e-10) y = vec(parent.normal);
  }
  y.normalize();
  const x = y.clone().cross(normal).normalize();
  const origin = vec(parent.origin)
    .addScaledVector(vec(parent.x), a[0])
    .addScaledVector(vec(parent.y), a[1]);
  const clean = (v) => v.toArray().map((n) => n || 0);
  return {
    origin: clean(origin),
    x: clean(x),
    y: clean(y),
    normal: clean(normal),
    span: { direction: [along.dot(x) * side, along.dot(y) * side], length },
  };
}
export function frameMatrix(frame) {
  const { origin: o, x, y, normal: n } = frame;
  return new THREE.Matrix4().set(
    ...x,
    -vec(x).dot(vec(o)),
    ...y,
    -vec(y).dot(vec(o)),
    ...n,
    -vec(n).dot(vec(o)),
    0,
    0,
    0,
    1,
  );
}
export function nextSectionName(views) {
  const used = new Set(views.map((v) => v.section?.label || (v.id === 'section' ? 'A' : null)));
  let i = 0,
    name;
  do {
    name = i < 26 ? String.fromCharCode(65 + i) : 'S' + (i + 1);
    i++;
  } while (used.has(name));
  return name;
}
export function createSectionView(parent, points, side, position, views) {
  sectionFrame({ origin: [0, 0, 0], x: [1, 0, 0], y: [0, 1, 0], normal: [0, 0, 1] }, points, side);
  const label = nextSectionName(views);
  return {
    id: crypto.randomUUID(),
    name: `Snitt ${label}–${label}`,
    kind: 'section',
    projection: 'section',
    source: { ...parent.source, parentViewId: parent.id },
    position: [...position],
    size: [100, 80],
    scale: parent.scale,
    camera: { center: [0, 0] },
    settings: { ...parent.settings },
    section: { label, points: structuredClone(points), side, depth: 1000 },
  };
}
export function sectionDrawing(geometries, frame, depth) {
  if (!Number.isFinite(depth) || depth <= 0) throw Error('Snittdjupet måste vara större än noll.');
  const cut = [],
    behind = [],
    bounds = new THREE.Box2(),
    matrix = frameMatrix(frame),
    planes = sectionClipPlanes(frame, depth);
  for (const source of geometries) {
    const g = source.clone().applyMatrix4(matrix);
    for (const [a, b] of sectionSegments(g, 0)) {
      const line = clipSectionSegment(a, b, planes);
      if (line) cut.push(line.map((p) => p.slice(0, 2)));
    }
    const edges = geometryEdges(g, 5),
      p = edges.attributes.position;
    for (let i = 0; i < p.count; i += 2) {
      const line = clipSectionSegment(
        new THREE.Vector3().fromBufferAttribute(p, i).toArray(),
        new THREE.Vector3().fromBufferAttribute(p, i + 1).toArray(),
        planes,
      );
      if (line) behind.push(line.map((p) => p.slice(0, 2)));
    }
    edges.dispose();
    g.dispose();
  }
  for (const line of [...cut, ...behind])
    for (const p of line) bounds.expandByPoint(new THREE.Vector2(...p));
  if (bounds.isEmpty()) bounds.set(new THREE.Vector2(-50, -50), new THREE.Vector2(50, 50));
  return { cut, behind, bounds };
}
export function sectionVectors(geometry, frame, section) {
  const g = geometry.clone().applyMatrix4(frameMatrix(frame));
  const data = geometryVectors(g, section ? sectionClipPlanes(frame, section.depth) : []);
  g.dispose();
  return data;
}
