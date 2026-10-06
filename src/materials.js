export const MATERIAL_TYPES = [
  ['steel', 'Stål'],
  ['concrete', 'Betong'],
  ['insulation', 'Isolering'],
  ['wood', 'Trä'],
  ['other', 'Övrigt'],
];
export const MATERIAL_KEY = 'lirastructure.materials.v1';
export function validateMaterial(m) {
  if (
    !m ||
    typeof m.id !== 'string' ||
    !m.id ||
    m.id.length > 100 ||
    !Number.isInteger(m.revision) ||
    m.revision < 1
  )
    throw new Error('Ogiltig materialidentitet.');
  if (!MATERIAL_TYPES.some(([id]) => id === m.category))
    throw new Error('Välj en giltig materialtyp.');
  if (typeof m.name !== 'string' || !m.name.trim() || m.name.length > 120)
    throw new Error('Ange ett materialnamn (högst 120 tecken).');
  if (!Number.isFinite(m.density) || m.density <= 0 || m.density > 100000)
    throw new Error('Densiteten måste vara större än 0 och högst 100 000 kg/m³.');
  if (!/^#[0-9a-f]{6}$/i.test(m.color)) throw new Error('Ogiltig materialfärg.');
  for (const [key, limit] of [
    ['subgroup', 80],
    ['note', 500],
    ['source', 2000],
  ])
    if (m[key] !== undefined && (typeof m[key] !== 'string' || m[key].length > limit))
      throw new Error('Ogiltig materialinformation.');
  if (m.source && !/^https?:\/\//i.test(m.source))
    throw new Error('Materialkällan måste vara en http- eller https-adress.');
  return m;
}
export function validateMaterialLibrary(data) {
  if (data?.schema !== 1 || !Array.isArray(data.materials) || data.materials.length > 1000)
    throw new Error('Ogiltig materialfil (schema 1, högst 1 000 versioner).');
  const seen = new Set();
  for (const m of data.materials) {
    validateMaterial(m);
    const key = m.id + ':' + m.revision;
    if (seen.has(key)) throw new Error('Duplicerad materialversion.');
    seen.add(key);
  }
  return structuredClone(data.materials);
}
export function mergeMaterials(existing, incoming) {
  const result = structuredClone(existing);
  for (const m of incoming) {
    const old = result.find((p) => p.id === m.id && p.revision === m.revision);
    if (old && JSON.stringify(old) !== JSON.stringify(m))
      throw new Error(`Konflikt för ${m.name}, version ${m.revision}.`);
    if (!old) result.push(structuredClone(m));
  }
  return validateMaterialLibrary({ schema: 1, materials: result });
}
export function latestMaterials(records) {
  const map = new Map();
  for (const m of records)
    if (!map.has(m.id) || map.get(m.id).revision < m.revision) map.set(m.id, m);
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'sv', { numeric: true }));
}
export const objectColor = (s) => s.colorOverride || s.material?.color || '#688391';
