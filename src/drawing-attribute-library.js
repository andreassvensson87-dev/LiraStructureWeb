import {
  drawingAttributes,
  builtInAttributes,
  attributeDataTypes,
  attributeChoiceConfigurable,
  saveAttributeDefinition,
} from './drawing-attributes.js';
import './drawing-attribute-library.css';

const scopes = { all: 'Alla ritningar', GA: 'GA', SP: 'Single Part', AS: 'Assembly' };
const source = (a) =>
  a.key.startsWith('custom.')
    ? 'Eget attribut'
    : a.key.startsWith('project.')
      ? 'Projekt'
      : a.editable
        ? 'Ritning'
        : 'Automatiskt';
let library;
export function openDrawingAttributeLibrary(onChange = () => {}) {
  library ??= new DrawingAttributeLibrary();
  library.onChange = onChange;
  library.open();
}
class DrawingAttributeLibrary {
  constructor() {
    this.dialog = document.createElement('dialog');
    this.dialog.id = 'drawing-attribute-library';
    this.dialog.setAttribute('aria-label', 'Attributbibliotek');
    this.dialog.innerHTML = `<header><div><h2>Attributbibliotek</h2><p>Alla ritningsattribut, datatyper och fördefinierade val.</p></div><button type="button" aria-label="Stäng attributbibliotek">×</button></header>
      <div class="attribute-library-toolbar"><input type="search" aria-label="Sök attribut" placeholder="Sök namn, nyckel eller datatyp"><button type="button" data-new>Nytt attribut</button></div>
      <div class="attribute-library-body"><div class="attribute-library-table"><table><thead><tr><th>Attribut</th><th>Datatyp</th><th>Gäller för</th><th>Källa</th><th>Redigerbart</th><th>Val</th></tr></thead><tbody></tbody></table><p data-empty hidden>Inga attribut matchar sökningen.</p></div>
      <form><h3 data-editor-title></h3><label>Namn<input name="attributeName" required maxlength="80"></label><label>Attributnyckel<input name="key" readonly></label><label>Datatyp<select name="dataType"></select></label><label>Gäller för<select name="scope"></select></label><label data-options>Val · ett per rad<textarea name="options" rows="7" placeholder="För granskning&#10;Godkänd"></textarea></label><p data-help></p><p role="status" data-message></p><footer><button type="button" data-reset>Återställ formulär</button><button type="submit" class="primary">Spara attribut</button></footer></form></div>`;
    document.body.append(this.dialog);
    this.form = this.dialog.querySelector('form');
    this.fields = this.form.elements;
    this.search = this.dialog.querySelector('input[type=search]');
    this.search.oninput = () => this.render();
    this.dialog.querySelector('header button').onclick = () => this.dialog.close();
    this.dialog.querySelector('[data-new]').onclick = () =>
      this.edit({
        key: `custom.${crypto.randomUUID()}`,
        name: '',
        dataType: 'text',
        scope: 'all',
        editable: true,
      });
    this.dialog.querySelector('[data-reset]').onclick = () => this.edit(this.selected);
    this.fields.dataType.onchange = () => this.optionsVisibility();
    this.dialog.addEventListener('keydown', (e) => e.stopPropagation());
    this.form.onsubmit = (e) => {
      e.preventDefault();
      const message = this.dialog.querySelector('[data-message]');
      try {
        const saved = saveAttributeDefinition({
          ...this.selected,
          name: this.fields.attributeName.value,
          scope: this.fields.scope.value,
          dataType: this.fields.dataType.value,
          options: this.fields.options.value.split(/\r?\n/),
        });
        this.edit(drawingAttributes().find((a) => a.key === saved.key));
        this.render();
        message.textContent = 'Attributet sparat. Vallistorna används i ritningshanteraren.';
        this.onChange();
      } catch (error) {
        message.textContent = error.message;
      }
    };
  }
  open() {
    this.search.value = '';
    const attributes = drawingAttributes();
    this.edit(
      attributes.find((a) => a.key === this.selected?.key) ||
        attributes.find((a) => a.key === 'drawing.issueStatus'),
    );
    this.render();
    this.dialog.showModal();
  }
  optionsVisibility() {
    this.dialog.querySelector('[data-options]').hidden = !['choice', 'multichoice'].includes(
      this.fields.dataType.value,
    );
  }
  edit(a) {
    this.selected = structuredClone(a);
    const builtin = builtInAttributes.some((b) => b.key === a.key);
    const configurable = attributeChoiceConfigurable(a);
    this.dialog.querySelector('[data-editor-title]').textContent = a.name || 'Nytt attribut';
    this.fields.attributeName.value = a.name;
    this.fields.attributeName.readOnly = builtin;
    this.fields.key.value = a.key;
    this.fields.dataType.replaceChildren(
      ...Object.entries(attributeDataTypes)
        .filter(
          ([type]) =>
            !builtin ||
            (configurable ? ['text', 'choice', 'multichoice'].includes(type) : type === a.dataType),
        )
        .map(([value, name]) => new Option(name, value)),
    );
    this.fields.dataType.value = a.dataType;
    this.fields.dataType.disabled = builtin && !configurable;
    this.fields.scope.replaceChildren(
      ...Object.entries(scopes).map(([value, name]) => new Option(name, value)),
    );
    this.fields.scope.value = a.scope;
    this.fields.scope.disabled = builtin;
    this.fields.options.value = (a.options || []).join('\n');
    this.dialog.querySelector('[data-help]').textContent = !configurable
      ? 'Detta attribut har en fast datatyp. Värdet ändras där det hör hemma i projektet eller ritningen.'
      : 'Val (ett) ger en vallista. Flerval tillåter flera värden på samma ritning. Tidigare värden behålls när listan ändras.';
    this.dialog.querySelector('[data-message]').textContent = '';
    this.form.querySelector('[type=submit]').disabled = builtin && !configurable;
    this.optionsVisibility();
    this.render();
    this.form.scrollTop = 0;
  }
  render() {
    const query = this.search.value.trim().toLocaleLowerCase('sv-SE');
    const items = drawingAttributes().filter((a) =>
      `${a.name} ${a.key} ${attributeDataTypes[a.dataType]} ${(a.options || []).join(' ')}`
        .toLocaleLowerCase('sv-SE')
        .includes(query),
    );
    const body = this.dialog.querySelector('tbody');
    body.replaceChildren();
    for (const a of items) {
      const row = document.createElement('tr');
      row.dataset.selected = String(a.key === this.selected?.key);
      const identity = document.createElement('td');
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = a.name;
      button.setAttribute('aria-pressed', String(a.key === this.selected?.key));
      button.onclick = () => this.edit(a);
      const key = document.createElement('small');
      key.textContent = a.key;
      identity.append(button, key);
      row.append(identity);
      for (const value of [
        attributeDataTypes[a.dataType],
        scopes[a.scope],
        source(a),
        a.editable ? 'Ja' : 'Nej',
        a.options?.join(' · ') || '—',
      ]) {
        const cell = document.createElement('td');
        cell.textContent = value;
        row.append(cell);
      }
      body.append(row);
    }
    this.dialog.querySelector('[data-empty]').hidden = !!items.length;
  }
}
