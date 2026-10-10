import { createSweepForm } from './sweep-form.js';

export function installModelSweepForm({ project, tools, ui, controllers, $, actions }) {
  const fillPlate = (...args) => actions.fillPlate(...args);
  const save = (...args) => actions.save(...args);
  const updateTypedLength = (...args) => actions.updateTypedLength(...args);
  const updatePointer = (...args) => actions.updatePointer(...args);
  const clearPreview = (...args) => actions.clearPreview(...args);
  const rememberSweep = (...args) => actions.rememberSweep(...args);
  const { readForm, fillForm, updateForm } = createSweepForm({
    project,
    tools,
    ui,
    getProfilePicker: () => controllers.profilePicker,
    getInspector: () => controllers.inspector,
    fillPlate: (s) => fillPlate(s),
    save,
    updateTypedLength,
    updatePointer,
    clearPreview,
    remember: () => {
      if (
        !ui.selected &&
        !tools.operation &&
        ['width', 'height', 'rotation'].every((id) => $(id).value.trim())
      )
        rememberSweep({ ...readForm(), ...ui.draftMaterial });
    },
  });
  Object.assign(actions, { readForm, fillForm, updateForm });
}
