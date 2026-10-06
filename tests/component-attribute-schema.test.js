import test from 'node:test';
import assert from 'node:assert/strict';
import { componentInspectorSchema } from '../src/inspector/component-schemas.js';
import { componentDefinition } from '../src/components/definitions.js';
import { createAttributeSelection } from '../src/inspector/attributes.js';

test('each connection schema includes every declared parameter exactly once in its sections', () => {
  for (const kind of [
    'fit',
    'baseplate',
    'stiffener',
    'endplate',
    'boltedEndplate',
    'beamSplice',
  ]) {
    const schema = componentInspectorSchema(kind);
    const expected = componentDefinition(kind)
      .parameters.map((p) => p.key)
      .sort();
    assert.deepEqual(schema.fields.map((f) => f.key).sort(), expected);
    assert.deepEqual(schema.groups.flatMap((g) => g.fields).sort(), expected);
    assert.ok(schema.fields.every((f) => f.selector === `#component-parameter-${f.key}`));
  }
});

test('schema keeps custom fastener controls and conditional plate dimensions', () => {
  const schema = componentInspectorSchema('boltedEndplate');
  assert.equal(schema.fields.find((f) => f.key === 'boltSpec').type, 'custom');
  const width = schema.fields.find((f) => f.key === 'width');
  assert.equal(width.unit, 'mm');
  assert.equal(width.visibleWhen({ draft: { sizeMode: 'outstand' } }), false);
  assert.equal(width.visibleWhen({ draft: { sizeMode: 'manual' } }), true);
  const fit = componentInspectorSchema('fit');
  assert.equal(fit.fields.find((f) => f.key === 'gap').type, 'number');
  assert.equal(fit.fields.find((f) => f.key === 'mode').type, 'select');
});

test('all connection types expose copyable properties with local placement unchecked', () => {
  const schema = componentInspectorSchema('boltedEndplate'),
    selection = createAttributeSelection(schema);
  assert.equal(selection.has('thickness'), true);
  assert.equal(selection.has('gap'), false);
  assert.equal(selection.has('offsetX'), false);
  assert.equal(selection.has('offsetY'), false);
  assert.equal(selection.has('endB'), false);
  selection.set('endB', true);
  assert.equal(selection.has('endB'), true);
  for (const kind of ['fit', 'baseplate', 'stiffener', 'endplate', 'beamSplice'])
    assert.ok(componentInspectorSchema(kind).copyGroups.length > 0);
});
