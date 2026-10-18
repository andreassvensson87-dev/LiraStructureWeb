import { resizeSectionExtent } from './section-extents.js';
import { updateDetailArea } from './drawing-details.js';

// Marker geometry previews locally. Projection updates belong to the view owner on release.
export function beginDrawingMarkerGrip(tool, event, node) {
  const type = tool.feedback.type;
  const id = type === 'section' ? node.dataset.sectionId : node.dataset.detailId;
  const view = tool.adapter.views().find((view) => view.id === id);
  if (!view?.[type]) return null;
  const before = structuredClone(view);
  tool.adapter.cancel();
  tool.selectedMarker = id;
  tool.draft = {
    edit: id,
    index: Number(type === 'section' ? node.dataset.sectionEndpoint : node.dataset.detailCorner),
    parentId: view.source.parentViewId,
    points: structuredClone(view[type].points),
    section: structuredClone(view.section),
    extent: node.dataset.sectionExtent,
  };
  let next;
  const restore = (states) => {
    Object.assign(view, structuredClone(states[0]));
    tool.cancel();
    tool.adapter.update(view, { recenter: false });
  };
  return {
    label: node.getAttribute('aria-label') || 'Ändra detaljgräns',
    locate: (event) => tool.feedback.locate(event),
    apply: (hit) => {
      next = structuredClone(before);
      const d = tool.draft;
      if (type === 'detail') {
        const points = structuredClone(before.detail.points);
        points[d.index] = hit.point;
        updateDetailArea(next, points);
      } else if (d.extent) next.section = resizeSectionExtent(before.section, d.extent, hit.point);
      else {
        const other = before.section.points[1 - d.index];
        if (Math.hypot(hit.point[0] - other[0], hit.point[1] - other[1]) < 0.01)
          throw Error('Snittets punkter får inte sammanfalla.');
        next.section.points[d.index] = [...hit.point];
      }
      tool.hover = hit.point;
      tool.feedback.hit = hit;
    },
    preview: () => tool.feedback.repaint(),
    commit: () => {
      Object.assign(view, next);
      tool.cancel();
      tool.adapter.update(view);
      tool.adapter.feedback.recordOperation([before], [structuredClone(view)], restore);
    },
    cancel: () => {
      tool.cancel();
      tool.adapter.redraw();
    },
  };
}
