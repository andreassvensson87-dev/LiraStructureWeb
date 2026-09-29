import { planeFrame, plateLocal } from '../../plate.js';
import { lineCutFrame } from '../../line-cut.js';
import * as THREE from 'three';
/** Pure tool transition. Validation/commit and presentation belong to the application adapter. */
export function advancePlatePoint(operation, point, { exact = false, closesPolygon = false } = {}) {
  if (operation.mode === 'plateVertex')
    return {
      kind: 'vertex',
      object: {
        ...operation.source,
        polygon: operation.source.polygon.map((v, i) =>
          i === operation.index ? plateLocal(operation.source, point) : [...v],
        ),
      },
    };
  const next = {
    ...operation,
    polygon: operation.polygon.map((p) => [...p]),
    planePoints: operation.planePoints.map((p) => [...p]),
  };
  if (!next.frame) {
    const points = [...next.planePoints, [...point]];
    if (next.planeMode === 'three' && points.length < 3) {
      if (points.length === 2 && Math.hypot(...point.map((v, i) => v - points[0][i])) < 1)
        throw Error('Välj en annan planpunkt.');
      next.planePoints = points;
      return { kind: 'plane-point', operation: next, first: [...point] };
    }
    next.frame = planeFrame(next.planeMode, points);
    next.planePoints = points;
    next.polygon = next.planeMode === 'three' ? [] : [[0, 0]];
    return { kind: 'plane', operation: next, first: next.polygon.length ? [...point] : null };
  }
  if (next.lineCut && next.polygon.length === 2) {
    const f = lineCutFrame(next),
      distance = new THREE.Vector3(...point).sub(f.origin).dot(f.n);
    if (Math.abs(distance) < 1) throw Error('Klicka en bit från snittlinjen.');
    next.sidePicked = true;
    return { kind: 'side', operation: next, side: distance > 0 ? 'positive' : 'negative' };
  }
  const local = plateLocal(next, point),
    polygon = next.polygon;
  if (
    polygon.length >= 3 &&
    (exact ? Math.hypot(local[0] - polygon[0][0], local[1] - polygon[0][1]) < 0.001 : closesPolygon)
  )
    return { kind: 'finish' };
  if (polygon.some((v) => Math.hypot(v[0] - local[0], v[1] - local[1]) < 1))
    throw Error('Välj ett nytt hörn.');
  polygon.push(local);
  return { kind: 'point', operation: next, first: [...point] };
}
