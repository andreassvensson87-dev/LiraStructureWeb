import { dependentViewIds } from './drawing-views.js';

/** A context click preserves the effective selection; empty paper never clears it. */
export function drawingContextSelection(selection, hit) {
  if (!hit) return selection;
  const key = hit.kind === 'view' ? 'viewIds' : 'annotationIds';
  if (selection[key].includes(hit.id)) return selection;
  return {
    annotationIds: hit.kind === 'annotation' ? [hit.id] : [],
    viewIds: hit.kind === 'view' ? [hit.id] : [],
  };
}

/** Expand dependent views once and reject deleting the last drawing view. */
export function withoutDrawingSelection(state) {
  const ids = new Set(state.viewIds.flatMap((id) => [...dependentViewIds(state.views, id)]));
  if (ids.size && state.views.every((view) => ids.has(view.id)))
    throw Error('Minst en vy måste finnas kvar.');
  const annotations = new Set(state.annotationIds);
  return {
    ...state,
    views: state.views.filter((view) => !ids.has(view.id)),
    annotations: state.annotations.filter(
      (item) => !annotations.has(item.id) && !ids.has(item.view),
    ),
    viewIds: [],
    annotationIds: [],
    selectionScope: { annotationIds: [], viewIds: [], type: '' },
  };
}
