import { closeDrawingEditors } from './drawing-navigation.js';
import { singlePartPDFPage, gaPDFPage, createDrawingPDF } from '../drawing-pdf.js';
import { DrawingManager } from '../drawing-manager.js';
import { PlanView } from '../plan-view.js';
import { SinglePartSheet } from '../single-part-sheet.js';
import { mergeDrawingEdit } from '../project/drawing-edits.js';
import { resolveAssemblyDrawing } from '../assembly-numbering.js';
import { createSelectionDrawingActions } from './selection-drawings.js';
import { showDrawingBatch } from '../drawing-workflows.js';
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
  onMessage = () => {},
  getReferenceModels = () => [],
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
      references: project.references,
    }),
    getSnapSettings,
    openDrawingList: () => manager.show(),
    getReferenceModels,
  });
  const singleSheet = new SinglePartSheet({
    getAttributeState: () => project,
    getObjects: () => project.objects,
    getProject: () => project.info,
    getSnapSettings,
    openDrawingList: () => manager.show(),
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
    exportPDF: async (records) => {
      finishEditing();
      stopTool();
      const pages = [];
      for (let record of records) {
        if (record.type === 'AS') {
          record = resolveAssemblyDrawing(record, project);
          if (!record) throw Error('Assemblyritningens källa saknas.');
        } else if (record.type === 'SP') {
          const source = project.objects.find(
            (o) => project.parts.assignments[o.id]?.key === record.partKey,
          );
          if (!source) throw Error('Detaljritningens källa saknas.');
          record = { ...record, sourceId: source.id };
        }
        const editor = ['SP', 'AS'].includes(record.type) ? singleSheet : planView;
        editor.dialog.classList.add('drawing-pdf-render');
        try {
          editor.openRecord(record, { save: () => {}, review: () => {} });
          await editor.ifcReferences?.ready();
          await document.fonts.ready;
          await new Promise((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(resolve)),
          );
          pages.push(editor === singleSheet ? singlePartPDFPage(editor) : gaPDFPage(editor));
        } finally {
          if (editor.dialog.open)
            await new Promise((resolve) => {
              editor.dialog.addEventListener('close', resolve, { once: true });
              editor.dialog.close();
            });
          editor.dialog.classList.remove('drawing-pdf-render');
        }
      }
      return createDrawingPDF(pages);
    },
    open: async (record) => {
      await closeDrawingEditors([singleSheet, planView]);
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
  const selectionDrawings = createSelectionDrawingActions({
    getState: () => project,
    prepare: () => {
      finishEditing();
      stopTool();
    },
    number: (kinds) => manager.openNumbering(kinds),
    restoreSelection: highlight,
    openDrawing: (record) => manager.openDrawing(record),
    showBatch: (type, ids) => showDrawingBatch(manager, type, ids),
    message: onMessage,
  });
  return { manager, planView, singleSheet, ...selectionDrawings };
}
