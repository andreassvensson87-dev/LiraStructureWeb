import test from 'node:test';
import assert from 'node:assert/strict';
import { createInspectorDraft, bindInspectorField } from '../src/inspector/field-state.js';

class Field extends EventTarget {
  constructor(name, value, type = 'number') {
    super();
    Object.assign(this, {
      name,
      value,
      type,
      dataset: {},
      validity: { valid: true },
      attributes: new Map(),
    });
  }
  matches() {
    return false;
  }
  hasAttribute(key) {
    return this.attributes.has(key);
  }
  getAttribute(key) {
    return this.attributes.get(key);
  }
  setAttribute(key, value) {
    this.attributes.set(key, value);
  }
  removeAttribute(key) {
    this.attributes.delete(key);
  }
  toggleAttribute(key, value) {
    if (value) this.attributes.set(key, '');
    else this.attributes.delete(key);
  }
}
class Form extends EventTarget {
  fields = [];
  querySelectorAll() {
    return this.fields;
  }
}

test('draft fields retain independent changes until success, clear on exact reversion and survive widget rebuilding', () => {
  const root = new Form(),
    length = new Field('length', '80'),
    spacing = new Field('spacing', '60 60', 'text');
  root.fields = [length, spacing];
  const draft = createInspectorDraft(root);
  length.value = '100';
  spacing.value = '80 80';
  assert.equal(draft.sync(), true);
  assert.ok(length.hasAttribute('data-inspector-pending'));
  length.value = '80.0';
  draft.sync();
  assert.equal(
    length.hasAttribute('data-inspector-pending'),
    false,
    'equivalent numeric input is unchanged',
  );
  assert.ok(spacing.hasAttribute('data-inspector-pending'));
  const rebuilt = new Field('spacing', '80 80', 'text');
  root.fields = [length, rebuilt];
  draft.sync();
  assert.ok(rebuilt.hasAttribute('data-inspector-pending'), 'rerender is not a commit');
  rebuilt.validity.valid = false;
  draft.sync();
  assert.equal(rebuilt.getAttribute('aria-invalid'), 'true');
  root.dispatchEvent(new Event('submit'));
  assert.ok(
    rebuilt.hasAttribute('data-inspector-pending'),
    'failed confirmation cannot accept the baseline',
  );
  rebuilt.validity.valid = true;
  draft.sync();
  assert.equal(rebuilt.hasAttribute('aria-invalid'), false);
  draft.accept();
  assert.equal(draft.sync(), false);
  rebuilt.value = '90 90';
  draft.sync();
  rebuilt.value = '80 80';
  draft.sync();
  assert.equal(draft.sync(), false, 'reversion uses the last accepted values');
  draft.dispose();
  rebuilt.value = '100 100';
  root.dispatchEvent(new Event('input'));
  assert.equal(rebuilt.hasAttribute('data-inspector-pending'), false);
});

test('checkbox and dropdown drafts use the same baseline, while immediate commits clear only their own field', () => {
  const root = new Form(),
    washer = new Field('washer', 'on', 'checkbox'),
    spec = new Field('spec', 'ISO4017', 'select');
  washer.checked = true;
  root.fields = [washer, spec];
  const draft = createInspectorDraft(root);
  washer.checked = false;
  spec.value = 'ISO4014';
  draft.sync();
  assert.ok(washer.hasAttribute('data-inspector-pending'));
  assert.ok(spec.hasAttribute('data-inspector-pending'));
  washer.checked = true;
  draft.sync();
  assert.equal(washer.hasAttribute('data-inspector-pending'), false);
  const size = new Field('size', '100');
  let committed = 100;
  bindInspectorField(size, () => committed);
  size.value = '200';
  size.dispatchEvent(new Event('input'));
  assert.ok(size.hasAttribute('data-inspector-pending'));
  // A rejected commit leaves the backing value unchanged.
  size.validity.valid = false;
  size.dispatchEvent(new Event('change'));
  assert.equal(size.getAttribute('aria-invalid'), 'true');
  assert.ok(size.hasAttribute('data-inspector-pending'));
  size.validity.valid = true;
  committed = 200;
  size.dispatchEvent(new Event('change'));
  assert.equal(size.hasAttribute('data-inspector-pending'), false);
  assert.equal(size.hasAttribute('aria-invalid'), false);
  draft.dispose();
});

test('Enter confirms the owning form once, while invalid input, composition and multiline text are left alone', async () => {
  const { installInspectorEnter } = await import('../src/inspector/enter.js');
  const field = new Field('length', '120');
  field.matches = () => true;
  field.closest = () => null;
  let submissions = 0,
    reports = 0;
  const button = { disabled: false };
  field.form = { querySelector: () => button, requestSubmit: () => submissions++ };
  field.checkValidity = () => field.validity.valid;
  field.reportValidity = () => reports++;
  const dispose = installInspectorEnter(field);
  const enter = (properties = {}) => {
    const event = new Event('keydown', { cancelable: true });
    Object.assign(event, { key: 'Enter', ...properties });
    field.dispatchEvent(event);
    return event;
  };
  assert.ok(enter().defaultPrevented);
  assert.equal(submissions, 1);
  field.validity.valid = false;
  enter();
  assert.equal(submissions, 1);
  assert.equal(reports, 1);
  field.validity.valid = true;
  button.disabled = true;
  enter();
  assert.equal(submissions, 1);
  button.disabled = false;
  enter({ isComposing: true });
  enter({ shiftKey: true });
  assert.equal(submissions, 1);
  field.type = 'search';
  enter();
  assert.equal(submissions, 1);
  field.type = 'number';
  field.matches = () => false;
  enter();
  assert.equal(submissions, 1);
  dispose();
  field.matches = () => true;
  enter();
  assert.equal(submissions, 1);
});
