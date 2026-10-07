import { arcGeometry, shapeSnapPoints, validateShape } from './drawing-shapes.js';

export function shapeGrips(item) {
  if (item.shape === 'circle') {
    const [c, e] = item.points,
      r = Math.hypot(e[0] - c[0], e[1] - c[1]);
    return [
      { kind: 'move', point: c },
      ...[
        [r, 0],
        [0, r],
        [-r, 0],
        [0, -r],
      ].map((d) => ({ kind: 'radius', point: c.map((v, i) => v + d[i]) })),
    ];
  }
  const points = shapeSnapPoints(item);
  const center =
    item.shape === 'arc'
      ? arcGeometry(item.points).center
      : [0, 1].map((i) => points.reduce((s, p) => s + p[i], 0) / points.length);
  return [
    ...points.map((point, index) => ({
      kind: item.shape === 'rectangle' ? 'corner' : 'point',
      index,
      point,
    })),
    { kind: 'move', point: center },
  ];
}

export function shapeWithGrip(item, grip, target) {
  const next = structuredClone(item);
  if (grip.kind === 'move') {
    const delta = target.map((v, i) => v - grip.point[i]);
    next.points = next.points.map((p) => p.map((v, i) => v + delta[i]));
  } else if (grip.kind === 'radius') next.points[1] = [...target];
  else if (grip.kind === 'corner') {
    const [a, b] = next.points;
    if (grip.index === 0) next.points[0] = [...target];
    else if (grip.index === 2) next.points[1] = [...target];
    else if (grip.index === 1) {
      b[0] = target[0];
      a[1] = target[1];
    } else {
      a[0] = target[0];
      b[1] = target[1];
    }
  } else next.points[grip.index] = [...target];
  validateShape(next.shape, next.points);
  return next;
}
