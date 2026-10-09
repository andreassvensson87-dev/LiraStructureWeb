const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const sorted = (values) => values.map((v) => JSON.stringify(v)).sort();
function read(key) {
  try {
    return JSON.parse(key);
  } catch {
    return null;
  }
}
function cutsByKind(cuts, holes) {
  return cuts.filter((cut) => (read(cut)?.type === 'linkedhole') === holes);
}
/** Explain the stored manufacturing keys, using the same precision as numbering. */
export function partChangeReasons(previousKey, nextKey) {
  if (previousKey === nextKey) return [];
  const previous = read(previousKey),
    next = read(nextKey);
  if (
    !previous?.shape ||
    !next?.shape ||
    !Array.isArray(previous.cuts) ||
    !Array.isArray(next.cuts)
  )
    return ['Tidigare jämförelsedata saknas'];
  const reasons = [];
  if (previous.series && !equal(previous.series, next.series)) reasons.push('Nummerserie ändrad');
  if (!equal(previous.name, next.name)) reasons.push('Detaljnamn ändrat');
  if (!equal(previous.shape, next.shape)) reasons.push('Geometri/profil ändrad');
  if (!equal(previous.material, next.material)) reasons.push('Material ändrat');
  if (!equal(cutsByKind(previous.cuts, true), cutsByKind(next.cuts, true)))
    reasons.push('Hålbild ändrad');
  if (!equal(cutsByKind(previous.cuts, false), cutsByKind(next.cuts, false)))
    reasons.push('Bearbetning ändrad');
  if (previous.cuts.length && next.cuts.length && !equal(previous.placement, next.placement))
    reasons.push('Insättning ändrad');
  return reasons.length ? reasons : ['Jämförelsedata ändrade'];
}
const memberReasons = {
  'Geometri/profil ändrad': 'Delarnas geometri/profil ändrad',
  'Material ändrat': 'Delarnas material ändrat',
  'Hålbild ändrad': 'Delarnas hålbild ändrad',
  'Bearbetning ändrad': 'Delarnas bearbetning ändrad',
  'Insättning ändrad': 'Delarnas insättning ändrad',
};
/** Member IDs help explain changes, but never change the manufacturing comparison. */
export function assemblyChangeReasons(assembly, nextKey, currentMembers) {
  if (assembly.typeKey === nextKey) return [];
  const oldTokens = read(assembly.typeKey),
    newTokens = read(nextKey);
  if (!Array.isArray(oldTokens) || !Array.isArray(newTokens))
    return ['Tidigare jämförelsedata saknas'];
  const previous = oldTokens.map(read),
    next = newTokens.map(read);
  if ([...previous, ...next].some((m) => !m || typeof m.part !== 'string'))
    return ['Tidigare jämförelsedata saknas'];
  const reasons = new Set();
  if (previous.length !== next.length) reasons.add('Antal delar ändrat');
  const oldMembers = assembly.numberedMembers;
  if (Array.isArray(oldMembers) && oldMembers.length) {
    const oldById = new Map(oldMembers.map((m) => [m.id, read(m.token)]));
    const oldMain = oldMembers.find((m) => read(m.token)?.main);
    const newMain = currentMembers.find((m) => read(m.token)?.main);
    if (oldMain && newMain && oldMain.id !== newMain.id) reasons.add('Huvuddel ändrad');
    for (const member of currentMembers) {
      const old = oldById.get(member.id),
        now = read(member.token);
      if (!old || !now) continue;
      for (const reason of partChangeReasons(old.part, now.part))
        reasons.add(memberReasons[reason] || reason);
      if (old.mark !== now.mark) reasons.add('Delarnas part marks ändrade');
      if (!equal(old.series, now.series)) reasons.add('Assemblyserie ändrad');
      if (!equal(old.origin, now.origin)) reasons.add('Delarnas placering ändrad');
      if (!equal(old.axes, now.axes)) reasons.add('Delarnas orientering ändrad');
    }
  }
  if (
    !Array.isArray(oldMembers) ||
    currentMembers.some((m) => !oldMembers.some((old) => old.id === m.id))
  ) {
    // Older projects or replaced members lack a pairing. Compare whole sets instead.
    for (const [key, label] of [
      ['shape', 'Delarnas geometri/profil ändrad'],
      ['material', 'Delarnas material ändrat'],
    ]) {
      const values = (members) => sorted(members.map((m) => read(m.part)?.[key]));
      if (!equal(values(previous), values(next))) reasons.add(label);
    }
    for (const [holes, label] of [
      [true, 'Delarnas hålbild ändrad'],
      [false, 'Delarnas bearbetning ändrad'],
    ]) {
      const values = (members) =>
        sorted(members.map((m) => cutsByKind(read(m.part)?.cuts || [], holes)));
      if (!equal(values(previous), values(next))) reasons.add(label);
    }
    if (!equal(sorted(previous.map((m) => m.origin)), sorted(next.map((m) => m.origin))))
      reasons.add('Delarnas placering ändrad');
    if (!equal(sorted(previous.map((m) => m.axes)), sorted(next.map((m) => m.axes))))
      reasons.add('Delarnas orientering ändrad');
  }
  return reasons.size ? [...reasons] : ['Assemblytyp ändrad'];
}
