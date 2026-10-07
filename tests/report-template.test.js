import test from 'node:test';
import assert from 'node:assert/strict';
import templates from '../src/bundled-drawing-templates.js';
import {
  a4ReportLayout,
  installReportTemplates,
  installFullFrameReportTables,
} from '../src/install-report-templates.js';
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

test('full-frame migration upgrades bundled presets once and preserves custom geometry and fonts', () => {
  const old = { ...a4ReportLayout, reportViewport: { x: 23, y: 61, width: 174, height: 223 } };
  const custom = { id: 'custom', reportViewport: { x: 5, y: 5, width: 100, height: 100 } };
  const preset = { id: 'mall-report-material-a4', tableStyle: { font: 'serif', paddingY: 3 } };
  const values = new Map([
    [LAYOUT_KEY, JSON.stringify([old, custom])],
    [REPORT_TEMPLATE_KEY, JSON.stringify([preset, { id: 'custom' }])],
  ]);
  const storage = {
    getItem: (k) => values.get(k) ?? null,
    setItem: (k, v) => values.set(k, v),
    removeItem: (k) => values.delete(k),
  };
  installFullFrameReportTables(storage);
  const layouts = JSON.parse(values.get(LAYOUT_KEY));
  assert.deepEqual(layouts[0].reportViewport, a4ReportLayout.reportViewport);
  assert.deepEqual(layouts[1], custom);
  const presets = JSON.parse(values.get(REPORT_TEMPLATE_KEY));
  assert.equal(presets[0].tableStyle.font, 'serif');
  assert.equal(presets[0].tableStyle.paddingY, 3);
  assert.equal(presets[0].tableStyle.tableOnly, true);
  assert.equal(presets[0].tableStyle.borderColor, '#000000');
  assert.deepEqual(presets[1], { id: 'custom' });
  values.set(LAYOUT_KEY, '[]');
  installFullFrameReportTables(storage);
  assert.equal(values.get(LAYOUT_KEY), '[]');
});
