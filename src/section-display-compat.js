import { sectionTemplate } from './section-templates.js';
import { expression } from './section-expression.js';

/** Compatibility only: new snapshots carry the shared expression contour. */
export function legacySchematicLoops(section) {
  if (section?.schematicLoops) return section.schematicLoops;
  // Compatibility with Tibnor snapshots saved before both contours were embedded.
  if (
    !section?.parameters?.R ||
    !['h', 'i'].includes(section.profileType) ||
    !section.id?.startsWith('tibnor-2023-')
  )
    return null;
  const def = sectionTemplate(section.profileType);
  if (!['B', 'H', 'tw', 'tf'].every((key) => Number.isFinite(section.parameters[key]))) return null;
  return def.loops.map((loop) =>
    loop.vertices.map((v) => [
      expression(v.x, (key) => section.parameters[key]),
      expression(v.y, (key) => section.parameters[key]),
    ]),
  );
}
