import { validateIFCClass } from '../ifc/classes.js';
import { validateSeries } from '../numbering/rules.js';

/** Apply only user-specified draft attributes; keep immutable geometry shared. */
export function applyObjectDraft(object, draft) {
  if (!draft) return object;
  const result = { ...object };
  if (draft.name?.trim()) result.name = draft.name.trim();
  if (draft.ifcClass) result.ifcClass = validateIFCClass(draft.ifcClass);
  if (draft.partSeries) result.partSeries = { ...validateSeries(draft.partSeries) };
  for (const key of ['material', 'colorOverride'])
    if (Object.hasOwn(draft, key)) result[key] = structuredClone(draft[key]);
  return result;
}
