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
    syncPropertyUI: () => {
      controllers.sweepPropertyUI?.sync();
      controllers.platePropertyUI?.sync();
    },
  });
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
}
