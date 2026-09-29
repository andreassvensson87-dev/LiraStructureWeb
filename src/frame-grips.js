import { instancePoint } from './frame-layout.js';
const same = (a, b) => a[0] === b[0] && a[1] === b[1];
export function frameGrips(entity, layout) {
  if (entity.type === 'block') return [instancePoint(entity, layout)];
  if (entity.type !== 'line') return [[...entity.point]];
  const points = entity.points,
    closed = points.length > 2 && same(points[0], points.at(-1));
  return (closed ? points.slice(0, -1) : points).map((p) => [...p]);
}
export function moveFrameVertex(entity, index, target) {
  if (
    entity.type !== 'line' ||
    !Number.isInteger(index) ||
    index < 0 ||
    index >= frameGrips(entity).length ||
    !target.every(Number.isFinite)
  )
    throw Error('Ogiltig linjepunkt.');
  const closed = entity.points.length > 2 && same(entity.points[0], entity.points.at(-1));
  return {
    ...entity,
    points: entity.points.map((p, i) =>
      i === index || (closed && index === 0 && i === entity.points.length - 1)
        ? [...target]
        : [...p],
    ),
  };
}

// Compare model coordinates, not screen proximity: nearby independent joints stay separate.
export function coincidentFrameVertices(entities, selected, point) {
  const matches = {};
  for (const e of entities) {
    if (e.type !== 'line' || !selected.has(e.id)) continue;
    const indices = e.points.flatMap((p, i) =>
      Math.hypot(p[0] - point[0], p[1] - point[1]) <= 1e-6 ? [i] : [],
    );
    if (indices.length) matches[e.id] = indices;
  }
  return matches;
}
export function moveFrameVertices(entity, matches, target) {
  const indices = matches[entity.id];
  if (!indices) return entity;
  if (target.length !== 2 || !target.every(Number.isFinite)) throw Error('Ogiltig linjepunkt.');
  return {
    ...entity,
    points: entity.points.map((p, i) => (indices.includes(i) ? [...target] : [...p])),
  };
}
