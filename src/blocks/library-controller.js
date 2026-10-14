import { BlockStore } from './library-store.js';
import { BlockEditor } from './editor-controller.js';
import { validateBlockGeometry } from './validation.js';
import { evaluateBlock } from './definition.js';
import { nextBlockVersion } from './library-data.js';
import { createBlockPreview } from './editor-renderer.js';
import { blockButton, blockField, flushBlockFields } from './editor-fields.js';
import { installLibraryWorkspace } from '../ui/library-workspace.js';
import { renderLibraryTree } from '../ui/library-tree.js';
import { installFloatingWindow } from '../ui/floating-window.js';
let librarySequence = 0;
export class BlockLibrary {
  constructor({ use, create }) {
    this.store = new BlockStore();
    this.editor = new BlockEditor();
    this.use = use;
    this.dialog = document.createElement('dialog');
    this.dialog.id = `block-library-${++librarySequence}`;
    this.dialog.className = 'block-library';
    this.dialog.setAttribute('aria-label', 'Blockbibliotek');
    const header = document.createElement('header'),
      title = document.createElement('strong');
    title.textContent = 'Blockbibliotek';
    header.append(
      title,
      blockButton('Stäng', () => this.dialog.close()),
    );
    this.dialog.append(header);
    const search = document.createElement('input');
    search.placeholder = 'Sök block';
    search.setAttribute('aria-label', 'Sök block');
    this.search = search;
    this.tree = document.createElement('div');
    this.details = document.createElement('div');
    this.message = document.createElement('div');
    this.message.setAttribute('role', 'status');
    const edit = blockButton('Redigera', () => {
      const d = this.selected();
      if (d) this.edit(d);
    });
    const useButton = blockButton('Använd', () => {
      const d = this.selected();
      if (d)
        this.run(() => {
          flushBlockFields(this.details);
          validateBlockGeometry(evaluateBlock(d, this.values), d);
          this.use(d, { values: { ...this.values }, anchorId: this.anchorId });
          this.dialog.close();
        });
    });
    this.editButton = edit;
    this.useButton = useButton;
    this.file = document.createElement('input');
    this.file.type = 'file';
    this.file.accept = '.json';
    this.file.hidden = true;
    this.file.onchange = async () => {
      try {
        const file = this.file.files[0];
        if (!file) return;
        if (file.size > 20e6) throw Error('Blockfilen är för stor.');
        const data = JSON.parse(await file.text());
        for (const definition of data.definitions || [])
          validateBlockGeometry(evaluateBlock(definition), definition);
        this.store.import(data);
        this.refresh();
      } catch (error) {
        this.message.textContent = error.message;
      } finally {
        this.file.value = '';
      }
    };
    installLibraryWorkspace(this.dialog, {
      search,
      tree: this.tree,
      details: this.details,
      refresh: () => this.refresh(),
      message: this.message,
      edit,
      use: useButton,
      commands: [
        { node: blockButton('Från markering…', () => this.run(create)), icon: 'plus' },
        { node: blockButton('Importera', () => this.file.click()), icon: 'library' },
        {
          node: blockButton('Exportera', () =>
            this.run(() => {
              const blob = new Blob([JSON.stringify(this.store.read(), null, 2)], {
                  type: 'application/json',
                }),
                url = URL.createObjectURL(blob),
                link = document.createElement('a');
              link.href = url;
              link.download = 'blockbibliotek.json';
              link.click();
              URL.revokeObjectURL(url);
            }),
          ),
          icon: 'save',
        },
        {
          node: blockButton('Ta bort version', () =>
            this.run(() => {
              const d = this.selected();
              if (d) {
                this.store.remove(d.id, d.revision);
                this.key = null;
                this.refresh();
              }
            }),
          ),
          icon: 'delete',
        },
      ],
    });
    this.dialog.append(this.file);
    document.body.append(this.dialog);
    this.window = installFloatingWindow(this.dialog);
    search.oninput = () => this.refresh();
    this.dialog.addEventListener('close', () => {
      this.preview?.dispose();
      this.preview = null;
    });
  }
  run(action) {
    try {
      return action();
    } catch (error) {
      this.message.textContent = error.message;
    }
  }
  selected() {
    return this.store.read().definitions.find((d) => `${d.id}:${d.revision}` === this.key);
  }
  open(dimension) {
    this.dimension = dimension;
    this.message.textContent = '';
    this.window.open();
    this.run(() => this.refresh());
  }
  refresh() {
    const definitions = this.store
      .read()
      .definitions.filter((d) => !this.dimension || d.dimension === this.dimension)
      .filter((d) => d.name.toLocaleLowerCase().includes(this.search.value.toLocaleLowerCase()));
    if (!definitions.some((d) => `${d.id}:${d.revision}` === this.key))
      this.key = definitions.length
        ? `${definitions.at(-1).id}:${definitions.at(-1).revision}`
        : null;
    const nodes = [2, 3]
      .filter((d) => !this.dimension || d === this.dimension)
      .map((d) => ({
        key: `dimension-${d}`,
        label: `${d}D-block`,
        children: [...new Set(definitions.filter((b) => b.dimension === d).map((b) => b.id))].map(
          (id) => {
            const versions = definitions
              .filter((b) => b.id === id)
              .sort((a, b) => b.revision - a.revision);
            return {
              key: id,
              label: versions[0].name,
              children: versions.map((b) => ({
                key: `${b.id}:${b.revision}`,
                label: `${b.name} · v${b.revision}`,
              })),
            };
          },
        ),
      }));
    renderLibraryTree(this.tree, {
      nodes,
      selectedKey: this.key,
      query: this.search.value,
      onSelect: (node) => {
        this.key = node.key;
        this.renderDetails();
      },
      empty: 'Rita vanliga objekt och välj Från markering för att skapa ditt första block.',
    });
    this.renderDetails();
  }
  renderDetails() {
    this.preview?.dispose();
    this.preview = null;
    this.details.replaceChildren();
    const definition = this.selected();
    this.editButton.disabled = this.useButton.disabled = !definition;
    if (!definition) return;
    this.values = {};
    this.anchorId = definition.anchors[0].id;
    const title = document.createElement('h3');
    title.textContent = `${definition.name} · v${definition.revision}`;
    const text = document.createElement('p');
    text.textContent = `${definition.dimension}D · ${definition.members.length} objekt · ${definition.units === 'paper' ? 'Pappersmått' : 'Modellmått'}`;
    const host = document.createElement('div');
    host.className = 'block-library-preview block-editor-preview';
    this.details.append(title, text, host);
    for (const parameter of definition.parameters) {
      const row = blockField(`${parameter.name} · ${parameter.unit}`, parameter.value, (value) => {
        this.values[parameter.name] = value;
        this.run(() => {
          const result = evaluateBlock(definition, this.values);
          validateBlockGeometry(result, definition);
          this.preview.render(definition, result);
          this.message.textContent = '';
        });
      });
      this.details.append(row);
    }
    this.details.append(
      blockField('Insättningspunkt', this.anchorId, (value) => (this.anchorId = value), {
        options: definition.anchors.map((a) => [a.id, a.name]),
      }),
    );
    this.preview = createBlockPreview(
      host,
      definition.dimension,
      () => {},
      (text) => (this.message.textContent = text),
    );
    this.preview.render(definition, evaluateBlock(definition));
  }
  edit(definition, prepare = () => () => {}) {
    this.editor.open(definition, (next) => {
      validateBlockGeometry(evaluateBlock(next), next);
      const candidate = nextBlockVersion(this.store.read(), next).definition,
        commit = prepare(candidate);
      const saved = this.store.save(next);
      commit();
      this.key = `${saved.id}:${saved.revision}`;
      if (this.dialog.open) this.refresh();
    });
  }
  latest(definition) {
    return (
      this.store
        .read()
        .definitions.filter((d) => d.id === definition.id)
        .sort((a, b) => b.revision - a.revision)[0] || definition
    );
  }
}
