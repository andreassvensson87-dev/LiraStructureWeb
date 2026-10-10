import { validateItemDefinition, itemKey } from './data.js';
export const emptyItemLibrary = () => ({
  version: 1,
  folders: [{ id: 'standard', name: 'Standard', parent: null }],
  items: [],
});
export function validateItemLibrary(library) {
  if (
    !library ||
    library.version !== 1 ||
    !Array.isArray(library.folders) ||
    !library.folders.length ||
    library.folders.length > 1000 ||
    !Array.isArray(library.items) ||
    library.items.length > 10000
  )
    throw Error('Ogiltigt item-bibliotek.');
  if (
    library.bundledCatalogs !== undefined &&
    (!Array.isArray(library.bundledCatalogs) ||
      !library.bundledCatalogs.every((id) => typeof id === 'string' && id.length < 200))
  )
    throw Error('Ogiltiga katalogversioner.');
  const folders = new Map();
  for (const folder of library.folders) {
    if (
      !folder ||
      typeof folder.id !== 'string' ||
      !folder.id ||
      folders.has(folder.id) ||
      typeof folder.name !== 'string' ||
      !folder.name.trim() ||
      folder.name.length > 200
    )
      throw Error('Ogiltiga item-mappar.');
    folders.set(folder.id, folder);
  }
  for (const folder of library.folders) {
    const seen = new Set([folder.id]);
    let parent = folder.parent;
    while (parent != null) {
      if (!folders.has(parent) || seen.has(parent)) throw Error('Ogiltigt mappträd.');
      seen.add(parent);
      parent = folders.get(parent).parent;
    }
  }
  const keys = new Set();
  for (const entry of library.items) {
    validateItemDefinition(entry.definition);
    const key = itemKey(entry.definition);
    if (!folders.has(entry.folder) || keys.has(key) || typeof entry.starred !== 'boolean')
      throw Error('Ogiltig bibliotekspost.');
    keys.add(key);
  }
  return library;
}
/** Seed once, preserving edited definitions and matching existing folder paths. */
export function mergeBundledItems(library, catalog, catalogId) {
  validateItemLibrary(library);
  validateItemLibrary(catalog);
  if (library.bundledCatalogs?.includes(catalogId)) return library;
  const folders = [...library.folders],
    folderIds = new Map();
  const addFolder = (folder) => {
    if (folderIds.has(folder.id)) return folderIds.get(folder.id);
    const parent =
      folder.parent == null ? null : addFolder(catalog.folders.find((f) => f.id === folder.parent));
    const known =
      (folder.parent == null ? folders.find((f) => f.name === folder.name) : null) ||
      folders.find((f) => f.id === folder.id) ||
      folders.find((f) => f.name === folder.name && f.parent === parent);
    if (known && known.name !== folder.name) throw Error('Mappkonflikt i standardbiblioteket.');
    const next =
      known && folder.parent != null && known.parent !== parent
        ? { ...known, parent }
        : known || { ...folder, parent };
    if (!known) folders.push(next);
    else if (next !== known) folders[folders.indexOf(known)] = next;
    folderIds.set(folder.id, next.id);
    return next.id;
  };
  catalog.folders.forEach(addFolder);
  const destinations = new Map(
    catalog.items.map((e) => [e.definition.geometryId, folderIds.get(e.folder)]),
  );
  const items = library.items.map((e) =>
    destinations.has(e.definition.geometryId)
      ? { ...e, folder: destinations.get(e.definition.geometryId) }
      : e,
  );
  const geometries = new Set(items.map((e) => e.definition.geometryId));
  for (const entry of catalog.items)
    if (!geometries.has(entry.definition.geometryId)) {
      items.push({ ...entry, folder: folderIds.get(entry.folder) });
      geometries.add(entry.definition.geometryId);
    }
  return validateItemLibrary({
    ...library,
    folders: folders.filter(
      (f) =>
        !catalog.folders.some((seed) => seed.id === f.id && folderIds.get(seed.id) !== f.id) ||
        folders.some((child) => child.parent === f.id) ||
        items.some((e) => e.folder === f.id),
    ),
    items,
    bundledCatalogs: [...(library.bundledCatalogs || []), catalogId],
  });
}
/** A one-time folder migration leaves item revisions and user edits intact. */
export function organizeWeland(library) {
  const marker = 'weland-folders-v1';
  if (library.bundledCatalogs?.includes(marker)) return library;
  const roots = library.folders.filter(
    (f) =>
      f.name === 'Sectional Railing' &&
      (f.id.startsWith('sectional-folder-') ||
        library.items.some((e) => e.folder === f.id && e.definition.id.startsWith('sectional-')) ||
        library.bundledCatalogs?.includes('sectional-railing-2026-10-v2')),
  );
  if (!roots.length) return library;
  const supplier = library.folders.find((f) => f.name === 'Weland' && f.parent == null) || {
    id: 'weland',
    name: 'Weland',
    parent: null,
  };
  return validateItemLibrary({
    ...library,
    folders: [
      ...library.folders
        .filter((f) => f.id !== supplier.id)
        .map((f) => (roots.includes(f) ? { ...f, parent: supplier.id } : f)),
      supplier,
    ],
    bundledCatalogs: [...(library.bundledCatalogs || []), marker],
  });
}
export function folderPath(library, id) {
  const folders = new Map(library.folders.map((f) => [f.id, f]));
  const path = [];
  while (folders.has(id)) {
    const f = folders.get(id);
    path.unshift(f.name);
    id = f.parent;
  }
  return path.join(' / ');
}
export function folderDescendants(library, id) {
  const ids = new Set([id]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const f of library.folders)
      if (ids.has(f.parent) && !ids.has(f.id)) {
        ids.add(f.id);
        changed = true;
      }
  }
  return ids;
}
export function editItemFolder(library, id, name, parent) {
  const excluded = folderDescendants(library, id);
  if (excluded.has(parent))
    throw Error('En mapp kan inte flyttas till sig själv eller sin undermapp.');
  name = name.trim();
  if (library.folders.some((f) => f.id !== id && f.parent === parent && f.name === name))
    throw Error('Mappen finns redan på den nivån.');
  return validateItemLibrary({
    ...library,
    folders: library.folders.map((f) => (f.id === id ? { ...f, name, parent } : f)),
  });
}
export function findLibraryItems(library, folder, search = '', { recursive = true } = {}) {
  const latest = new Map();
  for (const e of library.items)
    if (
      !latest.has(e.definition.id) ||
      latest.get(e.definition.id).definition.revision < e.definition.revision
    )
      latest.set(e.definition.id, e);
  const ids = recursive ? folderDescendants(library, folder) : new Set([folder]);
  const paths = new Map(library.folders.map((f) => [f.id, folderPath(library, f.id)]));
  const words = search.toLocaleLowerCase('sv-SE').trim().split(/\s+/).filter(Boolean);
  return [...latest.values()].filter(
    (e) =>
      (folder === 'all' || (folder === 'starred' ? e.starred : ids.has(e.folder))) &&
      words.every((word) =>
        `${e.definition.name} ${e.definition.article} ${e.definition.supplier} ${paths.get(e.folder)}`
          .toLocaleLowerCase('sv-SE')
          .includes(word),
      ),
  );
}
export class ItemStore {
  constructor({ catalogId = null, loadBundled = null } = {}) {
    this.catalogId = catalogId;
    this.loadBundled = loadBundled;
  }
  async database() {
    if (!this.db)
      this.db = new Promise((resolve, reject) => {
        const request = indexedDB.open('lirastructure-items', 1);
        request.onupgradeneeded = () => request.result.createObjectStore('library');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(Error('Item-biblioteket kunde inte öppnas.'));
      });
    return this.db;
  }
  async load() {
    const db = await this.database();
    const library = await new Promise((resolve, reject) => {
      const request = db.transaction('library').objectStore('library').get('catalog');
      request.onsuccess = () => {
        try {
          resolve(validateItemLibrary(request.result || emptyItemLibrary()));
        } catch (e) {
          reject(e);
        }
      };
      request.onerror = () => reject(Error('Item-biblioteket kunde inte läsas.'));
    });
    const seeded =
      !this.loadBundled || library.bundledCatalogs?.includes(this.catalogId)
        ? library
        : mergeBundledItems(library, await this.loadBundled(), this.catalogId);
    const merged = organizeWeland(seeded);
    if (merged !== library) await this.save(merged);
    return merged;
  }
  async save(library) {
    validateItemLibrary(library);
    const db = await this.database();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('library', 'readwrite');
      tx.objectStore('library').put(library, 'catalog');
      tx.oncomplete = () => resolve();
      tx.onabort = tx.onerror = () =>
        reject(Error('Item-biblioteket kunde inte sparas. Kontrollera ledigt lagringsutrymme.'));
    });
  }
}
