import { resizeDrawingView } from './drawing-views.js';

// View owners supply their current objects and redraw; this adapter owns grip edits.
export function beginDrawingViewGrip({
  event,
  node,
  paper,
  paperSize,
  views,
  selected,
  annotations,
  render,
}) {
  const kind = node.dataset.viewGrip || node.dataset.cropCorner || 'move';
  const id = node.closest('[data-view]')?.dataset.view || selected()[0]?.id;
  const active = views().find((view) => view.id === id);
  if (!active) return null;
  const chosen = kind === 'move' ? selected() : [active];
  const before = structuredClone(chosen);
  const point = (event) => {
    const rect = paper.getBoundingClientRect(),
      size = paperSize();
    return [
      ((event.clientX - rect.left) * size[0]) / rect.width,
      ((event.clientY - rect.top) * size[1]) / rect.height,
    ];
  };
  const origin = point(event);
  const restore = (states) => {
    for (const state of states) {
      const view = views().find((view) => view.id === state.id);
      if (view) Object.assign(view, structuredClone(state));
    }
    render();
  };
  return {
    label: kind === 'move' ? 'Flytta vyn' : 'Beskär vyn · skalan behålls',
    locate: (event) => ({ view: 'paper', point: point(event) }),
    apply: (hit) => {
      const delta = hit.point.map((v, i) => v - origin[i]);
      for (const original of before) {
        const view = views().find((view) => view.id === original.id);
        if (!view) continue;
        Object.assign(
          view,
          kind === 'move'
            ? { position: original.position.map((v, i) => v + delta[i]) }
            : resizeDrawingView(original, kind, delta),
        );
      }
    },
    preview: render,
    commit: () => annotations.recordOperation(before, structuredClone(chosen), restore),
    cancel: () => restore(before),
  };
}
