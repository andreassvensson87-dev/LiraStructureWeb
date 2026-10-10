import { updateFastenerDetail } from '../fastener-detail.js';
import { updateDisplayDetail } from '../display-detail.js';
import { platePoint } from '../../plate.js';

export function installModelFrameLoop({
  actions,
  camera,
  connectionMarkers,
  controllers,
  frameGate,
  grid,
  host,
  insertionPoints,
  instanceBatches,
  interactionTimings,
  navigation,
  objectFeedback,
  objects,
  pointerQueue,
  project,
  renderer,
  scene,
  tools,
  ui,
  viewWidget,
}) {
  const isVisible = (...args) => actions.isVisible(...args);
  const render = (...args) => actions.render(...args);
  const updateObjectHover = (...args) => actions.updateObjectHover(...args);
  const updatePlateNormal = (...args) => actions.updatePlateNormal(...args);
  const updatePointer = (...args) => actions.updatePointer(...args);
  const updateSnapOverlay = (...args) => actions.updateSnapOverlay(...args);
  for (const event of ['click', 'input', 'change', 'keydown', 'pointerup', 'pointercancel'])
    document.addEventListener(event, () => frameGate.invalidate(), { capture: true });
  host.addEventListener(
    'pointermove',
    () => {
      if (tools.drawing || tools.operation || ui.preview || controllers.rotationHandle.drag)
        frameGate.invalidate();
    },
    { capture: true },
  );
  host.addEventListener('pointerleave', () => frameGate.invalidate());
  new ResizeObserver(() => frameGate.invalidate()).observe(host);
  renderer.setAnimationLoop(() => {
    if (pointerQueue.pending) {
      const pointer = pointerQueue.pending;
      pointerQueue.pending = null;
      updateObjectHover(pointer);
      updatePointer(pointer);
    }
    if (!ui.marquee && !controllers.rotationHandle.drag) navigation.controls.update();
    // Project labels with the same camera transform used to render this frame.
    camera.updateMatrixWorld();
    if (!frameGate.consume(camera)) return;
    if (controllers.modelFilter?.filter.inView) {
      const previous = [...controllers.modelFilter.matches].join('|');
      controllers.modelFilter.sync(project);
      if ([...controllers.modelFilter.matches].join('|') !== previous) {
        ui.selectedIds = new Set([...ui.selectedIds].filter(isVisible));
        ui.selected = ui.selectedIds.size === 1 ? [...ui.selectedIds][0] : null;
        render();
      }
    }
    const frameStarted = performance.now();
    updateFastenerDetail(objects.children, camera, host.clientHeight, ui.selectedIds);
    updateDisplayDetail(objects.children, camera, host.clientHeight, ui.selectedIds);
    instanceBatches.sync(camera);
    objectFeedback.refresh();
    viewWidget.update();
    connectionMarkers.update(camera);
    grid.updateLabels(camera, host.clientWidth, host.clientHeight);
    const visibleGridIds = new Set(
      project.objects
        .filter((s) => s.type === 'gridline' && isVisible(s.id))
        .map((s) => s.gridPickId),
    );
    for (const label of grid.labels) if (!visibleGridIds.has(label.id)) label.el.hidden = true;
    insertionPoints.update(
      camera,
      host.clientWidth,
      host.clientHeight,
      (controllers.inspector?.session?.batch && !controllers.inspector.session.error
        ? project.objects.map(
            (s) => controllers.inspector.session.batch.find((b) => b.id === s.id) || s,
          )
        : tools.operation?.mode === 'rotate' && tools.operation.batch
          ? project.objects.map((s) => tools.operation.batch.find((b) => b.id === s.id) || s)
          : project.objects
      ).filter((s) => isVisible(s.id)),
      ui.selectedIds,
      tools.drawing,
      ui.previewSweep?.start ?? tools.first,
      ui.previewSweep?.end ?? tools.activeSnap?.point,
      tools.operation?.mode === 'plateCreate' && tools.operation.frame
        ? tools.operation.polygon.map((p) => platePoint(tools.operation, p))
        : tools.operation?.mode === 'workPlane'
          ? tools.operation.points
          : [],
    );
    updateSnapOverlay();
    controllers.rotationHandle.update();
    updatePlateNormal();
    interactionTimings.record('framePreparationMs', frameStarted);
    interactionTimings.measure('webglSubmissionMs', () => renderer.render(scene, camera));
    interactionTimings.frameSubmitted(project.objects.length);
    if (import.meta.env.DEV) {
      host.dataset.renderCalls = renderer.info.render.calls;
      host.dataset.renderMs = (performance.now() - frameStarted).toFixed(1);
    }
  });
}
