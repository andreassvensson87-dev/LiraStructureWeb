import { installDialogPresentation } from '../ui/dialog-presentation.js';
import { installItemWorkspace } from '../ui/editor-workspace.js';
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
  findLibraryItems,
} from './store.js';
import { itemKey, itemRevision, validateItemDefinition } from './data.js';
import { importStepFile } from './import.js';
import { ItemView } from './view.js';
import { addHelperLine } from './guides.js';
import './style.css';
import { bundledItemCatalog } from './bundled.js';
const button = (text, action, className = '') => {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = text;
  b.className = className;
  b.onclick = action;
  return b;
};
const field = (root, label, value, key, { readonly = false, type = 'text' } = {}) => {
  const row = document.createElement('label');
  row.className = 'field';
  row.textContent = label;
  const input = document.createElement('input');
  input.type = type;
  input.value = type === 'number' ? Math.round(value * 1000) / 1000 : value;
  input.dataset.itemField = key;
  input.readOnly = readonly;
  if (type === 'number') input.step = 'any';
  row.append(input);
  adoptAttributeLabel(row);
  root.append(row);
  return input;
};
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
    this.createEditor();
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
    this.renderPicker?.();
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
    const entries = findLibraryItems(this.library, 'all', query);
    const itemNode = (entry) => ({
      key: itemKey(entry.definition),
      label: [entry.definition.article, entry.definition.name].filter(Boolean).join(' · '),
      title: `${entry.definition.name} · ${entry.definition.article} · v${entry.definition.revision}`,
      value: entry,
    });
    const folders = (parent) =>
      this.library.folders
        .filter((folder) => folder.parent === parent)
        .map((folder) => {
          const children = [
            ...folders(folder.id),
            ...entries.filter((entry) => entry.folder === folder.id).map(itemNode),
          ];
          return {
            key: `folder:${folder.id}`,
            label: folder.name,
            folder: folder.id,
            selectable: true,
            children,
          };
        })
        .filter((node) => !query || node.children.length);
    const favorites = entries.filter((entry) => entry.starred);
    const nodes = [
      ...(favorites.length
        ? [
            {
              key: 'favorites',
              label: 'Favoriter',
              children: favorites.map((entry) => ({
                ...itemNode(entry),
                key: 'favorite:' + itemKey(entry.definition),
              })),
            },
          ]
        : []),
      ...folders(null),
    ];
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
  mountPicker(host) {
    host.innerHTML = `<strong>Välj item</strong><label class="field">Mapp<select data-picker-folder aria-label="Item-mapp"></select></label>
      <input type="search" data-picker-search placeholder="Sök item, artikel eller leverantör" aria-label="Sök item i modellen">
      <div class="item-picker-list" data-picker-list></div><div class="item-pagination" data-picker-pages></div>
      <p class="inspector-note" data-picker-status role="status"></p><button type="button" data-picker-library>Hantera bibliotek ↗</button>`;
    const $ = (selector) => host.querySelector(selector);
    this.pickerFolder = '';
    try {
      this.pickerFolder = localStorage.getItem('lirastructure-item-folder') || '';
    } catch {
      /* Storage may be unavailable. */
    }
    this.pickerPage = 0;
    $('[data-picker-library]').onclick = () => this.open();
    $('[data-picker-folder]').onchange = (e) => {
      this.pickerFolder = e.target.value;
      try {
        localStorage.setItem('lirastructure-item-folder', this.pickerFolder);
      } catch {
        /* Keep the selection for this session. */
      }
      this.pickerPage = 0;
      this.renderPicker();
    };
    $('[data-picker-search]').oninput = () => {
      this.pickerPage = 0;
      this.renderPicker();
    };
    this.renderPicker = () => {
      const select = $('[data-picker-folder]');
      select.replaceChildren(
        new Option('Välj mapp…', ''),
        new Option('Alla items', 'all'),
        new Option('☆ Favoriter', 'starred'),
      );
      const append = (parent) => {
        for (const f of this.library.folders.filter((f) => f.parent === parent)) {
          select.append(new Option(folderPath(this.library, f.id), f.id));
          append(f.id);
        }
      };
      append(null);
      if (![...select.options].some((o) => o.value === this.pickerFolder)) this.pickerFolder = '';
      select.value = this.pickerFolder;
      const entries = findLibraryItems(
        this.library,
        this.pickerFolder,
        $('[data-picker-search]').value,
        { recursive: false },
      ).sort((a, b) =>
        a.definition.name.localeCompare(b.definition.name, 'sv-SE', { numeric: true }),
      );
      this.pickerPage = Math.max(0, Math.min(this.pickerPage, Math.ceil(entries.length / 30) - 1));
      const list = $('[data-picker-list]');
      list.replaceChildren();
      for (const entry of entries.slice(this.pickerPage * 30, (this.pickerPage + 1) * 30)) {
        const b = button(entry.definition.name, () => this.use(entry.definition));
        b.title = [
          entry.definition.name,
          entry.definition.article,
          folderPath(this.library, entry.folder),
        ]
          .filter(Boolean)
          .join(' · ');
        list.append(b);
      }
      const previous = button('‹', () => {
        this.pickerPage--;
        this.renderPicker();
      });
      const next = button('›', () => {
        this.pickerPage++;
        this.renderPicker();
      });
      previous.setAttribute('aria-label', 'Föregående items');
      next.setAttribute('aria-label', 'Nästa items');
      previous.disabled = this.pickerPage === 0;
      next.disabled = (this.pickerPage + 1) * 30 >= entries.length;
      const count = document.createElement('small');
      count.textContent = `${entries.length ? this.pickerPage * 30 + 1 : 0}–${Math.min(entries.length, (this.pickerPage + 1) * 30)} av ${entries.length}`;
      $('[data-picker-pages]').replaceChildren(previous, count, next);
      $('[data-picker-status]').textContent =
        this.loadError ||
        (entries.length
          ? 'Välj item och placera startpunkt och riktning i modellen.'
          : !this.pickerFolder
            ? 'Välj en mapp för att se dess items.'
            : this.library.folders.some((f) => f.parent === this.pickerFolder) &&
                !$('[data-picker-search]').value.trim()
              ? 'Inga items direkt i denna mapp. Välj en undermapp.'
              : 'Inga items i mappen matchar sökningen.');
    };
    return async () => {
      $('[data-picker-status]').textContent = 'Läser item-bibliotek…';
      await this.ensureLoaded();
      this.renderPicker();
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
  createEditor() {
    this.editor = document.createElement('dialog');
    this.editor.id = 'item-editor';
    this.editor.setAttribute('aria-label', 'Item-editor');
    this.editor.innerHTML = `<header class="item-header"><div><strong>Item-editor</strong><span>mm · 3D</span></div><button type="button" data-editor-close aria-label="Stäng item-editor">×</button></header>
      <div class="item-editor-layout"><nav class="item-editor-nav"><button type="button" data-back>Tillbaka till bibliotek</button><div data-metadata></div><hr><strong>Hjälpgeometri</strong><p data-helper-count></p><button type="button" data-clear-guides>Rensa hjälplinjer</button><small>Hjälplinjer följer inte med till modellen.</small>
      <details><summary>Hjälplinje via koordinater</summary><div data-helper-coords></div><button type="button" data-add-guide>Lägg till hjälplinje</button></details></nav>
      <section class="item-editor-center"><div class="item-editor-tools"><button type="button" data-mode="select">Markera</button><button type="button" data-mode="start">Startpunkt</button><button type="button" data-mode="end">Slutpunkt</button><button type="button" data-mode="helper">Hjälplinje</button><button type="button" data-fit>Visa allt</button></div>
      <div class="item-editor-tracking"><label><input type="checkbox" data-snap checked> Snap</label><label><input type="checkbox" data-show-guides checked> Visa hjälplinjer</label><label>Arbetsplan <select data-plane><option>XY</option><option>XZ</option><option>YZ</option></select></label><label>Läge · mm <input type="number" data-plane-level step="any" value="0"></label></div><div class="item-editor-view"></div><p class="item-status" data-editor-status role="status"></p></section>
      <form class="item-editor-properties"><strong>Placering</strong><div data-endpoints></div><label class="field">Snap i modellen<select data-model-snap><option value="anchors">Start/slut och referenslinje</option><option value="box">Även omslutande box</option></select></label><small>Fast geometri · Två punkter bestämmer insättning och riktning.</small><p data-editor-error role="alert"></p><button type="submit" class="primary" data-save>Spara version</button><button type="button" data-test>Testa placering</button></form></div>`;
    document.body.append(this.editor);
    this.e$ = (s) => this.editor.querySelector(s);
    this.editor.addEventListener('keydown', (e) => e.stopPropagation());
    const close = () => this.editor.close();
    this.e$('[data-back]').onclick = close;
    this.e$('[data-editor-close]').onclick = close;
    this.editor.addEventListener('close', () => {
      this.view?.dispose();
      this.view = null;
      this.guides = [];
      this.helperStart = null;
      this.render();
    });
    this.editor
      .querySelectorAll('[data-mode]')
      .forEach((b) => (b.onclick = () => this.setMode(b.dataset.mode)));
    this.e$('[data-fit]').onclick = () => this.view.fit();
    this.e$('[data-clear-guides]').onclick = () => {
      this.guides = [];
      this.helperStart = null;
      this.updateGuides();
    };
    this.e$('[data-show-guides]').onchange = () => this.updateGuides();
    this.e$('[data-snap]').onchange = (e) => {
      this.view.snap = e.target.checked;
    };
    this.e$('[data-plane]').onchange = (e) => {
      this.view.plane = e.target.value;
    };
    this.e$('[data-plane-level]').oninput = (e) => {
      this.view.planeLevel = Number(e.target.value);
    };
    this.e$('[data-add-guide]').onclick = () => {
      try {
        const points = ['a', 'b'].map((key) =>
          [...this.e$('[data-helper-coords]').querySelectorAll(`[data-item-field^="${key}:"]`)].map(
            (i) => Number(i.value),
          ),
        );
        this.guides = addHelperLine(this.guides, ...points);
        this.updateGuides();
      } catch (error) {
        this.editorStatus(error.message);
      }
    };
    this.e$('form').onsubmit = async (e) => {
      e.preventDefault();
      const definition = await this.saveEditor();
      if (definition) {
        this.editor.close();
        this.status('Ny item-version sparad. Befintliga placeringar behåller sin version.');
      }
    };
    this.e$('[data-test]').onclick = async () => {
      const definition = await this.saveEditor();
      if (definition) {
        this.editor.close();
        this.dialog.close();
        this.use(definition);
      }
    };
    installItemWorkspace(this.editor);
  }
  edit() {
    const entry = this.selected();
    if (!entry || this.busy) return;
    this.editing = entry;
    this.draft = {
      ...entry.definition,
      start: [...entry.definition.start],
      end: [...entry.definition.end],
    };
    this.guides = [];
    this.helperStart = null;
    const metadata = this.e$('[data-metadata]');
    metadata.replaceChildren();
    for (const [key, label] of [
      ['name', 'Namn'],
      ['article', 'Artikelnummer'],
      ['supplier', 'Leverantör'],
    ]) {
      const input = field(metadata, label, this.draft[key], key);
      input.oninput = () => {
        this.draft[key] = input.value;
      };
    }
    const coords = this.e$('[data-endpoints]');
    coords.replaceChildren();
    for (const key of ['start', 'end']) {
      const group = document.createElement('fieldset');
      const legend = document.createElement('legend');
      legend.textContent = (key === 'start' ? 'Startpunkt' : 'Slutpunkt') + ' · mm';
      group.append(legend);
      const row = document.createElement('div');
      row.className = 'coordinates';
      ['X', 'Y', 'Z'].forEach((axis, i) => {
        const input = field(row, axis, this.draft[key][i], `${key}:${i}`, { type: 'number' });
        input.required = true;
        input.oninput = () => {
          this.draft[key][i] = input.value === '' ? NaN : Number(input.value);
          if (this.draft[key].every(Number.isFinite))
            this.view.setPoints(this.draft.start, this.draft.end);
        };
      });
      group.append(
        row,
        button('Välj i vy', () => this.setMode(key)),
      );
      coords.append(group);
    }
    const helper = this.e$('[data-helper-coords]');
    helper.replaceChildren();
    for (const key of ['a', 'b']) {
      const row = document.createElement('div');
      row.className = 'coordinates';
      ['X', 'Y', 'Z'].forEach((axis, i) =>
        field(
          row,
          `${key === 'a' ? 'Start' : 'Slut'} ${axis}`,
          i === 0 && key === 'b' ? 100 : 0,
          `${key}:${i}`,
          { type: 'number' },
        ),
      );
      helper.append(row);
    }
    this.e$('[data-model-snap]').value = this.draft.snap;
    this.e$('[data-editor-error]').textContent = '';
    this.e$('[data-snap]').checked = true;
    this.e$('[data-show-guides]').checked = true;
    this.e$('[data-plane]').value = 'XY';
    this.e$('[data-plane-level]').value = this.draft.start[2];
    this.editor.showModal();
    this.view = new ItemView(this.e$('.item-editor-view'), {
      pick: (p) => this.pickEditor(p),
      status: (text) => this.editorStatus(text),
    });
    this.view.setItem(this.draft, { points: true });
    this.view.planeLevel = this.draft.start[2];
    this.updateGuides();
    this.setMode('start');
  }
  editorStatus(text) {
    this.e$('[data-editor-status]').textContent = text;
  }
  setMode(mode) {
    this.mode = mode;
    this.helperStart = null;
    this.view.setMode(mode === 'select' ? null : mode);
    this.editor
      .querySelectorAll('[data-mode]')
      .forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));
    this.editorStatus(
      mode === 'helper'
        ? 'Hjälplinje · Välj start och slut'
        : mode === 'select'
          ? 'Rotera och undersök item'
          : `Välj ${mode === 'start' ? 'startpunkt' : 'slutpunkt'} på objektet eller en hjälplinje`,
    );
  }
  pickEditor(point) {
    if (this.mode === 'helper') {
      if (!this.helperStart) {
        this.helperStart = point;
        this.editorStatus('Hjälplinje · Välj slutpunkt');
      } else {
        try {
          this.guides = addHelperLine(this.guides, this.helperStart, point);
          this.helperStart = null;
          this.updateGuides();
        } catch (error) {
          this.editorStatus(error.message);
        }
      }
      return;
    }
    if (!['start', 'end'].includes(this.mode)) return;
    this.draft[this.mode] = point.map((v) => Math.round(v * 1000) / 1000);
    for (const input of this.e$('[data-endpoints]').querySelectorAll(
      `[data-item-field^="${this.mode}:"]`,
    ))
      input.value = this.draft[this.mode][Number(input.dataset.itemField.split(':')[1])];
    this.view.setPoints(this.draft.start, this.draft.end);
    this.editorStatus(
      `${this.mode === 'start' ? 'Startpunkt' : 'Slutpunkt'}: ${this.draft[this.mode].map((v) => v.toLocaleString('sv-SE')).join(' · ')} mm`,
    );
  }
  updateGuides() {
    this.e$('[data-helper-count]').textContent = `${this.guides.length} tillfälliga linjer`;
    this.view.setGuides(this.guides, this.e$('[data-show-guides]').checked);
  }
  async saveEditor() {
    this.e$('[data-save]').disabled = this.e$('[data-test]').disabled = true;
    try {
      const latest =
        this.latest().find((e) => e.definition.id === this.draft.id)?.definition || this.draft;
      const definition = itemRevision(latest, {
        ...this.draft,
        revision: latest.revision + 1,
        snap: this.e$('[data-model-snap]').value,
      });
      validateItemDefinition(definition);
      await this.persist({
        ...this.library,
        items: [...this.library.items, { ...this.editing, definition }],
      });
      this.selection = itemKey(definition);
      return definition;
    } catch (error) {
      this.e$('[data-editor-error]').textContent = error.message;
      return null;
    } finally {
      this.e$('[data-save]').disabled = this.e$('[data-test]').disabled = false;
    }
  }
}
