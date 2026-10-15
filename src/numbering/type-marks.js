import { allocateMark, equivalent, matchingKey, recordSeries } from './rules.js';

/** Resolve all existing identities before inheriting a changed type's former mark.
 * Groups supply geometry keys, series and member-owned previous assignments.
 * No project data is mutated; both part and assembly numbering use these rules.
 */
export function assignTypeMarks(groups, records, options, tolerance = 0, reserved = []) {
  const registry = structuredClone(records).filter((r) => !options.renumberAll || r.manual);
  const used = new Set([
    ...registry.filter((r) => !options.reuseOldNumbers || r.manual).map((r) => r.mark),
    ...reserved,
  ]);
  const identities = new Map(),
    claimed = new Map();
  const blocked = new Set(reserved.map((mark) => mark.toLowerCase()));
  const assign = (group, record) => {
    identities.set(group, record);
    claimed.set(record.mark.toLowerCase(), record.key);
    used.add(record.mark);
  };
  // Matching geometry (including a historical type) takes priority over retention.
  for (const group of groups) {
    const compare =
      !options.renumberAll &&
      group.members.some(({ previous }) =>
        previous
          ? matchingKey(previous.key, group.key, tolerance) || options.modifiedParts !== 'new'
          : options.newParts !== 'new',
      );
    const record = registry.find(
      (r) =>
        group.members.every((member) => matchingKey(r.key, member.key, tolerance)) &&
        (r.manual || compare) &&
        !blocked.has(r.mark.toLowerCase()),
    );
    if (record) assign(group, record);
  }
  if (!options.renumberAll && options.modifiedParts !== 'new') {
    const candidates = [];
    for (const group of groups) {
      if (identities.has(group)) continue;
      const origins = new Map();
      for (const { id, previous } of group.members) {
        if (!previous) continue;
        const old = registry.find((r) => r.key === previous.key && r.mark === previous.mark);
        if (!old || !equivalent(recordSeries(old), group.series)) continue;
        if (!origins.has(old.mark)) origins.set(old.mark, { group, old, ids: [] });
        origins.get(old.mark).ids.push(id);
      }
      candidates.push(...origins.values());
    }
    // If every old occurrence changes differently, keep the largest surviving
    // branch. Stable member IDs break ties, independently of model/list order.
    candidates.sort(
      (a, b) =>
        b.ids.length - a.ids.length ||
        [...a.ids].sort()[0].localeCompare([...b.ids].sort()[0]) ||
        a.old.mark.localeCompare(b.old.mark, undefined, { numeric: true }),
    );
    const byGroup = new Map();
    for (const candidate of candidates) {
      if (!byGroup.has(candidate.group)) byGroup.set(candidate.group, []);
      byGroup.get(candidate.group).push(candidate);
    }
    const chosen = new Map(),
      owners = new Map();
    for (const candidate of candidates) {
      if (chosen.has(candidate.group)) continue;
      const queue = [candidate.group],
        parents = new Map([[candidate.group, null]]),
        seen = new Set();
      let free = null;
      for (let i = 0; i < queue.length && !free; i++) {
        for (const edge of byGroup.get(queue[i])) {
          const mark = edge.old.mark.toLowerCase();
          if (seen.has(mark) || claimed.has(mark) || blocked.has(mark)) continue;
          seen.add(mark);
          const owner = owners.get(mark);
          if (!owner) {
            free = edge;
            break;
          }
          if (!parents.has(owner)) {
            parents.set(owner, edge);
            queue.push(owner);
          }
        }
      }
      // A merge may have two former marks while a split branch can inherit only
      // one. Reassign along a free path to preserve both, without displacing a
      // matching existing type or depending on object iteration order.
      while (free) {
        const previous = chosen.get(free.group);
        if (previous) owners.delete(previous.old.mark.toLowerCase());
        chosen.set(free.group, free);
        owners.set(free.old.mark.toLowerCase(), free.group);
        free = parents.get(free.group);
      }
    }
    for (const { group, old } of chosen.values()) assign(group, { ...old, key: group.key });
  }
  for (const group of groups) {
    if (identities.has(group)) continue;
    const record = { key: group.key, mark: allocateMark(group.series, registry, used, options) };
    registry.push(record);
    assign(group, record);
  }
  const active = [...new Map([...identities.values()].map((r) => [r.key, r])).values()];
  return {
    identities,
    registry: [
      ...registry.filter(
        (r) =>
          !active.some((a) => a.key === r.key || a.mark.toLowerCase() === r.mark.toLowerCase()),
      ),
      ...active,
    ],
  };
}
