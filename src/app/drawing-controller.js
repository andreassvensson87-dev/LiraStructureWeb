import { DrawingManager } from '../drawing-manager.js';
import { PlanView } from '../plan-view.js';
import { SinglePartSheet } from '../single-part-sheet.js';
import { mergeDrawingEdit } from '../project/drawing-edits.js';
/** Connects drawing workspaces to the project; editors do not own application state. */
export function createDrawingController({
  project,
  checkpoint,
  getSelection,
  finishEditing,
  stopTool,
  highlight,
  onChange,
  onIdentityChange,
}) {
  const getSnapSettings = () => project.snap;
  const planView = new PlanView({
    getState: () => ({
      objects: project.objects,
      grid: project.grid,
      levels: project.levels,
      parts: project.parts,
      project: project.info,
      drawings: project.drawings,
    }),
    getSnapSettings,
  });
  const singleSheet = new SinglePartSheet({
    getAttributeState: () => project,
    getObjects: () => project.objects,
    getProject: () => project.info,
    getSnapSettings,
  });
  const manager = new DrawingManager({
    getState: () => ({ ...project, selected: getSelection() }),
    change: (next) => {
      checkpoint();
      project.drawings = next;
      onIdentityChange();
    },
    beforeNumber: finishEditing,
    highlight,
    number: (parts, drawings) => {
      checkpoint();
      project.parts = parts;
      project.drawings = drawings;
      onChange();
    },
    open: (record) => {
      finishEditing();
      stopTool();
      (record.type === 'SP' ? singleSheet : planView).openRecord(record, {
        save: (record) => {
          const next = mergeDrawingEdit(project.drawings, record);
          if (next !== project.drawings) {
            checkpoint();
            project.drawings = next;
          }
          manager.render();
        },
        review: (record) => manager.reviewed(record),
      });
    },
  });
  return { manager, planView, singleSheet };
}
