import test from 'node:test';
import assert from 'node:assert/strict';
import templates from '../src/bundled-drawing-templates.js';
import { a4ReportLayout, installReportTemplates } from '../src/install-report-templates.js';
import { FRAME_LIBRARY_KEY } from '../src/frame-model.js';
import { LAYOUT_KEY, expandLayout } from '../src/frame-layout.js';
import { REPORT_TEMPLATE_KEY, validateReportViewport } from '../src/report-layout.js';

test('A4 report places the original header at the top and the table inside the original frame', () => {
  const header = expandLayout(
    { ...a4ReportLayout, entities: [a4ReportLayout.entities[1]] },
    templates.blocks,
  );
  const points = header.filter((entity) => entity.points).flatMap((entity) => entity.points);
  assert.equal(Math.min(...points.map((p) => p[0])), 20);
  assert.equal(Math.max(...points.map((p) => p[0])), 200);
  assert.equal(Math.min(...points.map((p) => p[1])), 241);
  assert.equal(Math.max(...points.map((p) => p[1])), 287);
  const area = validateReportViewport(a4ReportLayout);
  assert.deepEqual(area, { x: 20, y: 56, width: 180, height: 231 });
});

test('report preset installation preserves existing libraries and later changes', () => {
  const saved = { id: 'custom-layout', name: 'Egen layout' };
  const values = new Map([[LAYOUT_KEY, JSON.stringify([saved])]]);
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
  installReportTemplates(storage);
  assert.deepEqual(JSON.parse(values.get(LAYOUT_KEY))[0], saved);
  assert.equal(JSON.parse(values.get(FRAME_LIBRARY_KEY)).length, 2);
  const preset = JSON.parse(values.get(REPORT_TEMPLATE_KEY))[0];
  assert.equal(preset.first, a4ReportLayout.id);
  assert.equal(preset.columns.length, 7);
  values.set(LAYOUT_KEY, '[]');
  installReportTemplates(storage);
  assert.equal(values.get(LAYOUT_KEY), '[]');
});
