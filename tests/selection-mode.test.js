import test from 'node:test';
import assert from 'node:assert/strict';
import { modelSelection } from '../src/model/selection-mode.js';

const objects = [{ id: 'beam' }, { id: 'plate' }, { id: 'other' }];
const assemblies = [{ memberIds: ['beam', 'plate'] }];
test('part mode selects a part and assembly mode expands any member of its assembly', () => {
  assert.deepEqual([...modelSelection(objects, assemblies, ['plate'], 'part')], ['plate']);
  assert.deepEqual(
    new Set(modelSelection(objects, assemblies, ['plate'], 'assembly')),
    new Set(['beam', 'plate']),
  );
  assert.deepEqual([...modelSelection(objects, assemblies, ['other'], 'assembly')], ['other']);
});
test('assembly selection preserves multiple groups, skips missing members, and never changes the model', () => {
  const source = structuredClone(objects);
  const groups = [...assemblies, { memberIds: ['other', 'missing'] }];
  assert.deepEqual(
    modelSelection(objects, groups, ['beam', 'other'], 'assembly'),
    new Set(['beam', 'plate', 'other']),
  );
  assert.deepEqual(objects, source);
  assert.deepEqual([...modelSelection(objects, [], ['plate'], 'assembly')], ['plate']);
});
test('both modes retain complete fastener groups', () => {
  const fasteners = [
    { id: 'bolt1', group: { id: 'g' } },
    { id: 'bolt2', group: { id: 'g' } },
  ];
  for (const mode of ['part', 'assembly'])
    assert.deepEqual(modelSelection(fasteners, [], ['bolt2'], mode), new Set(['bolt1', 'bolt2']));
});
