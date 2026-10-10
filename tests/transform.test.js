import test from 'node:test';
import assert from 'node:assert/strict';
import { transformCandidates } from '../src/model/tools/transform-tool.js';
const transformSweep = (source, mode, base, target) =>
  transformCandidates({ mode, sources: [source] }, base, target)[0];
import { validateSweep } from '../src/sweep.js';
const source = {
  id: 'original',
  start: [100, 200, 300],
  end: [2100, 2200, 3300],
  rotation: 37,
  width: 200,
  height: 300,
  thickness: 12,
  profile: 'rhs',
  placement: { horizontalAlignment: 'right', verticalAlignment: 'top' },
};
test('translation uses base point offset and preserves shape and source', () => {
  for (const mode of ['move', 'copy']) {
    const s = transformSweep(source, mode, [1000, 2000, 3000], [900, 2500, 4200]);
    assert.deepEqual(s.start, [0, 700, 1500]);
    assert.deepEqual(s.end, [2000, 2700, 4500]);
    assert.equal(s.rotation, 37);
    assert.deepEqual(s.placement, source.placement);
    assert.deepEqual(source.start, [100, 200, 300]);
  }
});
test('moving one insertion point leaves other point fixed and detects collapsed sweep', () => {
  assert.deepEqual(transformSweep(source, 'start', source.start, [99, 88, 77]).end, source.end);
  assert.deepEqual(transformSweep(source, 'end', source.end, [99, 88, 77]).start, source.start);
  assert.ok(validateSweep(transformSweep(source, 'end', source.end, source.start)));
});
