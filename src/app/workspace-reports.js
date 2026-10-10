import { FrameEditor } from '../frame-editor.js';
import { drawingAttributeContext } from '../drawing-attributes.js';
import { installDrawingSettings } from '../drawing-settings.js';
import { installReports } from '../report-module.js';

export function installWorkspaceReports({ $, actions, controllers, project, projectHistory }) {
  const setDrawing = (...args) => actions.setDrawing(...args);
  const frameEditor = new FrameEditor({
    getContext: () => ({
      project: project.info,
      drawings: project.drawings.map((d) => drawingAttributeContext(d, project).drawing),
    }),
    beforeOpen: () => {
      controllers.inspector?.finish();
      setDrawing(false);
    },
  });

  const drawingSettings = installDrawingSettings(controllers.drawingController, frameEditor);
  installReports({
    project,
    frameEditor,
    checkpoint: () => {
      controllers.projectAutosave?.schedule();
      projectHistory.checkpoint(project);
      $('undo').disabled = false;
      $('redo').disabled = true;
    },
    finishEditing: () => {
      controllers.inspector?.finish();
      setDrawing(false);
    },
  });

  controllers.frameEditor = frameEditor;
  controllers.drawingSettings = drawingSettings;
}
