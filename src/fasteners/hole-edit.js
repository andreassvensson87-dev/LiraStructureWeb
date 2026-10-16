/** Changing bolt diameter retains explicitly chosen clearance; pilot holes keep their own dimensions. */
export function resizeFastenerHoles(holes, before, after) {
  if (!before || !after) return structuredClone(holes);
  return holes.map((hole) => ({
    ...structuredClone(hole),
    ...(hole.kind === 'clearance'
      ? { diameter: hole.diameter + after.diameter - before.diameter }
      : {}),
  }));
}

/** Shared hole controls apply only the property the user explicitly changes. */
export function changeHoleSettings(holes, spec, key, value) {
  if (!spec) throw new Error('Välj skruvstandard och dimension.');
  if (key === 'clearance' && (!Number.isFinite(value) || value < 0 || value > 100))
    throw new Error('Hålspel måste vara 0–100.');
  if (key === 'depth' && (!Number.isFinite(value) || value <= 0 || value > 1e7))
    throw new Error('Ange ett positivt håldjup.');
  if (key === 'kind' && !['none', 'clearance', 'pilot'].includes(value))
    throw new Error('Välj giltig håltyp.');
  return holes.map((hole) => {
    const next = structuredClone(hole);
    if (key === 'clearance') next.diameter = spec.diameter + value;
    if (key === 'depth') next.depth = value;
    if (key === 'kind') {
      next.kind = value;
      next.extent = value === 'pilot' ? 'blind' : 'profile';
    }
    return next;
  });
}
