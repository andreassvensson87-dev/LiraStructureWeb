import { IfcAPI, IFCBEAM, IFCCOLUMN, IFCMEMBER } from 'web-ifc';
import { readFileSync, writeFileSync } from 'node:fs';
import { createIFCProfileReader } from '../src/references/ifc-profile-data.js';
import { matchLibraryProfile } from '../src/references/profile-match.js';

// Read-only diagnostics for future examples. No triangulation or conversion claim.
const [file, reportPath] = process.argv.slice(2);
if (!file) throw Error('Usage: node scripts/analyze-ifc-profiles.mjs model.ifc [report.json]');
const api = new IfcAPI();
await api.Init();
const model = api.OpenModel(readFileSync(file), { COORDINATE_TO_ORIGIN: false });
if (model < 0) throw Error('IFC-filen kunde inte läsas.');
try {
  const read = createIFCProfileReader(api, model),
    rows = [],
    counts = {};
  for (const type of [IFCBEAM, IFCCOLUMN, IFCMEMBER]) {
    const ids = api.GetLineIDsWithType(model, type);
    for (let i = 0; i < ids.size(); i++) {
      const id = ids.get(i),
        evidence = read(id),
        result = matchLibraryProfile(evidence);
      counts[result.status] = (counts[result.status] || 0) + 1;
      rows.push({
        id,
        evidence,
        result: {
          status: result.status,
          suggestion: result.suggestion?.section.name || null,
          alternatives: result.alternatives.map((c) => ({
            profile: c.section.name,
            reasons: c.reasons,
            deviations: c.deviations,
          })),
          warnings: result.warnings,
          conflicts: result.conflicts,
        },
      });
    }
  }
  const report = {
    schema: api.GetModelSchema(model),
    method: 'metadata-only',
    catalog: 'built-in',
    total: rows.length,
    counts,
    rows,
  };
  if (reportPath) writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
  console.log(
    JSON.stringify(
      { schema: report.schema, method: report.method, total: report.total, counts },
      null,
      2,
    ),
  );
} finally {
  api.CloseModel(model);
}
