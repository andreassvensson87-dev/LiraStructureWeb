import test from 'node:test';
import assert from 'node:assert/strict';
import { CadTracking, constrainCadPoint } from '../src/cad-tracking.js';

test('Otrack acquires a hovered snap after dwelling and tracks each axis without changing the anchor', () => {
  const tracker = new CadTracking(),
    anchor = [100, 50];
  tracker.locate(anchor, { snapped: true, point: anchor, now: 0, view: 'top' });
  assert.deepEqual(tracker.locate([102, 90], { now: 100, view: 'top', tolerance: 4 }).guides, []);
  tracker.locate(anchor, { snapped: true, point: anchor, now: 200, view: 'top' });
  const x = tracker.locate([102, 90], { now: 600, view: 'top', tolerance: 4 });
  assert.deepEqual(x.point, [100, 90]);
  assert.deepEqual(x.guides, [{ anchor: [100, 50], axis: 0 }]);
  assert.deepEqual(
    tracker.locate([180, 52], { now: 700, view: 'top', tolerance: 4 }).point,
    [180, 50],
  );
  assert.deepEqual(tracker.locate([180, 70], { now: 800, view: 'top', tolerance: 4 }).guides, []);
  assert.deepEqual(anchor, [100, 50]);
});
test('Otrack combines two anchors, respects point snaps and clears when changing views or cancelling', () => {
  const tracker = new CadTracking();
  tracker.locate([10, 10], { snapped: true, now: 0, view: 'a' });
  tracker.locate([20, 30], { snapped: true, now: 400, view: 'a' });
  const both = tracker.locate([11, 31], { now: 800, view: 'a', tolerance: 2 });
  assert.deepEqual(both.point, [10, 30]);
  assert.equal(both.guides.length, 2);
  const snap = tracker.locate([11, 31], {
    snapped: true,
    point: [11, 31],
    now: 900,
    view: 'a',
    tolerance: 2,
  });
  assert.deepEqual(snap.point, [11, 31]);
  assert.equal(snap.guides.length, 0);
  assert.deepEqual(tracker.locate([11, 31], { now: 1500, view: 'b', tolerance: 2 }).guides, []);
  tracker.reset();
  assert.deepEqual(tracker.points, []);
});
test('orthogonal and polar constraints project distances and release polar away from a direction', () => {
  assert.deepEqual(constrainCadPoint([10, 3], [0, 0], { ortho: true }), [10, 0]);
  const vertical = constrainCadPoint([3, 10], [0, 0], { ortho: true });
  assert.ok(Math.abs(vertical[0]) < 1e-9);
  assert.equal(vertical[1], 10);
  const diagonal = constrainCadPoint([10, 11], [0, 0], { polar: 45, tolerance: 1 });
  assert.ok(Math.abs(diagonal[0] - 10.5) < 1e-9);
  assert.ok(Math.abs(diagonal[1] - 10.5) < 1e-9);
  assert.deepEqual(constrainCadPoint([10, 4], [0, 0], { polar: 45, tolerance: 1 }), [10, 4]);
  assert.deepEqual(constrainCadPoint([10, 4], null, { ortho: true }), [10, 4]);
});
