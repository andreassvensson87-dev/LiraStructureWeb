import { SelectionScope } from './inspector/selection-scope.js';

export function drawingSelectionType(entry) {
  if (entry.kind === 'view') return { id: 'view', label: 'Vyer' };
  const item = entry.object;
  if (item.type === 'dimension') return { id: 'dimension', label: 'Mått' };
  if (item.type === 'richtext') return { id: 'richtext', label: 'Text' };
  if (item.type === 'leader') return { id: 'leader', label: 'Hänvisningar' };
  return ['line', 'polyline'].includes(item.shape)
    ? { id: 'line', label: 'Linjer' }
    : { id: 'shape', label: 'Former' };
}

/** Retains selection identities, not copies of drawing geometry or properties. */
export class DrawingSelectionScope {
  constructor() {
    this.scope = new SelectionScope(drawingSelectionType);
    this.clear();
  }
  clear() {
    this.ids = { annotationIds: [], viewIds: [] };
    this.scope.sync([]);
  }
  capture({ annotationIds, viewIds }) {
    this.ids = { annotationIds: [...annotationIds], viewIds: [...viewIds] };
    this.scope.type = '';
    this.scope.signature = '';
  }
  objects(annotations, views) {
    const annotationsIds = new Set(this.ids.annotationIds);
    const viewIds = new Set(this.ids.viewIds);
    return [
      ...annotations
        .filter((item) => annotationsIds.has(item.id))
        .map((object) => ({ id: `annotation:${object.id}`, kind: 'annotation', object })),
      ...views
        .filter((item) => viewIds.has(item.id))
        .map((object) => ({ id: `view:${object.id}`, kind: 'view', object })),
    ];
  }
  selection(objects) {
    return {
      annotationIds: objects
        .filter((item) => item.kind === 'annotation')
        .map((item) => item.object.id),
      viewIds: objects.filter((item) => item.kind === 'view').map((item) => item.object.id),
    };
  }
  active(annotations, views) {
    return this.selection(this.scope.sync(this.objects(annotations, views)));
  }
  choose(type, annotations, views) {
    const objects = this.objects(annotations, views);
    this.scope.sync(objects);
    return this.selection(this.scope.choose(type, objects));
  }
  snapshot() {
    return { ...structuredClone(this.ids), type: this.scope.type };
  }
  restore(state, annotations, views) {
    this.capture(state);
    const type =
      state.type &&
      this.scope.groups(this.objects(annotations, views)).some((g) => g.id === state.type)
        ? state.type
        : '';
    return this.choose(type, annotations, views);
  }
}
