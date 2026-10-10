import { createFrameExample } from '../project/frame-example.js';
import { levelElevation, initialLevels } from '../levels.js';
import * as THREE from 'three';
import { isFastener } from '../fasteners/object-type.js';
import { createSettingsController } from './settings-controller.js';
import { openDrawingAttributeLibrary } from '../drawing-attribute-library.js';
import { applyGridSettingsToObjects } from '../model/grid-objects.js';
import { installProjectFiles } from './project-files.js';
import { createProject, captureProject } from '../project/project-state.js';
import { defaultGrid } from '../grid-lines.js';

export function installWorkspaceSettings({
  $,
  actions,
  controllers,
  grid,
  hiddenObjects,
  navigation,
  objects,
  project,
  projectHistory,
  projectRecovery,
  renderer,
  tools,
  ui,
}) {
  const checkpoint = (...args) => actions.checkpoint(...args);
  const fit = (...args) => actions.fit(...args);
  const render = (...args) => actions.render(...args);
  const select = (...args) => actions.select(...args);
  const setDrawing = (...args) => actions.setDrawing(...args);
  Object.assign(actions, { loadFrameExample, fillSettings });
  function loadFrameExample(size) {
    const started = performance.now();
    const example = createFrameExample(size, { prepareGeometry: true });
    controllers.inspector?.finish();
    checkpoint();
    setDrawing(false);
    Object.assign(project, example);
    project.references = example.references || { folders: ['Standard'], models: [] };
    controllers.referenceModels?.restore(project.references);
    projectHistory.prime(project);
    hiddenObjects.clear();
    controllers.modelFilter?.reset();
    ui.sequence = project.objects.length;
    controllers.levelsUI?.sync();
    grid.set({ ...project.grid, modelObjects: true, z: levelElevation(project.levels) });
    select(null);
    controllers.inspector.show('model');
    fit(new THREE.Vector3(1, -1, 1).normalize(), new THREE.Box3().setFromObject(objects));
    const screws = project.objects.filter(isFastener);
    const holes = screws.reduce((n, s) => n + s.holes.length, 0);
    return `Exempel inläst · ${project.objects.length} objekt · ${screws.length} skruvar · ${holes} hål · uppbyggnad ${((performance.now() - started) / 1000).toFixed(1)} s`;
  }
  const settingsController = createSettingsController({
    project,
    checkpoint,
    onOrbitDampingChanged: (enabled) => {
      navigation.controls.enableDamping = enabled;
    },
    loadExample: loadFrameExample,
    libraries: [
      {
        group: 'Modell',
        name: 'Material',
        description: 'Materialtyper, densitet och standardfärg',
        open: () => controllers.materialUI.openLibrary(),
      },
      {
        group: 'Modell',
        name: 'Profiler',
        description: 'Tvärsnitt och profildimensioner',
        open: () => controllers.sectionEditor.open(),
      },
      {
        group: 'Modell',
        name: 'Skruvar',
        description: 'Träskruv och skruv med mutter',
        open: () => controllers.fastenerUI.openLibrary(),
      },
      {
        group: 'Modell',
        name: 'Färger',
        description: 'Färger för material och objekt',
        open: () => controllers.materialUI.colors.open(),
      },
      {
        group: 'Ritningar',
        name: 'Attribut',
        open: () =>
          openDrawingAttributeLibrary(() => {
            if (controllers.drawingController.manager.dialog.open)
              controllers.drawingController.manager.render();
            if (controllers.drawingController.singleSheet.dialog.open)
              controllers.drawingController.singleSheet.compose();
            if (controllers.drawingController.planView.dialog.open)
              controllers.drawingController.planView.refreshPaper();
          }),
      },
      {
        group: 'Ritningar',
        name: 'Ritningsinställningar',
        description: 'Sparade uppsättningar för textstil, layout och visning',
        open: () => controllers.drawingSettings.open(),
      },
      {
        group: 'Ritningar',
        name: 'Ramblock',
        description: 'Ritningsramar och stämpelfält',
        open: () => {
          controllers.frameEditor.open();
          controllers.frameEditor.switchMode('block');
        },
      },
      {
        group: 'Ritningar',
        name: 'Layouter',
        description: 'Placering av ramblock på ritningsblad',
        open: () => {
          controllers.frameEditor.open();
          controllers.frameEditor.switchMode('layout');
        },
      },
      {
        group: 'Ritningar',
        name: 'Pappersformat',
        description: 'Bladstorlekar för ritningar',
        open: () => controllers.drawingController.singleSheet.openLibrary(),
      },
    ],
    onClose: () => {
      if (tools.drawing) renderer.domElement.focus({ preventScroll: true });
    },
    onGridChanged: (previousGrid) => {
      applyGridSettingsToObjects(project, previousGrid);
      setDrawing(false);
      grid.set({ ...project.grid, modelObjects: true, z: levelElevation(project.levels) });
      fit();
    },
    onChange: render,
  });
  function fillSettings() {
    settingsController.fill();
  }
  installProjectFiles({
    project,
    newProject: () => createProject({ grid: defaultGrid, levels: initialLevels() }),
    finishEditing: () => controllers.inspector?.finish(),
    onLoaded: fillSettings,
    loadProject: (next) => {
      const previous = captureProject(project);
      const apply = (state) => {
        setDrawing(false);
        Object.assign(project, state);
        controllers.referenceModels?.restore(project.references);
        projectHistory.prime(project);
        hiddenObjects.clear();
        controllers.modelFilter?.reset();
        ui.exactProfileIds.clear();
        ui.sequence = project.objects.length;
        controllers.levelsUI?.sync();
        grid.set({ ...project.grid, modelObjects: true, z: levelElevation(project.levels) });
        select(null);
        controllers.inspector.show('model');
        fillSettings();
        fit(new THREE.Vector3(1, -1, 1).normalize(), new THREE.Box3().setFromObject(objects));
      };
      try {
        apply(next);
      } catch (error) {
        apply(previous);
        throw error;
      }
      projectRecovery.acceptNewProject();
      controllers.projectAutosave?.schedule();
      projectHistory.checkpoint(previous);
      $('undo').disabled = false;
      $('redo').disabled = true;
    },
  });
}
