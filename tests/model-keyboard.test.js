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

test('transform shortcuts use the current selection and can switch active tools', () => {
  for (const [key, expected] of [
    ['m', 'move'],
    ['c', 'copy'],
    ['r', 'rotate'],
  ]) {
    for (const modifier of ['ctrlKey', 'metaKey']) {
      const event = { key: key.toUpperCase(), [modifier]: true };
      assert.equal(command(event, { hasSelection: true }), expected);
      assert.equal(
        command(event, { hasSelection: true, mode: 'rotate', picking: 'start' }),
        expected,
      );
      assert.equal(command({ ...event, repeat: true }, { hasSelection: true }), 'consume');
      assert.equal(command(event, { hasSelection: false }), null);
      assert.equal(command(event, { hasSelection: true, editing: true }), null);
      assert.equal(command(event, { hasSelection: true, modalOpen: true }), null);
      assert.equal(command(event, { hasSelection: true, settingsOpen: true }), null);
      assert.equal(command({ ...event, altKey: true }, { hasSelection: true }), null);
      assert.equal(command({ ...event, shiftKey: true }, { hasSelection: true }), null);
    }
    assert.equal(command({ key }, { hasSelection: true }), null);
  }
});

test('sweep shortcuts require editable sweeps and leave fields and active tools alone', () => {
  for (const key of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ']) {
    const event = { key, shiftKey: true },
      state = { hasEditableSweeps: true };
    assert.equal(command(event, state), key === ' ' ? 'sweep-profile-rotation' : 'sweep-placement');
    for (const blocked of [
      { hasEditableSweeps: false },
      { editing: true },
      { modalOpen: true },
      { settingsOpen: true },
      { drawing: true },
      { mode: 'move' },
    ])
      assert.equal(command(event, { ...state, ...blocked }), null);
    for (const modifier of ['ctrlKey', 'metaKey', 'altKey'])
      assert.equal(command({ ...event, [modifier]: true }, state), null);
    assert.equal(command({ key }, state), null);
    assert.equal(command({ key, altKey: true }, state), null);
    assert.equal(
      command({ ...event, repeat: true }, state),
      key === ' ' ? 'consume' : 'sweep-placement',
    );
  }
});
