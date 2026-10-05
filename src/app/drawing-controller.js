import { DrawingManager } from '../drawing-manager.js';
import { PlanView } from '../plan-view.js';
import { SinglePartSheet } from '../single-part-sheet.js';
import { mergeDrawingEdit } from '../project/drawing-edits.js';
import { resolveAssemblyDrawing } from '../assembly-numbering.js';
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
    changeAssemblies: ({ assemblies, drawings, assemblyNumbering = project.assemblyNumbering }) => {
      if (
        assemblies === project.assemblies &&
        drawings === project.drawings &&
        assemblyNumbering === project.assemblyNumbering
      )
        return;
      checkpoint();
      project.assemblies = assemblies;
      project.drawings = drawings;
      project.assemblyNumbering = assemblyNumbering;
      onChange();
    },
    number: (parts, drawings) => {
      checkpoint();
      project.parts = parts;
      project.drawings = drawings;
      onChange();
    },
    open: (record) => {
      finishEditing();
      stopTool();
      if (record.type === 'AS' && record.assemblyKey) {
        const resolved = resolveAssemblyDrawing(record, project);
        if (!resolved) return;
        if (JSON.stringify(resolved) !== JSON.stringify(record)) {
          checkpoint();
          project.drawings = project.drawings.map((d) => (d.id === record.id ? resolved : d));
          record = resolved;
        }
      }
      (['SP', 'AS'].includes(record.type) ? singleSheet : planView).openRecord(record, {
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
