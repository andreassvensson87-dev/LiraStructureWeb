import '../ui/workspace.css';
import '../ui/editor.css';
import '../ui/dialog.css';
import '../ui/inspector.css';
import '../ui/library.css';
import { installModelSweepForm } from '../model/ui/model-sweep-form-controller.js';
import { installModelTools } from '../model/ui/model-tool-controllers.js';
import { installModelItems } from './model-items.js';
import { installModelToolbox } from '../model/ui/model-toolbox-controller.js';
import { createModelVisibility } from '../model/ui/model-visibility.js';
import { createModelPicking } from '../model/ui/model-picking.js';
import { createModelPreview } from '../model/ui/model-preview.js';
import { createPlacementController } from '../model/ui/placement-controller.js';
import { createSnapOverlay } from '../model/ui/snap-overlay.js';
import { createModelEditor } from '../app/model-editor.js';

import { ObjectFeedback } from '../model/object-feedback.js';
import { createConnectionMarkers } from '../components/markers.js';

import { createWorkplaneController } from '../model/ui/workplane-controller.js';

import { createModelEditorState } from '../model/editor-state.js';

import { createToolSession } from '../model/tool-session.js';

import { InstanceBatches } from '../model/instance-batches.js';

import { FrameGate } from '../model/frame-gate.js';

import { ProjectHistory } from '../project/project-history.js';

import { levelElevation } from '../levels.js';

import * as THREE from 'three';
import { createModelViewport } from '../model/viewport.js';
import { InsertionPoints } from '../insertion-points.js';
import { GridLines } from '../grid-lines.js';

import { installModelRenderer } from '../model/ui/model-renderer.js';
import { installModelSession } from '../model/ui/model-session.js';
import { installModelViewControls } from '../model/ui/model-view-controls.js';
import { installModelFrameLoop } from '../model/ui/model-frame-loop.js';
import { installModelFasteners } from './model-fasteners.js';
import { installModelContextMenu } from '../model/ui/model-context-menu.js';
import { installModelInput } from '../model/ui/model-input.js';
import { installWorkspaceSettings } from './workspace-settings.js';
import { installModelAttributes } from '../inspector/model-attributes-controller.js';
import { installModelLibraries } from '../inspector/model-library-controller.js';
import { installModelIdentity } from '../inspector/model-identity-controller.js';
import { installModelBrowser } from '../model/ui/model-browser-controller.js';
import { installWorkspaceLevels } from './workspace-levels.js';
import { installWorkspaceDrawings } from './workspace-drawings.js';
import { installModelHover } from '../model/ui/model-hover.js';
import { installModelComponents } from './model-components.js';
import { installModelPropertyCopy } from '../inspector/model-property-copy.js';
import { installWorkspaceReports } from './workspace-reports.js';
import { installWorkspaceReferences } from './workspace-references.js';
import { installWorkspaceAssemblies } from './workspace-assemblies.js';
import { installWorkspaceRecovery } from './workspace-recovery.js';
import { createInteractionTimings, installWorkspaceDiagnostics } from './workspace-diagnostics.js';
import { installGridSelection } from '../model/ui/grid-selection.js';

export async function createModelApplication({
  project,
  projectRecovery,
  recoveredProject,
  recoveryError,
}) {
  const actions = {};
  const controllers = {};
  const renderState = { renderedById: new Map(), snapIndex: null };
  const pointerQueue = { pending: null };
  const readForm = (...args) => actions.readForm(...args);
  const fillForm = (...args) => actions.fillForm(...args);
  const updateForm = (...args) => actions.updateForm(...args);
  const previewPlatePoint = (...args) => actions.previewPlatePoint(...args);
  const pickPlatePoint = (...args) => actions.pickPlatePoint(...args);
  const showRotationLine = (...args) => actions.showRotationLine(...args);
  const changePlateVertex = (...args) => actions.changePlateVertex(...args);
  const startPlateVertex = (...args) => actions.startPlateVertex(...args);
  const checkpoint = (...args) => actions.checkpoint(...args);
  const fit = (...args) => actions.fit(...args);
  const render = (...args) => actions.render(...args);
  const restoreSweepDefaults = (...args) => actions.restoreSweepDefaults(...args);
  const save = (...args) => actions.save(...args);
  const setDrawing = (...args) => actions.setDrawing(...args);
  const setSelection = (...args) => actions.setSelection(...args);
  const syncOperationUI = (...args) => actions.syncOperationUI(...args);
  const ui = createModelEditorState();

  const tools = createToolSession();

  const interactionTimings = createInteractionTimings();
  const { hiddenObjects, baseVisible, isVisible } = createModelVisibility({
    project,
    ui,
    renderState,
    controllers,
  });
  Object.assign(actions, { baseVisible, isVisible });
  const $ = (id) => document.getElementById(id);

  const host = $('viewport');
  const { scene, camera, renderer, navigation, viewWidget } = createModelViewport(
    host,
    (message) => {
      $('status').textContent = message;
    },
  );
  ui.sequence = project.objects.length;
  const projectHistory = new ProjectHistory();
  const modelEditor = createModelEditor({ project, checkpoint });

  const grid = new GridLines(scene, host);
  grid.set({ ...project.grid, modelObjects: true, z: levelElevation(project.levels) });
  const objects = new THREE.Group();
  scene.add(objects);
  const connectionMarkers = createConnectionMarkers(host, (id) => {
    if (tools.operation?.mode === 'componentProperties')
      controllers.componentUI.pickCopy(project.objects.find((s) => s.id === id));
    else setSelection([id]);
  });
  const instanceBatches = new InstanceBatches(scene);
  const insertionPoints = new InsertionPoints(
    host,
    (kind) =>
      typeof kind === 'object'
        ? startGrip(kind)
        : String(kind).startsWith('edge:')
          ? changePlateVertex(Number(kind.split(':')[1]), false)
          : typeof kind === 'number'
            ? startPlateVertex(kind)
            : startTransform(kind),
    {
      onRemove: (index) => changePlateVertex(index, true),
      canRemove: () => {
        const s = project.objects.find((s) => s.id === ui.selected);
        return s?.type === 'plate' ? s.polygon.length > 3 : null;
      },
    },
  );
  const { workPlaneGuide, planeViewButton, syncWorkPlane, workPlanePrompt, pickWorkPlane } =
    createWorkplaneController({
      scene,
      tools,
      renderer,
      getInspector: () => controllers.inspector,
      setDrawing,
      syncOperationUI,
    });
  Object.assign(actions, { syncWorkPlane, workPlanePrompt, pickWorkPlane });
  controllers.workPlaneGuide = workPlaneGuide;
  controllers.planeViewButton = planeViewButton;

  const frameGate = new FrameGate();
  const objectFeedback = new ObjectFeedback(scene, {
    visible: isVisible,
    invalidate: () => frameGate.invalidate(),
  });
  objectFeedback.setModel(project.objects);

  const { guide, snapMarker, updateSnapOverlay } = createSnapOverlay({
    project,
    ui,
    tools,
    host,
    scene,
    camera,
    grid,
  });
  Object.assign(actions, { updateSnapOverlay });
  const { raycaster, ray, selectionHit, point, orbitAroundHit } = createModelPicking({
    project,
    ui,
    tools,
    host,
    camera,
    objects,
    navigation,
    isVisible,
    getRenderedById: () => renderState.renderedById,
    getSnapIndex: () => renderState.snapIndex,
    getReferences: () => controllers.referenceModels,
    workPlanePrompt,
    updateSnapOverlay,
  });
  Object.assign(actions, { ray, selectionHit, point, orbitAroundHit });
  const preview = createModelPreview({
    project,
    ui,
    tools,
    scene,
    objects,
    objectFeedback,
    isVisible,
    getReferences: () => controllers.referenceModels,
  });
  const { dispose, clearPreview, mesh, validateSweep, previewModelBatch } = preview;
  Object.assign(actions, { dispose, clearPreview, mesh, validateSweep, previewModelBatch });
  const {
    resetLength,
    plateLengthActive,
    updateTypedLength,
    syncLocks,
    toggleLock,
    startTransform,
    startGrip,
    commitPoint,
    updatePointer,
  } = createPlacementController({
    project,
    ui,
    tools,
    modelEditor,
    renderer,
    scene,
    guide,
    frameGate,
    workPlaneGuide,
    preview,
    point,
    setDrawing,
    syncOperationUI,
    save,
    render,
    checkpoint,
    updateSnapOverlay,
    readForm: () => readForm(),
    fillForm: (s) => fillForm(s),
    updateForm: () => updateForm(),
    previewPlatePoint: (p) => previewPlatePoint(p),
    pickPlatePoint: (p, exact) => pickPlatePoint(p, exact),
    showRotationLine: (...args) => showRotationLine(...args),
    getInspector: () => controllers.inspector,
    getReferences: () => controllers.referenceModels,
    getItem: () => controllers.itemUI,
    getFasteners: () => controllers.fastenerUI,
    getGridDraft: () => controllers.helperController.gridDraft(),
  });
  Object.assign(actions, {
    resetLength,
    plateLengthActive,
    updateTypedLength,
    syncLocks,
    toggleLock,
    startTransform,
    startGrip,
    commitPoint,
    updatePointer,
  });

  // Stable dependencies are constructed before feature installation. Actions and
  // controller handles are local to this application and wired before user input.
  const context = {
    $,
    actions,
    controllers,
    projectRecovery,
    recoveredProject,
    recoveryError,
    project,
    ui,
    tools,
    projectHistory,
    modelEditor,
    hiddenObjects,
    scene,
    camera,
    renderer,
    navigation,
    viewWidget,
    host,
    grid,
    objects,
    connectionMarkers,
    instanceBatches,
    insertionPoints,
    frameGate,
    objectFeedback,
    interactionTimings,
    guide,
    snapMarker,
    raycaster,
    pointerQueue,
    renderState,
  };
  installModelSweepForm(context);
  installModelRenderer(context);
  installModelSession(context);
  installModelViewControls(context);
  installModelTools(context);
  installModelFasteners(context);
  installModelContextMenu(context);
  installModelInput(context);
  installWorkspaceSettings(context);
  installModelAttributes(context);
  installModelLibraries(context);
  installModelIdentity(context);
  installModelBrowser(context);
  installWorkspaceLevels(context);
  installWorkspaceDrawings(context);
  installModelHover(context);
  installModelComponents(context);
  installModelPropertyCopy(context);
  restoreSweepDefaults();
  installModelItems(context);
  updateForm();
  render();
  navigation.controls.update();
  fit();
  syncLocks();

  installWorkspaceReports(context);
  installWorkspaceReferences(context);
  installWorkspaceAssemblies(context);
  installWorkspaceRecovery(context);
  await installWorkspaceDiagnostics(context);
  installGridSelection(context);

  installModelToolbox(context);
  installModelFrameLoop(context);
}
