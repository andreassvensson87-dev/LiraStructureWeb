import { fastenerAccessories, validateAccessories } from './accessories.js';
import { validateFastenerSpec } from './library.js';

export const assemblyDefaults = (spec) => ({
  nearWasher: false,
  nearNut: spec.kind === 'rod',
  farWasher: false,
  nut: ['bolt', 'rod'].includes(spec.kind),
  extraNut: false,
});
export function validateAssembly(s) {
  if (s.assembly != null) {
    if (
      typeof s.assembly !== 'object' ||
      Array.isArray(s.assembly) ||
      Object.values(s.assembly).some((v) => typeof v !== 'boolean')
    )
      throw new Error('Ogiltiga val för förbandet.');
    if ((s.assembly.nearWasher || s.assembly.farWasher) && !s.spec.washer)
      throw new Error('Ange brickmått i skruvbiblioteket.');
    if ((s.assembly.nearNut || s.assembly.nut || s.assembly.extraNut) && !s.spec.nut)
      throw new Error('Ange muttermått i skruvbiblioteket.');
    if (s.assembly.nearNut && s.spec.kind !== 'rod')
      throw new Error('Mutter före förbandet kräver gängstång.');
    if (s.assembly.extraNut && !s.assembly.nut)
      throw new Error('Extra mutter kräver första muttern.');
    if (s.assembly.nearWasher && s.spec.head?.kind === 'countersunk')
      throw new Error('Plan bricka passar inte under försänkt huvud.');
  }
  if (s.lengthMode != null && !['manual', 'auto'].includes(s.lengthMode))
    throw new Error('Välj giltigt längdläge.');
  if (s.lengthMode === 'auto' && s.spec.kind !== 'bolt')
    throw new Error('Automatisk skruvlängd gäller skruv med mutter.');
  if (
    s.extraLength != null &&
    (!Number.isFinite(s.extraLength) || s.extraLength < 0 || s.extraLength > 1000)
  )
    throw new Error('Extra längd måste vara 0–1 000 mm.');
}
export function assemblyAllowance(s) {
  if (!s.assembly) return null;
  const a = s.assembly;
  const near =
    (a.nearWasher ? s.spec.washer.thickness : 0) + (a.nearNut ? s.spec.nut.thickness : 0);
  return s.spec.kind === 'rod' ? Math.max(s.startAllowance || 0, near) : near;
}
export function fittedAssembly(s, grip) {
  validateAssembly(s);
  if (!s.assembly) return s;
  const a = s.assembly,
    allowance = assemblyAllowance(s),
    items = [];
  let near = allowance;
  if (a.nearWasher) {
    near -= s.spec.washer.thickness;
    items.push({ kind: 'washer', offset: near });
  }
  if (a.nearNut) {
    near -= s.spec.nut.thickness;
    items.push({ kind: 'nut', offset: near });
  }
  let far = allowance + grip;
  if (a.farWasher) {
    items.push({ kind: 'washer', offset: far });
    far += s.spec.washer.thickness;
  }
  if (a.nut) {
    items.push({ kind: 'nut', offset: far });
    far += s.spec.nut.thickness;
  }
  if (a.extraNut) items.push({ kind: 'nut', offset: far });
  return {
    ...s,
    accessories: items,
    ...(s.spec.kind === 'rod' ? { startAllowance: allowance } : {}),
  };
}
/** Known standards or an explicit series group length variants; unrelated custom parts stay separate. */
export function fastenerSeriesKey(spec) {
  return JSON.stringify([
    spec.kind,
    spec.series || spec.standard || spec.id,
    spec.diameter,
    spec.standard || '',
    spec.manufacturer || '',
    spec.grade || '',
    spec.coating || '',
    spec.head ? [spec.head.kind, spec.head.diameter, spec.head.height] : null,
    spec.nut ? [spec.nut.acrossFlats, spec.nut.thickness] : null,
    spec.washer
      ? [spec.washer.innerDiameter, spec.washer.outerDiameter, spec.washer.thickness]
      : null,
    spec.thread?.pitch ?? null,
  ]);
}
export function selectFastenerLength(s, grip, records = s.lengthOptions || []) {
  validateAssembly(s);
  if (s.lengthMode !== 'auto') return s;
  const key = fastenerSeriesKey(s.spec);
  const candidates = [...records, s.spec].filter((spec) => fastenerSeriesKey(spec) === key);
  const unique = [
    ...new Map(candidates.map((spec) => [`${spec.id}:${spec.revision}`, spec])).values(),
  ].sort((a, b) => a.length - b.length);
  let minimum = Infinity;
  for (const spec of unique) {
    validateFastenerSpec(spec);
    const trial = fittedAssembly({ ...s, spec }, grip);
    const allowance = assemblyAllowance(trial) ?? (trial.washers?.head ? spec.washer.thickness : 0);
    const hardware = fastenerAccessories(trial);
    const far =
      trial.assembly || trial.accessories != null
        ? Math.max(
            allowance + grip,
            ...hardware.map((item) => item.offset + spec[item.kind].thickness),
          )
        : allowance + grip + (trial.washers?.nut ? spec.washer.thickness : 0) + spec.nut.thickness;
    const required = far + (s.extraLength ?? 5);
    minimum = Math.min(minimum, required);
    if (spec.length < required - 0.001) continue;
    try {
      validateAccessories(
        trial.assembly || trial.accessories != null
          ? trial
          : {
              ...trial,
              nutOffset: allowance + grip + (trial.washers?.nut ? spec.washer.thickness : 0),
            },
      );
    } catch {
      continue;
    }
    return { ...s, spec: structuredClone(spec), lengthOptions: structuredClone(unique) };
  }
  throw new Error(
    `Ingen passande skruvlängd i serien. Förbandet kräver minst ${minimum.toFixed(2)} mm och muttrar på gängad del. Lägg till en längd i biblioteket eller välj manuellt.`,
  );
}
