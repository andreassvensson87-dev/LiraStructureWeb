import { FORM_OPTIONS, normalizeForm } from '../profile-forms.js';
import { validateSweep } from '../sweep.js';
import { validateMaterial } from '../materials.js';

export const SWEEP_DEFAULTS_KEY = 'lirastructure.sweep-defaults.v1';
export const sweepPropertyGroups = [
  ['profile', 'Profil och mått'],
  ['material', 'Material'],
  ['color', 'Objektfärg'],
  ['rotation', 'Profilrotation'],
  ['placement', 'Insättningspunkt'],
  ['name', 'Namn'],
];
export const editableSweep = (s) => s && (s.type ?? 'sweep') === 'sweep' && !s.generatedBy;

/** Copy only chosen properties; geometry, identity and relations belong to the target. */
export function copySweepProperties(source, target, groups) {
  if (!editableSweep(source) || !editableSweep(target)) throw new Error('Välj två sweeps.');
  if (
    !Array.isArray(groups) ||
    groups.some((key) => !sweepPropertyGroups.some(([id]) => id === key))
  )
    throw new Error('Ogiltiga egenskaper för kopiering.');
  const result = structuredClone(target);
  for (const group of new Set(groups)) {
    const keys = {
      profile: ['profile', 'width', 'height', 'thickness', 'section'],
      material: ['material'],
      color: ['colorOverride'],
      rotation: ['rotation'],
      placement: ['placement'],
      name: ['name'],
    }[group];
    for (const key of keys) {
      if (source[key] === undefined) delete result[key];
      else result[key] = structuredClone(source[key]);
    }
  }
  if (groups.includes('profile') && source.profile !== 'custom') delete result.section;
  return normalizeForm(result);
}

/** Persist a detached, validated property snapshot, never endpoints or model identities. */
export function sweepDefaults(source) {
  if (!editableSweep(source)) throw new Error('Ogiltiga sweep-inställningar.');
  const result = copySweepProperties(
    source,
    { type: 'sweep' },
    sweepPropertyGroups.filter(([key]) => key !== 'name').map(([key]) => key),
  );
  delete result.type;
  if (!['custom', ...FORM_OPTIONS.map(([key]) => key)].includes(result.profile))
    throw new Error('Ogiltig profil.');
  const error = validateSweep({ ...result, start: [0, 0, 0], end: [1000, 0, 0] });
  if (error) throw new Error(error);
  if (result.material != null) validateMaterial(result.material);
  if (result.colorOverride != null && !/^#[0-9a-f]{6}$/i.test(result.colorOverride))
    throw new Error('Ogiltig objektfärg.');
  if (
    result.placement &&
    (!['left', 'center', 'right'].includes(result.placement.horizontalAlignment) ||
      !['top', 'center', 'bottom'].includes(result.placement.verticalAlignment))
  )
    throw new Error('Ogiltig insättningspunkt.');
  return result;
}
export function loadSweepDefaults(storage) {
  try {
    const raw = storage.getItem(SWEEP_DEFAULTS_KEY);
    if (!raw || raw.length > 1000000) return null;
    const data = JSON.parse(raw);
    return data.schema === 1 ? sweepDefaults(data.properties) : null;
  } catch {
    return null;
  }
}
export function storeSweepDefaults(storage, source) {
  const properties = sweepDefaults(source);
  try {
    storage.setItem(SWEEP_DEFAULTS_KEY, JSON.stringify({ schema: 1, properties }));
  } catch {
    /* Session defaults still work when browser storage is unavailable. */
  }
  return properties;
}
