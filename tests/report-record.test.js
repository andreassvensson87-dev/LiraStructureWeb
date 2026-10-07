import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseProjectFile, serializeProject } from '../src/project/project-file.js';
import { ProjectHistory } from '../src/project/project-history.js';
import { a4ReportLayout } from '../src/install-report-templates.js';
import templates from '../src/bundled-drawing-templates.js';
import { defaultReportColumns } from '../src/report-drawing-list.js';
import { defaultReportTableStyle } from '../src/report-table-style.js';
import {
  reportPageContext,
  validateReportRecord,
  validateProjectReports,
} from '../src/report-record.js';
import { attributeDrawingValue } from '../src/drawing-attributes.js';
const project = () =>
  parseProjectFile(
    readFileSync(new URL('../examples/assemblytest.lira.json', import.meta.url), 'utf8'),
  );
const report = () =>
  structuredClone({
    id: 'report-1',
    kind: 'drawing-list',
    title: 'Ritningsförteckning',
    number: 'RF-01',
    date: '2026-10-07',
    revision: 'A',
    issueStatus: ['GODKÄND | G1'],
    documentType: 'BYGGHANDLING | BH',
    first: a4ReportLayout.id,
    next: 'same',
    font: '2.8',
    type: '',
    search: '',
    sort: 'drawing.number',
    columns: defaultReportColumns,
    tableStyle: defaultReportTableStyle,
    assets: {
      first: a4ReportLayout,
      next: a4ReportLayout,
      blocks: templates.blocks.filter((b) =>
        a4ReportLayout.entities.some((e) => e.blockId === b.id),
      ),
    },
  });
test('reports round-trip with metadata, formatting and embedded layout blocks', () => {
  const p = project();
  p.reports = [report()];
  const loaded = parseProjectFile(serializeProject(p));
  assert.deepEqual(loaded.reports, p.reports);
  p.reports[0].assets.blocks[0].entities[0].color = '#ff0000';
  assert.notEqual(loaded.reports[0].assets.blocks[0].entities[0].color, '#ff0000');
});
test('older project files without reports load with an empty report collection', () => {
  const p = project();
  delete p.reports;
  const loaded = parseProjectFile(
    JSON.stringify({ format: 'LiraStructure', fileVersion: 1, project: p }),
  );
  assert.deepEqual(loaded.reports, []);
});
test('report properties fill existing drawing blocks and native report attributes with full choice labels', () => {
  const context = reportPageContext({ name: 'Projekt A' }, report(), 2, 5, 80);
  assert.equal(attributeDrawingValue('drawing.number', context), 'RF-01');
  assert.equal(attributeDrawingValue('drawing.issueStatus', context), 'GODKÄND');
  assert.equal(attributeDrawingValue('report.documentType', context), 'BYGGHANDLING');
  assert.equal(attributeDrawingValue('report.pageLabel', context), 'Sida 2 av 5');
  assert.match(attributeDrawingValue('drawing.name', context), /Ritningsförteckning\nSida 2 av 5/);
});
test('report persistence participates in project undo and redo', () => {
  let p = project();
  const history = new ProjectHistory();
  history.checkpoint(p);
  p.reports = [report()];
  p = history.undo(p);
  assert.deepEqual(p.reports, []);
  p = history.redo(p);
  assert.equal(p.reports[0].number, 'RF-01');
});
test('invalid report columns, references, geometry and duplicate ids fail before import', () => {
  for (const mutate of [
    (r) => {
      r.columns[0].width = 0;
    },
    (r) => {
      r.assets.blocks = [];
    },
    (r) => {
      r.assets.first.reportViewport.width = 1000;
    },
    (r) => {
      r.assets.blocks[0].entities[0].points = [[null, 2]];
    },
    (r) => {
      r.assets.next.id = 'wrong-layout';
    },
  ]) {
    const r = report();
    mutate(r);
    assert.throws(() => validateReportRecord(r));
  }
  assert.throws(() => validateProjectReports([report(), report()]), /unika/);
});
