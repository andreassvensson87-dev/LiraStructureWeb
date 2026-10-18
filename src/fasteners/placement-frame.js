import * as THREE from 'three';
import { axisPlacement, fastenerFrame } from './geometry.js';

const point = (p) =>
  Array.isArray(p) && p.length === 3 && p.every((v) => Number.isFinite(v) && Math.abs(v) <= 1e7);

/** A picked material face defines the pattern plane; retain the workplane X when possible. */
export function fastenerPlaneFromSurface(origin, normal, reference) {
  const n = new THREE.Vector3(...normal).normalize();
  const u = new THREE.Vector3(...reference.u);
  u.addScaledVector(n, -u.dot(n));
  if (u.lengthSq() < 1e-8) {
    u.set(...reference.v);
    u.addScaledVector(n, -u.dot(n));
  }
  u.normalize();
  return { origin: [...origin], u: u.toArray(), v: n.cross(u).normalize().toArray() };
}

/** Layout points describe the pattern plane, independently of the fitted shaft endpoints. */
export function validateFastenerLayout(layout) {
  if (!layout) return;
  const { frame, offset, rotation, reversed } = layout;
  if (
    layout.xLength != null &&
    (!Number.isFinite(layout.xLength) || layout.xLength < 0.001 || layout.xLength > 1e7)
  )
    throw new Error('Ange en giltig längd för X-riktningen.');
  if (
    layout.yLength != null &&
    (!Number.isFinite(layout.yLength) || layout.yLength < 0.001 || layout.yLength > 1e7)
  )
    throw new Error('Ange en giltig längd för Y-riktningen.');
  if (
    layout.searchLength != null &&
    (!Number.isFinite(layout.searchLength) || layout.searchLength <= 0 || layout.searchLength > 1e7)
  )
    throw new Error('Ange en giltig söklängd.');
  if (
    !frame ||
    ![frame.origin, frame.u, frame.v, offset].every(point) ||
    !Number.isFinite(rotation) ||
    Math.abs(rotation) > 36000 ||
    typeof reversed !== 'boolean'
  )
    throw new Error('Ogiltig skruvplacering.');
  const u = new THREE.Vector3(...frame.u),
    v = new THREE.Vector3(...frame.v);
  if (
    Math.abs(u.length() - 1) > 1e-6 ||
    Math.abs(v.length() - 1) > 1e-6 ||
    Math.abs(u.dot(v)) > 1e-6
  )
    throw new Error('Skruvplanet måste ha vinkelräta enhetsaxlar.');
}
export function fastenerLayoutFromPoints(origin, xPoint, reference) {
  if (![origin, xPoint].every(point))
    throw new Error('Välj giltiga punkter för origo och X-riktning.');
  const u = new THREE.Vector3(...(reference?.u || [1, 0, 0]));
  const v = new THREE.Vector3(...(reference?.v || [0, 1, 0]));
  const normal = u.cross(v).normalize();
  const x = new THREE.Vector3(...xPoint).sub(new THREE.Vector3(...origin));
  x.addScaledVector(normal, -x.dot(normal));
  if (normal.length() < 0.999 || x.length() < 0.001)
    throw new Error('Välj X-riktning längs arbetsplanet, minst 0,001 mm från origo.');
  const xLength = x.length();
  x.normalize();
  const layout = {
    xLength,
    yLength: 100,
    frame: { origin: [...origin], u: x.toArray(), v: normal.cross(x).normalize().toArray() },
    offset: [0, 0, 0],
    rotation: 0,
    reversed: false,
  };
  validateFastenerLayout(layout);
  return layout;
}
/** Origo, X and a point on the Y side define a free 3D placement plane. */
export function fastenerLayoutFromThreePoints(origin, xPoint, yPoint) {
  if (![origin, xPoint, yPoint].every(point))
    throw new Error('Välj giltiga punkter för origo, X och Y.');
  const x = new THREE.Vector3(...xPoint).sub(new THREE.Vector3(...origin));
  const y = new THREE.Vector3(...yPoint).sub(new THREE.Vector3(...origin));
  const xLength = x.length();
  if (xLength < 0.001) throw new Error('Välj X-riktning minst 0,001 mm från origo.');
  x.normalize();
  y.addScaledVector(x, -y.dot(x));
  const yLength = y.length();
  if (yLength < 0.001) throw new Error('Välj Y-riktning utanför linjen mellan origo och X.');
  const layout = {
    frame: { origin: [...origin], u: x.toArray(), v: y.normalize().toArray() },
    xLength,
    yLength,
    offset: [0, 0, 0],
    rotation: 0,
    reversed: false,
  };
  validateFastenerLayout(layout);
  return layout;
}
/** Adapt existing axis-based generated/manual fasteners to the same inspector fields. */
export function layoutForFastener(source) {
  if (source.layout) return structuredClone(source.layout);
  const axis = fastenerFrame(source).z;
  const reversed = source.group ? !source.group.reversed : false;
  const normal = axis.multiplyScalar(reversed ? 1 : -1);
  const u = new THREE.Vector3(...(source.group?.u || fastenerFrame(source).x.toArray()));
  return {
    frame: {
      origin: [...(source.group?.origin || source.insertion?.start || source.start)],
      u: u.toArray(),
      v: normal.cross(u).normalize().toArray(),
    },
    offset: [0, 0, 0],
    rotation: 0,
    reversed,
  };
}
/** Editing points belong to the pattern plane, never to the fitted shaft. */
export function fastenerLayoutAnchors(source) {
  if (!source.group) return [source.start, source.end];
  const layout = layoutForFastener(source);
  const { origin, u, v } = layout.frame;
  return [
    [...origin],
    origin.map((value, i) => value + u[i] * (layout.xLength || 100)),
    origin.map((value, i) => value + v[i] * (layout.yLength || 100)),
  ];
}
export function applyFastenerLayout(draft) {
  validateFastenerLayout(draft.layout);
  const { frame, offset, rotation, reversed } = draft.layout;
  const u = new THREE.Vector3(...frame.u),
    v = new THREE.Vector3(...frame.v);
  const normal = u.clone().cross(v);
  const origin = new THREE.Vector3(...frame.origin)
    .addScaledVector(u, offset[0])
    .addScaledVector(v, offset[1])
    .addScaledVector(normal, offset[2]);
  const axis = normal
    .applyAxisAngle(u, (rotation * Math.PI) / 180)
    .multiplyScalar(reversed ? 1 : -1);
  const direction = origin.clone().add(axis).toArray();
  return {
    ...draft,
    ...axisPlacement(draft.spec, origin.toArray(), direction),
    radial: u.toArray(),
    ...(draft.group
      ? {
          group: {
            ...draft.group,
            origin: origin.toArray(),
            direction,
            u: u.toArray(),
            reversed: !reversed,
            row: 0,
            column: 0,
          },
        }
      : {}),
  };
}
export function transformFastenerLayout(source, turn) {
  if (!source.layout) return {};
  const layout = structuredClone(source.layout),
    frame = layout.frame;
  const origin = turn(frame.origin);
  const vector = (axis) =>
    new THREE.Vector3(...turn(frame.origin.map((v, i) => v + axis[i])))
      .sub(new THREE.Vector3(...origin))
      .normalize()
      .toArray();
  layout.frame = { origin, u: vector(frame.u), v: vector(frame.v) };
  return { layout };
}
