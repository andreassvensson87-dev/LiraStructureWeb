import { evaluateProfileContours } from './section-contours.js';
import { legacySchematicLoops } from './section-display-compat.js';

const schematicObjects = new WeakMap();
const schematicContours = new WeakMap();
export function schematicProfileLoops(section) {
  if (!section) return null;
  if (schematicContours.has(section)) return schematicContours.get(section);
  const loops = section.contourDefinition
    ? evaluateProfileContours(section.contourDefinition, section.parameters, 'schematic')
    : legacySchematicLoops(section);
  schematicContours.set(section, loops);
  return loops;
}

export const hasExactProfile = (object) =>
  (object.type || 'sweep') === 'sweep' &&
  object.profile === 'custom' &&
  !!schematicProfileLoops(object.section);

/** Display copies never change manufacturing geometry, catalog values or numbering. */
export function profileDisplayObject(object, detail = 'schematic') {
  if (detail === 'exact' || !hasExactProfile(object)) return object;
  let copy = schematicObjects.get(object);
  if (!copy) {
    copy = {
      ...object,
      section: {
        ...object.section,
        loops: schematicProfileLoops(object.section),
        generatedProfileDetail: 'schematic',
      },
    };
    schematicObjects.set(object, copy);
  }
  return copy;
}
export const modelProfileDetail = (object, options = {}) =>
  options.exactProfileIds?.has(object.id) ? 'exact' : options.profileDetail || 'schematic';
export function setModelProfilesExact(ui, objects, selectedIds, exact) {
  for (const object of objects)
    if (selectedIds.has(object.id) && hasExactProfile(object)) {
      if (exact) ui.exactProfileIds.add(object.id);
      else ui.exactProfileIds.delete(object.id);
    }
}
export function drawingProfileDetail(view, drawingType = 'SP') {
  if (['exact', 'schematic'].includes(view?.settings?.profileDetail))
    return view.settings.profileDetail;
  return view?.kind === 'section' ||
    view?.kind === 'detail' ||
    view?.section ||
    view?.detail ||
    drawingType !== 'GA'
    ? 'exact'
    : 'schematic';
}
