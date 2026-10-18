import { isPhysical } from '../../model-object.js';
import { editablePlate } from '../plate-properties.js';
import { editableSweep } from '../sweep-properties.js';

export function installModelHover({
  actions,
  controllers,
  objectFeedback,
  project,
  renderState,
  renderer,
  tools,
  ui,
}) {
  const ray = (...args) => actions.ray(...args);
  const selectionHit = (...args) => actions.selectionHit(...args);
  const userSelection = (...args) => actions.userSelection(...args);
  Object.assign(actions, { highlightFitReferences, hoverInspectorReference, updateObjectHover });
  function highlightFitReferences(ids) {
    objectFeedback.setReferences(ids);
  }
  function hoverInspectorReference(id) {
    objectFeedback.setHover(id ? [id] : [], 'inspector');
  }
  function updateObjectHover(e) {
    const fit = tools.operation?.mode === 'fit';
    const propertyCopy = ['sweepProperties', 'plateProperties', 'componentProperties'].includes(
      tools.operation?.mode,
    );
    if (
      e.buttons ||
      ui.marquee ||
      (tools.drawing && !fit) ||
      (tools.operation && !fit && !propertyCopy)
    ) {
      objectFeedback.setHover([], 'canvas');
      if (controllers.referenceModels?.setHoverSelection(null)) objectFeedback.invalidate();
      return;
    }
    ray(e);
    const id = selectionHit(ui.componentPreview && ui.preview ? ui.preview.children : []);
    const reference =
      !id && !tools.operation && !tools.drawing ? actions.referenceSelectionHit?.() : null;
    if (controllers.referenceModels?.setHoverSelection(reference)) objectFeedback.invalidate();
    const source = objectFeedback.sources.get(id) || renderState.renderedById.get(id)?.source;
    const eligible =
      (isPhysical(source) || source?.type === 'fastener') &&
      (!fit || (source.type ?? 'sweep') === 'sweep') &&
      (!propertyCopy ||
        (tools.operation.mode === 'componentProperties'
          ? project.objects.find((s) => s.id === source?.generatedBy)?.kind === tools.operation.kind
          : tools.operation.mode === 'plateProperties'
            ? editablePlate(source)
            : editableSweep(source)));
    objectFeedback.setHover(
      eligible ? (!tools.operation && !tools.drawing ? [...userSelection([id])] : [id]) : [],
      'canvas',
      fit ? objectFeedback.referenceCount : null,
    );
    if (!tools.operation && !tools.drawing)
      renderer.domElement.style.cursor = eligible || reference ? 'pointer' : 'default';
  }
}
