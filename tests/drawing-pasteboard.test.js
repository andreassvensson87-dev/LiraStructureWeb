import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pasteboardBounds, pasteboardSize } from '../src/drawing-pasteboard.js';
test('pasteboard includes paper and content outside all four edges', () => {
  assert.deepEqual(
    pasteboardBounds([420, 297], { x: -200, y: -100, width: 1000, height: 600 }),
    [-200, -100, 800, 500],
  );
  assert.deepEqual(
    pasteboardBounds([420, 297], { x: 10, y: 20, width: 30, height: 40 }),
    [0, 0, 420, 297],
  );
});
test('off-paper geometry remains reachable without changing paper scale or origin coordinates', () => {
  const p = pasteboardSize([420, 297], [-200, -100, 800, 500], 2, [900, 500]);
  assert.deepEqual(p, {
    width: 3800,
    height: 2200,
    x: 1300,
    y: 700,
    paperWidth: 840,
    paperHeight: 594,
  });
  assert.equal(p.x - 200 * 2, 900);
  assert.equal(p.y - 100 * 2, 500);
});
