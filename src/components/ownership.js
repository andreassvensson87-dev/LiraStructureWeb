/** Generated members are edited and removed through their owning component. */
export function componentDeletion(objects, ids) {
  const result = new Set(ids);
  for (const s of objects) if (result.has(s.id) && s.generatedBy) result.add(s.generatedBy);
  for (const s of objects) if (s.generatedBy && result.has(s.generatedBy)) result.add(s.id);
  return result;
}
/** Moving a generated component moves its reference; generated members are regenerated from that reference. */
export function componentTransformSources(objects, ids) {
  const selected = new Set(ids);
  const owners = new Set(
    objects.filter((s) => selected.has(s.id) && s.generatedBy).map((s) => s.generatedBy),
  );
  for (const s of objects)
    if (
      s.type === 'component' &&
      ['baseplate', 'stiffener', 'endplate', 'boltedEndplate', 'beamSplice'].includes(s.kind) &&
      (selected.has(s.id) || owners.has(s.id))
    ) {
      selected.add(s.id);
      s.references.forEach((id) => selected.add(id));
    }
  return objects.filter((s) => selected.has(s.id) && !s.generatedBy);
}
