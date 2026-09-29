import * as THREE from 'three';
export function extentGeometry(section) {
  const [a, b] = section.points,
    length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const axis = [(b[0] - a[0]) / length, (b[1] - a[1]) / length];
  const normal = [-axis[1] * section.side, axis[0] * section.side];
  const rear = [a, b].map((p) => p.map((n, i) => n + normal[i] * section.depth));
  return {
    axis,
    normal,
    length,
    rear,
    handles: [
      a.map((n, i) => (n + rear[0][i]) / 2),
      b.map((n, i) => (n + rear[1][i]) / 2),
      rear[0].map((n, i) => (n + rear[1][i]) / 2),
    ],
  };
}
export function resizeSectionExtent(section, handle, point) {
  const result = structuredClone(section),
    { axis, normal } = extentGeometry(section);
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
  if (handle === 'move') {
    const center = section.points[0].map((n, i) => (n + section.points[1][i]) / 2);
    const offset = dot(
      point.map((n, i) => n - center[i]),
      normal,
    );
    result.points = section.points.map((p) => p.map((n, i) => n + normal[i] * offset));
  } else if (handle === 'depth')
    result.depth = Math.max(
      0.1,
      dot(
        point.map((n, i) => n - section.points[0][i]),
        normal,
      ),
    );
  else {
    const index = handle === 'start' ? 0 : 1,
      other = section.points[1 - index];
    const distance = dot(
      point.map((n, i) => n - other[i]),
      axis,
    );
    const t = index === 0 ? Math.min(-0.1, distance) : Math.max(0.1, distance);
    result.points[index] = other.map((n, i) => n + axis[i] * t);
  }
  return result;
}
export function sectionClipPlanes(frame, depth) {
  const planes = [
    new THREE.Plane(new THREE.Vector3(0, 0, 1), depth),
    new THREE.Plane(new THREE.Vector3(0, 0, -1), 0),
  ];
  if (frame.span) {
    const n = new THREE.Vector3(...frame.span.direction, 0);
    planes.push(new THREE.Plane(n, 0), new THREE.Plane(n.clone().negate(), frame.span.length));
  }
  return planes;
}
export function clipSectionSegment(a, b, planes) {
  const start = new THREE.Vector3(a[0], a[1], a[2] || 0),
    end = new THREE.Vector3(b[0], b[1], b[2] || 0);
  let lo = 0,
    hi = 1;
  for (const plane of planes) {
    const x = plane.distanceToPoint(start),
      y = plane.distanceToPoint(end),
      delta = y - x;
    if (Math.abs(delta) < 1e-10) {
      if (x < -1e-7) return null;
      continue;
    }
    const t = -x / delta;
    if (delta > 0) lo = Math.max(lo, t);
    else hi = Math.min(hi, t);
    if (lo > hi) return null;
  }
  return [start.clone().lerp(end, lo).toArray(), start.clone().lerp(end, hi).toArray()];
}
