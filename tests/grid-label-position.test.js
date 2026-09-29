import { test } from 'node:test';
import assert from 'node:assert/strict';
import { visibleGridEndpoints } from '../src/grid-label-position.js';
test('cropped grid bubbles stay at visible ends inside viewport', () => {
  assert.deepEqual(visibleGridEndpoints([50, -100], [50, 300], 100, 200), [
    [50, 16],
    [50, 184],
  ]);
  assert.deepEqual(visibleGridEndpoints([-100, 50], [300, 50], 200, 100), [
    [16, 50],
    [184, 50],
  ]);
});
test('uncropped ends remain fixed and reversed lines keep endpoint order', () => {
  assert.deepEqual(visibleGridEndpoints([30, 50], [170, 50], 200, 100), [
    [30, 50],
    [170, 50],
  ]);
  assert.deepEqual(visibleGridEndpoints([300, 50], [-100, 50], 200, 100), [
    [184, 50],
    [16, 50],
  ]);
});
test('finite lines fully outside the crop do not acquire bubbles', () => {
  assert.equal(visibleGridEndpoints([300, 50], [400, 50], 200, 100), null);
  assert.equal(visibleGridEndpoints([-5, -100], [-5, 300], 100, 200), null);
});
test('diagonal lines clip at intersections and very small viewports remain bounded', () => {
  assert.deepEqual(visibleGridEndpoints([-100, -100], [300, 300], 200, 200), [
    [16, 16],
    [184, 184],
  ]);
  assert.deepEqual(visibleGridEndpoints([5, -10], [5, 30], 10, 20), [
    [5, 10],
    [5, 10],
  ]);
});
