import test from 'node:test';
import assert from 'node:assert/strict';
import {
  nearestFitEnd,
  suggestFitEnds,
  pickFitReference,
} from '../src/components/fit-placement.js';
import { pointerCommand, installModelPointer } from '../src/model/pointer-controller.js';
import { modelKeyboardCommand } from '../src/model/keyboard-command.js';
const a = { id: 'a', start: [1000, 0, 0], end: [0, 0, 0] };
const b = { id: 'b', type: 'sweep', start: [0, 0, 0], end: [0, 1000, 0] };
test('click chooses the nearest end including reversed and inclined members', () => {
  assert.equal(nearestFitEnd(a, [900, 30, 0]), 'start');
  assert.equal(nearestFitEnd(a, [20, -30, 0]), 'end');
  assert.equal(
    nearestFitEnd({ start: [50, 50, 50], end: [500, 700, 900] }, [510, 680, 880]),
    'end',
  );
  assert.deepEqual(suggestFitEnds(a, b), { endA: 'end', endB: 'start' });
});
test('duplicate or non-sweep clicks cannot replace a reference', () => {
  const refs = { a: 'a', b: '' };
  assert.deepEqual(pickFitReference(refs, 'b', b, [0, 30, 0]), { id: 'b', end: 'start' });
  assert.throws(() => pickFitReference(refs, 'b', a, [0, 0, 0]), /annan sweep/);
  assert.throws(() => pickFitReference(refs, 'b', { type: 'plate' }, [0, 0, 0]), /sweep/);
  assert.throws(() => pickFitReference(refs, 'b', null, undefined), /sweep/);
  assert.deepEqual(refs, { a: 'a', b: '' });
});
test('Fit owns clicks and Enter only while in the correct phase; Escape always cancels', () => {
  assert.equal(pointerCommand({ mode: 'fit', picking: true, drawing: true }), 'fit-reference');
  assert.equal(pointerCommand({ mode: 'fit', picking: false, drawing: true }), null);
  const command = (key, picking) =>
    modelKeyboardCommand({ key }, { mode: 'fit', picking, hasSelection: true });
  assert.equal(command('Enter', false), 'confirm-fit');
  assert.equal(command('Enter', true), null);
  for (const key of ['Delete', 'Backspace', 'x']) assert.equal(command(key, true), null);
  assert.equal(command('Escape', true), 'cancel');
});
test('reference picks receive original pointer events without asking for a placement point', () => {
  const surface = new EventTarget();
  let clicks = 0,
    points = 0;
  const dispose = installModelPointer(surface, {
    getState: () => ({ mode: 'fit', picking: true, drawing: true }),
    beginBox: () => assert.fail('No selection box'),
    orbit() {},
    point: () => {
      points++;
    },
    actions: {
      'fit-reference': () => {
        clicks++;
      },
    },
    move() {},
    leave() {},
  });
  for (const type of ['pointerdown', 'pointerup']) {
    const e = new Event(type);
    Object.assign(e, { button: 0, pointerId: 1, clientX: 10, clientY: 10 });
    surface.dispatchEvent(e);
  }
  assert.equal(clicks, 1);
  assert.equal(points, 0);
  dispose();
});
