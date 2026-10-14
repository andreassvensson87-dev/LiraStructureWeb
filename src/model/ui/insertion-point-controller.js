import { radiusPointObject, pointRadiusBatch } from '../insertion-point-edit.js';
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
  const editor = { activate, clear, sync, selected: () => refs };
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
  function activate(grip, event) {
    if (!grip?.refs?.length || tools.operation) return false;
    const chosen = grip.refs.filter(
      (ref) =>
        radiusPointObject(project.objects.find((o) => o.id === ref.id)) &&
        typeof ref.kind === 'number',
    );
    if (!chosen.length) return false;
    if (event?.detail >= 2 && !event.shiftKey) {
      const moving = refs.length ? refs : chosen;
      clear();
      actions.startGrip({ ...grip, refs: moving });
      controllers.polysweepUI?.sync();
      return true;
    }
    controllers.inspector.rollback();
    cancelPreview();
    if (!event?.shiftKey) {
      // The first click of a double-click must retain an already selected group.
      if (!chosen.every((r) => refs.some((p) => p.id === r.id && p.kind === r.kind))) refs = chosen;
    } else {
      const has = chosen.every((r) => refs.some((p) => p.id === r.id && p.kind === r.kind));
      refs = has
        ? refs.filter((p) => !chosen.some((r) => p.id === r.id && p.kind === r.kind))
        : [...refs, ...chosen.filter((r) => !refs.some((p) => p.id === r.id && p.kind === r.kind))];
    }
    signature = '';
    dirty = false;
    controllers.inspector.show('properties');
    sync();
    frameGate.invalidate();
    return true;
  }
  function sync() {
    refs = refs.filter((ref) => {
      const o = project.objects.find((s) => s.id === ref.id);
      return (
        ui.selectedIds.has(ref.id) &&
        radiusPointObject(o) &&
        ref.kind < (o.type === 'plate' ? o.polygon.length : o.points.length)
      );
    });
    const visible = refs.length > 0 && !tools.drawing && !tools.operation;
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
    const radii = refs.map(
      (ref) => project.objects.find((o) => o.id === ref.id).radii?.[ref.kind] || 0,
    );
    if (!dirty) value = radii.every((r) => r === radii[0]) ? radii[0] : null;
    const disabled = refs.some((ref) => {
      const o = project.objects.find((s) => s.id === ref.id);
      return o.type === 'polysweep' && [0, o.points.length - 1].includes(ref.kind);
    });
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
      reset();
      actions.render();
      $('status').textContent = 'Hörnradier uppdaterade';
    } catch (error) {
      inspector.error.textContent = error.message;
    }
  }
}
