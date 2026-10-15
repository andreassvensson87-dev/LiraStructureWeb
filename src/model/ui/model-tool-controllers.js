import { createWorkAreaController } from './work-area-controller.js';
import { createWorkAreaDisplay } from '../work-area-display.js';
import { createLinearTransformController } from './linear-transform-controller.js';
import { createPlaneTransformController } from './plane-transform-controller.js';
import { workPlaneFromPoints } from '../../work-plane.js';
import { WorkPlaneGuide } from '../work-plane-guide.js';
import {
  createToolHUDStack,
  createLinearHUD,
  createPlaneHUD,
  createCornerHUD,
} from '../../ui/tool-hud.js';
import { createSelectionController } from './selection-controller.js';
import { createRotationController } from './rotation-controller.js';
import { createPlateController } from './plate-controller.js';
import { createHelperController } from './helper-controller.js';

export function installModelTools({
  host,
  renderer,
  camera,
  project,
  ui,
  navigation,
  actions,
  modelEditor,
  guide,
  scene,
  tools,
  objects,
  controllers,
  frameGate,
  renderState,
  insertionPoints,
}) {
  const setDrawing = (...args) => actions.setDrawing(...args);
  const ray = (...args) => actions.ray(...args);
  const selectModelOrReference = (...args) => actions.selectModelOrReference(...args);
  const selectionHit = (...args) => actions.selectionHit(...args);
  const setSelection = (...args) => actions.setSelection(...args);
  const userSelection = (...args) => actions.userSelection(...args);
  const isVisible = (...args) => actions.isVisible(...args);
  const clearPreview = (...args) => actions.clearPreview(...args);
  const validateSweep = (...args) => actions.validateSweep(...args);
  const previewModelBatch = (...args) => actions.previewModelBatch(...args);
  const fillForm = (...args) => actions.fillForm(...args);
  const checkpoint = (...args) => actions.checkpoint(...args);
  const render = (...args) => actions.render(...args);
  const syncLocks = (...args) => actions.syncLocks(...args);
  const syncOperationUI = (...args) => actions.syncOperationUI(...args);
  const remove = (...args) => actions.remove(...args);
  const select = (...args) => actions.select(...args);
  const syncMaterialPanel = (...args) => actions.syncMaterialPanel(...args);
  const resetLength = (...args) => actions.resetLength(...args);
  const plateLengthActive = (...args) => actions.plateLengthActive(...args);
  const dispose = (...args) => actions.dispose(...args);
  const rememberPlate = (...args) => actions.rememberPlate(...args);
  const restorePlateDefaults = (...args) => actions.restorePlateDefaults(...args);
  const save = (...args) => actions.save(...args);
  const changeVisibility = (...args) => actions.changeVisibility(...args);
  const { cancelBox, beginBox } = createSelectionController({
    host,
    renderer,
    camera,
    project,
    ui,
    getControls: () => navigation.controls,
    setDrawing,
    ray,
    select: selectModelOrReference,
    getWorkArea: () => controllers.workAreaUI?.bounds() || null,
    getGrip: (target) => insertionPoints.gripAtTarget(target),
    gripsInRect: (a, b) => insertionPoints.refsInRect(a, b),
    selectGrips: (refs, options) => controllers.pointUI?.select(refs, options),
    selectionHit,
    setSelection: (ids) => setSelection(userSelection(ids)),
    isVisible,
  });
  Object.assign(actions, { cancelBox, beginBox });
  const { rotationHandle, rotationLine, showRotationLine, pickRotationAxis } =
    createRotationController({
      modelEditor,
      guide,
      host,
      camera,
      scene,
      renderer,
      project,
      tools,
      ui,
      objects,
      getControls: () => navigation.controls,
      isVisible,
      clearPreview,
      validateSweep,
      previewModelBatch,
      fillForm,
      setDrawing,
      checkpoint,
      render,
      syncLocks,
      syncOperationUI,
      getReference: () => controllers.referenceModels?.transformSelection(),
      previewReference: (id, placement) => {
        controllers.referenceModels.previewPlacement(id, placement);
        frameGate.invalidate();
      },
      commitReference: (id, placement) => controllers.referenceModels.setPlacement(id, placement),
    });
  Object.assign(actions, { showRotationLine, pickRotationAxis });
  controllers.rotationHandle = rotationHandle;
  controllers.rotationLine = rotationLine;
  const {
    updatePlateNormal,
    clearPlateOutline,
    syncPlateUI,
    fillPlate,
    startPlate,
    previewPlatePoint,
    pickPlatePoint,
    finishPlate,
    changePlateVertex,
    startPlateVertex,
  } = createPlateController({
    modelEditor,
    project,
    tools,
    ui,
    scene,
    objects,
    host,
    camera,
    renderer,
    guide,
    remove,
    getInspector: () => controllers.inspector,
    select,
    setDrawing,
    syncOperationUI,
    syncMaterialPanel,
    syncLocks,
    resetLength,
    plateLengthActive,
    validateSweep,
    checkpoint,
    render,
    previewModelBatch,
    clearPreview,
    dispose,
    remember: rememberPlate,
    restoreDefaults: restorePlateDefaults,
    applyCreationAttributes: (object) => actions.applyCreationAttributes?.(object) || object,
    syncPropertyUI: () => {
      controllers.sweepPropertyUI?.sync();
      controllers.platePropertyUI?.sync();
    },
  });
  actions.changeInsertionVertex = (index, remove) => {
    const source = project.objects.find((o) => o.id === ui.selected);
    if (source?.type === 'polysweep') controllers.polysweepUI.editPoint(index, remove);
    else changePlateVertex(index, remove);
  };
  actions.canRemoveInsertion = () => {
    const source = project.objects.find((o) => o.id === ui.selected);
    return source?.type === 'polysweep'
      ? source.points.length > 2
      : source?.type === 'plate'
        ? source.polygon.length > 3
        : null;
  };
  actions.activateInsertion = (kind, event) => {
    if (controllers.pointUI?.activate(kind, event)) return;
    if (typeof kind === 'object') actions.startGrip(kind);
    else if (String(kind).startsWith('edge:'))
      actions.changeInsertionVertex(Number(kind.split(':')[1]), false);
    else if (typeof kind === 'number') startPlateVertex(kind);
    else actions.startTransform(kind);
  };
  Object.assign(actions, {
    updatePlateNormal,
    clearPlateOutline,
    syncPlateUI,
    fillPlate,
    startPlate,
    previewPlatePoint,
    pickPlatePoint,
    finishPlate,
    changePlateVertex,
    startPlateVertex,
  });
  const helperController = createHelperController({
    project,
    ui,
    tools,
    select,
    setDrawing,
    syncOperationUI,
    save,
    render,
    changeVisibility,
    renderer,
  });
  controllers.helperController = helperController;
  const hudStack = createToolHUDStack(host);
  controllers.workAreaUI = createWorkAreaController({
    project,
    tools,
    ui,
    renderState,
    setDrawing,
    createHUD: (callbacks) => createCornerHUD(hudStack, callbacks),
    display: createWorkAreaDisplay(scene, renderer),
    referenceVisibility: (bounds) => controllers.referenceModels?.setWorkArea(bounds),
    referenceBounds: () => controllers.referenceModels?.bounds(),
    commit: (next) => actions.setWorkArea(next),
    render,
    fit: () => actions.fit(),
    status: (text) => {
      document.getElementById('status').textContent = text;
    },
    focus: () => renderer.domElement.focus({ preventScroll: true }),
  });
  controllers.linearUI = createLinearTransformController({
    tools,
    placement: {
      startTransform: (...args) => actions.startTransform(...args),
      commitPoint: (...args) => actions.commitPoint(...args),
      previewLinear: (...args) => actions.previewLinear(...args),
      clearTransformPreview: () => actions.clearTransformPreview(),
    },
    setDrawing,
    createHUD: (draft, callbacks) => createLinearHUD(hudStack, draft, callbacks),
    status: (text) => {
      document.getElementById('status').textContent = text;
    },
    focus: () => renderer.domElement.focus({ preventScroll: true }),
  });
  const planeGuides = [new WorkPlaneGuide(scene), new WorkPlaneGuide(scene)];
  controllers.planeTransformGuides = planeGuides;
  controllers.planeTransformUI = createPlaneTransformController({
    tools,
    placement: {
      startTransform: (...args) => actions.startTransform(...args),
      commitPoint: (...args) => actions.commitPoint(...args),
      previewPlane: (...args) => actions.previewPlane(...args),
      clearTransformPreview: () => actions.clearTransformPreview(),
    },
    setDrawing,
    createHUD: (draft, callbacks) => createPlaneHUD(hudStack, draft, callbacks),
    guides: {
      clear: () => {
        planeGuides.forEach((guide) => guide.clear());
        frameGate.invalidate();
      },
      show: (start, target) => {
        [start, target].forEach((points, i) => {
          let frame = null;
          if (points.length === 3) {
            try {
              frame = workPlaneFromPoints(points);
            } catch {}
          }
          planeGuides[i].show(points, frame);
        });
        frameGate.invalidate();
      },
    },
    status: (text) => {
      document.getElementById('status').textContent = text;
    },
    focus: () => renderer.domElement.focus({ preventScroll: true }),
  });
}
