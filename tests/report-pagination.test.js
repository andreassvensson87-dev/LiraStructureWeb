import test from 'node:test';
import assert from 'node:assert/strict';
import { paginateReport, wrapReportText } from '../src/report-pagination.js';
import {
  reportAreaFromPoints,
  validateReportViewport,
  layoutAppliesTo,
} from '../src/report-layout.js';
import { drawingReportRows } from '../src/report-drawing-list.js';
import { attributeDrawingValue } from '../src/drawing-attributes.js';
import { frameText } from '../src/frame-text.js';
import { libraryUsage } from '../src/frame-library.js';
import { reportTableStyle, defaultReportTableStyle } from '../src/report-table-style.js';
const columns = [
  { key: 'number', label: 'Nummer', width: 30 },
  { key: 'name', label: 'Namn', width: 60 },
];
const area = { x: 15, y: 20, width: 180, height: 50 };
test('custom header metrics and cell padding determine pagination without losing rows', () => {
  const rows = Array.from({ length: 50 }, (_, i) => [String(i), 'Text som kan radbrytas']);
  const options = { fontSize: 3, headerSize: 5, paddingX: 4, paddingY: 3, lineSpacing: 1.8 };
  const pages = paginateReport(rows, columns, () => ({ ...area, height: 90 }), options);
  assert.deepEqual(
    pages.flatMap((p) => p.rows.map((r) => r.index)),
    rows.map((_, i) => i),
  );
  for (const p of pages) {
    assert.equal(p.headerLineHeight, 9);
    assert.equal(p.headerHeight, Math.max(...p.headings.map((h) => h.length)) * 9 + 6);
    assert.ok(p.used <= p.capacity + 1e-6);
    assert.ok(p.rows.every((r) => r.height >= 3 * 1.8 + 6));
  }
});
test('header wrapping uses the header font measurement rather than body measurement', () => {
  const [page] = paginateReport([['x']], [{ label: 'AB CD', width: 1 }], () => area, {
    headerSize: 4,
    measure: (s) => s.length,
    headerMeasure: (s) => s.length * 40,
  });
  assert.deepEqual(page.headings, [['AB', 'CD']]);
  assert.deepEqual(page.rows[0].cells, [['x']]);
});
test('legacy table settings receive defaults and invalid styles fail before rendering', () => {
  assert.deepEqual(reportTableStyle(), defaultReportTableStyle);
  const style = reportTableStyle({ font: 'serif', striped: false, borderWidth: 0 });
  assert.equal(style.headerFont, 'sans');
  assert.equal(style.striped, false);
  assert.equal(style.borderWidth, 0);
  for (const invalid of [
    { font: 'other' },
    { paddingY: -1 },
    { headerSize: NaN },
    { borderColor: 'red' },
  ])
    assert.throws(() => reportTableStyle(invalid));
});
test('rows flow into successive viewports without loss, with headers reserved on every page', () => {
  const rows = Array.from({ length: 101 }, (_, i) => ['R-' + i, 'Ritning ' + i]);
  const pages = paginateReport(rows, columns, () => area);
  assert.ok(pages.length > 1);
  assert.deepEqual(
    pages.flatMap((p) => p.rows.map((r) => r.index)),
    rows.map((_, i) => i),
  );
  for (const p of pages) {
    assert.deepEqual(p.headings, [['Nummer'], ['Namn']]);
    assert.ok(p.used <= p.capacity + 1e-6);
  }
});
test('a long row continues on smaller continuation pages without missing or duplicate text', () => {
  const rows = [['R-1', 'Abcdef '.repeat(180)]];
  const next = { ...area, width: 120, height: 40 };
  const pages = paginateReport(rows, columns, (i) => (i ? next : area));
  const actual = pages.flatMap((p) => p.rows.flatMap((r) => r.cells[1]));
  const expected = wrapReportText(rows[0][1], (120 * 60) / 90 - 4, 2.8);
  assert.deepEqual(actual, expected);
  assert.ok(pages.length > 2);
  assert.ok(pages.slice(1).every((p) => p.rows[0].continued));
});
test('normal rows stay whole across page breaks and row heights follow wrapping', () => {
  const pages = paginateReport(
    [
      ['1', 'Kort'],
      ['2', 'Lång text '.repeat(10)],
      ['3', 'Kort'],
    ],
    columns,
    () => ({ ...area, height: 75 }),
  );
  const fragments = pages.flatMap((p) => p.rows);
  assert.deepEqual(
    fragments.map((r) => r.index),
    [0, 1, 2],
  );
  assert.ok(fragments[1].height > fragments[0].height);
});
test('empty reports get one page; invalid geometry and columns fail explicitly', () => {
  assert.equal(paginateReport([], columns, () => area).length, 1);
  assert.throws(() => paginateReport([], [], () => area), /kolumn/);
  assert.throws(
    () => paginateReport([['1', '2']], columns, () => ({ ...area, height: 10 })),
    /låg/,
  );
  assert.throws(() => paginateReport([], [{ label: 'X', width: 0 }], () => area), /Ogiltiga/);
});
test('layout report area uses top-left coordinates and stays within page bounds', () => {
  const layout = { width: 210, height: 297 };
  assert.deepEqual(reportAreaFromPoints(layout, [15, 25], [195, 272]), {
    x: 15,
    y: 25,
    width: 180,
    height: 247,
  });
  assert.throws(
    () =>
      validateReportViewport({
        ...layout,
        reportViewport: { x: 190, y: 25, width: 50, height: 100 },
      }),
    /rymma/,
  );
  assert.equal(layoutAppliesTo(layout, 'drawing'), true);
  assert.equal(layoutAppliesTo(layout, 'report'), false);
  assert.equal(layoutAppliesTo({ usage: 'both' }, 'report'), true);
});
test('drawing report respects numeric sorting, filtering and status/handling codes', () => {
  const state = {
    drawings: [
      {
        id: '2',
        number: 'R-10',
        name: 'Plan',
        type: 'GA',
        issueStatus: 'GODKÄND | G1',
        documentType: 'BYGGHANDLING | BH',
      },
      {
        id: '1',
        number: 'R-2',
        name: 'Detalj',
        type: 'SP',
        issueStatus: ['PRELIMINÄR | PR', 'GRANSKNING | R-'],
      },
    ],
  };
  const cols = [
    { key: 'drawing.number' },
    { key: 'drawing.issueStatus' },
    { key: 'drawing.documentType' },
  ];
  assert.deepEqual(drawingReportRows(state, cols), [
    ['R-2', 'PR, R-', ''],
    ['R-10', 'G1', 'BH'],
  ]);
  assert.deepEqual(drawingReportRows(state, cols, { type: 'GA', search: 'bh' }), [
    ['R-10', 'G1', 'BH'],
  ]);
});
test('shared block attributes resolve report pagination and project data', () => {
  const context = {
    project: { name: 'Projekt A' },
    report: { pageNumber: 3, pageCount: 5, title: 'Ritningsförteckning' },
  };
  for (const [key, value] of [
    ['report.pageNumber', '3'],
    ['report.pageCount', '5'],
    ['report.title', 'Ritningsförteckning'],
    ['project.name', 'Projekt A'],
  ]) {
    assert.equal(
      frameText({ type: 'attribute', key, size: 3 }, context, attributeDrawingValue).value,
      value,
    );
  }
});
test('layouts referenced by report templates count as in use', () => {
  assert.deepEqual(
    libraryUsage(
      'report-layout',
      'layout',
      [],
      [],
      [{ name: 'Förteckning', first: 'report-layout', next: 'same' }],
    ),
    ['Rapportmall · Förteckning'],
  );
  assert.deepEqual(
    libraryUsage(
      'continuation',
      'layout',
      [],
      [],
      [{ name: 'Förteckning', first: 'first', next: 'continuation' }],
    ),
    ['Rapportmall · Förteckning'],
  );
});
