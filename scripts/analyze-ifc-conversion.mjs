import { IfcAPI, IFCBEAM, IFCCOLUMN, IFCMEMBER } from 'web-ifc';
import * as THREE from 'three';
import { readFileSync, writeFileSync } from 'node:fs';
import { ifcPlacement } from '../src/references/ifc-coordinates.js';
import { planReferenceConversion, conversionObjects } from '../src/references/conversion.js';
import { geometryForModel } from '../src/model-object.js';
import {
  solidMeasures as measures,
  compareSolids,
} from '../src/references/conversion-verification.js';

// Geometry-only audit of the same Float32 meshes/placements used by the importer.
// An empty profile catalog prevents library substitution from changing the comparison.
const [file, reportPath] = process.argv.slice(2);
if (!file) throw Error('Usage: node scripts/analyze-ifc-conversion.mjs model.ifc [report.json]');
const api = new IfcAPI();
await api.Init();
const model = api.OpenModel(readFileSync(file), {
  COORDINATE_TO_ORIGIN: false,
  CIRCLE_SEGMENTS: 32,
});
if (model < 0) throw Error('IFC-filen kunde inte läsas.');
const types = new Set([IFCBEAM, IFCCOLUMN, IFCMEMBER]);
const rows = [],
  counts = {};
try {
  api.StreamAllMeshes(model, (flat) => {
    const line = api.GetLine(model, flat.expressID);
    if (!types.has(line.type)) return;
    const parts = [];
    for (let i = 0; i < flat.geometries.size(); i++) {
      const p = flat.geometries.get(i),
        raw = api.GetGeometry(model, p.geometryExpressID);
      try {
        const v = api.GetVertexArray(raw.GetVertexData(), raw.GetVertexDataSize()),
          positions = new Float32Array(v.length / 2);
        for (let k = 0; k < v.length / 6; k++) positions.set(v.subarray(k * 6, k * 6 + 3), k * 3);
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setIndex(
          Array.from(api.GetIndexArray(raw.GetIndexData(), raw.GetIndexDataSize())),
        );
        const matrix = ifcPlacement(p.flatTransformation);
        const origin = new THREE.Vector3().setFromMatrixPosition(matrix);
        matrix.setPosition(0, 0, 0);
        geometry.applyMatrix4(matrix);
        const mesh = new THREE.Mesh(geometry);
        mesh.position.copy(origin);
        mesh.userData = { ifcId: line.expressID, ifcType: line.type, name: line.Name?.value || '' };
        parts.push({ mesh });
      } finally {
        raw.delete();
      }
    }
    try {
      const row = planReferenceConversion(
        { parts, fileName: 'audit.ifc', title: 'Audit' },
        [],
        null,
        [],
      )[0];
      const result = {
        id: row.id,
        name: row.name,
        parts: parts.length,
        converted: !!row.object,
        reason: row.reason,
      };
      if (row.object) {
        let index = 0;
        const objects = conversionObjects([row], [], () => 'audit-' + index++);
        const target = geometryForModel(objects[0], objects);
        const source = measures(parts[0].mesh.geometry, parts[0].mesh.matrixWorld),
          converted = measures(target);
        result.cuts = row.cuts.length;
        Object.assign(result, compareSolids(source, converted));
        target.dispose();
      }
      const key = result.converted
        ? result.comparisonPassed
          ? 'converted'
          : 'comparison-failed'
        : result.reason;
      counts[key] = (counts[key] || 0) + 1;
      rows.push(result);
    } finally {
      for (const { mesh } of parts) {
        mesh.geometry.dispose();
        mesh.material.dispose();
      }
    }
  });
  const report = {
    schema: api.GetModelSchema(model),
    method: 'geometry-without-profile-substitution',
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
