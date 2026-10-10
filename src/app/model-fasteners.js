import { FastenerUI } from '../fasteners/ui.js';
import { fastenerGroupBatch, replaceFastenerGroup } from '../fasteners/groups.js';
import { nextIdentity } from '../object-identity.js';
import { updateAutomaticJoints } from '../fasteners/update-joints.js';
import { applyObjectBatch } from '../model/tools/transform-tool.js';

export function installModelFasteners({
  $,
  actions,
  controllers,
  interactionTimings,
  modelEditor,
  project,
  renderer,
  scene,
  tools,
  ui,
}) {
  const clearPreview = (...args) => actions.clearPreview(...args);
  const previewModelBatch = (...args) => actions.previewModelBatch(...args);
  const render = (...args) => actions.render(...args);
  const select = (...args) => actions.select(...args);
  const setDrawing = (...args) => actions.setDrawing(...args);
  const setSelection = (...args) => actions.setSelection(...args);
  const syncOperationUI = (...args) => actions.syncOperationUI(...args);
  const validateSweep = (...args) => actions.validateSweep(...args);
  Object.assign(actions, { commitFastener });
  controllers.fastenerUI = new FastenerUI({
    getObjects: () => project.objects,
    getSelection: () => project.objects.filter((s) => ui.selectedIds.has(s.id)),
    selectSource: (id) => setSelection(id ? [id] : []),
    getOperation: () => tools.operation,
    previewPlacement: (draft) => {
      clearPreview();
      if (!draft) return;
      ui.preview = previewModelBatch(Array.isArray(draft) ? draft : [draft]);
      scene.add(ui.preview);
    },
    showInspector: () => controllers.inspector.show('properties'),
    beginTargets: (targetIds, group = false) => {
      select(null);
      setDrawing(true);
      tools.operation = { mode: 'fastenerTargets', targetIds };
      render();
      controllers.inspector.show('properties');
      $('status').textContent =
        `${group ? 'Skruvgrupp' : 'Skruv'} · Klicka på delar, Enter bekräftar, Escape avbryter`;
      renderer.domElement.focus({ preventScroll: true });
    },
    finish: () => {
      controllers.inspector?.finish();
      setDrawing(false);
    },
    beginPlacement: (draft) => {
      select(null);
      setDrawing(true);
      tools.operation = { mode: 'fastenerCreate', draft };
      syncOperationUI();
      controllers.fastenerUI.sync([], tools.operation);
      controllers.inspector.show('properties');
      const label = draft.group ? 'Skruvgrupp' : 'Skruv';
      $('status').textContent =
        draft.placementMode === 'range'
          ? `${label} · Välj första insättningspunkten, därefter riktning`
          : `${label} · Välj punkt under huvud, därefter riktning`;
      renderer.domElement.focus({ preventScroll: true });
    },
    commit: commitFastener,
  });
  function commitFastener(draft) {
    if (draft.group) {
      const batch = fastenerGroupBatch(draft, project.objects);
      const known = new Set(project.objects.map((s) => s.id));
      const identified = [];
      for (const s of batch) {
        identified.push(
          known.has(s.id)
            ? s
            : {
                ...s,
                ...nextIdentity(s, [...project.objects, ...identified]),
                name: `${s.spec.name} · ${s.group.row + 1}:${s.group.column + 1}`,
              },
        );
      }
      const next = updateAutomaticJoints(
        project.objects,
        replaceFastenerGroup(project.objects, identified),
      );
      modelEditor.replace(next);
      setSelection(identified.map((s) => s.id));
      $('status').textContent = `Skruvgrupp sparad · ${identified.length} skruvar med kopplade hål`;
      return;
    }
    const error = interactionTimings.measure('validationMs', () => validateSweep(draft));
    if (error) throw new Error(error);
    const updated = interactionTimings.measure('transactionMs', () =>
      draft.id ? applyObjectBatch(project.objects, [draft]).objects : null,
    );
    if (draft.id) modelEditor.replace(updated);
    else {
      draft = {
        ...draft,
        ...nextIdentity(draft, project.objects),
        id: crypto.randomUUID(),
        name: draft.spec.name,
      };
      modelEditor.add([draft]);
    }
    setSelection([draft.id]);
    $('status').textContent = 'Skruv och hål sparade';
  }
}
