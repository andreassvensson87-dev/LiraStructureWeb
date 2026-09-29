import { updateDetailArea, syncDetailCrop } from './drawing-details.js';
// Paper coordinates are millimetres; camera coordinates are model millimetres.
export const DRAWING_VIEWS_VERSION = 2;
export function ensureGAViews(record, paper, center, scale) {
  const sheet = (record.sheet ??= {});
  if (!sheet.views?.length)
    sheet.views = [
      {
        id: 'plan',
        name: 'Planvy 1',
        kind: 'view',
        projection: 'plan',
        source: { type: 'model' },
        position: [...(sheet.viewPosition || [10, 10])],
        size: [paper[0] - 20, paper[1] - 20],
        scale: sheet.viewScale || scale,
        camera: { center: [...center] },
        settings: { ...record.settings, levelId: record.levelId },
      },
    ];
  sheet.viewsVersion = DRAWING_VIEWS_VERSION;
  record.annotations ??= [];
  for (const a of record.annotations) if (!a.view || a.view === 'plan') a.view = sheet.views[0].id;
  return sheet.views;
}
export const PART_VIEW_IDS = ['top', 'front', 'section'];
const partNames = { top: 'Top', front: 'Front', section: 'Sektion A–A' };
const legacyPartNames = { top: 'Ovanifrån', front: 'Huvudvy' };
/** Migrate legacy scale/visibility maps once. View records are the source of truth. */
export function ensurePartViews(record, config = record.sheet) {
  if (record.sheet.independentViews) {
    for (const view of record.sheet.views)
      if (legacyPartNames[view.id] && view.name === legacyPartNames[view.id])
        view.name = partNames[view.id];
    return record.sheet.views;
  }
  const sheet = record.sheet,
    existing = sheet.views || [];
  sheet.views = PART_VIEW_IDS.map((id) => {
    const old = existing.find((v) => v.id === id);
    return {
      ...old,
      id,
      name: !old?.name || old.name === legacyPartNames[id] ? partNames[id] : old.name,
      kind: id === 'section' ? 'section' : 'view',
      projection: id,
      source: {
        type: 'part',
        objectId: record.sourceId,
        ...(id === 'section' ? { parentViewId: 'front' } : {}),
      },
      scale: old?.scale ?? config.scales?.[id] ?? config.scale ?? 10,
      position: old?.position || [0, 0],
      size: old?.size || [1, 1],
      camera: old?.camera || { center: [0, 0] },
      settings: {
        ...old?.settings,
        hiddenLines:
          old?.settings?.hiddenLines ??
          config.hiddenLines?.[id] ??
          record.drawingPreset?.hiddenLines ??
          true,
        ...(id === 'section' ? { section: config.section } : {}),
      },
    };
  }).concat(existing.filter((v) => !PART_VIEW_IDS.includes(v.id)));
  sheet.viewsVersion = DRAWING_VIEWS_VERSION;
  delete sheet.scales;
  delete sheet.hiddenLines;
  delete sheet.scale;
  return sheet.views;
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
  view.scale = scale;
  if (view.detail) updateDetailArea(view);
}
export function syncPartViews(record, config, boxes) {
  const views = ensurePartViews(record, config);
  PART_VIEW_IDS.forEach((id, i) => {
    const view = views.find((v) => v.id === id),
      box = boxes[i];
    if (!box || !view || view.section || view.detail) return;
    view.position = [box[0], box[1]];
    view.size = [box[2] - box[0], box[3] - box[1]];
  });
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
