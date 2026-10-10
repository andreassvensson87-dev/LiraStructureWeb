import * as THREE from 'three';
import { ItemLibrary } from './library-ui.js';
import { placeItem, moveItemAnchor, setItemRoll, validateItemObject } from './geometry.js';
import { createAttributeRow } from '../inspector/attributes.js';
/** Item inspector and library adapters receive the model transaction callbacks explicitly. */
export function createItemController({
  project,
  ui,
  tools,
  select,
  setDrawing,
  syncOperationUI,
  save,
  commit,
  remove,
  renderer,
  showProperties,
  getElevation,
}) {
  const $ = (id) => document.getElementById(id);
  const toolbar = $('draw').parentElement,
    button = document.createElement('button');
  button.id = 'item';
  button.type = 'button';
  button.title = 'Item';
  button.setAttribute('aria-label', 'Item');
  button.setAttribute('aria-pressed', 'false');
  button.innerHTML =
    '<svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="1.5"><path d="m12 3 9 5v8l-9 5-9-5V8ZM3 8l9 5 9-5M12 13v8"/></svg><span>Item</span>';
  toolbar.append(button);
  const form = document.createElement('form');
  form.id = 'item-form';
  form.hidden = true;
  form.dataset.independentEditor = '';
  form.innerHTML =
    '<div class="item-form-reference"></div><button type="button" class="library-open" data-library>Hantera bibliotek ↗</button><button type="button" data-change>Byt item…</button><div data-item-coords></div><label class="field">Rotation · °<input type="number" name="rotation" step="any" value="0" required></label><p class="inspector-note" data-item-note>Fast geometri · Start → slut bestämmer riktningen.</p><p data-item-error role="alert"></p><button type="submit" class="primary">Uppdatera item</button><button type="button" data-remove class="danger">Ta bort markerad</button>';
  const rotationRow = createAttributeRow(
    { key: 'rotation', label: 'Rotation', unit: '°', type: 'number', step: 'any' },
    { value: 0 },
  );
  rotationRow.querySelector('input').required = true;
  form.querySelector('label.field').replaceWith(rotationRow);
  for (const key of ['start', 'end']) {
    const group = document.createElement('fieldset'),
      legend = document.createElement('legend');
    legend.textContent = (key === 'start' ? 'Startpunkt' : 'Slutpunkt') + ' · mm';
    group.append(legend);
    const row = document.createElement('div');
    row.className = 'item-inspector-coordinates';
    ['X', 'Y', 'Z'].forEach((axis, i) => {
      const label = document.createElement('label');
      label.textContent = axis;
      const input = document.createElement('input');
      input.type = 'number';
      input.step = 'any';
      input.required = true;
      input.dataset.itemCoord = `${key}:${i}`;
      input.setAttribute('aria-label', `Item ${key === 'start' ? 'start' : 'slut'} ${axis}`);
      label.append(input);
      row.append(label);
    });
    group.append(row);
    form.querySelector('[data-item-coords]').append(group);
  }
  $('form').after(form);
  for (const event of ['input', 'change']) form.addEventListener(event, (e) => e.stopPropagation());
  const coords = (key, source) =>
    [...form.querySelectorAll(`[data-item-coord^="${key}:"]`)].map((input, i) => {
      const value = Number(input.value);
      return source && value === Math.round(source[key][i] * 1000) / 1000 ? source[key][i] : value;
    });
  const error = (text) => {
    form.querySelector('[data-item-error]').textContent = text;
  };
  const selected = () => project.objects.find((s) => s.id === ui.selected && s.type === 'item');
  const library = new ItemLibrary({
    currentItems: () => project.objects.filter((s) => s.type === 'item'),
    use: (definition) => {
      const source = selected();
      if (source && !tools.operation) {
        try {
          const next = {
            ...source,
            ...placeItem(definition, source.start, source.end, source.rotation),
          };
          commit(next);
          sync();
        } catch (e) {
          error(e.message);
        }
        return;
      }
      select(null);
      setDrawing(true);
      tools.operation = { mode: 'itemCreate', definition };
      const start = [0, 0, getElevation()],
        target = definition.end.map((v, i) => start[i] + v - definition.start[i]);
      draft = placeItem(definition, start, target);
      syncOperationUI();
      sync();
      showProperties();
      $('status').textContent = 'Item · Välj startpunkt, sedan riktning';
      renderer.domElement.focus({ preventScroll: true });
    },
  });
  const picker = document.createElement('section');
  picker.id = 'item-picker';
  picker.hidden = true;
  picker.dataset.independentEditor = '';
  form.after(picker);
  for (const event of ['input', 'change', 'keydown'])
    picker.addEventListener(event, (e) => e.stopPropagation());
  const loadPicker = library.mountPicker(picker);
  let picking = false;
  const openPicker = async () => {
    picking = true;
    picker.hidden = false;
    $('form').hidden = $('plate-form').hidden = true;
    $('object-heading').textContent = 'Items';
    $('mode-label').textContent = 'Välj item';
    button.classList.add('active');
    button.setAttribute('aria-pressed', 'true');
    $('inspector-empty').hidden = true;
    $('inspector-properties').querySelector('.panel-title').hidden = false;
    showProperties();
    await loadPicker();
  };
  let draft = null,
    signature = '';
  button.onclick = () => {
    select(null);
    openPicker().catch((e) => {
      $('status').textContent = e.message;
    });
  };
  form.querySelector('[data-library]').onclick = () =>
    library.open(selected()?.item || tools.operation?.definition);
  form.querySelector('[data-change]').onclick = () => openPicker();
  form.querySelector('[data-remove]').onclick = remove;
  form.onsubmit = (e) => {
    e.preventDefault();
    error('');
    try {
      const source = selected(),
        definition = source?.item || tools.operation?.definition;
      if (!definition) throw Error('Välj ett item i biblioteket.');
      const rotation = Number(form.elements.rotation.value),
        start = coords('start', source),
        end = coords('end', source);
      let next;
      if (source) {
        // Translating start alone moves the rigid item; changing end chooses a new direction.
        const delta = start.map((v, i) => v - source.start[i]);
        const translated = moveItemAnchor(source, 'start', start);
        const target = end.every((v, i) => Math.abs(v - source.end[i]) < 1e-8)
          ? source.end.map((v, i) => v + delta[i])
          : end;
        next = target.every((v, i) => Math.abs(v - translated.end[i]) < 1e-8)
          ? translated
          : moveItemAnchor(translated, 'end', target);
        if (rotation !== next.rotation) next = setItemRoll(next, rotation);
        const message = validateItemObject(next);
        if (message) throw Error(message);
        commit(next);
      } else {
        next = placeItem(definition, start, end, rotation);
        save(next);
      }
      signature = '';
      sync();
    } catch (e) {
      error(e.message);
    }
  };
  function fill(source) {
    for (const input of form.querySelectorAll('[data-item-coord]')) {
      const [key, i] = input.dataset.itemCoord.split(':');
      input.value = Math.round(source[key][i] * 1000) / 1000;
    }
    form.elements.rotation.value = source.rotation;
  }
  function sync() {
    const source = selected(),
      creating = tools.operation?.mode === 'itemCreate',
      object = creating ? draft : source;
    form.hidden = !object || ui.selectedIds.size > 1;
    button.classList.toggle('active', creating || picking);
    button.setAttribute('aria-pressed', String(creating || picking));
    if (!creating && (tools.drawing || tools.operation)) picking = false;
    picker.hidden = !(creating || picking || !!source) || ui.selectedIds.size > 1;
    if (!creating && !source && ui.selected != null) {
      picking = false;
      picker.hidden = true;
    }
    if (form.hidden) return;
    $('form').hidden = $('plate-form').hidden = true;
    $('object-heading').textContent = 'Item';
    $('mode-label').textContent = creating ? 'Nytt item' : source.name;
    form.querySelector('.item-form-reference').textContent =
      `${object.item.name} · ${object.item.article || 'Artikel utan nummer'} · v${object.item.revision}`;
    form.inert = !!tools.operation && !creating;
    form.querySelector('[data-remove]').hidden = creating;
    form.querySelector('[type=submit]').textContent = creating ? 'Skapa item' : 'Uppdatera item';
    const next = JSON.stringify([
      object.id,
      object.item.id,
      object.item.revision,
      object.start,
      object.end,
      object.rotation,
    ]);
    if (signature !== next) {
      fill(object);
      signature = next;
      error('');
    }
  }
  return {
    sync,
    library,
    candidate(start, target) {
      const up = tools.temporaryPlane
        ? new THREE.Vector3(...tools.temporaryPlane.u)
            .cross(new THREE.Vector3(...tools.temporaryPlane.v))
            .toArray()
        : [0, 0, 1];
      return placeItem(
        tools.operation.definition,
        start,
        target,
        Number(form.elements.rotation.value),
        up,
      );
    },
    preview(object) {
      if (object.type === 'item' && tools.operation?.mode === 'itemCreate') {
        draft = object;
        fill(object);
      }
    },
    isCreating: () => tools.operation?.mode === 'itemCreate',
  };
}
