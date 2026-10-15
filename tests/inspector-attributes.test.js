import { objectInspectorContext } from '../src/inspector/object-context.js';
import { applyObjectDraft } from '../src/model/object-draft.js';
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

test('create and edit resolve the same object families without treating selection tools as creation', () => {
  for (const [mode, type] of [
    [null, 'sweep'],
    ['plateCreate', 'plate'],
    ['polysweepCreate', 'polysweep'],
    ['itemCreate', 'item'],
    ['fastenerCreate', 'fastener'],
  ]) {
    const creating = objectInspectorContext({ drawing: true, operation: mode ? { mode } : null });
    assert.equal(creating.mode, 'create');
    assert.equal(creating.type, type);
    assert.equal(creating.locked, false);
    const object = { type, id: 'saved' },
      editing = objectInspectorContext({ selected: [object], drawing: false });
    assert.equal(editing.type, type);
    assert.equal(editing.mode, 'edit');
    assert.equal(editing.object, object);
  }
  assert.equal(
    objectInspectorContext({ drawing: true, operation: { mode: 'workPlane' } }).mode,
    'empty',
  );
  assert.equal(
    objectInspectorContext({ drawing: true, operation: { mode: 'plateCreate', cutTargets: ['a'] } })
      .mode,
    'empty',
  );
  assert.equal(
    objectInspectorContext({
      selected: [{ type: 'item' }],
      drawing: true,
      operation: { mode: 'grip' },
    }).locked,
    true,
  );
  assert.equal(
    objectInspectorContext({ drawing: true, operation: { mode: 'fit', kind: 'baseplate' } }).type,
    'component',
  );
});

test('shared draft fields remain detached, validate numbering before creation and preserve immutable item geometry', () => {
  const source = { type: 'item', item: { mesh: { positions: [1, 2, 3] } } },
    material = { id: 'steel', revision: 1 };
  const draft = {
    name: '  Grind  ',
    partSeries: { prefix: 'GT', start: 300 },
    material,
    colorOverride: '#123456',
  };
  const result = applyObjectDraft(source, draft);
  assert.equal(result.name, 'Grind');
  assert.equal(result.item, source.item);
  assert.deepEqual(result.partSeries, draft.partSeries);
  assert.notEqual(result.partSeries, draft.partSeries);
  assert.deepEqual(result.material, material);
  assert.notEqual(result.material, material);
  assert.equal(source.name, undefined);
  assert.equal(draft.name, '  Grind  ');
  assert.throws(
    () => applyObjectDraft(source, { partSeries: { prefix: 'GT', start: 0 } }),
    /Startnummer/,
  );
  assert.equal(source.partSeries, undefined);
  assert.equal(applyObjectDraft(source, undefined), source);
  assert.equal(applyObjectDraft(source, { name: '' }).name, undefined);
});
