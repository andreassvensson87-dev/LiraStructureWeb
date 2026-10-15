import { findLibraryItems } from './store.js';
import { itemKey } from './data.js';

/** Shared item-library hierarchy for the full library and its compact selector. */
export function itemLibraryTree(library, query = '', { compact = false } = {}) {
  const entries = findLibraryItems(library, 'all', query).sort((a, b) =>
    a.definition.name.localeCompare(b.definition.name, 'sv-SE', { numeric: true }),
  );
  const leaf = (entry) => ({
    key: itemKey(entry.definition),
    label: compact
      ? entry.definition.name
      : [entry.definition.article, entry.definition.name].filter(Boolean).join(' · '),
    title: [entry.definition.name, entry.definition.article, `v${entry.definition.revision}`]
      .filter(Boolean)
      .join(' · '),
    icon: 'cube',
    value: entry,
  });
  const folders = (parent) =>
    library.folders
      .filter((f) => f.parent === parent)
      .map((folder) => ({
        key: `folder:${folder.id}`,
        label: folder.name,
        folder: folder.id,
        icon: 'folder',
        selectable: !compact,
        children: [
          ...folders(folder.id),
          ...entries.filter((e) => e.folder === folder.id).map(leaf),
        ],
      }))
      .filter((node) => !query.trim() || node.children.length);
  const favorites = entries.filter((e) => e.starred);
  return [
    ...(favorites.length
      ? [
          {
            key: 'favorites',
            label: 'Favoriter',
            icon: 'star',
            children: favorites.map((entry) => ({
              ...leaf(entry),
              key: `favorite:${itemKey(entry.definition)}`,
            })),
          },
        ]
      : []),
    ...folders(null),
  ];
}
