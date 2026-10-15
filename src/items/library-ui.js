import { ItemEditor } from './editor.js';
import { button, field } from './fields.js';
import { installDialogPresentation } from '../ui/dialog-presentation.js';

import { installFloatingWindow } from '../ui/floating-window.js';
import { installItemLibraryLayout } from '../ui/library-workspace.js';
import { renderLibraryTree } from '../ui/library-tree.js';
import { adoptAttributeLabel } from '../inspector/attributes.js';
import {
  ItemStore,
  emptyItemLibrary,
  validateItemLibrary,
  folderPath,
  folderDescendants,
  editItemFolder,
} from './store.js';
import { itemKey } from './data.js';
import { importStepFile } from './import.js';
import { ItemView } from './view.js';
import { itemLibraryTree } from './tree-data.js';
import { createLibraryTreePicker } from '../ui/library-tree-picker.js';

import './style.css';
import { bundledItemCatalog } from './bundled.js';
export class ItemLibrary {
  constructor({ use, currentItems = () => [] }) {
    this.use = use;
    this.currentItems = currentItems;
    this.store = new ItemStore(bundledItemCatalog);
    this.library = emptyItemLibrary();
    this.folder = 'standard';
    this.selection = null;
    this.ready = null;
    this.expanded = new Set();
    this.page = 0;
    this.dialog = document.createElement('dialog');
    this.dialog.id = 'item-library';
    this.dialog.setAttribute('aria-label', 'Item-bibliotek');
    this.dialog.innerHTML = `<header class="item-header"><div><strong>Item-bibliotek</strong><span>mm · 3D</span></div><button type="button" data-close aria-label="Stäng item-bibliotek">×</button></header>
      <div class="item-library-layout"><nav class="item-library-nav" aria-label="Item-mappar">
        <div class="item-drop" role="group" aria-label="Importera STEP-filer"><strong>Släpp STEP-filer här</strong><button type="button" data-files>Välj filer</button><small>.step / .stp · Flera filer</small><span data-destination></span></div>
        <input type="search" data-search placeholder="Sök namn eller artikelnummer" aria-label="Sök items"><div data-tree></div><div class="item-folder-actions"><button type="button" data-new-folder>Ny undermapp</button><button type="button" data-edit-folder>Ändra mapp</button><button type="button" data-delete-folder>Ta bort tom mapp</button></div><small data-count></small></nav>
        <section class="item-article-list"><div class="item-actions"><button type="button" data-import>Importera STEP</button><button type="button" data-export>Exportera bibliotek</button><button type="button" data-import-library>Importera bibliotek</button><button type="button" data-edit>Redigera item</button><button type="button" data-delete>Ta bort item</button></div>
        <p class="item-breadcrumb" data-path></p><div class="item-table-wrap"><table><thead><tr><th><button type="button" data-sort="article">Artikelnummer ↕</button></th><th><button type="button" data-sort="name">Namn ↕</button></th><th>Geometri</th></tr></thead><tbody data-rows></tbody></table><p class="inspector-note" data-empty>Importera STEP-filer för att börja.</p></div>
        <div class="item-pagination" data-pages></div><p class="item-status" data-status role="status"></p><button type="button" data-cancel-import hidden>Avbryt import</button></section>
        <section class="item-library-properties"><div class="item-library-preview"></div><div data-properties></div><button type="button" class="primary" data-use>Använd item</button></section></div>
        <input type="file" data-step-input accept=".step,.stp" multiple hidden><input type="file" data-library-input accept=".json" hidden>`;
    document.body.append(this.dialog);
    this.window = installFloatingWindow(this.dialog);
    const footer = document.createElement('footer');
    footer.append(
      this.dialog.querySelector('[data-edit]'),
      this.dialog.querySelector('[data-use]'),
    );
    this.dialog.append(footer);
    this.$ = (s) => this.dialog.querySelector(s);
    this.$('[data-close]').onclick = () => this.dialog.close();
    this.dialog.addEventListener('keydown', (e) => e.stopPropagation());
    this.dialog.addEventListener('close', () => {
      this.abort?.abort();
      this.preview?.dispose();
      this.preview = null;
    });
    for (const s of ['[data-files]', '[data-import]'])
      this.$(s).onclick = () => {
        this.$('[data-step-input]').value = '';
        this.$('[data-step-input]').click();
      };
    this.$('[data-step-input]').onchange = (e) => this.importFiles([...e.target.files]);
    this.$('[data-search]').oninput = () => {
      this.render();
    };
    this.$('[data-edit-folder]').onclick = () => this.newFolder(true);
    this.$('[data-delete-folder]').onclick = () => this.deleteFolder();
    this.$('[data-new-folder]').onclick = () => this.newFolder();
    this.$('[data-edit]').onclick = () => this.edit();
    this.$('[data-delete]').onclick = () => this.deleteItem();
    this.$('[data-use]').onclick = () => {
      const entry = this.selected();
      if (entry) {
        this.dialog.close();
        this.use(entry.definition);
      }
    };
    this.$('[data-export]').onclick = () => this.exportLibrary();
    this.$('[data-import-library]').onclick = () => {
      this.$('[data-library-input]').value = '';
      this.$('[data-library-input]').click();
    };
    this.$('[data-library-input]').onchange = (e) => this.importLibrary(e.target.files[0]);
    this.$('[data-cancel-import]').onclick = () => this.abort?.abort();
    const drop = this.$('.item-drop');
    drop.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = this.busy ? 'none' : 'copy';
      drop.classList.toggle('drag-over', !this.busy);
    });
    drop.addEventListener('dragleave', () => drop.classList.remove('drag-over'));
    drop.addEventListener('drop', (e) => {
      e.preventDefault();
      drop.classList.remove('drag-over');
      if (!this.busy) this.importFiles([...e.dataTransfer.files]);
    });
    this.dialog.addEventListener('dragover', (e) => e.preventDefault());
    this.dialog.addEventListener('drop', (e) => e.preventDefault());
    installItemLibraryLayout(this.dialog, () => this.render());
    this.itemEditor = new ItemEditor({
      getEntry: () => this.selected(),
      isBusy: () => this.busy,
      getLibrary: () => this.library,
      latest: () => this.latest(),
      persist: (next) => this.persist(next),
      onSaved: (definition) => {
        this.selection = itemKey(definition);
      },
      onClose: () => this.render(),
      onUse: (definition) => {
        this.dialog.close();
        this.use(definition);
      },
      status: (text) => this.status(text),
    });
  }
  async ensureLoaded() {
    this.ready ||= this.store
      .load()
      .then((l) => {
        this.library = l;
        this.folder =
          l.folders.find((f) => f.parent == null && f.id !== 'standard')?.id || l.folders[0].id;
      })
      .catch((error) => {
        this.loadError = error.message;
        this.storageFailed = true;
      });
    await this.ready;
  }
  async open(definition = null) {
    await this.ensureLoaded();
    if (
      definition &&
      !this.library.items.some((e) => itemKey(e.definition) === itemKey(definition))
    ) {
      try {
        await this.persist({
          ...this.library,
          items: [...this.library.items, { definition, folder: this.folder, starred: false }],
        });
      } catch (error) {
        this.loadError = error.message;
      }
    }
    if (definition) {
      const entry = this.library.items.find((e) => itemKey(e.definition) === itemKey(definition));
      if (entry) {
        this.selection = itemKey(definition);
        this.folder = entry.folder;
      }
    }
    this.revealFolder();
    this.window.open();
    this.preview = new ItemView(this.$('.item-library-preview'));
    this.render();
    if (this.loadError) this.status(this.loadError);
  }
  status(text) {
    this.$('[data-status]').textContent = text;
  }
  selected() {
    return this.library.items.find((e) => itemKey(e.definition) === this.selection);
  }
  async persist(next) {
    if (this.storageFailed) throw Error(this.loadError);
    validateItemLibrary(next);
    await this.store.save(next);
    this.library = next;
    this.picker?.sync();
  }
  latest() {
    const map = new Map();
    for (const entry of this.library.items) {
      const previous = map.get(entry.definition.id);
      if (!previous || previous.definition.revision < entry.definition.revision)
        map.set(entry.definition.id, entry);
    }
    return [...map.values()];
  }
  render() {
    this.renderTree();
    this.renderProperties();
  }
  renderTree() {
    const query = this.$('[data-search]').value.trim();
    const nodes = itemLibraryTree(this.library, query);
    renderLibraryTree(this.$('[data-tree]'), {
      nodes,
      query,
      selectedKey: this.selection || `folder:${this.folder}`,
      onSelect: (node) => {
        if (this.busy) return;
        if (node.folder) this.folder = node.folder;
        else {
          this.selection = itemKey(node.value.definition);
          this.folder = node.value.folder;
        }
        this.render();
      },
      empty: this.latest().length
        ? 'Inga items matchar sökningen.'
        : 'Importera STEP-filer för att börja.',
    });
    const folder = this.library.folders.find((f) => f.id === this.folder);
    this.$('[data-destination]').textContent = folder
      ? `Importera till: ${folderPath(this.library, folder.id)}`
      : 'Markera en mapp för import';
    this.$('[data-count]').textContent = `${this.latest().length} items`;
    this.$('[data-new-folder]').disabled = this.busy;
    for (const action of ['edit', 'delete'])
      this.$(`[data-${action}-folder]`).disabled = !folder || this.busy;
    this.$('.item-drop').classList.toggle('disabled', !folder || this.busy);
    for (const s of ['[data-files]', '[data-import]']) this.$(s).disabled = !folder || this.busy;
  }
  renderProperties() {
    const entry = this.selected(),
      root = this.$('[data-properties]');
    root.replaceChildren();
    for (const s of ['[data-edit]', '[data-use]', '[data-delete]'])
      this.$(s).disabled = !entry || this.busy;
    if (this.preview && this.preview.item !== entry?.definition)
      this.preview.setItem(entry?.definition || null);
    const preview = this.$('.item-library-preview');
    preview.parentElement.querySelector(':scope > h3')?.remove();
    if (!entry) return;
    const heading = document.createElement('h3');
    heading.textContent = entry.definition.name;
    preview.before(heading);
    for (const [key, label] of [
      ['name', 'Namn'],
      ['article', 'Artikelnummer'],
      ['supplier', 'Leverantör'],
    ])
      field(root, label, entry.definition[key], key, { readonly: true });
    const move = document.createElement('label');
    move.className = 'field';
    move.textContent = 'Mapp';
    const destination = document.createElement('select');
    for (const f of this.library.folders)
      destination.append(new Option(folderPath(this.library, f.id), f.id));
    destination.value = entry.folder;
    destination.disabled = !!this.busy;
    destination.onchange = async () => {
      try {
        await this.persist({
          ...this.library,
          items: this.library.items.map((e) =>
            e.definition.id === entry.definition.id ? { ...e, folder: destination.value } : e,
          ),
        });
        this.folder = destination.value;
        this.revealFolder();
        this.render();
      } catch (error) {
        this.status(error.message);
      }
    };
    move.append(destination);
    adoptAttributeLabel(move);
    root.append(move);
    field(root, 'Placering', 'Start → slut', 'placement', { readonly: true });
    const info = document.createElement('small');
    info.textContent = `v${entry.definition.revision} · ${entry.definition.mesh.indices.length / 3} trianglar`;
    root.append(info);
    root.append(
      button(entry.starred ? '★ Ta bort favorit' : '☆ Lägg till favorit', async () => {
        try {
          await this.persist({
            ...this.library,
            items: this.library.items.map((e) => (e === entry ? { ...e, starred: !e.starred } : e)),
          });
          this.render();
        } catch (error) {
          this.status(error.message);
        }
      }),
    );
  }
  mountPicker(host, { getDefinition }) {
    const picker = createLibraryTreePicker({
      label: 'Biblioteksitem',
      placeholder: 'Välj item…',
      searchLabel: 'Sök item i snabblistan',
      searchPlaceholder: 'Sök item…',
      emptyLabel: 'Biblioteket är tomt.',
      getNodes: (query) => itemLibraryTree(this.library, query, { compact: true }),
      beforeOpen: async () => {
        await this.ensureLoaded();
        picker.sync();
      },
      onSelect: (node) => this.use(node.value.definition),
      getSelection: () => {
        const definition = getDefinition();
        const entry = this.library.items.find(
          (e) => itemKey(e.definition) === itemKey(definition || {}),
        );
        return {
          key: definition ? itemKey(definition) : null,
          label: definition?.name,
          path: entry ? folderPath(this.library, entry.folder) : '',
        };
      },
      getError: () => this.loadError,
      icon: 'cube',
    });
    const openLibrary = button('Öppna bibliotek ↗', () => {
      picker.close();
      this.open(getDefinition()).catch((error) => this.status(error.message));
    });
    openLibrary.className = 'library-open';
    host.replaceChildren(picker.root, openLibrary);
    this.picker = picker;
    return {
      ...picker,
      load: async () => {
        await this.ensureLoaded();
        picker.sync();
      },
    };
  }
  revealFolder() {
    let folder = this.library.folders.find((f) => f.id === this.folder);
    while (folder) {
      this.expanded.add(folder.id);
      folder = this.library.folders.find((f) => f.id === folder.parent);
    }
  }
  async deleteFolder() {
    const folder = this.library.folders.find((f) => f.id === this.folder);
    if (!folder) return;
    try {
      if (
        this.library.folders.some((f) => f.parent === folder.id) ||
        this.library.items.some((e) => e.folder === folder.id)
      )
        throw Error('Flytta först undermappar och items. Endast tomma mappar kan tas bort.');
      if (this.library.folders.length === 1) throw Error('Biblioteket behöver minst en mapp.');
      await this.persist({
        ...this.library,
        folders: this.library.folders.filter((f) => f.id !== folder.id),
      });
      this.folder = folder.parent || this.library.folders[0].id;
      this.render();
    } catch (error) {
      this.status(error.message);
    }
  }
  async newFolder(edit = false) {
    const dialog = document.createElement('dialog');
    dialog.className = 'item-small-dialog';
    dialog.innerHTML =
      '<form><h2>Ny mapp</h2><label class="field">Namn<input required maxlength="200"></label><label class="field">Överordnad mapp<select></select></label><div class="item-actions"><button type="button">Avbryt</button><button type="submit" class="primary">Skapa mapp</button></div><p role="alert"></p></form>';
    installDialogPresentation(dialog);
    const existing = edit && this.library.folders.find((f) => f.id === this.folder);
    if (existing) {
      dialog.querySelector('h2').textContent = 'Ändra mapp';
      dialog.querySelector('input').value = existing.name;
      dialog.querySelector('[type=submit]').textContent = 'Spara mapp';
    }
    const excluded = existing ? folderDescendants(this.library, existing.id) : new Set();
    const select = dialog.querySelector('select');
    select.append(new Option('Ingen — översta nivån', ''));
    for (const folder of this.library.folders)
      if (!excluded.has(folder.id))
        select.append(new Option(folderPath(this.library, folder.id), folder.id));
    select.value = existing
      ? existing.parent || ''
      : this.library.folders.some((f) => f.id === this.folder)
        ? this.folder
        : '';
    dialog.querySelector('button').onclick = () => dialog.close();
    dialog.onclose = () => dialog.remove();
    dialog.querySelector('form').onsubmit = async (e) => {
      e.preventDefault();
      try {
        const folder = {
          id: crypto.randomUUID(),
          name: dialog.querySelector('input').value.trim(),
          parent: select.value || null,
        };
        if (
          this.library.folders.some(
            (f) => f.id !== existing?.id && f.parent === folder.parent && f.name === folder.name,
          )
        )
          throw Error('Mappen finns redan.');
        await this.persist(
          existing
            ? editItemFolder(this.library, existing.id, folder.name, folder.parent)
            : { ...this.library, folders: [...this.library.folders, folder] },
        );
        this.folder = existing ? existing.id : folder.id;
        this.revealFolder();
        this.render();
        dialog.close();
      } catch (error) {
        dialog.querySelector('p').textContent = error.message;
      }
    };
    document.body.append(dialog);
    dialog.showModal();
    dialog.querySelector('input').focus();
  }
  async importFiles(files) {
    if (this.busy || !files.length) return;
    const destination = this.library.folders.find((f) => f.id === this.folder);
    if (!destination) {
      this.status('Markera en mapp innan du importerar.');
      return;
    }
    this.busy = true;
    this.abort = new AbortController();
    this.$('[data-cancel-import]').hidden = false;
    this.render();
    let imported = 0;
    const failures = [];
    try {
      for (let i = 0; i < files.length; i++) {
        if (this.abort.signal.aborted) break;
        this.status(`Importerar ${i + 1}/${files.length}: ${files[i].name} → ${destination.name}`);
        try {
          const definition = await importStepFile(files[i], { signal: this.abort.signal });
          if (
            this.library.items.some(
              (e) =>
                e.folder === destination.id && e.definition.geometryId === definition.geometryId,
            )
          ) {
            failures.push(`${files[i].name}: finns redan i mappen`);
            continue;
          }
          await this.persist({
            ...this.library,
            items: [...this.library.items, { definition, folder: destination.id, starred: false }],
          });
          this.selection = itemKey(definition);
          imported++;
        } catch (error) {
          if (this.abort.signal.aborted) break;
          failures.push(`${files[i].name}: ${error.message}`);
        }
      }
    } finally {
      this.busy = false;
      this.$('[data-cancel-import]').hidden = true;
      this.render();
      this.status(
        `${imported} items importerade till ${destination.name}${this.abort.signal.aborted ? ' · Avbruten' : ''}${failures.length ? '\n' + failures.join('\n') : ''}`,
      );
    }
  }
  exportLibrary() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(this.library)], { type: 'application/json' }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Item-bibliotek.lira-items.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    this.status('Biblioteket exporterat med geometri och mappar.');
  }
  async importLibrary(file) {
    if (!file || this.busy) return;
    try {
      if (file.size > 100 * 1024 * 1024) throw Error('Biblioteksfilen får vara högst 100 MB.');
      const incoming = validateItemLibrary(JSON.parse(await file.text()));
      const folders = new Map(this.library.folders.map((f) => [f.id, f]));
      for (const f of incoming.folders) {
        if (folders.has(f.id) && JSON.stringify(folders.get(f.id)) !== JSON.stringify(f))
          throw Error('Mappkonflikt i biblioteket.');
        folders.set(f.id, f);
      }
      const items = new Map(this.library.items.map((e) => [itemKey(e.definition), e]));
      for (const e of incoming.items) {
        const previous = items.get(itemKey(e.definition));
        if (previous && JSON.stringify(previous.definition) !== JSON.stringify(e.definition))
          throw Error('Versionskonflikt i biblioteket.');
        if (!previous) items.set(itemKey(e.definition), e);
      }
      await this.persist({
        ...this.library,
        folders: [...folders.values()],
        items: [...items.values()],
      });
      this.render();
      this.status('Item-biblioteket importerat.');
    } catch (error) {
      this.status(error.message);
    }
  }
  async deleteItem() {
    const entry = this.selected();
    if (!entry) return;
    try {
      if (this.currentItems().some((o) => o.item.id === entry.definition.id))
        throw Error('Artikeln används i modellen. Ta först bort dess placeringar.');
      await this.persist({
        ...this.library,
        items: this.library.items.filter((e) => e.definition.id !== entry.definition.id),
      });
      this.selection = null;
      this.render();
      this.status('Item borttaget från biblioteket.');
    } catch (error) {
      this.status(error.message);
    }
  }

  edit() {
    this.itemEditor.edit();
  }
}
