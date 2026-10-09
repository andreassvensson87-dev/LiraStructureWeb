import { gridSegments, gridProjection, lineIntersection } from './grid-geometry.js';
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
  if (ref.kind === 'bore') {
    const point = candidates.find(
      (p) =>
        p.reference?.kind === 'bore' &&
        p.reference.source === ref.source &&
        p.reference.featureId === ref.featureId,
    );
    return point ? [...point] : null;
  }
  if (ref.kind === 'grid') {
    if (ref.lineIds || grid?.lines) {
      if (!grid) return null;
      const ids =
        ref.lineIds ??
        ref.indices.flatMap((index, i) => (index === null ? [] : [`${['x', 'y'][i]}:${index}`]));
      const segments = gridSegments(grid),
        lines = ids.map((id) => segments.find((line) => line.id === id));
      if (!lines.length || lines.some((line) => !line)) return null;
      if (lines.length === 2)
        return lineIntersection(lines[0].start, lines[0].end, lines[1].start, lines[1].end);
      if (ref.t !== undefined)
        return lines[0].start.map((v, i) => v + (lines[0].end[i] - v) * ref.t);
      // Old references have an absolute coordinate along the other axis.
      const line = lines[0],
        axis = ref.indices[0] === null ? 0 : 1,
        delta = line.end[axis] - line.start[axis];
      if (Math.abs(delta) < 1e-9) return null;
      const t = (ref.fixed[axis] - line.start[axis]) / delta;
      return t >= 0 && t <= 1 ? line.start.map((v, i) => v + (line.end[i] - v) * t) : null;
    }
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
  if (grid.lines) {
    const hits = gridSegments(grid)
      .map((line) => ({ line, ...gridProjection(point, line) }))
      .filter(
        (hit) =>
          hit.t >= 0 &&
          hit.t <= 1 &&
          Math.hypot(hit.point[0] - point[0], hit.point[1] - point[1]) < 1e-6,
      );
    if (!hits.length) return null;
    const pair = hits
      .slice(1)
      .find((hit) =>
        lineIntersection(hits[0].line.start, hits[0].line.end, hit.line.start, hit.line.end),
      );
    return pair
      ? { kind: 'grid', lineIds: [hits[0].line.id, pair.line.id] }
      : { kind: 'grid', lineIds: [hits[0].line.id], t: hits[0].t };
  }
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
