import { matchingKey } from './rules.js';

/** Stable representatives prevent tolerance chains and registry re-anchoring drift. */
export function groupNumberingTypes(entries, records, options, tolerance = 0) {
  const registry = records.filter((r) => !options.renumberAll || r.manual);
  const unchanged = (entry) =>
    entry.previous && matchingKey(entry.key, entry.previous.key, tolerance);
  const ordered = [...entries].sort(
    (a, b) =>
      Number(!!unchanged(b)) - Number(!!unchanged(a)) ||
      a.id.localeCompare(b.id, 'en', { numeric: true }),
  );
  const groups = [];
  for (const entry of ordered) {
    const compare =
      !options.renumberAll &&
      (entry.previous
        ? unchanged(entry) || options.modifiedParts !== 'new'
        : options.newParts !== 'new');
    const eligible = (r) => (r.manual || compare) && matchingKey(r.key, entry.key, tolerance);
    const own = registry.find(
      (r) => r.key === entry.previous?.key && r.mark === entry.previous?.mark && eligible(r),
    );
    const representative = own || registry.find(eligible);
    let group =
      groups.find((g) => representative && g.key === representative.key) ||
      groups.find((g) => matchingKey(g.key, entry.key, tolerance));
    if (!group) {
      group = { key: representative?.key || entry.key, series: entry.series, members: [] };
      groups.push(group);
    }
    group.members.push(entry);
  }
  return groups;
}
