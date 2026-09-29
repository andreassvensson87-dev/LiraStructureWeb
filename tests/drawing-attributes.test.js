import test from 'node:test';
import assert from 'node:assert/strict';
import {
  builtInAttributes,
  attributeValue,
  drawingAttributeContext,
  updateDrawingAttribute,
} from '../src/drawing-attributes.js';
const field = (key) => builtInAttributes.find((a) => a.key === key);
test('drawing metadata uses the same values for table and title block', () => {
  const records = [
    { id: 'a', type: 'GA', number: 'GA-001', name: 'Plan' },
    { id: 'b', number: 'GA-002' },
  ];
  const updated = updateDrawingAttribute(records, 'a', field('drawing.revision'), 'B');
  assert.equal(attributeValue('drawing.revision', drawingAttributeContext(updated[0])), 'B');
  assert.equal(records[0].revision, undefined);
  assert.throws(() => updateDrawingAttribute(records, 'a', field('drawing.number'), 'GA-002'));
  assert.throws(() => updateDrawingAttribute(records, 'a', field('drawing.name'), ' '));
});
test('model attributes are read only and restricted to relevant drawing type', () => {
  const state = {
    objects: [{ id: 'a', material: { name: 'S355' } }, { id: 'b' }],
    parts: { assignments: { a: { key: 'same' }, b: { key: 'same' } } },
    levels: { items: [{ id: 'l', name: 'Plan 1' }] },
  };
  const record = { id: 'd', type: 'SP', sourceId: 'a', partKey: 'same', mark: 'B-001' };
  const ctx = drawingAttributeContext(record, state);
  assert.equal(attributeValue('drawing.material', ctx), 'S355');
  assert.equal(attributeValue('drawing.quantity', ctx), '2');
  assert.equal(attributeValue('drawing.partMark', ctx), 'B-001');
  assert.equal(
    attributeValue('drawing.material', { drawing: { type: 'GA', material: 'wrong' } }),
    '',
  );
  const records = [record];
  assert.equal(updateDrawingAttribute(records, 'd', field('drawing.partMark'), 'BAD'), records);
});
test('custom attributes keep stable identifiers and support applicability', () => {
  const attribute = {
    key: 'custom.stable',
    name: 'Ny rubrik',
    editable: true,
    scope: 'GA',
    dataType: 'number',
  };
  const records = [
    { id: 'a', type: 'GA' },
    { id: 'b', type: 'SP' },
  ];
  const updated = updateDrawingAttribute(records, 'a', attribute, '42');
  assert.equal(attributeValue(attribute.key, drawingAttributeContext(updated[0])), '42');
  assert.equal(updateDrawingAttribute(records, 'b', attribute, '5'), records);
  assert.throws(() => updateDrawingAttribute(records, 'a', attribute, 'text'));
});
