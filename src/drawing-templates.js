import { normalizePreset } from './drawing-presets.js';
import * as THREE from 'three';
import { partViewFrame } from './part-view-frame.js';
import { frameMatrix, sectionFrame, sectionDrawing } from './drawing-sections.js';
export const TEMPLATE_KEY = 'lirastructure.drawing-templates.v1';
export function readDrawingTemplates() {
  try {
    const items = JSON.parse(localStorage.getItem(TEMPLATE_KEY) || '[]');
    return Array.isArray(items)
      ? items.filter((t) => t.version === 1 && Array.isArray(t.views) && t.views.length)
      : [];
  } catch {
    return [];
  }
}
function frameFor(view, views) {
  if (view.section)
    return sectionFrame(
      frameFor(
        views.find((v) => v.id === view.source.parentViewId),
        views,
      ),
      view.section.points,
      view.section.side,
      'source',
    );
  return partViewFrame(view.projection || view.id);
}
function projected(bounds, frame) {
  return bounds.clone().applyMatrix4(frameMatrix(frame));
}
export function createDrawingTemplate(record, bounds, name, id = crypto.randomUUID()) {
  if (!name.trim()) throw Error('Ange ett mallnamn.');
  const views = record.sheet.views.filter((v) => !v.detail);
  // Detail-dependent sections have no reusable parent in this first version.
  const included = new Set(views.filter((v) => !v.section).map((v) => v.id));
  for (let i = 0; i < views.length; i++)
    for (const v of views) if (v.section && included.has(v.source.parentViewId)) included.add(v.id);
  const saved = views
    .filter((v) => included.has(v.id))
    .map((v) => ({
      id: v.id,
      name: v.name,
      projection: v.projection,
      standard: !v.section,
      kind: v.kind,
      position: [...v.position],
      scale: v.scale,
      settings: structuredClone(v.settings),
      source: { type: 'part', ...(v.section ? { parentViewId: v.source.parentViewId } : {}) },
      ...(v.section ? { section: structuredClone(v.section) } : {}),
    }));
  if (!saved.length) throw Error('Mallen behöver minst en standardvy.');
  return {
    version: 1,
    id,
    name: name.trim(),
    paper: structuredClone(record.sheet.paper),
    landscape: record.sheet.landscape,
    layoutId: record.sheet.layoutId || '',
    typography: structuredClone(record.typography),
    drawingPreset: normalizePreset({ ...record.drawingPreset, font: record.typography?.font }),
    bounds: { min: bounds.min.toArray(), max: bounds.max.toArray() },
    views: saved,
  };
}
/** Rebuild cameras and section positions in the new part's own drawing coordinates. */
export function instantiateDrawingTemplate(template, geometry, sourceId) {
  const original = new THREE.Box3(
    new THREE.Vector3(...template.bounds.min),
    new THREE.Vector3(...template.bounds.max),
  );
  geometry.computeBoundingBox();
  const bounds = geometry.boundingBox;
  const views = structuredClone(template.views),
    done = new Set();
  const build = (view) => {
    if (done.has(view.id)) return;
    if (view.section) {
      const parent = views.find((v) => v.id === view.source.parentViewId);
      build(parent);
      const oldParent = template.views.find((v) => v.id === parent.id);
      const oldBox = projected(original, frameFor(oldParent, template.views)),
        newBox = projected(bounds, frameFor(parent, views));
      view.section.points = view.section.points.map((p) =>
        ['x', 'y'].map(
          (axis, i) =>
            newBox.min[axis] +
            ((p[i] - oldBox.min[axis]) / Math.max(oldBox.max[axis] - oldBox.min[axis], 1e-6)) *
              (newBox.max[axis] - newBox.min[axis]),
        ),
      );
      view.section.depth *=
        bounds.getSize(new THREE.Vector3()).length() /
        Math.max(original.getSize(new THREE.Vector3()).length(), 1e-6);
    }
    view.source.objectId = sourceId;
    const frame = frameFor(view, views);
    let box;
    if (view.section) box = sectionDrawing([geometry], frame, view.section.depth).bounds;
    else {
      const b = projected(bounds, frame);
      box = new THREE.Box2(
        new THREE.Vector2(b.min.x, b.min.y),
        new THREE.Vector2(b.max.x, b.max.y),
      );
    }
    if (box.isEmpty()) box = new THREE.Box2(new THREE.Vector2(-10, -10), new THREE.Vector2(10, 10));
    view.camera = { center: box.getCenter(new THREE.Vector2()).toArray() };
    const size = box.getSize(new THREE.Vector2());
    view.size = [Math.max(25, size.x / view.scale + 12), Math.max(25, size.y / view.scale + 12)];
    done.add(view.id);
  };
  views.forEach(build);
  return {
    paper: structuredClone(template.paper),
    landscape: template.landscape,
    layoutId: template.layoutId,
    views,
    independentViews: true,
    sectionOrientation: 'source-up',
    drawingHandedness: 'right',
    viewsVersion: 2,
  };
}
