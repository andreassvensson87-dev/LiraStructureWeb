import test from 'node:test';
import assert from 'node:assert/strict';
import { paperSize, standardPapers, validatePaper, sheetLayout } from '../src/paper-formats.js';
test('paper size uses mm with explicit orientation', () => {
  assert.deepEqual(paperSize(standardPapers[1], true), [420, 297]);
  assert.deepEqual(paperSize(standardPapers[1], false), [297, 420]);
  assert.throws(() => validatePaper({ name: 'X', width: 0, height: 297 }));
  assert.throws(() => validatePaper({ name: '', width: 420, height: 297 }));
});
test('sheet layout aligns top with front and section alongside in paper scale', () => {
  const b = { min: { x: 0, y: -100, z: -150 }, max: { x: 3000, y: 100, z: 150 } },
    l = sheetLayout(b, 10, [420, 297]);
  assert.ok(l.topY < l.y);
  assert.equal(l.sectionX - l.x, 325);
  assert.ok(l.x >= 15);
});
test('independent scales reserve room for the largest longitudinal view', () => {
  const bounds = { min: { x: 0, y: -100, z: -150 }, max: { x: 3000, y: 100, z: 150 } },
    l = sheetLayout(bounds, { top: 5, front: 20, section: 2 }, [841, 594]);
  assert.equal(l.sectionX - l.x, 625);
  assert.equal(l.y - l.topY, 7.5 + 20 + 32);
});
