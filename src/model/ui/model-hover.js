import { isPhysical } from '../../model-object.js';

export function installModelHover({
  actions,
  controllers,
  objectFeedback,
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
    if (e.buttons || ui.marquee || (tools.drawing && !fit) || (tools.operation && !fit)) {
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
      (!fit || (source.type ?? 'sweep') === 'sweep');
    objectFeedback.setHover(
      eligible ? (!tools.operation && !tools.drawing ? [...userSelection([id])] : [id]) : [],
      'canvas',
      fit ? objectFeedback.referenceCount : null,
    );
    if (!tools.operation && !tools.drawing)
      renderer.domElement.style.cursor = eligible || reference ? 'pointer' : 'default';
  }
}
