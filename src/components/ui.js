import { isComponent } from './fit.js';
import { suggestFitEnds, pickFitReference } from './fit-placement.js';
import {
  componentDefinition,
  resolveComponentDraft,
  componentDraftChanged,
} from './definitions.js';
import { connectionIcon } from './markers.js';
import { nextIdentity, designation } from '../object-identity.js';

export function createComponentUI({
  getObjects,
  getSelection,
  commit,
  finish,
  begin,
  highlight,
  hoverReference,
  selectSource,
  showInspector,
}) {
  const toolbar = document.querySelector('.toolbox');
  for (const [id, label] of [
    ['component-fit', 'Fit'],
    ['component-library', 'Komponentbibliotek'],
  ]) {
    const button = document.createElement('button');
    button.id = id;
    button.type = 'button';
    button.setAttribute('aria-label', label);
    button.setAttribute('aria-pressed', 'false');
    button.title = label;
    button.innerHTML = connectionIcon;
    const span = document.createElement('span');
    span.textContent = id === 'component-fit' ? 'Fit' : 'Bibliotek';
    button.append(span);
    toolbar.append(button);
  }
  const panel = document.createElement('section');
  panel.className = 'component-properties';
  panel.hidden = true;
  panel.innerHTML = `<p data-prompt aria-live="polite"></p><div class="component-references"></div><p class="component-error" role="alert"></p>
  <form data-independent-editor><div class="component-parameters"></div><details class="component-end-options"><summary>Anslutna ändar</summary><div></div></details><details class="component-reference-options"><summary>Byt referensobjekt</summary><div class="component-reference-fields"></div></details>
  <button type="button" data-swap>Byt ordning</button>
  <div class="component-actions"><button type="button" data-reset>Återställ</button><button type="submit" class="primary">Modifiera</button></div></form>`;
  document.getElementById('inspector-properties').append(panel);
  const form = panel.querySelector('form');
  let creation = null,
    source = null,
    staged = null,
    valid = false;
  const fitButton = document.getElementById('component-fit');
  const error = (e) => (panel.querySelector('[role=alert]').textContent = e?.message || '');
  function hint() {
    panel.querySelector('[data-prompt]').textContent = creation
      ? `Klicka på ${creation.references.length ? 'andra' : 'första'} sweepen nära anslutningen. Kopplingen skapas efter andra klicket.`
      : 'Ändra valen och klicka på Modifiera. Återställ avbryter ändringarna.';
    fitButton.setAttribute('aria-pressed', String(!!creation));
  }
  function controls() {
    if (!source) return;
    const def = componentDefinition(source.kind);
    for (const parameter of def.parameters) {
      const input = form.elements[parameter.key];
      input.value = staged[parameter.key];
      input.parentElement.hidden = !!parameter.hidden?.(staged);
    }
    staged.references.forEach((id, i) => (form.elements[`reference-${i}`].value = id));
    const changed = componentDraftChanged(source, staged);
    form.querySelector('[type=submit]').disabled = !changed || !valid;
    form.querySelector('[data-reset]').disabled = !changed;
  }
  function preview() {
    commit(null, 'clear');
    error();
    valid = false;
    try {
      const resolved = resolveComponentDraft(source, stagedParameters(), getObjects());
      valid = true;
      if (componentDraftChanged(source, staged)) commit(resolved, 'preview');
    } catch (e) {
      error(e);
    }
    controls();
    sync();
  }
  function stagedParameters() {
    const def = componentDefinition(source.kind);
    return Object.fromEntries(
      ['references', ...def.parameters.map((p) => p.key)].map((key) => [key, staged[key]]),
    );
  }
  function fill(component) {
    source = component;
    staged = structuredClone(component);
    valid = true;
    error();
    const def = componentDefinition(source.kind);
    const refs = form.querySelector('.component-reference-fields');
    refs.replaceChildren();
    def.references.forEach((labelText, index) => {
      const label = document.createElement('label');
      label.textContent = labelText;
      const input = document.createElement('select');
      input.name = `reference-${index}`;
      input.setAttribute('aria-label', labelText);
      for (const s of getObjects().filter((s) => (s.type ?? 'sweep') === 'sweep')) {
        const option = document.createElement('option');
        option.value = s.id;
        option.textContent = s.name || designation(s);
        input.append(option);
      }
      input.onchange = () => {
        staged.references[index] = input.value;
        const [a, b] = staged.references.map((id) => getObjects().find((s) => s.id === id));
        if (source.kind === 'fit' && a && b) Object.assign(staged, suggestFitEnds(a, b));
        preview();
      };
      label.append(input);
      refs.append(label);
    });
    const parameters = form.querySelector('.component-parameters');
    parameters.replaceChildren();
    const advanced = form.querySelector('.component-end-options > div');
    advanced.replaceChildren();
    form.querySelectorAll('details').forEach((details) => (details.open = false));
    for (const parameter of def.parameters) {
      const label = document.createElement('label');
      label.textContent = parameter.label;
      const input = document.createElement(parameter.options ? 'select' : 'input');
      input.name = parameter.key;
      input.setAttribute('aria-label', parameter.label);
      if (parameter.options)
        for (const [value, text] of parameter.options) {
          const option = document.createElement('option');
          option.value = value;
          option.textContent = text;
          input.append(option);
        }
      else {
        input.type = parameter.type || 'text';
        input.step = 'any';
        input.min = parameter.min;
        input.max = parameter.max;
      }
      input.addEventListener(parameter.options ? 'change' : 'input', () => {
        staged[parameter.key] =
          input.type === 'number' ? (input.value.trim() ? Number(input.value) : NaN) : input.value;
        preview();
      });
      label.append(input);
      (parameter.advanced ? advanced : parameters).append(label);
    }
    controls();
  }
  function start() {
    finish();
    begin(true);
    creation = {
      type: 'component',
      kind: 'fit',
      ...componentDefinition('fit').defaults,
      references: [],
    };
    source = null;
    staged = null;
    error();
    sync();
    showInspector();
  }
  function confirm() {
    if (!source || !valid || !componentDraftChanged(source, staged)) return;
    try {
      commit(resolveComponentDraft(source, stagedParameters(), getObjects()), 'save');
    } catch (e) {
      error(e);
    }
  }
  function cancel() {
    hoverReference(null);
    creation = null;
    staged = source ? structuredClone(source) : null;
    commit(null, 'clear');
    hint();
    if (source) {
      valid = true;
      error();
      controls();
    }
  }
  function sync() {
    const selected = getSelection();
    const component = selected.length === 1 ? selected.find(isComponent) : null;
    panel.hidden = !creation && !component;
    if (panel.hidden) document.getElementById('identity-fields').hidden = selected.length !== 1;
    form.hidden = !!creation || !component;
    if (component && !creation && source !== component) fill(component);
    if (!component && !creation) {
      source = null;
      staged = null;
    }
    hint();
    const refs = creation?.references || staged?.references || component?.references || [];
    highlight(refs);
    const links = panel.querySelector('.component-references');
    hoverReference(null);
    links.replaceChildren();
    refs.forEach((id, i) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.referenceIndex = i;
      const object = getObjects().find((s) => s.id === id);
      button.textContent = `${i === 0 ? 'Första' : 'Andra'}: ${object?.name || id}`;
      button.setAttribute(
        'aria-label',
        `${i === 0 ? 'Första' : 'Andra'} referens: ${object?.name || id}`,
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
    if (!panel.hidden) {
      document.getElementById('cut-relations').hidden = true;
      document.getElementById('identity-fields').hidden = true;
      if (creation) document.getElementById('mode-label').textContent = 'Välj två objekt';
      document.getElementById('object-heading').textContent = creation
        ? 'Ny koppling · Fit'
        : `Koppling · ${componentDefinition(component.kind).label}`;
      document.getElementById('form').hidden = true;
      document.getElementById('plate-form').hidden = true;
    }
  }
  form.addEventListener('input', (e) => e.stopPropagation());
  form.addEventListener('change', (e) => e.stopPropagation());
  form.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Escape') {
      e.preventDefault();
      cancel();
      sync();
    } else if (e.key === 'Enter' && e.target.tagName !== 'BUTTON') {
      e.preventDefault();
      confirm();
    }
  });
  form.onsubmit = (e) => {
    e.preventDefault();
    confirm();
  };
  form.querySelector('[data-reset]').onclick = () => {
    cancel();
    sync();
  };
  form.querySelector('[data-swap]').onclick = () => {
    staged.references.reverse();
    [staged.endA, staged.endB] = [staged.endB, staged.endA];
    preview();
  };
  fitButton.onclick = start;
  const library = document.createElement('dialog');
  library.className = 'component-dialog';
  library.setAttribute('aria-labelledby', 'component-library-title');
  library.innerHTML =
    '<header><h2 id="component-library-title">Komponenter / kopplingar</h2><button type="button" aria-label="Stäng bibliotek">×</button></header><p>Kopplingar som följer sina referensobjekt och styrs med parametrar.</p><button type="button" class="component-card"><strong>Fit</strong><span>Gerning eller anslutning mot genomgående sweep</span></button><h3>Planerade stålkopplingar</h3><ul><li>Fotplåt med grundskruv eller betongskruv</li><li>Pelare mot balk</li><li>Balk mot balk</li><li>Balkskarv och pelarskarv</li></ul>';
  document.body.append(library);
  library.querySelector('header button').onclick = () => library.close();
  library.querySelector('.component-card').onclick = () => {
    library.close();
    start();
  };
  library.addEventListener('keydown', (e) => e.stopPropagation());
  document.getElementById('component-library').onclick = () => {
    finish();
    library.showModal();
  };
  return {
    confirm,
    cancel,
    sync,
    pick(object, point) {
      if (!creation) return;
      try {
        const slot = creation.references.length ? 'b' : 'a';
        const picked = pickFitReference({ a: creation.references[0], b: '' }, slot, object, point);
        if (slot === 'a') {
          creation.references = [picked.id];
          creation.endA = picked.end;
          sync();
          return;
        }
        const candidate = {
          ...creation,
          references: [...creation.references, picked.id],
          endB: picked.end,
        };
        const value = componentDefinition(candidate.kind).resolve(candidate, getObjects());
        value.id = crypto.randomUUID();
        Object.assign(value, nextIdentity(value, getObjects()));
        value.name = `Fit · ${designation(value)}`;
        commit(value, 'save');
      } catch (e) {
        error(e);
      }
    },
  };
}
