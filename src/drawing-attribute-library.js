import { installLibraryWorkspace } from './ui/library-workspace.js';
import { renderLibraryTree } from './ui/library-tree.js';
import { adoptAttributeLabel } from './inspector/attributes.js';
import { installFloatingWindow } from './ui/floating-window.js';
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
      <div class="attribute-library-body">
      <form><h3 data-editor-title></h3><label>Namn<input name="attributeName" required maxlength="80"></label><label>Attributnyckel<input name="key" readonly></label><label>Datatyp<select name="dataType"></select></label><label>Gäller för<select name="scope"></select></label><label data-options>Val · ett per rad<textarea name="options" rows="7" placeholder="För granskning&#10;Godkänd"></textarea></label><p data-help></p><p role="status" data-message></p><footer><button type="button" data-reset>Återställ formulär</button><button type="submit" class="primary">Spara attribut</button></footer></form></div>`;
    document.body.append(this.dialog);
    this.window = installFloatingWindow(this.dialog);
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
    this.save = this.form.querySelector('[type=submit]');
    this.tree = document.createElement('div');
    this.tree.setAttribute('aria-label', 'Attribut');
    const oldBody = this.dialog.querySelector('.attribute-library-body');
    const oldToolbar = this.dialog.querySelector('.attribute-library-toolbar');
    const oldFooter = this.form.querySelector('footer');
    this.form.querySelectorAll('label').forEach(adoptAttributeLabel);
    installLibraryWorkspace(this.dialog, {
      search: this.search,
      tree: this.tree,
      details: this.form,
      commands: [
        { node: this.dialog.querySelector('[data-new]'), label: 'Nytt attribut', icon: 'plus' },
      ],
      actions: [this.dialog.querySelector('[data-reset]'), this.save],
      refresh: () => this.render(),
    });
    this.form.id = 'drawing-attribute-form';
    this.save.setAttribute('form', this.form.id);
    oldFooter.remove();
    oldBody.remove();
    oldToolbar.remove();
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
    this.window.open();
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
    this.dialog.querySelector('[data-help]').textContent =
      `${source(a)} · Värdet redigerbart: ${a.editable ? 'Ja' : 'Nej'}. ` +
      (!configurable
        ? 'Detta attribut har en fast datatyp. Värdet ändras där det hör hemma i projektet eller ritningen.'
        : 'Val (ett) ger en vallista. Flerval tillåter flera värden på samma ritning. Tidigare värden behålls när listan ändras.');
    this.dialog.querySelector('[data-message]').textContent = '';
    this.save.disabled = builtin && !configurable;
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
    const groups = [
      ['project.', 'Projekt'],
      ['drawing.', 'Ritning'],
      ['report.', 'Rapport'],
      ['custom.', 'Egna attribut'],
      ['', 'Modell och mängder'],
    ];
    const nodes = groups
      .map(([prefix, label]) => ({
        key: `group:${label}`,
        label,
        children: items
          .filter((a) =>
            prefix ? a.key.startsWith(prefix) : !groups.some(([p]) => p && a.key.startsWith(p)),
          )
          .map((a) => ({
            key: a.key,
            label: a.name,
            badge: attributeDataTypes[a.dataType],
            title: `${a.name} · ${attributeDataTypes[a.dataType]} · ${scopes[a.scope]} · ${source(a)} · Redigerbart: ${a.editable ? 'Ja' : 'Nej'}`,
            attribute: a,
          })),
      }))
      .filter((node) => node.children.length);
    renderLibraryTree(this.tree, {
      nodes,
      selectedKey: this.selected?.key,
      query,
      onSelect: (node) => this.edit(node.attribute),
      empty: 'Inga attribut matchar sökningen.',
    });
  }
}
