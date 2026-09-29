import test from 'node:test';
import assert from 'node:assert/strict';
import { endpointAtLength } from '../src/length-input.js';
test('exact length preserves signed 3D direction without 100 mm rounding', () => {
  assert.deepEqual(endpointAtLength([10, 20, 30], [0, 0, -2000], '1234,5'), [10, 20, -1204.5]);
  const end = endpointAtLength([0, 0, 0], [1, 1, 1], '3210.25');
  assert.ok(Math.abs(Math.hypot(...end) - 3210.25) < 1e-9);
  assert.equal(end[0], end[2]);
});
test('invalid lengths, missing direction and out of bounds endpoints are rejected', () => {
  for (const v of ['', '0', '-4', 'Infinity', 'foo', '1,2,3'])
    assert.throws(() => endpointAtLength([0, 0, 0], [1, 0, 0], v));
  assert.throws(() => endpointAtLength([0, 0, 0], null, '100'));
  assert.throws(() => endpointAtLength([0, 0, 0], [0, 0, 0], '100'));
  assert.throws(() => endpointAtLength([0, 0, 0], [1, 0, 0], '10000001'));
});
