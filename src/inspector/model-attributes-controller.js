import { Inspector } from '../inspector.js';
import { isCut } from '../model-object.js';

export function installModelAttributes({
  $,
  actions,
  controllers,
  modelEditor,
  objects,
  project,
  scene,
  tools,
  ui,
}) {
  const dispose = (...args) => actions.dispose(...args);
  const fillForm = (...args) => actions.fillForm(...args);
  const isVisible = (...args) => actions.isVisible(...args);
  const previewModelBatch = (...args) => actions.previewModelBatch(...args);
  const rememberPlate = (...args) => actions.rememberPlate(...args);
  const rememberSweep = (...args) => actions.rememberSweep(...args);
  const remove = (...args) => actions.remove(...args);
  const render = (...args) => actions.render(...args);
  const select = (...args) => actions.select(...args);
  const syncMaterialPanel = (...args) => actions.syncMaterialPanel(...args);
  const validateSweep = (...args) => actions.validateSweep(...args);
  Object.assign(actions, { cancelInspectorPreview, inspectorSelection, renderCutRelations });
  function cancelInspectorPreview() {
    if (ui.inspectorPreview) {
      scene.remove(ui.inspectorPreview);
      dispose(ui.inspectorPreview);
      ui.inspectorPreview = null;
    }
    if (!tools.operation)
      objects.children.forEach((child) => (child.visible = isVisible(child.userData.id)));
  }
  function inspectorSelection() {
    return controllers.inspector
      ? controllers.inspector.getState().selected
      : project.objects.filter((s) => ui.selectedIds.has(s.id));
  }
  controllers.inspector = new Inspector({
    scopeChanged: (staged = false) => {
      if (!staged) render();
      else syncMaterialPanel();
    },
    getState: () => ({
      selected: project.objects.filter((s) => ui.selectedIds.has(s.id)),
      drawing: tools.drawing,
      operation: tools.operation,
    }),
    validate: validateSweep,
    preview: (batch) => {
      cancelInspectorPreview();
      ui.inspectorPreview = previewModelBatch(batch, false);
      scene.add(ui.inspectorPreview);
    },
    cancel: cancelInspectorPreview,
    commit: (batch) => {
      modelEditor.update(batch);
      for (const object of batch) {
        rememberSweep(object);
        rememberPlate(object);
      }
      render();
      $('status').textContent = 'Egenskaper uppdaterade';
    },
    fillStandard: (object) => fillForm(object),
    fill: (batch) => {
      if (batch.length === 1 && !controllers.inspector.multiEditing) {
        fillForm(batch[0]);
        $('inspector-name').value = batch[0].name;
      } else controllers.inspector.fillCommon(batch);
    },
    remove,
  });
  function renderCutRelations() {
    const related = project.objects.filter(
        (s) => isCut(s) && s.targets.some((id) => ui.selectedIds.has(id)),
      ),
      cut = project.objects.find((s) => s.id === ui.selected && isCut(s));
    $('cut-relations').hidden = !related.length && !cut;
    const list = $('cut-relations-list');
    list.replaceChildren();
    $('cut-relations-title').textContent = cut ? 'Målobjekt' : 'Skärningar';
    for (const s of cut ? project.objects.filter((s) => cut.targets.includes(s.id)) : related) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = s.name;
      button.onclick = () => select(s.id);
      list.append(button);
    }
  }
}
