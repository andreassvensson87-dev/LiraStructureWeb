import { editablePlate, copyPlateProperties } from '../model/plate-properties.js';
import { editableSweep, copySweepProperties } from '../model/sweep-properties.js';
import { createObjectPropertyUI } from './object-property-ui.js';
import { objectInspectorSchemas } from './object-schemas.js';
import { validateObject, isPhysical, displayGeometry } from '../model-object.js';
import { applyObjectBatch } from '../model/tools/transform-tool.js';

export function installModelPropertyCopy({
  $,
  actions,
  controllers,
  frameGate,
  modelEditor,
  project,
  renderer,
  tools,
  ui,
}) {
  const highlightFitReferences = (...args) => actions.highlightFitReferences(...args);
  const inspectorSelection = (...args) => actions.inspectorSelection(...args);
  const rememberPlate = (...args) => actions.rememberPlate(...args);
  const rememberSweep = (...args) => actions.rememberSweep(...args);
  const render = (...args) => actions.render(...args);
  const setDrawing = (...args) => actions.setDrawing(...args);
  const setSelection = (...args) => actions.setSelection(...args);
  Object.assign(actions, { createPropertyCopyUI });
  function createPropertyCopyUI(family) {
    const plate = family === 'plate';
    const editable = plate ? editablePlate : editableSweep;
    const copyProperties = plate ? copyPlateProperties : copySweepProperties;
    const remember = plate ? rememberPlate : rememberSweep;
    const mode = plate ? 'plateProperties' : 'sweepProperties';
    const noun = plate ? 'plåt' : 'sweep';
    return createObjectPropertyUI({
      schema: objectInspectorSchemas[family],
      getState: () => ({
        selected: inspectorSelection(),
        multiEditing: controllers.inspector.multiEditing,
        operation: tools.operation,
        drawing: tools.drawing,
      }),
      start: (groups) => {
        controllers.inspector.finish();
        const source = project.objects.find((s) => s.id === ui.selected);
        if (!editable(source)) throw new Error(`Markera en ${noun} att kopiera från.`);
        setDrawing(false);
        tools.operation = {
          mode,
          source: structuredClone(source),
          groups,
          targetIds: [],
        };
        render({ selectionOnly: true });
        renderer.domElement.style.cursor = 'crosshair';
        renderer.domElement.focus({ preventScroll: true });
        $('status').textContent =
          'Kopiera egenskaper · Klicka på målobjekt, sedan Modifiera eller Enter';
      },
      toggle: (id) => {
        const operation = tools.operation;
        if (id === operation.source.id) throw new Error('Välj ett annat mål än källobjektet.');
        const ids = new Set(operation.targetIds);
        if (ids.has(id)) ids.delete(id);
        else ids.add(id);
        operation.targetIds = [...ids];
        frameGate.invalidate();
      },
      apply: (groups) => {
        const operation = tools.operation;
        if (operation?.mode !== mode || !operation.targetIds.length) return;
        if (!groups.length) throw new Error('Välj minst en egenskap.');
        const previous = new Map(project.objects.map((s) => [s.id, s]));
        const batch = operation.targetIds.map((id) =>
          copyProperties(operation.source, previous.get(id), groups),
        );
        const error = batch.map(validateObject).find(Boolean);
        if (error) throw new Error(error);
        const next = applyObjectBatch(project.objects, batch).objects;
        for (const object of next)
          if (isPhysical(object) && object !== previous.get(object.id))
            displayGeometry(object, next, 'exact').dispose();
        modelEditor.replace(next);
        const count = batch.length;
        remember(operation.source);
        setDrawing(false);
        setSelection(batch.map((s) => s.id));
        render();
        $('status').textContent =
          `Egenskaper kopierade till ${count} ${noun}${count === 1 ? '' : plate ? 'ar' : 's'} · Ångra återställer ändringen`;
      },
      cancel: () => {
        setDrawing(false);
        render({ selectionOnly: true });
      },
      highlight: highlightFitReferences,
    });
  }
  controllers.sweepPropertyUI = createPropertyCopyUI('sweep');
  controllers.platePropertyUI = createPropertyCopyUI('plate');
}
