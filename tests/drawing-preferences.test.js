import test from 'node:test';
import assert from 'node:assert/strict';
import {
  drawingFont,
  readDrawingPreferences,
  newDrawingTypography,
} from '../src/drawing-preferences.js';
import { mergeDrawingEdit } from '../src/project/drawing-edits.js';

test('new drawing takes a snapshot of defaults while old drawings keep their font', () => {
  let saved = JSON.stringify({ font: 'Verdana, sans-serif' });
  const previous = globalThis.localStorage;
  globalThis.localStorage = { getItem: () => saved };
  try {
    const drawing = { typography: newDrawingTypography() };
    saved = JSON.stringify({ font: 'Georgia, serif' });
    assert.equal(newDrawingTypography().font, 'Georgia, serif');
    assert.equal(drawingFont(drawing), 'Verdana, sans-serif');
    assert.equal(drawingFont({}), 'Arial, sans-serif');
    saved = '{invalid';
    assert.equal(readDrawingPreferences().font, 'Arial, sans-serif');
    saved = JSON.stringify({ font: 'untrusted font' });
    assert.equal(readDrawingPreferences().font, 'Arial, sans-serif');
  } finally {
    if (previous === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = previous;
  }
});
test('editing a drawing font is saved without changing numbering or other drawings', () => {
  const original = [
    { id: 'a', number: 'SP-001', typography: { font: 'Arial, sans-serif' } },
    { id: 'b' },
  ];
  const edit = { id: 'a', number: 'wrong', typography: { font: 'Georgia, serif' } };
  const next = mergeDrawingEdit(original, edit);
  assert.equal(next[0].number, 'SP-001');
  assert.equal(drawingFont(next[0]), 'Georgia, serif');
  assert.equal(drawingFont(original[0]), 'Arial, sans-serif');
  assert.equal(next[1], original[1]);
  edit.typography.font = 'Verdana, sans-serif';
  assert.equal(drawingFont(next[0]), 'Georgia, serif');
});
