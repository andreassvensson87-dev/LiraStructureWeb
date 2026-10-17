import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { resolveSnap } from '../src/snap.js';
import { createToolSession, resetToolInteraction } from '../src/model/tool-session.js';
import { installModelPointer } from '../src/model/pointer-controller.js';
import {
  nextPointSnapSettings,
  nextPointReferenceCandidates,
  acceptsNextPointSnap,
  consumeNextPointSnap,
} from '../src/model/next-point-snap.js';

const preferences = Object.freeze({
  endpoints: true,
  corners: true,
  quadrants: true,
  midpoints: false,
  perpendicular: false,
  nearest: true,
  gridLines: true,
  gridIntersections: true,
  gridStepEnabled: true,
  gridStep: 250,
  axes: true,
  polar: 45,
});
function snapAt(target, choice, extra = {}) {
  const settings = nextPointSnapSettings(preferences, choice);
  const camera = new THREE.OrthographicCamera(-2000, 2000, 2000, -2000, 1, 20000);
  camera.position.set(0, 0, 10000);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  const projected = new THREE.Vector3(...target).project(camera);
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(new THREE.Vector2(projected.x, projected.y), camera);
  return resolveSnap({
    camera,
    ray: raycaster.ray,
    pointer: [(projected.x + 1) * 500, (1 - projected.y) * 500],
    width: 1000,
    height: 1000,
    start: [0, -500, 0],
    z: 0,
    sweeps: [{ id: 'line', type: 'helperline', start: [-1000, 0, 0], end: [1000, 0, 0] }],
    grid: { x: [], y: [] },
    endpoints: settings.endpoints,
    cornerSnap: settings.corners,
    quadrantSnap: settings.quadrants,
    midpointSnap: settings.midpoints,
    perpendicularSnap: settings.perpendicular,
    nearestSnap: settings.nearest,
    gridLines: settings.gridLines,
    gridIntersections: settings.gridIntersections,
    gridStepEnabled: settings.gridStepEnabled,
    gridStep: settings.gridStep,
    axisSnap: settings.axes,
    polar: settings.polar,
    ...extra,
  });
}
test('one-point midpoint overrides competing snaps and grid rounding without changing preferences', () => {
  const before = structuredClone(preferences);
  const midpoint = snapAt([3, 2, 0], 'midpoints');
  assert.equal(midpoint.symbol, 'midpoint');
  assert.deepEqual(midpoint.point, [0, 0, 0]);
  const miss = snapAt([900, 100, 0], 'midpoints');
  assert.equal(acceptsNextPointSnap(miss, 'midpoints'), false);
  assert.equal(snapAt([3, 2, 0], null).symbol === 'midpoint', false);
  assert.deepEqual(preferences, before);
  assert.equal(nextPointSnapSettings(preferences, null), preferences);
});
test('free point disables rounding and nearest snaps while retaining explicit axis constraints', () => {
  const free = snapAt([123, 7, 0], 'free');
  assert.ok(Math.abs(free.point[0] - 123) < 1e-8);
  assert.ok(Math.abs(free.point[1] - 7) < 1e-8);
  const locked = snapAt([123, 7, 0], 'free', { lock: 'X' });
  assert.equal(locked.point[1], -500);
  assert.equal(acceptsNextPointSnap(locked, 'free'), true);
});
test('reference candidates cannot steal an exclusive midpoint or perpendicular choice', () => {
  const candidates = [
    { symbol: 'square', coords: [0, 0, 0] },
    { symbol: 'perpendicular', coords: [10, 0, 0] },
    { symbol: 'line', edge: true, coords: [20, 0, 0] },
  ];
  assert.deepEqual(nextPointReferenceCandidates(candidates, 'midpoints'), []);
  assert.deepEqual(nextPointReferenceCandidates(candidates, 'perpendicular'), [candidates[1]]);
  assert.deepEqual(nextPointReferenceCandidates(candidates, 'nearest'), [candidates[2]]);
});
test('preview, rejected points, right click and cancelled gestures retain override; one placed point consumes it', () => {
  const tools = createToolSession();
  tools.nextPointSnap = 'midpoints';
  const surface = new EventTarget();
  let result = null,
    placed = 0,
    accept = false;
  const dispose = installModelPointer(surface, {
    getState: () => ({ drawing: true }),
    beginBox() {},
    orbit() {},
    point: () => result,
    consumePoint: () => consumeNextPointSnap(tools),
    actions: {
      start: () => {
        if (!accept) return false;
        placed++;
        return true;
      },
    },
    move() {},
    leave() {},
  });
  const send = (type, button = 0) =>
    surface.dispatchEvent(
      Object.assign(new Event(type), {
        button,
        pointerId: 1,
        clientX: 100,
        clientY: 200,
      }),
    );
  send('pointermove');
  send('pointerdown');
  send('pointerup');
  send('pointerdown', 2);
  send('pointerup', 2);
  send('pointerdown');
  send('pointercancel');
  send('pointerup');
  assert.equal(tools.nextPointSnap, 'midpoints');
  assert.equal(placed, 0);
  result = [0, 0, 0];
  send('pointerdown');
  send('pointerup');
  assert.equal(placed, 0);
  assert.equal(tools.nextPointSnap, 'midpoints');
  accept = true;
  send('pointerdown');
  send('pointerup');
  assert.equal(placed, 1);
  assert.equal(tools.nextPointSnap, null);
  tools.nextPointSnap = 'nearest';
  resetToolInteraction(tools);
  assert.equal(tools.nextPointSnap, null);
  dispose();
});
