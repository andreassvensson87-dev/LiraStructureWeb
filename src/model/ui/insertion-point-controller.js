import { gripRefKey, validGripRefs, selectGripRefs } from '../grip-selection.js';
import { radiusPointRefs, pointRadiusBatch } from '../insertion-point-edit.js';
import { createInsertionPointInspector } from '../../inspector/insertion-point-inspector.js';
/** Owns native grip selection and the point inspector's ordinary model transaction. */
export function installInsertionPointEditor({
  $,
  actions,
  controllers,
  frameGate,
  modelEditor,
  project,
  scene,
  tools,
  ui,
}) {
  const root = $('inspector-properties');
  let refs = [],
    batch = null,
    value = null,
    signature = '',
    dirty = false;
  const inspector = createInsertionPointInspector(root, {
    preview,
    commit,
    reset,
    cancel: () => {
      clear();
      actions.render({ selectionOnly: true });
    },
  });
  const editor = {
    activate,
    clear,
    sync,
    select: selectPoints,
    selected: () => validGripRefs(project.objects, refs, ui.selectedIds),
    moving(grip) {
      const selected = new Set(refs.map(gripRefKey));
      if (!grip.refs.every((r) => selected.has(gripRefKey(r)))) selectPoints(grip.refs);
      return { ...grip, refs: editor.selected() };
    },
  };
  controllers.pointUI = editor;
  function cancelPreview() {
    actions.cancelInspectorPreview();
    batch = null;
  }
  function clear() {
    cancelPreview();
    refs = [];
    dirty = false;
    signature = '';
    root.classList.remove('point-context');
    inspector.panel.hidden = true;
  }
  function reset() {
    cancelPreview();
    inspector.error.textContent = '';
    dirty = false;
    signature = '';
    sync();
    frameGate.invalidate();
  }
  function activate(grip, event = {}) {
    if (!grip?.refs?.length || tools.operation) return false;
    const chosen = validGripRefs(project.objects, grip.refs, ui.selectedIds);
    if (!chosen.length) return false;
    const selected = new Set(refs.map(gripRefKey));
    if (!event.altKey && !event.shiftKey && chosen.every((r) => selected.has(gripRefKey(r))))
      return true;
    selectPoints(chosen, { additive: !!event.shiftKey, toggle: !!event.altKey });
    return true;
  }
  function selectPoints(chosen, options) {
    if (tools.operation) return;
    controllers.inspector.rollback();
    cancelPreview();
    refs = selectGripRefs(
      editor.selected(),
      validGripRefs(project.objects, chosen, ui.selectedIds),
      options,
    );
    signature = '';
    dirty = false;
    controllers.inspector.show('properties');
    sync();
    frameGate.invalidate();
  }
  function sync() {
    refs = editor.selected();
    const groupIds = new Set(
      project.objects.filter((s) => s.type === 'fastener' && s.group).map((s) => s.id),
    );
    const groupPoints = refs.length > 0 && refs.every((ref) => groupIds.has(ref.id));
    const visible = refs.length > 0 && !groupPoints && !tools.drawing && !tools.operation;
    root.classList.toggle('point-context', visible);
    inspector.panel.hidden = !visible;
    if (!visible) {
      if (batch) cancelPreview();
      return;
    }
    const next = JSON.stringify(
      refs.map((ref) => [ref, project.objects.find((o) => o.id === ref.id)]),
    );
    if (next !== signature) {
      cancelPreview();
      signature = next;
      dirty = false;
      inspector.error.textContent = '';
    }
    const editable = radiusPointRefs(project.objects, refs);
    const radii = editable.map(
      (ref) => project.objects.find((o) => o.id === ref.id).radii?.[ref.kind] || 0,
    );
    if (!dirty) value = radii.length && radii.every((r) => r === radii[0]) ? radii[0] : null;
    const disabled = editable.length === 0;
    inspector.sync({ total: refs.length, value, disabled, dirty, valid: !!batch });
  }
  function preview(text) {
    cancelPreview();
    value = text;
    dirty = true;
    try {
      if (!text.trim()) throw Error('Ange en radie i mm.');
      batch = pointRadiusBatch(project.objects, refs, Number(text.replace(',', '.')));
      modelEditor.prepare(batch);
      ui.inspectorPreview = actions.previewModelBatch(batch, false);
      scene.add(ui.inspectorPreview);
      inspector.error.textContent = '';
      inspector.sync({ total: refs.length, value, dirty: true, valid: true });
    } catch (error) {
      batch = null;
      inspector.error.textContent = error.message;
      inspector.sync({ total: refs.length, value, dirty: true, valid: false });
    }
    frameGate.invalidate();
  }
  function commit(text) {
    preview(text);
    if (!batch) return;
    try {
      const changed = batch.some(
        (next) =>
          JSON.stringify(next) !== JSON.stringify(project.objects.find((o) => o.id === next.id)),
      );
      if (changed) modelEditor.update(batch);
      $('inspector-error').textContent = $('error').textContent = '';
      reset();
      actions.render();
      $('status').textContent = 'Hörnradier uppdaterade';
    } catch (error) {
      inspector.error.textContent = error.message;
    }
  }
}
