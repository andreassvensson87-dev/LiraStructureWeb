import * as THREE from 'three';
import { sectionFrame, frameMatrix } from './drawing-sections.js';
import { visibleGridEndpoints } from './grid-label-position.js';

const vector = (p) => new THREE.Vector3(...p);
export function modelViewFrame(view, views, levels, seen = new Set()) {
  if (!view || seen.has(view.id))
    throw Error('Ursprungsvyn saknas eller har en cirkulär koppling.');
  seen.add(view.id);
  if (view.section || view.detail) {
    const parent = views.find((v) => v.id === view.source.parentViewId);
    const frame = modelViewFrame(parent, views, levels, seen);
    return view.section ? sectionFrame(frame, view.section.points, view.section.side) : frame;
  }
  const elevation = levels.find((l) => l.id === view.settings.levelId)?.elevation || 0;
  return {
    origin: [0, 0, elevation + (view.settings.cut || 0)],
    x: [1, 0, 0],
    y: [0, 1, 0],
    normal: [0, 0, 1],
  };
}
function sourceRange(view, views) {
  if (view.detail)
    return sourceRange(
      views.find((v) => v.id === view.source.parentViewId),
      views,
    );
  if (view.section) return [-view.section.depth, 0];
  return [
    (view.settings.lower ?? -1000) - (view.settings.cut || 0),
    (view.settings.upper ?? 3000) - (view.settings.cut || 0),
  ];
}
function worldPoint(point, frame) {
  return vector(frame.origin)
    .addScaledVector(vector(frame.x), point[0])
    .addScaledVector(vector(frame.y), point[1])
    .toArray();
}
export function drawingDefinitions(record, levels) {
  if (record.type !== 'GA') return [];
  const views = record.sheet?.views || [];
  return views
    .filter((v) => v.section || v.detail)
    .map((view) => {
      const parent = views.find((v) => v.id === view.source.parentViewId);
      const frame = modelViewFrame(parent, views, levels);
      const definition = view.section || view.detail;
      return {
        id: `${record.id}:${view.id}`,
        drawingId: record.id,
        viewId: view.id,
        drawingNumber: record.number,
        name: view.name,
        label: definition.label,
        kind: view.section ? 'section' : 'detail',
        parentViewId: parent.id,
        parentDefinitionId: parent.section || parent.detail ? `${record.id}:${parent.id}` : null,
        frame,
        range: sourceRange(parent, views),
        worldPoints: definition.points.map((p) => worldPoint(p, frame)),
        side: view.section?.side,
      };
    });
}
// Persist the model-space definition with its owning view; the project drawing
// collection is the registry, so delete/undo/copy use the existing transaction.
export function captureDrawingDefinitions(record, levels) {
  for (const definition of drawingDefinitions(record, levels))
    record.sheet.views.find((v) => v.id === definition.viewId).modelReference = definition;
}
export function collectDrawingDefinitions(drawings, current, levels) {
  return [...drawings.filter((d) => d.id !== current.id), current].flatMap((d) =>
    drawingDefinitions(d, levels),
  );
}
export function referencesInView(definitions, record, view, levels, includeHidden = false) {
  const views = record.sheet.views,
    frame = modelViewFrame(view, views, levels);
  const matrix = frameMatrix(frame),
    normal = vector(frame.normal),
    range = sourceRange(view, views);
  const half = view.size.map((v) => (v * view.scale) / 2),
    center = view.camera.center;
  return definitions.flatMap((definition) => {
    if (definition.drawingId === record.id && definition.viewId === view.id) return [];
    if (!includeHidden && view.settings.hiddenReferences?.includes(definition.id)) return [];
    const alignment = normal.dot(vector(definition.frame.normal));
    if (Math.abs(alignment) < 0.99999) return [];
    const offset = vector(definition.frame.origin).sub(vector(frame.origin)).dot(normal);
    const depths = definition.range.map((z) => offset + z * alignment).sort((a, b) => a - b);
    if (depths[1] < range[0] - 0.01 || depths[0] > range[1] + 0.01) return [];
    const projected = definition.worldPoints.map((p) => vector(p).applyMatrix4(matrix));
    const points = projected.map((p) => [p.x, p.y]);
    const local = definition.drawingId === record.id && definition.parentViewId === view.id;
    if (
      [0, 1].some(
        (i) =>
          Math.max(...points.map((p) => p[i])) < center[i] - half[i] ||
          Math.min(...points.map((p) => p[i])) > center[i] + half[i],
      )
    )
      return [];
    if (definition.kind === 'section') {
      const corner = center.map((n, i) => n - half[i]);
      const clipped = visibleGridEndpoints(
        points[0].map((n, i) => n - corner[i]),
        points[1].map((n, i) => n - corner[i]),
        half[0] * 2,
        half[1] * 2,
        local ? 0 : 8 * view.scale,
      );
      if (!clipped) return [];
      if (!local) points.splice(0, 2, ...clipped.map((p) => p.map((n, i) => n + corner[i])));
    }
    return [
      {
        ...definition,
        points,
        side: (definition.side || 1) * Math.sign(alignment),
        local,
      },
    ];
  });
}
