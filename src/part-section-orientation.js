import * as THREE from 'three';
import { frameMatrix } from './drawing-sections.js';
import { updateDetailArea } from './drawing-details.js';

/** Re-express existing sheet geometry once when replacing the old Z-up convention. */
export function migratePartOrientation(record, frame, modelTransform = null) {
  const sheet = record.sheet;
  if (
    modelTransform ? sheet.drawingHandedness === 'right' : sheet.sectionOrientation === 'source-up'
  )
    return;
  const views = sheet.views;
  const previous = modelTransform
    ? 'source'
    : sheet.sectionOrientation === 'source'
      ? 'source-line'
      : 'upright';
  const old = new Map(views.map((v) => [v.id, frame(v, previous)]));
  const done = new Set();
  const mapping = (view) =>
    frameMatrix(frame(view, 'source'))
      .multiply(modelTransform || new THREE.Matrix4())
      .multiply(frameMatrix(old.get(view.id)).invert());
  const transform = (p, matrix) =>
    new THREE.Vector3(...p, 0).applyMatrix4(matrix).toArray().slice(0, 2);
  const migrate = (view) => {
    if (done.has(view.id)) return;
    const parent = views.find((v) => v.id === view.source.parentViewId);
    if (parent) {
      migrate(parent);
      const definition = view.section || view.detail;
      if (definition)
        definition.points = definition.points.map((p) => transform(p, mapping(parent)));
      if (modelTransform && view.section) {
        const wanted = new THREE.Vector3(...old.get(view.id).normal).transformDirection(
          modelTransform,
        );
        if (wanted.dot(new THREE.Vector3(...frame(view, 'source').normal)) < 0)
          view.section.side *= -1;
      }
    }
    const matrix = mapping(view);
    if (modelTransform || view.section || view.detail) {
      view.camera.center = transform(view.camera.center, matrix);
      const e = matrix.elements,
        [w, h] = view.size;
      view.size = [
        Math.abs(e[0]) * w + Math.abs(e[4]) * h,
        Math.abs(e[1]) * w + Math.abs(e[5]) * h,
      ];
      if (view.detail) updateDetailArea(view);
      for (const item of record.annotations || []) {
        if (item.view !== view.id) continue;
        item.points = item.points.map((p) => transform(p, matrix));
        item.line = transform(item.line, matrix);
        if (item.axis) {
          const direction = new THREE.Vector3(...item.axis, 0).transformDirection(matrix);
          item.axis = [direction.x, direction.y];
          if (item.kind !== 'free')
            item.kind =
              Math.abs(direction.x) > 0.99
                ? 'horizontal'
                : Math.abs(direction.y) > 0.99
                  ? 'vertical'
                  : 'free';
        }
        const rotated = Math.abs(e[0] - 1) > 1e-6 || Math.abs(e[5] - 1) > 1e-6;
        // Old projected corner ranks are ambiguous after rotating a symmetric section.
        if (rotated || modelTransform)
          for (const ref of item.references || [])
            if (ref?.shape) ref.shape = 'orientation:' + ref.shape;
      }
    }
    done.add(view.id);
  };
  views.forEach(migrate);
  if (modelTransform) sheet.drawingHandedness = 'right';
  else sheet.sectionOrientation = 'source-up';
}
