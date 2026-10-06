import { validateMaterial } from '../materials.js';

export const PLATE_DEFAULTS_KEY = 'lirastructure.plate-defaults.v1';
export const editablePlate = (s) => s?.type === 'plate' && !s.generatedBy;
export const platePropertyGroups = [
  ['thickness', 'Tjocklek'],
  ['material', 'Material'],
  ['color', 'Objektfärg'],
  ['placement', 'Placering'],
  ['name', 'Namn'],
];
/** The target owns its contour, offset, frame, bores and numbering. */
export function copyPlateProperties(source, target, groups) {
  if (!editablePlate(source) || !editablePlate(target))
    throw new Error('Välj två fristående plåtar.');
  if (
    !Array.isArray(groups) ||
    groups.some((key) => !platePropertyGroups.some(([id]) => id === key))
  )
    throw new Error('Ogiltiga plåtegenskaper.');
  const result = structuredClone(target);
  for (const group of new Set(groups)) {
    const key = {
      thickness: 'thickness',
      material: 'material',
      color: 'colorOverride',
      placement: 'side',
      name: 'name',
    }[group];
    if (source[key] === undefined) delete result[key];
    else result[key] = structuredClone(source[key]);
  }
  return result;
}
export function plateDefaults(source) {
  if (!editablePlate(source)) throw new Error('Ogiltiga plåtinställningar.');
  const properties = {
    thickness: source.thickness,
    side: source.side,
    contourOffset: source.contourOffset ?? 0,
    material: structuredClone(source.material ?? null),
    colorOverride: source.colorOverride ?? null,
  };
  if (
    !Number.isFinite(properties.thickness) ||
    properties.thickness < 1 ||
    properties.thickness > 10000
  )
    throw new Error('Tjockleken måste vara 1–10 000 mm.');
  if (!['center', 'positive', 'negative'].includes(properties.side))
    throw new Error('Välj tjocklekens placering.');
  if (!Number.isFinite(properties.contourOffset) || Math.abs(properties.contourOffset) > 1e7)
    throw new Error('Ogiltig konturoffset.');
  if (properties.material != null) validateMaterial(properties.material);
  if (properties.colorOverride != null && !/^#[0-9a-f]{6}$/i.test(properties.colorOverride))
    throw new Error('Ogiltig objektfärg.');
  return properties;
}
export function loadPlateDefaults(storage) {
  try {
    const raw = storage.getItem(PLATE_DEFAULTS_KEY);
    if (!raw || raw.length > 1000000) return null;
    const data = JSON.parse(raw);
    return data.schema === 1 ? plateDefaults({ type: 'plate', ...data.properties }) : null;
  } catch {
    return null;
  }
}
export function storePlateDefaults(storage, source) {
  const properties = plateDefaults(source);
  try {
    storage.setItem(PLATE_DEFAULTS_KEY, JSON.stringify({ schema: 1, properties }));
  } catch {
    /* Keep the session defaults when browser storage is unavailable. */
  }
  return properties;
}
