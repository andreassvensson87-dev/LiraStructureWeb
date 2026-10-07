import test from 'node:test';
import assert from 'node:assert/strict';
import { DrawingAnnotations } from '../src/drawing-annotations.js';
import { defaultCadSettings } from '../src/cad-statusbar.js';
function editor(settings) {
  return Object.assign(Object.create(DrawingAnnotations.prototype), {
    mode: 'line',
    workflow: 'shape',
    draft: { points: [[0, 0]] },
    items: [],
    cad: { get: () => ({ ...defaultCadSettings, ...settings }), coordinates() {} },
    adapter: {
      locate: () => ({ view: 'v', point: [10, 5] }),
      project: (p) => p,
      pixelScale: () => 1,
      candidates: () => [[10, 5]],
      gridSnap: () => [10, 5],
    },
  });
}
test('Ortho rejects off-axis model and grid snaps instead of creating a sloping line', () => {
  assert.deepEqual(
    editor({ ortho: true }).location({ clientX: 0, clientY: 0 }, 'v').point,
    [10, 0],
  );
});
test('turning Snap off suppresses model and grid candidates without changing free coordinates', () => {
  const hit = editor({ snap: false }).location({ clientX: 0, clientY: 0 }, 'v');
  assert.deepEqual(hit.point, [10, 5]);
  assert.equal(hit.snapped, undefined);
});
