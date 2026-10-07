import test from 'node:test';
import assert from 'node:assert/strict';
import { materialReportData, defaultMaterialReportColumns } from '../src/report-material-list.js';
import { numberParts } from '../src/part-marks.js';
import { paginateReport } from '../src/report-pagination.js';
import { parseProjectFile, serializeProject } from '../src/project/project-file.js';
import { readFileSync } from 'node:fs';
import { a4ReportLayout } from '../src/install-report-templates.js';
import templates from '../src/bundled-drawing-templates.js';
const steel = {
  id: 'steel',
  name: 'S355',
  revision: 1,
  category: 'steel',
  density: 7850,
  color: '#778899',
};
const beam = (id, y = 0, length = 1000, material = steel) => ({
  id,
  type: 'sweep',
  profile: 'rectangle',
  name: 'Balk',
  start: [0, y, 0],
  end: [length, y, 0],
  width: 100,
  height: 100,
  thickness: 0,
  rotation: 0,
  material,
});
const state = (objects) => ({ objects, parts: numberParts(objects) });
test('equal numbered parts become one row with exact count and unrounded mass summed', () => {
  const result = materialReportData(
    state([beam('a'), beam('b', 300)]),
    defaultMaterialReportColumns,
  );
  assert.equal(result.partCount, 2);
  assert.equal(result.groupCount, 1);
  assert.deepEqual(result.rows[0], ['B-001', '2', 'S355', 'Rekt. 100 × 100', '1000', '157']);
  assert.equal(result.rows[1][5], '157');
  assert.deepEqual(result.warnings, []);
});
test('helpers and cuts are excluded while net volume removes machining from part weight', () => {
  const b = beam('beam');
  const cut = {
    id: 'cut',
    type: 'polygoncut',
    frame: { origin: [0, 0, -500], u: [1, 0, 0], v: [0, 1, 0] },
    polygon: [
      [500, -500],
      [1500, -500],
      [1500, 500],
      [500, 500],
    ],
    thickness: 1000,
    side: 'positive',
    targets: ['beam'],
  };
  const helper = { id: 'helper', type: 'helperpoint', point: [0, 0, 0] };
  const result = materialReportData(state([b, cut, helper]), defaultMaterialReportColumns);
  assert.equal(result.partCount, 1);
  assert.equal(result.rows[0][5], 'ca 39,25');
});
test('missing density and stale marks remain visible and incomplete totals are explicit', () => {
  const b = beam('a'),
    p = state([b]);
  b.end = [2000, 0, 0];
  b.material = null;
  const result = materialReportData(p, defaultMaterialReportColumns);
  assert.match(result.rows[0][0], /kontroll krävs/);
  assert.equal(result.rows[0][5], '—');
  assert.equal(result.rows[1][5], '0 + okänd');
  assert.equal(result.warnings.length, 2);
});
test('filtered material groups receive matching subtotals and numeric sorting', () => {
  const wood = { ...steel, id: 'wood', name: 'C24', category: 'wood', density: 450 };
  const p = state([beam('a'), beam('b', 300, 2000), beam('c', 600, 1000, wood)]);
  const all = materialReportData(p, defaultMaterialReportColumns, { group: 'material.material' });
  assert.equal(all.rowKinds.filter((k) => k === 'subtotal').length, 2);
  assert.equal(all.rows.at(-1)[1], '3');
  const filtered = materialReportData(p, defaultMaterialReportColumns, {
    search: 's355',
    sort: 'material.weight',
  });
  assert.equal(filtered.partCount, 2);
  assert.equal(filtered.rows[0][5], '78,5');
  assert.equal(filtered.rows.at(-1)[5], '235,5');
});
test('reordering or removing text columns does not discard numerical totals', () => {
  const p = state([beam('a'), beam('b', 300)]);
  const columns = [
    defaultMaterialReportColumns[1],
    defaultMaterialReportColumns[0],
    defaultMaterialReportColumns[5],
  ];
  const report = materialReportData(p, columns);
  assert.deepEqual(report.rows.at(-1), ['2', 'Totalt', '157']);
  const numeric = materialReportData(p, [columns[0], columns[2]]);
  assert.deepEqual(numeric.rows.at(-1), ['Totalt · 2', '157']);
});
test('model edits invalidate cached quantities and many part rows flow across pages', () => {
  const objects = Array.from({ length: 60 }, (_, i) => beam('b' + i, i * 300, 1000 + i * 10));
  const p = state(objects),
    massCache = new Map();
  const first = materialReportData(p, defaultMaterialReportColumns, { massCache });
  objects[0].end = [5000, 0, 0];
  const next = materialReportData(p, defaultMaterialReportColumns, { massCache });
  assert.notDeepEqual(next.rows, first.rows);
  const pages = paginateReport(
    next.rows,
    defaultMaterialReportColumns,
    () => a4ReportLayout.reportViewport,
  );
  assert.ok(pages.length > 1);
  assert.deepEqual(
    pages.flatMap((p) => p.rows.map((r) => r.index)),
    next.rows.map((_, i) => i),
  );
});
test('material report definitions and grouping round-trip in project files', () => {
  const p = parseProjectFile(
    readFileSync(new URL('../examples/assemblytest.lira.json', import.meta.url), 'utf8'),
  );
  p.reports = [
    {
      id: 'material-report',
      kind: 'material-list',
      title: 'Materialförteckning',
      number: 'MF-01',
      date: '',
      revision: '',
      issueStatus: '',
      documentType: '',
      first: a4ReportLayout.id,
      next: 'same',
      font: '2.8',
      type: '',
      search: '',
      sort: 'material.mark',
      group: 'material.material',
      subtotals: true,
      totals: true,
      columns: defaultMaterialReportColumns,
      assets: {
        first: a4ReportLayout,
        next: a4ReportLayout,
        blocks: templates.blocks.filter((b) =>
          a4ReportLayout.entities.some((e) => e.blockId === b.id),
        ),
      },
    },
  ];
  assert.deepEqual(parseProjectFile(serializeProject(p)).reports, p.reports);
});
