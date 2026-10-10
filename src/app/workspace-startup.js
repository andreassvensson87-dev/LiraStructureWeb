import { installDrawingTemplates } from '../install-drawing-templates.js';
import {
  installReportTemplates,
  installMaterialReportTemplate,
  installFullFrameReportTables,
} from '../install-report-templates.js';
import { installTeklaAttributeChoices } from '../install-tekla-attribute-choices.js';
import { ProjectRecovery, projectSession } from './project-recovery.js';
import { createProject } from '../project/project-state.js';
import { defaultGrid } from '../grid-lines.js';
import { initialLevels } from '../levels.js';

export async function recoverWorkspace() {
  try {
    installDrawingTemplates();
    installReportTemplates();
    installMaterialReportTemplate();
    installFullFrameReportTables();
    installTeklaAttributeChoices();
  } catch (error) {
    console.warn('Kunde inte installera ritningsmallarna.', error);
  }
  const projectRecovery = new ProjectRecovery(await projectSession());
  let recoveredProject = null,
    recoveryError = '';
  try {
    recoveredProject = await projectRecovery.load();
    recoveryError = recoveredProject?.warning || '';
  } catch (error) {
    recoveryError = error.message;
  }
  const project =
    recoveredProject?.project || createProject({ grid: defaultGrid, levels: initialLevels() });
  return { project, projectRecovery, recoveredProject, recoveryError };
}
