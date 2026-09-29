export function copyLibraryItem(item, items) {
  const base = `${item.name} – kopia`;
  let name = base,
    n = 2;
  while (items.some((i) => i.name === name)) name = `${base} ${n++}`;
  const copy = structuredClone(item);
  copy.id = crypto.randomUUID();
  copy.name = name;
  for (const entity of copy.entities) entity.id = crypto.randomUUID();
  return copy;
}
export function libraryUsage(id, kind, layouts, drawings) {
  return kind === 'layout'
    ? drawings
        .filter((d) => d.sheet?.layoutId === id)
        .map((d) => `${d.number || ''} · ${d.name || 'Ritning'}`)
    : layouts.filter((l) => l.entities.some((e) => e.blockId === id)).map((l) => l.name);
}
