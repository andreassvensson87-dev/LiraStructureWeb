import { gridSegments, gridCrossings, gridProjection, lineIntersection } from './grid-geometry.js';
import { roundProfile } from './round-profile.js';
import { gridLabel } from './grid-labels.js';
import * as THREE from 'three';
import { createSnapGeometryContext, objectAnchors } from './model-object.js';
const axes = { X: [1, 0, 0], Y: [0, 1, 0], Z: [0, 0, 1] };
export function resolveSnap({
  pointer,
  camera,
  width,
  height,
  ray,
  start,
  z,
  sweeps,
  model = sweeps,
  geometryContext = null,
  referencePoints = [],
  grid,
  endpoints = true,
  cornerSnap = endpoints,
  quadrantSnap = cornerSnap,
  midpointSnap = false,
  perpendicularSnap = false,
  gridLines = true,
  gridIntersections = true,
  gridStepEnabled = false,
  gridStep = 100,
  axisSnap = true,
  polar = 45,
  lock = null,
  workPlane = null,
  constrainToPlane = true,
}) {
  geometryContext ??= createSnapGeometryContext(model);
  const gridZ = grid.z ?? 0;
  const step = Number.isFinite(gridStep) && gridStep > 0 ? gridStep : 100;
  const quantize = (v) => (gridStepEnabled ? Math.round(v / step) * step : v);
  const normal = workPlane
    ? new THREE.Vector3(...workPlane.u).cross(new THREE.Vector3(...workPlane.v)).normalize()
    : null;
  const onPlane = (p) =>
    !constrainToPlane ||
    !normal ||
    Math.abs(
      p
        .clone()
        .sub(new THREE.Vector3(...workPlane.origin))
        .dot(normal),
    ) < 0.01;
  const screen = (p) => {
    const v = p.clone().project(camera);
    return new THREE.Vector2(((v.x + 1) * width) / 2, ((1 - v.y) * height) / 2);
  };
  const cursor = new THREE.Vector2(...pointer),
    origin = start ? new THREE.Vector3(...start) : null;
  const onLock = (p) =>
    !lock ||
    !origin ||
    p
      .clone()
      .sub(origin)
      .cross(new THREE.Vector3(...axes[lock]))
      .length() < 0.01;
  // Exact object points outrank tracking directions. An explicit axis lock is never violated.
  const objectPoints = sweeps.flatMap((s) => [
    ...(endpoints
      ? objectAnchors(s).map((coords) => ({
          coords,
          symbol: 'square',
          label: s.type === 'plate' ? 'Polygonhörn' : 'Ändpunkt',
        }))
      : []),
    ...((roundProfile(s) ? quadrantSnap : cornerSnap)
      ? geometryContext.objectCorners(s).map((coords) => ({
          coords,
          symbol: roundProfile(s) ? 'diamond' : 'square',
          label: roundProfile(s) ? 'Kvadrant' : 'Hörn',
        }))
      : []),
  ]);
  const holePoints = cornerSnap
    ? sweeps.flatMap((s) => geometryContext.holeCenters?.(s) || [])
    : [];
  const segmentPoints = [];
  if (midpointSnap || (perpendicularSnap && origin))
    for (const s of sweeps)
      for (const [a, b] of geometryContext.objectSegments(s)) {
        const av = new THREE.Vector3(...a),
          delta = new THREE.Vector3(...b).sub(av),
          lengthSq = delta.lengthSq();
        if (lengthSq < 1e-12) continue;
        if (midpointSnap)
          segmentPoints.push({
            coords: av.clone().addScaledVector(delta, 0.5).toArray(),
            symbol: 'midpoint',
            label: 'Mittpunkt',
          });
        if (perpendicularSnap && origin) {
          const t = origin.clone().sub(av).dot(delta) / lengthSq;
          if (t >= 0 && t <= 1) {
            const point = av.clone().addScaledVector(delta, t);
            if (point.distanceTo(origin) > 0.01)
              segmentPoints.push({
                coords: point.toArray(),
                symbol: 'perpendicular',
                label: 'Vinkelrät',
              });
          }
        }
      }
  for (const [points, tolerance] of [
    [holePoints, 14],
    [objectPoints, 14],
    [referencePoints.filter((p) => !p.edge), 14],
    [segmentPoints, 12],
    [referencePoints.filter((p) => p.edge), 10],
    [
      gridIntersections
        ? gridCrossings(grid).map(({ point, lines }) => ({
            coords: [...point, gridZ],
            symbol: 'cross',
            label: `Stomlinjekorsning ${lines.map((line) => line.label).join('/')}`,
            gridIds: lines.map((line) => line.pickId),
          }))
        : [],
      20,
    ],
  ]) {
    let best = null,
      distance = tolerance,
      depth = Infinity;
    for (const { coords, label, gridIds, symbol, featureId } of points) {
      const p = new THREE.Vector3(...coords),
        hitPoint = p,
        clip = hitPoint.clone().project(camera);
      if (Math.abs(clip.z) > 1 || !onLock(p) || !onPlane(p)) continue;
      const d = screen(hitPoint).distanceTo(cursor);
      if (
        d < tolerance &&
        (d < distance - 1e-6 || (Math.abs(d - distance) <= 1e-6 && clip.z < depth))
      ) {
        distance = d;
        depth = clip.z;
        best = { point: coords, label, kind: 'point', gridIds, symbol };
        if (featureId) best.featureId = featureId;
      }
    }
    if (best) return best;
  }
  function directionSnap(direction, label, forced = false) {
    if (normal && Math.abs(direction.dot(normal)) > 1e-6)
      return forced ? { point: null, label: 'Riktningen ligger utanför arbetsplanet' } : null;
    const a = screen(origin),
      delta = screen(origin.clone().addScaledVector(direction, 1000)).sub(a);
    // A direction seen end-on has no unambiguous mouse distance.
    if (delta.length() < 1)
      return forced ? { point: null, label: `${label}: rotera vyn för att ange längd` } : null;
    const offset = cursor.clone().sub(a),
      t = (offset.dot(delta) / delta.lengthSq()) * 1000;
    const distance = offset
      .clone()
      .sub(delta.clone().multiplyScalar(t / 1000))
      .length();
    if (!forced && (distance > 10 || offset.length() < 24)) return null;
    return {
      point: origin.clone().addScaledVector(direction, quantize(t)).toArray(),
      label,
      kind: 'direction',
      distance,
      axis: /^[XYZ]/.test(label) ? label[0] : null,
    };
  }
  function gridLineSnap(tracking = null) {
    if (!gridLines) return null;
    let best = null,
      bestDistance = 12;
    const direction =
      tracking?.point && origin
        ? new THREE.Vector3(...tracking.point).sub(origin).normalize()
        : null;
    if (grid.lines) {
      for (const line of gridSegments(grid)) {
        const a = new THREE.Vector3(...line.start, gridZ),
          b = new THREE.Vector3(...line.end, gridZ);
        let candidate;
        if (direction) {
          if (Math.abs(direction.z) > 1e-8) {
            candidate = origin.clone().addScaledVector(direction, (gridZ - origin.z) / direction.z);
            const projection = gridProjection(candidate.toArray(), line);
            if (
              projection.t < 0 ||
              projection.t > 1 ||
              Math.hypot(projection.point[0] - candidate.x, projection.point[1] - candidate.y) >
                0.01
            )
              continue;
          } else {
            if (Math.abs(origin.z - gridZ) > 0.01) continue;
            const cross = lineIntersection(
              line.start,
              line.end,
              origin.toArray(),
              origin.clone().add(direction).toArray(),
              false,
            );
            if (cross) {
              const projection = gridProjection(cross, line);
              if (projection.t < 0 || projection.t > 1) continue;
              candidate = new THREE.Vector3(...cross, gridZ);
            } else {
              const projection = gridProjection(tracking.point, line);
              if (
                projection.t < 0 ||
                projection.t > 1 ||
                Math.hypot(
                  projection.point[0] - tracking.point[0],
                  projection.point[1] - tracking.point[1],
                ) > 0.01
              )
                continue;
              candidate = new THREE.Vector3(...tracking.point);
            }
          }
        } else {
          const sa = screen(a),
            delta = screen(b).sub(sa);
          if (delta.lengthSq() < 1) continue;
          const t = cursor.clone().sub(sa).dot(delta) / delta.lengthSq();
          if (t < 0 || t > 1) continue;
          candidate = a.clone().lerp(b, t);
        }
        if (
          !onLock(candidate) ||
          !onPlane(candidate) ||
          Math.abs(candidate.clone().project(camera).z) > 1
        )
          continue;
        const distance = screen(candidate).distanceTo(cursor);
        if (distance < bestDistance) {
          bestDistance = distance;
          best = {
            point: candidate.toArray(),
            kind: 'point',
            symbol: 'line',
            gridIds: [line.pickId],
            label: `Stomlinje ${line.label}${tracking ? ' · ' + tracking.label : ''}`,
          };
        }
      }
      return best;
    }
    for (const [axis, positions, other] of [
      [0, grid.x, grid.y],
      [1, grid.y, grid.x],
    ]) {
      if (!other.length) continue;
      const along = 1 - axis,
        low = other[0] - 1500,
        high = other.at(-1) + 1500;
      for (let i = 0; i < positions.length; i++) {
        const fixed = positions[i],
          a = new THREE.Vector3(0, 0, gridZ),
          b = new THREE.Vector3(0, 0, gridZ);
        a.setComponent(axis, fixed);
        b.setComponent(axis, fixed);
        a.setComponent(along, low);
        b.setComponent(along, high);
        let candidate;
        if (direction) {
          if (Math.abs(direction.getComponent(axis)) > 1e-8) {
            const t = (fixed - origin.getComponent(axis)) / direction.getComponent(axis);
            candidate = origin.clone().addScaledVector(direction, t);
            if (
              Math.abs(candidate.z - gridZ) > 0.01 ||
              candidate.getComponent(along) < low ||
              candidate.getComponent(along) > high
            )
              continue;
          } else if (
            Math.abs(origin.getComponent(axis) - fixed) < 0.01 &&
            Math.abs(direction.z) < 1e-8 &&
            Math.abs(origin.z - gridZ) < 0.01
          ) {
            candidate = new THREE.Vector3(...tracking.point);
            if (candidate.getComponent(along) < low || candidate.getComponent(along) > high)
              continue;
          } else if (
            Math.abs(origin.getComponent(axis) - fixed) < 0.01 &&
            Math.abs(direction.z) > 1e-8
          ) {
            candidate = origin.clone().addScaledVector(direction, (gridZ - origin.z) / direction.z);
            if (candidate.getComponent(along) < low || candidate.getComponent(along) > high)
              continue;
          } else continue;
        } else {
          const sa = screen(a),
            delta = screen(b).sub(sa);
          if (delta.lengthSq() < 1) continue;
          const t = cursor.clone().sub(sa).dot(delta) / delta.lengthSq();
          if (t < 0 || t > 1) continue;
          candidate = a.clone().lerp(b, t);
        }
        if (!onLock(candidate) || !onPlane(candidate)) continue;
        const pickPoint = candidate;
        const clip = pickPoint.clone().project(camera);
        if (Math.abs(clip.z) > 1) continue;
        const distance = screen(pickPoint).distanceTo(cursor);
        if (distance < bestDistance) {
          bestDistance = distance;
          best = {
            point: candidate.toArray(),
            kind: 'point',
            symbol: 'line',
            gridIds: [`${axis === 0 ? 'x' : 'y'}:${i}`],
            label: `Stomlinje ${gridLabel(grid, axis === 0 ? 'x' : 'y', i)}${tracking ? ' · ' + tracking.label : ''}`,
          };
        }
      }
    }
    return best;
  }
  if (origin && lock) {
    const tracking = directionSnap(new THREE.Vector3(...axes[lock]), `${lock} låst`, true);
    return (tracking?.point ? gridLineSnap(tracking) : null) || gridLineSnap() || tracking;
  }
  const candidates = [];
  if (origin && axisSnap)
    for (const [name, d] of Object.entries(axes)) {
      const s = directionSnap(new THREE.Vector3(...d), `${name}-riktning`);
      if (s) candidates.push(s);
    }
  if (origin && polar)
    for (let angle = 0; angle < 180; angle += polar) {
      if (!workPlane && axisSnap && angle % 90 === 0) continue;
      const rad = (angle * Math.PI) / 180;
      const s = directionSnap(
        workPlane
          ? new THREE.Vector3(...workPlane.u)
              .multiplyScalar(Math.cos(rad))
              .addScaledVector(new THREE.Vector3(...workPlane.v), Math.sin(rad))
          : new THREE.Vector3(Math.cos(rad), Math.sin(rad), 0),
        `Polar ${angle}° · ${workPlane ? 'plan' : 'XY'}`,
      );
      if (s) candidates.push(s);
    }
  candidates.sort((a, b) => a.distance - b.distance);
  const tracking = candidates[0] ?? null;
  // Automatic tracking is a suggestion; a visible grid line remains snappable.
  const lineHit = gridLineSnap(tracking) || (tracking ? gridLineSnap() : null);
  if (lineHit) return lineHit;
  if (tracking) return tracking;
  if (workPlane) {
    const planeOrigin =
      !constrainToPlane && origin ? origin : new THREE.Vector3(...workPlane.origin);
    const p = ray.intersectPlane(
      new THREE.Plane().setFromNormalAndCoplanarPoint(normal, planeOrigin),
      new THREE.Vector3(),
    );
    if (!p) return { point: null, label: 'Arbetsplanet ses från sidan – rotera vyn' };
    if (gridStepEnabled) {
      const o = planeOrigin.clone(),
        u = new THREE.Vector3(...workPlane.u).normalize(),
        v = new THREE.Vector3(...workPlane.v).normalize(),
        d = p.clone().sub(o);
      p.copy(o)
        .addScaledVector(u, quantize(d.dot(u)))
        .addScaledVector(v, quantize(d.dot(v)));
    }
    return {
      point: p.toArray(),
      kind: 'free',
      label: gridStepEnabled ? `Rutsteg ${step} mm` : 'I arbetsplanet',
    };
  }
  const p = ray.intersectPlane(
    new THREE.Plane(new THREE.Vector3(0, 0, 1), -z),
    new THREE.Vector3(),
  );
  return p
    ? {
        point: [quantize(p.x), quantize(p.y), z],
        label: gridStepEnabled ? `Rutsteg ${step} mm` : 'Fritt i XY',
        kind: 'free',
      }
    : { point: null, label: 'Arbetsplanet ses från sidan – rotera vyn' };
}
