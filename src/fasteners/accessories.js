/** Explicit hardware is shared by manual placement and generated connections.
 * Offsets measure the start face from the shaft origin along its axis.
 * Legacy fields remain readable without modifying saved projects.
 */
export function fastenerAccessories(s) {
  if (s.accessories != null) return s.accessories.map((item) => ({ ...item }));
  return [
    ...(s.spec.kind === 'bolt' ? [{ kind: 'nut', offset: s.nutOffset }] : []),
    ...(s.washers?.head ? [{ kind: 'washer', offset: 0 }] : []),
    ...(s.washers?.nut ? [{ kind: 'washer', offset: s.nutOffset - s.spec.washer.thickness }] : []),
  ];
}
export function validateAccessories(s) {
  if (s.accessories != null && (!Array.isArray(s.accessories) || s.accessories.length > 32))
    throw new Error('Förbandet får ha högst 32 muttrar och brickor.');
  const items = fastenerAccessories(s);
  const intervals = items
    .map((item) => {
      if (!['nut', 'washer'].includes(item.kind)) throw new Error('Välj mutter eller bricka.');
      const spec = s.spec[item.kind];
      if (!spec)
        throw new Error(
          item.kind === 'nut' ? 'Ange muttermått i biblioteket.' : 'Ange brickmått i biblioteket.',
        );
      const end = item.offset + spec.thickness;
      if (!Number.isFinite(item.offset) || item.offset < 0 || end > s.spec.length + 0.001)
        throw new Error('Muttrar och brickor måste ligga inom skaftets längd.');
      if (
        item.kind === 'nut' &&
        s.spec.thread &&
        item.offset < s.spec.length - s.spec.thread.length - 0.001
      )
        throw new Error('Muttern måste ligga på den gängade delen.');
      if (item.kind === 'washer' && s.spec.head?.kind === 'countersunk' && item.offset < 0.001)
        throw new Error('Plan bricka passar inte under försänkt huvud.');
      return { start: item.offset, end };
    })
    .sort((a, b) => a.start - b.start);
  if (intervals.some((item, i) => i && item.start < intervals[i - 1].end - 0.001))
    throw new Error('Muttrar och brickor överlappar. Justera deras lägen.');
}
