import { suggestedProfileMaterial, profileMaterialSuggestions } from '../profile-material.js';
import { SectionEditor } from '../section-editor.js';
import { ProfilePicker } from '../profile-picker.js';
import { MaterialUI } from '../material-ui.js';
import { isPhysical } from '../model-object.js';

export function installModelLibraries({
  $,
  actions,
  controllers,
  modelEditor,
  project,
  tools,
  ui,
}) {
  const fillForm = (...args) => actions.fillForm(...args);
  const inspectorSelection = (...args) => actions.inspectorSelection(...args);
  const readForm = (...args) => actions.readForm(...args);
  const rememberPlate = (...args) => actions.rememberPlate(...args);
  const rememberSweep = (...args) => actions.rememberSweep(...args);
  const render = (...args) => actions.render(...args);
  const setDrawing = (...args) => actions.setDrawing(...args);
  const startDrawing = (...args) => actions.startDrawing(...args);
  const updateForm = (...args) => actions.updateForm(...args);
  const validateSweep = (...args) => actions.validateSweep(...args);
  Object.assign(actions, { applyLibrarySection, syncMaterialPanel });
  function applyLibrarySection(section) {
    if (controllers.inspector?.multiEditing) {
      const sources = inspectorSelection();
      if (!sources.length || !sources.every((s) => (s.type || 'sweep') === 'sweep')) return;
      controllers.inspector.stage((s) => ({
        ...s,
        profile: 'custom',
        section: structuredClone(section),
        width: section.properties.bounds.width,
        height: section.properties.bounds.height,
        material: suggestedProfileMaterial(
          section,
          s.material,
          controllers.materialUI.records,
          !s.material,
        ),
      }));
      return;
    }
    controllers.inspector?.finish();
    ui.libraryMode = true;
    const sources = inspectorSelection().filter((s) => (s.type || 'sweep') === 'sweep');
    const apply = (s) => ({
      ...s,
      profile: 'custom',
      section: structuredClone(section),
      width: section.properties.bounds.width,
      height: section.properties.bounds.height,
      material: suggestedProfileMaterial(
        section,
        s.material,
        controllers.materialUI.records,
        !s.material,
      ),
    });
    if (sources.length) {
      const batch = sources.map(apply),
        error = batch.map(validateSweep).find(Boolean);
      if (error) throw new Error(error);
      modelEditor.update(batch);
      for (const object of batch) {
        rememberSweep(object);
        rememberPlate(object);
      }
      setDrawing(false);
      if (ui.selected) fillForm(project.objects.find((s) => s.id === ui.selected));
      render();
    } else {
      startDrawing();
      ui.formSection = structuredClone(section);
      ui.draftMaterial.material = suggestedProfileMaterial(
        section,
        ui.draftMaterial.material,
        controllers.materialUI.records,
        ui.draftMaterialAutomatic,
      );
      $('profile').value = 'custom';
      updateForm();
      syncMaterialPanel();
      rememberSweep({ ...readForm(), ...ui.draftMaterial });
    }
    $('status').textContent = `${section.name} · version ${section.revision}`;
  }
  const sectionEditor = new SectionEditor(applyLibrarySection);
  controllers.profilePicker = new ProfilePicker($('profile-quick-picker'), {
    profiles: () => sectionEditor.profiles,
    apply: applyLibrarySection,
  });
  sectionEditor.dialog.addEventListener('close', () => updateForm());
  sectionEditor.libraryDialog.addEventListener('close', () => updateForm());
  $('section-library-open').onclick = () => {
    if (!controllers.inspector?.multiEditing) controllers.inspector?.finish();
    sectionEditor.open();
  };
  $('profile-source-library').onclick = () => {
    controllers.inspector?.finish();
    ui.libraryMode = true;
    updateForm();
  };
  $('profile-source-form').onclick = () => {
    ui.libraryMode = false;
    if ($('profile').value !== 'custom') {
      updateForm();
      return;
    }
    controllers.inspector?.finish();
    $('profile').value = 'rect';
    $('profile').dispatchEvent(new Event('input', { bubbles: true }));
    $('profile').dispatchEvent(new Event('change', { bubbles: true }));
  };
  controllers.materialUI = new MaterialUI($('material-panel'), {
    apply: (patch) => {
      if (controllers.inspector?.multiEditing) {
        controllers.inspector.stage((s) =>
          isPhysical(s) ? { ...s, ...structuredClone(patch) } : s,
        );
        return;
      }
      controllers.inspector?.finish();
      const targets = inspectorSelection().filter(isPhysical);
      if (targets.length) {
        modelEditor.update(targets.map((s) => ({ ...s, ...structuredClone(patch) })));
        targets.forEach((source) => {
          rememberSweep({ ...source, ...patch });
          rememberPlate({ ...source, ...patch });
        });
        render();
      } else {
        ui.draftMaterial = { ...ui.draftMaterial, ...structuredClone(patch) };
        if ('material' in patch) ui.draftMaterialAutomatic = false;
        syncMaterialPanel();
        if (tools.drawing && !tools.operation)
          rememberSweep({ ...readForm(), ...ui.draftMaterial });
        if (
          tools.operation?.mode === 'plateCreate' &&
          !tools.operation.cutTargets &&
          !tools.operation.lineCut
        )
          rememberPlate({
            type: 'plate',
            thickness: +$('plate-thickness').value,
            side: $('plate-side').value,
            contourOffset: +$('plate-contour-offset').value,
            ...ui.draftMaterial,
          });
      }
    },
  });
  function syncMaterialPanel() {
    const selectedObjects = (
      controllers.inspector?.editingObjects() || inspectorSelection()
    ).filter(isPhysical);
    const creating =
      tools.drawing &&
      !ui.selectedIds.size &&
      (!tools.operation ||
        tools.operation.mode === 'itemCreate' ||
        (tools.operation.mode === 'plateCreate' && !tools.operation.cutTargets?.length));
    const section = selectedObjects.length
      ? selectedObjects.every(
          (s) =>
            s.profile === 'custom' && s.section?.standard === selectedObjects[0].section?.standard,
        )
        ? selectedObjects[0].section
        : null
      : creating && !tools.operation && $('profile').value === 'custom'
        ? ui.formSection
        : null;
    controllers.materialUI?.sync(
      selectedObjects.length ? selectedObjects : [ui.draftMaterial],
      !!selectedObjects.length || creating,
      !!tools.operation && !['plateCreate', 'itemCreate'].includes(tools.operation.mode),
      profileMaterialSuggestions(section, controllers.materialUI?.records),
    );
  }

  controllers.sectionEditor = sectionEditor;
}
