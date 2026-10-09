import { groupSelection } from '../fasteners/group-data.js';

/** Expand user selections, without changing selections made by modeling tools. */
export function modelSelection(objects, assemblies, ids, mode = 'part') {
  const selected = groupSelection(objects, ids);
  if (mode !== 'assembly') return selected;
  const existing = new Set(objects.map((object) => object.id));
  for (const assembly of assemblies || []) {
    if (!assembly.memberIds.some((id) => selected.has(id))) continue;
    for (const id of assembly.memberIds) if (existing.has(id)) selected.add(id);
  }
  return groupSelection(objects, selected);
}
