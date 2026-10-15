import * as THREE from 'three';
import { cornerPath } from './geometry/corner-path.js';
import { contours, profileAnchor, sweepFrame, validateSweep } from '../sweep.js';
export function polysweepPath(source) {
  return cornerPath(source.points, source.radii, false);
}
function profileLoops(source) {
  const [x, y] = profileAnchor(source);
  return contours(source).map((loop) => loop.map((p) => [p[0] - x, p[1] - y]));
}
export function polysweepFrames(source) {
  const path = polysweepPath(source),
    first = sweepFrame({ ...source, start: source.points[0], end: source.points[1] });
  let x = first.x.clone(),
    previous = first.axis.clone();
  const frames = path.samples.map((sample) => {
    const tangent = sample.tangent;
    x.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(previous, tangent));
    x.addScaledVector(tangent, -x.dot(tangent)).normalize();
    const y = x.clone().cross(tangent).normalize();
    previous = tangent.clone();
    const miter =
      sample.incoming && sample.outgoing
        ? sample.incoming.clone().sub(sample.outgoing).normalize()
        : null;
    const cosine = sample.incoming ? sample.incoming.dot(tangent) : 1;
    return { ...sample, x: x.clone(), y, miter, cosine };
  });
  return { ...path, frames };
}
function vertex(frame, point) {
  const offset = frame.x.clone().multiplyScalar(point[0]).addScaledVector(frame.y, point[1]);
  if (frame.miter && frame.cosine > 1e-6)
    offset.addScaledVector(frame.miter, offset.dot(frame.miter) * (1 / frame.cosine - 1));
  return frame.point.clone().add(offset);
}
export function validatePolysweep(source) {
  try {
    const error = validateSweep({
      ...source,
      start: source.points?.[0] || [],
      end: source.points?.[1] || [],
    });
    if (error) return error;
    const { frames } = polysweepFrames(source),
      loops = profileLoops(source);
    for (const frame of frames) {
      if (frame.center) {
        const radial = frame.point.clone().sub(frame.center).normalize();
        if (loops[0].some((p) => vertex(frame, p).sub(frame.center).dot(radial) <= 0.001))
          return `Hörn ${frame.corner + 1}: radien ${source.radii[frame.corner]} mm är för liten för profilens tvärsnitt med vald insättning. Öka radien eller ändra insättningen.`;
      }
    }
    return '';
  } catch (error) {
    return error.message;
  }
}
export function polysweepGeometry(source) {
  const { frames } = polysweepFrames(source),
    loops = profileLoops(source),
    points = loops.flat();
  const positions = frames.flatMap((frame) => points.flatMap((p) => vertex(frame, p).toArray())),
    indices = [],
    stride = points.length;
  let offset = 0;
  for (const loop of loops) {
    for (let ring = 0; ring < frames.length - 1; ring++)
      for (let i = 0; i < loop.length; i++) {
        const a = ring * stride + offset + i,
          b = ring * stride + offset + ((i + 1) % loop.length);
        indices.push(a, a + stride, b, b, a + stride, b + stride);
      }
    offset += loop.length;
  }
  const triangles = THREE.ShapeUtils.triangulateShape(
    loops[0].map((p) => new THREE.Vector2(...p)),
    loops.slice(1).map((loop) => loop.map((p) => new THREE.Vector2(...p))),
  );
  const last = (frames.length - 1) * stride;
  for (const [a, b, c] of triangles) indices.push(a, b, c, last + c, last + b, last + a);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.userData.profileEdgeThreshold = 10;
  return geometry;
}
export function polysweepCorners(source) {
  const { frames } = polysweepFrames(source),
    points = profileLoops(source)[0];
  return frames.flatMap((frame) => points.map((p) => vertex(frame, p).toArray()));
}
export function polysweepFrame(source) {
  const f = sweepFrame({ ...source, start: source.points[0], end: source.points[1] });
  return { origin: f.start, x: f.axis, y: f.x, z: f.y };
}
