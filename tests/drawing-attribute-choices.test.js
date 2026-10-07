import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ATTRIBUTE_KEY,
  ATTRIBUTE_SETTINGS_KEY,
  drawingAttributes,
  customAttributes,
  saveAttributeDefinition,
  updateDrawingAttribute,
  attributeValue,
  drawingAttributeContext,
} from '../src/drawing-attributes.js';
import {
  createAttributeInput,
  attributeInputValue,
  attributeInputUnchanged,
} from '../src/drawing-attribute-input.js';
import { createProject } from '../src/project/project-state.js';
import { serializeProject, parseProjectFile } from '../src/project/project-file.js';

function withStorage(run) {
  const previous = globalThis.localStorage;
  const values = new Map();
  globalThis.localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
  try {
    run(values);
  } finally {
    globalThis.localStorage = previous;
  }
}
const field = (key) => drawingAttributes().find((a) => a.key === key);
test('built-in choice settings persist without changing identity, source or applicability', () =>
  withStorage(() => {
    const a = field('drawing.issueStatus');
    saveAttributeDefinition({
      ...a,
      name: 'Ignored',
      scope: 'SP',
      editable: false,
      dataType: 'choice',
      options: [' För granskning ', '', 'Godkänd', 'Godkänd'],
    });
    const saved = field(a.key);
    assert.equal(saved.name, a.name);
    assert.equal(saved.scope, 'all');
    assert.equal(saved.editable, true);
    assert.deepEqual(saved.options, ['För granskning', 'Godkänd']);
    assert.throws(() => saveAttributeDefinition({ ...a, options: [] }), /minst ett val/);
    assert.throws(
      () => saveAttributeDefinition({ ...field('drawing.number'), dataType: 'multichoice' }),
      /Datatyp/,
    );
    assert.throws(
      () =>
        saveAttributeDefinition({ ...field('project.name'), dataType: 'choice', options: ['A'] }),
      /Datatyp/,
    );
  }));
test('custom choice definitions retain stable keys through rename and reload and old definitions still work', () =>
  withStorage((values) => {
    values.set(ATTRIBUTE_KEY, JSON.stringify([{ key: 'custom.old', name: 'Gammalt' }]));
    assert.equal(customAttributes()[0].dataType, 'text');
    saveAttributeDefinition({
      key: 'custom.category',
      name: 'Kategori',
      scope: 'AS',
      dataType: 'multichoice',
      options: ['A', 'B'],
    });
    saveAttributeDefinition({
      ...field('custom.category'),
      name: 'Ny kategori',
      options: ['A', 'C'],
    });
    const attributes = customAttributes();
    assert.equal(attributes.length, 2);
    assert.equal(field('custom.category').name, 'Ny kategori');
    assert.deepEqual(field('custom.category').options, ['A', 'C']);
    assert.equal(field('custom.category').scope, 'AS');
    values.set(ATTRIBUTE_SETTINGS_KEY, '{broken');
    assert.equal(field('drawing.issueStatus').dataType, 'choice');
  }));
test('choice validation preserves legacy values while rejecting new values outside the list', () =>
  withStorage(() => {
    const a = field('drawing.issueStatus');
    const records = [{ id: 'd', type: 'GA', number: 'GA-1', issueStatus: 'Tidigare status' }];
    assert.equal(
      updateDrawingAttribute(records, 'd', a, 'Tidigare status')[0].issueStatus,
      'Tidigare status',
    );
    assert.throws(() => updateDrawingAttribute(records, 'd', a, 'Okänt'), /vallista/);
    const updated = updateDrawingAttribute(records, 'd', a, 'GODKÄND | G1');
    assert.equal(updated[0].issueStatus, 'GODKÄND | G1');
    assert.equal(records[0].issueStatus, 'Tidigare status');
    assert.equal(updateDrawingAttribute(updated, 'd', a, '')[0].issueStatus, '');
  }));
test('multi selections roundtrip in project files and render as readable title values', () =>
  withStorage(() => {
    const a = saveAttributeDefinition({
      key: 'custom.distribution',
      name: 'Distribution',
      scope: 'all',
      dataType: 'multichoice',
      options: ['Arkitekt', 'Entreprenör', 'Beställare'],
      editable: true,
    });
    const state = createProject({
      grid: { x: [0, 1000], y: [0, 1000] },
      levels: { active: 'l', items: [{ id: 'l', name: 'Plan 1', elevation: 0 }] },
    });
    state.drawings = [{ id: 'd', type: 'GA', number: 'GA-1' }];
    state.drawings = updateDrawingAttribute(state.drawings, 'd', a, [
      'Arkitekt',
      'Entreprenör',
      'Arkitekt',
    ]);
    const restored = parseProjectFile(serializeProject(state));
    assert.deepEqual(restored.drawings[0].attributes.distribution, ['Arkitekt', 'Entreprenör']);
    assert.equal(
      attributeValue(a.key, drawingAttributeContext(restored.drawings[0])),
      'Arkitekt, Entreprenör',
    );
    assert.throws(() => updateDrawingAttribute(state.drawings, 'd', a, ['Fel']), /vallista/);
    assert.deepEqual(
      updateDrawingAttribute(state.drawings, 'd', a, [])[0].attributes.distribution,
      [],
    );
  }));
test('select inputs retain old values after list changes and multi selection comparison ignores order', () => {
  const previousDocument = globalThis.document,
    previousOption = globalThis.Option;
  globalThis.Option = class {
    constructor(text, value) {
      this.text = text;
      this.value = value;
      this.selected = false;
    }
  };
  globalThis.document = {
    createElement: (tag) => ({
      tag,
      options: [],
      add(o) {
        this.options.push(o);
      },
      get selectedOptions() {
        return this.options.filter((o) => o.selected);
      },
    }),
  };
  try {
    const single = createAttributeInput({ dataType: 'choice', options: ['Godkänd'] }, 'Äldre');
    assert.deepEqual(
      single.options.map((o) => o.value),
      ['', 'Godkänd', 'Äldre'],
    );
    assert.equal(single.value, 'Äldre');
    const a = { dataType: 'multichoice', options: ['A', 'B'] };
    const multi = createAttributeInput(a, ['B', 'Äldre']);
    assert.deepEqual(attributeInputValue(multi), ['B', 'Äldre']);
    assert.equal(attributeInputUnchanged(a, ['Äldre', 'B'], ['B', 'Äldre']), true);
    assert.equal(attributeInputUnchanged(a, ['A'], ['B']), false);
  } finally {
    globalThis.document = previousDocument;
    globalThis.Option = previousOption;
  }
});
