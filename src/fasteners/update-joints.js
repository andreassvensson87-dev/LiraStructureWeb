import { updateComponents } from '../components/fit.js';
import { automaticPlacement } from './placement.js';
import { isFastener, validateFastener } from './object-type.js';

/** Refit automatic joints against the complete proposed edit, before it enters the project. */
export function updateAutomaticJoints(before, after) {
  after = updateComponents(before, after);
  const previous = new Map(before.map((s) => [s.id, s]));
  const changed = new Set(after.filter((s) => previous.get(s.id) !== s).map((s) => s.id));
  const objects = new Map(after.map((s) => [s.id, s]));
  const cuts = after.filter((s) => ['polygoncut', 'linecut', 'component'].includes(s.type));
  const affectedTargets = new Set(cuts.filter((s) => changed.has(s.id)).flatMap((s) => s.targets));
  for (const cut of before)
    if (['polygoncut', 'linecut', 'component'].includes(cut.type) && !objects.has(cut.id))
      for (const id of cut.targets) affectedTargets.add(id);
  return after.map((s) => {
    if (
      !isFastener(s) ||
      !s.insertion?.automatic ||
      !s.holes.length ||
      !(
        changed.has(s.id) ||
        s.holes.some((h) => changed.has(h.targetId) || affectedTargets.has(h.targetId))
      )
    )
      return s;
    const targets = new Set(s.holes.map((h) => h.targetId));
    const material = [...targets].map((id) => objects.get(id)).filter(Boolean);
    material.push(...cuts.filter((c) => c.targets.some((id) => targets.has(id))));
    try {
      const result = automaticPlacement(
        s,
        s.insertion.start,
        s.insertion.direction,
        material,
        s.insertion.limited ? s.insertion.depth : null,
      );
      const error = validateFastener(result);
      if (error) throw new Error(error);
      return result;
    } catch (error) {
      throw new Error(`${s.name || 'Skruvförband'}: ${error.message}`);
    }
  });
}
