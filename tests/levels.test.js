import test from 'node:test';
import assert from 'node:assert/strict';
import { initialLevels, validateLevels, levelElevation } from '../src/levels.js';
test('levels validate identities, names and elevations', () => {
  const state = initialLevels();
  assert.equal(levelElevation(validateLevels(state)), 0);
  state.items.push({ id: 'upper', name: 'Plan 2', elevation: 3500 });
  state.active = 'upper';
  assert.equal(levelElevation(validateLevels(state)), 3500);
  state.items[1].name = 'Plan 1';
  assert.throws(() => validateLevels(state));
  state.items[1].name = 'Plan 2';
  state.items[1].elevation = NaN;
  assert.throws(() => validateLevels(state));
});
