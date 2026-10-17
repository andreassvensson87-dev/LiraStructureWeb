import { levelElevation } from '../levels.js';
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
  let placementReturn = null;
  Object.assign(actions, { commitFastener });
  controllers.fastenerUI = new FastenerUI({
    getObjects: () => project.objects,
    getPartMark: (id) => project.parts.assignments[id]?.mark || '',
    getWorkPlane: () =>
      structuredClone(
        tools.temporaryPlane || {
          origin: [0, 0, levelElevation(project.levels)],
          u: [1, 0, 0],
          v: [0, 1, 0],
        },
      ),
    getSelection: () =>
      [...ui.selectedIds].map((id) => project.objects.find((s) => s.id === id)).filter(Boolean),
    selectSource: (id) => {
      const returning = id && tools.operation?.mode === 'fastenerTargets';
      setSelection(id ? [id] : []);
      if (returning) $('status').textContent = 'Skruvgrupp · Tillämpa bekräftar ändringarna';
    },
    getOperation: () => tools.operation,
    previewPlacement: (draft) => {
      clearPreview();
      if (!draft) return;
      ui.preview = previewModelBatch(Array.isArray(draft) ? draft : [draft]);
      scene.add(ui.preview);
    },
    showInspector: () => controllers.inspector.show('properties'),
    beginTargets: (targetIds) => {
      placementReturn =
        tools.operation?.mode === 'fastenerCreate'
          ? {
              first: tools.first && [...tools.first],
              frame: structuredClone(tools.operation.frame),
              previewPoints: tools.operation.previewPoints,
            }
          : null;
      select(null);
      setDrawing(true);
      tools.operation = { mode: 'fastenerTargets', targetIds };
      render();
      controllers.inspector.show('properties');
      $('status').textContent =
        'Skruvgrupp · Klicka på delar, Enter/skrollklick bekräftar, Escape avbryter';
      renderer.domElement.focus({ preventScroll: true });
    },
    targetsChanged: (targetIds) => {
      if (tools.operation?.mode !== 'fastenerTargets') return;
      tools.operation.targetIds = targetIds;
      render({ selectionOnly: true });
    },
    finish: () => {
      controllers.inspector?.finish();
      setDrawing(false);
    },
    beginPlacement: (draft) => {
      const resume = placementReturn;
      placementReturn = null;
      select(null);
      setDrawing(true);
      tools.operation = {
        mode: 'fastenerCreate',
        draft,
        frame: resume?.frame || structuredClone(draft.layout.frame),
        ...(resume?.previewPoints ? { previewPoints: resume.previewPoints } : {}),
      };
      if (resume?.first) tools.first = resume.first;
      syncOperationUI();
      controllers.fastenerUI.sync([], tools.operation);
      controllers.inspector.show('properties');
      if (resume?.previewPoints) controllers.fastenerUI.previewRange();
      const label = draft.group ? 'Skruvgrupp' : 'Skruv';
      $('status').textContent = resume?.first
        ? `${label} · Välj X-riktning i arbetsplanet`
        : `${label} · Välj origo, därefter X-riktning i arbetsplanet`;
      renderer.domElement.focus({ preventScroll: true });
    },
    commit: commitFastener,
  });
  function commitFastener(draft) {
    if (!draft.id) draft = actions.applyCreationAttributes?.(draft) || draft;
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
                name: s.name || `${s.spec.name} · ${s.group.row + 1}:${s.group.column + 1}`,
              },
        );
      }
      const next = updateAutomaticJoints(
        project.objects,
        replaceFastenerGroup(project.objects, identified),
      );
      modelEditor.replace(next);
      setSelection(identified.map((s) => s.id));
      $('status').textContent =
        `Skruvgrupp sparad · ${identified.length} ${identified.length === 1 ? 'skruv' : 'skruvar'} med kopplade hål`;
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
        name: draft.name || draft.spec.name,
      };
      modelEditor.add([draft]);
    }
    setSelection([draft.id]);
    $('status').textContent = 'Skruv och hål sparade';
  }
}
