import test from 'node:test';
import assert from 'node:assert/strict';
import { installTeklaAttributeChoices } from '../src/install-tekla-attribute-choices.js';
import {
  standardChoices,
  ATTRIBUTE_SETTINGS_KEY,
  drawingAttributes,
  updateDrawingAttribute,
  drawingAttributeContext,
  attributeValue,
} from '../src/drawing-attributes.js';
import { FRAME_LIBRARY_KEY } from '../src/frame-model.js';

test('Tekla lists replace old defaults once while preserving custom definitions, values and edited block geometry', () => {
  const values = new Map([
    [
      ATTRIBUTE_SETTINGS_KEY,
      JSON.stringify({
        'drawing.issueStatus': { dataType: 'multichoice', options: ['Tidigare'] },
        'drawing.contact': { dataType: 'choice', options: ['Anna'] },
      }),
    ],
    [
      FRAME_LIBRARY_KEY,
      JSON.stringify([
        {
          id: 'mall-rithuvud_a1',
          name: 'Redigerat',
          entities: [{ id: 'category', type: 'attribute', key: 'drawing.type', point: [42, 27] }],
        },
        { id: 'own', entities: [{ type: 'attribute', key: 'drawing.type' }] },
      ]),
    ],
  ]);
  const store = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
  installTeklaAttributeChoices(store);
  const settings = JSON.parse(store.getItem(ATTRIBUTE_SETTINGS_KEY));
  for (const [key, options] of Object.entries(standardChoices))
    assert.deepEqual(settings[key].options, options);
  assert.equal(settings['drawing.issueStatus'].dataType, 'multichoice');
  assert.deepEqual(settings['drawing.contact'].options, ['Anna']);
  const blocks = JSON.parse(store.getItem(FRAME_LIBRARY_KEY));
  assert.equal(blocks[0].name, 'Redigerat');
  assert.deepEqual(blocks[0].entities[0].point, [42, 27]);
  assert.equal(blocks[0].entities[0].key, 'drawing.category');
  assert.equal(blocks[1].entities[0].key, 'drawing.type');
  settings['drawing.issueStatus'].options = ['Mitt val'];
  store.setItem(ATTRIBUTE_SETTINGS_KEY, JSON.stringify(settings));
  installTeklaAttributeChoices(store);
  assert.deepEqual(
    JSON.parse(store.getItem(ATTRIBUTE_SETTINGS_KEY))['drawing.issueStatus'].options,
    ['Mitt val'],
  );
});
test('Tekla status codes and comma-separated category labels remain single values in drawing attributes', () => {
  const previous = globalThis.localStorage;
  globalThis.localStorage = { getItem: () => null };
  try {
    assert.deepEqual(
      Object.values(standardChoices).map((v) => v.length),
      [5, 8, 9],
    );
    const attrs = drawingAttributes();
    let records = [{ id: 'd', type: 'GA', number: 'GA-1' }];
    for (const [key, options] of Object.entries(standardChoices)) {
      const attribute = attrs.find((a) => a.key === key);
      assert.equal(attribute.dataType, 'choice');
      for (const value of options) {
        records = updateDrawingAttribute(records, 'd', attribute, value);
        assert.equal(attributeValue(key, drawingAttributeContext(records[0])), value);
      }
    }
    const category = attrs.find((a) => a.key === 'drawing.category');
    const updated = updateDrawingAttribute(
      records,
      'd',
      category,
      'SEKTION, SEKTIONSVY, SNITT, SNITTVY',
    );
    assert.equal(updated[0].category, 'SEKTION, SEKTIONSVY, SNITT, SNITTVY');
    assert.equal(updated[0].type, 'GA');
  } finally {
    globalThis.localStorage = previous;
  }
});
