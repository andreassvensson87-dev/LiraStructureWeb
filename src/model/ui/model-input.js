import { installModelPointer } from '../pointer-controller.js';
import { addToAssembly } from '../../project/assemblies.js';
import { isPhysical } from '../../model-object.js';
import { modelKeyboardCommand } from '../keyboard-command.js';
import { editableSweep } from '../sweep-properties.js';
import { stepSweepPlacement, quarterTurnSweep } from '../sweep-shortcuts.js';
import { platePoint } from '../../plate.js';

export function installModelInput({
  $,
  actions,
  controllers,
  frameGate,
  grid,
  guide,
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
  installModelPointer(renderer.domElement, {
    getState: () => ({
      mode: tools.operation?.mode,
      picking: tools.operation?.picking,
      drawing: tools.drawing,
      hasStart: !!tools.first,
      boxMode: ui.boxMode,
      plateLength: plateLengthActive(),
      hasLength: !!$('draw-length').value.trim(),
    }),
    beginBox,
    orbit: orbitAroundHit,
    point,
    move: (e) => {
      pointerQueue.pending = { clientX: e.clientX, clientY: e.clientY, buttons: e.buttons };
      if (tools.drawing || tools.operation) frameGate.invalidate();
    },
    leave: () => {
      pointerQueue.pending = null;
      objectFeedback.setHover([], 'canvas');
      if (
        ['rotate', 'plateCreate', 'plateVertex', 'fit'].includes(tools.operation?.mode) ||
        ui.componentPreview ||
        $('draw-length').value.trim()
      )
        return;
      snapMarker.hidden = true;
      tools.activeSnap = null;
      grid.highlight([]);
      guide.visible = false;
      clearPreview();
    },
    actions: {
      'component-property-target': (e) => {
        ray(e);
        controllers.componentUI.pickCopy(project.objects.find((s) => s.id === selectionHit()));
      },
      'fit-reference': (e) => {
        objectFeedback.setHover([], 'canvas');
        ray(e);
        const hit = raycaster.intersectObjects(
          objects.children.filter(
            (o) =>
              o.visible &&
              (renderState.renderedById.get(o.userData.id)?.source?.type ?? 'sweep') === 'sweep',
          ),
          false,
        )[0];
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
      'plate-property-target': (e) => {
        ray(e);
        controllers.platePropertyUI.pick(project.objects.find((s) => s.id === selectionHit()));
      },
      'sweep-property-target': (e) => {
        ray(e);
        controllers.sweepPropertyUI.pick(project.objects.find((s) => s.id === selectionHit()));
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
          `${controllers.fastenerUI.groupEditor.enabled() ? 'Skruvgrupp' : 'Skruv'} · ${ids.size} delar valda · Klicka fler, Enter bekräftar`;
        renderer.domElement.focus({ preventScroll: true });
      },
      helperpoint: (p) => save({ type: 'helperpoint', start: p }),
      workplane: pickWorkPlane,
      plate: (p) => pickPlatePoint(p),
      rotation: pickRotationAxis,
      'plate-length': () => {
        updateTypedLength();
        if (tools.typedPoint) pickPlatePoint(tools.typedPoint, true);
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
        tools.first = p;
        if (!tools.operation) {
          ['sx', 'sy', 'sz'].forEach((k, i) => ($(k).value = p[i]));
          updateForm();
        }
        $('status').textContent = tools.operation
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
      editing:
        ['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName) ||
        document.activeElement.isContentEditable,
      settingsOpen: $('settings-dialog').open,
      modalOpen: !!document.querySelector('dialog:modal'),
      hasSelection: !!ui.selectedIds.size || !!controllers.referenceModels?.transformSelection(),
      hasEditableSweeps:
        inspectorSelection().length > 0 && inspectorSelection().every(editableSweep),
      mode: tools.operation?.mode,
      picking: tools.operation?.picking,
      hasStart: !!tools.first,
      drawing: tools.drawing,
      plateLength: plateLengthActive(),
    });
    if (!command) return;
    e.preventDefault();
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
      case 'confirm-component-properties':
        controllers.componentUI.confirmCopy();
        break;
      case 'move':
      case 'copy':
      case 'rotate':
        $(command).click();
        break;
      case 'confirm-plate-properties':
        controllers.platePropertyUI.confirm();
        break;
      case 'confirm-sweep-properties':
        controllers.sweepPropertyUI.confirm();
        break;
      case 'confirm-fit':
        controllers.componentUI.confirm();
        break;
      case 'confirm-fastener-targets':
        controllers.fastenerUI.confirmTargets();
        break;
      case 'cancel':
        cancelBox();
        if (tools.operation?.mode === 'assemblyMain') $('status').textContent = 'Assembly avbruten';
        if (tools.operation?.mode === 'fit') $('status').textContent = 'Fit avbruten';
        if (
          ['sweepProperties', 'plateProperties', 'componentProperties'].includes(
            tools.operation?.mode,
          )
        )
          $('status').textContent = 'Egenskapskopiering avbruten';
        controllers.assemblyMenu.hidden = true;
        select(null);
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
      case 'finish-plate':
        finishPlate();
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
      case 'finish-rotation':
        controllers.rotationHandle.form.requestSubmit();
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
