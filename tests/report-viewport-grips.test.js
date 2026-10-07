import test from 'node:test';
import assert from 'node:assert/strict';
import {
  reportViewportEntity,
  reportViewportGrips,
  editReportViewport,
} from '../src/report-viewport-grips.js';
import { validateReportViewport } from '../src/report-layout.js';
const layout = {
  width: 210,
  height: 297,
  reportViewport: { x: 20, y: 56, width: 180, height: 231, fillViewport: false },
};
test('report viewport maps top-left paper coordinates to CAD corners and nine grips', () => {
  assert.deepEqual(reportViewportEntity(layout).points, [
    [20, 10],
    [200, 10],
    [200, 241],
    [20, 241],
    [20, 10],
  ]);
  const grips = reportViewportGrips(layout);
  assert.equal(grips.length, 9);
  assert.deepEqual(grips.at(-1), { point: [110, 125.5], index: -1 });
  assert.equal(reportViewportEntity({ height: 297 }), null);
});
test('viewport translation and resize keep the opposite edges and saved fill preference', () => {
  assert.deepEqual(editReportViewport(layout, [110, 125.5], [105, 130.5]), {
    x: 15,
    y: 51,
    width: 180,
    height: 231,
    fillViewport: false,
  });
  assert.deepEqual(editReportViewport(layout, [200, 241], [195, 230], 2), {
    x: 20,
    y: 67,
    width: 175,
    height: 220,
    fillViewport: false,
  });
  assert.deepEqual(editReportViewport(layout, [110, 10], [999, 20], 4), {
    x: 20,
    y: 56,
    width: 180,
    height: 221,
    fillViewport: false,
  });
  assert.deepEqual(layout.reportViewport, {
    x: 20,
    y: 56,
    width: 180,
    height: 231,
    fillViewport: false,
  });
});
test('invalid viewport edits reject collapsed, flipped and off-sheet areas before commit', () => {
  for (const [base, target, index] of [
    [[0, 0], [30, 0], -1],
    [[200, 241], [25, 241], 2],
    [[20, 10], [205, 10], 0],
    [[20, 241], [20, 300], 3],
  ])
    assert.throws(() => editReportViewport(layout, base, target, index), /Rapportytan/);
  assert.throws(
    () =>
      validateReportViewport({
        ...layout,
        reportViewport: { ...layout.reportViewport, fillViewport: 'yes' },
      }),
    /Rapportytan/,
  );
});
