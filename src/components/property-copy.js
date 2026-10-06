import { componentDefinition, resolveComponentDraft } from './definitions.js';

export function componentCopyKeys(kind) {
  if (!kind) return [];
  return componentDefinition(kind).parameters.map((p) => p.key);
}

export const localComponentCopyKeys = [
  'endA',
  'endB',
  'referenceEnd',
  'distance',
  'gap',
  'offsetX',
  'offsetY',
  'elevationOffset',
  'plateRotation',
  'anchorRotation',
];

/** Resolve against each target's own members, ends and identity. Derived parts are never copied. */
export function copyComponentProperties(source, target, keys, objects) {
  const allowed = componentCopyKeys(source?.kind);
  if (
    source?.type !== 'component' ||
    target?.type !== 'component' ||
    !allowed.length ||
    target.kind !== source.kind
  )
    throw new Error('Välj en annan koppling av samma typ.');
  if (!Array.isArray(keys) || !keys.length || keys.some((key) => !allowed.includes(key)))
    throw new Error('Välj giltiga kopplingsegenskaper.');
  const changes = Object.fromEntries(
    [...new Set(keys)].map((key) => [key, structuredClone(source[key])]),
  );
  if (keys.includes('boltSpec'))
    changes.lengthOptions = structuredClone(source.lengthOptions || []);
  return resolveComponentDraft(target, changes, objects);
}
