import { objectType } from './object-types/index.js';
import { boundsMeasures, distanceMeasure } from '../geometry/measurements.js';
/** Read-only selection/tool adapter. It never creates annotations or model objects. */
export function modelFeedbackMeasures({ project, ui, tools, visible = () => true, batch = null }) {
  if (tools.operation) {
    if (!['move', 'copy'].includes(tools.operation.mode) || !tools.first || !tools.drawing)
      return [];
    if (!ui.preview && !tools.operation.referenceId) return [];
    return distanceMeasure(tools.first, tools.typedPoint || tools.activeSnap?.point);
  }
  if (tools.drawing) return [];
  const ids = [...ui.selectedIds],
    objects = ids.map(
      (id) => batch?.find((s) => s.id === id) || project.objects.find((s) => s.id === id),
    );
  if (!objects.length || objects.some((s) => !s || !visible(s.id))) return [];
  if (ui.selectionMode === 'assembly') {
    const assembly = project.assemblies?.find(
      (a) => a.memberIds.length === ids.length && a.memberIds.every((id) => ui.selectedIds.has(id)),
    );
    if (assembly) return boundsMeasures(objects.flatMap((s) => objectType(s).corners(s)));
  }
  return objects.length === 1 ? objectType(objects[0]).measurements(objects[0]) : [];
}
