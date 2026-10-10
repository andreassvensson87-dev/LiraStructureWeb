import { isHelper } from '../../model-object.js';

export function createModelVisibility({ project, ui, renderState, controllers }) {
  const hiddenObjects = new Set();
  const baseVisible = (id) =>
    !hiddenObjects.has(id) &&
    (ui.showHelpers ||
      (renderState.renderedById.get(id)?.source ?? project.objects.find((s) => s.id === id))
        ?.type === 'gridline' ||
      !isHelper(
        renderState.renderedById.get(id)?.source ?? project.objects.find((s) => s.id === id),
      ));
  const isVisible = (id) => baseVisible(id) && (controllers.modelFilter?.allows(id) ?? true);

  return { hiddenObjects, baseVisible, isVisible };
}
