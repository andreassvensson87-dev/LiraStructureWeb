/** Carry assembly identities across mark-only part changes, retaining their numbers. */
export function rekeyAssemblyPartMarks(state, previousParts, nextParts) {
  const changes = new Map();
  for (const [id, old] of Object.entries(previousParts.assignments)) {
    const next = nextParts.assignments[id];
    if (next && old.key === next.key && old.mark !== next.mark)
      changes.set(JSON.stringify([old.key, old.mark]), next.mark);
  }
  if (!changes.size) return {};
  const token = (text) => {
    const item = JSON.parse(text);
    const mark = changes.get(JSON.stringify([item.part, item.mark]));
    return mark ? JSON.stringify({ ...item, mark }) : text;
  };
  const rekey = (text) =>
    text
      ? JSON.stringify(
          JSON.parse(text)
            .map(token)
            .sort((a, b) => a.localeCompare(b)),
        )
      : text;
  const members = (items) =>
    items
      .map((m) => ({ ...m, token: token(m.token) }))
      .sort((a, b) => a.token.localeCompare(b.token) || a.id.localeCompare(b.id));
  const registry = new Map();
  const active = (r) => state.assemblies.some((a) => a.typeKey === r.key && a.mark === r.mark);
  const candidates = [...state.assemblyNumbering.registry].sort(
    (a, b) =>
      Number(active(b)) - Number(active(a)) ||
      Number(!!b.manual) - Number(!!a.manual) ||
      a.mark.localeCompare(b.mark, 'en', { numeric: true }),
  );
  for (const record of candidates) {
    const key = rekey(record.key);
    if (!registry.has(key)) registry.set(key, { ...record, key });
  }
  return {
    assemblies: state.assemblies.map((a) => ({
      ...a,
      ...(a.typeKey ? { typeKey: rekey(a.typeKey) } : {}),
      ...(a.numberedMembers ? { numberedMembers: members(a.numberedMembers) } : {}),
    })),
    assemblyNumbering: {
      ...state.assemblyNumbering,
      registry: [...registry.values()],
    },
    drawings: state.drawings.map((d) =>
      d.type === 'AS'
        ? {
            ...d,
            ...(d.assemblyKey ? { assemblyKey: rekey(d.assemblyKey) } : {}),
            ...(d.assemblyMembers ? { assemblyMembers: members(d.assemblyMembers) } : {}),
          }
        : d,
    ),
  };
}
