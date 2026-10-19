import { translatedShapes } from './drawing-object-transform.js';
import { duplicateDrawingView } from './drawing-views.js';
import { blockSelection } from './blocks/placement.js';

/** Paper-space translation. View-owned annotations travel with their view exactly once. */
export function translateDrawingSelection(
  views,
  annotations,
  viewIds,
  annotationIds,
  delta,
  copy = false,
) {
  if (!delta?.every(Number.isFinite) || delta.length !== 2 || Math.hypot(...delta) < 1e-7)
    throw Error('Välj en annan tillpunkt.');
  const nextViews = structuredClone(views),
    nextAnnotations = structuredClone(annotations);
  const chosenViews = new Set(viewIds),
    chosenItems = blockSelection(annotations, annotationIds);
  const selectedViews = [],
    selectedItems = [],
    copies = new Map();
  for (const view of views.filter((v) => chosenViews.has(v.id))) {
    if (copy) {
      const result = duplicateDrawingView(view, nextViews, annotations);
      result.view.position = view.position.map((v, i) => v + delta[i]);
      copies.set(view.id, result.view.id);
      nextViews.push(result.view);
      nextAnnotations.push(...result.annotations);
      selectedViews.push(result.view.id);
      const originals = annotations.filter((a) => a.view === view.id);
      const blocks = new Map(),
        links = new Map();
      result.annotations.forEach((item, index) => {
        if (chosenItems.has(originals[index].id)) selectedItems.push(item.id);
        for (const [key, map] of [
          ['parametricBlock', blocks],
          ['dimensionLinkId', links],
        ]) {
          const old = key === 'parametricBlock' ? item.parametricBlock?.instanceId : item[key];
          if (!old) continue;
          if (!map.has(old)) map.set(old, crypto.randomUUID());
          if (key === 'parametricBlock') item.parametricBlock.instanceId = map.get(old);
          else item[key] = map.get(old);
        }
      });
    } else {
      nextViews.find((v) => v.id === view.id).position = view.position.map((v, i) => v + delta[i]);
      selectedViews.push(view.id);
      selectedItems.push(
        ...annotations.filter((a) => chosenItems.has(a.id) && a.view === view.id).map((a) => a.id),
      );
    }
  }
  for (const view of nextViews.filter((v) => selectedViews.includes(v.id)))
    if (copy && copies.has(view.source?.parentViewId))
      view.source.parentViewId = copies.get(view.source.parentViewId);
  const groups = new Map();
  for (const item of annotations.filter((a) => chosenItems.has(a.id) && !chosenViews.has(a.view))) {
    if (!groups.has(item.view)) groups.set(item.view, []);
    groups.get(item.view).push(item.id);
  }
  for (const [viewId, ids] of groups) {
    const scale = viewId === 'paper' ? 1 : views.find((v) => v.id === viewId)?.scale;
    if (!Number.isFinite(scale)) throw Error('Ritningsvyn saknas.');
    const offset = viewId === 'paper' ? delta : [delta[0] * scale, -delta[1] * scale];
    const result = translatedShapes(annotations, ids, [0, 0], offset, copy);
    for (const item of result) {
      if (copy) nextAnnotations.push(item);
      else
        Object.assign(
          nextAnnotations.find((a) => a.id === item.id),
          item,
        );
      selectedItems.push(item.id);
    }
  }
  return {
    views: nextViews,
    annotations: nextAnnotations,
    viewIds: selectedViews,
    annotationIds: selectedItems,
  };
}
