import { drawingFonts } from './drawing-preferences.js';
import {
  DRAWING_PRESETS_KEY,
  readDrawingPresets,
  normalizePreset,
  applyDrawingPreset,
} from './drawing-presets.js';
import { fillLayoutPicker } from './drawing-layout.js';
export function presetEditor(dialog, singleSheet) {
  const section = dialog.querySelector('section');
  section.innerHTML =
    '<h3>Inställningsbibliotek</h3><p>Ändringar i biblioteket påverkar inte befintliga ritningar. Tillämpa ersätter textstil, layout och visningsval på den aktuella ritningen.</p><label>Uppsättning<select aria-label="Uppsättning"></select></label><div class="preset-actions"><button type="button" data-new>Ny</button><button type="button" data-copy>Kopiera</button><button type="button" data-delete>Ta bort</button></div>';
  const picker = section.querySelector('select'),
    fields = {};
  function field(key, title, input) {
    const label = document.createElement('label');
    label.textContent = title;
    input.setAttribute('aria-label', title);
    label.append(input);
    section.append(label);
    fields[key] = input;
    return input;
  }
  const name = field('name', 'Namn', document.createElement('input'));
  name.required = true;
  name.maxLength = 80;
  const font = field('font', 'Typsnitt', document.createElement('select'));
  font.append(...drawingFonts.map(([name, value]) => new Option(name, value)));
  for (const [key, title, step, max] of [
    ['dimensionSize', 'Måtttext · mm', 0.1, 20],
    ['leaderSize', 'Part mark / leader · mm', 0.1, 20],
    ['lineWidth', 'Mått- och leaderlinjer · mm', 0.01, 2],
  ]) {
    const input = field(key, title, document.createElement('input'));
    Object.assign(input, { type: 'number', min: step, step, max, required: true });
  }
  const hidden = field('hiddenLines', 'Skymda linjer', document.createElement('select'));
  hidden.append(
    new Option('Automatiskt · på för Single Part, av för GA', 'auto'),
    new Option('Visa', 'yes'),
    new Option('Dölj', 'no'),
  );
  for (const [key, title] of [
    ['showGrid', 'Visa stomlinjer'],
    ['showLevels', 'Visa höjdlinjer i sektioner'],
  ]) {
    const input = field(key, title, document.createElement('input'));
    input.type = 'checkbox';
    input.parentElement.className = 'drawing-check';
  }
  const layout = field('layoutId', 'Förvald layout', document.createElement('select'));
  const defaultCheck = document.createElement('input');
  defaultCheck.type = 'checkbox';
  const defaultLabel = document.createElement('label');
  defaultLabel.className = 'drawing-check';
  defaultLabel.append(defaultCheck, 'Standard för nya ritningar');
  section.append(defaultLabel);
  let library, currentId, target;
  const message = dialog.querySelector('[role=status]');
  const current = () => library.items.find((p) => p.id === currentId);
  const capture = () => {
    Object.assign(
      current(),
      normalizePreset({
        ...current(),
        ...Object.fromEntries(
          Object.entries(fields).map(([key, input]) => [
            key,
            input.type === 'checkbox' ? input.checked : input.value,
          ]),
        ),
        hiddenLines: hidden.value === 'auto' ? null : hidden.value === 'yes',
      }),
    );
    if (defaultCheck.checked) library.defaultId = currentId;
  };
  const display = () => {
    picker.replaceChildren(...library.items.map((p) => new Option(p.name, p.id)));
    picker.value = currentId;
    const p = current();
    fillLayoutPicker(layout, p.layoutId);
    for (const [key, input] of Object.entries(fields))
      if (input.type === 'checkbox') input.checked = p[key];
      else input.value = p[key];
    hidden.value = p.hiddenLines === null ? 'auto' : p.hiddenLines ? 'yes' : 'no';
    defaultCheck.checked = library.defaultId === currentId;
    section.querySelector('[data-delete]').disabled = library.items.length === 1;
  };
  picker.onchange = () => {
    const id = picker.value;
    capture();
    currentId = id;
    display();
  };
  for (const action of ['new', 'copy'])
    section.querySelector('[data-' + action + ']').onclick = () => {
      capture();
      const p = normalizePreset(action === 'copy' ? current() : {});
      p.id = crypto.randomUUID();
      p.name = action === 'copy' ? p.name + ' kopia' : 'Ny inställning';
      library.items.push(p);
      currentId = p.id;
      display();
      name.focus();
      name.select();
    };
  section.querySelector('[data-delete]').onclick = () => {
    library.items = library.items.filter((p) => p.id !== currentId);
    if (library.defaultId === currentId) library.defaultId = library.items[0].id;
    currentId = library.items[0].id;
    display();
  };
  const persist = () => {
    if (!dialog.querySelector('form').reportValidity()) return false;
    capture();
    if (
      new Set(library.items.map((p) => p.name.toLocaleLowerCase())).size !== library.items.length
    ) {
      message.textContent = 'Ge varje uppsättning ett unikt namn.';
      return false;
    }
    try {
      localStorage.setItem(DRAWING_PRESETS_KEY, JSON.stringify(library));
      return true;
    } catch {
      message.textContent = 'Inställningarna kunde inte sparas i webbläsaren.';
      return false;
    }
  };
  dialog.querySelector('[type=submit]').textContent = 'Spara bibliotek';
  dialog.querySelector('form').onsubmit = (e) => {
    e.preventDefault();
    if (persist()) dialog.close();
  };
  const apply = document.createElement('button');
  apply.type = 'button';
  apply.textContent = 'Tillämpa på ritningen';
  dialog.querySelector('footer').append(apply);
  apply.onclick = () => {
    if (!persist() || !target?.record) return;
    applyDrawingPreset(target.record, current());
    target.fontSelect.value = target.record.typography.font;
    fillLayoutPicker(target.layoutSelect, current().layoutId);
    if (target === singleSheet) {
      target.syncInspector();
      target.render();
    } else {
      target.views.load(target.views.active);
      target.refreshPaper();
      target.views.refresh();
    }
    dialog.close();
  };
  return (editor) => {
    library = readDrawingPresets();
    currentId = library.defaultId;
    target = editor?.record ? editor : null;
    apply.hidden = !target;
    message.textContent = '';
    display();
  };
}
