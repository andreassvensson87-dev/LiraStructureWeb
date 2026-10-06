/** Shared presentation primitives. Model validation and commits belong to each object adapter. */
export function defineAttributeSchema(schema) {
  const keys = new Set();
  for (const field of schema.fields) {
    if (!field.key || keys.has(field.key)) throw new Error('Attributnycklar måste vara unika.');
    keys.add(field.key);
    if (!['number', 'text', 'select', 'checkbox', 'custom'].includes(field.type))
      throw new Error(`Okänd attributkontroll: ${field.type}`);
    if (field.copy && !schema.copyGroups.some(([key]) => key === field.copy))
      throw new Error(`Okänd kopieringsgrupp: ${field.copy}`);
  }
  return schema;
}

export function createAttributeSelection(schema) {
  const allowed = new Set(schema.copyGroups.map(([key]) => key));
  const selected = new Set(
    schema.copyGroups
      .filter(([key]) => !(schema.unchecked || []).includes(key))
      .map(([key]) => key),
  );
  return {
    keys: () => [...selected],
    has: (key) => selected.has(key),
    set(key, checked) {
      if (!allowed.has(key)) throw new Error('Okänd kopieringsgrupp.');
      if (checked) selected.add(key);
      else selected.delete(key);
    },
  };
}

export function mountAttributeDisclosure(root, section) {
  const content = root.querySelector(section.content);
  if (!content) throw new Error(`Inspektoravsnitt saknas: ${section.content}`);
  if (content.parentElement.dataset.attributeSection === section.key) return content.parentElement;
  const details = document.createElement('details');
  details.dataset.attributeSection = section.key;
  if (section.id) details.id = section.id;
  details.className = section.className || 'attribute-section';
  const summary = document.createElement('summary');
  const caption = document.createElement('span');
  caption.textContent = section.label;
  summary.append(caption);
  if (section.summaryId) {
    const value = document.createElement('span');
    value.id = section.summaryId;
    summary.append(value);
  }
  details.append(summary);
  content.before(details);
  details.append(content);
  return details;
}

function adoptLabel(label) {
  const control = label.querySelector('input:not(.property-copy-check),select');
  if (!control) return;
  let caption = label.querySelector('.attribute-caption');
  if (!caption) {
    caption = document.createElement('span');
    caption.className = 'attribute-caption';
    while (label.firstChild && label.firstChild !== control) caption.append(label.firstChild);
    label.prepend(caption);
  }
  label.classList.add('attribute-row');
  if (control.id) label.htmlFor = control.id;
  if (!control.hasAttribute('aria-label'))
    control.setAttribute('aria-label', caption.textContent.trim());
}

/** Adopt existing controls so IDs, events, pickers and visual widgets keep their behavior. */
export function mountAttributeLayout(
  root,
  schema,
  onCopyChange = () => {},
  selection = createAttributeSelection(schema),
) {
  for (const section of schema.sections || []) mountAttributeDisclosure(root, section);
  for (const label of root.querySelectorAll(schema.labels || 'label.attribute-row'))
    adoptLabel(label);
  for (const row of schema.captions || []) {
    const element = root.querySelector(row.selector);
    if (!element || element.querySelector('[data-attribute-caption]')) continue;
    const caption = document.createElement('span');
    caption.dataset.attributeCaption = '';
    caption.textContent = row.label;
    element.prepend(caption);
  }
  const checks = [];
  const rows = [];
  const locked = new Map();
  for (const field of schema.fields) {
    for (const control of root.querySelectorAll(field.selector)) {
      const row = field.row === 'label' ? control.closest('label') : control;
      if (!row) throw new Error(`Attributrad saknas: ${field.key}`);
      row.dataset.attributeKey = field.key;
      rows.push({ row, field });
      if (!field.copy) continue;
      const check = document.createElement('input');
      check.type = 'checkbox';
      check.className = 'property-copy-check';
      check.hidden = true;
      check.setAttribute('data-independent-editor', '');
      const title = schema.copyGroups.find(([key]) => key === field.copy)[1];
      check.setAttribute('aria-label', `Kopiera ${title.toLowerCase()}`);
      check.title = check.getAttribute('aria-label');
      check.addEventListener('click', (e) => e.stopPropagation());
      check.addEventListener('input', (e) => e.stopPropagation());
      check.addEventListener('change', (e) => {
        e.stopPropagation();
        selection.set(field.copy, check.checked);
        syncChecks();
        onCopyChange();
      });
      if (field.inline) {
        const wrapper = row.closest('.property-color-copy') || document.createElement('span');
        if (!wrapper.classList.contains('property-color-copy')) {
          wrapper.className = 'property-color-copy';
          row.before(wrapper);
          wrapper.append(row);
        }
        wrapper.prepend(check);
      } else {
        row.classList.add('property-copy-row');
        row.prepend(check);
      }
      checks.push({ check, key: field.copy });
    }
  }
  function syncChecks() {
    for (const { check, key } of checks) check.checked = selection.has(key);
  }
  return {
    selection,
    sync({ compact, copyVisible, copying, state }) {
      if (compact) {
        root.classList.add('attribute-inspector');
        root.dataset.attributeSchema = schema.key;
        root.dataset.attributeCopying = String(copying);
      } else if (root.dataset.attributeSchema === schema.key) {
        root.classList.remove('attribute-inspector');
        delete root.dataset.attributeSchema;
        delete root.dataset.attributeCopying;
      }
      for (const { check } of checks) check.hidden = !copyVisible;
      syncChecks();
      for (const { row, field } of rows)
        if (field.visibleWhen) row.hidden = !field.visibleWhen(state);
      if (copying) {
        for (const container of root.querySelectorAll(schema.lockContainers)) {
          container.inert = false;
          for (const control of container.querySelectorAll(
            'input:not(.property-copy-check),select,button',
          )) {
            if (!locked.has(control)) locked.set(control, control.disabled);
            control.disabled = true;
          }
        }
      } else {
        for (const [control, disabled] of locked) control.disabled = disabled;
        locked.clear();
      }
    },
  };
}

/** New object adapters can create ordinary rows rather than hand-writing their markup. */
export function createAttributeRow(field, { value, onChange, custom } = {}) {
  const row = document.createElement('label');
  row.className = 'attribute-row';
  row.dataset.attributeKey = field.key;
  const caption = document.createElement('span');
  caption.className = 'attribute-caption';
  caption.textContent = field.label;
  if (field.unit) {
    const unit = document.createElement('small');
    unit.textContent = field.unit;
    caption.append(unit);
  }
  row.append(caption);
  const control =
    field.type === 'custom'
      ? custom(field)
      : document.createElement(field.type === 'select' ? 'select' : 'input');
  if (field.type !== 'custom') {
    control.name = field.key;
    if (field.type !== 'select') control.type = field.type;
    for (const [key, text] of field.options || []) {
      const option = document.createElement('option');
      option.value = key;
      option.textContent = text;
      control.append(option);
    }
    for (const key of ['min', 'max', 'step']) if (field[key] != null) control[key] = field[key];
    if (field.type === 'checkbox') control.checked = !!value;
    else control.value = value ?? '';
    control.addEventListener('change', () =>
      onChange?.(field.key, field.type === 'checkbox' ? control.checked : control.value),
    );
  }
  control.setAttribute('aria-label', field.label);
  row.append(control);
  return row;
}

export function setAttributeMessage(element, message = '') {
  element.textContent = message;
  element.hidden = !message;
}

export function createAttributeSection(section, { open = false } = {}) {
  const root = document.createElement(section.collapsed ? 'details' : 'fieldset');
  root.className = section.collapsed ? 'attribute-section' : 'attribute-group';
  root.dataset.attributeSection = section.key;
  if (section.collapsed) root.open = open;
  const caption = document.createElement(section.collapsed ? 'summary' : 'legend');
  caption.textContent = section.label;
  const fields = document.createElement('div');
  fields.className = 'attribute-fields';
  root.append(caption, fields);
  return { root, fields };
}
