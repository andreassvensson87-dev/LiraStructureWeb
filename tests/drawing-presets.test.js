import test from 'node:test';
import assert from 'node:assert/strict';
import { applyDrawingPreset, normalizePreset, readDrawingPresets } from '../src/drawing-presets.js';
import { ensurePartViews } from '../src/drawing-views.js';
import { mergeDrawingEdit } from '../src/project/drawing-edits.js';
test('preset snapshots survive library edits and keep drawing geometry and view positions', () => {
  const preset = normalizePreset({
    id: 'steel',
    name: 'Stål',
    font: 'Georgia, serif',
    hiddenLines: false,
    dimensionSize: 4,
    leaderSize: 3,
    layoutId: 'a3',
  });
  const record = {
    id: 'drawing',
    type: 'SP',
    sheet: {
      paper: { width: 420, height: 297 },
      views: [{ id: 'front', position: [12, 34], settings: { section: 500 } }],
    },
    annotations: [
      {
        type: 'dimension',
        points: [
          [1, 2],
          [3, 4],
        ],
      },
      { type: 'leader', textSize: 9 },
    ],
  };
  applyDrawingPreset(record, preset);
  preset.name = 'Ändrad';
  preset.dimensionSize = 7;
  assert.equal(record.drawingPreset.name, 'Stål');
  assert.equal(record.annotations[0].textSize, 4);
  assert.equal(record.annotations[1].textSize, 3);
  assert.deepEqual(record.sheet.views[0].position, [12, 34]);
  assert.equal(record.sheet.views[0].settings.section, 500);
  assert.equal(record.sheet.views[0].settings.hiddenLines, false);
  assert.equal(record.sheet.layoutId, 'a3');
  const saved = mergeDrawingEdit([{ id: 'drawing' }], record);
  assert.equal(saved[0].drawingPreset.name, 'Stål');
});
test('automatic visibility keeps GA hidden lines off and Single Part on', () => {
  assert.equal(applyDrawingPreset({ type: 'GA' }, {}).settings.hiddenLines, false);
  assert.equal(applyDrawingPreset({ type: 'SP' }, {}).settings.hiddenLines, true);
  const record = applyDrawingPreset({ type: 'SP', sourceId: 'p' }, { hiddenLines: false });
  record.sheet = { section: 0 };
  assert.ok(ensurePartViews(record).every((v) => v.settings.hiddenLines === false));
});
test('preset library migrates legacy font and recovers corrupt storage', () => {
  const old = globalThis.localStorage;
  try {
    globalThis.localStorage = {
      getItem: (key) =>
        key.includes('drawing-presets') ? null : JSON.stringify({ font: 'Verdana, sans-serif' }),
    };
    assert.equal(readDrawingPresets().items[0].font, 'Verdana, sans-serif');
    globalThis.localStorage = { getItem: () => '{bad' };
    assert.equal(readDrawingPresets().items[0].font, 'Arial, sans-serif');
  } finally {
    if (old === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = old;
  }
});
