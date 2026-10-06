import test from 'node:test';
import assert from 'node:assert/strict';
import { pdfFileName, pdfPageSize } from '../src/drawing-pdf.js';
test('PDF pages preserve millimetres, orientation and custom formats', () => {
  assert.deepEqual(pdfPageSize(420, 297), { width: 420, height: 297, orientation: 'landscape' });
  assert.equal(pdfPageSize(297, 420).orientation, 'portrait');
  assert.equal(pdfPageSize(900, 300).width, 900);
  for (const width of [0, NaN, Infinity, 5001])
    assert.throws(() => pdfPageSize(width, 297), /format/);
});
test('PDF filenames use drawing numbers safely and batch exports use a combined file', () => {
  assert.equal(pdfFileName([{ number: 'GA-001' }]), 'GA-001.pdf');
  assert.equal(pdfFileName([{ number: 'A/B:1' }]), 'A_B_1.pdf');
  assert.equal(pdfFileName([{ number: 'A' }, { number: 'B' }]), 'Ritningar.pdf');
});
