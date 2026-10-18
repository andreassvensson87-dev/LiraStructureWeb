import { AxisMiss, partAxisIntervals, holeExtent, resolveFastenerHoles } from './placement.js';
import { entryAllowance, reachableMaterialLayers } from './material-reach.js';
import { fastenerFrame, axisPlacement } from './geometry.js';
import { isFastener } from './object-type.js';

/** Recompute machining against stationary hardware, without seating it on a moving target. */
export function refreshIndependentFastener(source, model) {
  source = { ...source, ...axisPlacement(source.spec, source.start, source.end) };
  const material = model.filter((s) => !isFastener(s));
  const first = entryAllowance(source);
  let blockedEntry = false;
  const candidates = source.holes.flatMap((hole) => {
    const part = material.find((s) => s.id === hole.targetId);
    if (!part) throw new Error('Hålets måldel saknas.');
    let intervals;
    try {
      intervals = partAxisIntervals(source, part, material);
    } catch (error) {
      if (error instanceof AxisMiss) return [];
      throw error;
    }
    if (['wall', 'blind'].includes(holeExtent(hole))) intervals = intervals.slice(0, 1);
    blockedEntry ||= intervals.some((v) => v.offset < first - 0.001 && v.offset + v.depth > 0.001);
    return intervals
      .filter((v) => v.offset >= first - 0.001)
      .map((v) => ({ ...v, targetId: hole.targetId }));
  });
  const { layers, warning } = reachableMaterialLayers(
    source,
    candidates,
    first,
    source.insertion.limited ? source.insertion.depth : null,
  );
  const result = {
    ...source,
    insertion: { ...source.insertion, reachWarning: warning || (blockedEntry ? 'hardware' : null) },
    layerCount: layers.length,
    holes: source.holes.map((hole) => ({
      ...hole,
      layers: layers
        .filter((v) => v.targetId === hole.targetId)
        .map(({ offset, depth }) => ({ offset, depth })),
    })),
  };
  delete result.span;
  if (layers.length) {
    const frame = fastenerFrame(source);
    const at = (distance) => frame.origin.clone().addScaledVector(frame.z, distance).toArray();
    result.span = {
      start: at(Math.min(...layers.map((v) => v.offset))),
      end: at(Math.max(...layers.map((v) => v.offset + v.depth))),
    };
  }
  return resolveFastenerHoles(result, model);
}
