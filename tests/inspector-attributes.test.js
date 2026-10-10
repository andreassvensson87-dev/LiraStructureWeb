import test from 'node:test';
import assert from 'node:assert/strict';
import { defineAttributeSchema, createAttributeSelection } from '../src/inspector/attributes.js';
import { objectInspectorSchemas } from '../src/inspector/object-schemas.js';

test('inspector rejects duplicate fields and unknown controls or copy groups', () => {
  const schema = {
    fields: [{ key: 'size', type: 'number', copy: 'size' }],
    copyGroups: [['size', 'Mått']],
  };
  assert.equal(defineAttributeSchema(schema), schema);
  assert.throws(() =>
    defineAttributeSchema({ ...schema, fields: [...schema.fields, ...schema.fields] }),
  );
  assert.throws(() =>
    defineAttributeSchema({ ...schema, fields: [{ key: 'size', type: 'unknown' }] }),
  );
  assert.throws(() =>
    defineAttributeSchema({
      ...schema,
      fields: [{ key: 'size', type: 'number', copy: 'references' }],
    }),
  );
});

test('profile copy selection links all dimensions, excludes names by default, and stays independent of Plate', () => {
  const sweep = createAttributeSelection(objectInspectorSchemas.sweep);
  const plate = createAttributeSelection(objectInspectorSchemas.plate);
  const dimensions = objectInspectorSchemas.sweep.fields.filter((f) =>
    ['width', 'height', 'thickness'].includes(f.key),
  );
  assert.equal(sweep.has('name'), false);
  sweep.set('profile', false);
  assert.ok(dimensions.every((f) => !sweep.has(f.copy)));
  assert.equal(plate.has('thickness'), true);
  sweep.set('profile', true);
  assert.ok(dimensions.every((f) => sweep.has(f.copy)));
  assert.throws(() => sweep.set('coordinates', true));
  assert.equal(sweep.has('coordinates'), false);
});

test('object adapters keep cuts and generated objects outside ordinary inspectors', () => {
  const sweep = objectInspectorSchemas.sweep,
    plate = objectInspectorSchemas.plate;
  assert.ok(sweep.editable({ type: 'sweep' }));
  assert.ok(plate.editable({ type: 'plate' }));
  assert.equal(plate.editable({ type: 'plate', generatedBy: 'connection' }), false);
  assert.equal(sweep.editable({ type: 'sweep', generatedBy: 'connection' }), false);
  assert.equal(plate.editable({ type: 'polygoncut' }), false);
  assert.ok(plate.isCreating({ drawing: true, operation: { mode: 'plateCreate' } }));
  assert.equal(
    plate.isCreating({ drawing: true, operation: { mode: 'plateCreate', cutTargets: ['beam'] } }),
    false,
  );
  assert.equal(
    plate.isCreating({ drawing: true, operation: { mode: 'plateCreate', lineCut: true } }),
    false,
  );
});
