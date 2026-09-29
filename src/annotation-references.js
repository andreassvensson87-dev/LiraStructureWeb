import { dimensionAxis } from './dimension-chain.js';

// Projection references use coordinate ranks, not renderer vertex order. Changes to
// the projected topology invalidate them instead of silently choosing another corner.
export function referenceCandidates(points, source, identities = points) {
  const rounded = identities.map((p) => p.map((v) => Math.round(v * 1e4) / 1e4));
  const axes = (identities[0] || [0, 0]).map((_, axis) =>
    [...new Set(rounded.map((p) => p[axis]))].sort((a, b) => a - b),
  );
  const indices = axes.map((values) => new Map(values.map((v, i) => [v, i])));
  const ranks = rounded.map((p) => p.map((v, axis) => indices[axis].get(v)));
  const topology = JSON.stringify([...new Set(ranks.map((p) => p.join(',')))].sort());
  let hash = 2166136261;
  for (const c of topology) hash = Math.imul(hash ^ c.charCodeAt(0), 16777619);
  const shape = `${axes.map((a) => a.length).join(':')}:${hash >>> 0}`;
  return points.map((p, i) =>
    Object.assign([...p], {
      reference: { kind: 'corner', source, shape, rank: ranks[i] },
    }),
  );
}

export function surfaceReference(point, source, candidates) {
  const points = candidates.filter((p) => p.reference?.source === source);
  if (!points.length) return null;
  const min = [0, 1].map((i) => Math.min(...points.map((p) => p[i])));
  const max = [0, 1].map((i) => Math.max(...points.map((p) => p[i])));
  return {
    kind: 'surface',
    source,
    shape: points[0].reference.shape,
    ratio: point.map((v, i) => (max[i] === min[i] ? 0 : (v - min[i]) / (max[i] - min[i]))),
  };
}

export function resolveReference(ref, candidates, grid) {
  if (ref.kind === 'grid') {
    if (!grid || ref.counts.some((n, i) => n !== grid[['x', 'y'][i]].length)) return null;
    return ref.indices.map((index, i) =>
      index === null ? ref.fixed[i] : grid[['x', 'y'][i]][index],
    );
  }
  const points = candidates.filter(
    (p) => p.reference?.source === ref.source && p.reference.shape === ref.shape,
  );
  if (!points.length) return null;
  if (ref.kind === 'surface')
    return ref.ratio.map((t, i) => {
      const values = points.map((p) => p[i]);
      const min = Math.min(...values),
        max = Math.max(...values);
      return min + t * (max - min);
    });
  const point = points.find((p) => p.reference.rank.every((v, i) => v === ref.rank[i]));
  return point ? [...point] : null;
}

export function gridReference(point, grid) {
  const indices = ['x', 'y'].map((axis, i) => {
    const index = grid[axis].findIndex((v) => Math.abs(v - point[i]) < 1e-6);
    return index < 0 ? null : index;
  });
  return indices.every((i) => i === null)
    ? null
    : {
        kind: 'grid',
        indices,
        counts: [grid.x.length, grid.y.length],
        fixed: [...point],
      };
}

export function updateAnnotationReferences(item, resolve, valid = () => true) {
  const broken = [];
  let changed = false;
  item.references?.forEach((ref, i) => {
    if (!ref || !item.points[i]) return;
    const point = resolve(ref);
    if (!point || !point.every(Number.isFinite) || !valid(point)) broken.push(i);
    else {
      changed ||= point.some((v, axis) => Math.abs(v - item.points[i][axis]) > 1e-6);
      item.points[i] = [...point];
    }
  });
  if (changed && !broken.length && item.kind === 'free' && item.points.length >= 2) {
    try {
      item.axis = dimensionAxis('free', item.points);
    } catch {
      broken.push(0, 1);
    }
  }
  return broken;
}
