export const FASTENER_LIBRARY_KEY = 'lirastructure.fasteners.v1';
export const FASTENER_KINDS = [
  ['wood', 'Träskruv'],
  ['bolt', 'Skruv med mutter'],
];
const dimension = (value, label, max = 10000) => {
  if (!Number.isFinite(value) || value <= 0 || value > max)
    throw new Error(`${label} måste vara större än 0 och högst ${max} mm.`);
};
export function validateFastenerSpec(spec) {
  if (!spec || !FASTENER_KINDS.some(([kind]) => kind === spec.kind))
    throw new Error('Välj träskruv eller skruv med mutter.');
  if (typeof spec.name !== 'string' || !spec.name.trim() || spec.name.length > 120)
    throw new Error('Ange ett namn (högst 120 tecken).');
  dimension(spec.diameter, 'Skruvdiameter', 1000);
  dimension(spec.length, 'Längd');
  if (!['cylinder', 'countersunk', 'hex'].includes(spec.head?.kind))
    throw new Error('Välj en giltig huvudtyp.');
  dimension(spec.head.diameter, 'Huvuddiameter / nyckelvidd', 2000);
  dimension(spec.head.height, 'Huvudhöjd', spec.length);
  if (spec.head.diameter <= spec.diameter)
    throw new Error('Huvudet måste vara bredare än skruven.');
  if (spec.kind === 'bolt') {
    dimension(spec.nut?.acrossFlats, 'Mutterns nyckelvidd', 2000);
    dimension(spec.nut?.thickness, 'Muttertjocklek', spec.length);
    if (spec.nut.acrossFlats <= spec.diameter)
      throw new Error('Mutterns nyckelvidd måste vara större än skruvdiametern.');
  } else if (spec.nut != null) throw new Error('Träskruv har ingen tillhörande mutter.');
  if (spec.washer != null) {
    dimension(spec.washer.innerDiameter, 'Brickans innerdiameter', 2000);
    dimension(spec.washer.outerDiameter, 'Brickans ytterdiameter', 3000);
    dimension(spec.washer.thickness, 'Bricktjocklek', spec.length);
    if (
      spec.washer.innerDiameter < spec.diameter ||
      spec.washer.outerDiameter <= spec.washer.innerDiameter
    )
      throw new Error(
        'Brickans hål måste rymma skruven och ytterdiametern måste vara större än hålet.',
      );
  }
  if (spec.holeDefaults != null) {
    const h = spec.holeDefaults;
    if (!['none', 'pilot', 'clearance'].includes(h.kind))
      throw new Error('Välj en giltig håltyp i biblioteket.');
    if (h.kind !== 'none') {
      dimension(h.diameter, 'Håldiameter', 1000);
      dimension(h.depth, 'Håldjup');
      if (h.countersink != null) {
        dimension(h.countersink.diameter, 'Försänkningens diameter', 2000);
        dimension(h.countersink.depth, 'Försänkningens djup', h.depth);
        if (h.countersink.diameter <= h.diameter || h.countersink.depth >= h.depth)
          throw new Error('Försänkningen måste vara bredare än hålet och grundare än håldjupet.');
      }
    }
  }
  return spec;
}
export function validateFastenerLibrary(data) {
  if (data?.schema !== 1 || !Array.isArray(data.fasteners) || data.fasteners.length > 1000)
    throw new Error('Ogiltigt skruvbibliotek (schema 1, högst 1 000 versioner).');
  const seen = new Set();
  for (const spec of data.fasteners) {
    validateFastenerSpec(spec);
    if (
      typeof spec.id !== 'string' ||
      !spec.id ||
      spec.id.length > 100 ||
      !Number.isInteger(spec.revision) ||
      spec.revision < 1
    )
      throw new Error('Ogiltig biblioteksversion.');
    const key = `${spec.id}:${spec.revision}`;
    if (seen.has(key)) throw new Error('Duplicerad skruvversion.');
    seen.add(key);
  }
  return structuredClone(data.fasteners);
}
export function mergeFasteners(existing, incoming) {
  validateFastenerLibrary({ schema: 1, fasteners: existing });
  validateFastenerLibrary({ schema: 1, fasteners: incoming });
  const result = structuredClone(existing);
  for (const spec of incoming) {
    const old = result.find((s) => s.id === spec.id && s.revision === spec.revision);
    if (old && JSON.stringify(old) !== JSON.stringify(spec))
      throw new Error(`Konflikt för ${spec.name}, version ${spec.revision}.`);
    if (!old) result.push(structuredClone(spec));
  }
  return validateFastenerLibrary({ schema: 1, fasteners: result });
}
export function latestFasteners(records) {
  const result = new Map();
  for (const spec of records)
    if (!result.has(spec.id) || result.get(spec.id).revision < spec.revision)
      result.set(spec.id, spec);
  return [...result.values()].sort((a, b) => a.name.localeCompare(b.name, 'sv', { numeric: true }));
}

/** Each connection owns its hole values; library edits never mutate placed holes. */
export function defaultHoleForSpec(spec, targetId) {
  const defaults = spec?.holeDefaults;
  return {
    targetId,
    kind: defaults?.kind || 'none',
    offset: 0,
    diameter: defaults?.diameter ?? spec?.diameter ?? 6,
    depth: defaults?.depth ?? 50,
    ...(defaults?.kind !== 'none' && defaults?.countersink
      ? { countersink: structuredClone(defaults.countersink) }
      : {}),
  };
}
