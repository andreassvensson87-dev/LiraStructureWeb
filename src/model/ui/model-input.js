import { pointerCommand } from '../pointer-controller.js';
import { consumeNextPointSnap } from '../next-point-snap.js';
import { installModelPointer } from '../pointer-controller.js';
import { addToAssembly } from '../../project/assemblies.js';
import { isPhysical } from '../../model-object.js';
import { modelKeyboardCommand, modelCompletionCommand } from '../keyboard-command.js';
import { editableSweep } from '../sweep-properties.js';
import { stepSweepPlacement, quarterTurnSweep } from '../sweep-shortcuts.js';
import { platePoint } from '../../plate.js';

export function installModelInput({
  $,
  actions,
  controllers,
  frameGate,
  grid,
  objectFeedback,
  objects,
  pointerQueue,
  project,
  raycaster,
  renderState,
  renderer,
  snapMarker,
  tools,
  ui,
}) {
  const beginBox = (...args) => actions.beginBox(...args);
  const cancelBox = (...args) => actions.cancelBox(...args);
  const checkpoint = (...args) => actions.checkpoint(...args);
  const clearPreview = (...args) => actions.clearPreview(...args);
  const commitPoint = (...args) => actions.commitPoint(...args);
  const fillForm = (...args) => actions.fillForm(...args);
  const finishPlate = (...args) => actions.finishPlate(...args);
  const inspectorSelection = (...args) => actions.inspectorSelection(...args);
  const orbitAroundHit = (...args) => actions.orbitAroundHit(...args);
  const pickPlatePoint = (...args) => actions.pickPlatePoint(...args);
  const pickRotationAxis = (...args) => actions.pickRotationAxis(...args);
  const pickWorkPlane = (...args) => actions.pickWorkPlane(...args);
  const plateLengthActive = (...args) => actions.plateLengthActive(...args);
  const point = (...args) => actions.point(...args);
  const previewPlatePoint = (...args) => actions.previewPlatePoint(...args);
  const ray = (...args) => actions.ray(...args);
  const remove = (...args) => actions.remove(...args);
  const render = (...args) => actions.render(...args);
  const resetLength = (...args) => actions.resetLength(...args);
  const restore = (...args) => actions.restore(...args);
  const save = (...args) => actions.save(...args);
  const select = (...args) => actions.select(...args);
  const selectModelOrReference = (...args) => actions.selectModelOrReference(...args);
  const selectionHit = (...args) => actions.selectionHit(...args);
  const setDrawing = (...args) => actions.setDrawing(...args);
  const setSelection = (...args) => actions.setSelection(...args);
  const syncLocks = (...args) => actions.syncLocks(...args);
  const syncPlateUI = (...args) => actions.syncPlateUI(...args);
  const toggleLock = (...args) => actions.toggleLock(...args);
  const updateForm = (...args) => actions.updateForm(...args);
  const updateTypedLength = (...args) => actions.updateTypedLength(...args);
  const workPlanePrompt = (...args) => actions.workPlanePrompt(...args);
  const completionActions = {
    'finish-polysweep': () => controllers.polysweepUI.finish(),
    'finish-plate': () => finishPlate(),
    'finish-rotation': () => controllers.rotationHandle.form.requestSubmit(),
    'confirm-fastener-targets': () => controllers.fastenerUI.confirmTargets(),
    'confirm-work-area': () => controllers.workAreaUI.confirm(),
    'confirm-plane-transform': () => controllers.planeTransformUI.confirmActive(),
    'confirm-linear': () => controllers.linearUI.confirmActive(),
    'confirm-property-copy': () => controllers.propertyUI.confirm(),
    'confirm-fit': () => controllers.componentUI.confirm(),
  };
  function toolState() {
    return {
      propertyCopy: !!controllers.propertyUI?.active(),
      linear: !!tools.operation?.linearId,
      planeTransform: !!tools.operation?.planeId,
      mode: tools.operation?.mode,
      picking: tools.operation?.linearPicking || tools.operation?.picking,
      drawing: tools.drawing,
      hasStart: !!tools.first,
      boxMode: ui.boxMode,
      plateLength: plateLengthActive(),
      hasLength: !!$('draw-length').value.trim(),
    };
  }
  function cancelModelTool() {
    consumeNextPointSnap(tools);
    if (ui.marquee) {
      cancelBox();
      render({ selectionOnly: true });
      return;
    }
    if (tools.operation?.gripRefs && !tools.operation?.linearId) {
      setDrawing(false, { keepPoints: true });
      render({ selectionOnly: true });
      $('status').textContent = 'Förflyttning avbruten';
      return;
    }
    if (tools.operation?.mode === 'coordinatePoint') {
      controllers.coordinatePicker.cancel();
      return;
    }
    if (tools.operation?.mode === 'workArea') {
      controllers.workAreaUI.cancel();
      return;
    }
    if (tools.operation?.planeId) {
      controllers.planeTransformUI.cancel();
      return;
    }
    if (tools.operation?.linearId) {
      controllers.linearUI.cancel();
      return;
    }
    if (controllers.pointUI?.selected().length && !tools.operation) {
      controllers.pointUI.clear();
      render();
      return;
    }
    if (controllers.propertyUI?.active()) {
      controllers.propertyUI.cancel();
      return;
    }
    cancelBox();
    if (tools.operation?.mode === 'assemblyMain') $('status').textContent = 'Assembly avbruten';
    if (tools.operation?.mode === 'fit') $('status').textContent = 'Fit avbruten';
    if (tools.operation?.mode === 'workPlane')
      $('status').textContent = 'Val av arbetsplan avbrutet';
    controllers.modelContextMenu.close();
    select(null);
    return;
  }
  function modelToolMenuState() {
    const state = toolState();
    const completion = controllers.propertyUI?.active()
      ? 'confirm-property-copy'
      : modelCompletionCommand(state);
    const pointCommand = pointerCommand(state);
    const pointPicking =
      ![null, 'select', 'fit-reference', 'fastener-target', 'assembly-main'].includes(
        pointCommand,
      ) &&
      (!state.linear || state.picking) &&
      (!state.planeTransform || state.picking) &&
      (state.mode !== 'workArea' || !controllers.workAreaUI.canConfirm());
    const ready = {
      'confirm-property-copy': () => controllers.propertyUI.canConfirm(),
      'confirm-linear': () => controllers.linearUI.canConfirm(),
      'confirm-plane-transform': () => controllers.planeTransformUI.canConfirm(),
      'confirm-work-area': () => controllers.workAreaUI.canConfirm(),
      'finish-polysweep': () => controllers.polysweepUI.canConfirm(),
      'finish-plate': () => !$('plate-apply').disabled,
      'finish-rotation': () => !controllers.rotationHandle.error.textContent,
      'confirm-fit': () => controllers.componentUI.canConfirm(),

      'confirm-fastener-targets': () =>
        !controllers.fastenerUI.placeForm.querySelector('[type=submit]').disabled,
    };
    const target = tools.typedPoint || tools.activeSnap?.point;
    const pointReady =
      pointPicking &&
      !!tools.first &&
      !!target &&
      ![
        'plateCreate',
        'plateVertex',
        'polysweepCreate',
        'workPlane',
        'workArea',
        'coordinatePoint',
      ].includes(state.mode) &&
      (!!ui.preview || !!tools.operation?.referenceId) &&
      !$('draw-length-error').textContent;
    return {
      pointPicking,
      completion: completion || (pointReady ? 'confirm-point' : null),
      canConfirm: completion ? (ready[completion]?.() ?? true) : pointReady,
      target: target && [...target],
    };
  }
  Object.assign(actions, {
    cancelModelTool,
    modelToolMenuState,
    confirmModelTool: () => {
      const state = modelToolMenuState();
      if (!state.canConfirm) return;
      if (state.completion === 'confirm-property-copy') controllers.propertyUI.confirm();
      else if (state.completion === 'confirm-point') commitPoint(state.target);
      else completionActions[state.completion]?.();
    },
  });
  installModelPointer(renderer.domElement, {
    getState: toolState,
    consumePoint: () => {
      consumeNextPointSnap(tools);
      actions.updateSnapOverlay();
    },
    beginBox,
    orbit: orbitAroundHit,
    point,
    move: (e) => {
      if (controllers.modelContextMenu.isOpen()) return;
      pointerQueue.pending = { clientX: e.clientX, clientY: e.clientY, buttons: e.buttons };
      if (tools.drawing || tools.operation) frameGate.invalidate();
    },
    leave: () => {
      pointerQueue.pending = null;
      if (controllers.modelContextMenu.isOpen()) return;
      objectFeedback.setHover([], 'canvas');
      if (controllers.referenceModels?.setHoverSelection(null)) objectFeedback.invalidate();
      if (
        tools.operation?.linearId ||
        tools.operation?.planeId ||
        tools.operation?.mode === 'workArea' ||
        ['rotate', 'plateCreate', 'plateVertex', 'fit'].includes(tools.operation?.mode) ||
        ui.componentPreview ||
        $('draw-length').value.trim()
      )
        return;
      snapMarker.hidden = true;
      tools.activeSnap = null;
      grid.highlight([]);
      clearPreview();
    },
    actions: {
      ...completionActions,
      linear: (p) => controllers.linearUI.pickPoint(p),
      'plane-transform': (p) => controllers.planeTransformUI.pickPoint(p),
      'fit-reference': (e) => {
        objectFeedback.setHover([], 'canvas');
        if (controllers.referenceModels?.setHoverSelection(null)) objectFeedback.invalidate();
        ray(e);
        const hit = raycaster
          .intersectObjects(
            objects.children.filter(
              (o) =>
                o.visible &&
                (renderState.renderedById.get(o.userData.id)?.source?.type ?? 'sweep') === 'sweep',
            ),
            false,
          )
          .find((hit) => controllers.workAreaUI?.allowsPoint(hit.point.toArray()) ?? true);
        const source = hit && project.objects.find((s) => s.id === hit.object.userData.id);
        controllers.componentUI.pick(source, hit?.point.toArray());
      },
      'assembly-main': (e) => {
        ray(e);
        const mainId = selectionHit();
        try {
          if (!mainId) throw Error('Klicka på en fysisk huvuddel · Escape avbryter');
          const next = addToAssembly(project, tools.operation.secondaryIds, mainId);
          const assembly = next.assemblies.find((a) => a.mainId === mainId);
          checkpoint();
          Object.assign(project, next);
          setDrawing(false);
          setSelection(assembly.memberIds);
          render();
          $('status').textContent =
            `${assembly.mark} · ${assembly.memberIds.length} delar · Ångra återställer ändringen`;
        } catch (error) {
          $('status').textContent = `${error.message} · Välj huvuddel eller Escape för att avbryta`;
        }
      },
      'fastener-target': (e) => {
        ray(e);
        const id = selectionHit();
        const source = project.objects.find((s) => s.id === id);
        if (!source || !isPhysical(source) || source.type === 'fastener') return;
        const ids = new Set(tools.operation.targetIds);
        if (ids.has(id)) ids.delete(id);
        else ids.add(id);
        tools.operation.targetIds = [...ids];
        controllers.fastenerUI.setTargets(tools.operation.targetIds);
        render({ selectionOnly: true });
        $('status').textContent =
          `Skruvgrupp · ${ids.size} delar valda · Klicka fler, Enter/skrollklick bekräftar`;
        renderer.domElement.focus({ preventScroll: true });
      },
      helperpoint: (p) => save({ type: 'helperpoint', start: p }),
      workplane: pickWorkPlane,
      'coordinate-point': (p) => controllers.coordinatePicker.pickPoint(p),
      'work-area': (p) => controllers.workAreaUI.pickPoint(p),
      plate: (p) => pickPlatePoint(p),
      rotation: pickRotationAxis,
      'plate-length': () => {
        updateTypedLength();
        if (tools.typedPoint) {
          if (pickPlatePoint(tools.typedPoint, true) !== false) consumeNextPointSnap(tools);
          actions.updateSnapOverlay();
        }
      },
      length: () => {
        updateTypedLength();
        if (tools.typedPoint) commitPoint(tools.typedPoint);
      },
      select: (e) => {
        ray(e);
        selectModelOrReference(selectionHit(), e.shiftKey);
      },
      finish: commitPoint,
      start: (p) => {
        if (tools.operation?.mode === 'polysweepCreate') {
          return controllers.polysweepUI.pick(p);
        }
        tools.first = p;
        if (tools.operation?.mode === 'fastenerCreate') {
          tools.operation.frame = {
            ...(tools.operation.surfaceFrame || tools.operation.frame),
            origin: [...p],
          };
          delete tools.operation.surfaceFrame;
        }
        if (tools.operation?.gripPlane)
          tools.operation.frame = { ...tools.operation.gripPlane, origin: [...p] };
        if (!tools.operation) {
          ['sx', 'sy', 'sz'].forEach((k, i) => ($(k).value = p[i]));
          updateForm();
        }
        $('status').textContent =
          tools.operation?.mode === 'fastenerCreate'
            ? 'Skruvgrupp · Välj mönstrets X-riktning i placeringsplanet'
            : tools.operation
              ? 'Välj målpunkt eller ange avstånd'
              : 'Välj slutpunkt';
        syncLocks();
        $('draw-length-form').hidden = false;
        renderer.domElement.focus({ preventScroll: true });
      },
    },
  });
  window.addEventListener('keydown', (e) => {
    const command = modelKeyboardCommand(e, {
      propertyCopy: !!controllers.propertyUI?.active(),
      linear: !!tools.operation?.linearId,
      planeTransform: !!tools.operation?.planeId,
      editing:
        ['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName) ||
        document.activeElement.isContentEditable,
      settingsOpen: $('settings-dialog').open,
      modalOpen: !!document.querySelector('dialog:modal'),
      hasSelection: !!ui.selectedIds.size || !!controllers.referenceModels?.transformSelection(),
      hasEditableSweeps:
        inspectorSelection().length > 0 && inspectorSelection().every(editableSweep),
      mode: tools.operation?.mode,
      picking: tools.operation?.linearPicking || tools.operation?.picking,
      hasStart: !!tools.first,
      drawing: tools.drawing,
      plateLength: plateLengthActive(),
    });
    if (!command) return;
    e.preventDefault();
    if (completionActions[command]) {
      completionActions[command]();
      return;
    }
    switch (command) {
      case 'sweep-placement':
      case 'sweep-profile-rotation':
        if (
          controllers.inspector.stage((s) =>
            command === 'sweep-placement' ? stepSweepPlacement(s, e.key) : quarterTurnSweep(s),
          )
        ) {
          controllers.inspector.finish();
          if (!controllers.inspector.multiEditing && inspectorSelection().length === 1)
            fillForm(inspectorSelection()[0]);
        }
        break;
      case 'remove-plane-transform-point':
        controllers.planeTransformUI.removePoint();
        break;
      case 'move':
      case 'copy':
      case 'rotate':
        $(command).click();
        break;
      case 'cancel':
        cancelModelTool();
        break;
      case 'remove-workplane-point':
        tools.operation.points.pop();
        controllers.workPlaneGuide.show(tools.operation.points);
        $('status').textContent = workPlanePrompt();
        break;
      case 'length':
        $('draw-length').value = e.key;
        $('draw-length').focus({ preventScroll: true });
        updateTypedLength();
        break;
      case 'remove-polysweep-point':
        controllers.polysweepUI.removePoint();
        break;
      case 'axis':
        toggleLock(e.key.toUpperCase());
        break;
      case 'remove-plate-point':
        tools.operation.polygon.pop();
        resetLength();
        tools.operation.sidePicked = false;
        tools.first = tools.operation.polygon.length
          ? platePoint(tools.operation, tools.operation.polygon.at(-1))
          : null;
        previewPlatePoint(null);
        syncPlateUI();
        break;
      case 'angle':
        controllers.rotationHandle.input.value = e.key;
        controllers.rotationHandle.input.focus({ preventScroll: true });
        controllers.rotationHandle.input.dispatchEvent(new Event('input'));
        break;
      case 'undo':
      case 'redo':
        restore(command);
        break;
      case 'delete':
        remove();
        break;
    }
  });
}
