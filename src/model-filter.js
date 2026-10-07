import { objectType } from './model/object-types/index.js';
import { designation } from './object-identity.js';
import { FORM_OPTIONS, hasWall, isRound } from './profile-forms.js';
export const MODEL_FILTER_KEY = 'lirastructure.model-filters.v1';
export const modelFilterGroups = [
  ['type', 'Objekttyp'],
  ['material', 'Material'],
  ['profile', 'Profil'],
  ['level', 'Nivå'],
  ['prefix', 'Prefix'],
];
export const emptyModelFilter = () => ({
  query: '',
  inView: false,
  values: Object.fromEntries(modelFilterGroups.map(([key]) => [key, []])),
});
export function normalizeModelFilter(value = {}) {
  if (!value || typeof value !== 'object') value = {};
  return {
    query: typeof value.query === 'string' ? value.query.slice(0, 200) : '',
    inView: value.inView === true,
    values: Object.fromEntries(
      modelFilterGroups.map(([key]) => [
        key,
        Array.isArray(value.values?.[key])
          ? [
              ...new Set(value.values[key].filter((v) => typeof v === 'string' && v.length <= 200)),
            ].slice(0, 500)
          : [],
      ]),
    ),
  };
}
export function modelFilterRecord(object, levels = { items: [] }) {
  const type = objectType(object);
  let elevation;
  try {
    elevation = Math.min(...type.anchors(object).map((p) => p[2]));
  } catch {
    elevation = NaN;
  }
  const level = Number.isFinite(elevation)
    ? [...levels.items].sort(
        (a, b) =>
          Math.abs(a.elevation - elevation) - Math.abs(b.elevation - elevation) ||
          a.elevation - b.elevation,
      )[0]
    : null;
  const profile =
    object.section?.name ||
    object.spec?.name ||
    (object.profile
      ? `${FORM_OPTIONS.find(([id]) => id === object.profile)?.[1] || object.profile} · ${isRound(object.profile) ? `Ø ${object.width}` : `${object.width} × ${object.height}`}${hasWall(object.profile) ? ` × ${object.thickness}` : ''}`
      : 'Utan profil');
  return {
    id: object.id,
    type: type.label,
    material: object.material?.name || 'Utan material',
    profile,
    level: level?.name || 'Utan nivå',
    prefix: object.prefix || 'Utan prefix',
    text: `${object.name || ''} ${designation(object) || ''} ${type.label} ${object.material?.name || ''} ${profile}`.toLocaleLowerCase(
      'sv',
    ),
  };
}
export function matchesModelFilter(record, filter, viewIds = null, except = '') {
  if (filter.inView && !viewIds?.has(record.id)) return false;
  const words = filter.query.trim().toLocaleLowerCase('sv').split(/\s+/).filter(Boolean);
  return (
    words.every((word) => record.text.includes(word)) &&
    modelFilterGroups.every(
      ([key]) =>
        key === except || !filter.values[key].length || filter.values[key].includes(record[key]),
    )
  );
}
export function modelFilterFacets(records, filter, viewIds = null) {
  return Object.fromEntries(
    modelFilterGroups.map(([key]) => {
      const counts = new Map(filter.values[key].map((value) => [value, 0]));
      for (const record of records) {
        if (!counts.has(record[key])) counts.set(record[key], 0);
        if (matchesModelFilter(record, filter, viewIds, key))
          counts.set(record[key], counts.get(record[key]) + 1);
      }
      return [key, [...counts].sort(([a], [b]) => a.localeCompare(b, 'sv', { numeric: true }))];
    }),
  );
}
