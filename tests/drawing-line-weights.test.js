import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lineWeights, lineWeightValue } from '../src/drawing-line-weights.js';
test('named line weights map to paper thickness while arbitrary and mixed values remain custom', () => {
  for (const [value] of lineWeights) assert.equal(lineWeightValue(value), value);
  assert.equal(lineWeightValue('0.50'), 0.5);
  assert.equal(lineWeightValue(0.22), 'custom');
  assert.equal(lineWeightValue(''), 'custom');
  assert.equal(lineWeightValue(NaN), 'custom');
});
