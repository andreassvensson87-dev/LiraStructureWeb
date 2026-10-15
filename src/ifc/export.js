import { prepareIFCExport } from './export-plan.js';
import { writeIFC } from './writer.js';
export async function exportIFC(project, options, progress = () => {}) {
  const plan = prepareIFCExport(project, options, (i, n, name) =>
    progress({ stage: 'geometry', current: i, total: n, name }),
  );
  const report = {
    issues: plan.issues,
    parts: plan.parts.length,
    assemblies: options.assemblies ? plan.groups.length : 0,
    extrusions: plan.parts.filter((p) => p.geometry.kind === 'extrusion').length,
    meshes: plan.parts.filter((p) => p.geometry.kind === 'mesh').length,
  };
  const file = report.issues.some((i) => i.severity === 'error')
    ? null
    : await writeIFC(plan, { filename: options.filename }, (i, n, name) =>
        progress({ stage: 'write', current: i, total: n, name }),
      );
  return { report, file };
}
