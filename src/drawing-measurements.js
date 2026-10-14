import { arcGeometry, shapeSnapPoints } from './drawing-shapes.js';
import { insulationFrame } from './drawing-insulation.js';
import { distanceMeasure, edgeMeasures } from './geometry/measurements.js';
import { lengthPoint } from './frame-model.js';
/** Drawing objects already store mm in their view (paper text uses paper mm). */
export function drawingObjectMeasures(item) {
  if (item?.type !== 'shape') return [];
  const p = item.points;
  if (item.shape === 'circle') return distanceMeasure(p[0], p[1], null, 'radius');
  if (item.shape === 'arc') {
    const arc = arcGeometry(p);
    return distanceMeasure(arc.center, p[1], arc.radius, 'radius');
  }
  if (item.shape === 'insulation') {
    const { corners, thickness, length } = insulationFrame(item);
    return [
      ...distanceMeasure(corners[0], corners[1], length),
      ...distanceMeasure(corners[0], corners[3], thickness),
    ];
  }
  if (item.shape === 'rectangle') {
    const corners = shapeSnapPoints(item);
    return edgeMeasures(corners.slice(0, 3));
  }
  return edgeMeasures(p, item.shape === 'polygon' || !!item.closed);
}
export function drawingFeedbackMeasures(editor) {
  const transform = editor.transform;
  if (transform?.active()) {
    if (
      !['move-shapes', 'copy-shapes'].includes(editor.mode) ||
      transform.phase !== 'destination' ||
      !transform.base ||
      !editor.hover ||
      editor.hover.view !== transform.view
    )
      return [];
    try {
      const target = transform.exactDistance
        ? lengthPoint(transform.base, editor.hover.point, transform.exactDistance)
        : editor.hover.point;
      return distanceMeasure(transform.base, target).map((m) => ({ ...m, view: transform.view }));
    } catch {
      return [];
    }
  }
  if (editor.mode || editor.drag || editor.grips?.session) return [];
  const ids = editor.selectedIds?.size
    ? [...editor.selectedIds]
    : editor.selected
      ? [editor.selected]
      : [];
  if (ids.length !== 1) return [];
  const item = editor.items.find((value) => value.id === ids[0]);
  return drawingObjectMeasures(item).map((m) => ({ ...m, view: item.view }));
}
