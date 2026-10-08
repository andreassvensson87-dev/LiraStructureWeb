import test from 'node:test';
import assert from 'node:assert/strict';
import { stepSweepPlacement, quarterTurnSweep } from '../src/model/sweep-shortcuts.js';
import { profileAnchor, sweepFrame } from '../src/sweep.js';

const sweep = {
  id: 's',
  profile: 'rect',
  width: 100,
  height: 200,
  rotation: 0,
  start: [0, 0, 0],
  end: [1000, 0, 0],
};

test('arrow shortcuts move the local anchor one cell, clamp at edges and preserve the axis', () => {
  for (const [key, anchor] of [
    ['ArrowLeft', [-50, 0]],
    ['ArrowRight', [50, 0]],
    ['ArrowUp', [0, 100]],
    ['ArrowDown', [0, -100]],
  ]) {
    const before = structuredClone(sweep),
      next = stepSweepPlacement(sweep, key);
    assert.deepEqual(profileAnchor(next), anchor);
    assert.deepEqual(stepSweepPlacement(next, key), next);
    assert.deepEqual(next.start, sweep.start);
    assert.deepEqual(next.end, sweep.end);
    assert.deepEqual(sweep, before);
  }
  const corner = stepSweepPlacement(stepSweepPlacement(sweep, 'ArrowLeft'), 'ArrowUp');
  assert.deepEqual(profileAnchor(corner), [-50, 100]);
  assert.deepEqual(profileAnchor(stepSweepPlacement(corner, 'ArrowDown')), [-50, 0]);
});

test('quarter turns rotate around the sweep axis and retain each object’s relative angle', () => {
  const next = quarterTurnSweep(sweep),
    frame = sweepFrame(sweep),
    rotated = sweepFrame(next);
  assert.equal(next.rotation, 90);
  assert.deepEqual(rotated.axis.toArray(), frame.axis.toArray());
  assert.ok(Math.abs(rotated.x.dot(frame.x)) < 1e-10);
  assert.equal(quarterTurnSweep({ ...sweep, rotation: 315 }).rotation, 45);
  assert.equal(quarterTurnSweep({ ...sweep, rotation: -180 }).rotation, 270);
  assert.equal(quarterTurnSweep(quarterTurnSweep(quarterTurnSweep(next))).rotation, 0);
  assert.equal(sweep.rotation, 0);
});
