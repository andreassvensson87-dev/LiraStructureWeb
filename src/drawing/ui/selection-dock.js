import { DrawingSelectionScope } from '../../drawing-selection-scope.js';
import { installSelectionDock } from '../../inspector/selection-dock.js';

const signature = (selection) =>
  JSON.stringify([[...selection.annotationIds].sort(), [...selection.viewIds].sort()]);

/** Drawing adapter for the model inspector's shared scope and icon dock. */
export function installDrawingSelectionDock(
  editor,
  { host, anchor, visible, showProperties, showViews },
) {
  const state = new DrawingSelectionScope();
  let updating = 0;
  const data = () => [editor.items, editor.record ? editor.marquee.views?.views() || [] : []];
  const selected = () => ({
    annotationIds: [...editor.selectedIds],
    viewIds: [...(editor.marquee.views?.ids() || [])],
  });
  const adapter = {
    scope: state.scope,
    get tab() {
      return visible() ? 'properties' : '';
    },
    rawState: () => ({
      selected: state.objects(...data()),
      operation: editor.mode || editor.drag || editor.grips?.session || editor.richText?.draft,
    }),
    chooseScope(type) {
      const next = state.choose(type, ...data());
      controller.run(() => {
        editor.marquee.views?.change(new Set(next.viewIds));
        editor.selectedIds = new Set(next.annotationIds);
        editor.selected = next.annotationIds.at(-1) || null;
      });
      if (next.annotationIds.length) showProperties();
      else if (next.viewIds.length) showViews();
      editor.ui();
      editor.adapter.redraw();
    },
  };
  const dock = installSelectionDock(adapter, { host, anchor });
  const controller = {
    run(callback) {
      updating++;
      try {
        return callback();
      } finally {
        updating--;
      }
    },
    capture() {
      if (updating) return;
      state.capture(selected());
      controller.sync();
    },
    clear() {
      state.clear();
      dock.sync();
    },
    sync() {
      if (updating) return;
      const previous = state.scope.type;
      state.active(...data());
      if (previous && !state.scope.type) {
        adapter.chooseScope('');
        return;
      }
      dock.sync();
    },
    hasSelection: () => state.ids.annotationIds.length + state.ids.viewIds.length > 0,
    snapshot: () => state.snapshot(),
    finishApply(operation) {
      if (operation.selectionScope) state.restore(operation.selectionScope, ...data());
      else if (signature(state.active(...data())) !== signature(selected()))
        state.capture(selected());
      operation.selectionScope = state.snapshot();
    },
  };
  editor.selectionScope = controller;
  return controller;
}
