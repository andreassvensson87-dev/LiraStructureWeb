import test from 'node:test';
import assert from 'node:assert/strict';
import { modelKeyboardCommand as command } from '../src/model/keyboard-command.js';
test('typing cannot delete model objects and settings suppress model shortcuts', () => {
  assert.equal(command({ key: 'Backspace' }, { editing: true }), null);
  assert.equal(command({ key: 'Escape' }, { editing: true }), 'cancel');
  assert.equal(command({ key: 'Escape' }, { settingsOpen: true }), null);
});
test('active tools own their keys before global model shortcuts', () => {
  assert.equal(command({ key: 'Backspace' }, { mode: 'plateCreate' }), 'remove-plate-point');
  assert.equal(command({ key: 'Backspace' }, { mode: 'workPlane' }), 'remove-workplane-point');
  assert.equal(command({ key: '2' }, { mode: 'rotate', picking: false }), 'angle');
  assert.equal(command({ key: '2' }, { drawing: true, hasStart: true }), 'length');
  assert.equal(command({ key: 'x' }, { drawing: true, hasStart: true }), 'axis');
  assert.equal(command({ key: 'z', ctrlKey: true, shiftKey: true }, {}), 'redo');
});

test('fastener part picking confirms with Enter and consumes model deletion shortcuts', () => {
  const state = { mode: 'fastenerTargets', drawing: true };
  assert.equal(command({ key: 'Enter' }, state), 'confirm-fastener-targets');
  assert.equal(command({ key: 'Escape' }, state), 'cancel');
  assert.equal(command({ key: 'Delete' }, state), null);
  assert.equal(command({ key: 'Backspace' }, state), null);
  assert.equal(command({ key: 'Enter' }, { ...state, editing: true }), null);
});
