import { objectAnchors } from '../model-object.js';
export const gripRefKey = (ref) => JSON.stringify([ref.id, ref.kind]);
export function gripPoint(object, ref) {
  const index =
    typeof ref.kind === 'number'
      ? ref.kind
      : ref.kind === 'start'
        ? 0
        : ref.kind === 'end'
          ? 1
          : -1;
  return object && index >= 0 ? objectAnchors(object)[index] : null;
}
export function validGripRefs(objects, refs, selectedIds) {
  const byId = new Map(objects.map((o) => [o.id, o])),
    seen = new Set();
  return refs.filter((ref) => {
    const object = byId.get(ref.id),
      key = gripRefKey(ref);
    if (
      !object ||
      object.generatedBy ||
      object.type === 'component' ||
      (selectedIds && !selectedIds.has(ref.id)) ||
      !gripPoint(object, ref) ||
      seen.has(key)
    )
      return false;
    seen.add(key);
    return true;
  });
}
export function selectGripRefs(previous, chosen, { additive = false, toggle = false } = {}) {
  const keys = new Set(chosen.map(gripRefKey)),
    old = new Set(previous.map(gripRefKey));
  if (toggle && chosen.length && chosen.every((r) => old.has(gripRefKey(r))))
    return previous.filter((r) => !keys.has(gripRefKey(r)));
  const result = additive || toggle ? [...previous] : [];
  const seen = new Set(result.map(gripRefKey));
  for (const ref of chosen)
    if (!seen.has(gripRefKey(ref))) {
      seen.add(gripRefKey(ref));
      result.push(ref);
    }
  return result;
}
export function gripRefsInRect(projected, a, b) {
  return projected
    .filter(
      ({ x, y }) =>
        x >= Math.min(a.x, b.x) &&
        x <= Math.max(a.x, b.x) &&
        y >= Math.min(a.y, b.y) &&
        y <= Math.max(a.y, b.y),
    )
    .flatMap(({ grip }) => grip.refs);
}
