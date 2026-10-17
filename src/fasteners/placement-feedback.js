import { fastenerFitWarnings } from './manual-length.js';

/** Read resolved placement only; never repeat material searches or change a proposal. */
export function fastenerPlacementFeedback(batch) {
  const warnings = [...new Set(batch.flatMap(fastenerFitWarnings))];
  const targets = new Map();
  const layers = batch.map((screw) => {
    let total = 0;
    for (const hole of screw.holes) {
      const count = hole.kind === 'none' || hole.active === false ? 0 : hole.layers?.length || 0;
      total += count;
      if (!targets.has(hole.targetId)) targets.set(hole.targetId, []);
      targets.get(hole.targetId).push(count);
    }
    return total;
  });
  const range = (values) => ({ min: Math.min(...values), max: Math.max(...values) });
  return {
    count: batch.length,
    layers: layers.length ? range(layers) : { min: 0, max: 0 },
    targets: [...targets].map(([id, values]) => ({
      id,
      reached: values.filter((n) => n > 0).length,
      ...range(values),
    })),
    warnings,
  };
}
