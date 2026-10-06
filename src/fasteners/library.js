export const FASTENER_LIBRARY_KEY = 'lirastructure.fasteners.v1';
export const FASTENER_KINDS = [
  ['wood', 'Träskruv'],
  ['bolt', 'Skruv med mutter'],
  ['rod', 'Gängstång'],
  ['concrete', 'Betongskruv'],
];
export const FASTENER_STANDARDS = ['', 'ISO 4014', 'ISO 4017'];
export const hasNut = (spec) => ['bolt', 'rod'].includes(spec?.kind);
const dimension = (value, label, max = 10000) => {
  if (!Number.isFinite(value) || value <= 0 || value > max)
    throw new Error(`${label} måste vara större än 0 och högst ${max} mm.`);
};
export function validateFastenerSpec(spec) {
  if (!spec || !FASTENER_KINDS.some(([kind]) => kind === spec.kind))
    throw new Error('Välj en giltig skruvtyp.');
  if (typeof spec.name !== 'string' || !spec.name.trim() || spec.name.length > 120)
    throw new Error('Ange ett namn (högst 120 tecken).');
  dimension(spec.diameter, 'Skruvdiameter', 1000);
  dimension(spec.length, 'Längd');
  if (spec.kind === 'rod') {
    if (spec.head != null) throw new Error('Gängstång ska sakna huvud.');
  } else {
    if (!['cylinder', 'countersunk', 'hex'].includes(spec.head?.kind))
      throw new Error('Välj en giltig huvudtyp.');
    dimension(spec.head.diameter, 'Huvuddiameter / nyckelvidd', 2000);
    dimension(spec.head.height, 'Huvudhöjd', spec.length);
    if (spec.head.diameter <= spec.diameter)
      throw new Error('Huvudet måste vara bredare än skruven.');
  }
  if (hasNut(spec)) {
    dimension(spec.nut?.acrossFlats, 'Mutterns nyckelvidd', 2000);
    dimension(spec.nut?.thickness, 'Muttertjocklek', spec.length);
    if (spec.nut.acrossFlats <= spec.diameter)
      throw new Error('Mutterns nyckelvidd måste vara större än skruvdiametern.');
  } else if (spec.nut != null) throw new Error('Denna skruvtyp har ingen tillhörande mutter.');
  if (spec.standard != null && !FASTENER_STANDARDS.includes(spec.standard))
    throw new Error('Välj en giltig skruvstandard.');
  if (spec.standard && (spec.kind !== 'bolt' || spec.head.kind !== 'hex'))
    throw new Error('ISO 4014 och ISO 4017 kräver skruv med sexkantshuvud.');
  for (const key of ['manufacturer', 'article', 'grade', 'coating', 'series'])
    if (spec[key] != null && (typeof spec[key] !== 'string' || spec[key].length > 120))
      throw new Error('Produktuppgifter får vara högst 120 tecken.');
  if (spec.thread != null) {
    if (typeof spec.thread !== 'object' || Array.isArray(spec.thread))
      throw new Error('Ange giltiga gänguppgifter.');
    dimension(spec.thread.length, 'Gänglängd', spec.length);
    if (spec.thread.pitch != null) dimension(spec.thread.pitch, 'Gängstigning', spec.diameter);
    if ((spec.standard === 'ISO 4017' || spec.kind === 'rod') && spec.thread.length !== spec.length)
      throw new Error('Helgängad skruv och gängstång ska ha gänglängd lika med längden.');
    if (spec.standard === 'ISO 4014' && spec.thread.length >= spec.length)
      throw new Error('ISO 4014 behöver en ogängad del av skaftet.');
  } else if (spec.standard) throw new Error('Ange gänglängd för vald standard.');
  if (spec.anchor != null) {
    if (spec.kind !== 'concrete') throw new Error('Förankringsdata gäller betongskruv.');
    dimension(spec.anchor.embedment, 'Förankringsdjup', spec.length);
    dimension(spec.anchor.drillDiameter, 'Borrdiameter', 1000);
    dimension(spec.anchor.drillDepth, 'Borrdjup');
    if (spec.anchor.drillDepth < spec.anchor.embedment)
      throw new Error('Borrdjup måste vara minst förankringsdjupet.');
  } else if (spec.kind === 'concrete')
    throw new Error('Ange förankrings- och borrdata för betongskruven.');
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
    if (h.extent != null && !['wall', 'profile', 'blind', 'manual'].includes(h.extent))
      throw new Error('Ogiltig hålomfattning.');
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
    if (old && stableSpec(old) !== stableSpec(spec))
      throw new Error(`Konflikt för ${spec.name}, version ${spec.revision}.`);
    if (!old) result.push(structuredClone(spec));
  }
  return validateFastenerLibrary({ schema: 1, fasteners: result });
}
function stableSpec(value) {
  return JSON.stringify(value, (_, item) =>
    item && typeof item === 'object' && !Array.isArray(item)
      ? Object.fromEntries(
          Object.keys(item)
            .sort()
            .map((key) => [key, item[key]]),
        )
      : item,
  );
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
    ...(defaults?.kind && defaults.kind !== 'none'
      ? { extent: defaults.extent || (defaults.kind === 'pilot' ? 'blind' : 'profile') }
      : {}),
    offset: 0,
    diameter: defaults?.diameter ?? spec?.diameter ?? 6,
    depth: defaults?.depth ?? 50,
    ...(defaults?.kind !== 'none' && defaults?.countersink
      ? { countersink: structuredClone(defaults.countersink) }
      : {}),
  };
}
