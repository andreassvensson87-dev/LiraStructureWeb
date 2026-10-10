import { isPhysical } from '../../model-object.js';
import { editablePlate } from '../plate-properties.js';
import { editableSweep } from '../sweep-properties.js';

export function installModelHover({
  actions,
  camera,
  objectFeedback,
  objects,
  project,
  raycaster,
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
      return;
    }
    ray(e);
    const previewHit =
      ui.componentPreview && ui.preview
        ? raycaster.intersectObjects(
            [...objects.children, ...ui.preview.children].filter(
              (o) =>
                o.visible &&
                !o.userData.cut &&
                (camera.layers.test(o.layers) || o.userData.instanced),
            ),
            false,
          )[0]
        : null;
    const id = previewHit?.object.userData.id ?? selectionHit();
    const source = objectFeedback.sources.get(id) || renderState.renderedById.get(id)?.source;
    const eligible =
      isPhysical(source) &&
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
      renderer.domElement.style.cursor = eligible ? 'pointer' : 'default';
  }
}
