import { drawingMarqueeHits } from './drawing-selection-geometry.js';
import { updateDetailArea, syncDetailCrop } from './drawing-details.js';
import { drawingProfileDetail } from './profile-detail.js';
// Paper coordinates are millimetres; camera coordinates are model millimetres.
/** Unpainted space inside a view must still accept machining/dimension points. */
export function drawingViewAtPoint(views, point, selectedId = null) {
  const contains = (v) =>
    point.every((n, i) => n >= v.position[i] && n <= v.position[i] + v.size[i]);
  return (
    views.find((v) => v.id === selectedId && contains(v)) ||
    [...views].reverse().find(contains) ||
    null
  );
}
export function ensureGAViews(record, paper, center, scale, contentArea = null) {
  const sheet = (record.sheet ??= {});
  const [left, top, right, bottom] = contentArea || [10, 10, paper[0] - 10, paper[1] - 10];
  if (!sheet.views?.length)
    sheet.views = [
      {
        id: 'plan',
        name: 'Planvy 1',
        kind: 'view',
        projection: 'plan',
        source: { type: 'model' },
        position: [left, top],
        size: [right - left, bottom - top],
        scale,
        camera: { center: [...center] },
        settings: { ...record.settings, levelId: record.levelId },
      },
    ];
  for (const view of sheet.views) {
    view.settings ??= {};
    view.settings.profileDetail = drawingProfileDetail(view, 'GA');
  }
  record.annotations ??= [];
  return sheet.views;
}
export const PART_VIEW_IDS = ['top', 'front', 'section'];
export function ensurePartViews(record) {
  if (!Array.isArray(record.sheet.views))
    throw Error('Ritningen saknar vyer. Skapa den med en ritningsmall.');
  for (const view of record.sheet.views) {
    view.settings ??= {};
    view.settings.profileDetail = drawingProfileDetail(view, record.type);
    view.settings.hiddenLines ??= record.drawingPreset?.hiddenLines ?? true;
  }
  return record.sheet.views;
}
export function partViewScales(sheet) {
  return Object.fromEntries(
    PART_VIEW_IDS.map((id) => [id, sheet.views.find((v) => v.id === id)?.scale ?? 10]),
  );
}
export function viewById(sheet, id) {
  return sheet.views?.find((v) => v.id === id);
}
export function setDrawingViewScale(view, scale) {
  if (!Number.isFinite(scale) || scale < 0.1 || scale > 10000) throw Error('Ogiltig vyskala.');
  const factor = view.scale / scale;
  const center = view.position.map((value, axis) => value + view.size[axis] / 2);
  view.size = view.size.map((value) => value * factor);
  view.scale = scale;
  if (view.detail) updateDetailArea(view);
  view.position = center.map((value, axis) => value - view.size[axis] / 2);
}
export function resizeDrawingView(view, corner, delta) {
  const next = cropDrawingView(view, corner, delta);
  syncDetailCrop(next);
  return next;
}
export function duplicateDrawingView(view, views, annotations, { copyAnnotations = true } = {}) {
  const copy = structuredClone(view);
  copy.id = crypto.randomUUID();
  copy.name = view.name + ' – kopia';
  let n = 2;
  while (views.some((v) => v.name === copy.name)) copy.name = view.name + ' – kopia ' + n++;
  copy.position = copy.position.map((v) => v + 15);
  return {
    view: copy,
    annotations: copyAnnotations
      ? annotations
          .filter((a) => a.view === view.id)
          .map((a) => ({ ...structuredClone(a), id: crypto.randomUUID(), view: copy.id }))
      : [],
  };
}
export function cropDrawingView(view, corner, delta, minSize = 15) {
  const next = structuredClone(view),
    [dx, dy] = delta,
    [w, h] = view.size;
  const left = corner.includes('w') ? Math.min(dx, w - minSize) : 0,
    top = corner.includes('n') ? Math.min(dy, h - minSize) : 0;
  const right = corner.includes('e') ? Math.max(dx, minSize - w) : 0,
    bottom = corner.includes('s') ? Math.max(dy, minSize - h) : 0;
  next.position = [view.position[0] + left, view.position[1] + top];
  next.size = [w + right - left, h + bottom - top];
  next.camera.center = [
    view.camera.center[0] + ((left + right) * view.scale) / 2,
    view.camera.center[1] - ((top + bottom) * view.scale) / 2,
  ];
  return next;
}

/** Keep an existing group while grabbing its move handle; Shift toggles membership. */
export function drawingViewSelection(ids, id, additive = false, preserve = false) {
  if (!id) return new Set();
  if (preserve && ids.has(id) && !additive) return new Set(ids);
  const next = additive ? new Set(ids) : new Set();
  if (additive && next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}
export function viewsInRectangle(views, a, b) {
  return views
    .filter((view) => {
      const [x, y] = view.position,
        [w, h] = view.size;
      // Open polyline: crossing only hits the border, never the empty interior.
      return drawingMarqueeHits(
        [
          {
            points: [
              [x, y],
              [x + w, y],
              [x + w, y + h],
              [x, y + h],
              [x, y],
            ],
            closed: false,
          },
        ],
        a,
        b,
      );
    })
    .map((view) => view.id);
}

export function dependentViewIds(views, id) {
  const ids = new Set([id]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const view of views)
      if (ids.has(view.source?.parentViewId) && !ids.has(view.id)) {
        ids.add(view.id);
        changed = true;
      }
  }
  return ids;
}
