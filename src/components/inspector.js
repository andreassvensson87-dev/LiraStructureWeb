import { componentInspectorSchema } from '../inspector/component-schemas.js';
import {
  createAttributeRow,
  createAttributeSection,
  mountAttributeLayout,
} from '../inspector/attributes.js';
import { componentFastenerOptions } from './inspector-layout.js';
import { componentDefinition, componentDraftChanged } from './definitions.js';
import { designation } from '../object-identity.js';

/** Presents component attributes using shared inspector sections; the controller owns edits. */
export function createComponentInspector({
  panel,
  form,
  getState,
  getObjects,
  selectSource,
  hoverReference,
  fastenerChoices,
  openFastenerLibrary,
  copyKeys,
  changed,
  changeParameter,
  changeReference,
}) {
  let attributeLayout = null;
  function refreshSpecs(input) {
    const { source, staged } = getState();
    input.replaceChildren();
    const parameter = componentDefinition(source.kind).parameters.find((p) => p.key === input.name);
    const key = input.name;
    const options = componentFastenerOptions(
      fastenerChoices(parameter.fastenerKind || staged.anchorKind),
      staged[key],
      key === 'boltSpec' && staged.lengthMode === 'auto',
    );
    const choices = options.map((option) => option.spec);
    input._specs = choices;
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = choices.length ? 'Välj skruv…' : 'Lägg till skruv i skruvbiblioteket';
    input.append(placeholder);
    choices.forEach((spec, index) => {
      const option = document.createElement('option');
      option.value = String(index);
      option.textContent = options[index].label;
      input.append(option);
    });
    input.value = staged[key]
      ? String(
          choices.findIndex((s) => s.id === staged[key].id && s.revision === staged[key].revision),
        )
      : '';
  }
  function controls() {
    const { source, staged, valid, creation, copying } = getState();
    if (!source) return;
    const def = componentDefinition(source.kind);
    for (const parameter of def.parameters) {
      const input = form.elements.namedItem(parameter.key);
      if (parameter.type === 'fastener')
        input.closest('label').querySelector('span').textContent =
          parameter.key === 'boltSpec' && staged.lengthMode === 'auto' ? 'Serie' : 'Skruv';
      if (parameter.type === 'checkbox') input.checked = staged[parameter.key];
      else if (parameter.type === 'fastener') refreshSpecs(input);
      else input.value = staged[parameter.key];
    }
    attributeLayout?.sync({
      compact: true,
      copyVisible: !creation && !panel.hidden,
      copying: !!copying,
      state: { draft: staged },
    });
    form.querySelectorAll('[data-section]').forEach((section) => {
      section.hidden = ![...section.querySelectorAll('label')].some((label) => !label.hidden);
    });
    const productNote = form.querySelector('[data-product-note]');
    if (productNote) {
      productNote.textContent = (def.notices?.(staged) || []).join('. ');
      productNote.hidden = !valid || !productNote.textContent;
    }
    staged.references.forEach((id, i) => (form.elements.namedItem(`reference-${i}`).value = id));
    const isChanged = componentDraftChanged(source, staged);
    form.querySelector('[type=submit]').disabled = (!isChanged && !creation?.ready) || !valid;
    form.querySelector('[type=submit]').textContent = creation?.ready
      ? `Skapa ${componentDefinition(creation.kind).label.toLowerCase()}`
      : 'Modifiera';
    form.querySelector('[data-reset]').disabled = !isChanged;
  }
  function fill(component, { same, open }) {
    const { source, staged } = getState();
    const def = componentDefinition(source.kind);
    const schema = componentInspectorSchema(source.kind);
    const refs = form.querySelector('.component-reference-fields');
    refs.replaceChildren();
    if (!same) {
      refs.hidden = true;
      form.querySelector('[data-reference-edit]').setAttribute('aria-expanded', 'false');
    }
    def.references.forEach((labelText, index) => {
      const label = document.createElement('label');
      label.textContent = labelText;
      const input = document.createElement('select');
      input.name = `reference-${index}`;
      input.setAttribute('aria-label', labelText);
      for (const s of getObjects().filter((member) => (member.type ?? 'sweep') === 'sweep')) {
        const option = document.createElement('option');
        option.value = s.id;
        option.textContent = s.name || designation(s);
        input.append(option);
      }
      input.onchange = () => changeReference(index, input.value);
      label.append(input);
      refs.append(label);
    });
    panel.dataset.kind = component.kind;
    const parameters = form.querySelector('.component-parameters');
    parameters.replaceChildren();
    for (const details of panel.querySelectorAll('details'))
      details.open = open.get(details.dataset.disclosure) || false;
    for (const section of schema.groups) {
      const { root, fields } = createAttributeSection(section, {
        open: open.get(section.key) || false,
      });
      root.dataset.section = section.key;
      if (section.collapsed) root.dataset.disclosure = section.key;
      parameters.append(root);
      for (const key of section.fields) {
        const parameter = def.parameters.find((p) => p.key === key);
        const field = schema.fields.find((f) => f.key === key);
        const label = createAttributeRow(field, {
          value: staged[key],
          custom: () => {
            const input = document.createElement('select');
            input.name = key;
            refreshSpecs(input);
            return input;
          },
        });
        const input = label.querySelector('input,select');
        input.id = `component-parameter-${key}`;
        label.htmlFor = input.id;
        input.setAttribute('aria-label', parameter.label);
        if (input.type === 'number') input.step = parameter.step || 'any';
        input.addEventListener(
          parameter.options || ['fastener', 'checkbox'].includes(parameter.type)
            ? 'change'
            : 'input',
          () => {
            const value =
              parameter.type === 'fastener'
                ? structuredClone(
                    input.value === '' ? null : input._specs[Number(input.value)] || null,
                  )
                : input.type === 'checkbox'
                  ? input.checked
                  : input.type === 'number'
                    ? input.value.trim()
                      ? Number(input.value)
                      : NaN
                    : input.value;
            changeParameter(parameter.key, value);
          },
        );
        if (parameter.type === 'fastener' && openFastenerLibrary) {
          const libraryButton = document.createElement('button');
          libraryButton.type = 'button';
          libraryButton.textContent = 'Bibliotek';
          libraryButton.setAttribute('aria-label', 'Öppna skruvbibliotek');
          libraryButton.onclick = () =>
            openFastenerLibrary(() => {
              controls();
              changed();
            });
          const control = document.createElement('div');
          control.className = 'component-spec-control';
          control.append(input, libraryButton);
          label.append(control);
        }
        fields.append(label);
      }
      if (source.kind === 'baseplate' && section.key === 'advanced') {
        const note = document.createElement('p');
        note.dataset.productNote = '';
        note.className = 'component-product-note';
        root.append(note);
      }
    }
    attributeLayout = mountAttributeLayout(panel, schema, changed, {
      keys: () => [...copyKeys],
      has: (key) => copyKeys.has(key),
      set: (key, checked) => {
        if (checked) copyKeys.add(key);
        else copyKeys.delete(key);
      },
    });
    controls();
  }
  function references(refs, component) {
    const { source, creation, copying } = getState();
    const links = panel.querySelector('.component-references');
    hoverReference(null);
    links.replaceChildren();
    refs.forEach((id, i) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.referenceIndex = i;
      button.disabled = !!copying;
      const object = getObjects().find((s) => s.id === id);
      button.textContent = `${componentDefinition((creation || component || source).kind).references[i]}: ${object?.name || id}`;
      button.setAttribute(
        'aria-label',
        `${componentDefinition((creation || component || source).kind).references[i]} referens: ${object?.name || id}`,
      );
      button.onclick = () => {
        if (!creation) selectSource(id);
      };
      button.addEventListener('pointerenter', () => hoverReference(id));
      button.addEventListener('pointerleave', () => hoverReference(null));
      button.addEventListener('focus', () => hoverReference(id));
      button.addEventListener('blur', () => hoverReference(null));
      links.append(button);
    });
    if (
      component &&
      ['baseplate', 'stiffener', 'endplate', 'boltedEndplate', 'beamSplice'].includes(
        component.kind,
      ) &&
      !creation
    ) {
      const plates = getObjects().filter(
        (s) => s.generatedBy === component.id && s.componentRole === 'plate',
      );
      for (const plate of plates) {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = `Plåt: ${designation(plate)}`;
        button.disabled = !!copying;
        button.onclick = () => selectSource(plate.id);
        button.onpointerenter = () => hoverReference(plate.id);
        button.onpointerleave = () => hoverReference(null);
        links.append(button);
      }
    }
  }
  return { controls, fill, references };
}
